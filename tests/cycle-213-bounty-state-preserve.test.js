import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 213: ASCEND / RESET_GAME이 일일 bounty 상태(bountyDate / bountyIssued) 보존
 *   (cycle 202 paired ledger 정합성 — 일일 재청구 exploit 방지).
 *
 * 발견 (mid-day ASCEND/RESET 시 일일 bounty 재발급 exploit):
 * - bountyDate (string|null): 오늘의 bounty 발급 날짜.
 * - bountyIssued (bool): 오늘 bounty 발급 여부.
 * - QuestBoardPanel:68: `bountyIssuedToday = bountyDate === today && bountyIssued`로 게이트.
 * - questActions.ts:40-68: 동일 가드 + bounty 발급 시 두 필드 set.
 *
 * 시나리오 (exploit):
 * 1. 오늘(2026-05-06) bounty 발급: bountyDate='2026-05-06', bountyIssued=true.
 * 2. bounty 완료, 보상 청구.
 * 3. 마왕 격파 → ASCEND.
 * 4. ASCEND 핸들러는 INITIAL_STATE.stats fallback → bountyDate=null, bountyIssued=false.
 * 5. 같은 날 다시 bounty 발급 가능 → 일일 1회 제한 우회 → 일일 보상 무한 반복.
 *
 * 정합성:
 * - handleDefeat: ...prevStats spread로 보존 ✓ (정합).
 * - ASCEND: 미보존 → 회귀.
 * - RESET_GAME (cycle 204): 미보존 → 회귀.
 * - cycle 202 claimedAchievements 재청구 exploit과 동일 패턴 (영구 ledger preserve).
 *
 * 수정 (src/reducers/handlers/progressionHandlers.ts):
 * - ASCEND stats preserve list에 bountyDate / bountyIssued 추가.
 * - RESET_GAME stats preserve list에 동일 추가.
 * - dailyProtocol 같이 추가 (이미 INITIAL_STATE.stats에 default 정의됨, daily reset은 별도
 *   date 비교로 동작).
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

test('cycle 213: ASCEND가 bountyDate 보존', () => {
    const state = buildState({ bountyDate: '2026-05-06', bountyIssued: true });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.bountyDate, '2026-05-06',
        'bountyDate는 일일 발급 ledger — ASCEND 시 보존 필요 (mid-day 재발급 exploit 방지)');
});

test('cycle 213: ASCEND가 bountyIssued 보존', () => {
    const state = buildState({ bountyDate: '2026-05-06', bountyIssued: true });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.bountyIssued, true);
});

test('cycle 213: RESET_GAME이 bountyDate / bountyIssued 보존', () => {
    const state = buildState({ bountyDate: '2026-05-06', bountyIssued: true });
    const next = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(next.player.stats.bountyDate, '2026-05-06');
    assert.equal(next.player.stats.bountyIssued, true);
});

test('cycle 213: 미정의(구형 save) → null/false fallback', () => {
    const state = buildState({});
    delete state.player.stats.bountyDate;
    delete state.player.stats.bountyIssued;
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    const reset = gameReducer(state, { type: AT.RESET_GAME });
    assert.equal(ascended.player.stats.bountyDate || null, null);
    assert.equal(Boolean(ascended.player.stats.bountyIssued), false);
    assert.equal(reset.player.stats.bountyDate || null, null);
    assert.equal(Boolean(reset.player.stats.bountyIssued), false);
});

test('cycle 213: dailyProtocol도 보존 (mid-day ASCEND 미션 진행도 lock)', () => {
    const dp = {
        date: '2026-05-06',
        missions: [{ id: 'kill_5', type: 'kills', goal: 5, progress: 3, done: false }],
    };
    const state = buildState({ dailyProtocol: dp });
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    const reset = gameReducer(state, { type: AT.RESET_GAME });
    assert.deepEqual(ascended.player.stats.dailyProtocol, dp);
    assert.deepEqual(reset.player.stats.dailyProtocol, dp);
});

test('cycle 211/212/202/119 회귀 가드: 다른 stats 보존 동시 유지', () => {
    const state = buildState({
        bountyDate: '2026-05-06',
        bountyIssued: true,
        signaturePity: 25,
        codexBonusAtk: 10,
        kills: 500,
        cosmeticTitles: ['별을 보는 자'],
        claimedAchievements: ['ach_test'],
    });
    const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // cycle 213
    assert.equal(ascended.player.stats.bountyDate, '2026-05-06');
    assert.equal(ascended.player.stats.bountyIssued, true);
    // cycle 212
    assert.equal(ascended.player.stats.signaturePity, 25);
    // cycle 211
    assert.equal(ascended.player.stats.codexBonusAtk, 10);
    // cycle 119
    assert.equal(ascended.player.stats.kills, 500);
    // cycle 188
    assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
    // cycle 202
    assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
});
