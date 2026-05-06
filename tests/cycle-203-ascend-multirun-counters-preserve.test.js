import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 203: ASCEND가 explores / rests / killRegistry / buildWins 영구 카운터 보존.
 *
 * 발견 (cycle 119/188/202 lens 확장):
 * - cycle 119: ASCEND가 abyssRecord / escapes / syntheses / maxKillStreak / visitedMaps /
 *   discoveryChains 6 영구 카운터 명시 보존 — "multi-run achievement / title 데이터 소스".
 * - cycle 202: claimedAchievements 영구 ledger 보존 (재청구 exploit fix).
 * - 그러나 동일 카테고리에 속하지만 cycle 119에서 누락된 4 카운터:
 *   · explores — 6+ quest target / 1 achievement(ach_explore_10) / 2 title('방랑자' val 100,
 *     '길잡이' val 500). 'lifetime exploration' 시맨틱.
 *   · rests — title '안락함의 추구자'(rests 50 cond) 데이터 소스.
 *   · killRegistry — Bestiary / MonsterCodex / statsCalculator atk_per_kill_kind 시너지의
 *     데이터 소스. 'lifetime kill registry per monster' — multi-run permanent record.
 *   · buildWins — questProgress.ts:51에서 quest 조건으로 사용. build kind win counter.
 * - ASCEND마다 4개 카운터가 0/{}로 리셋 → progress 회귀.
 *   · 99 explores → ASCEND → 0. '방랑자'(100) 재진행 필요.
 *   · ach_explore_10 청구 후 ASCEND → claimed는 보존(cycle 202)이지만 explores=0 → 재청구는
 *     불가하나, achievement progress UI에 0/10 표시 (regression).
 *   · killRegistry 0 → Bestiary / MonsterCodex 모든 몬스터 entry 사라짐 → codex regression.
 *
 * 수정 (src/reducers/handlers/progressionHandlers.ts ASCEND):
 * - 4 카운터 명시 보존 추가 — cycle 119 패턴 동일.
 * - 미정의 시 initialStats fallback (구형 save 호환).
 */

const buildAscendingState = (statsOverrides = {}) => ({
    player: {
        name: 'Test',
        gender: 'male',
        meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        titles: [],
        activeTitle: null,
        stats: {
            kills: 100,
            bossKills: 5,
            deaths: 2,
            total_gold: 5000,
            relicCount: 3,
            ...statsOverrides,
        },
        premiumCurrency: 0,
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
        reviveTokens: 0,
    },
    uid: 'test-uid',
});

const ASCEND_PAYLOAD = {
    meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
    newTitle: '각성자',
};

test('cycle 203: ASCEND가 explores 카운터 보존', () => {
    const state = buildAscendingState({ explores: 99 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.explores, 99,
        'explores는 lifetime 카운터 (방랑자/길잡이 title source) — ASCEND 보존 필요');
});

test('cycle 203: ASCEND가 rests 카운터 보존', () => {
    const state = buildAscendingState({ rests: 49 });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.rests, 49,
        'rests는 안락함의 추구자(50) title source — 보존 필요');
});

test('cycle 203: ASCEND가 killRegistry 보존', () => {
    const state = buildAscendingState({
        killRegistry: { '슬라임': 12, '고블린': 7, '오크': 3 },
    });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(
        next.player.stats.killRegistry,
        { '슬라임': 12, '고블린': 7, '오크': 3 },
        'killRegistry는 Bestiary / MonsterCodex / atk_per_kill_kind 시너지 source — 보존 필요',
    );
});

test('cycle 203: ASCEND가 buildWins 보존', () => {
    const state = buildAscendingState({
        buildWins: { 'warrior': 3, 'mage': 1 },
    });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(
        next.player.stats.buildWins,
        { 'warrior': 3, 'mage': 1 },
        'buildWins는 questProgress build win counter — 보존 필요',
    );
});

test('cycle 203: 4 카운터 미정의(구형 save) → fallback (0 / {})', () => {
    const state = buildAscendingState({});
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.explores, 0);
    assert.equal(next.player.stats.rests, 0);
    assert.deepEqual(next.player.stats.killRegistry, {});
    assert.deepEqual(next.player.stats.buildWins, {});
});

test('cycle 203: 4 카운터 동시 보존 (혼합 케이스)', () => {
    const state = buildAscendingState({
        explores: 250,
        rests: 30,
        killRegistry: { '드래곤': 1 },
        buildWins: { 'rogue': 5 },
    });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.equal(next.player.stats.explores, 250);
    assert.equal(next.player.stats.rests, 30);
    assert.deepEqual(next.player.stats.killRegistry, { '드래곤': 1 });
    assert.deepEqual(next.player.stats.buildWins, { 'rogue': 5 });
});

test('cycle 119/188/202 회귀 가드: 기존 보존 필드 동시 유지', () => {
    const state = buildAscendingState({
        explores: 50,
        escapes: 12,
        syntheses: 8,
        maxKillStreak: 25,
        visitedMaps: ['시작의 마을', '고요한 숲'],
        cosmeticTitles: ['별을 보는 자'],
        synthProtects: 2,
        claimedAchievements: ['ach_test'],
    });
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // cycle 119
    assert.equal(next.player.stats.escapes, 12);
    assert.equal(next.player.stats.syntheses, 8);
    assert.equal(next.player.stats.maxKillStreak, 25);
    assert.deepEqual(next.player.stats.visitedMaps, ['시작의 마을', '고요한 숲']);
    // cycle 188
    assert.deepEqual(next.player.stats.cosmeticTitles, ['별을 보는 자']);
    assert.equal(next.player.stats.synthProtects, 2);
    // cycle 202
    assert.deepEqual(next.player.stats.claimedAchievements, ['ach_test']);
    // cycle 203
    assert.equal(next.player.stats.explores, 50);
});
