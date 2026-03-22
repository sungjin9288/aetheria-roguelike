import React from 'react';

const SIZE_CLASS = {
    sm: 'min-h-[20px] px-1.5 py-0.5 text-[8px] tracking-[0.16em]',
    md: 'min-h-[24px] px-2 py-0.5 text-[10px] tracking-[0.16em]',
    lg: 'min-h-[28px] px-2.5 py-1 text-[11px] tracking-[0.18em]',
};

const TONE_CLASS = {
    neutral: 'border-white/8 bg-white/[0.035] text-slate-300',
    recommended: 'border-[#7dd4d8]/28 bg-[#7dd4d8]/10 text-[#dff7f5] shadow-[0_10px_24px_rgba(125,212,216,0.12)]',
    resonance: 'border-[#9a8ac0]/28 bg-[#9a8ac0]/10 text-[#e3dcff] shadow-[0_10px_24px_rgba(154,138,192,0.12)]',
    upgrade: 'border-[#d5b180]/28 bg-[#d5b180]/10 text-[#f6e7c8] shadow-[0_10px_24px_rgba(213,177,128,0.12)]',
    success: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100 shadow-[0_10px_24px_rgba(110,231,183,0.1)]',
    warning: 'border-amber-300/24 bg-amber-300/10 text-amber-100 shadow-[0_10px_24px_rgba(252,211,77,0.1)]',
    danger: 'border-rose-300/24 bg-rose-400/10 text-rose-100 shadow-[0_10px_24px_rgba(251,113,133,0.1)]',
    equipped: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100',
    spotlight: 'border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8]',
};

const SignalBadge = ({ tone = 'neutral', size = 'md', className = '', children }) => (
    <span
        className={`inline-flex items-center justify-center rounded-full border font-fira uppercase backdrop-blur-md ${SIZE_CLASS[size] || SIZE_CLASS.md} ${TONE_CLASS[tone] || TONE_CLASS.neutral} ${className}`.trim()}
    >
        {children}
    </span>
);

export default SignalBadge;
