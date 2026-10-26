import { useMemo, useState } from 'react';
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
import { MSG } from '../data/messages';
import ActionButton from './ui/ActionButton';
import Gauge, { type GaugeKind } from './ui/Gauge';

interface AchievementActions {
    claimAchievement?: (achievementId: string) => void;
}

interface AchievementPanelProps {
    player: Player;
    actions?: AchievementActions;
}

/** 분야마다 아이콘 · 글자 색 · 게이지 색(토큰만). */
const CATEGORY_PRESENTATION = {
    battle: { icon: Swords, iconTone: 'text-ae-life', gauge: { kind: 'life', className: '' } },
    adventure: { icon: Compass, iconTone: 'text-ae-good', gauge: { kind: 'ether', className: 'ab-gauge-good' } },
    growth: { icon: Star, iconTone: 'text-ae-gold-text', gauge: { kind: 'ether', className: 'ab-gauge-gold' } },
    collection: { icon: Anvil, iconTone: 'text-ae-exp', gauge: { kind: 'exp', className: '' } },
    survival: { icon: Shield, iconTone: 'text-ae-will', gauge: { kind: 'will', className: '' } },
} as const satisfies Record<AchievementCategoryId, { icon: typeof Trophy; iconTone: string; gauge: { kind: GaugeKind; className: string } }>;

type CategoryTheme = (typeof CATEGORY_PRESENTATION)[AchievementCategoryId];

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

const AchievementProgressBar = ({ achievement, theme }: { achievement: AchievementProgress; theme: CategoryTheme }) => {
    const value = Math.min(achievement.current, achievement.goal);

    return (
        <div className="mt-2 flex items-center gap-2.5">
            <Gauge
                kind={theme.gauge.kind}
                value={value}
                max={Math.max(1, achievement.goal)}
                label={achievement.title}
                className={`ab-gauge-thin min-w-0 flex-1 ${theme.gauge.className}`}
            />
            <span className="aether-type-meta shrink-0 font-fira tabular-nums text-ae-ink-2">
                {value}/{achievement.goal}
            </span>
        </div>
    );
};

const RewardText = ({ children }: { children: string }) => (
    <div className="aether-type-meta mt-1 font-readable text-ae-gold-text">
        {MSG.ACHIEVEMENT_PANEL_REWARD(children || MSG.ACHIEVEMENT_PANEL_REWARD_NONE)}
    </div>
);

