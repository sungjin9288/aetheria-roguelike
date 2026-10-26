import { motion as Motion } from 'framer-motion';
import {
    ArrowRight,
    Backpack,
    BookOpen,
    CheckCircle2,
    Coins,
    Compass,
    HeartPulse,
    MapPin,
    Sparkles,
    Swords,
} from 'lucide-react';
import type { ClassJourneyRecord, ExpeditionSummary } from '../types/player.js';
import type { ExpeditionReturnAction } from '../utils/expeditionReturnFlow.js';
import type { MilestoneStoryBeat } from '../utils/milestoneStory.js';
import ClassJourneySummary from './ClassJourneySummary';
import ActionButton from './ui/ActionButton';
import Gauge from './ui/Gauge';
import MomentCloseButton from './moments/MomentCloseButton';
import MomentRegionArt from './moments/MomentRegionArt';
import { MOMENT_DUR_PANEL, MOMENT_EASE } from './moments/momentMotion';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import type { ReturnSupplyRewardViewModel } from '../hooks/useReturnSupplyRewardedAd';
import { MSG } from '../data/messages';
import { useOverlayDialog } from '../hooks/useOverlayDialog';

interface ExpeditionDebriefCardProps {
    summary: ExpeditionSummary;
    recommendation: ExpeditionReturnAction;
    journeyJob?: string | null;
    journey?: ClassJourneyRecord;
    storyBeat?: MilestoneStoryBeat | null;
    onClose: () => void;
    onPrimaryAction: () => void;
    returnSupplyReward?: ReturnSupplyRewardViewModel;
}

const formatDuration = (durationMs: number) => {
    const minutes = Math.floor(durationMs / 60_000);
    if (minutes < 1) return MSG.EXPEDITION_DEBRIEF_UNDER_MINUTE;
    if (minutes < 60) return MSG.EXPEDITION_DEBRIEF_MINUTES(minutes);
    const hours = Math.floor(minutes / 60);
    return MSG.EXPEDITION_DEBRIEF_HOURS(hours, minutes % 60);
};

