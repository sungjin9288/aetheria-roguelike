import React from 'react';

/**
 * DamageNumber — 데미지/회복 float 숫자 오버레이
 */
const DamageNumber = ({ amount }) => {
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

export default DamageNumber;
