import { ChevronDown, CircleCheck, Compass, Gift, LockKeyhole, Sparkles, Star } from 'lucide-react';
import { AT } from '../../reducers/actionTypes';
import { SEASON_REWARDS, SEASON_TIER_XP, type SeasonRewardRow } from '../../data/seasonPass';
import type { Player } from '../../types';
import {
    buildSeasonChapters,
    formatSeasonReward,
    formatSeasonRewardParts,
    getClaimableSeasonRewards,
    getNextSeasonRewards,
    getSeasonProgress,
    normalizeClaimedSeasonTiers,
    SEASON_ACTIVITY_SOURCES,
} from '../../utils/seasonPassPresentation';
import SignalBadge from '../SignalBadge';

interface SeasonPassPanelProps {
    player?: Player;
    dispatch?: (action: any) => void;
    onClaimSeasonReward?: (tier: number) => void;
}

const getSeasonName = (seasonId?: string) => {
    const number = seasonId?.match(/\d+/)?.[0];
    return number ? `시즌 ${number}` : '현재 시즌';
};

const getVisibleRewardParts = (row: SeasonRewardRow, isPremium: boolean) => [
    ...formatSeasonRewardParts(row.free),
    ...(isPremium ? formatSeasonRewardParts(row.premium).map((part) => `추가 ${part}`) : []),
];

