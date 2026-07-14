import { useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import AetherMark from './AetherMark';
import { markPerfOnce, measurePerfOnce } from '../utils/performanceMarks';
import { BALANCE } from '../data/constants';
import { createRandomMobileName } from '../utils/nameGenerator';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks';

const CHALLENGE_REWARD_TEXT: any = ['', '+20% 보상', '+50% 보상', '+100% 보상', '+150% 보상'];

// cycle 402: `mobile?: boolean;` 제거 — 본체 destructure 미사용 + read 0건.
//   App.tsx가 `mobile` prop pass했으나 silent dropped (paired remove).
interface IntroScreenProps {
    onStart?: (...args: any[]) => void;
    prestigeRank?: number;
}

const IntroScreen = ({ onStart, prestigeRank }: IntroScreenProps) => {
    const [name, setName] = useState(() => createRandomMobileName(Math.random));
    const [selectedChallenges, setSelectedChallenges] = useState<any[]>([]);
    const nameInputRef = useRef<any>(null);

    // feat/prestige-rank-ladder: rank≥7 "심연의 서약" — 챌린지 모디파이어 슬롯 +1(3→4).
    const challengeSlots = BALANCE.CHALLENGE_MODIFIER_SLOTS + getPrestigeUnlocks(prestigeRank).challengeSlotBonus;

    const toggleChallenge = (id: any) => {
        setSelectedChallenges(prev =>
            prev.includes(id) ? prev.filter((c: any) => c !== id) : [...prev, id].slice(0, challengeSlots)
        );
    };

    const blurMobileInput = () => {
        nameInputRef.current?.blur();
    };

    // cycle 608: dismissKeyboard default false 제거 — explicit default-elimination
    //   pattern. line 109 caller에 false 명시 추가하여 default unreachable 전환.
    //   line 118 caller는 true 명시 보존. 신규 lens (active conversion).
    const applyName = (nextName: any, dismissKeyboard: any) => {
        setName(nextName);
        if (dismissKeyboard) {
            blurMobileInput();
        }
    };

    useEffect(() => {
        markPerfOnce('aetheria:intro-visible');
        measurePerfOnce('aetheria:intro-visible-ms', 'aetheria:app-mounted', 'aetheria:intro-visible');
    }, []);

    const canStart = name.trim().length > 0;
    const selectedName = useMemo(() => name.trim(), [name]);

    const handleStart = () => {
        if (canStart) {
            blurMobileInput();
            onStart?.(selectedName, 'male', '모험가', selectedChallenges);
        }
    };

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && canStart) handleStart();
    };

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="panel-noise aether-surface-strong relative w-full overflow-hidden text-center max-w-xl shrink-0 rounded-[2rem] px-4 py-5"
        >
            <div className="absolute inset-0 opacity-70 pointer-events-none">
                <div className="absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[#d5b180]/10 blur-3xl" />
                <div className="absolute -bottom-24 right-0 h-40 w-40 rounded-full bg-[#7dd4d8]/10 blur-3xl" />
            </div>
            <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="relative z-10 flex flex-col items-center mb-5 gap-2">
                <AetherMark size="md" />
                <div>
                    <Motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="text-[2.75rem] mb-1 bg-gradient-to-r from-[#f4e6c8] via-[#b3ece7] to-[#82c7d4] bg-clip-text font-rajdhani font-bold tracking-[0.18em] text-transparent"
                    >
                        AETHERIA
                    </Motion.h1>
                    <Motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 1 }}
                        className="font-fira text-[11px] tracking-[0.26em] text-[#d7dde4]/62"
                    >
                        달빛 아래 펼쳐지는 모험
                    </Motion.p>
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
                    <div className="space-y-3">
                        <div className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(13,18,26,0.88)_0%,rgba(8,11,17,0.95)_100%)] px-4 py-4">
                            <div className="flex items-center gap-2">
                                <input
                                    ref={nameInputRef}
                                    data-testid="intro-name-input"
                                    type="text"
                                    value={name}
                                    onChange={(e: any) => applyName(e.target.value, false)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="닉네임 입력"
                                    className="w-full rounded-[1.15rem] border border-[#d5b180]/20 bg-[#f6e7c8] px-3 py-3 text-center font-rajdhani text-xl text-black transition-all placeholder:text-black/38 focus:border-[#7dd4d8]/35 focus:outline-none focus:shadow-[0_0_28px_rgba(125,212,216,0.12)]"
                                    maxLength={16}
                                />
                                <button
                                    type="button"
                                    data-testid="intro-reroll-name"
                                    onClick={() => applyName(createRandomMobileName(Math.random), true)}
                                    className="shrink-0 rounded-[1.05rem] border border-[#d5b180]/24 bg-[#d5b180]/10 px-3 py-3 text-[11px] font-rajdhani font-bold tracking-[0.14em] text-[#f4e6c8]"
                                >
                                    랜덤
                                </button>
                            </div>
                            <div data-testid="intro-mobile-name" className="sr-only">{selectedName}</div>
                            <div className="mt-2 text-[10px] font-readable leading-relaxed text-slate-400/70">
                                마음에 드는 이름으로 바꾼 뒤 바로 시작할 수 있습니다.
                            </div>
                        </div>
                    </div>
                </Motion.div>
            </AnimatePresence>

            <details
                data-testid="intro-challenge-settings"
                className="group mt-5 rounded-[1.35rem] border border-white/8 bg-black/16 px-3 py-3 text-left"
            >
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div>
                        <div className="text-[11px] font-readable font-bold text-slate-200/88">도전 설정 <span className="font-normal text-slate-400/72">(선택)</span></div>
                        <div className="mt-0.5 text-[9px] font-readable text-slate-500/82">처음이라면 선택하지 않아도 됩니다.</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[9px] font-readable text-slate-400/78">{selectedChallenges.length}/{challengeSlots}</span>
                        <ChevronDown size={14} className="text-slate-400/72 transition-transform group-open:rotate-180" />
                    </div>
                </summary>
                <div className="border-t border-white/6 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-[9px] font-readable leading-relaxed">
                        <span className="text-slate-400/76">더 어려운 규칙을 선택하면 전투 보상이 늘어납니다.</span>
                        {selectedChallenges.length > 0 && (
                            <span className="shrink-0 text-[#d5b180]">{CHALLENGE_REWARD_TEXT[selectedChallenges.length]}</span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                    {BALANCE.CHALLENGE_MODIFIERS.map((mod: any) => {
                        const isSelected = selectedChallenges.includes(mod.id);
                        return (
                            <button
                                key={mod.id}
                                type="button"
                                data-testid={`intro-challenge-${mod.id}`}
                                aria-pressed={isSelected}
                                onClick={() => toggleChallenge(mod.id)}
                                className={`min-h-[4.7rem] rounded-[1rem] border px-2.5 py-2 text-left transition-all ${
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
            </details>

            <div className="mt-5 space-y-2">
                <p className="text-[10px] font-readable leading-relaxed text-slate-400/65">
                    준비되면 첫 마을에서 바로 모험을 시작합니다.
                </p>
                <div className="flex">
                    <Motion.button
                        data-testid="intro-start-button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleStart}
                        disabled={!canStart}
                        className="aether-cta-primary flex-1 rounded-[1.15rem] font-rajdhani font-bold text-[#e6f6f6] disabled:cursor-not-allowed disabled:opacity-40 py-3.5 text-[0.95rem] tracking-[0.18em]"
                    >
                        모험 시작
                    </Motion.button>
                </div>
            </div>
        </Motion.div>
    );
};

export default IntroScreen;
