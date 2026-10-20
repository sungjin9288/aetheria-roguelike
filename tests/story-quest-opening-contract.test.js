// 2026-10 Wave 128 — 소유자 결정(2026-10-20): "임무로 시작하게 바꿔 / 스토리, 시나리오, 퀘스트 같이 자연스러운 구조로 이어지게".
//
// Wave 127은 첫 숲의 이야기('사라진 마법사')만 첫 임무가 열게 했다. 나머지 12개 이야기는 여전히 그 지역의 첫 탐험이
// 0단계 이벤트를 강제로 띄웠다. 이제 모든 이야기의 0단계는 임무로 연다(`questStart`):
//   - 본편 장 80 · 81 · 82 · 84가 그 지역의 곁가지 이야기(사라진 마법사 · 잊혀진 사령관 · 용의 유산 · 기계의 반란)를 열고,
//   - 나머지 9개는 그 이야기가 시작되는 지역의 임무가 연다(게시판에 소문을 보이는 이야기 임무).
//   임무를 수령하면 단서 기록이 다음 단계의 지역을 알리고, 1단계부터는 지역 이벤트다.
//
// 전부 실제 모듈(데이터 · 리듀서 · 탐험 액션 · 게시판 · 체인 일지)을 호출해 결과를 단언한다 — 소스 정규식 없음.
import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS, getChainEventForLoc, getChainQuestStart, getQuestOpenedChain, isChainEventStep } from '../src/data/eventChains.ts';
import { QUESTS } from '../src/data/quests.ts';
import { MSG } from '../src/data/messages.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';
import { buildChainJournal } from '../src/utils/chainJournal.ts';
import { getQuestBoardRecommendations } from '../src/utils/questOperations.ts';
import { getMapRouteGate } from '../src/utils/mapRouteGate.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

const TOWN = '시작의 마을';
const questById = (id) => QUESTS.find((quest) => quest.id === id);
const isMainStory = (quest) => String(quest?.title || '').includes('[스토리]');
const openings = EVENT_CHAINS.map((chain) => ({ chain, start: getChainQuestStart(chain.steps[0]), quest: questById(getChainQuestStart(chain.steps[0])?.questId) }));

/** 임무 목표가 진행되는 지역 — `location`이 있으면 그곳, 없으면 목표 몬스터가 나오는 지역 전부. */
const objectiveRegions = (quest) => {
    if (quest.location) return [quest.location];
    return Object.entries(DB.MAPS)
        .filter(([, map]) => [...(map.monsters || []), ...(map.bossMonsters || [])].includes(quest.target))
        .map(([name]) => name);
};

/** 선행 사슬(본편)을 모두 수령한 상태 — 수락 레벨에 마을에 있다. */
const stateBeforeAccept = (quest, progress = {}) => {
    const base = structuredClone(INITIAL_STATE);
    const prerequisites = [];
    for (let current = quest; current?.prerequisiteQuestId != null; current = questById(current.prerequisiteQuestId)) {
        prerequisites.push(current.prerequisiteQuestId);
    }
    return {
        ...base,
        gameState: GS.IDLE,
        player: {
            ...base.player,
            name: '이야기', job: '모험가', loc: TOWN, level: quest.minLv || 1,
            eventChainProgress: progress,
            stats: { ...base.player.stats, claimedQuestIds: prerequisites },
        },
    };
};

const acceptAndFinish = (state, quest) => {
    const accepted = gameReducer(state, { type: AT.ACCEPT_QUEST, payload: { questId: quest.id } });
    assert.ok(accepted.player.quests.some((entry) => entry.id === quest.id), `${quest.id} 수락`);
    return {
        ...accepted,
        player: {
            ...accepted.player,
            quests: accepted.player.quests.map((entry) => (entry.id === quest.id ? { ...entry, progress: quest.goal } : entry)),
        },
    };
};

const claim = (state, quest) => gameReducer(state, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: quest.id } });

test('[데이터] 모든 이야기의 0단계는 임무로 연다 — 1단계부터는 지역 이벤트이고, 임무 하나는 이야기 하나만 연다', () => {
    assert.equal(EVENT_CHAINS.length, 13);
    for (const { chain, start, quest } of openings) {
        assert.equal(isChainEventStep(chain.steps[0]), false, `${chain.id} 0단계에 이벤트가 없다`);
        assert.ok(start, `${chain.id} 0단계는 임무로 연다`);
        assert.ok(quest, `${chain.id} 여는 임무 ${start.questId}가 임무 목록에 있다`);
        for (const step of chain.steps.slice(1)) {
            assert.equal(isChainEventStep(step), true, `${chain.id}:${step.step}는 지역 이벤트다`);
            assert.equal(getChainQuestStart(step), null);
        }
    }
    const questIds = openings.map(({ start }) => start.questId);
    assert.equal(new Set(questIds).size, questIds.length, '한 임무가 두 이야기를 열지 않는다');
});

