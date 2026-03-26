import React, { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Star } from 'lucide-react';

const STARS = Array.from({ length: 60 }, () => ({
    w: Math.random() * 2 + 1,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    dur: Math.random() * 3 + 2,
    delay: Math.random() * 3,
}));

const ENDING_LINES = [
    '오랜 싸움이 끝났습니다.',
    '원시의 신이 쓰러지며, 세계를 짓누르던 어둠이 서서히 걷힙니다.',
    '당신의 발자국은 이 땅에 영원히 새겨질 것입니다.',
    '수많은 죽음과 부활, 그리고 끝없는 싸움 끝에 — 마침내, 진정한 평화.',
    '이것이 영웅의 이야기입니다.',
];

const TrueEndingScreen = ({ player, actions }) => {
    const [lineIndex, setLineIndex] = useState(0);
    const [showStats, setShowStats] = useState(false);
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        if (lineIndex < ENDING_LINES.length) {
            const t = setTimeout(() => setLineIndex((i) => i + 1), 1800);
            return () => clearTimeout(t);
        } else {
            const t1 = setTimeout(() => setShowStats(true), 600);
            const t2 = setTimeout(() => setShowButton(true), 1800);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [lineIndex]);

    const stats = [
        { label: '총 처치', value: (player?.stats?.kills || 0).toLocaleString() },
        { label: '보스 처치', value: player?.stats?.bossKills || 0 },
        { label: '사망 횟수', value: player?.stats?.deaths || 0 },
        { label: '최고 심연층', value: player?.stats?.abyssFloor || 0 },
        { label: '에테르 환생', value: player?.meta?.prestigeRank || 0 },
        { label: '마왕 토벌', value: player?.stats?.demonKingSlain || 0 },
    ];

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
            {/* Star field background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {STARS.map((s, i) => (
                    <Motion.div
                        key={i}
                        className="absolute rounded-full bg-white"
                        style={{ width: s.w, height: s.w, top: s.top, left: s.left }}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
                    />
                ))}
            </div>

            {/* Title */}
            <Motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.5 }}
                className="mb-10 flex flex-col items-center gap-3"
            >
                <Star size={28} className="text-[#d5b180]" />
                <h1 className="font-fira text-[13px] tracking-[0.4em] uppercase text-[#d5b180]">True Ending</h1>
                <p className="text-[11px] text-slate-400 font-fira tracking-widest">{player?.name || '영웅'} — Lv.{player?.level || 1} {player?.job || '모험가'}</p>
            </Motion.div>

            {/* Narrative lines */}
            <div className="w-full max-w-md px-6 mb-10 space-y-4 min-h-[140px]">
                {ENDING_LINES.slice(0, lineIndex).map((line, i) => (
                    <Motion.p
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className={`text-center font-fira text-[11px] leading-relaxed ${i === lineIndex - 1 ? 'text-[#f4e6c8]' : 'text-slate-400'}`}
                    >
                        {line}
                    </Motion.p>
                ))}
            </div>

            {/* Stats */}
            {showStats && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                    className="w-full max-w-sm px-6 mb-10"
                >
                    <div className="rounded-[1.2rem] border border-[#d5b180]/20 bg-[#d5b180]/5 p-4 grid grid-cols-3 gap-3">
                        {stats.map(({ label, value }) => (
                            <div key={label} className="flex flex-col items-center gap-1">
                                <span className="text-[16px] font-bold text-[#f4e6c8] font-fira">{value}</span>
                                <span className="text-[8px] text-slate-500 font-fira uppercase tracking-wider">{label}</span>
                            </div>
                        ))}
                    </div>
                </Motion.div>
            )}

            {/* New Game+ button */}
            {showButton && (
                <Motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-center gap-3"
                >
                    <button
                        onClick={() => actions?.confirmAscension?.()}
                        className="px-8 py-3 rounded-[1.2rem] border border-[#d5b180]/40 bg-[#d5b180]/12 text-[#d5b180] font-fira text-[10px] uppercase tracking-[0.3em] hover:bg-[#d5b180]/20 hover:border-[#d5b180]/60 transition-all"
                    >
                        New Game+
                    </button>
                    <p className="text-[8px] text-slate-600 font-fira">프레스티지 보너스를 유지한 채로 처음부터</p>
                </Motion.div>
            )}
        </div>
    );
};

export default TrueEndingScreen;
