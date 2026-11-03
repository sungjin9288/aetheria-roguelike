// 2026-10 Wave 127 — 소유자 결정(2026-10-19): "처음 숲으로 갈 경우 이벤트를 통해 새로운 길을 발견하는 느낌이 존재하는데
//   해당 기능 삭제하고 퀘스트를 통해 자동으로 알게 되게 하자".
// 2026-11 — 소유자 결정: "스토리를 진행하면서 발생하는 이벤트들은 확정이 아니라 확률 이벤트로 — 첫번째 맵을 돌아다니다가
//   확률적으로 이벤트가 발생해서 알게 되는 식".
//
// 첫 탐험은 여전히 이야기 화면으로 막히지 않는다. 첫 임무 '첫 번째 여정'이 사라진 마법사를 열지만, 수령이 단서를 바로 주던
// Wave 127과 달리 수령 기록은 숲에 흔적이 있다는 것만 말하고, 단서(그을린 지팡이 파편 → 수정 동굴)는 수령 뒤 고요한 숲을
// 탐험하다 확률로 나타나는 0단계 이벤트다(`questGate`). 사냥 지역의 모든 이야기 단계가 같은 확률 판정을 거치고, 판정은 탐험
// 난수를 쓰지 않는다. 단계 번호는 그대로라 저장된 진행 값의 뜻이 바뀌지 않는다.
//
// 전부 실제 모듈(데이터 · 탐험 액션 · 리듀서 · 체인 일지)을 호출해 결과를 단언한다 — 소스 정규식 없음.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    EVENT_CHAINS, advanceQuestStartedChains, getChainEventForLoc, getChainQuestGate, isChainEventStep,
} from '../src/data/eventChains.ts';
import { FIRST_STORY_QUEST_ID, QUESTS } from '../src/data/quests.ts';
import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';
import { buildChainJournal } from '../src/utils/chainJournal.ts';
import { isChainStepEncountered } from '../src/utils/chainStepEncounter.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

const FOREST = '고요한 숲';
const wizard = EVENT_CHAINS.find((chain) => chain.id === 'lost_wizard');
const forestStep = wizard.steps[0];
const gate = getChainQuestGate(forestStep);

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

/** 실제 탐험 액션 한 번 — 쓴 탐험 난수의 수도 센다. */
const exploreAt = async (state, loc, explores, rng = () => 0.99) => {
    let draws = 0;
    let current = {
        ...state,
        player: {
            ...state.player,
            loc,
            stats: { ...state.player.stats, ...(explores === undefined ? {} : { explores }) },
        },
    };
    const deps = {
        player: current.player, gameState: current.gameState,
        rng: () => { draws += 1; return rng(); },
        dispatch(action) { current = gameReducer(current, action); },
        addLog() {}, addStoryLog() {},
        getFullStats: () => calculateFullStats(current.player),
    };
    await createExploreActions(deps, makeSharedHelpers(deps)).explore();
    return { state: current, draws };
};

const claim = (state, questId = FIRST_STORY_QUEST_ID) => gameReducer(
    { ...state, gameState: GS.IDLE, enemy: null, currentEvent: null, player: { ...state.player, loc: '시작의 마을' } },
    { type: AT.CLAIM_QUEST_REWARD, payload: { questId } },
);

const claimedFirstQuest = async () => claim((await exploreAt(freshState(), FOREST)).state);

/** 숲의 0단계가 나타나는 · 나타나지 않는 탐험 수 하나씩. */
const forestRolls = (player) => {
    let hit = null;
    let miss = null;
    for (let explores = 0; explores < 200 && (hit === null || miss === null); explores += 1) {
        const encountered = isChainStepEncountered({ ...player, loc: FOREST, stats: { ...player.stats, explores } }, 'field', 'lost_wizard', 0);
        if (encountered && hit === null) hit = explores;
        if (!encountered && miss === null) miss = explores;
    }
    return { hit, miss };
};

test('데이터: 사라진 마법사 0단계는 첫 임무가 여는 숲의 이벤트이고, 진행 결과가 수정 동굴을 알린다', () => {
    assert.equal(DB.MAPS[FOREST].type === 'safe', false, '고요한 숲은 사냥 지역이다(확률 판정을 거친다)');
    assert.equal(forestStep.loc, FOREST);
    assert.equal(isChainEventStep(forestStep), true);
    assert.equal(gate?.questId, FIRST_STORY_QUEST_ID);
    assert.ok(QUESTS.some((quest) => quest.id === gate.questId));
    assert.equal('questStart' in forestStep, false, '수령이 단계를 끝내지 않는다');
    const advance = forestStep.event.outcomes.find((outcome) => outcome.type === 'chain_advance');
    assert.ok(advance.log.includes(wizard.steps[1].loc), '진행 결과가 다음 지역을 말한다');
    assert.equal(gate.log.includes(wizard.steps[1].loc), false, '수령 기록은 다음 지역을 미리 말하지 않는다');
});

