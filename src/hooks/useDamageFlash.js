import { useEffect, useRef, useState } from 'react';

/**
 * useDamageFlash — HP 변화 시 데미지/회복 flash 및 float 숫자 상태를 생성합니다.
 * returns: { damageFlash, healFlash, damageAmount }
 */
export const useDamageFlash = (currentHp) => {
    const [damageFlash, setDamageFlash] = useState(false);
    const [healFlash, setHealFlash] = useState(false);
    const [damageAmount, setDamageAmount] = useState(null);
    const prevHpRef = useRef(currentHp);

    useEffect(() => {
        if (typeof currentHp !== 'number') return;

        const prev = prevHpRef.current;
        prevHpRef.current = currentHp;
        if (typeof prev !== 'number') return;

        const delta = currentHp - prev;
        if (delta === 0) return;

        const isHeal = delta > 0;
        setDamageFlash(!isHeal);
        setHealFlash(isHeal);
        setDamageAmount({ value: Math.abs(delta), isHeal });

        const flashTimer = setTimeout(() => {
            setDamageFlash(false);
            setHealFlash(false);
        }, 500);
        const amountTimer = setTimeout(() => {
            setDamageAmount(null);
        }, 1200);

        return () => {
            clearTimeout(flashTimer);
            clearTimeout(amountTimer);
        };
    }, [currentHp]);

    return { damageFlash, healFlash, damageAmount };
};
