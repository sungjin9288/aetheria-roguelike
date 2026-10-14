import type { Player } from '../types/player';
import { normalizeClassJourneyLedger } from './classJourney';
import { normalizeReturnSupplyRewardLedger } from './returnSupplyReward';
import { collectAchievedAchievementIds } from './achievementProgress';
import { ACHIEVEMENTS } from '../data/quests';
import { TITLES } from '../data/titles';
import {
    ACHIEVEMENT_TARGET_SCOPE,
    getTitleScope,
    isScopeKeptOn,
    type JourneyResetKind,
} from './journeyScope';

const clone = <T>(value: T): T => {
    if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([key, entry]) => [key, clone(entry)]),
        ) as T;
    }
    return value;
};

const numberOrZero = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const TITLE_COND_TYPE_BY_ID: ReadonlyMap<string, string> = new Map(TITLES.map((title) => [title.id, title.cond.type]));
const ACHIEVEMENT_SCOPE_BY_ID: ReadonlyMap<string, keyof typeof ACHIEVEMENT_TARGET_SCOPE | undefined> = new Map(
    ACHIEVEMENTS.flatMap((achievement) => (achievement.id ? [[achievement.id, achievement.target] as const] : [])),
);
const CRYSTAL_ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(
    ACHIEVEMENTS.filter((achievement) => Number(achievement.reward?.premiumCurrency) > 0).flatMap((achievement) => (achievement.id ? [achievement.id] : [])),
);

const readIdList = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
);

/** 남는 칭호 — 계정 장부 칭호(계승 단계 · 시즌 · 회차 규칙 · 크리스털로 산 칭호 …)와 계승이면 도감 칭호. */
const pickKeptTitles = (titles: unknown, kind: JourneyResetKind): string[] => (
    [...new Set(readIdList(titles))].filter((id) => isScopeKeptOn(getTitleScope(id, TITLE_COND_TYPE_BY_ID), kind))
);

/** 남는 업적 id — 모르는 id(카탈로그에서 빠진 업적)는 여정 범위다. */
const filterAchievementIdsKeptOn = (ids: unknown, kind: JourneyResetKind): string[] => (
    [...new Set(readIdList(ids))].filter((id) => {
        const target = ACHIEVEMENT_SCOPE_BY_ID.get(id);
        return Boolean(target) && isScopeKeptOn(ACHIEVEMENT_TARGET_SCOPE[target as keyof typeof ACHIEVEMENT_TARGET_SCOPE], kind);
    })
);

/** 크리스털을 이미 받은 업적 — 기록 + 지금까지 수령한 크리스털 업적(장부가 생기기 전 세이브의 수령분). */
export const collectCrystalRewardedAchievementIds = (stats: Player['stats'] | null | undefined): string[] => (
    [...new Set([
        ...readIdList(stats?.crystalRewardedAchievements),
        ...readIdList(stats?.claimedAchievements).filter((id) => CRYSTAL_ACHIEVEMENT_IDS.has(id)),
    ])]
);

