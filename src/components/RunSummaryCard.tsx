import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
    CheckCircle,
    Coins,
    Compass,
    Flame,
    Footprints,
    Gem,
    MapPin,
    Radar,
    RotateCcw,
    Share2,
    ShieldCheck,
    Skull,
    Sparkles,
    Swords,
    Trophy,
    Zap,
} from 'lucide-react';
import { getTitleLabel } from '../utils/gameUtils';
import { getRunSummaryAnalysis, getRunSummaryReflectionStrip } from '../utils/outcomeAnalysis';
import { buildRunShareText } from '../utils/runShareText.js';
import type { MilestoneStoryBeat } from '../utils/milestoneStory.js';
import type { RunSummary } from '../reducers/actionTypes.js';
import { getJourneySurfaceText } from '../utils/journeyScope';
import { MSG } from '../data/messages';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import ActionButton from './ui/ActionButton';
import Chip from './ui/Chip';
import MomentRegionArt from './moments/MomentRegionArt';
import { MOMENT_DUR_PANEL, MOMENT_EASE } from './moments/momentMotion';

interface RunSummaryCardProps {
    runSummary: RunSummary;
    storyBeat?: MilestoneStoryBeat | null;
    onRestart?: () => void;
    /** 지금 가진 계승 정수(사망 정산 뒤의 값) — 있으면 계승 정수 칸에 그린다. */
    essence?: number | null;
    /** 사망 화면에서 곧바로 에테르 거울로 — 없으면 단추를 그리지 않는다. */
    onOpenMirror?: () => void;
}

const toCount = (value: unknown): number | null => (Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : null);

