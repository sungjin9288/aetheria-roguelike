import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
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
import { isEncounterBoss } from '../src/utils/bossPresence.js';
import {
    buildDimensionGraveEvent,
    getDimensionGravePrayerHeal,
    markDimensionGraveMet,
    resolveCatalogItemName,
    selectDimensionGraveCandidates,
    toDimensionGraveCandidate,
} from '../src/utils/dimensionGrave.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { startExpedition } from '../src/utils/expeditionLedger.js';
import { QUESTS } from '../src/data/quests.js';
import { getEffectiveMaxHp } from '../src/systems/vitals.js';
import GravePanel from '../src/components/GravePanel.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import { getMonsterVisual } from '../src/utils/monsterVisuals.ts';
import { createElement } from 'react';
import { renderStatic } from './helpers/render.ts';
import { getEventChoicePreview } from '../src/utils/eventPresentation.js';

/**
 * Wave 70 — 다른 차원의 묘비(소유자 결정: "묘비 침공은 이벤트식으로 발생하는 이벤트 — 다른 차원의 묘비 침공 이벤트라는 느낌",
 * "망령과 실제 전투", "실제 플레이어 묘비만").
 *
 * 이전: 기록 탭의 공개 묘비 목록에서 골라 확률(내 공격력 대 묘비 방어력, 상한 90%)로 침공했다 — 기능은 꺼져 있었고, 켜면 방어력이
 * 저장 공격력이라 성공률이 거의 언제나 90%였다(원장 §66.8).
 * 이후: 다른 플레이어의 공개 묘비가 탐험 중 드물게 "다른 차원의 묘비" 이벤트로 나타난다. 침공은 그 지역 일반 종으로 만든 정예급
 * 망령과의 실제 전투이고 이기면 유품 하나(카탈로그 이름으로 다시 만든 아이템)를 받는다. 기도는 실효 최대 생명의 10%를 회복한다.
 * 다른 플레이어 묘비가 없으면(오프라인 · 출시 초기 · 오늘 한도 소진) 탐험은 이 기능의 난수를 하나도 쓰지 않는다.
 *
 * 하네스는 실제 `explore()` · 실제 `handleEventChoice` · 실제 리듀서 전투 전이(`RESOLVE_COMBAT_ACTION`)다.
 */

const LOC = '고요한 숲';
const TODAY = new Date().toDateString();
const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');
const NOW = 1_700_000_000_000;
const CATALOG_WEAPON = DB.ITEMS.weapons.find((item) => (item.tier || 1) === 2 && typeof item.val === 'number');
const CATALOG_MATERIAL = DB.ITEMS.materials[0];

const otherGrave = (extra = {}) => ({
    uid: 'other-1',
    playerName: '방랑자',
    level: 23,
    loc: '잊혀진 폐허',
    gold: 0,
    items: [{ ...CATALOG_WEAPON, id: 'forged', val: CATALOG_WEAPON.val * 100 }],
    ...extra,
});

/** 던전에서 원정 중 — 실제 `startExpedition`으로 연 원정에서 한 번 탐험한 뒤(선택 이벤트를 받을 수 있는 상태). */
const baseState = (statsExtra = {}, playerExtra = {}) => {
    const player = startExpedition({
        ...structuredClone(INITIAL_STATE.player),
        name: '용사', job: '전사', level: 10, hp: 400, maxHp: 1_000, atk: 50, loc: LOC,
        relics: [structuredClone(HARMLESS_RELIC)],
        eventChainProgress: { ...ALL_CHAINS_DONE },
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            visitedMaps: ['시작의 마을', LOC],
            explores: 5,
        },
    }, LOC, NOW, QUESTS);
    return {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        logs: [],
        gameState: GS.IDLE,
        player: {
            ...player,
            stats: { ...player.stats, explores: 6, exploreState: { sinceNarrativeEvent: 3 }, ...statsExtra },
            ...playerExtra,
        },
    };
};

/** 호출 수를 세는 난수 — 값은 차례대로, 다 쓰면 마지막 값을 반복한다. */
const sequence = (...values) => {
    const rng = () => {
        rng.calls += 1;
        return values[Math.min(rng.calls - 1, values.length - 1)];
    };
    rng.calls = 0;
    return rng;
};

const harness = (state) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    return { get: () => current, dispatch, addLog };
};