export const pickPermanentPlayerState = (
    player: Player,
    initialPlayer: Player,
    kind: JourneyResetKind,
): Partial<Player> => {
    const stats = player.stats || {};
    const initialStats = initialPlayer.stats || {};
    // 2026-10 Wave 108 (소유자 결정 "죽으면 모든 게 초기화 — 정수로 올린 것만 남는다 · 계승은 도감을 남긴다"):
    //   이야기 능력치 보상 · 임무 · 이야기 · 체인 · 현상수배 · 칭호 · 업적은 사망 · 계승 모두 새로 시작한다(Wave 72의 이야기
    //   능력치 영구 전환과 Wave 14 F2의 체인 이월을 대체한다). 도감(수집 · 발견)은 계승에서만 남는다. 무엇이 남는지는
    //   `utils/journeyScope.ts`의 표가 소유한다.
    const keepCodex = isScopeKeptOn('codex', kind);
    const titles = pickKeptTitles(player.titles, kind);
    const activeTitle = player.activeTitle && titles.includes(player.activeTitle) ? player.activeTitle : null;
    return {
        meta: clone({ ...(initialPlayer.meta || {}), ...(player.meta || {}) }),
        achievements: [],
        titles,
        activeTitle,
        premiumCurrency: Math.max(0, numberOrZero(player.premiumCurrency)),
        reviveTokens: Math.max(0, numberOrZero(player.reviveTokens)),
        ...(player.maxInv !== undefined
            ? { maxInv: Math.max(20, numberOrZero(player.maxInv) || 20) }
            : {}),
        // 2026-09 Wave 12 D2: 시즌 상태는 환생/사망을 넘어 그대로 이어진다 — 시즌은
        //   런(run)이 아니라 계정 단위 사다리이기 때문이다. 회전이 생긴 뒤로는
        //   `archive`/`completedSeasons`도 같은 clone에 실려 넘어가므로, 완주 기록이
        //   승천으로 사라지지 않는다(tests/permanent-progress-copy.test.js가 고정).
        //   구세이브 호환을 위해 **여기서 정규화하지 않는다** — 없는 선택 필드는
        //   읽는 쪽이 채운다(`resolveSeasonOrdinal`).
        seasonPass: clone(player.seasonPass || initialPlayer.seasonPass),
        weeklyProtocol: clone(player.weeklyProtocol || initialPlayer.weeklyProtocol),
        settings: clone(player.settings || initialPlayer.settings),
        classJourney: normalizeClassJourneyLedger(player.classJourney),
        expeditionSequence: Number.isSafeInteger(player.expeditionSequence)
            ? player.expeditionSequence
            : 0,
        returnSupplyRewards: normalizeReturnSupplyRewardLedger(player.returnSupplyRewards),
        stats: {
            ...clone(initialStats),
            kills: numberOrZero(stats.kills),
            bossKills: numberOrZero(stats.bossKills),
            deaths: numberOrZero(stats.deaths),
            total_gold: numberOrZero(stats.total_gold),
            relicCount: numberOrZero(stats.relicCount),
            abyssFloor: numberOrZero(stats.abyssFloor),
            abyssRecord: numberOrZero(stats.abyssRecord),
            escapes: numberOrZero(stats.escapes),
            syntheses: numberOrZero(stats.syntheses),
            maxKillStreak: numberOrZero(stats.maxKillStreak),
            explores: numberOrZero(stats.explores),
            exploresByLocation: clone(
                stats.exploresByLocation && typeof stats.exploresByLocation === 'object'
                    ? stats.exploresByLocation
                    : {},
            ),
            rests: numberOrZero(stats.rests),
            crafts: numberOrZero(stats.crafts),
            bountiesCompleted: numberOrZero(stats.bountiesCompleted),
            demonKingSlain: numberOrZero(stats.demonKingSlain),
            visitedMaps: clone(keepCodex && Array.isArray(stats.visitedMaps) ? stats.visitedMaps : initialStats.visitedMaps),
            discoveryChains: clone(keepCodex && Array.isArray(stats.discoveryChains) ? stats.discoveryChains : []),
            killRegistry: clone(
                keepCodex && stats.killRegistry && typeof stats.killRegistry === 'object'
                    ? stats.killRegistry
                    : {},
            ),
            // 2026-10 Wave 108: 빌드 승리 기록은 빌드 임무만 읽는 여정 기록이라 넘기지 않는다.
            codex: clone(keepCodex ? stats.codex || initialStats.codex : initialStats.codex),
            codexClaimed: clone(keepCodex && Array.isArray(stats.codexClaimed) ? stats.codexClaimed : []),
            cosmeticTitles: clone(Array.isArray(stats.cosmeticTitles) ? stats.cosmeticTitles : []),
            synthProtects: numberOrZero(stats.synthProtects),
            // 2026-10 Wave 108: 업적은 목표의 초기화 범위를 따른다 — 계정 장부(계승 단계 · 마왕 처치 · 사망 수 · 심연 기록)를
            //   읽는 업적은 지워도 곧바로 다시 달성되므로 수령 · 달성 기록을 남기고, 여정 · 도감 업적은 다시 한다.
            claimedAchievements: filterAchievementIdsKeptOn(stats.claimedAchievements, kind),
            // 2026-10 Wave 58: 달성했지만 수령하지 않은 업적을 남긴다 — 이 선별이 계승 · 사망 재시작 · 다시 시작의 공통 지점이다.
            achievedAchievements: filterAchievementIdsKeptOn(collectAchievedAchievementIds(player), kind),
            // 2026-10 Wave 108 (소유자 결정 "영구 보상은 처음 한 번만"): 크리스털처럼 초기화를 넘어 남는 업적 보상은 계정당
            //   한 번이다 — 다시 달성한 업적은 크리스털 없이 수령한다. 장부가 없던 세이브는 지금까지 수령한 업적으로 채운다.
            crystalRewardedAchievements: collectCrystalRewardedAchievementIds(stats),
            // 2026-10 Wave 89: 회차 규칙 정복 기록 — 계정 단위(정복 보상은 단계마다 한 번).
            ruleConquestRanks: clone(Array.isArray(stats.ruleConquestRanks) ? stats.ruleConquestRanks : []),
            // 2026-10 Wave 94: 정복한 규칙 id(없으면 이전 세이브 — 읽는 쪽이 단계를 고정 순서로 읽는다).
            ...(Array.isArray(stats.ruleConquestRuleIds) ? { ruleConquestRuleIds: clone(stats.ruleConquestRuleIds) } : {}),
            // 2026-10 Wave 107: 거절하고 지나간 규칙 — 계정 단위(덱이 순환을 센다).
            ...(Array.isArray(stats.ruleDeclinePassIds) ? { ruleDeclinePassIds: clone(stats.ruleDeclinePassIds) } : {}),
            // 2026-10 Wave 108: 임무 · 이야기 수령 기록 · 현상수배 발급 기록은 여정 범위다(수령한 임무를 다시 받는다).
            codexBonusAtk: keepCodex ? numberOrZero(stats.codexBonusAtk) : 0,
            codexBonusDef: keepCodex ? numberOrZero(stats.codexBonusDef) : 0,
            codexBonusHp: keepCodex ? numberOrZero(stats.codexBonusHp) : 0,
            signaturePity: numberOrZero(stats.signaturePity),
            dailyProtocol: clone(stats.dailyProtocol ?? null),
            dailyInvadeCount: numberOrZero(stats.dailyInvadeCount),
            lastInvadeDate: stats.lastInvadeDate ?? null,
            abyssDailyDive: clone(stats.abyssDailyDive ?? null),
            lastSeenAt: stats.lastSeenAt ?? null,
        },
    };
};
