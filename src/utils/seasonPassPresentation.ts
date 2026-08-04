import { SEASON_TIER_XP, type SeasonReward, type SeasonRewardRow } from '../data/seasonPass';

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

export const SEASON_CHAPTERS = [
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