test('[데이터] 이야기는 여는 임무를 하는 지역에서 시작하고, 그 지역에 처음 들어가는 레벨에서 한 레벨 안에 열 수 있다', () => {
    for (const { chain, quest } of openings) {
        const region = chain.steps[0].loc;
        assert.ok(objectiveRegions(quest).includes(region), `${chain.id}: 임무 ${quest.id}의 목표 지역에 ${region}이 있다`);
        // 심연의 신호는 1 · 2단계가 50층 조건이라 여는 시점이 이야기 진행을 정하지 않는다(심연 임무는 모두 Lv55부터다).
        if (chain.steps.some((step) => typeof step.minAbyssFloor === 'number')) continue;
        const regionGate = getMapRouteGate(DB.MAPS, region)?.routeGateLevel;
        assert.ok(Number.isInteger(regionGate), `${region} 경로 게이트`);
        const questGate = Math.max(quest.minLv || 1, regionGate);
        assert.ok(questGate - regionGate <= 1, `${chain.id}: 임무 ${quest.id}(Lv${quest.minLv})는 ${region}(Lv${regionGate})보다 늦게 열지 않는다`);
    }
});

test('[데이터] 단서는 다음 단계의 지역을 말하고, 본편이 아닌 임무만 그 지역의 게시판 소문을 든다', () => {
    const mainOpeners = [];
    for (const { chain, start, quest } of openings) {
        const next = chain.steps[1];
        assert.ok(start.log.includes(next.loc), `${chain.id} 단서가 ${next.loc}를 말한다`);
        if (typeof next.minAbyssFloor === 'number') assert.ok(start.log.includes(`${next.minAbyssFloor}층`), `${chain.id} 단서가 층을 말한다`);
        if (isMainStory(quest)) {
            mainOpeners.push(quest.id);
            assert.equal(start.hook, undefined, `${chain.id}: 본편 장의 게시판 이유는 본편이다`);
        } else {
            assert.ok(typeof start.hook === 'string' && start.hook.includes(chain.steps[0].loc), `${chain.id}: 소문이 ${chain.steps[0].loc}를 말한다`);
        }
    }
    assert.deepEqual(mainOpeners.sort((left, right) => left - right), [80, 81, 82, 84], '본편 장이 그 지역의 곁가지 이야기를 연다');
});

test('[새 여정] 어느 지역의 첫 탐험도 이야기 화면을 띄우지 않는다 — 두 이야기가 시작되던 잊혀진 폐허도 자연 결과다', async () => {
    for (const name of Object.keys(DB.MAPS)) {
        assert.equal(getChainEventForLoc(name, {}, undefined, 0), null, `${name}`);
    }
    const base = structuredClone(INITIAL_STATE);
    let state = { ...base, gameState: GS.IDLE, player: { ...base.player, name: '폐허', job: '모험가', loc: '잊혀진 폐허', level: 6 } };
    const deps = {
        player: state.player, gameState: state.gameState, rng: () => 0.99,
        dispatch(action) { state = gameReducer(state, action); },
        addLog() {}, addStoryLog() {},
        getFullStats: () => calculateFullStats(state.player),
    };
    await createExploreActions(deps, makeSharedHelpers(deps)).explore();
    assert.equal(state.player.stats.explores, 1);
    assert.equal(state.currentEvent?._chainId, undefined, '체인 이벤트가 아니다');
    assert.deepEqual(state.player.eventChainProgress || {}, {});
});

test('[수령] 열세 이야기 모두 여는 임무를 수령하면 열린다 — 기록이 단서를 말하고 체인 일지 · 다음 지역 이벤트가 이어진다', () => {
    for (const { chain, start, quest } of openings) {
        const finished = acceptAndFinish(stateBeforeAccept(quest), quest);
        assert.equal(finished.player.eventChainProgress?.[chain.id] ?? 0, 0, `${chain.id}: 수령 전에는 열리지 않는다`);
        const claimed = claim(finished, quest);
        assert.ok(claimed.player.stats.claimedQuestIds.includes(quest.id), `${quest.id} 수령`);
        assert.equal(claimed.player.eventChainProgress[chain.id], 1, `${chain.id} 1단계로`);
        const lead = MSG.CHAIN_QUEST_START(chain.label, start.log);
        assert.equal(claimed.logs.filter((log) => log.type === 'event' && log.text === lead).length, 1, `${chain.id} 단서 기록 한 번`);
        const entry = buildChainJournal(claimed.player.eventChainProgress).find((journal) => journal.chainId === chain.id);
        assert.equal(entry?.nextLoc, chain.steps[1].loc, `${chain.id} 일지가 다음 지역을 가리킨다`);
        const floor = typeof chain.steps[1].minAbyssFloor === 'number' ? chain.steps[1].minAbyssFloor - 1 : 0;
        const next = getChainEventForLoc(chain.steps[1].loc, { [chain.id]: 1 }, undefined, floor);
        assert.equal(next?.chain.id, chain.id, `${chain.id}: ${chain.steps[1].loc}에서 1단계 이벤트가 열린다`);
        assert.equal(next?.step.step, 1);
        // 같은 임무는 다시 수령할 수 없으니 두 번 넘어가지 않는다.
        const again = claim(claimed, quest);
        assert.equal(again.player.eventChainProgress[chain.id], 1);
    }
});

