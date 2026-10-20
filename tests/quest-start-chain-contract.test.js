// 2026-10 Wave 127 — 소유자 결정(2026-10-19): "처음 숲으로 갈 경우 이벤트를 통해 새로운 길을 발견하는 느낌이 존재하는데
//   해당 기능 삭제하고 퀘스트를 통해 자동으로 알게 되게 하자".
//
// 첫 원정의 첫 탐험은 '사라진 마법사' 체인의 첫 단계 '마법의 흔적'을 강제로 띄웠고, 그 선택이 "수정 동굴 방향으로
// 이어집니다"를 알렸다. 이제 그 단계(`questStart`)에는 이벤트가 없다 — 첫 임무 '첫 번째 여정'을 수령하면 단계가 끝나고
// 다음 단서는 수령 기록과 임무 탭의 체인 일지가 알린다. 단계 번호는 그대로라 저장된 진행 값의 뜻이 바뀌지 않는다.
//
// 전부 실제 모듈(데이터 · 탐험 액션 · 리듀서 · 체인 일지)을 호출해 결과를 단언한다 — 소스 정규식 없음.
import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS, advanceQuestStartedChains, getChainEventForLoc, isChainEventStep } from '../src/data/eventChains.ts';
import { FIRST_STORY_QUEST_ID, QUESTS } from '../src/data/quests.ts';
import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';
import { buildChainJournal } from '../src/utils/chainJournal.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

const FOREST = '고요한 숲';
const wizard = EVENT_CHAINS.find((chain) => chain.id === 'lost_wizard');
const questStep = wizard.steps[0];

const freshState = () => {
    const base = structuredClone(INITIAL_STATE);
    let state = {
        ...base,
        gameState: GS.IDLE,
        player: { ...base.player, name: '첫 여정', job: '모험가', loc: '시작의 마을' },
    };
    // 첫 임무는 새 여정 시작 때 자동으로 받는다(characterActions) — 같은 리듀서 전이를 쓴다.
    state = gameReducer(state, { type: AT.ACCEPT_QUEST, payload: { questId: FIRST_STORY_QUEST_ID } });
    return state;
};

const exploreAt = async (state, loc, rng = () => 0.99) => {
    let current = { ...state, player: { ...state.player, loc } };
    const deps = {
        player: current.player, gameState: current.gameState, rng,
        dispatch(action) { current = gameReducer(current, action); },
        addLog() {}, addStoryLog() {},
        getFullStats: () => calculateFullStats(current.player),
    };
    await createExploreActions(deps, makeSharedHelpers(deps)).explore();
    return current;
};

const claim = (state, questId = FIRST_STORY_QUEST_ID) => gameReducer(
    { ...state, gameState: GS.IDLE, enemy: null, currentEvent: null, player: { ...state.player, loc: '시작의 마을' } },
    { type: AT.CLAIM_QUEST_REWARD, payload: { questId } },
);

test('데이터: 사라진 마법사 첫 단계는 이벤트가 없고 첫 임무가 연다 — 임무로 여는 단계는 이것 하나다', () => {
    assert.equal(questStep.loc, FOREST);
    assert.equal(questStep.event, undefined);
    assert.equal(isChainEventStep(questStep), false);
    assert.equal(questStep.questStart.questId, FIRST_STORY_QUEST_ID);
    assert.ok(QUESTS.some((quest) => quest.id === questStep.questStart.questId));
    // 단서 문구는 다음 단계의 지역을 말한다(그 단계의 이벤트가 그곳에서 열린다).
    assert.ok(questStep.questStart.log.includes(wizard.steps[1].loc));
    const questSteps = EVENT_CHAINS.flatMap((chain) => chain.steps.filter((step) => !isChainEventStep(step)).map((step) => `${chain.id}:${step.step}`));
    assert.deepEqual(questSteps, ['lost_wizard:0']);
});

