import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 214: ASCEND / RESET_GAME / handleDefeat이 weeklyProtocol 보존
 *   (cycle 213 일일 bounty preserve와 동일 lens — 주간 재청구 exploit 방지).
 *
 * 발견 (mid-week 재발급 exploit + 주간 진행도 손실):
 * - weeklyProtocol (root level): { kills, explores, bossKills, lastResetWeek, claimed }.
 * - CLAIM_WEEKLY_MISSION(protocolHandlers.ts:38): 'wp.claimed.includes(missionId)' 가드만 사용.
 * - resetWeeklyProtocolIfNeeded(exploreUtils.ts): lastResetWeek !== currentWeek일 때 자동 reset.
 *
 * 시나리오 (exploit + 회귀):
 * 1. 이번 주 weekly 미션 'kill_50' 완료 → claimed=['kill_50'], 보상 청구.
 * 2-A (mid-week ASCEND exploit):
 *    - 마왕 격파 → ASCEND → freshPlayer = {...INITIAL_STATE.player, ...} → weeklyProtocol reset.
 *    - 다음 explore: lastResetWeek=0 !== currentWeek → resetWeeklyProtocolIfNeeded → claimed=[].
 *    - 같은 주 'kill_50' 재청구 가능 → 주간 1회 제한 우회.
 * 2-B (mid-week death 회귀):
 *    - 사망 → handleDefeat → starterState = {...INITIAL_PLAYER} → weeklyProtocol reset.
 *    - 같은 주 진행도(kills 35/50)가 0으로 wipe → 다시 35회 사냥 필요.
 *    - cycle 191 META preserve가 weeklyProtocol를 누락한 회귀.
 *
 * 정합성:
 * - cycle 191 (handleDefeat META preserve): weeklyProtocol 미포함 → 누락.
 * - cycle 188 (ASCEND premium preserve): weeklyProtocol 미포함.
 * - cycle 204 (RESET_GAME META preserve): weeklyProtocol 미포함.
 *
 * 수정:
 * 1. src/reducers/handlers/progressionHandlers.ts ASCEND: weeklyProtocol 명시 보존.
 * 2. src/reducers/handlers/progressionHandlers.ts RESET_GAME: 동일.
 * 3. src/systems/CombatEngine.ts handleDefeat: weeklyProtocol 명시 보존 (cycle 191 누락분).
 *
 * 회귀 가드: lastResetWeek 자동 reset 로직(exploreUtils)은 그대로 — 새 주 시작 시 정상 reset.
 */

const buildState = (weeklyProtocolOverride) => ({
    ...INITIAL_STATE,
    player: {
        ...INITIAL_STATE.player,
        name: 'Test',
        gender: 'male',
        meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        weeklyProtocol: weeklyProtocolOverride,
    },
    grave: null,
    uid: 'test-uid',
    bootStage: 'ready',
});

const ASCEND_PAYLOAD = {
    meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
    newTitle: '각성자',
};

const SAMPLE_WP = {
    kills: 35,
    explores: 12,
    bossKills: 2,
    lastResetWeek: 18,
    claimed: ['kill_50', 'explore_30'],
};

test('cycle 214: ASCEND가 weeklyProtocol 보존', () => {
    const state = buildState(SAMPLE_WP);
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(next.player.weeklyProtocol, SAMPLE_WP,
        'weeklyProtocol는 주간 미션 진행/claimed ledger — ASCEND 시 보존 필요 (mid-week 재청구 exploit 방지)');
});

test('cycle 214: RESET_GAME이 weeklyProtocol 보존', () => {
    const state = buildState(SAMPLE_WP);
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.deepEqual(next.player.weeklyProtocol, SAMPLE_WP);
});

test('cycle 214: handleDefeat이 weeklyProtocol 보존 (cycle 191 누락분)', () => {
    const player = {
        ...INITIAL_STATE.player,
        name: 'Test',
        hp: 0,
        maxHp: 100,
        weeklyProtocol: SAMPLE_WP,
    };
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.deepEqual(result.updatedPlayer.weeklyProtocol, SAMPLE_WP,
        '사망 후 mid-week 진행도 lock — cycle 191 META preserve 시리즈 보강');
});

test('cycle 214: weeklyProtocol 미정의 시 INITIAL fallback (구형 save)', () => {
    const state = buildState(undefined);
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    const reset = gameReducer(state, { type: AT.RESET_GAME });
    // INITIAL fallback (kills:0, explores:0, ..., claimed:[])
    assert.deepEqual(ascended.player.weeklyProtocol.claimed, []);
    assert.equal(ascended.player.weeklyProtocol.kills, 0);
    assert.deepEqual(reset.player.weeklyProtocol.claimed, []);
});

test('cycle 214: claimed 배열이 존재하면 보존 (재청구 exploit 가드)', () => {
    const state = buildState({ kills: 0, explores: 0, bossKills: 0, lastResetWeek: 18, claimed: ['boss_5'] });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(next.player.weeklyProtocol.claimed, ['boss_5'],
        '청구된 미션 ledger는 영구 보존 — 같은 주 재청구 차단');
});

test('cycle 191 / cycle 204 회귀 가드: 다른 META 보존 동시 유지', () => {
    const state = buildState(SAMPLE_WP);
    state.player.titles = ['warrior', '각성자'];
    state.player.activeTitle = '각성자';
    state.player.premiumCurrency = 100;
    state.player.reviveTokens = 2;
    state.player.maxInv = 25;
    state.player.seasonPass = { xp: 500, tier: 5, claimed: ['s1_t1'], isPremium: true, seasonId: 'S1' };
    state.player.stats = {
        ...INITIAL_STATE.player.stats,
        kills: 200,
        cosmeticTitles: ['별을 보는 자'],
        synthProtects: 1,
        claimedAchievements: ['ach_a'],
    };
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // cycle 191 META
    assert.deepEqual(ascended.player.titles, ['warrior', '각성자']);
    assert.equal(ascended.player.premiumCurrency, 100);
    assert.equal(ascended.player.reviveTokens, 2);
    assert.equal(ascended.player.maxInv, 25);
    assert.deepEqual(ascended.player.seasonPass.claimed, ['s1_t1']);
    // cycle 188/202 stats
    assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
    assert.equal(ascended.player.stats.synthProtects, 1);
    assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_a']);
    // cycle 214
    assert.deepEqual(ascended.player.weeklyProtocol, SAMPLE_WP);
});
