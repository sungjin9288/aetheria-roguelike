import type { Achievement } from '../types/quest';

export type AchievementCategoryId = 'battle' | 'adventure' | 'growth' | 'collection' | 'survival';

export interface AchievementCategory {
    id: AchievementCategoryId;
    label: string;
    targets: string[];
}

export interface AchievementProgress extends Achievement {
    id: string;
    title: string;
    desc: string;
    target: string;
    goal: number;
    current: number;
    rewardText: string;
    unlocked: boolean;
    claimed: boolean;
}

export interface AchievementJourney {
    target: string;
    label: string;
    category: AchievementCategoryId;
    milestones: AchievementProgress[];
    nextMilestone: AchievementProgress;
    claimedCount: number;
    completed: boolean;
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
    {
        id: 'battle',
        label: '전투',
        targets: ['kills', 'bossKills', 'maxKillStreak', 'bountiesCompleted', 'demonKingSlain'],
    },
    {
        id: 'adventure',
        label: '탐험',
        targets: ['explores', 'discoveries', 'discoveryChains', 'relicCount', 'abyssRecord'],
    },
    {
        id: 'growth',
        label: '성장',
        targets: ['level', 'prestige', 'total_gold'],
    },
    {
        id: 'collection',
        label: '수집',
        targets: ['crafts', 'synths', 'signaturesDiscovered', 'signatureSetsCompleted'],
    },
    {
        id: 'survival',
        label: '생존',
        targets: ['deaths', 'escapes', 'rests'],
    },
];

const JOURNEY_LABELS: Record<string, string> = {
    kills: '전투 승리',
    bossKills: '보스 토벌',
    total_gold: '골드 수집',
    level: '레벨 성장',
    deaths: '다시 일어서기',
    explores: '탐험',
    crafts: '제작',
    rests: '휴식',
    bountiesCompleted: '현상수배',
    abyssRecord: '심연 도전',
    relicCount: '유물 수집',
    synths: '합성',
    discoveries: '지역 발견',
    prestige: '계승',
    demonKingSlain: '마왕 토벌',
    signaturesDiscovered: '전설 장비',
    signatureSetsCompleted: '전설 세트',
    escapes: '생존 귀환',
    maxKillStreak: '연속 처치',
    discoveryChains: '발견 여정',
};

const getCategoryForTarget = (target: string): AchievementCategoryId => (
    ACHIEVEMENT_CATEGORIES.find((category) => category.targets.includes(target))?.id || 'growth'
);

export const getAchievementJourneyLabel = (target: string) => JOURNEY_LABELS[target] || '모험 기록';

export const buildAchievementJourneys = (achievements: AchievementProgress[]): AchievementJourney[] => {
    const milestonesByTarget = new Map<string, AchievementProgress[]>();

    for (const achievement of achievements) {
        const milestones = milestonesByTarget.get(achievement.target) || [];
        milestones.push(achievement);
        milestonesByTarget.set(achievement.target, milestones);
    }

    return [...milestonesByTarget.entries()].map(([target, milestones]) => {
        const nextMilestone = milestones.find((milestone) => !milestone.claimed) || milestones[milestones.length - 1];
        const claimedCount = milestones.filter((milestone) => milestone.claimed).length;

        return {
            target,
            label: getAchievementJourneyLabel(target),
            category: getCategoryForTarget(target),
            milestones,
            nextMilestone,
            claimedCount,
            completed: claimedCount === milestones.length,
        };
    });
};

const progressRatio = (achievement: AchievementProgress) => (
    Math.min(achievement.current, achievement.goal) / Math.max(1, achievement.goal)
);

export const getRecommendedAchievementGoals = (
    journeys: AchievementJourney[],
    limit = 3,
): AchievementProgress[] => {
    const categoryCandidates = ACHIEVEMENT_CATEGORIES.map((category) => (
        journeys
            .filter((journey) => journey.category === category.id && !journey.completed)
            .sort((left, right) => {
                const progressDifference = progressRatio(right.nextMilestone) - progressRatio(left.nextMilestone);
                if (progressDifference !== 0) return progressDifference;
                return left.nextMilestone.goal - right.nextMilestone.goal;
            })[0]
    )).filter((journey): journey is AchievementJourney => Boolean(journey));

    return categoryCandidates
        .sort((left, right) => progressRatio(right.nextMilestone) - progressRatio(left.nextMilestone))
        .slice(0, limit)
        .map((journey) => journey.nextMilestone);
};