const signedNumber = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}`;

const summarizeItems = (items: string[]) => {
    const counts = new Map<string, number>();
    items.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
    return [...counts.entries()].map(([name, count]) => count > 1 ? `${name} x${count}` : name);
};

const ExpeditionDebriefCard = ({
    summary,
    recommendation,
    journeyJob,
    journey,
    storyBeat,
    onClose,
    onPrimaryAction,
    returnSupplyReward,
}: ExpeditionDebriefCardProps) => {
    usePlatformBackHandler(true, onClose, 70);
    const dialog = useOverlayDialog({ label: MSG.A11Y_DIALOG_EXPEDITION_DEBRIEF, onEscape: onClose });
    const itemLabels = summarizeItems(summary.newItems);
    const levelLabel = MSG.EXPEDITION_RETURN_LEVEL(summary.startLevel, summary.endLevel);
    // 감사 VD-06: 수치마다 의미 색 토큰 하나 — 전투(위협) · 탐험(에테르) · 경험(경험) · 골드(금 글자).
    const metrics = [
        { label: MSG.EXPEDITION_DEBRIEF_BATTLES, value: MSG.EXPEDITION_DEBRIEF_TIMES(summary.battles), icon: Swords, tone: 'text-ae-threat' },
        { label: MSG.EXPEDITION_DEBRIEF_EXPLORES, value: MSG.EXPEDITION_DEBRIEF_TIMES(summary.explores), icon: Compass, tone: 'text-ae-ether-hi' },
        { label: MSG.EXPEDITION_RETURN_EXP, value: `+${summary.expGained.toLocaleString('ko-KR')}`, icon: Sparkles, tone: 'text-ae-exp' },
        { label: MSG.EXPEDITION_DEBRIEF_GOLD, value: signedNumber(summary.goldDelta), icon: Coins, tone: 'text-ae-gold-text' },
    ];

    return (
        <Motion.div
            {...dialog}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[70] flex items-center justify-center px-3 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]"
        >
            <div className="ae-scrim ae-moment-scrim" />
            <Motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: MOMENT_DUR_PANEL, ease: MOMENT_EASE }}
                data-testid="expedition-debrief-card"
                aria-label={MSG.A11Y_DIALOG_EXPEDITION_DEBRIEF}
                style={{
                    maxHeight: 'calc(100dvh - max(var(--aether-safe-area-top), 0.5rem) - max(var(--aether-safe-area-bottom), 0.5rem))',
                }}
                className="ae-sheet relative z-10 flex w-full max-w-[25rem] flex-col overflow-hidden lg:max-w-[30rem]"
            >
                <header className="px-4 pb-3 pt-3">
                    <div className="flex items-center justify-between gap-3 pl-1">
                        <div className="ae-eyebrow text-ae-ether-hi">{MSG.EXPEDITION_DEBRIEF_EYEBROW}</div>
                        <MomentCloseButton
                            data-testid="expedition-debrief-close-icon"
                            aria-label={MSG.UI_CLOSE}
                            onClick={onClose}
                            className="-mr-1"
                        />
                    </div>
                    {/* 감사 VD-09: 화면의 장식 패널 하나 — 다녀온 지역 그림(보이는 이름일 때만)과 귀환 제목 */}
                    <div className="ae-ornate mt-1 flex items-center gap-3 px-4 py-3.5">
                        <MomentRegionArt location={summary.destination} className="h-16 w-16" />
                        <div className="min-w-0 flex-1">
                            <h2 className="font-display text-[22px] font-extrabold leading-tight text-ae-ink">{MSG.EXPEDITION_DEBRIEF_TITLE}</h2>
                            <div className="mt-1.5 flex min-w-0 items-start gap-1.5 font-readable text-[13px] text-ae-ink-2">
                                <MapPin size={13} className="mt-0.5 shrink-0 text-ae-ether" aria-hidden="true" />
                                <span className="min-w-0 break-keep">{summary.destination} · {formatDuration(summary.durationMs)}</span>
                            </div>
                            <div className="mt-1 font-fira text-[13px] font-bold tabular-nums text-ae-gold-text">{levelLabel}</div>
                        </div>
                    </div>
                </header>

                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                        {metrics.map(({ label, value, icon: Icon, tone }) => (
                            <div key={label} className="ae-moment-tile rounded-ae-md px-3 py-2.5">
                                <div className="flex items-center gap-1.5 font-readable text-[11px] font-bold text-ae-ink-2">
                                    <Icon size={12} className={tone} aria-hidden="true" />
                                    {label}
                                </div>
                                <div className={`mt-1 font-fira text-[17px] font-bold tabular-nums ${tone}`}>{value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="ae-well mt-3 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 font-readable text-[12px] font-bold text-ae-ink-2">
                                <HeartPulse size={13} className="text-ae-life" aria-hidden="true" />
                                {MSG.EXPEDITION_DEBRIEF_LOWEST_HP}
                            </div>
                            <div className="font-fira text-[13px] font-bold tabular-nums text-ae-ink">
                                {MSG.EXPEDITION_RETURN_HP(summary.lowestHp, summary.lowestHpPercent)}
                            </div>
                        </div>
                        <Gauge
                            kind="life"
                            value={Math.max(2, summary.lowestHpPercent)}
                            max={100}
                            label={MSG.EXPEDITION_DEBRIEF_LOWEST_HP}
                            valueText={MSG.EXPEDITION_RETURN_HP(summary.lowestHp, summary.lowestHpPercent)}
                            className="mt-2"
                        />
                    </div>

                    <div className="mt-3 space-y-3 px-1">
                        <section data-testid="expedition-debrief-items" className="flex items-start gap-3">
                            <Backpack size={15} className="mt-0.5 shrink-0 text-ae-gold" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <div className="ae-eyebrow">{MSG.EXPEDITION_DEBRIEF_NEW_ITEMS}</div>
                                <div className="mt-0.5 break-keep font-readable text-[13px] text-ae-ink">
                                    {itemLabels.length > 0 ? itemLabels.slice(0, 3).join(' · ') : MSG.EXPEDITION_DEBRIEF_NO_ITEMS}
                                    {itemLabels.length > 3 ? MSG.EXPEDITION_DEBRIEF_MORE_ITEMS(itemLabels.length - 3) : ''}
                                </div>
                                {summary.lostItemCount > 0 && (
                                    <div className="mt-0.5 font-readable text-[12px] text-ae-ink-3">{MSG.EXPEDITION_DEBRIEF_USED_ITEMS(summary.lostItemCount)}</div>
                                )}
                            </div>
                        </section>

                        <div className="ae-divider" />

                        <section data-testid="expedition-debrief-quests" className="flex items-start gap-3">
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ae-ether" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <div className="ae-eyebrow">{MSG.EXPEDITION_DEBRIEF_QUESTS}</div>
                                <div className="mt-0.5 break-keep font-readable text-[13px] text-ae-ink">
                                    {summary.completedQuests.length > 0
                                        ? summary.completedQuests.slice(0, 2).join(' · ')
                                        : MSG.EXPEDITION_DEBRIEF_NO_QUESTS}
                                </div>
                            </div>
                        </section>
                    </div>

                    {journeyJob && (
                        <ClassJourneySummary
                            job={journeyJob}
                            record={journey}
                            latestSummary={summary}
                            className="mt-4"
                        />
                    )}

                    {storyBeat && (
                        <section
                            data-testid="expedition-debrief-story"
                            data-story-id={storyBeat.id}
                            className="ae-well mt-4 px-3.5 py-3"
                        >
                            <div className="flex items-center gap-2 text-ae-gold-text">
                                <BookOpen size={14} aria-hidden="true" />
                                <span className="font-readable text-[11px] font-bold">{storyBeat.eyebrow}</span>
                            </div>
                            <h3 className="mt-1 font-display text-[15px] font-extrabold text-ae-ink">{storyBeat.title}</h3>
                            <p className="mt-1.5 break-keep font-readable text-[13px] leading-relaxed text-ae-ink-2">{storyBeat.body}</p>
                        </section>
                    )}
                </div>

                <footer className="ae-moment-foot px-4 pb-4 pt-3">
                    <div data-testid="expedition-return-recommendation" className="mb-2.5 px-1">
                        <div className="font-readable text-[11px] font-bold text-ae-ether-hi">{MSG.EXPEDITION_DEBRIEF_NEXT}</div>
                        <div className="mt-0.5 break-keep font-readable text-[12px] text-ae-ink-2">{recommendation.detail}</div>
                    </div>
                    {returnSupplyReward?.visible && (
                        <div data-testid="return-supply-reward" className="ae-well mb-2.5 min-w-0 p-2">
                            <button
                                type="button"
                                data-testid="return-supply-reward-action"
                                disabled={returnSupplyReward.disabled}
                                onClick={returnSupplyReward.onPress}
                                className="ae-btn ae-btn-glass min-h-[44px] w-full font-readable text-[13px]"
                            >
                                {returnSupplyReward.label}
                            </button>
                            <p className="mt-1.5 break-words px-1 font-readable text-[12px] text-ae-ink-2">
                                {returnSupplyReward.detail}
                            </p>
                        </div>
                    )}
                    <ActionButton
                        variant="primary"
                        data-testid="expedition-debrief-primary-action"
                        data-return-action={recommendation.kind}
                        onClick={onPrimaryAction}
                        icon={<ArrowRight size={17} />}
                        label={recommendation.label}
                        className="w-full"
                    />
                </footer>
            </Motion.section>
        </Motion.div>
    );
};

export default ExpeditionDebriefCard;
