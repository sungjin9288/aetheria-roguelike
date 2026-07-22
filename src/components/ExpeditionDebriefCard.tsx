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
    X,
} from 'lucide-react';
import type { ExpeditionSummary } from '../types/player.js';
import type { ExpeditionReturnAction } from '../utils/expeditionReturnFlow.js';
import type { MilestoneStoryBeat } from '../utils/milestoneStory.js';

interface ExpeditionDebriefCardProps {
    summary: ExpeditionSummary;
    recommendation: ExpeditionReturnAction;
    storyBeat?: MilestoneStoryBeat | null;
    onClose: () => void;
    onPrimaryAction: () => void;
}

const formatDuration = (durationMs: number) => {
    const minutes = Math.floor(durationMs / 60_000);
    if (minutes < 1) return '1분 미만';
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}시간 ${remainder}분` : `${hours}시간`;
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
    storyBeat,
    onClose,
    onPrimaryAction,
}: ExpeditionDebriefCardProps) => {
    const itemLabels = summarizeItems(summary.newItems);
    const levelLabel = summary.endLevel > summary.startLevel
        ? `LV ${summary.startLevel} → ${summary.endLevel}`
        : `LV ${summary.endLevel}`;
    const metrics = [
        { label: '전투', value: `${summary.battles}회`, icon: Swords, tone: 'text-rose-200' },
        { label: '탐험', value: `${summary.explores}회`, icon: Compass, tone: 'text-[#b9f1ec]' },
        { label: '성장 EXP', value: `+${summary.expGained.toLocaleString('ko-KR')}`, icon: Sparkles, tone: 'text-[#ece5ff]' },
        { label: '골드 변화', value: signedNumber(summary.goldDelta), icon: Coins, tone: 'text-[#f6e7c8]' },
    ];

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[70] flex items-center justify-center px-3 py-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
        >
            <div className="aether-overlay" />
            <Motion.section
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                data-testid="expedition-debrief-card"
                aria-label="원정 귀환 기록"
                className="panel-noise aether-surface-strong relative z-10 flex max-h-full w-full max-w-[25rem] flex-col overflow-hidden rounded-[1.5rem] shadow-[0_32px_90px_rgba(1,6,14,0.68)]"
            >
                <header className="relative border-b border-white/8 px-5 pb-4 pt-5">
                    <button
                        type="button"
                        data-testid="expedition-debrief-close-icon"
                        onClick={onClose}
                        aria-label="닫기"
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
                    >
                        <X size={17} />
                    </button>
                    <div className="aether-type-label font-fira font-bold uppercase tracking-normal text-[#b9f1ec]/72">원정 기록</div>
                    <h2 className="mt-1 font-rajdhani text-[1.45rem] font-bold tracking-normal text-white">원정 귀환</h2>
                    <div className="aether-type-body mt-2 flex min-w-0 items-center gap-2 font-readable text-slate-300/82">
                        <MapPin size={13} className="shrink-0 text-[#7dd4d8]" />
                        <span className="min-w-0 truncate">{summary.destination} · {formatDuration(summary.durationMs)}</span>
                        <span className="ml-auto shrink-0 text-[#d5b180]">{levelLabel}</span>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[0.75rem] border border-white/8 bg-white/8">
                        {metrics.map(({ label, value, icon: Icon, tone }) => (
                            <div key={label} className="bg-[#0b1118] px-3 py-3">
                                <div className="aether-type-label flex items-center gap-1.5 font-readable font-semibold text-slate-400">
                                    <Icon size={12} className={tone} />
                                    {label}
                                </div>
                                <div className={`aether-type-metric mt-1 font-rajdhani font-bold ${tone}`}>{value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 border-y border-white/8 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="aether-type-body flex items-center gap-2 font-readable font-semibold text-slate-300">
                                <HeartPulse size={13} className="text-rose-300" />
                                가장 위험했던 순간
                            </div>
                            <div className="font-rajdhani text-sm font-bold text-rose-100">
                                HP {summary.lowestHp.toLocaleString('ko-KR')} · {summary.lowestHpPercent}%
                            </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                            <div
                                className="h-full rounded-full bg-rose-300/80"
                                style={{ width: `${Math.max(2, summary.lowestHpPercent)}%` }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        <section data-testid="expedition-debrief-items" className="flex items-start gap-3">
                            <Backpack size={14} className="mt-0.5 shrink-0 text-[#d5b180]" />
                            <div className="min-w-0 flex-1">
                                <div className="aether-type-label font-readable font-semibold text-slate-400">새로 챙긴 것</div>
                                <div className="aether-type-body mt-1 font-readable text-slate-100">
                                    {itemLabels.length > 0 ? itemLabels.slice(0, 3).join(' · ') : '새 아이템 없음'}
                                    {itemLabels.length > 3 ? ` 외 ${itemLabels.length - 3}종` : ''}
                                </div>
                                {summary.lostItemCount > 0 && (
                                    <div className="aether-type-meta mt-0.5 font-readable text-slate-500">사용·소모 {summary.lostItemCount}개</div>
                                )}
                            </div>
                        </section>

                        <section data-testid="expedition-debrief-quests" className="flex items-start gap-3">
                            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#7dd4d8]" />
                            <div className="min-w-0 flex-1">
                                <div className="aether-type-label font-readable font-semibold text-slate-400">달성한 임무</div>
                                <div className="aether-type-body mt-1 font-readable text-slate-100">
                                    {summary.completedQuests.length > 0
                                        ? summary.completedQuests.slice(0, 2).join(' · ')
                                        : '이번 원정에서 새로 달성한 임무 없음'}
                                </div>
                            </div>
                        </section>
                    </div>

                    {storyBeat && (
                        <section
                            data-testid="expedition-debrief-story"
                            data-story-id={storyBeat.id}
                            className="mt-4 border-t border-white/8 pt-4"
                        >
                            <div className="flex items-center gap-2 text-[#f6e7c8]">
                                <BookOpen size={14} />
                                <span className="aether-type-label font-readable font-semibold">{storyBeat.eyebrow}</span>
                            </div>
                            <h3 className="aether-type-title mt-1 font-readable font-bold text-white">{storyBeat.title}</h3>
                            <p className="aether-type-body mt-2 font-readable leading-relaxed text-slate-200/84">{storyBeat.body}</p>
                        </section>
                    )}
                </div>

                <footer className="border-t border-white/8 p-3">
                    <div data-testid="expedition-return-recommendation" className="mb-2 px-1">
                        <div className="aether-type-label font-readable font-semibold text-[#b9f1ec]">이어서 할 일</div>
                        <div className="aether-type-meta mt-0.5 font-readable text-slate-300/78">{recommendation.detail}</div>
                    </div>
                    <Motion.button
                        type="button"
                        data-testid="expedition-debrief-primary-action"
                        data-return-action={recommendation.kind}
                        whileTap={{ scale: 0.98 }}
                        onClick={onPrimaryAction}
                        className="aether-cta-primary aether-type-body flex min-h-[48px] w-full items-center justify-center gap-2 px-4 font-readable font-bold text-[#dff7f5]"
                    >
                        <ArrowRight size={15} />
                        {recommendation.label}
                    </Motion.button>
                </footer>
            </Motion.section>
        </Motion.div>
    );
};

export default ExpeditionDebriefCard;
