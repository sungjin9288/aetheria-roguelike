import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import AetherMark from './AetherMark';
import { markPerfOnce, measurePerfOnce } from '../utils/performanceMarks';
import { BALANCE } from '../data/constants';

const MOBILE_NAME_POOL = ['진', '리아', '카일', '세나', '루카', '시아', '하린', '레온'];
const randomMobileName = () => MOBILE_NAME_POOL[Math.floor(Math.random() * MOBILE_NAME_POOL.length)];

const CHALLENGE_REWARD_TEXT = ['', '+20% 보상', '+50% 보상', '+100% 보상'];

const IntroScreen = ({ onStart, mobile = false }) => {
    const [name, setName] = useState('');
    const [selectedChallenges, setSelectedChallenges] = useState([]);
    const mobileSuggestions = useMemo(() => MOBILE_NAME_POOL, []);

    const toggleChallenge = (id) => {
        setSelectedChallenges(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id].slice(0, 3)
        );
    };

    useEffect(() => {
        markPerfOnce('aetheria:intro-visible');
        measurePerfOnce('aetheria:intro-visible-ms', 'aetheria:app-mounted', 'aetheria:intro-visible');
    }, []);

    const canStart = name.trim().length > 0;
    const selectedName = useMemo(() => name.trim(), [name]);

    const handleStart = () => {
        if (canStart) {
            onStart(selectedName, 'male', '모험가', selectedChallenges);
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
            className={`panel-noise aether-surface-strong relative w-full overflow-hidden text-center ${
                mobile
                    ? 'max-w-xl rounded-[2rem] px-5 py-6'
                    : 'max-w-2xl rounded-[2.2rem] p-6 md:p-8'
            }`}
        >
            <div className="absolute inset-0 opacity-70 pointer-events-none">
                <div className="absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[#d5b180]/10 blur-3xl" />
                <div className="absolute -bottom-24 right-0 h-40 w-40 rounded-full bg-[#7dd4d8]/10 blur-3xl" />
            </div>
            <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="relative z-10 mb-6 flex flex-col items-center gap-3">
                <AetherMark size={mobile ? 'md' : 'lg'} />
                <div>
                    <Motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className={`${mobile ? 'text-4xl' : 'text-5xl'} mb-1 bg-gradient-to-r from-[#f4e6c8] via-[#b3ece7] to-[#82c7d4] bg-clip-text font-rajdhani font-bold tracking-[0.18em] text-transparent`}
                    >
                        AETHERIA
                    </Motion.h1>
                    <Motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 1 }}
                        className="font-fira text-[11px] tracking-[0.26em] text-[#d7dde4]/62"
                    >
                        MOONLIT FIELD LEDGER
                    </Motion.p>
                </div>
                <p className="max-w-[32rem] text-[12px] font-fira leading-relaxed text-slate-300/78">
                    쇠락한 지대의 기록을 수집하고, 매 회차 다른 유물과 선택으로 살아남는 로그북형 roguelike.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-300/80">
                        Archive Client
                    </span>
                    <span className="rounded-full border border-[#d5b180]/18 bg-[#d5b180]/10 px-2.5 py-1 text-[10px] font-fira uppercase tracking-[0.18em] text-[#f4e6c8]/82">
                        Ruin Survey
                    </span>
                    <span className="rounded-full border border-[#7dd4d8]/18 bg-[#7dd4d8]/10 px-2.5 py-1 text-[10px] font-fira uppercase tracking-[0.18em] text-[#dff7f5]/82">
                        Touch + Desktop
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
                            <p className="text-sm font-fira text-slate-300/72">콜사인을 정하고 기록을 열면 바로 첫 탐사가 시작됩니다.</p>
                            <div className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(13,18,26,0.88)_0%,rgba(8,11,17,0.95)_100%)] px-4 py-4 shadow-[0_18px_48px_rgba(2,8,20,0.3)]">
                                <div className="text-[11px] font-fira uppercase tracking-[0.2em] text-slate-400/70">Callsign</div>
                                <input
                                    data-testid="intro-name-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="콜사인 입력"
                                    className="mt-2 w-full rounded-[1.15rem] border border-white/10 bg-black/28 px-3 py-3 text-center font-rajdhani text-xl text-[#f0f6f7] transition-all placeholder:text-slate-500 focus:border-[#7dd4d8]/35 focus:outline-none focus:shadow-[0_0_28px_rgba(125,212,216,0.12)]"
                                    maxLength={16}
                                />
                                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                                    <span className="text-slate-400/65">{selectedName ? '기록 준비 완료' : '콜사인을 입력하세요'}</span>
                                    <span data-testid="intro-mobile-name" className="text-[#dff7f5]/70">{selectedName || 'EMPTY'}</span>
                                </div>
                                <div className="mt-3 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/65">추천 콜사인</div>
                                <div className="mt-2 grid grid-cols-4 gap-2">
                                    {mobileSuggestions.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setName(option)}
                                            className={`rounded-xl border px-2 py-2.5 text-sm font-rajdhani font-bold ${
                                                selectedName === option
                                                    ? 'border-[#7dd4d8]/30 bg-[#7dd4d8]/12 text-[#dff7f5]'
                                                    : 'border-white/8 bg-black/24 text-slate-300'
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
                                        className="flex-1 rounded-xl border border-[#d5b180]/24 bg-[#d5b180]/10 px-3 py-3 text-sm font-rajdhani font-bold text-[#f4e6c8]"
                                    >
                                        랜덤 생성
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setName('')}
                                        className="rounded-xl border border-white/8 bg-black/24 px-3 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/80"
                                    >
                                        지우기
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm font-fira text-slate-300/72">콜사인을 입력하면 폐허 지대 원정 기록이 활성화됩니다.</p>
                            <input
                                data-testid="intro-name-input"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="콜사인 입력"
                                className="w-full rounded-[1.4rem] border border-white/10 bg-black/28 p-4 text-center font-rajdhani text-xl text-[#eff6f7] transition-all placeholder:text-slate-500 focus:border-[#7dd4d8]/35 focus:outline-none focus:shadow-[0_0_28px_rgba(125,212,216,0.12)]"
                                autoFocus
                                maxLength={16}
                            />
                        </div>
                    )}
                </Motion.div>
            </AnimatePresence>

            {/* Challenge Modifiers */}
            <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/70">Challenge Modifiers</span>
                    {selectedChallenges.length > 0 && (
                        <span className="text-[10px] font-fira text-[#d5b180]">{CHALLENGE_REWARD_TEXT[selectedChallenges.length]}</span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    {BALANCE.CHALLENGE_MODIFIERS.map(mod => {
                        const isSelected = selectedChallenges.includes(mod.id);
                        return (
                            <button
                                key={mod.id}
                                type="button"
                                onClick={() => toggleChallenge(mod.id)}
                                className={`rounded-[1rem] border px-2.5 py-2 text-left transition-all ${
                                    isSelected
                                        ? 'border-[#d5b180]/38 bg-[#d5b180]/12 text-[#f6e7c8]'
                                        : 'border-white/8 bg-black/16 text-slate-400 hover:border-white/14 hover:text-slate-300'
                                }`}
                            >
                                <div className="text-[11px] font-rajdhani font-bold">{mod.label}</div>
                                <div className="text-[9px] font-fira text-slate-500 leading-snug mt-0.5">{mod.desc}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex mt-6">
                <Motion.button
                    data-testid="intro-start-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleStart}
                    disabled={!canStart}
                    className="flex-1 rounded-[1.4rem] border border-[#7dd4d8]/24 bg-[linear-gradient(180deg,rgba(125,212,216,0.18)_0%,rgba(125,212,216,0.08)_100%)] py-4 font-rajdhani font-bold tracking-[0.16em] text-[#e6f6f6] transition-all hover:border-[#d5b180]/28 hover:bg-[linear-gradient(180deg,rgba(213,177,128,0.18)_0%,rgba(125,212,216,0.12)_100%)] hover:shadow-[0_22px_40px_rgba(125,212,216,0.12)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {mobile ? '기록 개시' : 'FIELD LEDGER OPEN'}
                </Motion.button>
            </div>
        </Motion.div>
    );
};

export default IntroScreen;
