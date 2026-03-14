import React from 'react';

const SIZE_CLASS = {
    sm: 'min-h-[20px] px-1.5 py-0.5 text-[8px] tracking-[0.16em]',
    md: 'min-h-[24px] px-2 py-0.5 text-[10px] tracking-[0.16em]',
    lg: 'min-h-[28px] px-2.5 py-1 text-[11px] tracking-[0.18em]',
};

const TONE_CLASS = {
    neutral: 'border-cyan-400/14 bg-slate-950/76 text-cyber-blue/78',
    recommended: 'border-cyan-300/28 bg-cyan-400/10 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.12)]',
    resonance: 'border-violet-400/28 bg-violet-500/10 text-violet-200 shadow-[0_0_12px_rgba(168,85,247,0.12)]',
    upgrade: 'border-amber-400/28 bg-amber-500/10 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)]',
    success: 'border-emerald-400/28 bg-emerald-500/10 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.12)]',
    warning: 'border-yellow-400/28 bg-yellow-500/10 text-yellow-200 shadow-[0_0_12px_rgba(234,179,8,0.12)]',
    danger: 'border-red-500/28 bg-red-950/25 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.12)]',
    equipped: 'border-emerald-400/24 bg-emerald-500/10 text-emerald-200',
    spotlight: 'border-violet-400/24 bg-violet-500/10 text-violet-200',
};

const SignalBadge = ({ tone = 'neutral', size = 'md', className = '', children }) => (
    <span
        className={`inline-flex items-center justify-center rounded-full border font-fira uppercase ${SIZE_CLASS[size] || SIZE_CLASS.md} ${TONE_CLASS[tone] || TONE_CLASS.neutral} ${className}`.trim()}
    >
        {children}
    </span>
);

export default SignalBadge;
