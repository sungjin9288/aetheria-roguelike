import { useState, useEffect, useRef } from 'react';

/**
 * useDamageFlash — HP 변화 시 데미지 flash 및 float 숫자 애니메이션 (Feature #5)
 * returns: { damageFlash, damageAmount, prevHp }
 */
export const useDamageFlash = (currentHp) => {
    const [damageFlash, setDamageFlash] = useState(false);
    const [healFlash, setHealFlash] = useState(false);
    const [damageAmount, setDamageAmount] = useState(null);
    const prevHpRef = useRef(currentHp);

    useEffect(() => {
        const prev = prevHpRef.current;
        const delta = currentHp - prev;
        prevHpRef.current = currentHp;

        if (delta === 0) return;

        const t0 = setTimeout(() => {
            if (delta < 0) {
                setDamageFlash(true);
                setDamageAmount({ value: Math.abs(delta), isHeal: false });
                const t1 = setTimeout(() => setDamageFlash(false), 500);
                const t2 = setTimeout(() => setDamageAmount(null), 1200);
                return () => { clearTimeout(t1); clearTimeout(t2); };
            } else {
                setHealFlash(true);
                setDamageAmount({ value: delta, isHeal: true });
                const t1 = setTimeout(() => setHealFlash(false), 500);
                const t2 = setTimeout(() => setDamageAmount(null), 1200);
                return () => { clearTimeout(t1); clearTimeout(t2); };
            }
        }, 0);
        return () => clearTimeout(t0);
    }, [currentHp]);

    return { damageFlash, healFlash, damageAmount };
};

/**
 * DamageNumber — 데미지/힐 float 숫자 오버레이 (CSS 애니메이션)
 */
export const DamageNumber = ({ amount }) => {
    if (!amount) return null;
    return (
        <span
            className={`absolute -top-6 left-1/2 -translate-x-1/2 font-rajdhani font-bold text-sm pointer-events-none
                animate-[floatUp_1.2s_ease-out_forwards]
                ${amount.isHeal ? 'text-cyber-green' : 'text-red-400'}`}
            style={{
                animation: 'floatUp 1.2s ease-out forwards',
                whiteSpace: 'nowrap',
            }}
        >
            {amount.isHeal ? '+' : '-'}{amount.value}
        </span>
    );
};
