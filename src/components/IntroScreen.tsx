import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion as Motion } from 'framer-motion';
import { Dices } from 'lucide-react';
import AetherMark from './AetherMark';
import ActionButton from './ui/ActionButton';
import { MSG } from '../data/messages';
import { CONSTANTS } from '../data/constants';
import { markPerfOnce, measurePerfOnce } from '../utils/performanceMarks';
import { createRandomMobileName } from '../utils/nameGenerator';
import { getChallengeSlotCount, toggleChallengeSelection } from '../utils/runStart';
import { getAscensionRulePreview } from '../utils/ascensionRuleView';
import ChallengeModifierPicker from './ChallengeModifierPicker';
import type { Player } from '../types';

interface IntroScreenProps {
    onStart?: (name: string, gender: 'male', job: '모험가', challenges: string[], declineRule?: boolean) => void;
    prestigeRank?: number;
    /** 2026-10 Wave 94: 이 단계에서 고른 회차 규칙(`meta.ascensionRule`)을 읽는다. 없으면 단계의 고정 순서. */
    meta?: Player['meta'];
}

const IntroScreen = ({ onStart, prestigeRank, meta }: IntroScreenProps) => {
    const [name, setName] = useState(() => createRandomMobileName(Math.random));
    const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
    const [ruleDeclined, setRuleDeclined] = useState(false);
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
        onStart?.(selectedName, 'male', '모험가', selectedChallenges, ruleDeclined);
    };

    const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') startAdventure();
    };

    return (
        <section
            data-testid="intro-screen"
            className="relative isolate min-h-full w-full flex-1 overflow-y-auto bg-ae-void text-ae-ink"
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
                transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            />
            {/* 그림 위아래를 밤하늘 · 땅으로 가라앉혀 제목과 입력 칸이 읽히게 한다(색은 토큰). */}
            <div aria-hidden="true" className="ae-intro-scrim pointer-events-none absolute inset-0" />

            <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[560px] flex-col px-5 pb-[calc(var(--aether-safe-area-bottom)+1rem)] pt-[calc(var(--aether-safe-area-top)+1.25rem)] sm:px-7">
                {/* VD-09: 제목은 하이 판타지 표제 — 금빛 문장과 한 줄 부제, 화면의 영어는 'AETHERIA' 하나다. */}
                <header className="flex items-center gap-3">
                    <AetherMark size="md" />
                    <div className="min-w-0">
                        <h1 className="ae-intro-title font-display text-[2rem] font-bold leading-none">
                            AETHERIA
                        </h1>
                        <p className="mt-1.5 flex items-center gap-2 font-readable text-[12px] text-ae-ink-2">
                            <span aria-hidden="true" className="ae-intro-rule" />
                            {MSG.SHELL_INTRO_TAGLINE}
                        </p>
                    </div>
                </header>

                <div className="mt-auto pt-60 sm:pt-72">
                    <div className="ae-intro-caption mb-4">
                        <p className="font-readable text-[12px] font-bold text-ae-ether-hi">{MSG.SHELL_INTRO_EYEBROW}</p>
                        <h2 data-testid="intro-location" className="mt-1 font-display text-3xl font-bold text-ae-ink">
                            {CONSTANTS.START_LOCATION}
                        </h2>
                        <p className="mt-1 font-readable text-sm text-ae-ink-2">
                            {MSG.SHELL_INTRO_LEAD}
                        </p>
                    </div>

                    <div
                        data-testid="intro-controls"
                        className="ae-sheet rounded-ae-xl px-4 pb-4 pt-4"
                    >
                        <label htmlFor="intro-name" className="ae-eyebrow font-readable">
                            {MSG.SHELL_INTRO_NAME_LABEL}
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
                                placeholder={MSG.SHELL_INTRO_NAME_PLACEHOLDER}
                                className="ae-intro-input ae-sunk min-h-12 min-w-0 flex-1 rounded-ae-sm px-4 text-base font-bold text-ae-ink outline-none placeholder:text-ae-ink-3"
                                maxLength={16}
                                autoComplete="off"
                            />
                            <ActionButton
                                variant="glass"
                                data-testid="intro-reroll-name"
                                onClick={() => applyName(createRandomMobileName(Math.random), true)}
                                className="h-12 w-12 shrink-0 px-0"
                                aria-label={MSG.SHELL_INTRO_REROLL}
                                title={MSG.SHELL_INTRO_REROLL}
                                label={<Dices size={19} aria-hidden="true" />}
                            />
                        </div>
                        <div data-testid="intro-mobile-name" className="sr-only">{selectedName}</div>

                        <ChallengeModifierPicker
                            testIdPrefix="intro"
                            rule={getAscensionRulePreview(meta ?? { prestigeRank })}
                            ruleDeclined={ruleDeclined}
                            onToggleRule={() => setRuleDeclined((current) => !current)}
                            selected={selectedChallenges}
                            slots={challengeSlots}
                            onToggle={toggleChallenge}
                        />

                        {/* 이 화면의 금빛 주 행동은 하나 — 모험 시작. */}
                        <ActionButton
                            data-testid="intro-start-button"
                            variant="primary"
                            size="lg"
                            onClick={startAdventure}
                            disabled={!canStart}
                            className="mt-3 min-h-12 w-full"
                            label="모험 시작"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntroScreen;