test('[트리거] 고요한 숲은 새 여정에서 체인 이벤트를 띄우지 않는다 — 첫 탐험이 이야기 화면으로 막히지 않는다', async () => {
    assert.equal(getChainEventForLoc(FOREST, {}, undefined, 0), null);
    const explored = await exploreAt(freshState(), FOREST);
    assert.notEqual(explored.currentEvent?._chainId, 'lost_wizard');
    assert.equal(explored.player.stats.explores, 1);
    // 첫 임무는 그 탐험으로 목표에 닿는다(탐험 1회).
    const quest = explored.player.quests.find((entry) => entry.id === FIRST_STORY_QUEST_ID);
    const goal = QUESTS.find((entry) => entry.id === FIRST_STORY_QUEST_ID).goal;
    assert.ok(quest.progress >= goal, `첫 임무 ${quest.progress}/${goal}`);
    // 수령 전에는 체인이 시작되지 않았다 — 일지에 없고 수정 동굴에서도 열리지 않는다.
    assert.equal(explored.player.eventChainProgress?.lost_wizard ?? 0, 0);
    assert.equal(buildChainJournal(explored.player.eventChainProgress).some((entry) => entry.chainId === 'lost_wizard'), false);
    assert.notEqual(getChainEventForLoc(wizard.steps[1].loc, explored.player.eventChainProgress, undefined, 0)?.chain.id, 'lost_wizard');
});

test('[수령] 첫 임무를 받으면 체인이 다음 단계로 넘어가고, 기록과 체인 일지가 수정 동굴을 알린다', async () => {
    const explored = await exploreAt(freshState(), FOREST);
    const claimed = claim(explored);
    assert.ok(claimed.player.stats.claimedQuestIds.includes(FIRST_STORY_QUEST_ID));
    assert.equal(claimed.player.eventChainProgress.lost_wizard, 1);
    const lead = MSG.CHAIN_QUEST_START(wizard.label, questStep.questStart.log);
    assert.ok(claimed.logs.some((log) => log.type === 'event' && log.text === lead), '수령 기록이 단서를 말한다');
    const [entry] = buildChainJournal(claimed.player.eventChainProgress).filter((journal) => journal.chainId === 'lost_wizard');
    assert.equal(entry.nextLoc, wizard.steps[1].loc);
    // 수정 동굴에서 다음 이야기(마법사의 일기장)가 열린다.
    const next = getChainEventForLoc(wizard.steps[1].loc, claimed.player.eventChainProgress, undefined, 0);
    assert.equal(next?.chain.id, 'lost_wizard');
    assert.equal(next?.step.step, 1);
    // 같은 임무를 다시 수령할 수 없으니 두 번 넘어가지 않는다(단서 기록도 한 번이다).
    const again = claim(claimed);
    assert.equal(again.player.eventChainProgress.lost_wizard, 1);
    assert.equal(again.logs.filter((log) => log.text === lead).length, 1);
});

test('[다른 임무] 첫 임무가 아닌 수령은 체인을 건드리지 않는다', () => {
    const state = freshState();
    const before = state.player.eventChainProgress;
    const unrelated = advanceQuestStartedChains(before, [81, 82]);
    assert.equal(unrelated.progress, before ?? unrelated.progress);
    assert.deepEqual(unrelated.started, []);
});

test('[불러오기] 이 규칙 전에 첫 임무를 받고 숲의 이벤트를 지나친 세이브는 불러올 때 체인이 열린다 — 그 밖은 그대로다', () => {
    const load = (player) => gameReducer(INITIAL_STATE, { type: AT.LOAD_DATA, payload: { player, gameState: GS.IDLE } }).player;
    const base = structuredClone(INITIAL_STATE.player);
    const claimedStats = { ...base.stats, claimedQuestIds: [FIRST_STORY_QUEST_ID] };
    assert.equal(load({ ...base, stats: claimedStats, eventChainProgress: { lost_wizard: 0 } }).eventChainProgress.lost_wizard, 1);
    assert.equal(load({ ...base, stats: claimedStats, eventChainProgress: {} }).eventChainProgress.lost_wizard, 1);
    assert.equal(load({ ...base, stats: claimedStats, eventChainProgress: { lost_wizard: 2 } }).eventChainProgress.lost_wizard, 2);
    assert.equal(load({ ...base, stats: claimedStats, eventChainProgress: { lost_wizard: 'failed' } }).eventChainProgress.lost_wizard, 'failed');
    // 첫 임무를 아직 받지 않았으면 그대로다.
    assert.equal(load({ ...base, eventChainProgress: { lost_wizard: 0 } }).eventChainProgress.lost_wizard, 0);
});

test('[새 여정] 사망하면 체인과 임무가 처음부터이고, 다시 첫 임무를 받아야 체인이 열린다', async () => {
    const claimed = claim(await exploreAt(freshState(), FOREST));
    assert.equal(claimed.player.eventChainProgress.lost_wizard, 1);
    const reset = gameReducer(claimed, { type: AT.RESET_GAME });
    assert.equal(reset.player.eventChainProgress?.lost_wizard ?? 0, 0);
    assert.equal((reset.player.stats?.claimedQuestIds || []).includes(FIRST_STORY_QUEST_ID), false);
});