const explore = async (state, rng, extraDeps = {}) => {
    const h = harness(state);
    const deps = {
        player: state.player,
        gameState: state.gameState,
        uid: 'me',
        dispatch: h.dispatch,
        addLog: h.addLog,
        addStoryLog: () => {},
        getFullStats: () => calculateFullStats(h.get().player),
        rng,
        ...extraDeps,
    };
    await createExploreActions(deps, makeSharedHelpers({ player: state.player, dispatch: h.dispatch, addLog: h.addLog })).explore();
    return h.get();
};

const choose = (state, choiceIndex, rng = () => 0.5) => {
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

const act = (state, kind, seed) => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind, expectedTurn: state.combatTurn || 0, seed, now: NOW },
});

/** 모닥불(0.9 — 비껴감) → 묘비(0.01 — 발생) → 후보 0번 → 유품 0번. */
const OPEN = () => sequence(0.9, 0.01, 0, 0);
const openGrave = (pool = [otherGrave()], state = baseState()) => explore(state, OPEN(), { getDimensionGraves: () => pool });

// ── 묘비 문서 → 후보: 남이 쓴 데이터는 그대로 믿지 않는다 ─────────────────────

test('후보: 유품은 카탈로그 이름만 남는다 — 위조된 수치 · 접두어 · 모르는 이름', () => {
    assert.ok(CATALOG_WEAPON && CATALOG_MATERIAL, '전제: 카탈로그 장비 · 재료');
    assert.equal(resolveCatalogItemName({ ...CATALOG_WEAPON, val: 999_999 }), CATALOG_WEAPON.name);
    assert.equal(resolveCatalogItemName({ ...CATALOG_MATERIAL }), CATALOG_MATERIAL.name);
    assert.equal(resolveCatalogItemName({ name: '존재하지 않는 검', type: 'weapon', val: 1 }), null);
    assert.equal(resolveCatalogItemName(null), null);

    const candidate = toDimensionGraveCandidate(otherGrave({
        items: [
            { ...CATALOG_WEAPON, val: 1e9 },
            { name: '존재하지 않는 검', type: 'weapon', val: 1e9 },
            { ...CATALOG_WEAPON, id: 'dup' },
        ],
    }));
    assert.deepEqual(candidate.itemNames, [CATALOG_WEAPON.name], '모르는 이름은 빠지고 같은 이름은 한 번');
    assert.equal(toDimensionGraveCandidate(otherGrave({ items: [{ name: '존재하지 않는 검', type: 'weapon' }] })), null, '유품이 없는 묘비는 후보가 아니다');
    assert.equal(toDimensionGraveCandidate(otherGrave({ uid: '' })), null, 'uid 없는 문서');
});

test('후보: 이름 · 레벨 · 지역은 정리해서 보인다', () => {
    const long = toDimensionGraveCandidate(otherGrave({ playerName: '가'.repeat(40), level: 500, loc: '없는 지역' }));
    assert.equal(Array.from(long.playerName).length, BALANCE.DIMENSION_GRAVE_NAME_MAX);
    assert.equal(long.level, CONSTANTS.MAX_LEVEL);
    assert.equal(long.place, null, '모르는 지역은 보이지 않는다');
    const blank = toDimensionGraveCandidate(otherGrave({ playerName: '   ', level: 'abc' }));
    assert.equal(blank.playerName, MSG.DIMENSION_GRAVE_UNKNOWN_NAME);
    assert.equal(blank.level, 1);
    assert.equal(toDimensionGraveCandidate(otherGrave()).place, '잊혀진 폐허');
});

