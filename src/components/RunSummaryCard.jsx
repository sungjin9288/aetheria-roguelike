import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Skull, Share2, RotateCcw, CheckCircle, Trophy, Sword, Gem, Coins, MapPin, Zap, Radar } from 'lucide-react';
import { getTitleLabel } from '../utils/gameUtils';
import { getRunSummaryAnalysis } from '../utils/outcomeAnalysis';
import SignalBadge from './SignalBadge';

const SHARE_TEXT = (s) =>
`⚔️ AETHERIA RUN ENDED
─────────────────────
${s.activeTitle ? `[${getTitleLabel(s.activeTitle)}] ` : ''}${s.job} Lv.${s.level}
📍 ${s.loc}에서 전사

🗡️ 처치: ${s.kills.toLocaleString()}마리 (보스 ${s.bossKills}회)
💎 유물: ${s.relicsFound}개 수집
💰 총 골드: ${s.totalGold.toLocaleString()}
⚡ 프레스티지: ${s.prestigeRank}랭크

#에테리아 #AetheriaRPG #로그라이크`;

const STAT_CARD_STYLE = [
    'text-[#f6e7c8] border-[#d5b180]/18 bg-[#d5b180]/10',
    'text-[#dff7f5] border-[#7dd4d8]/18 bg-[#7dd4d8]/10',
    'text-rose-100 border-rose-300/20 bg-rose-400/10',
    'text-[#e3dcff] border-[#9a8ac0]/20 bg-[#9a8ac0]/10',
    'text-slate-100 border-white/8 bg-white/[0.04]',
    'text-[#f6e7c8] border-[#d5b180]/18 bg-[#d5b180]/10',
];

const RunSummaryCard = ({ runSummary: s, onRestart }) => {
    const [copied, setCopied] = useState(false);
    const analysis = getRunSummaryAnalysis(s);

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(SHARE_TEXT(s));
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // fallback: select text
        }
    };

    const stats = [
        { icon: <Trophy size={14} className="text-[#d5b180]" />, label: 'LEVEL', value: s.level },
        { icon: <Sword size={14} className="text-[#7dd4d8]" />, label: 'CLASS', value: s.job },
        { icon: <Skull size={14} className="text-rose-200" />, label: 'KILLS', value: s.kills.toLocaleString() },
        { icon: <Skull size={14} className="text-[#e3dcff]" />, label: 'BOSSES', value: s.bossKills },
        { icon: <Gem size={14} className="text-slate-100" />, label: 'RELICS', value: s.relicsFound },
        { icon: <Coins size={14} className="text-[#d5b180]" />, label: 'GOLD', value: s.totalGold.toLocaleString() },
    ];

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
            <div className="aether-overlay" />
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(125,212,216,0.08), transparent 24%)' }}
            />

            <Motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="panel-noise aether-surface-strong relative z-10 w-full max-w-[34rem] overflow-hidden rounded-[2rem] shadow-[0_36px_96px_rgba(1,6,14,0.62)]"
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent 22%), radial-gradient(circle at top right, rgba(154,138,192,0.12), transparent 28%)' }}
                />

                <div className="px-6 pb-5 pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] font-fira uppercase tracking-[0.22em] text-slate-500">
                                Memorial Ledger
                            </div>
                            <div className="mt-2 text-[1.7rem] font-rajdhani font-bold tracking-[0.08em] text-[#f6e7c8]">
                                {s.activeTitle
                                    ? <><span className="text-[#e3dcff]">[{getTitleLabel(s.activeTitle)}]</span> {s.job}</>
                                    : s.job
                                }
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-fira text-slate-300/76">
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin size={11} className="text-slate-400" />
                                    {s.loc}에서 전사
                                </span>
                                <span className="text-slate-500">·</span>
                                <span>Lv.{s.level}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <SignalBadge tone="danger" size="sm">Run Ended</SignalBadge>
                            {s.prestigeRank > 0 && (
                                <SignalBadge tone="resonance" size="sm">
                                    <span className="inline-flex items-center gap-1">
                                        <Zap size={10} />
                                        Prestige {s.prestigeRank}
                                    </span>
                                </SignalBadge>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {stats.map((st, index) => (
                            <div key={st.label} className={`rounded-[1rem] border px-3 py-3 ${STAT_CARD_STYLE[index]}`}>
                                <div className="flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.16em] opacity-76">
                                    {st.icon}
                                    {st.label}
                                </div>
                                <div className="mt-2 text-[1.3rem] font-rajdhani font-bold text-white">
                                    {st.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-3.5">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                                <Radar size={11} />
                                Run Readout
                            </span>
                            <span className="text-[#f6e7c8]">{analysis.headline}</span>
                        </div>

                        <div className="mt-3 space-y-1.5 text-[11px] font-fira text-slate-200/86">
                            {analysis.notes.map((note) => (
                                <div key={note}>• {note}</div>
                            ))}
                        </div>

                        <div className="mt-3 border-t border-white/8 pt-3 space-y-1.5 text-[11px] font-fira text-[#dff7f5]/78">
                            {analysis.focus.map((focus) => (
                                <div key={focus}>→ {focus}</div>
                            ))}
                        </div>
                    </div>

                    <p className="mt-4 text-center text-[11px] font-fira leading-relaxed text-slate-400/76">
                        에테르는 흩어졌지만 기록은 남습니다. 같은 죽음을 반복하지 않도록 이번 런의 패턴을 다음 시도에 반영하세요.
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <Motion.button
                            data-testid="run-summary-share"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleShare}
                            className={`flex items-center justify-center gap-2 rounded-[1rem] border px-3 py-3 text-sm font-rajdhani font-bold transition-all ${
                                copied
                                    ? 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100'
                                    : 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10 text-[#dff7f5] hover:bg-[#7dd4d8]/14'
                            }`}
                        >
                            {copied ? <CheckCircle size={15} /> : <Share2 size={15} />}
                            {copied ? '복사 완료' : '결과 공유'}
                        </Motion.button>

                        <Motion.button
                            data-testid="run-summary-restart"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={onRestart}
                            className="flex items-center justify-center gap-2 rounded-[1rem] border border-[#d5b180]/24 bg-[#d5b180]/10 px-3 py-3 text-sm font-rajdhani font-bold text-[#f6e7c8] transition-all hover:bg-[#d5b180]/14"
                        >
                            <RotateCcw size={15} />
                            다시 시작
                        </Motion.button>
                    </div>
                </div>
            </Motion.div>
        </Motion.div>
    );
};

export default RunSummaryCard;
