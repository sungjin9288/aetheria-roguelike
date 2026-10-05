import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { RELICS } from '../src/data/relics.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import {
    getBossGaugeEvadeRemaining,
    getBossGaugeValue,
    isBossGaugeCardSuppressed,
    markBossGaugeEvaded,
} from '../src/utils/bossGauge.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * Wave 62 C5 — 보스 게이지 카드의 "회피 — 흔적을 피해 계속 나아간다"는 실제로 계속 나아간다(소유자 결정: 설명대로 구현).
 *
 * 이전: 회피는 탐험을 아무 일 없이 끝냈고 게이지는 만충 그대로라 **다음 탐험마다 같은 카드**가 떴다 — 그 지역의 사냥 · 임무
 * 진행은 보스를 잡기 전까지 막혔다(감사 4회차: rng 0.99 / 0.5 / 0.2 / 0.09 모두 카드 재등장).
 * 이후: 회피한 탐험은 같은 자리에서 일반 롤(quiet 롤 → 유물 → 전투)로 이어지고, 그 지역을
 * `BALANCE.BOSS_GAUGE_EVADE_EXPLORES`번 더 탐험하는 동안 카드가 뜨지 않는다. 게이지는 만충 그대로라 그 뒤 다시 도전할 수 있다.
 * 상태는 회피 시점의 그 지역 탐험 수(`stats.bossGaugeEvadedAt`) 하나 — 저장 · 복원을 넘고, 구세이브는 지금과 같다.
 *
 * 하네스는 실제 `explore()`(createExploreActions + makeSharedHelpers) · 실제 `handleEventChoice` · 실제 리듀서다.
 */

const LOC = '신성한 호수';
const BOSS = DB.MAPS[LOC].boss;
const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
/** 0.99: 모닥불 · 정찰 · AI 사건 · quiet 롤 · 유물 롤을 모두 비껴 → 일반 전투. */
const HIGH = () => 0.99;
// 첫 유물 보장(pity)을 비껴가도록 무해한 유물 하나를 들려 둔다.
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');

const baseState = (statsExtra = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    gameState: GS.IDLE,
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '용사', job: '나이트', level: 12, hp: 5_000, maxHp: 5_000, loc: LOC,
        relics: [structuredClone(HARMLESS_RELIC)],
        eventChainProgress: { ...ALL_CHAINS_DONE },
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            visitedMaps: ['시작의 마을', LOC],
            bossGauge: { [LOC]: 1 },
            exploresByLocation: { [LOC]: 10 },
            ...statsExtra,
        },
    },
});

const harness = (state) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    return { get: () => current, set: (next) => { current = next; }, dispatch, addLog };
};

const explore = async (state, rng = HIGH) => {
    const h = harness(state);
    const deps = {
        player: state.player,
        gameState: state.gameState,
        uid: 'test-user',
        dispatch: h.dispatch,
        addLog: h.addLog,
        addStoryLog: () => {},
        getFullStats: () => calculateFullStats(h.get().player),
        rng,
    };
    await createExploreActions(deps, makeSharedHelpers({ player: state.player, dispatch: h.dispatch, addLog: h.addLog })).explore();
    return h.get();
};

const choose = (state, choiceIndex, rng = HIGH) => {
    const h = harness(state);
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch: h.dispatch,
        addLog: h.addLog,
        addStoryLog: () => {},
        getFullStats: () => calculateFullStats(h.get().player),
        rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return h.get();
};

/** 전투를 접고 탐험 가능 상태로 — 도주 판정은 이 계약의 관심이 아니다. */
const backToIdle = (state) => ({ ...state, enemy: null, gameState: GS.IDLE, currentEvent: null });
const isBossCard = (state) => state.gameState === GS.EVENT && state.currentEvent?.isBossGaugeChallenge === true;

test('전제: 만충 게이지의 첫 탐험은 보스 카드를 띄운다(구세이브 · 회피 기록 없음 = 지금과 같다)', async () => {
    const opened = await explore(baseState());
    assert.ok(isBossCard(opened));
    assert.equal(opened.currentEvent.bossName, BOSS);
});

test('회피는 같은 탐험에서 일반 롤로 이어진다 — 보스가 아닌 조우, 게이지 만충 유지, 회피 기록', async () => {
    const opened = await explore(baseState());
    const avoided = choose(opened, 1);

    assert.equal(avoided.gameState, GS.COMBAT, '롤이 이어져 일반 전투가 열렸다(rng 0.99)');
    assert.notEqual(avoided.enemy.baseName, BOSS, '구역 보스가 아니다');
    assert.equal(avoided.enemy.isBoss, false);
    assert.equal(avoided.currentEvent, null);
    assert.equal(getBossGaugeValue(avoided.player, LOC), 1, '게이지는 만충 그대로 — 다시 도전할 수 있다');
    assert.equal(avoided.player.stats.bossGaugeEvadedAt[LOC], opened.player.stats.exploresByLocation[LOC]);
    assert.equal(avoided.player.stats.explores, opened.player.stats.explores, '이어지는 롤은 탐험을 두 번 세지 않는다');
    assert.ok(avoided.logs.some((log) => log.text === MSG.BOSS_GAUGE_AVOID_LOG));
    assert.ok(avoided.logs.some((log) => log.text === MSG.BOSS_GAUGE_AVOID_SUPPRESSED(BALANCE.BOSS_GAUGE_EVADE_EXPLORES)));
});