test('후보 선택: 내 묘비 · 오늘 만난 묘비 · 중복을 빼고, 오늘 한도를 다 쓰면 없다 — 날짜가 바뀌면 다시 나온다', () => {
    const pool = [otherGrave(), otherGrave({ uid: 'me' }), otherGrave(), otherGrave({ uid: 'other-2' })];
    const player = baseState().player;
    assert.deepEqual(selectDimensionGraveCandidates(pool, player, 'me', TODAY).map((c) => c.uid), ['other-1', 'other-2']);

    const metOne = { ...player, stats: markDimensionGraveMet(player.stats, 'other-1', TODAY) };
    assert.deepEqual(selectDimensionGraveCandidates(pool, metOne, 'me', TODAY).map((c) => c.uid), ['other-2']);
    assert.equal(metOne.stats.dailyInvadeCount, 1);
    assert.deepEqual(markDimensionGraveMet(metOne.stats, 'other-1', TODAY), metOne.stats, '같은 묘비는 두 번 세지 않는다');

    const full = { ...player, stats: { ...player.stats, lastInvadeDate: TODAY, dailyInvadeCount: BALANCE.DAILY_INVADE_LIMIT, invadedGraveUids: [] } };
    assert.deepEqual(selectDimensionGraveCandidates(pool, full, 'me', TODAY), [], '오늘 한도');
    assert.equal(selectDimensionGraveCandidates(pool, full, 'me', 'Mon Jan 01 2001').length, 2, '다른 날이면 다시 나온다');
    assert.deepEqual(selectDimensionGraveCandidates([], player, 'me', TODAY), []);
    assert.deepEqual(selectDimensionGraveCandidates(undefined, player, 'me', TODAY), []);
});

// ── 탐험: 풀이 비면 난수를 쓰지 않는다 ─────────────────────────────────────────

test('풀이 없거나 비었거나 내 묘비뿐이면 탐험은 이 기능의 난수를 쓰지 않는다 — 결과 · 난수 호출 수가 기능 없는 탐험과 같다', async () => {
    const run = async (extraDeps) => {
        const rng = sequence(0.9, 0.5, 0.3, 0.7, 0.2, 0.8, 0.6, 0.4, 0.1, 0.95);
        const state = await explore(baseState(), rng, extraDeps);
        return { calls: rng.calls, gameState: state.gameState, enemy: state.enemy?.name ?? null, player: state.player, logs: state.logs.map((l) => l.text) };
    };
    const without = await run({});
    for (const extraDeps of [
        { getDimensionGraves: () => [] },
        { getDimensionGraves: () => [otherGrave({ uid: 'me' })] },
        { getDimensionGraves: () => [otherGrave({ items: [] })] },
    ]) {
        assert.deepEqual(await run(extraDeps), without);
    }
});

test('오늘 한도를 다 썼거나 · 안전지대이거나 · 선택 이벤트 간격이 안 찼으면 묘비가 나오지 않고 난수도 쓰지 않는다', async () => {
    const pool = [otherGrave()];
    const cases = [
        baseState({ lastInvadeDate: TODAY, dailyInvadeCount: BALANCE.DAILY_INVADE_LIMIT, invadedGraveUids: [] }),
        baseState({ exploreState: { sinceNarrativeEvent: 0 } }),
    ];
    for (const state of cases) {
        const withPool = sequence(0.9, 0.01, 0.5, 0.5, 0.5, 0.5);
        const withoutPool = sequence(0.9, 0.01, 0.5, 0.5, 0.5, 0.5);
        const a = await explore(state, withPool, { getDimensionGraves: () => pool });
        const b = await explore(state, withoutPool, {});
        assert.notEqual(a.currentEvent?.isDimensionGrave, true);
        assert.equal(withPool.calls, withoutPool.calls);
        assert.deepEqual(a.player, b.player);
    }
    const town = await explore(baseState({}, { loc: CONSTANTS.START_LOCATION }), sequence(0.01), { getDimensionGraves: () => pool });
    assert.notEqual(town.currentEvent?.isDimensionGrave, true, '안전지대');
});

test('후보가 있고 난수가 확률 안이면 이벤트가 열린다 — 탐험 1회로 정산 · 오늘 만난 묘비로 기록', async () => {
    const before = baseState();
    const opened = await openGrave();
    assert.equal(opened.gameState, GS.EVENT);
    assert.equal(opened.currentEvent.isDimensionGrave, true);
    assert.deepEqual(opened.currentEvent.dimensionGrave, {
        uid: 'other-1', playerName: '방랑자', level: 23, place: '잊혀진 폐허', itemName: CATALOG_WEAPON.name,
    });
    assert.deepEqual(opened.currentEvent.choices, [
        MSG.DIMENSION_GRAVE_CHOICE_INVADE, MSG.DIMENSION_GRAVE_CHOICE_PRAY, MSG.DIMENSION_GRAVE_CHOICE_LEAVE,
    ]);
    assert.ok(opened.currentEvent.desc.includes('방랑자') && opened.currentEvent.desc.includes(CATALOG_WEAPON.name));
    assert.equal(opened.player.stats.explores, before.player.stats.explores + 1, '탐험은 한 번');
    assert.equal(opened.player.stats.lastInvadeDate, TODAY);
    assert.equal(opened.player.stats.dailyInvadeCount, 1);
    assert.deepEqual(opened.player.stats.invadedGraveUids, ['other-1']);

    const missed = await explore(before, sequence(0.9, BALANCE.DIMENSION_GRAVE_EVENT_CHANCE, 0.99, 0.99, 0.99), { getDimensionGraves: () => [otherGrave()] });
    assert.notEqual(missed.currentEvent?.isDimensionGrave, true, '확률 밖이면 다른 탐험 결과로 이어진다');
});