test('[트리거] 첫 임무를 수령하기 전에는 숲에서 사라진 마법사가 나오지 않는다 — 첫 탐험이 이야기 화면으로 막히지 않는다', async () => {
    assert.equal(getChainEventForLoc(FOREST, {}, undefined, 0), null);
    assert.equal(getChainEventForLoc(FOREST, {}, undefined, 0, []), null);
    const { state: explored } = await exploreAt(freshState(), FOREST);
    assert.notEqual(explored.currentEvent?._chainId, 'lost_wizard');
    assert.equal(explored.player.stats.explores, 1);
    const quest = explored.player.quests.find((entry) => entry.id === FIRST_STORY_QUEST_ID);
    const goal = QUESTS.find((entry) => entry.id === FIRST_STORY_QUEST_ID).goal;
    assert.ok(quest.progress >= goal, `첫 임무 ${quest.progress}/${goal}`);
    assert.equal(buildChainJournal(explored.player.eventChainProgress, undefined, explored.player.stats.claimedQuestIds)
        .some((entry) => entry.chainId === 'lost_wizard'), false);
    // 수령 전에는 숲의 이벤트가 나타날 탐험 수에서도 나오지 않는다.
    const { hit } = forestRolls(explored.player);
    const { state: atHit } = await exploreAt(explored, FOREST, hit);
    assert.notEqual(atHit.currentEvent?._chainId, 'lost_wizard');
});

test('[수령] 첫 임무를 받으면 진행 값은 그대로이고, 기록 · 일지가 숲을 가리킨다 — 단서는 아직 모른다', async () => {
    const claimed = await claimedFirstQuest();
    const claimedIds = claimed.player.stats.claimedQuestIds;
    assert.ok(claimedIds.includes(FIRST_STORY_QUEST_ID));
    assert.equal(claimed.player.eventChainProgress?.lost_wizard ?? 0, 0);
    const opened = MSG.CHAIN_QUEST_OPENED(wizard.label, gate.log);
    assert.equal(claimed.logs.filter((log) => log.type === 'event' && log.text === opened).length, 1);
    const [entry] = buildChainJournal(claimed.player.eventChainProgress, undefined, claimedIds).filter((journal) => journal.chainId === 'lost_wizard');
    assert.equal(entry.nextLoc, FOREST);
    assert.equal(entry.currentStep, 0);
    assert.equal(getChainEventForLoc(FOREST, claimed.player.eventChainProgress, undefined, 0, claimedIds)?.step.step, 0);
    assert.equal(getChainEventForLoc(wizard.steps[1].loc, claimed.player.eventChainProgress, undefined, 0, claimedIds), null, '수정 동굴은 아직이다');
    // Wave 127의 수령 규칙(`advanceQuestStartedChains`)은 이 이야기를 건드리지 않는다.
    assert.deepEqual(advanceQuestStartedChains(claimed.player.eventChainProgress, claimedIds).started, []);
});

test('[확률] 수령 뒤 숲을 돌아다니면 탐험마다 확률로 단서가 나타난다 — 나타나면 이야기 화면, 아니면 평소 탐험이다', async () => {
    const claimed = await claimedFirstQuest();
    const { hit, miss } = forestRolls(claimed.player);
    assert.ok(hit !== null && miss !== null);

    const { state: found } = await exploreAt(claimed, FOREST, hit);
    assert.equal(found.gameState, GS.EVENT);
    assert.equal(found.currentEvent?._chainId, 'lost_wizard');
    assert.equal(found.currentEvent?._chainStep, 0);

    const { state: roamed } = await exploreAt(claimed, FOREST, miss);
    assert.notEqual(roamed.currentEvent?._chainId, 'lost_wizard');
    assert.equal(roamed.player.stats.explores, miss + 1, '평소 탐험으로 정산된다');

    // 단서를 챙기면(체인 진행 전이) 1단계로 넘어가고 일지 · 다음 이벤트가 수정 동굴을 가리킨다.
    const advanced = gameReducer(found, { type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: 'lost_wizard', step: 1 } });
    const claimedIds = advanced.player.stats.claimedQuestIds;
    assert.equal(advanced.player.eventChainProgress.lost_wizard, 1);
    const [entry] = buildChainJournal(advanced.player.eventChainProgress, undefined, claimedIds).filter((journal) => journal.chainId === 'lost_wizard');
    assert.equal(entry.nextLoc, wizard.steps[1].loc);
    assert.equal(getChainEventForLoc(wizard.steps[1].loc, advanced.player.eventChainProgress, undefined, 0, claimedIds)?.step.step, 1);
});

