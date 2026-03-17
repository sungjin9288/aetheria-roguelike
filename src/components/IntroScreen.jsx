import React, { useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import AetherMark from './AetherMark';

const MOBILE_NAME_POOL = ['진', '리아', '카일', '세나', '루카', '시아', '하린', '레온'];
const randomMobileName = () => MOBILE_NAME_POOL[Math.floor(Math.random() * MOBILE_NAME_POOL.length)];

const IntroScreen = ({ onStart, mobile = false }) => {
    const [name, setName] = useState('');
    const mobileSuggestions = useMemo(() => MOBILE_NAME_POOL, []);

    const canStart = name.trim().length > 0;
    const selectedName = useMemo(() => name.trim(), [name]);

    const handleStart = () => {
        if (canStart) {
            onStart(selectedName, 'male', '모험가');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && canStart) handleStart();
    };

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`panel-noise w-full text-center relative overflow-hidden rounded-[1.75rem] border backdrop-blur-2xl shadow-[0_28px_90px_rgba(4,10,24,0.55)] ${
                mobile
                    ? 'max-w-xl border-cyan-500/20 bg-slate-950/90 px-5 py-6'
                    : 'max-w-2xl border-cyber-purple/25 bg-cyber-slate/80 p-6 md:p-8'
            }`}
        >
            <div className="absolute inset-0 opacity-70 pointer-events-none">
                <div className="absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute -bottom-24 right-0 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scanline" />

            <div className="relative z-10 mb-6 flex flex-col items-center gap-3">
                <AetherMark size={mobile ? 'md' : 'lg'} />
                <div>
                    <Motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className={`${mobile ? 'text-4xl' : 'text-5xl'} font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-500 mb-1 font-rajdhani drop-shadow-lg tracking-[0.18em]`}
                    >
                        AETHERIA
                    </Motion.h1>
                    <Motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 1 }}
                        className="font-fira text-[11px] tracking-[0.26em] text-cyan-200/70"
                    >
                        DUSK ARCHIVE INITIALIZED
                    </Motion.p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="rounded-full border border-cyan-400/16 bg-slate-950/72 px-2.5 py-1 text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/60">
                        Archive Field Client
                    </span>
                    <span className="rounded-full border border-emerald-400/16 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-fira uppercase tracking-[0.18em] text-emerald-200/80">
                        Mobile-Ready
                    </span>
                </div>
            </div>

            <AnimatePresence mode="wait">
                <Motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                >
                    {mobile ? (
                        <div className="space-y-3">
                            <p className="text-slate-400 text-sm font-fira">콜사인을 직접 정하거나 추천안을 고른 뒤 바로 시작하세요</p>
                            <div className="rounded-[1.35rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(8,16,28,0.92)_0%,rgba(5,9,18,0.96)_100%)] px-4 py-4 shadow-[0_18px_48px_rgba(2,8,20,0.3)]">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/45 font-fira">Callsign</div>
                                <input
                                    data-testid="intro-name-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="콜사인 입력"
                                    className="mt-2 w-full rounded-[1rem] border border-cyan-400/18 bg-slate-950/82 px-3 py-3 text-center font-rajdhani text-xl text-cyan-100 transition-all placeholder:text-cyan-200/25 focus:border-emerald-300 focus:outline-none focus:shadow-[0_0_28px_rgba(34,211,238,0.15)]"
                                    maxLength={16}
                                />
                                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                                    <span className="text-cyber-blue/45">{selectedName ? '기록 준비 완료' : '콜사인을 입력하세요'}</span>
                                    <span data-testid="intro-mobile-name" className="text-cyan-200/65">{selectedName || 'EMPTY'}</span>
                                </div>
                                <div className="mt-3 text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/45">추천 콜사인</div>
                                <div className="mt-2 grid grid-cols-4 gap-2">
                                    {mobileSuggestions.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setName(option)}
                                            className={`rounded-xl border px-2 py-2.5 text-sm font-rajdhani font-bold ${
                                                selectedName === option
                                                    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
                                                    : 'border-slate-700 bg-slate-900/70 text-slate-300'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        data-testid="intro-reroll-name"
                                        onClick={() => setName(randomMobileName())}
                                        className="flex-1 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-3 text-sm font-rajdhani font-bold text-cyan-200"
                                    >
                                        랜덤 생성
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setName('')}
                                        className="rounded-xl border border-slate-700 bg-slate-950/75 px-3 text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/65"
                                    >
                                        지우기
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-slate-400 text-sm font-fira">이름을 입력하세요</p>
                            <input
                                data-testid="intro-name-input"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="이름 입력"
                                className="w-full rounded-2xl border border-cyan-400/25 bg-slate-950/80 p-4 text-center font-rajdhani text-xl text-cyan-100 transition-all placeholder:text-cyan-200/25 focus:border-emerald-300 focus:outline-none focus:shadow-[0_0_28px_rgba(34,211,238,0.15)]"
                                autoFocus
                                maxLength={16}
                            />
                        </div>
                    )}
                </Motion.div>
            </AnimatePresence>

            <div className="flex mt-8">
                <Motion.button
                    data-testid="intro-start-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleStart}
                    disabled={!canStart}
                    className="flex-1 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 py-4 font-rajdhani font-bold text-emerald-200 transition-all hover:bg-emerald-400/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {mobile ? '여정 시작' : '기록 시작'}
                </Motion.button>
            </div>
        </Motion.div>
    );
};

export default IntroScreen;