const SeasonPassPanel = ({ player, dispatch, onClaimSeasonReward }: SeasonPassPanelProps) => {
    const season = player?.seasonPass || {
        xp: 0,
        tier: 0,
        claimed: [],
        isPremium: false,
        seasonId: 'S1',
    };
    const progress = getSeasonProgress(season.xp, season.tier);
    const claimedTiers = normalizeClaimedSeasonTiers(season.claimed);
    const claimableRewards = getClaimableSeasonRewards(SEASON_REWARDS, progress.tier, season.claimed);
    const nextRewards = getNextSeasonRewards(SEASON_REWARDS, progress.tier);
    const chapters = buildSeasonChapters(SEASON_REWARDS);
    const isPremium = Boolean(season.isPremium);
    const claimSeasonReward = onClaimSeasonReward;

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
        <div data-testid="season-journey-panel" className="font-readable">
            <header data-testid="season-summary" className="border-b border-white/10 pb-4">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#d5b180]/24 bg-[#d5b180]/10">
                        <Star size={20} className="text-[#f6e7c8]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="aether-type-title font-semibold text-slate-100">시즌 여정</h2>
                        <p className="aether-type-body mt-0.5 text-slate-400/76">
                            {getSeasonName(season.seasonId)} · 평소의 모험이 성장으로 이어집니다
                        </p>
                    </div>
                    <SignalBadge tone={progress.completed ? 'success' : 'resonance'} size="sm">
                        {progress.tier} / 30 단계
                    </SignalBadge>
                </div>

                <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="aether-type-body font-semibold text-slate-100">
                            {progress.completed ? '시즌 여정 완료' : `다음 단계까지 ${progress.remainingXp}`}
                        </span>
                        <span className="aether-type-meta shrink-0 text-slate-400/76">
                            {progress.currentXp}/{SEASON_TIER_XP} 시즌 경험
                        </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                            className="h-full rounded-full bg-[#7dd4d8] transition-[width] duration-500"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                </div>
            </header>

            {claimableRewards.length > 0 && (
                <section data-testid="season-claimable" className="border-b border-[#d5b180]/20 py-4">
                    <div className="flex items-center gap-2">
                        <Gift size={16} className="text-[#f6e7c8]" />
                        <h3 className="aether-type-title font-semibold text-slate-100">받을 보상</h3>
                        <span className="aether-type-meta text-[#d5b180]">{claimableRewards.length}개</span>
                    </div>
                    <div className="mt-2 divide-y divide-white/8">
                        {claimableRewards.map((row) => (
                            <div key={row.tier} className="flex min-h-14 items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-semibold text-slate-100">{row.tier}단계 보상</div>
                                    <div className="aether-type-meta mt-1 text-[#d5b180]">
                                        {getVisibleRewardParts(row, isPremium).join(' · ')}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    data-testid={`season-claim-${row.tier}`}
                                    onClick={() => claimReward(row)}
                                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#d5b180]/32 bg-[#d5b180]/12 px-3 text-sm font-semibold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/18"
                                >
                                    <Gift size={15} />
                                    받기
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="season-next-rewards" className="border-b border-white/10 py-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="aether-type-title font-semibold text-slate-100">다음 보상</h3>
                    <span className="aether-type-meta text-slate-400/76">
                        {progress.completed ? '모든 보상 해금' : '가까운 3단계'}
                    </span>
                </div>

                {nextRewards.length > 0 ? (
                    <div className="mt-2 divide-y divide-white/8">
                        {nextRewards.map((row) => (
                            <div
                                key={row.tier}
                                data-testid={`season-next-reward-${row.tier}`}
                                className="flex min-h-[58px] items-center gap-3 py-2"
                            >
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-semibold text-slate-200">
                                    {row.tier}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-semibold text-slate-100">{row.tier}단계</div>
                                    <div className="aether-type-meta mt-0.5 text-[#d5b180]">
                                        {formatSeasonReward(row.free)}
                                    </div>
                                    {isPremium && (
                                        <div className="aether-type-meta mt-0.5 text-[#9ddfe2]">
                                            추가 보상 · {formatSeasonReward(row.premium)}
                                        </div>
                                    )}
                                </div>
                                <LockKeyhole size={15} className="shrink-0 text-slate-500" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-3 flex min-h-14 items-center gap-3 text-emerald-100">
                        <CircleCheck size={18} />
                        <span className="aether-type-body font-semibold">모든 시즌 보상을 열었습니다</span>
                    </div>
                )}
            </section>

            <section data-testid="season-activity-sources" className="border-b border-white/10 py-4">
                <div className="flex items-center gap-2">
                    <Compass size={16} className="text-[#9ddfe2]" />
                    <h3 className="aether-type-title font-semibold text-slate-100">성장하는 방법</h3>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {SEASON_ACTIVITY_SOURCES.map((source) => (
                        <div key={source.id} className="flex min-h-8 items-center justify-between gap-2 border-b border-white/8 pb-2">
                            <span className="aether-type-meta text-slate-300">{source.label}</span>
                            <span className="aether-type-meta shrink-0 font-semibold text-[#9ddfe2]">+{source.xp}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="pt-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="aether-type-title font-semibold text-slate-100">전체 여정</h3>
                    <span className="aether-type-meta text-slate-400/76">구간을 눌러 보상 보기</span>
                </div>
                <div className="mt-2 divide-y divide-white/10 border-y border-white/10">
                    {chapters.map((chapter) => {
                        const reachedCount = chapter.rewards.filter((row) => row.tier <= progress.tier).length;
                        const claimedCount = chapter.rewards.filter((row) => claimedTiers.includes(row.tier)).length;
                        const chapterComplete = claimedCount === chapter.rewards.length;

                        return (
                            <details key={chapter.id} data-testid={`season-chapter-${chapter.id}`} className="group">
                                <summary className="flex min-h-[62px] cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                                        {chapterComplete ? (
                                            <CircleCheck size={17} className="text-emerald-200" />
                                        ) : (
                                            <Sparkles size={17} className="text-[#f6e7c8]" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="aether-type-body font-semibold text-slate-100">{chapter.title}</div>
                                        <div className="aether-type-meta mt-0.5 text-slate-400/76">
                                            {chapter.from}–{chapter.to}단계 · 도달 {reachedCount}/10 · 수령 {claimedCount}/10
                                        </div>
                                    </div>
                                    <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                                </summary>

                                <div className="border-t border-white/8 pb-2 pl-12">
                                    {chapter.rewards.map((row) => {
                                        const unlocked = row.tier <= progress.tier;
                                        const claimed = claimedTiers.includes(row.tier);

                                        return (
                                            <div
                                                key={row.tier}
                                                data-testid={`season-tier-${row.tier}`}
                                                className="flex min-h-[58px] items-start gap-2.5 border-b border-white/8 py-3 last:border-b-0"
                                            >
                                                {claimed ? (
                                                    <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-200" />
                                                ) : unlocked ? (
                                                    <Gift size={16} className="mt-0.5 shrink-0 text-[#f6e7c8]" />
                                                ) : (
                                                    <LockKeyhole size={15} className="mt-0.5 shrink-0 text-slate-500" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                        <span className="aether-type-body font-semibold text-slate-100">{row.tier}단계</span>
                                                        <span className="aether-type-meta text-slate-400/76">
                                                            {claimed ? '수령 완료' : unlocked ? '받을 수 있음' : '미도달'}
                                                        </span>
                                                    </div>
                                                    <div className="aether-type-meta mt-0.5 text-[#d5b180]">
                                                        {formatSeasonReward(row.free)}
                                                    </div>
                                                    {isPremium && (
                                                        <div className="aether-type-meta mt-0.5 text-[#9ddfe2]">
                                                            추가 보상 · {formatSeasonReward(row.premium)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default SeasonPassPanel;
