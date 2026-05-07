import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * cycle 260: questReward title checkTitles fallback handler 누락 dead config
 *   (cycle 222-259 silent dead config 시리즈 31번째).
 *
 * 발견 (cycle 199 prestigeRank / cycle 201 seasonTier paired pattern):
 * - src/utils/gameUtils.ts checkTitles는 cycle 199에서 'prestigeRank', cycle 201에서
 *   'seasonTier' fallback handler 추가 — 저장 손실 / 마이그레이션 등 복구 케이스 보호.
 * - 그러나 cond.type='questReward' 5종 ('에테르 탐험가' 152, '공허의 방랑자' 153,
 *   '종말의 정복자' 154, '지도 제작자' 201, '전설의 기록자' 202) — claimQuestReward가 직접
 *   grant하지만 checkTitles에 fallback 없음.
 * - 결과: 저장 데이터에서 player.titles는 손실되지만 quest는 완료된 케이스 → 영원히
 *   해당 칭호 복구 불가. 동일 패턴 prestigeRank / seasonTier는 보호.
 *
 * 추가 인프라 필요:
 * - stats.claimedQuestIds: number[] — 완료된 quest id 영구 추적 (RUN-wide multi-run
 *   ledger). cycle 202 claimedAchievements 패턴 동일.
 *
 * 패턴 (cycle 222-259 silent dead config 시리즈 31번째):
 * - cycle 199: prestigeRank checkTitles fallback.
 * - cycle 201: seasonTier checkTitles fallback.
 * - cycle 260: questReward checkTitles fallback (paired completion).
 *
 * 수정:
 * 1) src/reducers/gameReducer.ts INITIAL_STATE.player.stats: claimedQuestIds: [] 추가.
 * 2) src/hooks/useInventoryActions.ts completeQuest: stats.claimedQuestIds에 qId push.
 * 3) src/utils/gameUtils.ts checkTitles: 'questReward' fallback 추가.
 * 4) src/utils/gameUtils.ts migrateData: target.stats.claimedQuestIds 정규화.
 * 5) src/reducers/handlers/progressionHandlers.ts ASCEND + RESET_GAME: claimedQuestIds 보존
 *    (cycle 202 claimedAchievements 패턴).
 *
 * 회귀 가드:
 * - 기존 prestigeRank / seasonTier fallback 동작 유지.
 * - claimedQuestIds 미정의 saved data → migrateData가 [] 정규화 (회귀 가드).
 * - completeQuest 기존 동작 (가드/보상 grant) 변화 없음.
 */

test('cycle 260: INITIAL_STATE.player.stats.claimedQuestIds 정의 + 빈 배열', async () => {
    const { INITIAL_STATE } = await import('../src/reducers/gameReducer.js');
    assert.ok(Array.isArray(INITIAL_STATE.player.stats?.claimedQuestIds),
        'claimedQuestIds 배열 정의되어야 함');
    assert.equal(INITIAL_STATE.player.stats.claimedQuestIds.length, 0,
        '초기값 빈 배열');
});

test('cycle 260: checkTitles questReward fallback — claimedQuestIds 매칭', async () => {
    const { checkTitles } = await import('../src/utils/gameUtils.js');
    // questReward val=152 ('에테르 탐험가') — claimedQuestIds에 152 있으면 unlock 후보로 잡힘.
    const player = {
        titles: [],
        level: 30,
        meta: {},
        stats: {
            kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
            relicCount: 0, abyssFloor: 0, abyssRecord: 0,
            escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
            visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
            killRegistry: {}, codex: {}, codexClaimed: [], cosmeticTitles: [],
            synthProtects: 0, claimedAchievements: [], buildWins: {},
            codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
            signaturePity: 0, bountyIssued: false, dailyProtocol: null,
            dailyInvadeCount: 0, lastInvadeDate: null,
            // questReward val=152 trigger.
            claimedQuestIds: [152],
            bountiesCompleted: 0,
        },
    };
    const newTitles = checkTitles(player);
    // '에테르 탐험가' (id=에테르 탐험가, cond { type: 'questReward', val: 152 })가 unlock 가능.
    assert.ok(newTitles.includes('에테르 탐험가'),
        `'에테르 탐험가' fallback unlock (실제: ${newTitles.join(',')})`);
});

test('cycle 260: claimedQuestIds에 없는 quest는 fallback 미발동 (회귀 가드)', async () => {
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
            killRegistry: {}, codex: {}, codexClaimed: [], cosmeticTitles: [],
            synthProtects: 0, claimedAchievements: [], buildWins: {},
            codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
            signaturePity: 0, bountyIssued: false, dailyProtocol: null,
            dailyInvadeCount: 0, lastInvadeDate: null,
            claimedQuestIds: [],
            bountiesCompleted: 0,
        },
    };
    const newTitles = checkTitles(player);
    assert.ok(!newTitles.includes('에테르 탐험가'),
        `claimedQuestIds 비어있으면 questReward fallback 미발동 (회귀 가드)`);
    assert.ok(!newTitles.includes('지도 제작자'),
        `'지도 제작자' (questReward 201) 미발동`);
});

test('cycle 260: cycle 199/201 fallback 회귀 가드 — prestigeRank / seasonTier 동작 유지', async () => {
    const { checkTitles } = await import('../src/utils/gameUtils.js');
    // prestigeRank 1 → '각성자' (val: 1) unlock.
    const player = {
        titles: [],
        level: 30,
        meta: { prestigeRank: 1 },
        stats: {
            kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
            relicCount: 0, abyssFloor: 0, abyssRecord: 0,
            escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
            visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
            killRegistry: {}, codex: {}, codexClaimed: [], cosmeticTitles: [],
            synthProtects: 0, claimedAchievements: [], buildWins: {},
            codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
            signaturePity: 0, bountyIssued: false, dailyProtocol: null,
            dailyInvadeCount: 0, lastInvadeDate: null,
            claimedQuestIds: [],
            bountiesCompleted: 0,
        },
        seasonPass: { tier: 10 },
    };
    const newTitles = checkTitles(player);
    assert.ok(newTitles.includes('각성자'), 'cycle 199 prestigeRank 회귀 가드');
    assert.ok(newTitles.includes('시즌 선구자'), 'cycle 201 seasonTier 회귀 가드');
});

test('cycle 260: migrateData claimedQuestIds 정규화 (회귀 가드)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // claimedQuestIds 미정의 saved data → 빈 배열로 정규화.
    const oldSave = {
        version: 1,
        player: {
            name: 'Test', job: '전사', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            atk: 10, def: 5, gold: 100, exp: 0, inv: [], equip: {}, relics: [],
            titles: [], history: [], skillChoices: {}, combatFlags: {},
            stats: { kills: 0 },  // claimedQuestIds 없음.
            quests: [],
        },
    };
    const migrated = migrateData(oldSave);
    assert.ok(Array.isArray(migrated.player.stats?.claimedQuestIds),
        `migrateData가 claimedQuestIds 빈 배열 정규화`);
});
