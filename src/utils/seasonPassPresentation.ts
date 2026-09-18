import { BALANCE } from '../data/constants';
import {
    FIRST_SEASON,
    getSeasonDef,
    getSeasonRewards,
    parseSeasonOrdinal,
    SEASON_TIER_XP,
    type SeasonDef,
    type SeasonReward,
    type SeasonRewardRow,
} from '../data/seasonPass';
import type { Player, SeasonArchiveEntry } from '../types/player';

/**
 * 세이브에 실린 시즌 상태. 정본은 `types/player.ts`의 `Player['seasonPass']`이고
 * 여기서는 파생만 한다 — 같은 모양을 두 곳에서 손으로 선언하면 드리프트가 생긴다
 * (그 선언은 cycle 299가 private으로 내린 것이라 이름으로 import할 수 없다).
 */
type SeasonPassState = NonNullable<Player['seasonPass']>;

export const SEASON_MAX_TIER = 30;
export const SEASON_MAX_XP = SEASON_MAX_TIER * SEASON_TIER_XP;

export const SEASON_ACTIVITY_SOURCES = [
    { id: 'bossKill', label: '보스 처치', xp: 50 },
    { id: 'questComplete', label: '임무 완료', xp: 30 },
    { id: 'synthesize', label: '합성 성공', xp: 20 },
    { id: 'craft', label: '제작 완료', xp: 15 },
    { id: 'explore', label: '탐험', xp: 10 },
    { id: 'codexDiscover', label: '도감 발견', xp: 8 },
    { id: 'kill', label: '일반 처치', xp: 5 },
] as const;

const SEASON_CHAPTERS = [
    { id: 'opening', title: '여정의 시작', from: 1, to: 10 },
    { id: 'deepening', title: '깊어지는 모험', from: 11, to: 20 },
    { id: 'finale', title: '시즌의 완성', from: 21, to: 30 },
] as const;

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

export const formatSeasonRewardParts = (reward?: SeasonReward | null) => {
    if (!reward) return [];

    return [
        reward.gold ? `골드 ${formatNumber(reward.gold)}` : null,
        reward.premiumCurrency ? `에테르 크리스탈 ${formatNumber(reward.premiumCurrency)}` : null,
        reward.item || null,
        reward.title ? `칭호 ${reward.title}` : null,
    ].filter((part): part is string => Boolean(part));
};

export const formatSeasonReward = (reward?: SeasonReward | null) => (
    formatSeasonRewardParts(reward).join(' · ') || '기록 보상'
);

export const normalizeClaimedSeasonTiers = (claimed: Array<number | string> = []) => {
    const tiers = claimed.flatMap((value) => {
        if (typeof value === 'number') return Number.isInteger(value) ? [value] : [];
        const legacyMatch = value.match(/^(?:s\d+_t)?(\d+)$/i);
        return legacyMatch ? [Number(legacyMatch[1])] : [];
    });

    return [...new Set(tiers.filter((tier) => tier >= 1 && tier <= SEASON_MAX_TIER))];
};

export const getSeasonProgress = (xp = 0, tier = 0) => {
    const rawXp = Math.min(SEASON_MAX_XP, Math.max(0, Number(xp) || 0));
    const storedTier = Math.max(0, Math.floor(Number(tier) || 0));
    const safeTier = Math.min(SEASON_MAX_TIER, Math.max(storedTier, Math.floor(rawXp / SEASON_TIER_XP)));
    const safeXp = Math.max(rawXp, safeTier * SEASON_TIER_XP);
    const completed = safeTier >= SEASON_MAX_TIER;
    const currentXp = completed ? SEASON_TIER_XP : safeXp - (safeTier * SEASON_TIER_XP);
    const remainingXp = completed ? 0 : Math.max(0, SEASON_TIER_XP - currentXp);

    return {
        tier: safeTier,
        totalXp: safeXp,
        currentXp,
        remainingXp,
        completed,
        percent: completed ? 100 : Math.min(100, (currentXp / SEASON_TIER_XP) * 100),
    };
};

export const getClaimableSeasonRewards = (
    rewards: readonly SeasonRewardRow[],
    tier: number,
    claimed: Array<number | string> = [],
) => {
    const claimedTiers = new Set(normalizeClaimedSeasonTiers(claimed));
    return rewards.filter((row) => row.tier <= tier && !claimedTiers.has(row.tier));
};

export const getNextSeasonRewards = (
    rewards: readonly SeasonRewardRow[],
    tier: number,
    count = 3,
) => rewards.filter((row) => row.tier > tier).slice(0, count);

export const buildSeasonChapters = (rewards: readonly SeasonRewardRow[]) => (
    SEASON_CHAPTERS.map((chapter) => ({
        ...chapter,
        rewards: rewards.filter((row) => row.tier >= chapter.from && row.tier <= chapter.to),
    }))
);