test('[확률] 사냥 지역의 판정은 탐험 수의 해시다 — 비율은 상수와 같고, 같은 탐험 수는 같은 결과, 안전지대는 확정이다', () => {
    const player = { loc: FOREST, stats: { explores: 0 } };
    let hits = 0;
    const N = 4000;
    for (let explores = 0; explores < N; explores += 1) {
        const roll = isChainStepEncountered({ ...player, stats: { explores } }, 'field', 'lost_wizard', 0);
        assert.equal(roll, isChainStepEncountered({ ...player, stats: { explores } }, 'field', 'lost_wizard', 0));
        if (roll) hits += 1;
    }
    const rate = hits / N;
    const sigma = Math.sqrt(BALANCE.CHAIN_STEP_ENCOUNTER_CHANCE * (1 - BALANCE.CHAIN_STEP_ENCOUNTER_CHANCE) / N);
    assert.ok(Math.abs(rate - BALANCE.CHAIN_STEP_ENCOUNTER_CHANCE) < 4 * sigma, `비율 ${rate}`);
    for (let explores = 0; explores < 50; explores += 1) {
        assert.equal(isChainStepEncountered({ loc: '사막 오아시스', stats: { explores } }, 'safe', 'water_apostle', 1), true);
    }
});

test('[난수] 단서가 나타나지 않은 탐험은 이야기가 기다리지 않는 탐험과 같다 — 판정이 탐험 난수를 쓰지 않는다', async () => {
    const claimed = await claimedFirstQuest();
    const unclaimed = { ...claimed, player: { ...claimed.player, stats: { ...claimed.player.stats, claimedQuestIds: [] } } };
    let compared = 0;
    for (let explores = 0; explores < 60 && compared < 8; explores += 1) {
        if (isChainStepEncountered({ ...claimed.player, loc: FOREST, stats: { ...claimed.player.stats, explores } }, 'field', 'lost_wizard', 0)) continue;
        let seed = explores + 1;
        const seq = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const pending = await exploreAt(claimed, FOREST, explores, seq);
        seed = explores + 1;
        const plain = await exploreAt(unclaimed, FOREST, explores, seq);
        assert.equal(pending.draws, plain.draws, `탐험 ${explores}: 쓴 난수 수`);
        assert.equal(pending.state.gameState, plain.state.gameState);
        assert.equal(pending.state.enemy?.name, plain.state.enemy?.name);
        assert.equal(pending.state.currentEvent?.desc, plain.state.currentEvent?.desc);
        compared += 1;
    }
    assert.ok(compared >= 8);
});

test('[다른 임무] 이야기를 열지 않는 임무의 수령은 체인을 건드리지 않는다', () => {
    const state = freshState();
    const before = state.player.eventChainProgress;
    const unrelated = advanceQuestStartedChains(before, [1, 2, 10]);
    assert.equal(unrelated.progress, before ?? unrelated.progress);
    assert.deepEqual(unrelated.started, []);
});

test('[불러오기] Wave 127 규칙 아래 수령한 세이브는 그대로다 — 1단계 이후는 그대로 이어지고, 0단계면 숲에서 단서를 찾는다', () => {
    const load = (player) => gameReducer(INITIAL_STATE, { type: AT.LOAD_DATA, payload: { player, gameState: GS.IDLE } }).player;
    const base = structuredClone(INITIAL_STATE.player);
    const claimedStats = { ...base.stats, claimedQuestIds: [FIRST_STORY_QUEST_ID] };
    assert.equal(load({ ...base, stats: claimedStats, eventChainProgress: { lost_wizard: 1 } }).eventChainProgress.lost_wizard, 1);
    assert.equal(load({ ...base, stats: claimedStats, eventChainProgress: { lost_wizard: 2 } }).eventChainProgress.lost_wizard, 2);
    assert.equal(load({ ...base, stats: claimedStats, eventChainProgress: { lost_wizard: 'failed' } }).eventChainProgress.lost_wizard, 'failed');
    const pending = load({ ...base, stats: claimedStats, eventChainProgress: { lost_wizard: 0 } });
    assert.equal(pending.eventChainProgress.lost_wizard ?? 0, 0);
    assert.equal(getChainEventForLoc(FOREST, pending.eventChainProgress, undefined, 0, pending.stats.claimedQuestIds)?.step.step, 0);
});

test('[새 여정] 사망하면 체인과 임무가 처음부터이고, 다시 첫 임무를 받아야 숲의 단서가 나온다', async () => {
    const claimed = await claimedFirstQuest();
    const reset = gameReducer(claimed, { type: AT.RESET_GAME });
    assert.equal(reset.player.eventChainProgress?.lost_wizard ?? 0, 0);
    assert.equal((reset.player.stats?.claimedQuestIds || []).includes(FIRST_STORY_QUEST_ID), false);
    assert.equal(getChainEventForLoc(FOREST, reset.player.eventChainProgress, undefined, 0, reset.player.stats?.claimedQuestIds), null);
});
