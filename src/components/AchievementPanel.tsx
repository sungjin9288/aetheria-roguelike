import { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
    Anvil,
    ChevronDown,
    CircleCheck,
    Coins,
    Compass,
    Crown,
    Flame,
    Footprints,
    Gift,
    Hammer,
    Link2,
    LockKeyhole,
    RefreshCcw,
    Shield,
    Skull,
    Sparkles,
    Star,
    Swords,
    Target,
    Trophy,
} from 'lucide-react';
import { DB } from '../data/db';
import type { Player } from '../types/index.js';
import {
    ACHIEVEMENT_CATEGORIES,
    buildAchievementJourneys,
    getRecommendedAchievementGoals,
    type AchievementCategoryId,
    type AchievementProgress,
} from '../utils/achievementPresentation';
import { formatRewardParts, getAchievementCurrentValue, isAchievementUnlocked } from '../utils/gameUtils';

interface AchievementActions {
    claimAchievement?: (achievementId: string) => void;
}

interface AchievementPanelProps {
    player: Player;
    actions?: AchievementActions;
}

const CATEGORY_PRESENTATION = {
    battle: { icon: Swords, iconTone: 'text-rose-200', progress: 'bg-rose-300/85' },
    adventure: { icon: Compass, iconTone: 'text-emerald-200', progress: 'bg-emerald-300/85' },
    growth: { icon: Star, iconTone: 'text-[#f6e7c8]', progress: 'bg-[#d5b180]' },
    collection: { icon: Anvil, iconTone: 'text-violet-200', progress: 'bg-violet-300/85' },
    survival: { icon: Shield, iconTone: 'text-sky-200', progress: 'bg-sky-300/85' },
} as const;

const TARGET_ICONS: Record<string, typeof Trophy> = {
    kills: Swords,
    bossKills: Trophy,
    total_gold: Coins,
    level: Star,
    deaths: Skull,
    explores: Compass,
    crafts: Hammer,
    rests: Shield,
    bountiesCompleted: Target,
    abyssRecord: Crown,
    relicCount: Sparkles,
    synths: Anvil,
    discoveries: Compass,
    prestige: RefreshCcw,
    demonKingSlain: Trophy,
    signaturesDiscovered: Sparkles,
    signatureSetsCompleted: Crown,
    escapes: Footprints,
    maxKillStreak: Flame,
    discoveryChains: Link2,
};