const RunSummaryCard = ({ runSummary: s, storyBeat, onRestart, essence = null, onOpenMirror }: RunSummaryCardProps) => {
    const [copied, setCopied] = useState(false);
    const dialog = useOverlayDialog({ label: MSG.RUN_SUMMARY_EYEBROW });
    const analysis = getRunSummaryAnalysis(s);
    const reflection = getRunSummaryReflectionStrip(s, analysis);
    const killer = s.killer ?? null;
    const essenceGained = toCount(s.essenceGained);
    const heldEssence = toCount(essence);
    const previousBest = toCount(s.previousBestLevel);
    const level = s.level ?? 1;
    const bestLevelLine = previousBest !== null && previousBest > 0
        ? (level > previousBest ? MSG.RUN_SUMMARY_BEST_LEVEL_NEW(previousBest) : MSG.RUN_SUMMARY_BEST_LEVEL(previousBest, level))
        : null;
    const showEssence = essenceGained !== null || heldEssence !== null || Boolean(onOpenMirror);
    const runStats = [
        { icon: Skull, label: MSG.RUN_SUMMARY_STAT_KILLS, value: s.kills.toLocaleString(), color: 'text-ae-threat' },
        { icon: Trophy, label: MSG.RUN_SUMMARY_STAT_BOSSES, value: s.bossKills, color: 'text-ae-exp' },
        { icon: Gem, label: MSG.RUN_SUMMARY_STAT_RELICS, value: s.relicsFound, color: 'text-ae-ether-hi' },
        { icon: Coins, label: MSG.RUN_SUMMARY_STAT_GOLD, value: s.totalGold.toLocaleString(), color: 'text-ae-gold-text' },
    ];

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(buildRunShareText(s));
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <Motion.div
            {...dialog}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-3 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)] sm:px-4"
        >
            <div className="ae-scrim ae-moment-scrim" />
            <Motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: MOMENT_DUR_PANEL, ease: MOMENT_EASE }}
                data-testid="run-summary-card"
                className="ae-sheet relative z-10 flex max-h-[calc(100svh-1rem)] w-full max-w-[34rem] flex-col overflow-hidden lg:max-w-[38rem]"
            >
                <div className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
                    {/* 감사 VD-09: 쓰러진 자리의 지역 그림 + 사망 머리말 — 이 화면의 장식 패널 하나 */}
                    <header className="ae-ornate flex items-start gap-3 px-4 pb-4 pt-4">
                        <MomentRegionArt location={s.loc} className="h-16 w-16" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                                {/* 감사 A11Y-04: 머리말은 ink-2(이전 slate-500은 대비 부족) */}
                                <div className="font-readable text-[11px] font-bold text-ae-ink-2">{MSG.RUN_SUMMARY_EYEBROW}</div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Chip tone="threat">{MSG.RUN_SUMMARY_ENDED_BADGE}</Chip>
                                    {s.prestigeRank > 0 && (
                                        <Chip tone="ether" icon={<Zap size={11} />}>{MSG.PRESTIGE_RANK_LABEL(s.prestigeRank)}</Chip>
                                    )}
                                </div>
                            </div>
                            <h1 className="mt-1.5 break-words font-display text-[22px] font-extrabold leading-tight text-ae-ink">
                                {s.activeTitle && <span className="text-ae-exp">[{getTitleLabel(s.activeTitle)}] </span>}
                                {s.job} <span className="font-fira tabular-nums text-ae-gold-text">{MSG.LEVEL_LABEL(s.level ?? 1)}</span>
                            </h1>
                            <div className="mt-1.5 flex items-center gap-1.5 font-readable text-[11px] text-ae-ink-2">
                                <MapPin size={12} className="shrink-0 text-ae-ink-3" aria-hidden="true" />
                                <span data-testid="run-summary-ended-at" className="min-w-0 break-keep">{MSG.RUN_SUMMARY_ENDED_AT(s.loc)}</span>
                            </div>
                            {bestLevelLine && (
                                <div data-testid="run-summary-best-level" className="mt-1 flex items-center gap-1.5 font-readable text-[11px] text-ae-ink-2">
                                    <Trophy size={12} className="shrink-0 text-ae-gold" aria-hidden="true" />
                                    <span className="min-w-0 break-keep">{bestLevelLine}</span>
                                </div>
                            )}
                        </div>
                    </header>

                    {s.runTrackingComplete === false && (
                        <div className="ae-moment-signal mt-3 rounded-ae-sm px-3 py-2 font-readable text-[11px] text-ae-ink-2" data-signal-tone="amber">
                            {MSG.RUN_SUMMARY_PARTIAL_TRACKING}
                        </div>
                    )}

                    {killer && (
                        <section
                            data-testid="run-summary-killed-by"
                            className="ae-well mt-3 flex items-start gap-2.5 px-3 py-2.5"
                        >
                            <Swords size={14} className="mt-0.5 shrink-0 text-ae-threat" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <div className="font-readable text-[11px] font-bold text-ae-threat">{MSG.RUN_SUMMARY_KILLED_BY_LABEL}</div>
                                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <span data-testid="run-summary-killer-name" className="min-w-0 break-keep font-readable text-[14px] font-bold text-ae-ink">{killer.name}</span>
                                    {killer.hpPercent !== null && (
                                        <span data-testid="run-summary-killer-hp" className="shrink-0 font-readable text-[11px] tabular-nums text-ae-ink-2">
                                            {MSG.RUN_SUMMARY_KILLER_HP(killer.hpPercent)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    <section
                        data-testid="run-summary-reflection-strip"
                        data-run-tone={reflection.tone}
                        aria-label={MSG.RUN_SUMMARY_REFLECTION_ARIA}
                        className="aether-run-reflection-strip ae-moment-advice mt-3 grid grid-cols-3 px-1 py-2"
                    >
                        {reflection.cells.map((cell) => (
                            <div key={cell.label} className="aether-run-reflection-cell ae-moment-advice-cell min-w-0 px-2 py-1">
                                <div className="ae-moment-advice-label font-readable text-[11px] font-bold">{cell.label}</div>
                                <div className="mt-1 min-h-8 whitespace-normal break-keep font-display text-[13px] font-bold leading-[1.2] text-ae-ink sm:text-[14px]">
                                    {cell.value}
                                </div>
                            </div>
                        ))}
                    </section>

                    <section aria-label={MSG.RUN_SUMMARY_STATS_ARIA} className="mt-3 grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-4">
                        {runStats.map(({ icon: Icon, label, value, color }) => (
                            <div key={label} className="ae-moment-tile min-w-0 rounded-ae-sm px-2 py-2 text-center">
                                <div className={`flex items-center justify-center gap-1 ${color}`}>
                                    <Icon size={12} className="shrink-0" aria-hidden="true" />
                                    <span className="break-keep font-readable text-[11px] font-bold text-ae-ink-2">{label}</span>
                                </div>
                                <div className="mt-1 whitespace-nowrap font-fira text-[15px] font-bold tabular-nums text-ae-ink">{value}</div>
                            </div>
                        ))}
                    </section>

                    {(s.escapes > 0 || s.discoveries > 0 || s.maxKillStreak > 0) && (
                        <div data-testid="run-summary-extras" className="mt-2.5 flex flex-wrap gap-1.5">
                            {s.escapes > 0 && (
                                <Chip data-testid="run-summary-escape" tone="neutral" icon={<Footprints size={11} />}>{MSG.RUN_SUMMARY_ESCAPES(s.escapes)}</Chip>
                            )}
                            {s.discoveries > 0 && (
                                <Chip data-testid="run-summary-discovery" tone="good" icon={<Compass size={11} />}>{MSG.RUN_SUMMARY_DISCOVERIES(s.discoveries)}</Chip>
                            )}
                            {s.maxKillStreak > 0 && (
                                <Chip data-testid="run-summary-streak" tone="gold" icon={<Flame size={11} />}>{MSG.RUN_SUMMARY_STREAK(s.maxKillStreak)}</Chip>
                            )}
                        </div>
                    )}

                    {/* 전설 각인 — 전설 등급은 산호색 하나(위험 장미색과 섞지 않는다) */}
                    {s.signaturesAcquired > 0 && (
                        <section data-testid="run-summary-signatures" className="ae-moment-legendary mt-3 rounded-ae-sm px-3 py-2.5">
                            <div className="flex items-center gap-1.5 font-readable text-[11px] font-bold text-ae-rarity-legendary">
                                <Sparkles size={12} aria-hidden="true" />{MSG.RUN_SUMMARY_SIGNATURES(s.signaturesAcquired)}
                            </div>
                            <div className="mt-1.5 break-keep font-readable text-[12px] font-semibold text-ae-ink">
                                {(s.signatureNames || []).join(' · ')}
                            </div>
                        </section>
                    )}

                    <section className="mt-4 border-t border-ae-ink/10 pt-3">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            {/* 감사 A11Y-04: '다음 여정' 머리말은 ether-hi(이전 slate-500은 대비 부족) */}
                            <span className="inline-flex shrink-0 items-center gap-1.5 font-readable text-[11px] font-bold text-ae-ether-hi">
                                <Radar size={12} aria-hidden="true" />{MSG.RUN_SUMMARY_NEXT_JOURNEY_LABEL}
                            </span>
                            <span data-testid="run-summary-headline" className="min-w-0 break-keep text-right font-readable text-[11px] text-ae-gold-text">{analysis.headline}</span>
                        </div>
                        <p className="mt-2 break-keep font-readable text-[13px] font-semibold leading-relaxed text-ae-ink">
                            {analysis.focus[0]}
                        </p>
                        {analysis.notes.length > 0 && (
                            <p data-testid="run-summary-notes" className="mt-1.5 break-keep font-readable text-[11px] text-ae-ink-3">{analysis.notes.join(' · ')}</p>
                        )}
                    </section>

                    {showEssence && (
                        <section data-testid="run-summary-essence" className="ae-well mt-3 px-3 py-2.5 font-readable">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-ae-exp">
                                <Sparkles size={12} aria-hidden="true" />{MSG.RUN_SUMMARY_ESSENCE_TITLE}
                            </div>
                            {essenceGained !== null && (
                                <p data-testid="run-summary-essence-gained" className="mt-1.5 text-[13px] font-semibold tabular-nums text-ae-ink">
                                    {MSG.RUN_SUMMARY_ESSENCE_GAINED(essenceGained)}
                                </p>
                            )}
                            {heldEssence !== null && (
                                <p data-testid="run-summary-essence-held" className="mt-1 text-[11px] tabular-nums text-ae-ink-2">
                                    {MSG.RUN_SUMMARY_ESSENCE_HELD(heldEssence)}
                                </p>
                            )}
                            {onOpenMirror && (
                                <button
                                    type="button"
                                    data-testid="run-summary-open-mirror"
                                    onClick={onOpenMirror}
                                    className="ae-btn ae-btn-glass mt-2 min-h-11 w-full"
                                >
                                    <span className="ae-btn-icon text-ae-exp" aria-hidden="true"><Sparkles size={15} /></span>
                                    {MSG.MIRROR_CTA_LABEL}
                                </button>
                            )}
                        </section>
                    )}

                    <section data-testid="run-summary-persistent-growth" className="mt-3 flex items-start gap-2.5 border-t border-ae-ink/10 pt-3 font-readable text-[11px] leading-relaxed text-ae-ink-2">
                        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ae-ether" aria-hidden="true" />
                        <span className="min-w-0">
                            <span data-testid="run-summary-kept" className="block">{MSG.JOURNEY_KEPT_LINE(getJourneySurfaceText('death', 'kept'))}</span>
                            <span data-testid="run-summary-reset" className="mt-1 block text-ae-ink-3">{MSG.JOURNEY_RESET_LINE(getJourneySurfaceText('death', 'reset'))}</span>
                        </span>
                    </section>

                    {storyBeat && (
                        <details data-testid="run-summary-milestone-story" data-story-id={storyBeat.id} className="mt-3 border-t border-ae-ink/10 pt-3">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center font-readable text-[11px] font-semibold text-ae-ether-hi">
                                {storyBeat.eyebrow} · {storyBeat.title}
                            </summary>
                            <p className="mt-1 font-readable text-[11px] leading-relaxed text-ae-ink-2">{storyBeat.body}</p>
                            <p className="mt-1.5 font-readable text-[11px] text-ae-gold-text">{storyBeat.closing}</p>
                        </details>
                    )}
                </div>

                <footer className="ae-moment-foot relative grid grid-cols-[3rem_1fr] gap-2 px-4 py-3 pb-[max(var(--aether-safe-area-bottom),0.75rem)] sm:px-5">
                    <button
                        type="button"
                        data-testid="run-summary-share"
                        onClick={handleShare}
                        aria-label={copied ? MSG.RUN_SUMMARY_SHARE_COPIED_ARIA : MSG.RUN_SUMMARY_SHARE_ARIA}
                        title={copied ? MSG.RUN_SUMMARY_SHARE_COPIED : MSG.RUN_SUMMARY_SHARE_ARIA}
                        className={`ae-btn ae-btn-ghost h-12 w-12 px-0 ${copied ? 'text-ae-good' : ''}`}
                    >
                        {copied ? <CheckCircle size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
                    </button>
                    <ActionButton
                        variant="primary"
                        data-testid="run-summary-restart"
                        onClick={onRestart}
                        icon={<RotateCcw size={17} />}
                        label={MSG.RUN_SUMMARY_RESTART}
                        className="w-full"
                    />
                </footer>
            </Motion.div>
        </Motion.div>
    );
};

export default RunSummaryCard;
