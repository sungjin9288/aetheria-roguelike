import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { QUESTS } from '../src/data/quests.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { getQuestTracker } from '../src/utils/adventureGuide.ts';
import { isLifetimeCounterQuest } from '../src/utils/cumulativeQuestProgress.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { grantGold } from '../src/utils/gameUtils.ts';
import { getMapRouteGate } from '../src/utils/mapRouteGate.ts';
import { getQuestBoardRecommendations } from '../src/utils/questOperations.ts';
import { getClaimableQuestEntries } from '../src/utils/questProgress.ts';

/**
 * 임무마다 자기 목표가 있다 (2026-10 Wave 64, 원장 §65 — 소유자 결정 "동일하면 안 됨, 각각의 목표가 있어야지").
 *
 * 카탈로그 143개 중 네 쌍이 같은 목표(종류 · 대상 · 지역 · 횟수)였다 — 한쪽을 받으면 다른 쪽도 같은 행동으로 함께 끝났다.
 *   151 · 154 종말의 기사 1회(Wave 62 C9가 154를 3회 → 1회로 바꾼 결과) → 154는 종말의 전장의 파멸의 기사 10명
 *   30 · 100  레벨 30 달성                                              → 30은 기계 폐도의 프로토타입 제로
 *   32 · 83   빙하 심연의 빙결의 마녀 1회                                → 32는 마녀 3회(83은 이야기 단계라 1회)
 *   64 · 200  누적 탐험 50회                                            → 64는 누적 골드 10만(새 종류 `gold_earned`)
 * 계약은 카탈로그 전체의 불변식(같은 목표 쌍 0)과, 쌍마다 실제 리듀서 전이에서 한쪽 행동이 다른 쪽을 끝내지 않음을 함께 본다.
 */

const quest = (id) => {
    const found = QUESTS.find((entry) => entry.id === id);
    assert.ok(found, `임무 ${id}`);
    return found;
};

/** 목표의 정체 — 진행도를 무엇이 · 어디서 · 몇 번 올리는가. 보상 · 제목 · 수락 레벨은 목표가 아니다. */
const objectiveKey = (entry) => JSON.stringify([
    entry.type || 'kill',
    entry.target ?? null,
    entry.location ?? null,
    entry.goal ?? null,
    entry.threshold ?? null,
    entry.buildTag ?? null,
]);

const findSameObjectivePairs = (catalog) => {
    const byKey = new Map();
    for (const entry of catalog) {
        const key = objectiveKey(entry);
        byKey.set(key, [...(byKey.get(key) || []), entry.id]);
    }
    return [...byKey.values()].filter((ids) => ids.length > 1);
};

const baseState = (playerOverrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    gameState: GS.IDLE,
    player: {
        ...structuredClone(INITIAL_STATE.player),
        loc: CONSTANTS.START_LOCATION,
        ...playerOverrides,
    },
});

const accept = (state, questId) => {
    const next = gameReducer(state, { type: AT.ACCEPT_QUEST, payload: { questId } });
    assert.ok(next.player.quests.some((entry) => entry.id === questId), `임무 ${questId} 수락`);
    return next;
};

const progressOf = (state, questId) => state.player.quests.find((entry) => entry.id === questId)?.progress;
const claimableIds = (state) => getClaimableQuestEntries(state.player).map((entry) => entry.id);

/** 실제 스폰(`spawnEnemy`) + 실제 전투 1턴 리듀서 전이로 한 번 처치한다. */
const killOnce = (state, loc, { monster, areaBoss = false, seed = 3 }) => {
    const player = { ...state.player, loc };
    const options = areaBoss ? { forceAreaBoss: true, rng: () => 0.5 } : { storyMonster: monster, rng: () => 0.5 };
    const enemy = spawnEnemy(DB.MAPS[loc], player, [], { addLog() {} }, options).mStats;
    assert.ok(enemy, `${loc}: 스폰`);
    if (monster) assert.equal(enemy.baseName, monster);
    const next = gameReducer({
        ...state,
        player,
        gameState: GS.COMBAT,
        enemy: { ...enemy, hp: 1, pattern: { guardChance: 0, heavyChance: 0 } },
        combatTurn: 0,
        combatReceipt: null,
    }, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 0, seed, now: 1_700_000_000_000 + seed },
    });
    assert.notEqual(next.gameState, GS.COMBAT, `${enemy.baseName}: 처치로 전투가 끝난다`);
    return { ...next, gameState: GS.IDLE };
};