// ── 선택지 ──────────────────────────────────────────────────────────────────

test('침공: 그 지역 일반 종(보스 제외)의 정예급 망령과 실제 전투가 열린다 — 유품은 아직 없다', async () => {
    const opened = await openGrave();
    for (const roll of [0, 0.5, 0.99]) {
        const fight = choose(opened, 0, () => roll);
        assert.equal(fight.gameState, GS.COMBAT);
        assert.equal(fight.currentEvent, null);
        assert.equal(fight.enemy.name, MSG.DIMENSION_GRAVE_SHADE_NAME('방랑자'));
        assert.equal(fight.enemy.isElite, true);
        assert.equal(fight.enemy.isBoss, false);
        assert.ok(DB.MAPS[LOC].monsters.includes(fight.enemy.baseName));
        assert.equal(isEncounterBoss(fight.enemy.baseName, DB.MAPS[LOC]), false);
        assert.deepEqual(fight.enemy.dimensionGrave, opened.currentEvent.dimensionGrave);
        assert.ok(!(fight.player.inv || []).some((item) => item.name === CATALOG_WEAPON.name));
        assert.ok(fight.logs.some((log) => log.text === MSG.DIMENSION_GRAVE_INVADE_LOG('방랑자')));
    }
});

test('이기면 유품을 받는다 — 카탈로그 수치로(위조된 수치가 아니다), 저장 · 복원을 넘어도', async () => {
    const fight = choose(await openGrave(), 0);
    for (const state0 of [fight, JSON.parse(JSON.stringify(fight))]) {
        const won = act({ ...state0, enemy: { ...state0.enemy, hp: 1 } }, 'attack', 42);
        assert.equal(won.enemy, null);
        assert.notEqual(won.gameState, GS.COMBAT);
        const rewards = (won.player.inv || []).filter((item) => item.name === CATALOG_WEAPON.name);
        assert.equal(rewards.length, 1);
        assert.equal(rewards[0].val, CATALOG_WEAPON.val, '카탈로그 수치');
        assert.notEqual(rewards[0].val, CATALOG_WEAPON.val * 100);
        assert.ok(won.logs.some((log) => log.text === MSG.DIMENSION_GRAVE_VICTORY('방랑자', CATALOG_WEAPON.name)));
    }
});

test('지거나 물러나면 유품이 없다', async () => {
    const fight = choose(await openGrave(baseState({}, { hp: 1 })), 0);
    let lost = { ...fight, enemy: { ...fight.enemy, hp: 1e9, maxHp: 1e9, atk: 1e7 } };
    for (let seed = 1; seed <= 20 && lost.gameState === GS.COMBAT; seed += 1) lost = act(lost, 'attack', seed);
    assert.equal(lost.gameState, GS.DEAD, '전제: 실제로 쓰러졌다');
    assert.ok(!(lost.player.inv || []).some((item) => item.name === CATALOG_WEAPON.name));

    let escaped = null;
    const fresh = choose(await openGrave(), 0);
    for (let seed = 1; seed <= 200 && !escaped; seed += 1) {
        const after = act({ ...fresh, enemy: { ...fresh.enemy, atk: 1 } }, 'escape', seed);
        if (after.gameState === GS.IDLE) escaped = after;
    }
    assert.ok(escaped, '전제: 도주에 성공한 시드가 있다');
    assert.ok(!(escaped.player.inv || []).some((item) => item.name === CATALOG_WEAPON.name));
});