// ── 시즌 회전 (2026-09 Wave 12 D2) ───────────────────────────────────────────
//
// 회전 트리거는 **벽시계가 아니라 완주**다. 날짜 기반 시즌은 Wave 11 C2가
// `migrateData`에서 제거한 비결정론을 그대로 되살리고, 진행 중인 플레이어를
// 시즌 경계에서 잘라낸다. 여기서의 완주는 "30티어 보상을 전부 수령했다"이며
// XP 상한 도달이 아니다 — 상한에서 바로 회전시키면 아직 수령하지 않은 보상이
// 통째로 사라지기 때문이다(수령이 곧 지급이다).

/** 세이브에 없던 선택 필드를 매번 새로 만들지 않고 읽는 쪽에서 채운다. */
export const createSeasonPassState = (): SeasonPassState => ({
    xp: 0,
    tier: 0,
    claimed: [],
    isPremium: false,
    seasonId: FIRST_SEASON.id,
});

/** 현재 시즌 서수 — `ordinal`이 없으면 `seasonId`에서, 그것도 없으면 시즌 1. */
export const resolveSeasonOrdinal = (season?: SeasonPassState | null): number => {
    const stored = Number(season?.ordinal);
    if (Number.isInteger(stored) && stored >= 1) return stored;
    return parseSeasonOrdinal(season?.seasonId) ?? FIRST_SEASON.ordinal;
};

/** 현재 시즌 정의 (식별자 · 서수 · 보상 배율). */
export const getActiveSeason = (season?: SeasonPassState | null): SeasonDef => (
    getSeasonDef(resolveSeasonOrdinal(season))
);

/** 다음 시즌 정의 — 완주가 열어줄 시즌. */
export const getUpcomingSeason = (season?: SeasonPassState | null): SeasonDef => (
    getSeasonDef(resolveSeasonOrdinal(season) + 1)
);

/** 현재 시즌의 보상 테이블 (시즌 1이면 `SEASON_REWARDS` 그대로). */
export const getActiveSeasonRewards = (season?: SeasonPassState | null): readonly SeasonRewardRow[] => (
    getSeasonRewards(resolveSeasonOrdinal(season))
);

/**
 * 보관 중인 직전 시즌 기록. 세이브에서 그대로 올라오는 값이므로 모양을 신뢰하지 않고,
 * 읽는 시점에 온전한 항목만 통과시킨다(손상된 세이브 → 빈 목록). 이 경계 하나가
 * UI·리듀서 양쪽의 `entry.claimed.length` 같은 접근을 안전하게 만든다.
 */
export const getSeasonArchive = (season?: SeasonPassState | null): SeasonArchiveEntry[] => (
    Array.isArray(season?.archive)
        ? season.archive.filter((entry): entry is SeasonArchiveEntry => (
            Boolean(entry) && typeof entry === 'object' && Array.isArray(entry.claimed)
        ))
        : []
);

/** 완주한 시즌 수 — 기록이 잘려도 감소하지 않도록 별도 누적값을 우선한다. */
export const getCompletedSeasonCount = (season?: SeasonPassState | null): number => {
    const stored = Number(season?.completedSeasons);
    const archived = getSeasonArchive(season).length;
    return Math.max(archived, Number.isFinite(stored) ? Math.max(0, Math.floor(stored)) : 0);
};

/** 완주까지 남은 수령 수 (0이면 이번 수령으로 시즌이 끝난다). */
export const getSeasonClaimsRemaining = (season?: SeasonPassState | null): number => (
    Math.max(0, SEASON_MAX_TIER - normalizeClaimedSeasonTiers(season?.claimed).length)
);

/** 완주 판정 — 30티어 보상을 전부 수령했는가. */
export const isSeasonComplete = (season?: SeasonPassState | null): boolean => (
    getSeasonClaimsRemaining(season) === 0
);

/**
 * 완주했으면 다음 시즌 상태를, 아니면 `null`을 돌려준다.
 * `xp`/`tier`/`claimed`만 리셋하고 `isPremium`과 그 밖의 필드는 보존하며,
 * 비우기 전의 수령 기록은 `archive`에 옮긴다.
 */
export const advanceSeasonIfComplete = (season?: SeasonPassState | null): SeasonPassState | null => {
    if (!isSeasonComplete(season)) return null;

    const current = getActiveSeason(season);
    const next = getSeasonDef(current.ordinal + 1);
    const progress = getSeasonProgress(season?.xp, season?.tier);
    const entry: SeasonArchiveEntry = {
        seasonId: current.id,
        ordinal: current.ordinal,
        tier: progress.tier,
        xp: progress.totalXp,
        claimed: normalizeClaimedSeasonTiers(season?.claimed),
    };

    return {
        ...(season || {}),
        seasonId: next.id,
        ordinal: next.ordinal,
        xp: 0,
        tier: 0,
        claimed: [],
        completedSeasons: getCompletedSeasonCount(season) + 1,
        archive: [...getSeasonArchive(season), entry].slice(-BALANCE.SEASON_ARCHIVE_LIMIT),
    };
};

/** 시즌 배율 표기용 — `formatSeasonReward`와 같은 자리에 두는 순수 포매터. */
export const formatSeasonScale = (scale: number): string => (
    Number.isInteger(scale) ? `${scale}` : scale.toFixed(2).replace(/0$/, '')
);