// ── 카탈로그 불변식 ──────────────────────────────────────────────────────────────

test('카탈로그: 목표(종류 · 대상 · 지역 · 횟수 · 문턱 · 빌드)가 같은 임무 쌍이 없다', () => {
    assert.equal(QUESTS.length, 143);
    assert.deepEqual(findSameObjectivePairs(QUESTS), []);
});

test('[대조] 판정은 같은 목표를 잡는다 — 이전 네 쌍의 모양을 넣으면 네 쌍이 모두 보인다', () => {
    const previous = [
        { id: 'p151', target: '종말의 기사', location: '종말의 전장', goal: 1 },
        { id: 'p154', target: '종말의 기사', location: '종말의 전장', goal: 1 },
        { id: 'p30', target: 'level', goal: 30 },
        { id: 'p100', target: 'level', goal: 30 },
        { id: 'p32', target: '빙결의 마녀', location: '빙하 심연', goal: 1 },
        { id: 'p83', target: '빙결의 마녀', location: '빙하 심연', goal: 1, prerequisiteQuestId: 84 },
        { id: 'p64', type: 'explore_count', target: 'explores', goal: 50 },
        { id: 'p200', type: 'explore_count', target: 'explores', goal: 50 },
    ];
    assert.deepEqual(findSameObjectivePairs(previous), [['p151', 'p154'], ['p30', 'p100'], ['p32', 'p83'], ['p64', 'p200']]);
    // 보상 · 제목 · 수락 레벨만 다른 것은 같은 목표다 — 횟수 · 지역이 다르면 다른 목표다.
    assert.deepEqual(findSameObjectivePairs([
        { id: 'a', target: '리치', goal: 1, minLv: 35, reward: { gold: 1 } },
        { id: 'b', target: '리치', goal: 1, minLv: 40, reward: { gold: 2 } },
        { id: 'c', target: '리치', goal: 3 },
        { id: 'd', target: '리치', location: '암흑 성', goal: 1 },
    ]), [['a', 'b']]);
});

test('구역 보스(그 지역의 boss이고 어느 조우 풀에도 없다)를 목표로 하는 임무는 1회다 — 한 여정에 한 번만 나온다', () => {
    const inPool = new Set(Object.values(DB.MAPS).flatMap((map) => [...(map.monsters || []), ...(map.bossMonsters || [])]));
    const areaBossOnly = new Set(Object.values(DB.MAPS).map((map) => map.boss).filter((name) => typeof name === 'string' && !inPool.has(name)));
    const targeting = QUESTS.filter((entry) => !entry.type && areaBossOnly.has(entry.target));
    assert.ok(targeting.some((entry) => entry.id === 151), '151(종말의 기사)이 그 하나다');
    for (const entry of targeting) assert.equal(entry.goal, 1, `임무 ${entry.id}(${entry.target})`);
    // 목표가 2회 이상인 처치 임무는 반복해서 만나는 적이다.
    for (const entry of QUESTS.filter((candidate) => !candidate.type && candidate.target !== 'level' && candidate.goal > 1)) {
        assert.ok(inPool.has(entry.target), `임무 ${entry.id}: ${entry.target} ${entry.goal}회 — 조우 풀에 있어야 한다`);
    }
});

// ── 151 · 154 ────────────────────────────────────────────────────────────────────

test('151 · 154: 기사 1회는 151, 154는 종말의 전장의 파멸의 기사 10명 — 한쪽 처치가 다른 쪽을 진행시키지 않는다', () => {
    const q151 = quest(151);
    const q154 = quest(154);
    assert.deepEqual([q151.target, q151.location, q151.goal], ['종말의 기사', '종말의 전장', 1]);
    assert.deepEqual([q154.target, q154.location, q154.goal], ['파멸의 기사', '종말의 전장', 10]);
    assert.ok(q154.desc.includes(q154.target) && q154.desc.includes(`${q154.goal}명`), q154.desc);
    assert.ok(DB.MAPS['종말의 전장'].monsters.includes(q154.target), '파멸의 기사는 일반 조우 — 여정당 횟수 제한이 없다');
    assert.equal(q154.minLv, q151.minLv, 'Wave 63 수락 레벨 그대로');

    let state = accept(baseState({ level: 73 }), 151);
    state = accept(state, 154);
    state = killOnce(state, '종말의 전장', { monster: '파멸의 기사' });
    assert.equal(progressOf(state, 154), 1);
    assert.equal(progressOf(state, 151), 0, '파멸의 기사는 151을 올리지 않는다');

    state = killOnce(state, '종말의 전장', { monster: '종말의 기사', areaBoss: true });
    assert.equal(progressOf(state, 151), 1);
    assert.equal(progressOf(state, 154), 1, '종말의 기사는 154를 올리지 않는다');
    assert.ok(claimableIds(state).includes(151) && !claimableIds(state).includes(154));

    for (let kill = 2; kill <= q154.goal; kill += 1) state = killOnce(state, '종말의 전장', { monster: '파멸의 기사', seed: kill + 10 });
    assert.equal(progressOf(state, 154), q154.goal);
    assert.ok(claimableIds(state).includes(154));
    const claimed = gameReducer({ ...state, player: { ...state.player, loc: CONSTANTS.START_LOCATION } }, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: 154 } });
    assert.ok(claimed.player.titles.includes('종말의 정복자'));
});

