import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

/**
 * cycle 191: handleDefeat가 META 진행도(premium 자산 / 영구 칭호) 보존 (cycle 188 follow-up).
 *
 * 발견:
 * - cycle 188이 ASCEND에서 premium 자산 4종 보존 fix.
 * - 그러나 handleDefeat (정상 사망 시)는 INITIAL_PLAYER spread로 모든 자산 reset.
 * - 영향: 사망 시 premiumCurrency / titles / activeTitle / reviveTokens / maxInv /
 *   seasonPass 모두 wipe. 영구 진행도(META)와 일회성 진행도(RUN)의 구분 누락.
 *
 * 수정 (src/systems/CombatEngine.ts handleDefeat):
 * - titles / activeTitle 보존 (영구 획득 칭호).
 * - premiumCurrency 보존 (premium 재화).
 * - reviveTokens 보존 (premium 토큰).
 * - maxInv 보존 (premium 인벤 확장).
 * - seasonPass 보존 (시즌 tier 진행).
 *
 * stats.cosmeticTitles / stats.synthProtects는 prevStats spread로 이미 보존됨
 * (기존 동작) — 추가 변경 불필요.
 */

const buildPlayer = (overrides = {}) => ({
    ...INITIAL_STATE.player,
    name: 'tester',
    gender: 'male',
    level: 30,
    hp: 0,
    titles: [],
    activeTitle: null,
    ...overrides,
});

test('cycle 191: handleDefeat가 titles 보존', () => {
    const player = buildPlayer({
        titles: ['first_blood', 'centurion', '시즌 선구자'],
        activeTitle: '시즌 선구자',
    });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.deepEqual(result.updatedPlayer.titles, ['first_blood', 'centurion', '시즌 선구자']);
    assert.equal(result.updatedPlayer.activeTitle, '시즌 선구자');
});

test('cycle 191: handleDefeat가 premium 자산 4종 보존', () => {
    const player = buildPlayer({
        premiumCurrency: 50,
        reviveTokens: 2,
        maxInv: 25,
    });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.equal(result.updatedPlayer.premiumCurrency, 50);
    assert.equal(result.updatedPlayer.reviveTokens, 2);
    assert.equal(result.updatedPlayer.maxInv, 25);
});

test('cycle 191: handleDefeat가 seasonPass 보존', () => {
    const seasonPass = { xp: 5000, tier: 12, claimed: [1, 2, 3], isPremium: true, seasonId: 'S1' };
    const player = buildPlayer({ seasonPass });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.deepEqual(result.updatedPlayer.seasonPass, seasonPass);
});

test('cycle 191: handleDefeat가 stats.cosmeticTitles / synthProtects 보존 (기존 동작)', () => {
    const player = buildPlayer({
        stats: {
            ...INITIAL_STATE.player.stats,
            cosmeticTitles: ['title_stargazer'],
            synthProtects: 5,
            kills: 100, total_gold: 5000,
        },
    });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.deepEqual(result.updatedPlayer.stats.cosmeticTitles, ['title_stargazer']);
    assert.equal(result.updatedPlayer.stats.synthProtects, 5);
});

test('cycle 191: handleDefeat가 RUN 진행도 reset (회귀 가드)', () => {
    const player = buildPlayer({
        gold: 99999,
        inv: [{ name: 'epic loot', id: 'fake' }],
        skillLoadout: { selected: 1, cooldowns: { fireball: 5 } },
    });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    // RUN 진행도는 reset:
    // CONSTANTS.START_GOLD = 200
    assert.equal(result.updatedPlayer.gold, 200, 'gold reset to START_GOLD');
    assert.equal(result.updatedPlayer.inv.length, 2, 'inv reset to 2 starter consumables');
    assert.equal(result.updatedPlayer.skillLoadout.selected, 0);
    assert.deepEqual(result.updatedPlayer.skillLoadout.cooldowns, {});
});

test('cycle 191: handleDefeat가 stats.deaths += 1 (회귀 가드)', () => {
    const player = buildPlayer({
        stats: { ...INITIAL_STATE.player.stats, deaths: 5 },
    });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.equal(result.updatedPlayer.stats.deaths, 6);
});
