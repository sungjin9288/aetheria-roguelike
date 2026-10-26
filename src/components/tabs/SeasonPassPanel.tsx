import { useId, type Dispatch, type ReactNode } from 'react';
import { ChevronDown, CircleCheck, Compass, Gift, History, LockKeyhole, RefreshCw, Sparkles, Star } from 'lucide-react';
import { AT } from '../../reducers/actionTypes';
import { SEASON_TIER_XP, type SeasonRewardRow } from '../../data/seasonPass';
import { MSG } from '../../data/messages';
import type { Player } from '../../types';
import type { GameAction } from '../../reducers/gameReducer';
import {
    buildSeasonChapters,
    createSeasonPassState,
    formatSeasonReward,
    formatSeasonRewardParts,
    formatSeasonScale,
    getActiveSeason,
    getActiveSeasonRewards,
    getClaimableSeasonRewards,
    getCompletedSeasonCount,
    getNextSeasonRewards,
    getSeasonArchive,
    getSeasonClaimsRemaining,
    getSeasonProgress,
    getUpcomingSeason,
    normalizeClaimedSeasonTiers,
    SEASON_ACTIVITY_SOURCES,
    SEASON_MAX_TIER,
} from '../../utils/seasonPassPresentation';
import ActionButton from '../ui/ActionButton';
import Chip from '../ui/Chip';
import Gauge from '../ui/Gauge';

interface SeasonPassPanelProps {
    player?: Player;
    dispatch?: Dispatch<GameAction>;
    onClaimSeasonReward?: (tier: number) => void;
}

type OwnedTitles = readonly string[] | undefined;

interface RewardLinesProps {
    row: SeasonRewardRow;
    isPremium: boolean;
    ownedTitles: OwnedTitles;
    player: Player | undefined;
}

const CHAPTER_SIZE = 10;
const TRACK_TIERS = Array.from({ length: SEASON_MAX_TIER }, (_, index) => index + 1);

// 2026-10 Wave 62 (원장 §61.4 C16): 골드는 이 플레이어가 실제로 받는 금액이다('빈손의 시작'이면 절반) — 같은 플레이어를 넘긴다.
const getVisibleRewardParts = (row: SeasonRewardRow, isPremium: boolean, ownedTitles: OwnedTitles, player: Player | undefined) => [
    ...formatSeasonRewardParts(row.free, ownedTitles, player),
    ...(isPremium ? formatSeasonRewardParts(row.premium, ownedTitles, player).map(MSG.SEASON_PANEL_EXTRA_PART) : []),
];

const getTrackNodeClass = (tier: number, reachedTier: number, claimedTiers: readonly number[]) => {
    const state = claimedTiers.includes(tier) ? ' is-claimed' : tier <= reachedTier ? ' is-claimable' : '';
    const chapterStart = tier > 1 && (tier - 1) % CHAPTER_SIZE === 0 ? ' is-chapter' : '';
    return `ab-node${state}${chapterStart}`;
};

/** 30단계 한 줄 — 받은 단계는 에테르, 받을 단계는 금빛. 수치는 옆의 글자가 말하므로 보조 기술에는 숨긴다. */
const SeasonTrack = ({ reachedTier, claimedTiers }: { reachedTier: number; claimedTiers: readonly number[] }) => (
    <div className="ab-track mt-3" aria-hidden="true" data-testid="season-track">
        {TRACK_TIERS.map((tier) => (
            <span key={tier} className={getTrackNodeClass(tier, reachedTier, claimedTiers)} />
        ))}
    </div>
);

const RewardLines = ({ row, isPremium, ownedTitles, player }: RewardLinesProps) => (
    <>
        <div className="aether-type-meta mt-0.5 text-ae-gold-text">
            {formatSeasonReward(row.free, ownedTitles, player)}
        </div>
        {isPremium && (
            <div className="aether-type-meta mt-0.5 text-ae-ether-hi">
                {MSG.SEASON_PANEL_EXTRA_REWARD(formatSeasonReward(row.premium, ownedTitles, player))}
            </div>
        )}
    </>
);

const SectionHead = ({ icon, title, aside }: { icon?: ReactNode; title: string; aside?: ReactNode }) => (
    <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
            {icon}
            <h3 className="ab-section-title">{title}</h3>
        </div>
        {aside ? <span className="aether-type-meta shrink-0 text-ae-ink-3">{aside}</span> : null}
    </div>
);