test('154: 다른 지역의 파멸의 기사 처치는 세지 않는다(지역 목표)', () => {
    let state = accept(baseState({ level: 73 }), 154);
    // 파멸의 기사는 종말의 전장에만 나오므로 지역 밖 처치는 실제로는 일어나지 않는다 — 지역 판정 자체를 고정한다.
    const elsewhere = Object.entries(DB.MAPS).find(([name, map]) => name !== '종말의 전장' && (map.monsters || []).length > 0)[0];
    state = killOnce(state, elsewhere, { monster: '파멸의 기사' });
    assert.equal(progressOf(state, 154), 0);
});

// ── 30 · 100 ─────────────────────────────────────────────────────────────────────

test('30 · 100: 레벨 30은 100, 30은 기계 폐도의 프로토타입 제로 — 수락 레벨은 기계 폐도에 걸어 들어가는 레벨이다', () => {
    const q30 = quest(30);
    const q100 = quest(100);
    assert.deepEqual([q100.target, q100.goal], ['level', 30]);
    assert.deepEqual([q30.target, q30.location, q30.goal], ['프로토타입 제로', '기계 폐도', 1]);
    assert.ok(!q30.title.includes('2차'), '전직 임무가 아니다');
    assert.ok(DB.MAPS['기계 폐도'].monsters.includes(q30.target));
    assert.equal(q30.minLv, getMapRouteGate(DB.MAPS, '기계 폐도').routeGateLevel, '받는 순간 목표 지역에 갈 수 있다');
    assert.equal(QUESTS.filter((entry) => entry.target === q30.target).length, 1, '프로토타입 제로를 목표로 하는 임무는 30 하나');

    let state = accept(baseState({ level: q30.minLv }), 100);
    state = accept(state, 30);
    assert.equal(progressOf(state, 100), 30, '레벨 30 이상이면 100은 받는 순간 채워진다');
    assert.equal(progressOf(state, 30), 0, '30은 레벨로 채워지지 않는다');
    state = killOnce(state, '기계 폐도', { monster: '프로토타입 제로' });
    assert.equal(progressOf(state, 30), 1);
    assert.ok(claimableIds(state).includes(30));
});

// ── 32 · 83 ──────────────────────────────────────────────────────────────────────

test('32 · 83: 이야기 83은 마녀 1회, 토벌 32는 3회 — 첫 처치는 둘 다 올리지만 32는 세 번째에 끝난다', () => {
    const q32 = quest(32);
    const q83 = quest(83);
    assert.deepEqual([q83.target, q83.location, q83.goal], ['빙결의 마녀', '빙하 심연', 1]);
    assert.deepEqual([q32.target, q32.location, q32.goal], ['빙결의 마녀', '빙하 심연', 3]);
    assert.ok(q32.desc.includes(`${q32.goal}회`), q32.desc);
    assert.ok(DB.MAPS['빙하 심연'].monsters.includes(q32.target), '마녀는 일반 조우라 반복된다');

    let state = baseState({ level: 35 });
    state = { ...state, player: { ...state.player, stats: { ...state.player.stats, claimedQuestIds: [84] } } };
    state = accept(state, 83);
    state = accept(state, 32);
    state = killOnce(state, '빙하 심연', { monster: '빙결의 마녀' });
    assert.equal(progressOf(state, 83), 1);
    assert.equal(progressOf(state, 32), 1);
    assert.ok(claimableIds(state).includes(83) && !claimableIds(state).includes(32));
    state = killOnce(state, '빙하 심연', { monster: '빙결의 마녀', seed: 21 });
    state = killOnce(state, '빙하 심연', { monster: '빙결의 마녀', seed: 22 });
    assert.equal(progressOf(state, 32), 3);
    assert.ok(claimableIds(state).includes(32));
});