const AchievementPanel = ({ player, actions }: AchievementPanelProps) => {
    const [category, setCategory] = useState<AchievementCategoryId>('battle');

    const achievements = useMemo<AchievementProgress[]>(() => {
        const claimed = player.stats?.claimedAchievements || [];

        return DB.ACHIEVEMENTS.map((achievement) => ({
            ...achievement,
            id: achievement.id || '',
            title: achievement.title || MSG.ACHIEVEMENT_PANEL_UNTITLED,
            desc: achievement.desc || MSG.ACHIEVEMENT_PANEL_UNTITLED_DESC,
            target: achievement.target || 'level',
            goal: achievement.goal || 1,
            current: getAchievementCurrentValue(achievement, player),
            // 2026-10 Wave 62 (원장 §61.4 C16): 골드는 실제로 받는 금액이다('빈손의 시작'이면 절반) — 수령과 같은 규칙.
            rewardText: formatRewardParts(achievement.reward || {}, player).join(' · '),
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

    const claim = (achievement: AchievementProgress) => {
        if (achievement.claimed || !achievement.unlocked) return;
        actions?.claimAchievement?.(achievement.id);
    };

    return (
        <div data-testid="achievement-panel" className="ab-stack font-readable">
            <header data-testid="achievement-summary" className="ae-card ab-card-pad">
                <div className="flex items-start gap-3">
                    <span className="ab-icon-well is-gold" aria-hidden="true"><Trophy size={18} /></span>
                    <div className="min-w-0 flex-1">
                        <h2 className="ab-section-title">{MSG.ACHIEVEMENT_PANEL_TITLE}</h2>
                        <p className="aether-type-body mt-0.5 text-ae-ink-2">
                            {MSG.ACHIEVEMENT_PANEL_SUMMARY(unlockedCount, claimedCount, achievements.length)}
                        </p>
                    </div>
                </div>
                <Gauge
                    kind="ether"
                    value={unlockedCount}
                    max={Math.max(1, achievements.length)}
                    label={MSG.ACHIEVEMENT_PANEL_TITLE}
                    className="mt-3"
                />
            </header>

            {claimable.length > 0 && (
                <section data-testid="achievement-claimable" className="ab-mission ab-card-pad">
                    <div className="flex items-center gap-2">
                        <Gift size={16} className="text-ae-gold-text" aria-hidden="true" />
                        <h3 className="aether-type-strong text-ae-ink">{MSG.ACHIEVEMENT_PANEL_CLAIMABLE_TITLE}</h3>
                        <span className="ab-count is-gold">{MSG.ACHIEVEMENT_PANEL_COUNT(claimable.length)}</span>
                    </div>
                    <div className="ab-rows mt-2">
                        {claimable.map((achievement) => (
                            <div key={achievement.id} className="flex min-h-14 flex-wrap items-center gap-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-bold text-ae-ink">{achievement.title}</div>
                                    <RewardText>{achievement.rewardText}</RewardText>
                                </div>
                                <ActionButton
                                    variant="glass"
                                    data-testid={`achievement-claim-${achievement.id}`}
                                    icon={<Gift size={16} />}
                                    label={MSG.ACHIEVEMENT_PANEL_CLAIM}
                                    onClick={() => claim(achievement)}
                                    className="shrink-0"
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="achievement-next-goals" className="ae-card ab-card-pad">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="aether-type-strong text-ae-ink">{MSG.ACHIEVEMENT_PANEL_NEXT_TITLE}</h3>
                    <span className="aether-type-meta text-ae-ink-3">{MSG.ACHIEVEMENT_PANEL_NEXT_HINT}</span>
                </div>
                <div className="ab-rows mt-1">
                    {recommendedGoals.map((achievement) => {
                        const journey = journeys.find((entry) => entry.target === achievement.target);
                        const theme = CATEGORY_PRESENTATION[journey?.category || 'growth'];
                        const Icon = TARGET_ICONS[achievement.target] || Trophy;

                        return (
                            <div
                                key={achievement.id}
                                data-testid={`achievement-next-goal-${achievement.id}`}
                                className="flex items-start gap-3 py-2.5"
                            >
                                <span className={`ab-icon-well mt-0.5 ${theme.iconTone}`} aria-hidden="true"><Icon size={17} /></span>
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-bold text-ae-ink">{achievement.title}</div>
                                    <div className="aether-type-meta mt-0.5 text-ae-ink-2">{achievement.desc}</div>
                                    <AchievementProgressBar achievement={achievement} theme={theme} />
                                    <RewardText>{achievement.rewardText}</RewardText>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="ae-card is-quiet ab-card-pad">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="aether-type-strong text-ae-ink">{MSG.ACHIEVEMENT_PANEL_JOURNEY_TITLE}</h3>
                    <span className="aether-type-meta text-ae-ink-3">{MSG.ACHIEVEMENT_PANEL_JOURNEY_HINT}</span>
                </div>

                <div role="tablist" aria-label={MSG.ACHIEVEMENT_PANEL_CATEGORY_ARIA} className="ab-rail mt-3 grid-cols-5">
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
                                className="ab-rail-tab min-w-0 px-1"
                            >
                                <Icon size={16} aria-hidden="true" className={active ? theme.iconTone : ''} />
                                {entry.label}
                            </button>
                        );
                    })}
                </div>

                <div className="ab-rows mt-2">
                    {activeJourneys.map((journey) => {
                        const achievement = journey.nextMilestone;
                        const theme = CATEGORY_PRESENTATION[journey.category];
                        const Icon = TARGET_ICONS[journey.target] || Trophy;

                        return (
                            <details key={journey.target} data-testid={`achievement-journey-${journey.target}`}>
                                <summary className="ab-summary min-h-[4.5rem] py-3">
                                    <span className={`ab-icon-well ${theme.iconTone}`} aria-hidden="true"><Icon size={17} /></span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                            <div className="aether-type-body font-bold text-ae-ink">{journey.label}</div>
                                            <span className="aether-type-meta shrink-0 font-fira tabular-nums text-ae-ink-3">
                                                {MSG.ACHIEVEMENT_PANEL_STEPS(journey.claimedCount, journey.milestones.length)}
                                            </span>
                                        </div>
                                        <div className="aether-type-meta mt-0.5 text-ae-ink-2">
                                            {journey.completed ? MSG.ACHIEVEMENT_PANEL_ALL_DONE : MSG.ACHIEVEMENT_PANEL_NEXT_MILESTONE(achievement.title)}
                                        </div>
                                        {!journey.completed && <AchievementProgressBar achievement={achievement} theme={theme} />}
                                    </div>
                                    <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                                </summary>

                                <ol className="ab-rows mb-2 ml-12 border-t border-ae-ink/7">
                                    {journey.milestones.map((milestone) => (
                                        <li
                                            key={milestone.id}
                                            data-testid={`achievement-milestone-${milestone.id}`}
                                            className="py-3"
                                        >
                                            <div className="flex items-start gap-2.5">
                                                {milestone.claimed ? (
                                                    <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-good" />
                                                ) : milestone.unlocked ? (
                                                    <Gift size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-gold-text" />
                                                ) : (
                                                    <LockKeyhole size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-ink-3" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                        <div className="aether-type-body font-bold text-ae-ink">{milestone.title}</div>
                                                        <span className={`aether-type-meta ${milestone.claimed ? 'text-ae-good' : 'font-fira tabular-nums text-ae-ink-3'}`}>
                                                            {milestone.claimed ? MSG.ACHIEVEMENT_PANEL_CLAIMED : `${Math.min(milestone.current, milestone.goal)}/${milestone.goal}`}
                                                        </span>
                                                    </div>
                                                    <div className="aether-type-meta mt-0.5 text-ae-ink-2">{milestone.desc}</div>
                                                    <RewardText>{milestone.rewardText}</RewardText>
                                                </div>
                                            </div>
                                            {milestone.unlocked && !milestone.claimed && (
                                                <ActionButton
                                                    variant="glass"
                                                    data-testid={`achievement-claim-detail-${milestone.id}`}
                                                    icon={<Gift size={16} />}
                                                    label={MSG.ACHIEVEMENT_PANEL_CLAIM_DETAIL}
                                                    onClick={() => claim(milestone)}
                                                    className="mt-2 w-full"
                                                />
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </details>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default AchievementPanel;
