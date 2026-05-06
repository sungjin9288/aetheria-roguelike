import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 188: ASCEND가 premium 구매 자산 보존하도록 fix.
 *
 * 발견:
 * - cycle 119에서 6 영구 카운터 (escapes/syntheses/maxKillStreak/visitedMaps/
 *   discoveryChains/abyssRecord)을 ASCEND preserve에 추가.
 * - 그러나 PremiumShop으로 구매한 자산 4종이 ASCEND 시 reset되던 잠복 회귀:
 *   1. stats.cosmeticTitles (cycle 185 owned 추적용) — reset 시 player.titles에는
 *      칭호 보존되지만 PremiumShop 'owned' 체크가 false → 동일 칭호 중복 구매.
 *   2. stats.synthProtects (cycle 186 토큰) — reset 시 잔여 토큰 손실.
 *   3. reviveTokens (cycle 186 부활권) — reset 시 부활권 손실.
 *   4. maxInv (PremiumShop INV_EXPAND 확장) — reset 시 인벤 슬롯 20으로 축소.
 *
 * 모두 premium currency 또는 premium 토큰으로 구매한 영구 자산.
 *
 * 수정 (src/reducers/handlers/progressionHandlers.ts ASCEND):
 * - stats에 cosmeticTitles / synthProtects 명시 보존.
 * - freshPlayer 상위에 reviveTokens / maxInv 명시 보존.
 */

const ASCEND_PAYLOAD = {
    meta: { essence: 0, rank: 1, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 1 },
    newTitle: '각성자',
};

const buildState = (overrides = {}) => ({
    ...INITIAL_STATE,
    player: {
        ...INITIAL_STATE.player,
        name: 'tester',
        gender: 'male',
        ...overrides,
    },
});

test('cycle 188: cosmeticTitles ASCEND 시 보존', () => {
    const state = buildState({
        stats: {
            ...INITIAL_STATE.player.stats,
            cosmeticTitles: ['title_stargazer', 'title_voidwalker'],
        },
    });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(next.player.stats.cosmeticTitles, ['title_stargazer', 'title_voidwalker']);
});

test('cycle 188: synthProtects ASCEND 시 보존', () => {
    const state = buildState({
        stats: { ...INITIAL_STATE.player.stats, synthProtects: 3 },
    });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.synthProtects, 3);
});

test('cycle 188: reviveTokens ASCEND 시 보존', () => {
    const state = buildState({ reviveTokens: 2 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.reviveTokens, 2);
});

test('cycle 188: maxInv (확장 인벤) ASCEND 시 보존', () => {
    const state = buildState({ maxInv: 25 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.maxInv, 25);
});

test('cycle 188: 미보유 시 미정의 안전 — 0/undefined 폴백 (회귀 가드)', () => {
    const state = buildState({}); // premium 자산 없음
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.reviveTokens, 0);
    assert.deepEqual(next.player.stats.cosmeticTitles, []);
    assert.equal(next.player.stats.synthProtects, 0);
});

test('cycle 119 회귀 가드: 6 영구 카운터 ASCEND 보존 (cycle 188 변경 후에도)', () => {
    const state = buildState({
        stats: {
            ...INITIAL_STATE.player.stats,
            escapes: 50,
            syntheses: 20,
            maxKillStreak: 30,
            visitedMaps: ['시작의 마을', '고요한 숲'],
            discoveryChains: ['fire_convergence'],
            abyssRecord: 100,
        },
    });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.escapes, 50);
    assert.equal(next.player.stats.syntheses, 20);
    assert.equal(next.player.stats.maxKillStreak, 30);
    assert.deepEqual(next.player.stats.visitedMaps, ['시작의 마을', '고요한 숲']);
    assert.deepEqual(next.player.stats.discoveryChains, ['fire_convergence']);
    assert.equal(next.player.stats.abyssRecord, 100);
});
