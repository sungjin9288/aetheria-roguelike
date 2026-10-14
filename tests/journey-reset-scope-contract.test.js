import test from 'node:test';
import assert from 'node:assert/strict';

import { ACHIEVEMENTS } from '../src/data/quests.js';
import { TITLES } from '../src/data/titles.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { isAchievementUnlocked } from '../src/utils/achievementProgress.js';
import { getCumulativeQuestProgress } from '../src/utils/cumulativeQuestProgress.js';
import { checkTitles } from '../src/utils/gameUtils.js';
import {
    ACHIEVEMENT_TARGET_SCOPE,
    TITLE_COND_SCOPE,
    getJourneyCounter,
    getJourneyMaxKillStreak,
} from '../src/utils/journeyScope.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { normalizeCurrentRunProgress } from '../src/utils/runProgress.js';

/**
 * 2026-10 Wave 108 (소유자 결정 "죽으면 모든 게 초기화 — 정수로 올린 것만 남는다 · 계승은 도감을 남긴다 · 영구 보상은 처음 한 번만"):
 *
 * | 항목                              | 사망   | 계승 |
 * | 레벨 · 장비 · 가방 · 유물          | 초기화 | 초기화 |
 * | 임무 · 이야기 · 체인 · 현상수배      | 초기화 | 초기화 |
 * | 이야기 능력치                      | 초기화 | 초기화 |
 * | 칭호(정예 포함) · 업적              | 초기화 | 초기화 |
 * | 도감(수집 · 보너스 · 발견 지역)     | 초기화 | 유지 |
 * | 정수 사다리 · 거울 · 남은 정수      | 유지   | 유지 |
 * | 계승 단계 · 회차 규칙 기록          | 유지   | 유지 |
 * | 시즌 · 크리스털 · 영구 가방         | 유지   | 유지 |
 *
 * 계정 장부를 읽는 칭호 · 업적(계승 단계 · 시즌 · 사망 수 · 마왕 처치 · 심연 기록 · 크리스털로 산 칭호)은 지워도 곧바로
 * 다시 달성되므로 남긴다(지우면 죽을 때마다 같은 업적 보상을 받는다). 누적 카운터는 평생 기록으로 남고 여정 범위 진행은
 * 여정 시작 기준점(`stats.currentRun.countersAtStart`)과의 차이로 읽는다.
 */

const NOW = 1_700_000_000_000;
const ELITE_TITLE = 'elite:고요한 숲';
const clone = (value) => structuredClone(value);

const veteran = (overrides = {}) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base,
        name: '초기화 검증', job: '전사', level: 40, hp: 800, maxHp: 800, mp: 200, maxMp: 200, atk: 200, def: 80, gold: 5000,
        storyStatBonus: { atk: 5, def: 12, hp: 100, mp: 0 },
        eventChainProgress: { ancient_seal: 2, boundedEncounterReceipts: { x: 1 } },
        titles: ['first_blood', 'cartographer', 'reborn', '시즌 선구자', '별을 보는 자', 'phoenix', ELITE_TITLE, '에테르 탐험가'],
        activeTitle: ELITE_TITLE,
        premiumCurrency: 77,
        seasonPass: { ...(base.seasonPass || {}), tier: 12, xp: 345 },
        meta: { ...base.meta, prestigeRank: 1, essence: 4321, bonusAtk: 9, endgame: { lastEndgameReceiptKey: 'dk-1' } },
        stats: {
            ...base.stats,
            kills: 900, bossKills: 40, explores: 1200, total_gold: 500_000, escapes: 30, rests: 60, crafts: 12, syntheses: 4,
            relicCount: 22, bountiesCompleted: 7, maxKillStreak: 25, deaths: 12, demonKingSlain: 1, abyssFloor: 11, abyssRecord: 11,
            cosmeticTitles: ['stargazer'],
            claimedQuestIds: [80, 81, 152],
            bountyDate: '2026-10-14', bountyIssued: true,
            visitedMaps: ['시작의 마을', '고요한 숲', '신성한 호수', '버려진 광산'],
            discoveryChains: ['a', 'b', 'c', 'd', 'e'],
            killRegistry: { 슬라임: 40 },
            codex: { ...base.stats.codex, monsters: { 슬라임: true } },
            codexClaimed: ['m1'],
            codexBonusAtk: 3, codexBonusDef: 2, codexBonusHp: 15,
            claimedAchievements: ['ach_first_blood', 'ach_die_1', 'ach_chain_all', 'ach_demon_king'],
            achievedAchievements: ['ach_kill_10'],
            buildWins: { fortress: 9 },
            ruleConquestRuleIds: ['worldtree_pilgrimage'],
        },
        ...overrides,
    };
};