test('기도: 실효 최대 생명의 10%를 모자란 만큼까지 회복하고 끝난다 — 지나침: 아무 일도 없다', async () => {
    const opened = await openGrave();
    const expected = Math.floor(getEffectiveMaxHp(opened.player) * BALANCE.DIMENSION_GRAVE_PRAYER_HEAL_RATIO);
    assert.equal(getDimensionGravePrayerHeal(opened.player), expected);
    const prayed = choose(opened, 1);
    assert.equal(prayed.gameState, GS.IDLE);
    assert.equal(prayed.currentEvent, null);
    assert.equal(prayed.player.hp, opened.player.hp + expected);
    assert.ok(prayed.logs.some((log) => log.text === MSG.DIMENSION_GRAVE_PRAY_LOG('방랑자', expected)));

    const nearFull = await openGrave([otherGrave()], baseState({}, { hp: 0 }));
    const fullHp = { ...nearFull, player: { ...nearFull.player, hp: getEffectiveMaxHp(nearFull.player) - 3 } };
    assert.equal(choose(fullHp, 1).player.hp, getEffectiveMaxHp(fullHp.player), '최대를 넘지 않는다');

    const left = choose(opened, 2);
    assert.equal(left.gameState, GS.IDLE);
    assert.equal(left.currentEvent, null);
    assert.deepEqual(left.player, opened.player);
    assert.ok(left.logs.some((log) => log.text === MSG.DIMENSION_GRAVE_LEAVE_LOG));
});

test('이벤트 모양은 저장 봉투를 넘는다 — 복원된 이벤트에서도 같은 선택이 같은 결과', async () => {
    const opened = await openGrave();
    const restored = JSON.parse(JSON.stringify(opened));
    assert.deepEqual(buildDimensionGraveEvent(restored.currentEvent.dimensionGrave), restored.currentEvent);
    assert.deepEqual(choose(restored, 0).enemy, choose(opened, 0).enemy);
});

// ── 무덤 탭: 공개 목록 침공 화면은 없다 ─────────────────────────────────────────

test('무덤 탭은 내 유해만 보인다 — 공개 목록 · 침공 버튼이 없다', () => {
    const html = renderStatic(createElement(GravePanel, { player: baseState().player, grave: null, actions: {} }));
    assert.ok(html.includes('grave-mine-view'));
    for (const absent of ['grave-view-public', 'grave-public-view', '다른 모험가', '유해 침입', '성공 확률']) {
        assert.ok(!html.includes(absent), absent);
    }
});

test('선택지 미리보기는 엔진과 같은 약속을 말한다 — 전투와 그 유품 · 회복 비율 · 아무 일 없음', async () => {
    const opened = await openGrave();
    const invade = getEventChoicePreview(opened.currentEvent, 0);
    const pray = getEventChoicePreview(opened.currentEvent, 1);
    const leave = getEventChoicePreview(opened.currentEvent, 2);
    assert.equal(invade.text, MSG.DIMENSION_GRAVE_PREVIEW_INVADE(CATALOG_WEAPON.name));
    assert.equal(invade.tone, 'danger');
    assert.equal(pray.text, MSG.DIMENSION_GRAVE_PREVIEW_PRAY(Math.round(BALANCE.DIMENSION_GRAVE_PRAYER_HEAL_RATIO * 100)));
    assert.equal(pray.tone, 'recovery');
    assert.equal(leave.text, MSG.DIMENSION_GRAVE_PREVIEW_LEAVE);
});

test('망령의 초상은 종(baseName)의 그림이다 — 표시 이름("…의 망령")이나 묘비 주인 이름으로 그림을 찾지 않는다', async () => {
    const fight = choose(await openGrave([otherGrave({ playerName: '슬라임' })]), 0);
    assert.notEqual(fight.enemy.baseName, '슬라임', '전제: 묘비 주인 이름이 다른 종 이름과 겹친다');
    const html = renderStatic(createElement(StatusBar, { player: fight.player, stats: null, enemy: fight.enemy, enemyHitCrit: false }));
    assert.match(html, /data-monster-art="exact"/);
    const key = html.match(/data-monster-key="([^"]+)"/)?.[1];
    assert.equal(key, getMonsterVisual(fight.enemy.baseName)?.key, '종의 그림');
    assert.notEqual(key, getMonsterVisual('슬라임')?.key, '묘비 주인 이름으로 그림을 고르지 않는다');
});
