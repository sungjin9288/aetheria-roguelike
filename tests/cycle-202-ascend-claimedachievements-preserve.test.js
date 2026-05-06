import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 202: ASCEND가 claimedAchievements를 보존해야 (cycle 188 패턴 follow-up).
 *
 * 발견 (재발견 익스플로잇):
 * - ASCEND 핸들러(progressionHandlers.ts:60)는 stats를 명시 필드만 보존:
 *   kills / bossKills / deaths / total_gold / relicCount / abyssFloor / abyssRecord /
 *   escapes / syntheses / maxKillStreak / visitedMaps / discoveryChains /
 *   demonKingSlain / bountiesCompleted / crafts / codex / codexClaimed /
 *   cosmeticTitles(cycle 188) / synthProtects(cycle 188).
 * - claimedAchievements는 미보존 → ASCEND 후 [] 으로 리셋.
 * - 그러나 위 카운터들(kills / bossKills 등)은 보존되므로 isAchievementUnlocked는
 *   여전히 true.
 * - claimAchievement(useInventoryActions.ts:320)는 'claimed.includes(achId)' 만 가드.
 * - 결과: ASCEND마다 모든 업적을 재청구 가능 → gold / item 무한 획득 exploit.
 * - cycle 188 "영구 자산 보존" 패턴(cosmeticTitles / synthProtects)과 동일 카테고리 —
 *   claimedAchievements도 영구 ledger.
 *
 * 수정 (src/reducers/handlers/progressionHandlers.ts ASCEND):
 * - stats에 claimedAchievements 명시 보존 추가.
 * - 미정의 시 [] fallback (구형 save 호환).
 */

const buildAscendingState = (claimedAchievements) => ({
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
            claimedAchievements: claimedAchievements,
            cosmeticTitles: [],
            synthProtects: 0,
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

test('cycle 202: ASCEND가 claimedAchievements를 보존', () => {
    const state = buildAscendingState(['ach_first_blood', 'ach_kill_100', 'ach_boss_5']);
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(
        next.player.stats.claimedAchievements,
        ['ach_first_blood', 'ach_kill_100', 'ach_boss_5'],
        'claimedAchievements 3건 모두 ASCEND 후 보존되어야 함 (재청구 exploit 방지)',
    );
});

test('cycle 202: claimedAchievements 미정의 시 [] fallback (구형 save)', () => {
    const state = buildAscendingState(undefined);
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(next.player.stats.claimedAchievements, [],
        '구형 save로 미정의 시 [] fallback');
});

test('cycle 202: claimedAchievements 빈 배열은 그대로 빈 배열', () => {
    const state = buildAscendingState([]);
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(next.player.stats.claimedAchievements, []);
});

test('cycle 188 회귀 가드: cosmeticTitles / synthProtects 보존 동시 유지', () => {
    const state = buildAscendingState(['ach_test']);
    state.player.stats.cosmeticTitles = ['별을 보는 자'];
    state.player.stats.synthProtects = 3;
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    assert.deepEqual(next.player.stats.cosmeticTitles, ['별을 보는 자']);
    assert.equal(next.player.stats.synthProtects, 3);
    assert.deepEqual(next.player.stats.claimedAchievements, ['ach_test']);
});

test('cycle 119 회귀 가드: 영구 카운터 동시 보존', () => {
    const state = buildAscendingState(['ach_a']);
    const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
    // 카운터 보존
    assert.equal(next.player.stats.kills, 100);
    assert.equal(next.player.stats.bossKills, 5);
    assert.equal(next.player.stats.total_gold, 5000);
    assert.equal(next.player.stats.deaths, 2);
    // demonKingSlain은 +1
    assert.equal(next.player.stats.demonKingSlain, 1);
});
