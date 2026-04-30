// @ts-nocheck — TODO: cycle 58+ migration (JSDoc 기반 props 보존)
import React from 'react';
import { motion as Motion } from 'framer-motion';

/**
 * ArchiveTabButton — Dashboard 탭 선택 버튼 (모바일/데스크탑 공용)
 */
const ArchiveTabButton = ({ icon, label, active = false, onClick, compact = false, rail = false, dense = false, iconOnly = false, testId = null, badge = null, badgeTitle = null }) => {
    const Icon = icon;
    const frameClass = rail
        ? 'flex min-h-[32px] shrink-0 items-center justify-center gap-1 rounded-full px-2 py-1'
        : dense
            ? iconOnly
                ? 'flex min-h-[27px] items-center justify-center gap-0 rounded-[0.8rem] px-0.5 py-0.5'
                : 'flex min-h-[30px] items-center justify-center gap-0.5 rounded-[0.95rem] px-0.75 py-0.75 flex-col'
            : 'flex flex-col items-center justify-center gap-1 rounded-[1.1rem]';
    const heightClass = rail || dense ? '' : compact ? 'min-h-[40px]' : 'min-h-[52px]';

    return (
        <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            data-testid={testId}
            title={label}
            className={`relative border ${dense ? 'px-1 py-1' : 'px-2 py-1.5'} transition-all backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${
                active
                    ? 'border-[#7dd4d8]/26 bg-[radial-gradient(circle_at_82%_10%,rgba(213,177,128,0.12),transparent_26%),linear-gradient(180deg,rgba(125,212,216,0.18)_0%,rgba(18,28,34,0.18)_100%)] text-[#e4f7f5] shadow-[0_16px_30px_rgba(125,212,216,0.12)]'
                    : 'text-slate-300/65 border-white/8 hover:border-[#d5b180]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]'
            } ${frameClass} ${heightClass}`}
        >
            <Icon size={rail ? 11 : dense ? (iconOnly ? 11 : 12) : 14} />
            {iconOnly ? (
                <span className="sr-only">{label}</span>
            ) : (
                <span className={`${rail ? 'text-[8px] tracking-[0.1em]' : dense ? 'text-[8px] tracking-[0.12em]' : 'text-[8px] tracking-[0.14em]'} font-fira uppercase`}>
                    {label}
                </span>
            )}
            {badge != null && (
                <span
                    title={badgeTitle || undefined}
                    data-testid={testId ? `${testId}-badge` : undefined}
                    className="pointer-events-none absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full border border-[#f6e7a2]/50 bg-[linear-gradient(180deg,rgba(246,231,162,0.22)_0%,rgba(64,48,12,0.85)_100%)] px-1 text-[8px] font-fira font-bold leading-[12px] text-[#f6e7a2] shadow-[0_2px_6px_rgba(246,231,162,0.22)]"
                >
                    {badge}
                </span>
            )}
        </Motion.button>
    );
};

export default ArchiveTabButton;
