import { useEffect, useRef, useState } from 'react';

const EMPTY_FEEDBACK = {
    damageFlash: false,
    healFlash: false,
    damageAmount: null as { value: number; isHeal: boolean } | null,
};

// 저장 복원은 HP 기준만 교체하고, 같은 epoch의 실제 변화만 연출합니다.
export const useDamageFlash = (currentHp: number | undefined, resetEpoch: number) => {
    const [feedback, setFeedback] = useState({ ...EMPTY_FEEDBACK, epoch: resetEpoch });
    const prevHpRef = useRef(currentHp);
    const epochRef = useRef(resetEpoch);

    useEffect(() => {
        if (epochRef.current !== resetEpoch) {
            epochRef.current = resetEpoch;
            prevHpRef.current = currentHp;
            setFeedback({ ...EMPTY_FEEDBACK, epoch: resetEpoch });
            return;
        }
        if (typeof currentHp !== 'number') return;

        const prev = prevHpRef.current;
        prevHpRef.current = currentHp;
        if (typeof prev !== 'number') return;

        const delta = currentHp - prev;
        if (delta === 0) return;

        const isHeal = delta > 0;
        setFeedback({
            epoch: resetEpoch,
            damageFlash: !isHeal,
            healFlash: isHeal,
            damageAmount: { value: Math.abs(delta), isHeal },
        });

        const flashTimer = setTimeout(() => {
            setFeedback((current) => ({ ...current, damageFlash: false, healFlash: false }));
        }, 500);
        const amountTimer = setTimeout(() => {
            setFeedback((current) => ({ ...current, damageAmount: null }));
        }, 1200);

        return () => {
            clearTimeout(flashTimer);
            clearTimeout(amountTimer);
        };
    }, [currentHp, resetEpoch]);

    const { epoch, ...visibleFeedback } = feedback;
    return epoch === resetEpoch ? visibleFeedback : EMPTY_FEEDBACK;
};