interface ChapterProps {
    chapter: ReturnType<typeof buildSeasonChapters>[number];
    reachedTier: number;
    claimedTiers: readonly number[];
    isPremium: boolean;
    ownedTitles: OwnedTitles;
    player: Player | undefined;
}

const TierStatusIcon = ({ claimed, unlocked }: { claimed: boolean; unlocked: boolean }) => {
    if (claimed) return <CircleCheck size={16} className="mt-0.5 shrink-0 text-ae-good" aria-hidden="true" />;
    if (unlocked) return <Gift size={16} className="mt-0.5 shrink-0 text-ae-gold-text" aria-hidden="true" />;
    return <LockKeyhole size={15} className="mt-0.5 shrink-0 text-ae-ink-3" aria-hidden="true" />;
};

const SeasonChapter = ({ chapter, reachedTier, claimedTiers, isPremium, ownedTitles, player }: ChapterProps) => {
    const reachedCount = chapter.rewards.filter((row) => row.tier <= reachedTier).length;
    const claimedCount = chapter.rewards.filter((row) => claimedTiers.includes(row.tier)).length;
    const chapterComplete = claimedCount === chapter.rewards.length;

    return (
        <details data-testid={`season-chapter-${chapter.id}`} className="group">
            <summary className="ab-summary min-h-[62px]">
                <span className={`ab-icon-well ${chapterComplete ? 'is-good' : 'is-gold'}`} aria-hidden="true">
                    {chapterComplete ? <CircleCheck size={17} /> : <Sparkles size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="aether-type-body block font-semibold text-ae-ink">{chapter.title}</span>
                    <span className="aether-type-meta mt-0.5 block font-fira tabular-nums text-ae-ink-3">
                        {MSG.SEASON_PANEL_CHAPTER_META(chapter.from, chapter.to, reachedCount, claimedCount, CHAPTER_SIZE)}
                    </span>
                </span>
                <ChevronDown size={16} className="ab-chevron shrink-0 text-ae-ink-3" aria-hidden="true" />
            </summary>

            <ol className="ab-rows pb-2 pl-12">
                {chapter.rewards.map((row) => {
                    const unlocked = row.tier <= reachedTier;
                    const claimed = claimedTiers.includes(row.tier);
                    const status = claimed ? MSG.SEASON_PANEL_TIER_CLAIMED : unlocked ? MSG.SEASON_PANEL_TIER_READY : MSG.SEASON_PANEL_TIER_LOCKED;

                    return (
                        <li key={row.tier} data-testid={`season-tier-${row.tier}`} className="flex min-h-[58px] items-start gap-2.5 py-3">
                            <TierStatusIcon claimed={claimed} unlocked={unlocked} />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="aether-type-body font-semibold text-ae-ink">{MSG.SEASON_PANEL_TIER_LABEL(row.tier)}</span>
                                    <span className="aether-type-meta text-ae-ink-3">{status}</span>
                                </div>
                                <RewardLines row={row} isPremium={isPremium} ownedTitles={ownedTitles} player={player} />
                            </div>
                        </li>
                    );
                })}
            </ol>
        </details>
    );
};

const SeasonPassPanel = ({ player, dispatch, onClaimSeasonReward }: SeasonPassPanelProps) => {
    const season = player?.seasonPass || createSeasonPassState();
    // 2026-09 Wave 12 D2: 보상 표는 현재 시즌에서 도출된다 — 시즌 1은 SEASON_REWARDS 그대로,
    //   이후 시즌은 숫자 보상만 배율이 붙는다. 회전은 완주(30단계 전부 수령)로만 일어난다.
    const activeSeason = getActiveSeason(season);
    const upcomingSeason = getUpcomingSeason(season);
    const seasonRewards = getActiveSeasonRewards(season);
    const progress = getSeasonProgress(season.xp, season.tier);
    const claimedTiers = normalizeClaimedSeasonTiers(season.claimed);
    const claimableRewards = getClaimableSeasonRewards(seasonRewards, progress.tier, season.claimed);
    const nextRewards = getNextSeasonRewards(seasonRewards, progress.tier);
    const chapters = buildSeasonChapters(seasonRewards);
    const claimsRemaining = getSeasonClaimsRemaining(season);
    const completedSeasons = getCompletedSeasonCount(season);
    const archive = getSeasonArchive(season);
    const isPremium = Boolean(season.isPremium);
    // 2026-10 Wave 61: 이미 가진 칭호는 수령해도 다시 지급되지 않는다 — 보상 줄이 '보유 중'으로 말한다.
    const ownedTitles = player?.titles;
    const claimSeasonReward = onClaimSeasonReward;
    const xpLabelId = useId();

    const claimReward = (row: SeasonRewardRow) => {
        if (row.tier > progress.tier || claimedTiers.includes(row.tier)) return;
        const rewardTier = row.tier;

        if (typeof claimSeasonReward === 'function' && onClaimSeasonReward) {
            onClaimSeasonReward(rewardTier);
        } else {
            dispatch?.({ type: AT.CLAIM_SEASON_REWARD, payload: { tier: rewardTier } });
        }
    };

    return (
        <div data-testid="season-journey-panel" className="ab-stack font-readable">
            <header data-testid="season-summary" className="ae-card ab-card-pad">
                <div className="flex items-start gap-3">
                    <span className="ab-icon-well is-gold" aria-hidden="true">
                        <Star size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="ab-section-title">{MSG.SEASON_PANEL_TITLE}</h2>
                        <p data-testid="season-name" className="aether-type-body mt-0.5 text-ae-ink-3">
                            {MSG.SEASON_NAME(activeSeason.ordinal)} · {MSG.SEASON_SUBTITLE}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        <Chip tone={progress.completed ? 'good' : 'ether'} className="font-fira tabular-nums">
                            {MSG.SEASON_PANEL_TIER(progress.tier, SEASON_MAX_TIER)}
                        </Chip>
                        {activeSeason.rewardScale > 1 && (
                            <Chip data-testid="season-scale-badge" tone="gold">
                                {MSG.SEASON_SCALE_BADGE(formatSeasonScale(activeSeason.rewardScale))}
                            </Chip>
                        )}
                    </div>
                </div>

                <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="aether-type-body font-semibold text-ae-ink">
                            {progress.completed ? MSG.SEASON_PANEL_DONE : MSG.SEASON_PANEL_TO_NEXT(progress.remainingXp)}
                        </span>
                        <span id={xpLabelId} className="aether-type-meta shrink-0 font-fira tabular-nums text-ae-ink-3">
                            {MSG.SEASON_PANEL_XP(progress.currentXp, SEASON_TIER_XP)}
                        </span>
                    </div>
                    <Gauge
                        kind="ether"
                        value={progress.currentXp}
                        max={SEASON_TIER_XP}
                        labelledBy={xpLabelId}
                        data-testid="season-xp-gauge"
                        className="mt-2"
                    />
                    <SeasonTrack reachedTier={progress.tier} claimedTiers={claimedTiers} />
                </div>
            </header>

            {claimableRewards.length > 0 && (
                <section data-testid="season-claimable" className="ab-mission ab-card-pad">
                    <SectionHead
                        icon={<Gift size={16} className="text-ae-gold-text" aria-hidden="true" />}
                        title={MSG.SEASON_PANEL_CLAIMABLE_TITLE}
                        aside={<span className="font-fira tabular-nums text-ae-gold-text">{MSG.SEASON_PANEL_COUNT(claimableRewards.length)}</span>}
                    />
                    <div className="ab-rows mt-2">
                        {claimableRewards.map((row) => (
                            <div key={row.tier} className="flex min-h-14 items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-semibold text-ae-ink">{MSG.SEASON_PANEL_TIER_REWARD(row.tier)}</div>
                                    <div className="aether-type-meta mt-1 text-ae-gold-text">
                                        {getVisibleRewardParts(row, isPremium, ownedTitles, player).join(' · ')}
                                    </div>
                                </div>
                                <ActionButton
                                    variant="glass"
                                    data-testid={`season-claim-${row.tier}`}
                                    onClick={() => claimReward(row)}
                                    icon={<Gift size={15} />}
                                    label={MSG.SEASON_PANEL_CLAIM}
                                    className="shrink-0"
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="season-next-rewards" className="ae-card ab-card-pad">
                <SectionHead
                    title={MSG.SEASON_PANEL_NEXT_TITLE}
                    aside={progress.completed ? MSG.SEASON_PANEL_ALL_UNLOCKED : MSG.SEASON_PANEL_NEXT_HINT}
                />

                {nextRewards.length > 0 ? (
                    <div className="ab-rows mt-2">
                        {nextRewards.map((row) => (
                            <div
                                key={row.tier}
                                data-testid={`season-next-reward-${row.tier}`}
                                className="flex min-h-[58px] items-center gap-3 py-2"
                            >
                                <span className="ab-icon-well font-fira tabular-nums text-ae-ink-2" aria-hidden="true">
                                    {row.tier}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-semibold text-ae-ink">{MSG.SEASON_PANEL_TIER_LABEL(row.tier)}</div>
                                    <RewardLines row={row} isPremium={isPremium} ownedTitles={ownedTitles} player={player} />
                                </div>
                                <LockKeyhole size={15} className="shrink-0 text-ae-ink-3" aria-hidden="true" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-3 flex min-h-14 items-center gap-3 text-ae-good">
                        <CircleCheck size={18} aria-hidden="true" />
                        <span className="aether-type-body font-semibold">{MSG.SEASON_PANEL_ALL_OPENED}</span>
                    </div>
                )}
            </section>

            <section data-testid="season-activity-sources" className="ae-card is-quiet ab-card-pad">
                <SectionHead
                    icon={<Compass size={16} className="text-ae-ether-hi" aria-hidden="true" />}
                    title={MSG.SEASON_PANEL_SOURCES_TITLE}
                />
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {SEASON_ACTIVITY_SOURCES.map((source) => (
                        <div key={source.id} className="flex min-h-8 items-center justify-between gap-2 border-b border-ae-ink/7 pb-2">
                            <span className="aether-type-meta text-ae-ink-2">{source.label}</span>
                            <span className="aether-type-meta shrink-0 font-fira font-semibold tabular-nums text-ae-ether-hi">+{source.xp}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section data-testid="season-rotation" className="ae-card is-quiet ab-card-pad">
                <SectionHead
                    icon={<RefreshCw size={16} className="text-ae-ether-hi" aria-hidden="true" />}
                    title={MSG.SEASON_ROTATION_TITLE}
                />
                <p data-testid="season-rotation-notice" className="aether-type-body mt-2 text-ae-ink-2">
                    {MSG.SEASON_ROTATION_NOTICE(
                        MSG.SEASON_NAME(upcomingSeason.ordinal),
                        formatSeasonScale(upcomingSeason.rewardScale),
                    )}
                </p>
                <p data-testid="season-rotation-remaining" className="aether-type-meta mt-1 text-ae-gold-text">
                    {claimsRemaining > 1
                        ? MSG.SEASON_CLAIMS_REMAINING(claimsRemaining)
                        : MSG.SEASON_CLAIMS_READY}
                </p>
            </section>

            <section data-testid="season-archive" className="ae-card is-quiet ab-card-pad">
                <SectionHead
                    icon={<History size={16} className="text-ae-ink-3" aria-hidden="true" />}
                    title={MSG.SEASON_ARCHIVE_TITLE}
                    aside={MSG.SEASON_ARCHIVE_SUMMARY(completedSeasons)}
                />
                {archive.length > 0 ? (
                    <div className="ab-rows mt-2">
                        {archive.map((entry) => (
                            <div
                                key={entry.seasonId}
                                data-testid={`season-archive-${entry.seasonId}`}
                                className="aether-type-meta flex min-h-8 items-center py-2 text-ae-ink-2"
                            >
                                {MSG.SEASON_ARCHIVE_ENTRY(MSG.SEASON_NAME(entry.ordinal), entry.claimed.length)}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="aether-type-meta mt-2 text-ae-ink-3">{MSG.SEASON_ARCHIVE_EMPTY}</p>
                )}
            </section>

            <section className="ae-card ab-card-pad">
                <SectionHead title={MSG.SEASON_PANEL_JOURNEY_TITLE} aside={MSG.SEASON_PANEL_JOURNEY_HINT} />
                <div className="ab-rows mt-2">
                    {chapters.map((chapter) => (
                        <SeasonChapter
                            key={chapter.id}
                            chapter={chapter}
                            reachedTier={progress.tier}
                            claimedTiers={claimedTiers}
                            isPremium={isPremium}
                            ownedTitles={ownedTitles}
                            player={player}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};

export default SeasonPassPanel;
