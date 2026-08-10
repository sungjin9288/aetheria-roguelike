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
    Trophy,
    Zap,
} from 'lucide-react';
import { getTitleLabel } from '../utils/gameUtils';
import { getRunSummaryAnalysis, getRunSummaryReflectionStrip } from '../utils/outcomeAnalysis';
import { buildRunShareText } from '../utils/runShareText.js';
import SignalBadge from './SignalBadge';
import type { MilestoneStoryBeat } from '../utils/milestoneStory.js';

interface RunSummaryCardProps {
    runSummary?: any;
    storyBeat?: MilestoneStoryBeat | null;
    onRestart?: () => void;
}

const RunSummaryCard = ({ runSummary: s, storyBeat, onRestart }: RunSummaryCardProps) => {
    const [copied, setCopied] = useState(false);
    const analysis = getRunSummaryAnalysis(s);
    const reflection = getRunSummaryReflectionStrip(s, analysis);
    const runStats = [
        { icon: Skull, label: '처치', value: s.kills.toLocaleString(), color: 'text-rose-200' },
        { icon: Trophy, label: '보스', value: s.bossKills, color: 'text-[#e3dcff]' },
        { icon: Gem, label: '유물', value: s.relicsFound, color: 'text-[#dff7f5]' },
        { icon: Coins, label: '획득 골드', value: s.totalGold.toLocaleString(), color: 'text-[#f6e7c8]' },
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-3 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)] sm:px-4"
        >
            <div className="aether-overlay" />
            <Motion.div
                initial={{ opacity: 0, y: 28, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.36, ease: 'easeOut' }}
                className="panel-noise aether-surface-strong relative z-10 flex max-h-[calc(100svh-1rem)] w-full max-w-[34rem] flex-col overflow-hidden rounded-[1.5rem] shadow-[0_32px_80px_rgba(1,6,14,0.64)]"
            >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_24%)]" />

                <div className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                    <header className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="aether-type-label font-readable text-slate-500">이번 모험 기록</div>
                            <h1 className="mt-1.5 truncate font-readable text-[1.42rem] font-bold text-[#f6e7c8]">
                                {s.activeTitle && <span className="text-[#e3dcff]">[{getTitleLabel(s.activeTitle)}] </span>}
                                {s.job} <span className="text-white">Lv.{s.level}</span>
                            </h1>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-fira text-slate-300/76">
                                <MapPin size={11} className="shrink-0 text-slate-400" />
                                <span className="truncate">{s.loc}에서 모험 종료</span>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <SignalBadge tone="danger" size="sm">종료</SignalBadge>
                            {s.prestigeRank > 0 && (
                                <SignalBadge tone="resonance" size="sm">
                                    <span className="inline-flex items-center gap-1"><Zap size={10} />승천 {s.prestigeRank}</span>
                                </SignalBadge>
                            )}
                        </div>
                    </header>

                    {s.runTrackingComplete === false && (
                        <div className="mt-3 rounded-md border border-amber-300/18 bg-amber-300/[0.06] px-3 py-2 text-[10px] font-readable text-amber-100/76">
                            업데이트 이후의 이번 시도 기록만 집계했습니다.
                        </div>
                    )}

                    <section
                        data-testid="run-summary-reflection-strip"
                        data-run-tone={reflection.tone}
                        aria-label="모험 종료 원인과 다음 시도 요약"
                        className="aether-run-reflection-strip mt-4 grid grid-cols-3 gap-1.5 rounded-[0.9rem] p-1.5"
                    >
                        {reflection.cells.map((cell: any) => (
                            <div key={cell.label} className="aether-run-reflection-cell min-w-0 rounded-[0.65rem] px-2 py-2">
                                <div className="aether-type-label font-readable font-bold text-slate-400/86">{cell.label}</div>
                                <div className="mt-1 min-h-8 whitespace-normal break-keep font-rajdhani text-[0.79rem] font-bold leading-[1.15] text-white sm:text-[0.9rem]">
                                    {cell.value}
                                </div>
                            </div>
                        ))}
                    </section>

                    <section aria-label="이번 모험 성과" className="mt-4 grid grid-cols-4 border-y border-white/8 py-3">
                        {runStats.map(({ icon: Icon, label, value, color }) => (
                            <div key={label} className="min-w-0 border-r border-white/8 px-1.5 text-center last:border-r-0">
                                <div className={`flex items-center justify-center gap-1 ${color}`}>
                                    <Icon size={12} className="shrink-0" />
                                    <span className="aether-type-label truncate font-readable">{label}</span>
                                </div>
                                <div className="mt-1.5 whitespace-nowrap font-rajdhani text-[0.92rem] font-bold text-white sm:text-[1.08rem]">{value}</div>
                            </div>
                        ))}
                    </section>

                    {(s.escapes > 0 || s.discoveries > 0 || s.maxKillStreak > 0) && (
                        <div data-testid="run-summary-extras" className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-fira text-slate-300/82">
                            {s.escapes > 0 && (
                                <span data-testid="run-summary-escape" className="inline-flex items-center gap-1 text-sky-200">
                                    <Footprints size={11} />도주 {s.escapes}회
                                </span>
                            )}
                            {s.discoveries > 0 && (
                                <span data-testid="run-summary-discovery" className="inline-flex items-center gap-1 text-emerald-200">
                                    <Compass size={11} />새 지역 {s.discoveries}곳
                                </span>
                            )}
                            {s.maxKillStreak > 0 && (
                                <span data-testid="run-summary-streak" className="inline-flex items-center gap-1 text-red-200">
                                    <Flame size={11} />최대 {s.maxKillStreak}연속
                                </span>
                            )}
                        </div>
                    )}

                    {s.signaturesAcquired > 0 && (
                        <section data-testid="run-summary-signatures" className="mt-4 border-l-2 border-[#f6e7a2]/56 bg-[#f6e7a2]/[0.06] px-3 py-2.5">
                            <div className="aether-type-label flex items-center gap-1.5 font-readable text-[#f6e7a2]">
                                <Sparkles size={11} />전설 각인 {s.signaturesAcquired}종 획득
                            </div>
                            <div className="mt-1.5 break-keep text-[11px] font-readable text-[#fff3bd]/84">
                                {(s.signatureNames || []).join(' · ')}
                            </div>
                        </section>
                    )}

                    <section className="mt-4 border-t border-white/8 pt-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="aether-type-label inline-flex items-center gap-1.5 font-readable text-slate-500">
                                <Radar size={11} />다음 시도 추천
                            </span>
                            <span className="truncate text-[10px] font-readable text-[#f6e7c8]/72">{analysis.headline}</span>
                        </div>
                        <p className="mt-2 break-keep text-[12px] font-readable font-semibold leading-relaxed text-[#dff7f5]">
                            {analysis.focus[0]}
                        </p>
                        {analysis.notes.length > 0 && (
                            <p className="mt-1.5 truncate text-[10px] font-fira text-slate-400/74">{analysis.notes.join(' · ')}</p>
                        )}
                    </section>

                    <section data-testid="run-summary-persistent-growth" className="mt-4 flex items-start gap-2.5 border-t border-white/8 pt-3 text-[10px] font-readable leading-relaxed text-slate-300/74">
                        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#7dd4d8]" />
                        <span>승천 단계와 칭호·도감 기록은 다음 모험에도 이어집니다.</span>
                    </section>

                    {storyBeat && (
                        <details data-testid="run-summary-milestone-story" data-story-id={storyBeat.id} className="mt-4 border-t border-white/8 pt-3">
                            <summary className="cursor-pointer list-none text-[11px] font-readable font-semibold text-[#b9f1ec]">
                                {storyBeat.eyebrow} · {storyBeat.title}
                            </summary>
                            <p className="mt-2 text-[11px] font-readable leading-relaxed text-slate-200/82">{storyBeat.body}</p>
                            <p className="mt-1.5 text-[11px] font-readable text-[#f6e7c8]/82">{storyBeat.closing}</p>
                        </details>
                    )}
                </div>

                <footer className="relative grid grid-cols-[3.25rem_1fr] gap-2.5 border-t border-white/10 bg-[#07101a]/94 px-5 py-3 pb-[max(var(--aether-safe-area-bottom),0.75rem)] sm:px-6">
                    <Motion.button
                        data-testid="run-summary-share"
                        whileTap={{ scale: 0.95 }}
                        onClick={handleShare}
                        aria-label={copied ? '결과 복사 완료' : '결과 공유'}
                        title={copied ? '복사 완료' : '결과 공유'}
                        className={`flex h-12 w-[3.25rem] items-center justify-center rounded-[0.8rem] border transition-colors ${copied ? 'border-emerald-300/28 bg-emerald-300/10 text-emerald-100' : 'border-white/12 bg-white/[0.04] text-slate-200'}`}
                    >
                        {copied ? <CheckCircle size={18} /> : <Share2 size={18} />}
                    </Motion.button>
                    <Motion.button
                        data-testid="run-summary-restart"
                        whileTap={{ scale: 0.98 }}
                        onClick={onRestart}
                        className="flex h-12 items-center justify-center gap-2 rounded-[0.8rem] border border-[#d5b180]/30 bg-[#d5b180]/12 px-4 text-sm font-rajdhani font-bold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/16"
                    >
                        <RotateCcw size={16} />새 모험 시작
                    </Motion.button>
                </footer>
            </Motion.div>
        </Motion.div>
    );
};

export default RunSummaryCard;
