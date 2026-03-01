import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Skull, Share2, RotateCcw, CheckCircle, Trophy, Sword, Gem, Coins, MapPin, Zap } from 'lucide-react';

const SHARE_TEXT = (s) =>
`⚔️ AETHERIA RUN ENDED
─────────────────────
${s.activeTitle ? `[${s.activeTitle}] ` : ''}${s.job} Lv.${s.level}
📍 ${s.loc}에서 전사

🗡️ 처치: ${s.kills.toLocaleString()}마리 (보스 ${s.bossKills}회)
💎 유물: ${s.relicsFound}개 수집
💰 총 골드: ${s.totalGold.toLocaleString()}
⚡ 프레스티지: ${s.prestigeRank}랭크

#에테리아 #AetheriaRPG #로그라이크`;

const RunSummaryCard = ({ runSummary: s, onRestart }) => {
    const [copied, setCopied] = useState(false);

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
        { icon: <Trophy size={14} className="text-yellow-400" />, label: 'LEVEL', value: s.level, color: 'text-yellow-400' },
        { icon: <Sword size={14} className="text-orange-400" />,  label: 'CLASS',  value: s.job,   color: 'text-orange-300' },
        { icon: <Skull size={14} className="text-red-400" />,     label: 'KILLS',  value: s.kills.toLocaleString(), color: 'text-red-400' },
        { icon: <Skull size={14} className="text-purple-400" />,  label: 'BOSSES', value: s.bossKills, color: 'text-purple-400' },
        { icon: <Gem size={14} className="text-cyber-blue" />,    label: 'RELICS', value: s.relicsFound, color: 'text-cyber-blue' },
        { icon: <Coins size={14} className="text-yellow-500" />,  label: 'GOLD',   value: s.totalGold.toLocaleString(), color: 'text-yellow-500' },
    ];

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-dark/90 backdrop-blur-md px-4"
        >
            <Motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-md bg-cyber-slate/90 border border-red-500/40 rounded-xl shadow-[0_0_40px_rgba(239,68,68,0.25)] overflow-hidden"
            >
                {/* 상단 스캔라인 */}
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent animate-scanline" />

                {/* 헤더 */}
                <div className="bg-red-950/50 px-6 py-5 text-center border-b border-red-500/20">
                    <Motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="text-red-500 text-xs font-fira tracking-[0.4em] mb-2"
                    >
                        ■ AGENT TERMINATED ■
                    </Motion.div>
                    <div className="text-2xl font-bold text-white font-rajdhani">
                        {s.activeTitle
                            ? <><span className="text-cyber-purple">[{s.activeTitle}]</span> {s.job}</>
                            : s.job
                        }
                    </div>
                    <div className="text-xs text-slate-400 font-fira mt-1 flex items-center justify-center gap-1">
                        <MapPin size={10} /> {s.loc}에서 전사
                    </div>
                    {s.prestigeRank > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-cyber-purple border border-cyber-purple/30 px-2 py-0.5 rounded bg-cyber-purple/10 font-rajdhani">
                            <Zap size={10} /> PRESTIGE {s.prestigeRank}
                        </div>
                    )}
                </div>

                {/* 통계 그리드 */}
                <div className="grid grid-cols-3 gap-px bg-cyber-blue/10 border-b border-cyber-blue/10">
                    {stats.map((st, i) => (
                        <div key={i} className="bg-cyber-dark/60 px-3 py-3 text-center">
                            <div className="flex justify-center mb-1">{st.icon}</div>
                            <div className={`text-lg font-bold font-rajdhani ${st.color}`}>{st.value}</div>
                            <div className="text-[10px] text-slate-500 font-fira tracking-widest">{st.label}</div>
                        </div>
                    ))}
                </div>

                {/* 메시지 */}
                <div className="px-6 py-4 text-center">
                    <p className="text-xs text-slate-400 font-fira leading-relaxed">
                        에테르가 흩어졌습니다. 하지만 기억은 남습니다.
                        <br />
                        <span className="text-cyber-blue">다시 접속하여 더 강해지세요.</span>
                    </p>
                </div>

                {/* 버튼 */}
                <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                    <Motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleShare}
                        className={`flex items-center justify-center gap-2 py-3 rounded border font-rajdhani font-bold text-sm transition-all
                            ${copied
                                ? 'bg-cyber-green/20 border-cyber-green text-cyber-green shadow-[0_0_15px_rgba(0,255,157,0.3)]'
                                : 'bg-cyber-blue/10 border-cyber-blue/40 text-cyber-blue hover:bg-cyber-blue/20 hover:shadow-[0_0_15px_rgba(0,204,255,0.3)]'
                            }`}
                    >
                        {copied ? <CheckCircle size={15} /> : <Share2 size={15} />}
                        {copied ? '복사 완료!' : '결과 공유'}
                    </Motion.button>

                    <Motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={onRestart}
                        className="flex items-center justify-center gap-2 py-3 rounded border border-red-500/50 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] font-rajdhani font-bold text-sm transition-all"
                    >
                        <RotateCcw size={15} />
                        다시 시작
                    </Motion.button>
                </div>
            </Motion.div>
        </Motion.div>
    );
};

export default RunSummaryCard;
