import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * cycle 262: cosmetic title checkTitles fallback handler 누락 dead config
 *   (cycle 222-261 silent dead config 시리즈 33번째).
 *
 * 발견 (cycle 199 prestigeRank / 201 seasonTier / 260 questReward 시리즈 paired):
 * - src/utils/gameUtils.ts checkTitles는 cycle 199/201/260에서 prestigeRank / seasonTier /
 *   questReward fallback handler 추가 — 저장 손실 / 마이그레이션 등 복구 케이스 보호.
 * - 그러나 cond.type='cosmetic' 4종 ('별을 보는 자' / '공허를 걷는 자' / '에테르의 아이' /
 *   '세계의 끝')은 잔존 누락. purchaseCosmeticTitle이 직접 grant하지만 checkTitles에 fallback
 *   없어 player.titles 손실 시 영구 복구 불가.
 * - stats.cosmeticTitles에 영문 id (title_stargazer 등)가 영구 ledger로 저장되지만 checkTitles는
 *   이를 검증하지 않음 → premium 구매 cosmetic 자산 silent loss 가능.
 *
 * 패턴 (cycle 222-261 silent dead config 시리즈 33번째):
 * - cycle 199: prestigeRank fallback.
 * - cycle 201: seasonTier fallback.
 * - cycle 260: questReward fallback.
 * - cycle 262: cosmetic fallback (시리즈 paired completion 마무리).
 *
 * 매핑 인프라:
 * - PREMIUM_SHOP.cosmeticTitles[i].name === TITLES title.id (Korean 이름 동등).
 * - PREMIUM_SHOP.cosmeticTitles[i].id (영문) === stats.cosmeticTitles[i] (저장).
 * - title.id로 PREMIUM_SHOP에서 영문 id 조회 → stats.cosmeticTitles 매칭.
 *
 * 수정:
 * - src/utils/gameUtils.ts:
 *   - PREMIUM_SHOP import 추가.
 *   - checkTitles에 'cosmetic' fallback handler — 영문 id 매핑 후 stats.cosmeticTitles 매칭.
 *
 * 회귀 가드:
 * - cycle 199/201/260 fallback 동작 유지.
 * - stats.cosmeticTitles 빈 배열 시 미발동 (회귀 가드).
 * - cosmetic title은 stat 보너스 없음 (cycle 248-249 confirmed cosmetic-only).
 */

test('cycle 262: 별을 보는 자 fallback — stats.cosmeticTitles 매칭', async () => {
    const { checkTitles } = await import('../src/utils/gameUtils.js');
    const player = {
        titles: [],
        level: 30,
        meta: {},
        stats: {
            kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
            relicCount: 0, abyssFloor: 0, abyssRecord: 0,
            escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
            visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
            killRegistry: {}, codex: {}, codexClaimed: [],
            // 'title_stargazer' (영문) 매핑 — '별을 보는 자' Korean title.id에 해당.
            cosmeticTitles: ['title_stargazer'],
            synthProtects: 0, claimedAchievements: [], buildWins: {},
            codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
            signaturePity: 0, bountyIssued: false, dailyProtocol: null,
            dailyInvadeCount: 0, lastInvadeDate: null,
            claimedQuestIds: [], bountiesCompleted: 0,
        },
    };
    const newTitles = checkTitles(player);
    assert.ok(newTitles.includes('별을 보는 자'),
        `'별을 보는 자' fallback unlock (실제: ${newTitles.join(',')})`);
});

test('cycle 262: 모든 4 cosmetic titles fallback 동작', async () => {
    const { checkTitles } = await import('../src/utils/gameUtils.js');
    const player = {
        titles: [],
        level: 30,
        meta: {},
        stats: {
            kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
            relicCount: 0, abyssFloor: 0, abyssRecord: 0,
            escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
            visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
            killRegistry: {}, codex: {}, codexClaimed: [],
            cosmeticTitles: ['title_stargazer', 'title_voidwalker', 'title_aetherborn', 'title_worldender'],
            synthProtects: 0, claimedAchievements: [], buildWins: {},
            codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
            signaturePity: 0, bountyIssued: false, dailyProtocol: null,
            dailyInvadeCount: 0, lastInvadeDate: null,
            claimedQuestIds: [], bountiesCompleted: 0,
        },
    };
    const newTitles = checkTitles(player);
    ['별을 보는 자', '공허를 걷는 자', '에테르의 아이', '세계의 끝'].forEach((expected) => {
        assert.ok(newTitles.includes(expected),
            `'${expected}' fallback (실제: ${newTitles.join(',')})`);
    });
});

test('cycle 262: stats.cosmeticTitles 비어있을 시 fallback 미발동 (회귀 가드)', async () => {
    const { checkTitles } = await import('../src/utils/gameUtils.js');
    const player = {
        titles: [],
        level: 30,
        meta: {},
        stats: {
            kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
            relicCount: 0, abyssFloor: 0, abyssRecord: 0,
            escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
            visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
            killRegistry: {}, codex: {}, codexClaimed: [],
            cosmeticTitles: [],
            synthProtects: 0, claimedAchievements: [], buildWins: {},
            codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
            signaturePity: 0, bountyIssued: false, dailyProtocol: null,
            dailyInvadeCount: 0, lastInvadeDate: null,
            claimedQuestIds: [], bountiesCompleted: 0,
        },
    };
    const newTitles = checkTitles(player);
    assert.ok(!newTitles.includes('별을 보는 자'),
        '비어있는 cosmeticTitles 시 fallback 미발동');
});

test('cycle 262: cycle 199/201/260 fallback 동작 유지 (시리즈 회귀 가드)', async () => {
    const { checkTitles } = await import('../src/utils/gameUtils.js');
    const player = {
        titles: [],
        level: 30,
        meta: { prestigeRank: 1 },
        stats: {
            kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
            relicCount: 0, abyssFloor: 0, abyssRecord: 0,
            escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
            visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
            killRegistry: {}, codex: {}, codexClaimed: [],
            cosmeticTitles: ['title_stargazer'],
            synthProtects: 0, claimedAchievements: [], buildWins: {},
            codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
            signaturePity: 0, bountyIssued: false, dailyProtocol: null,
            dailyInvadeCount: 0, lastInvadeDate: null,
            claimedQuestIds: [152], bountiesCompleted: 0,
        },
        seasonPass: { tier: 10 },
    };
    const newTitles = checkTitles(player);
    assert.ok(newTitles.includes('각성자'), 'cycle 199 prestigeRank 회귀 가드');
    assert.ok(newTitles.includes('시즌 선구자'), 'cycle 201 seasonTier 회귀 가드');
    assert.ok(newTitles.includes('에테르 탐험가'), 'cycle 260 questReward 회귀 가드');
    assert.ok(newTitles.includes('별을 보는 자'), 'cycle 262 cosmetic 신규 동작');
});
