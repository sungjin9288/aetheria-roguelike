import { useEffect, useState } from 'react';

/** 2026-11 디자인 고도화 A2: 획득 수치가 떠 있는 시간 — 명세 400ms(CSS `ae-gain-float`와 같은 값). */
export const GAIN_FLOAT_MS = 400;

interface GainFloatProps {
    value: number;
    /** 복원(`presentationEpoch`)으로 바뀐 값은 떠오르지 않는다 — 실제로 번 만큼만 보인다(GF-13). */
    epoch: number | string;
    testId: string;
    className: string;
}

interface Seen {
    value: number;
    epoch: number | string;
}

interface Gain {
    amount: number;
    id: number;
}

/**
 * 값이 늘어난 순간 그 차이를 `+N`으로 잠깐 띄운다(상태 표시줄의 골드 · 경험 옆). 줄어든 값(지출 · 레벨 업으로 줄어든 경험)은 띄우지 않는다.
 * 표시만 한다 — 판정 · 기록 줄은 그대로다.
 */
const GainFloat = ({ value, epoch, testId, className }: GainFloatProps) => {
    const [seen, setSeen] = useState<Seen>({ value, epoch });
    const [gain, setGain] = useState<Gain | null>(null);

    if (seen.value !== value || seen.epoch !== epoch) {
        const delta = value - seen.value;
        setSeen({ value, epoch });
        if (seen.epoch === epoch && delta > 0) {
            setGain({ amount: delta, id: (gain?.id ?? 0) + 1 });
        }
    }

    const gainId = gain?.id ?? null;
    useEffect(() => {
        if (gainId === null) return undefined;
        const timer = window.setTimeout(() => setGain((current) => (current?.id === gainId ? null : current)), GAIN_FLOAT_MS);
        return () => window.clearTimeout(timer);
    }, [gainId]);

    if (!gain) return null;
    return (
        <span key={gain.id} data-testid={testId} aria-hidden="true" className={`ae-gain-float font-fira text-[11px] font-bold tabular-nums ${className}`}>
            +{gain.amount}
        </span>
    );
};

export default GainFloat;
