export type TrueEndingRevealState = 'narrative' | 'complete';

interface TrueEndingStar {
    w: number;
    top: string;
    left: string;
    dur: number;
    delay: number;
}

export const ENDING_LINES = Object.freeze([
    '오랜 싸움이 끝났습니다.',
    '원시의 신이 쓰러지며, 세계를 짓누르던 어둠이 서서히 걷힙니다.',
    '당신의 발자국은 이 땅에 영원히 새겨질 것입니다.',
    '수많은 죽음과 부활, 그리고 끝없는 싸움 끝에 — 마침내, 진정한 평화.',
    '이것이 영웅의 이야기입니다.',
]);

export const buildTrueEndingStars = (count: number): ReadonlyArray<Readonly<TrueEndingStar>> => (
    Object.freeze(Array.from({ length: Math.max(0, Math.trunc(count)) }, (_, index) => Object.freeze({
        w: 1 + ((index * 7) % 17) / 8,
        top: `${(index * 37 + 11) % 97}%`,
        left: `${(index * 61 + 7) % 99}%`,
        dur: 2 + ((index * 5) % 13) / 4,
        delay: ((index * 3) % 17) / 5,
    })))
);

export const TRUE_ENDING_STARS = buildTrueEndingStars(60);

export const getNextTrueEndingTimedStep = (lineIndex: number) => {
    const normalizedIndex = Math.min(
        ENDING_LINES.length,
        Math.max(0, Number.isFinite(lineIndex) ? Math.trunc(lineIndex) : 0),
    );
    if (normalizedIndex < ENDING_LINES.length) {
        return {
            delayMs: 1800,
            nextLineIndex: normalizedIndex + 1,
            revealState: 'narrative' as const,
        };
    }
    return {
        delayMs: 600,
        nextLineIndex: ENDING_LINES.length,
        revealState: 'complete' as const,
    };
};

export const resolveTrueEndingBackAction = (
    state: TrueEndingRevealState,
): 'reveal_all' | 'consume' => (
    state === 'narrative' ? 'reveal_all' : 'consume'
);
