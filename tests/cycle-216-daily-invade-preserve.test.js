import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 216: ASCEND / RESET_GAME이 dailyInvadeCount / lastInvadeDate 보존
 *   (cycle 213 일일 bounty preserve와 동일 lens — 일일 invasion 5회 제한 우회 exploit fix).
 *
 * 발견 (mid-day 재진입 exploit):
 * - dailyInvadeCount + lastInvadeDate: 일일 grave invasion 5회 제한 ledger.
 * - useInventoryActions.ts:549 invadeGrave: today === lastInvadeDate면 currentCount 사용,
 *   다른 날이면 0부터 시작.
 * - cycle 137에서 BALANCE.DAILY_INVADE_LIMIT(=5) 참조 fix로 일일 제한 정상 동작.
 *
 * 시나리오 (exploit):
 * 1. 오늘 grave 5회 침략 완료 → dailyInvadeCount=5, lastInvadeDate=today.
 * 2. invadeGrave 호출 시 INVADE_LIMIT 에러 (정상).
 * 3. 마왕 격파 → ASCEND → freshPlayer = {...INITIAL_STATE.player, ...} → dailyInvadeCount=0.
 * 4. 같은 날 grave 5회 추가 침략 가능 → 일일 5회 제한 우회.
 * - cycle 213 bounty preserve와 동일 lens (paired ledger 정합성).
 *
 * 정합성:
 * - handleDefeat: ...prevStats spread로 보존 ✓ (정합).
 * - ASCEND: 미보존 → 회귀.
 * - RESET_GAME (cycle 204): 미보존 → 회귀.
 *
 * 수정 (src/reducers/handlers/progressionHandlers.ts):
 * - ASCEND stats preserve list에 dailyInvadeCount / lastInvadeDate 추가.
 * - RESET_GAME stats preserve list에 동일 추가.
 * - 미정의 시 0/null fallback (구형 save 호환).
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

const today = new Date().toDateString();

test('cycle 216: ASCEND가 dailyInvadeCount 보존', () => {
    const state = buildState({ dailyInvadeCount: 5, lastInvadeDate: today });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.dailyInvadeCount, 5,
        'dailyInvadeCount는 일일 ledger — ASCEND 시 보존 필요 (mid-day 재침략 exploit 방지)');
});

test('cycle 216: ASCEND가 lastInvadeDate 보존', () => {
    const state = buildState({ dailyInvadeCount: 5, lastInvadeDate: today });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.lastInvadeDate, today);
});

test('cycle 216: RESET_GAME이 dailyInvadeCount / lastInvadeDate 보존', () => {
    const state = buildState({ dailyInvadeCount: 3, lastInvadeDate: today });
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(next.player.stats.dailyInvadeCount, 3);
    assert.equal(next.player.stats.lastInvadeDate, today);
});

test('cycle 216: 미정의(구형 save) → 0/null fallback', () => {
    const state = buildState({});
    delete state.player.stats.dailyInvadeCount;
    delete state.player.stats.lastInvadeDate;
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    const reset = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(ascended.player.stats.dailyInvadeCount || 0, 0);
    assert.equal(ascended.player.stats.lastInvadeDate ?? null, null);
    assert.equal(reset.player.stats.dailyInvadeCount || 0, 0);
    assert.equal(reset.player.stats.lastInvadeDate ?? null, null);
});

test('cycle 216: 어제 날짜 + count 5라면 그대로 보존 (자동 reset은 invadeGrave 호출 시 분기)', () => {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const state = buildState({ dailyInvadeCount: 5, lastInvadeDate: yesterday });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // ASCEND는 그대로 보존 — 다음 invadeGrave 호출에서 'lastDate === today' 체크가
    // 실패하면 자동으로 0부터 시작 (useInventoryActions.ts:552).
    assert.equal(next.player.stats.dailyInvadeCount, 5);
    assert.equal(next.player.stats.lastInvadeDate, yesterday);
});

test('cycle 213/211/202 회귀 가드: 다른 stats 보존 동시 유지', () => {
    const state = buildState({
        dailyInvadeCount: 4,
        lastInvadeDate: today,
        bountyDate: today,
        bountyIssued: true,
        codexBonusAtk: 10,
        signaturePity: 25,
        claimedAchievements: ['ach_test'],
    });
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // cycle 216
    assert.equal(ascended.player.stats.dailyInvadeCount, 4);
    assert.equal(ascended.player.stats.lastInvadeDate, today);
    // cycle 213
    assert.equal(ascended.player.stats.bountyDate, today);
    assert.equal(ascended.player.stats.bountyIssued, true);
    // cycle 211
    assert.equal(ascended.player.stats.codexBonusAtk, 10);
    // cycle 212
    assert.equal(ascended.player.stats.signaturePity, 25);
    // cycle 202
    assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
});