test('회피 뒤 그 지역을 BOSS_GAUGE_EVADE_EXPLORES번 탐험하는 동안 카드가 뜨지 않고, 그다음 탐험에 다시 뜬다', async () => {
    let state = backToIdle(choose(await explore(baseState()), 1));
    const N = BALANCE.BOSS_GAUGE_EVADE_EXPLORES;
    assert.ok(Number.isInteger(N) && N > 0);
    for (let k = 1; k <= N; k += 1) {
        assert.equal(getBossGaugeEvadeRemaining(state.player, LOC), N - k + 1);
        state = await explore(state);
        assert.ok(!isBossCard(state), `회피 뒤 ${k}번째 탐험은 카드 없이 진행된다`);
        assert.equal(state.gameState, GS.COMBAT, `${k}번째 탐험: 사냥이 이어진다`);
        assert.notEqual(state.enemy.baseName, BOSS);
        state = backToIdle(state);
    }
    assert.equal(isBossGaugeCardSuppressed(state.player, LOC), false);
    const returned = await explore(state);
    assert.ok(isBossCard(returned), `${N + 1}번째 탐험에 보스 카드가 돌아온다`);

    // 돌아온 카드로 도전하면 구역 보스가 나오고 게이지 · 회피 기록이 정리된다.
    const challenged = choose(returned, 0);
    assert.equal(challenged.gameState, GS.COMBAT);
    assert.equal(challenged.enemy.baseName, BOSS);
    assert.equal(getBossGaugeValue(challenged.player, LOC), 0);
    assert.equal(challenged.player.stats.bossGaugeEvadedAt?.[LOC], undefined);
});

test('억제는 회피한 지역에만 걸린다 — 다른 지역의 만충 카드는 그대로 뜬다', async () => {
    const other = '고대 하수도';
    const evaded = { ...baseState().player.stats, bossGaugeEvadedAt: { [LOC]: 10 } };
    const state = baseState({ ...evaded, bossGauge: { [LOC]: 1, [other]: 1 }, exploresByLocation: { [LOC]: 10, [other]: 3 } });
    const elsewhere = await explore({ ...state, player: { ...state.player, loc: other } });
    assert.ok(isBossCard(elsewhere));
    assert.equal(elsewhere.currentEvent.bossName, DB.MAPS[other].boss);
});

test('회피 기록은 저장 · 복원(JSON + migrateData + LOAD_DATA)을 넘는다 — 남은 탐험 수가 그대로', async () => {
    const avoided = backToIdle(choose(await explore(baseState()), 1));
    const remaining = getBossGaugeEvadeRemaining(avoided.player, LOC);
    assert.ok(remaining > 0);
    const envelope = JSON.parse(JSON.stringify({ player: avoided.player, gameState: GS.IDLE, enemy: null, grave: null, currentEvent: null }));
    const migrated = migrateData(envelope, { now: 1_700_000_000_000 });
    const loaded = gameReducer({ ...structuredClone(INITIAL_STATE), bootStage: 'ready' }, { type: AT.LOAD_DATA, payload: migrated });
    assert.equal(getBossGaugeEvadeRemaining(loaded.player, LOC), remaining);
    const next = await explore({ ...loaded, logs: [] });
    assert.ok(!isBossCard(next), '복원 뒤에도 억제가 이어진다');
});

test('회피 기록이 비정상이면(기록보다 탐험 수가 작다 · 숫자가 아니다) 억제하지 않는다 — fail-open은 카드 쪽', () => {
    const player = (evadedAt, explored) => ({ stats: { bossGaugeEvadedAt: { [LOC]: evadedAt }, exploresByLocation: { [LOC]: explored } } });
    assert.equal(isBossGaugeCardSuppressed(player(20, 5), LOC), false);
    assert.equal(isBossGaugeCardSuppressed(player('x', 5), LOC), false);
    assert.equal(isBossGaugeCardSuppressed({ stats: {} }, LOC), false);
    assert.equal(getBossGaugeEvadeRemaining(player(5, 5), LOC), BALANCE.BOSS_GAUGE_EVADE_EXPLORES);
    const marked = markBossGaugeEvaded({ stats: { bossGauge: { [LOC]: 1 }, exploresByLocation: { [LOC]: 7 } } }, LOC);
    assert.deepEqual(marked.bossGaugeEvadedAt, { [LOC]: 7 });
    assert.deepEqual(marked.bossGauge, { [LOC]: 1 });
});

test('회피 뒤 이어지는 롤은 시드 결정론이다 — 같은 난수열이면 같은 조우', async () => {
    const opened = await explore(baseState());
    const sequence = () => {
        const rolls = [0.97, 0.98, 0.42, 0.13, 0.77, 0.31, 0.66, 0.05, 0.88, 0.5];
        let index = 0;
        return () => rolls[index++ % rolls.length];
    };
    const first = choose(opened, 1, sequence());
    const second = choose(opened, 1, sequence());
    assert.deepEqual(first.enemy, second.enemy);
    assert.equal(first.gameState, second.gameState);
});