const ascend = (player) => gameReducer(
    { ...clone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: player.meta.prestigeRank, sourceReceiptKey: player.meta.endgame.lastEndgameReceiptKey, seed: 1, challengeModifiers: [] } },
).player;

const die = (player) => CombatEngine.handleDefeat(player, clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;

test('분류 표는 데이터 전수를 덮는다 — 모든 칭호 조건 · 업적 목표가 범위를 가진다', () => {
    for (const title of TITLES) assert.ok(title.cond.type in TITLE_COND_SCOPE, `칭호 ${title.id}의 조건 ${title.cond.type}이 분류되지 않았다`);
    for (const achievement of ACHIEVEMENTS) assert.ok(achievement.target in ACHIEVEMENT_TARGET_SCOPE, `업적 ${achievement.id}의 목표 ${achievement.target}`);
});

for (const [label, reset] of [['사망', die], ['다시 시작', (p) => gameReducer({ ...clone(INITIAL_STATE), player: p }, { type: AT.RESET_GAME }).player], ['계승', ascend]]) {
    const isAscension = label === '계승';
    test(`${label}: 표대로 초기화하고 남긴다`, () => {
        const before = veteran();
        const after = reset(before);
        // 임무 · 이야기 · 체인 · 현상수배 · 이야기 능력치
        assert.deepEqual(after.stats.claimedQuestIds, [], '수령한 임무를 다시 받는다');
        assert.ok(!after.eventChainProgress?.ancient_seal, '체인을 처음부터 다시 한다');
        assert.equal(after.stats.bountyIssued, false);
        assert.equal(after.storyStatBonus, undefined, '이야기 능력치는 남지 않는다');
        // 칭호: 여정 · 정예 · 이야기 보상 칭호는 지우고, 계정 장부 칭호는 남긴다
        for (const gone of ['first_blood', ELITE_TITLE, '에테르 탐험가']) assert.ok(!after.titles.includes(gone), `${gone}`);
        for (const kept of ['reborn', '시즌 선구자', '별을 보는 자', 'phoenix']) assert.ok(after.titles.includes(kept), `${kept}`);
        assert.equal(after.titles.includes('cartographer'), isAscension, '도감 칭호는 계승에서만 남는다');
        assert.notEqual(after.activeTitle, ELITE_TITLE, '지운 칭호는 장착 상태로 남지 않는다');
        // 업적: 계정 장부 업적은 수령 상태가 남고, 여정 업적은 다시 한다
        assert.ok(after.stats.claimedAchievements.includes('ach_die_1'));
        assert.ok(after.stats.claimedAchievements.includes('ach_demon_king'));
        assert.ok(!after.stats.claimedAchievements.includes('ach_first_blood'));
        assert.ok(!(after.stats.achievedAchievements || []).includes('ach_kill_10'));
        assert.equal(after.stats.claimedAchievements.includes('ach_chain_all'), isAscension, '도감 업적은 계승에서만 남는다');
        // 도감
        assert.equal(after.stats.codexBonusHp, isAscension ? 15 : 0);
        assert.equal(Boolean(after.stats.codex?.monsters?.슬라임), isAscension);
        assert.equal(after.stats.visitedMaps.includes('버려진 광산'), isAscension);
        assert.equal(after.stats.discoveryChains.length, isAscension ? 5 : 0);
        // 계정 장부 · 정수 · 크리스털 · 시즌
        assert.equal(after.premiumCurrency, 77);
        assert.equal(after.seasonPass.tier, 12);
        assert.equal(after.stats.deaths >= 12, true);
        assert.equal(after.stats.demonKingSlain, 1);
        assert.equal(after.stats.abyssRecord, 11);
        assert.deepEqual(after.stats.cosmeticTitles, ['stargazer']);
        assert.deepEqual(after.stats.ruleConquestRuleIds, ['worldtree_pilgrimage']);
        assert.ok(after.meta.bonusAtk >= 9, '정수로 올린 영구 공격력은 남는다');
        assert.ok(after.stats.crystalRewardedAchievements.includes('ach_chain_all'), '크리스털을 받은 기록은 계정 장부다');
        // 평생 카운터는 기록으로 남고, 여정 진행은 0부터
        assert.equal(after.stats.kills, 900);
        assert.equal(getJourneyCounter(after.stats, 'kills'), 0);
        assert.equal(getJourneyMaxKillStreak(after.stats), 0);
    });
}

test('새 여정의 업적 · 칭호 · 임무 진행은 여정 기준점에서 센다', () => {
    const fresh = die(veteran());
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ach_kill_10');
    assert.equal(isAchievementUnlocked(achievement, fresh), false, '평생 900처치로 곧바로 다시 달성되지 않는다');
    assert.ok(!checkTitles(fresh).includes('first_blood'), '첫 처치 칭호도 다시 얻어야 한다');
    const killQuest = { type: 'combat_count', target: 'kills', goal: 50 };
    assert.equal(getCumulativeQuestProgress(killQuest, fresh), 0, '다시 받은 처치 임무가 수락 순간 끝나지 않는다');
    const tenKills = { ...fresh, stats: { ...fresh.stats, kills: fresh.stats.kills + 10 } };
    assert.equal(isAchievementUnlocked(achievement, tenKills), true);
    assert.ok(checkTitles(tenKills).includes('first_blood'));
    assert.equal(getCumulativeQuestProgress(killQuest, tenKills), 10);
    const goldQuest = { type: 'gold_earned', target: 'total_gold', goal: 100_000 };
    assert.equal(getCumulativeQuestProgress(goldQuest, fresh), 0, '누적 골드 임무도 이번 여정의 골드다');
});

test('계정 장부 업적은 지워도 다시 달성되는 업적이라 수령 상태가 남는다 — 죽을 때마다 같은 보상을 받지 않는다', () => {
    const fresh = die(veteran());
    const claim = (player, id) => gameReducer({ ...clone(INITIAL_STATE), player }, { type: AT.CLAIM_ACHIEVEMENT_REWARD, payload: { achievementId: id } }).player;
    const again = claim(fresh, 'ach_die_1');
    assert.equal(again.gold, fresh.gold, '이미 받은 사망 업적은 다시 받지 못한다');
});

test('크리스털 보상은 계정당 한 번이다 — 다시 달성한 업적은 골드 · 아이템만 준다', () => {
    const claim = (player, id) => gameReducer({ ...clone(INITIAL_STATE), player }, { type: AT.CLAIM_ACHIEVEMENT_REWARD, payload: { achievementId: id } });
    const first = veteran({ stats: { ...veteran().stats, claimedAchievements: [], crystalRewardedAchievements: [] } });
    const once = claim(first, 'ach_chain_all').player;
    assert.equal(once.premiumCurrency, 77 + 20);
    assert.ok(once.stats.crystalRewardedAchievements.includes('ach_chain_all'));
    // 사망으로 도감 · 업적이 비고, 다시 발견 체인 다섯을 완료했다
    const reborn = die(once);
    const redone = { ...reborn, stats: { ...reborn.stats, discoveryChains: ['a', 'b', 'c', 'd', 'e'] } };
    const result = claim(redone, 'ach_chain_all');
    assert.equal(result.player.premiumCurrency, once.premiumCurrency, '크리스털은 다시 주지 않는다');
    assert.ok(result.player.gold > redone.gold, '골드는 다시 준다');
    assert.ok(result.logs.some((log) => String(log.text).includes('이미 받았습니다')), '이미 받았다고 알린다');
});

test('기준점이 없는 이전 세이브는 평생 값을 읽는다 — 진행 중이던 업적이 0으로 떨어지지 않는다', () => {
    const legacyStats = { ...veteran().stats };
    delete legacyStats.currentRun;
    assert.equal(normalizeCurrentRunProgress(legacyStats).countersAtStart, undefined);
    assert.equal(getJourneyCounter(legacyStats, 'kills'), 900);
    assert.equal(getJourneyMaxKillStreak(legacyStats), 25);
});

test('선별 함수는 초기화 종류를 받는다 — 도감은 계승에서만 넘어간다', () => {
    const player = veteran();
    assert.equal(pickPermanentPlayerState(player, clone(INITIAL_STATE.player), 'ascension').stats.codexBonusAtk, 3);
    assert.equal(pickPermanentPlayerState(player, clone(INITIAL_STATE.player), 'death').stats.codexBonusAtk, 0);
});