test('[게시판] 이야기를 여는 임무는 이야기 임무 칸에 소문과 함께 보이고, 그 칸은 받을 본편 장이 먼저 쓴다', () => {
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: '게시판', job: '모험가', loc: TOWN, level: 6,
        stats: { ...structuredClone(INITIAL_STATE.player.stats), claimedQuestIds: [80] },
    };
    const openerIds = new Set(openings.filter(({ quest }) => !isMainStory(quest)).map(({ quest }) => quest.id));
    // 받을 본편 장(81)이 있으면 이야기 칸은 본편이다. 지금 받을 수 있는 곁가지 이야기 임무(17 · 5 · 19)는 이야기 임무로 남는다.
    const withMain = getQuestBoardRecommendations(player);
    assert.equal(withMain.featured[0]?.quest.id, 81);
    assert.equal(withMain.featured[0]?.lane, 'story');
    const sideEntries = [...withMain.featured, ...withMain.backlog].filter((entry) => openerIds.has(entry.quest.id));
    assert.deepEqual(sideEntries.map((entry) => entry.quest.id).sort((left, right) => left - right), [5, 17, 19]);
    for (const entry of sideEntries) {
        const opening = getQuestOpenedChain(entry.quest.id, player.eventChainProgress);
        assert.equal(entry.lane, 'story', `${entry.quest.id} 이야기 임무`);
        assert.equal(entry.reason, opening.hook, `${entry.quest.id} 이유는 소문`);
    }
    // 본편 장을 받으면 이야기 칸은 곁가지 이야기를 여는 임무다.
    const accepted = { ...player, quests: [{ id: 81, progress: 0 }] };
    const story = getQuestBoardRecommendations(accepted).featured[0];
    assert.ok(openerIds.has(story?.quest.id), `이야기 칸: ${story?.quest.id}`);
    assert.equal(story.reason, getQuestOpenedChain(story.quest.id, accepted.eventChainProgress).hook);
    // 이미 연 이야기의 임무는 원래 칸으로 돌아간다(이 규칙 전 세이브 — 0단계 이벤트로 연 이야기).
    const opened = { ...accepted, eventChainProgress: { last_hero: 1, water_apostle: 'failed', shadow_guild: 1 } };
    const after = getQuestBoardRecommendations(opened);
    for (const id of [17, 5, 19]) {
        const entry = [...after.featured, ...after.backlog].find((candidate) => candidate.quest.id === id);
        assert.notEqual(entry?.lane, 'story', `${id}는 더 이상 이야기를 열지 않는다`);
        assert.equal(getQuestOpenedChain(id, opened.eventChainProgress), null);
    }
});

test('[불러오기] 이 규칙 전에 여는 임무를 받고 0단계 이벤트를 지나친 세이브는 불러올 때 이야기가 열린다 — 실패 · 진행은 그대로다', () => {
    const load = (player) => gameReducer(INITIAL_STATE, { type: AT.LOAD_DATA, payload: { player, gameState: GS.IDLE } }).player;
    const base = structuredClone(INITIAL_STATE.player);
    const claimedStats = { ...base.stats, claimedQuestIds: [17, 5, 29] };
    const loaded = load({ ...base, stats: claimedStats, eventChainProgress: { last_hero: 0, water_apostle: 'failed', forgotten_god: 2 } });
    assert.equal(loaded.eventChainProgress.last_hero, 1);
    assert.equal(loaded.eventChainProgress.water_apostle, 'failed');
    assert.equal(loaded.eventChainProgress.forgotten_god, 2);
    // 여는 임무를 받지 않은 이야기는 그대로 닫혀 있다.
    assert.equal(loaded.eventChainProgress.shadow_guild ?? 0, 0);
});
