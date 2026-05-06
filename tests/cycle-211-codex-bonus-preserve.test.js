import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 211: ASCEND / RESET_GAME이 codexBonus(Atk/Def/Hp)를 보존 (cycle 202 lens 확장).
 *
 * 발견 (paired ledger 정합성 깨짐 — 영구 자산 silent 손실):
 * - CLAIM_CODEX_REWARD 핸들러(rewardHandlers.ts:66): milestone 청구 시
 *   stats.codexBonusAtk/Def/Hp 누적 가산. 영구 stat 보너스 (statsCalculator.ts:58-60에서
 *   getFullStats에 +).
 * - 이 보너스는 cumulative 누적 — codexClaimed 배열에서 동적 재계산 안 함.
 * - 그러나 cycle 119/202/203/204 stats 보존 list에 codexBonus(Atk/Def/Hp) 미포함:
 *   · ASCEND: codexClaimed는 보존하지만 codexBonusAtk/Def/Hp는 INITIAL_STATE.stats에
 *     없으므로 reset → undefined.
 *   · RESET_GAME (cycle 204): 동일.
 *   · handleDefeat: ...prevStats spread로 보존 (cycle 191 정합) — 일관성 단절.
 *
 * 결과 (silent permanent loss):
 * - 플레이어가 '몬스터 도감 100 발견' milestone을 청구해 +10 ATK 영구 보너스 획득.
 * - ASCEND 시 codexClaimed는 보존(재청구 차단)되지만 +10 ATK는 사라짐.
 * - 재청구 불가 (codexClaimed에 등록) → 영구 손실. cycle 202 claimedAchievements
 *   재청구 exploit과 정반대 방향의 회귀.
 *
 * 수정:
 * - src/reducers/handlers/progressionHandlers.ts ASCEND: codexBonusAtk/Def/Hp 명시 보존.
 * - src/reducers/handlers/progressionHandlers.ts RESET_GAME: 동일.
 * - 미정의 시 0 fallback (구형 save 호환).
 */

const buildState = (statsOverrides = {}) => ({
    ...INITIAL_STATE,
    player: {
        ...INITIAL_STATE.player,
        name: 'Test',
        gender: 'male',
        meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        stats: {
            ...INITIAL_STATE.player.stats,
            kills: 100,
            ...statsOverrides,
        },
    },
    grave: null,
    uid: 'test-uid',
    bootStage: 'ready',
});

const ASCEND_PAYLOAD = {
    meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
    newTitle: '각성자',
};

test('cycle 211: ASCEND가 codexBonusAtk 보존', () => {
    const state = buildState({ codexBonusAtk: 15 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.codexBonusAtk, 15,
        'codexBonusAtk는 영구 누적 stat 보너스 — ASCEND 시 보존 필요 (재청구 불가하므로)');
});

test('cycle 211: ASCEND가 codexBonusDef 보존', () => {
    const state = buildState({ codexBonusDef: 8 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.codexBonusDef, 8);
});

test('cycle 211: ASCEND가 codexBonusHp 보존', () => {
    const state = buildState({ codexBonusHp: 50 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.codexBonusHp, 50);
});

test('cycle 211: RESET_GAME이 codexBonus 3종 동시 보존', () => {
    const state = buildState({ codexBonusAtk: 12, codexBonusDef: 6, codexBonusHp: 100 });
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(next.player.stats.codexBonusAtk, 12);
    assert.equal(next.player.stats.codexBonusDef, 6);
    assert.equal(next.player.stats.codexBonusHp, 100);
});

test('cycle 211: 미정의(구형 save) → 0 fallback', () => {
    const state = buildState({});
    delete state.player.stats.codexBonusAtk;
    delete state.player.stats.codexBonusDef;
    delete state.player.stats.codexBonusHp;
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    const reset = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(ascended.player.stats.codexBonusAtk || 0, 0);
    assert.equal(reset.player.stats.codexBonusAtk || 0, 0);
});

test('cycle 211: codexClaimed와 codexBonus 동시 보존 정합성 (paired ledger)', () => {
    const state = buildState({
        codexBonusAtk: 20,
        codexBonusDef: 10,
        codexBonusHp: 200,
        codexClaimed: ['monster_100', 'weapon_50'],
    });
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // codexClaimed 보존 (cycle 119)
    assert.deepEqual(ascended.player.stats.codexClaimed, ['monster_100', 'weapon_50']);
    // codexBonus 보존 (cycle 211)
    assert.equal(ascended.player.stats.codexBonusAtk, 20);
    assert.equal(ascended.player.stats.codexBonusDef, 10);
    assert.equal(ascended.player.stats.codexBonusHp, 200);
});

test('cycle 119/202/203/204 회귀 가드: 기존 보존 필드 동시 유지', () => {
    const state = buildState({
        codexBonusAtk: 5,
        kills: 500,
        bossKills: 25,
        cosmeticTitles: ['별을 보는 자'],
        synthProtects: 2,
        claimedAchievements: ['ach_test'],
        explores: 100,
    });
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // cycle 119
    assert.equal(ascended.player.stats.kills, 500);
    assert.equal(ascended.player.stats.bossKills, 25);
    // cycle 188
    assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
    assert.equal(ascended.player.stats.synthProtects, 2);
    // cycle 202
    assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
    // cycle 203
    assert.equal(ascended.player.stats.explores, 100);
    // cycle 211
    assert.equal(ascended.player.stats.codexBonusAtk, 5);
});