// ── 64 · 200 ─────────────────────────────────────────────────────────────────────

test('64 · 200: 200은 누적 탐험 50회, 64는 누적 골드 10만 — 탐험만 많고 골드가 적으면 64는 끝나지 않는다', () => {
    const q64 = quest(64);
    const q200 = quest(200);
    assert.deepEqual([q200.type, q200.target, q200.goal], ['explore_count', 'explores', 50]);
    assert.deepEqual([q64.type, q64.target, q64.goal], ['gold_earned', 'total_gold', 100000]);
    assert.ok(q64.desc.includes(String(q64.goal)), q64.desc);
    assert.ok(isLifetimeCounterQuest(q64), "평생 누적 기록 — 게시판 · 임무 탭의 '누적' 표시");

    const stats = { ...structuredClone(INITIAL_STATE.player.stats), explores: 500, total_gold: 40000 };
    let state = accept(baseState({ level: 20, stats }), 200);
    state = accept(state, 64);
    assert.equal(progressOf(state, 200), 50);
    assert.equal(progressOf(state, 64), 40000, '수락 전 누적 골드를 센다');
    assert.deepEqual(claimableIds(state), [200]);
});

test('64: 마을에서 번 골드(grantGold)로 목표를 넘기면 그 자리에서 수령 가능하다 — 다음 탐험 · 전투를 기다리지 않는다', () => {
    const stats = { ...structuredClone(INITIAL_STATE.player.stats), total_gold: 99_000 };
    const state = accept(baseState({ level: 20, stats }), 64);
    assert.equal(progressOf(state, 64), 99_000);
    const paid = grantGold(state.player, 1_500);
    assert.equal(paid.stats.total_gold, 100_500);
    assert.equal(paid.quests.find((entry) => entry.id === 64).progress, 100_000, '목표에서 멈춘다');
    assert.ok(getClaimableQuestEntries(paid).some((entry) => entry.id === 64));
    // 비용(음수)은 누적 골드도 진행도도 줄이지 않는다.
    const spent = grantGold(paid, -5_000);
    assert.equal(spent.stats.total_gold, 100_500);
    assert.equal(spent.quests.find((entry) => entry.id === 64).progress, 100_000);
});

test('64: 실제 전투 승리 골드도 진행도에 들어간다', () => {
    const stats = { ...structuredClone(INITIAL_STATE.player.stats), total_gold: 99_999 };
    let state = accept(baseState({ level: 20, stats }), 64);
    state = killOnce(state, '피라미드', { monster: '사막도적' });
    assert.ok(state.player.stats.total_gold > 99_999, '승리 골드');
    assert.equal(progressOf(state, 64), 100_000);
    assert.ok(claimableIds(state).includes(64));
});

test('64: 추적기 · 게시판은 골드 목표를 말한다(일반 처치 · 탐험 문구가 아니다)', () => {
    const stats = { ...structuredClone(INITIAL_STATE.player.stats), total_gold: 40_000 };
    const state = accept(baseState({ level: 20, stats }), 64);
    const tracker = getQuestTracker(state.player);
    const focus = tracker.focusQuests.find((entry) => entry.questId === 64);
    assert.equal(focus.routeLabel, MSG.QUEST_ROUTE_GOLD);
    assert.equal(focus.nextStep, MSG.QUEST_NEXT_STEP_GOLD(60_000));

    const board = getQuestBoardRecommendations(baseState({ level: 20, stats }).player);
    const entry = [...board.featured, ...board.backlog].find((candidate) => candidate.quest.id === 64);
    assert.ok(entry, '게시판에 오른다');
    assert.equal(entry.lane, 'growth');
    const objective = entry.planSteps.find((step) => step.label === '목표');
    assert.equal(objective?.value, MSG.QUEST_OBJECTIVE_GOLD(100000));
    const text = JSON.stringify(entry);
    assert.ok(text.includes(MSG.QUEST_ROUTE_GOLD), '작전 경로');
    assert.ok(text.includes(MSG.QUEST_EXTRACTION_GOLD(100000)), '귀환 규칙');
    assert.ok(!text.includes('total_gold 추적'), '대상 키를 그대로 노출하지 않는다');
});