const AchievementProgressBar = ({ achievement, tone }: { achievement: AchievementProgress; tone: string }) => {
    const value = Math.min(achievement.current, achievement.goal);
    const ratio = Math.min(100, (value / Math.max(1, achievement.goal)) * 100);

    return (
        <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ratio}%` }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className={`h-full rounded-full ${tone}`}
                />
            </div>
            <span className="aether-type-meta shrink-0 font-readable text-slate-300">
                {value}/{achievement.goal}
            </span>
        </div>
    );
};

const RewardText = ({ children }: { children: string }) => (
    <div className="aether-type-meta mt-1 font-readable text-[#d5b180]">
        보상 · {children || '기록 달성'}
    </div>
);

const AchievementPanel = ({ player, actions }: AchievementPanelProps) => {
    const [category, setCategory] = useState<AchievementCategoryId>('battle');

    const achievements = useMemo<AchievementProgress[]>(() => {
        const claimed = player.stats?.claimedAchievements || [];

        return DB.ACHIEVEMENTS.map((achievement) => ({
            ...achievement,
            id: achievement.id || '',
            title: achievement.title || '이름 없는 업적',
            desc: achievement.desc || '모험 기록을 달성하세요.',
            target: achievement.target || 'level',
            goal: achievement.goal || 1,
            current: getAchievementCurrentValue(achievement, player),
            rewardText: formatRewardParts(achievement.reward || {}).join(' · '),
            unlocked: isAchievementUnlocked(achievement, player),
            claimed: claimed.includes(achievement.id || ''),
        }));
    }, [player]);

    const journeys = useMemo(() => buildAchievementJourneys(achievements), [achievements]);
    const recommendedGoals = useMemo(() => getRecommendedAchievementGoals(journeys), [journeys]);
    const activeJourneys = journeys.filter((journey) => journey.category === category);
    const claimable = achievements.filter((achievement) => achievement.unlocked && !achievement.claimed);
    const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
    const claimedCount = achievements.filter((achievement) => achievement.claimed).length;
    const completionRatio = (unlockedCount / Math.max(1, achievements.length)) * 100;

    const claim = (achievement: AchievementProgress) => {
        if (achievement.claimed || !achievement.unlocked) return;
        actions?.claimAchievement?.(achievement.id);
    };

    return (
        <div data-testid="achievement-panel" className="font-readable">
            <header data-testid="achievement-summary" className="border-b border-white/10 pb-4">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#d5b180]/24 bg-[#d5b180]/10">
                        <Trophy size={20} className="text-[#f6e7c8]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="aether-type-title font-semibold text-slate-100">업적</h2>
                        <p className="aether-type-body mt-0.5 text-slate-400/76">
                            달성 {unlockedCount}/{achievements.length} · 보상 수령 {claimedCount}/{achievements.length}
                        </p>
                    </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <Motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completionRatio}%` }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                        className="h-full rounded-full bg-[linear-gradient(90deg,#d5b180_0%,#7dd4d8_100%)]"
                    />
                </div>
            </header>

            {claimable.length > 0 && (
                <section data-testid="achievement-claimable" className="border-b border-[#d5b180]/20 py-4">
                    <div className="flex items-center gap-2">
                        <Gift size={16} className="text-[#f6e7c8]" />
                        <h3 className="aether-type-title font-semibold text-slate-100">받을 보상</h3>
                        <span className="aether-type-meta text-[#d5b180]">{claimable.length}개</span>
                    </div>
                    <div className="mt-2 divide-y divide-white/8">
                        {claimable.map((achievement) => (
                            <div key={achievement.id} className="flex min-h-14 items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-semibold text-slate-100">{achievement.title}</div>
                                    <RewardText>{achievement.rewardText}</RewardText>
                                </div>
                                <button
                                    type="button"
                                    data-testid={`achievement-claim-${achievement.id}`}
                                    onClick={() => claim(achievement)}
                                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#d5b180]/32 bg-[#d5b180]/12 px-3 font-readable text-sm font-semibold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/18"
                                >
                                    <Gift size={15} />
                                    받기
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="achievement-next-goals" className="border-b border-white/10 py-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="aether-type-title font-semibold text-slate-100">다음 목표</h3>
                    <span className="aether-type-meta text-slate-400/76">가장 가까운 기록</span>
                </div>
                <div className="mt-2 divide-y divide-white/8">
                    {recommendedGoals.map((achievement) => {
                        const journey = journeys.find((entry) => entry.target === achievement.target);
                        const theme = CATEGORY_PRESENTATION[journey?.category || 'growth'];
                        const Icon = TARGET_ICONS[achievement.target] || Trophy;

                        return (
                            <div
                                key={achievement.id}
                                data-testid={`achievement-next-goal-${achievement.id}`}
                                className="flex min-h-[76px] items-start gap-3 py-2.5"
                            >
                                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                                    <Icon size={17} className={theme.iconTone} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body truncate font-semibold text-slate-100">{achievement.title}</div>
                                    <div className="aether-type-meta mt-0.5 text-slate-300/76">{achievement.desc}</div>
                                    <AchievementProgressBar achievement={achievement} tone={theme.progress} />
                                    <RewardText>{achievement.rewardText}</RewardText>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="pt-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="aether-type-title font-semibold text-slate-100">업적 여정</h3>
                    <span className="aether-type-meta text-slate-400/76">단계를 눌러 전체 기록 보기</span>
                </div>

                <div role="tablist" aria-label="업적 분야" className="mt-3 grid grid-cols-5 gap-1">
                    {ACHIEVEMENT_CATEGORIES.map((entry) => {
                        const active = category === entry.id;
                        const theme = CATEGORY_PRESENTATION[entry.id];
                        const Icon = theme.icon;

                        return (
                            <button
                                key={entry.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                data-testid={`achievement-category-${entry.id}`}
                                onClick={() => setCategory(entry.id)}
                                className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg border px-1 text-sm font-semibold transition-colors ${
                                    active
                                        ? 'border-[#7dd4d8]/38 bg-[#7dd4d8]/12 text-slate-100'
                                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Icon size={15} className={active ? theme.iconTone : 'text-slate-500'} />
                                {entry.label}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-2 divide-y divide-white/10 border-y border-white/10">
                    {activeJourneys.map((journey) => {
                        const achievement = journey.nextMilestone;
                        const theme = CATEGORY_PRESENTATION[journey.category];
                        const Icon = TARGET_ICONS[journey.target] || Trophy;

                        return (
                            <details key={journey.target} data-testid={`achievement-journey-${journey.target}`} className="group">
                                <summary className="flex min-h-[78px] cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                                        <Icon size={17} className={theme.iconTone} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <div className="aether-type-body font-semibold text-slate-100">{journey.label}</div>
                                            <span className="aether-type-meta shrink-0 text-slate-400/76">
                                                {journey.claimedCount}/{journey.milestones.length} 단계
                                            </span>
                                        </div>
                                        <div className="aether-type-meta mt-0.5 truncate text-slate-300/76">
                                            {journey.completed ? '모든 기록 완료' : `다음 · ${achievement.title}`}
                                        </div>
                                        {!journey.completed && <AchievementProgressBar achievement={achievement} tone={theme.progress} />}
                                    </div>
                                    <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                                </summary>

                                <div className="border-t border-white/8 pb-2 pl-12">
                                    {journey.milestones.map((milestone) => (
                                        <div
                                            key={milestone.id}
                                            data-testid={`achievement-milestone-${milestone.id}`}
                                            className="border-b border-white/8 py-3 last:border-b-0"
                                        >
                                            <div className="flex items-start gap-2.5">
                                                {milestone.claimed ? (
                                                    <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-200" />
                                                ) : milestone.unlocked ? (
                                                    <Gift size={16} className="mt-0.5 shrink-0 text-[#f6e7c8]" />
                                                ) : (
                                                    <LockKeyhole size={15} className="mt-0.5 shrink-0 text-slate-500" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                        <div className="aether-type-body font-semibold text-slate-100">{milestone.title}</div>
                                                        <span className="aether-type-meta text-slate-400/76">
                                                            {milestone.claimed ? '보상 수령 완료' : `${Math.min(milestone.current, milestone.goal)}/${milestone.goal}`}
                                                        </span>
                                                    </div>
                                                    <div className="aether-type-meta mt-0.5 text-slate-300/76">{milestone.desc}</div>
                                                    <RewardText>{milestone.rewardText}</RewardText>
                                                </div>
                                            </div>
                                            {milestone.unlocked && !milestone.claimed && (
                                                <button
                                                    type="button"
                                                    data-testid={`achievement-claim-detail-${milestone.id}`}
                                                    onClick={() => claim(milestone)}
                                                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[#d5b180]/32 bg-[#d5b180]/12 px-3 text-sm font-semibold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/18"
                                                >
                                                    <Gift size={15} />
                                                    보상 받기
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default AchievementPanel;
