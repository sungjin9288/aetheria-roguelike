import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowRight, Dices } from 'lucide-react';
import AetherMark from './AetherMark';
import { markPerfOnce, measurePerfOnce } from '../utils/performanceMarks';
import { createRandomMobileName } from '../utils/nameGenerator';
import { getChallengeSlotCount, toggleChallengeSelection } from '../utils/runStart';
import { getAscensionRulePreview } from '../utils/ascensionRuleView';
import ChallengeModifierPicker from './ChallengeModifierPicker';

interface IntroScreenProps {
    onStart?: (name: string, gender: 'male', job: '모험가', challenges: string[]) => void;
    prestigeRank?: number;
}

const IntroScreen = ({ onStart, prestigeRank }: IntroScreenProps) => {
    const [name, setName] = useState(() => createRandomMobileName(Math.random));
    const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const challengeSlots = getChallengeSlotCount(prestigeRank);

    useEffect(() => {
        markPerfOnce('aetheria:intro-visible');
        measurePerfOnce('aetheria:intro-visible-ms', 'aetheria:app-mounted', 'aetheria:intro-visible');
    }, []);

    const selectedName = useMemo(() => name.trim(), [name]);
    const canStart = selectedName.length > 0;

    const toggleChallenge = (id: string) => {
        setSelectedChallenges((current) => toggleChallengeSelection(current, id, challengeSlots));
    };

    const applyName = (nextName: string, dismissKeyboard: boolean) => {
        setName(nextName);
        if (dismissKeyboard) nameInputRef.current?.blur();
    };

    const startAdventure = () => {
        if (!canStart) return;

        nameInputRef.current?.blur();
        onStart?.(selectedName, 'male', '모험가', selectedChallenges);
    };

    const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') startAdventure();
    };

    return (
        <section
            data-testid="intro-screen"
            className="relative isolate min-h-full w-full flex-1 overflow-y-auto bg-[#03070d] text-slate-100"
        >
            {/*
              배경 이미지에만 페이드를 건다 — 루트가 opacity:0에서 시작하면
              Chromium이 그 서브트리 안의 페인트를 first-contentful-paint로
              집계하지 않는다(합성 전용 opacity 애니메이션도 별도 paint 이벤트가
              없다). 텍스트/입력/버튼은 항상 opacity:1로 첫 프레임에 그려야
              FCP/LCP가 정상 측정된다.
            */}
            <Motion.img
                data-testid="intro-background"
                src="/assets/intro/aetheria-starting-village.webp"
                alt=""
                aria-hidden="true"
                fetchPriority="high"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,13,0.82)_0%,rgba(3,7,13,0.08)_30%,rgba(3,7,13,0.1)_55%,rgba(3,7,13,0.95)_82%,#03070d_100%)]"
            />

            <div className="relative z-10 flex min-h-full flex-col px-5 pb-[calc(var(--aether-safe-area-bottom)+1rem)] pt-[calc(var(--aether-safe-area-top)+1.25rem)] sm:px-7">
                <header className="flex items-center gap-3">
                    <AetherMark size="md" />
                    <div>
                        <h1 className="font-rajdhani text-[2rem] font-bold leading-none text-[#f4e6c8]">
                            AETHERIA
                        </h1>
                        <p className="mt-1 font-readable text-xs text-slate-300/80">
                            달빛 아래 펼쳐지는 모험
                        </p>
                    </div>
                </header>

                <div className="mt-auto pt-64 sm:pt-72">
                    <div className="mb-4 text-shadow-sm">
                        <p className="font-readable text-xs font-bold text-[#83d8d5]">첫 여정</p>
                        <h2 data-testid="intro-location" className="mt-1 font-rajdhani text-3xl font-bold text-white">
                            시작의 마을
                        </h2>
                        <p className="mt-1 font-readable text-sm text-slate-200/80">
                            당신의 이름이 이곳의 첫 기록이 됩니다.
                        </p>
                    </div>

                    <div
                        data-testid="intro-controls"
                        className="border-t border-white/20 bg-[rgba(3,7,13,0.88)] pt-4 backdrop-blur-md"
                    >
                        <label htmlFor="intro-name" className="font-readable text-xs font-bold text-slate-300">
                            모험가의 이름
                        </label>
                        <div className="mt-2 flex items-center gap-2">
                            <input
                                id="intro-name"
                                ref={nameInputRef}
                                data-testid="intro-name-input"
                                type="text"
                                value={name}
                                onChange={(event) => applyName(event.target.value, false)}
                                onKeyDown={handleNameKeyDown}
                                placeholder="이름 입력"
                                className="min-h-12 min-w-0 flex-1 rounded-md border border-white/20 bg-[rgba(10,17,25,0.94)] px-4 text-base font-bold text-white outline-none transition-colors placeholder:text-slate-500 focus:border-[#83d8d5]"
                                maxLength={16}
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                data-testid="intro-reroll-name"
                                onClick={() => applyName(createRandomMobileName(Math.random), true)}
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/20 bg-[rgba(10,17,25,0.94)] text-[#f4e6c8] transition-colors hover:border-[#d5b180]"
                                aria-label="이름 다시 뽑기"
                                title="이름 다시 뽑기"
                            >
                                <Dices size={19} aria-hidden="true" />
                            </button>
                        </div>
                        <div data-testid="intro-mobile-name" className="sr-only">{selectedName}</div>

                        <ChallengeModifierPicker
                            testIdPrefix="intro"
                            rule={getAscensionRulePreview(prestigeRank)}
                            selected={selectedChallenges}
                            slots={challengeSlots}
                            onToggle={toggleChallenge}
                        />

                        <Motion.button
                            data-testid="intro-start-button"
                            whileTap={{ scale: 0.98 }}
                            onClick={startAdventure}
                            disabled={!canStart}
                            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-[rgba(131,216,213,0.45)] bg-[rgba(17,53,58,0.94)] px-4 font-readable text-base font-bold text-[#eafafa] transition-colors hover:bg-[#16434a] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            모험 시작
                            <ArrowRight size={18} aria-hidden="true" />
                        </Motion.button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntroScreen;
