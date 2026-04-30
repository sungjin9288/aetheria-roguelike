import React from 'react';

const SIZE_MAP = {
    sm: {
        shell: 'h-8 w-8',
        ring: 'h-6 w-6',
        core: 'h-2.5 w-2.5',
        dot: 'h-1 w-1',
    },
    md: {
        shell: 'h-10 w-10',
        ring: 'h-7.5 w-7.5',
        core: 'h-3 w-3',
        dot: 'h-1.5 w-1.5',
    },
    lg: {
        shell: 'h-16 w-16',
        ring: 'h-12 w-12',
        core: 'h-4 w-4',
        dot: 'h-2 w-2',
    },
};

const AetherMark = ({ size = 'md', className = '' }) => {
    const scale = SIZE_MAP[size] || SIZE_MAP.md;

    return (
        <div className={`relative ${scale.shell} shrink-0 ${className}`.trim()} aria-hidden="true">
            <span className="absolute inset-0 rounded-full border border-cyan-400/28 bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.28),transparent_58%)] shadow-[0_0_28px_rgba(34,211,238,0.12)]" />
            <span className={`absolute left-1/2 top-1/2 ${scale.ring} -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/40 animate-aether-orbit`} />
            <span className={`absolute left-1/2 top-1/2 ${scale.ring} -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/24 rotate-45 animate-aether-orbit`} style={{ animationDelay: '-2.4s' }} />
            <span className={`absolute left-1/2 top-1/2 ${scale.core} -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[0.35rem] border border-cyan-200/55 bg-[linear-gradient(135deg,rgba(125,211,252,0.85),rgba(16,185,129,0.72))] shadow-[0_0_20px_rgba(34,211,238,0.28)] animate-aether-pulse`} />
            <span className={`absolute left-1/2 top-[18%] ${scale.dot} -translate-x-1/2 rounded-full bg-emerald-300/80 shadow-[0_0_12px_rgba(110,231,183,0.45)]`} />
        </div>
    );
};

export default AetherMark;
