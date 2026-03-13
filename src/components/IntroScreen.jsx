import React, { useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const MOBILE_NAME_POOL = ['진', '리아', '카일', '세나', '루카', '시아', '하린', '레온'];
const randomMobileName = () => MOBILE_NAME_POOL[Math.floor(Math.random() * MOBILE_NAME_POOL.length)];

const IntroScreen = ({ onStart, mobile = false }) => {
    const [name, setName] = useState(() => (mobile ? randomMobileName() : ''));

    const canStart = name.trim().length > 0;
    const selectedName = useMemo(() => name.trim(), [name]);

    const handleStart = () => {
        if (canStart) {
            onStart(name, 'male', '모험가'); // 기본값으로 'male' 전달 (내부 처리용)
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
            className={`w-full text-center relative overflow-hidden rounded-[1.75rem] border backdrop-blur-2xl shadow-[0_28px_90px_rgba(4,10,24,0.55)] ${
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
                className="mb-6 font-fira text-[11px] tracking-[0.26em] text-cyan-200/70"
            >
                DUSK ARCHIVE INITIALIZED
            </Motion.p>

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
                            <p className="text-slate-400 text-sm font-fira">이름을 고르고 바로 여정을 시작하세요</p>
                            <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/80 px-4 py-5">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/45 font-fira">현재 이름</div>
                                <div data-testid="intro-mobile-name" className="mt-2 text-3xl font-rajdhani font-bold text-cyan-100">
                                    {selectedName}
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        type="button"
                                        data-testid="intro-reroll-name"
                                        onClick={() => setName(randomMobileName())}
                                        className="flex-1 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-3 text-sm font-rajdhani font-bold text-cyan-200"
                                    >
                                        다른 이름
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="intro-name-jin"
                                        onClick={() => setName('진')}
                                        className={`rounded-xl border px-3 py-3 text-sm font-rajdhani font-bold ${
                                            selectedName === '진'
                                                ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
                                                : 'border-slate-700 bg-slate-900/70 text-slate-300'
                                        }`}
                                    >
                                        진
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

                    <div className="rounded-2xl border border-cyan-400/15 bg-slate-950/70 p-4 text-left shadow-inner">
                        <div className="mb-1 text-sm font-rajdhani font-bold tracking-[0.16em] text-cyan-200">
                            STARTING PATH: 모험가
                        </div>
                        <p className="text-xs text-slate-400 font-fira leading-relaxed">
                            시작 직업은 <span className="text-emerald-300">모험가</span>입니다.
                            레벨 5에 도달하면 <span className="text-violet-300">전사 / 마법사 / 도적</span>으로 전직할 수 있습니다.
                        </p>
                    </div>
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
                    {mobile ? '여정 시작' : '모험가로 시작'}
                </Motion.button>
            </div>
        </Motion.div>
    );
};

export default IntroScreen;
