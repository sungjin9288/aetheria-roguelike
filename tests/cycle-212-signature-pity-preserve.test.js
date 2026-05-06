import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 212: ASCEND / RESET_GAME이 signaturePity mercy 카운터 보존
 *   (cycle 75 mercy + cycle 191 META preserve 정합).
 *
 * 발견 (handleDefeat vs ASCEND/RESET 비대칭):
 * - signaturePity (cycle 75): signature 드롭 anti-frustration mercy 카운터.
 *   · 보스 토벌 + signature 미획득 → pity += 1
 *   · signature 드롭 → pity = 0
 *   · getSignaturePityMultiplier(pity) → 다음 보스 signature 확률 step-wise 배율.
 * - handleDefeat: starterState.stats = {...starterState.stats, ...prevStats, ...} →
 *   prevStats spread로 signaturePity 보존 (multi-run mercy 의도와 정합).
 * - 그러나 ASCEND(progressionHandlers.ts) / RESET_GAME(cycle 204)의 stats 보존 list에
 *   signaturePity 미포함 → INITIAL_STATE.stats에 없으므로 reset (undefined).
 *
 * 결과 (mercy 시스템 무력화):
 * - 플레이어가 30 보스 토벌 동안 signature 미획득 → pity=30 (배율 1.9x).
 * - ASCEND → pity=0 → 다음 보스 signature 확률이 base로 강하 → mercy 시스템 작동 차단.
 * - 명시적 anti-frustration 설계 의도 위반.
 *
 * 정합성:
 * - handleDefeat: 보존 ✓ (cycle 191 META preserve와 같은 결).
 * - ASCEND: 보존 필요 (cycle 119 multi-run 카운터 preserve series 합류).
 * - RESET_GAME: 보존 필요 (cycle 204 align).
 *
 * 수정 (src/reducers/handlers/progressionHandlers.ts):
 * - ASCEND stats preserve list에 signaturePity 추가.
 * - RESET_GAME stats preserve list에 동일 추가.
 * - 미정의 시 0 fallback (구형 save 호환, 기본 mercy 1.0x로 시작).
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

test('cycle 212: ASCEND가 signaturePity mercy 카운터 보존', () => {
    const state = buildState({ signaturePity: 30 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.signaturePity, 30,
        'signaturePity는 multi-run mercy 카운터 — ASCEND 시 보존 필요 (anti-frustration 설계)');
});

test('cycle 212: RESET_GAME이 signaturePity 보존', () => {
    const state = buildState({ signaturePity: 15 });
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(next.player.stats.signaturePity, 15);
});

test('cycle 212: signaturePity 미정의(구형 save) → 0 fallback', () => {
    const state = buildState({});
    delete state.player.stats.signaturePity;
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    const reset = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(ascended.player.stats.signaturePity || 0, 0);
    assert.equal(reset.player.stats.signaturePity || 0, 0);
});

test('cycle 212: signaturePity 0 (mercy 미적립 상태)는 그대로 0', () => {
    const state = buildState({ signaturePity: 0 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.signaturePity, 0);
});

test('cycle 211/202/119 회귀 가드: 다른 stats 보존 동시 유지', () => {
    const state = buildState({
        signaturePity: 25,
        codexBonusAtk: 10,
        codexBonusDef: 5,
        codexBonusHp: 100,
        kills: 500,
        cosmeticTitles: ['별을 보는 자'],
        synthProtects: 2,
        claimedAchievements: ['ach_test'],
        explores: 100,
    });
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // cycle 211
    assert.equal(ascended.player.stats.codexBonusAtk, 10);
    assert.equal(ascended.player.stats.codexBonusDef, 5);
    assert.equal(ascended.player.stats.codexBonusHp, 100);
    // cycle 119
    assert.equal(ascended.player.stats.kills, 500);
    // cycle 188
    assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
    assert.equal(ascended.player.stats.synthProtects, 2);
    // cycle 202
    assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
    // cycle 203
    assert.equal(ascended.player.stats.explores, 100);
    // cycle 212
    assert.equal(ascended.player.stats.signaturePity, 25);
});

test('cycle 212: handleDefeat preserves signaturePity (이미 정합 — 회귀 가드)', async () => {
    const { CombatEngine } = await import('../src/systems/CombatEngine.js');
    const player = {
        ...INITIAL_STATE.player,
        name: 'Test',
        hp: 0,
        maxHp: 100,
        stats: { ...INITIAL_STATE.player.stats, signaturePity: 12 },
    };
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.equal(result.updatedPlayer.stats.signaturePity, 12,
        'handleDefeat은 signaturePity를 ...prevStats spread로 보존 — 회귀 가드');
});
