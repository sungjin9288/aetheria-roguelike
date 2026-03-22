import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import { GS } from '../reducers/gameStates';

/**
 * QuickSlot — 빠른 소모품 슬롯 (Feature #8)
 * props:
 *   slots: [item | null, item | null, item | null]
 *   onUse: (item) => void
 *   onAssign: (slotIdx, item) => void
 *   onUnassign: (slotIdx) => void
 *   gameState: string
 */
const QuickSlot = ({ slots = [null, null, null], onUse, gameState, dense = false }) => {
    const canUse = gameState === GS.COMBAT || gameState === GS.IDLE;

    return (
        <div className={`flex items-center ${dense ? 'gap-1.5' : 'gap-2'}`}>
            <div className={`flex shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[#d5b180] ${dense ? 'h-6 w-6' : 'h-8 w-8'}`}>
                <Zap size={dense ? 10 : 12} />
            </div>
            <div className={`flex ${dense ? 'gap-1' : 'gap-1.5'}`}>
                {slots.map((item, i) => (
                    <Motion.button
                        key={i}
                        whileTap={item && canUse ? { scale: 0.9 } : {}}
                        onClick={() => item && canUse && onUse(item, i)}
                        title={item ? `${item.name} — 빠른 사용 (슬롯 ${i + 1})` : `퀵슬롯 ${i + 1} (인벤에서 할당)`}
                        className={`relative flex items-center justify-center rounded-[0.95rem] border text-center text-xs font-fira transition-all backdrop-blur-md ${dense ? 'h-8 w-8 rounded-[0.8rem]' : 'h-10 w-10'}
                            ${item
                                ? canUse
                                    ? 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10 text-[#dff7f5] shadow-[0_12px_22px_rgba(125,212,216,0.1)] cursor-pointer hover:border-[#d5b180]/22 hover:bg-[#d5b180]/10'
                                    : 'border-white/8 bg-white/[0.03] text-slate-500 cursor-default'
                                : 'border-white/6 bg-black/18 text-slate-600 cursor-default'
                            }`}
                    >
                        {item ? (
                            <>
                                <span className={`${dense ? 'text-[9px]' : 'text-[10px]'} leading-tight text-center break-all`}>
                                    {item.name.slice(0, dense ? 2 : 3)}
                                </span>
                                {/* Slot number badge */}
                                <span className={`absolute rounded-full border border-white/10 bg-[rgba(9,12,18,0.95)] text-slate-400 ${dense ? '-left-0.5 -top-0.5 px-1 py-0 text-[7px]' : '-left-1 -top-1 px-1 py-0 text-[8px]'}`}>
                                    {i + 1}
                                </span>
                            </>
                        ) : (
                            <span className={dense ? 'text-[10px] text-slate-600' : 'text-slate-600'}>{i + 1}</span>
                        )}
                    </Motion.button>
                ))}
            </div>
        </div>
    );
};

/**
 * QuickSlotAssigner — 인벤토리 아이템에서 퀵슬롯 할당 UI
 */
export const QuickSlotAssigner = ({ item, slotCount = 3, onAssign, currentSlots, compact = false }) => {
    const isAssigned = currentSlots?.some(s => s?.id === item?.id);

    if (!item || !['hp', 'mp', 'buff', 'cure'].includes(item.type)) return null;

    return (
        <div className={`mt-1 flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
            <span className={`font-fira text-slate-400/70 ${compact ? 'text-[10px]' : 'text-xs'}`}>퀵슬롯:</span>
            {Array.from({ length: slotCount }, (_, i) => {
                const occupied = currentSlots[i];
                return (
                    <button
                        key={i}
                        onClick={() => onAssign(i, item)}
                        className={`${compact ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'} rounded border font-bold transition-all backdrop-blur-md
                            ${occupied?.id === item?.id
                                ? 'border-[#7dd4d8]/35 bg-[#7dd4d8]/10 text-[#dff7f5]'
                                : occupied
                                    ? 'border-white/8 bg-black/20 text-slate-500'
                                    : 'border-white/10 hover:border-[#d5b180]/30 bg-black/24 text-slate-400'
                            }`}
                        title={occupied ? `슬롯 ${i + 1}: ${occupied.name}` : `슬롯 ${i + 1}에 할당`}
                    >
                        {i + 1}
                    </button>
                );
            })}
            {isAssigned && (
                <button
                    onClick={() => {
                        const idx = currentSlots?.findIndex(s => s?.id === item?.id);
                        if (idx >= 0) onAssign(idx, null);
                    }}
                    className="ml-1 text-rose-300/55 hover:text-rose-200"
                    title="할당 해제"
                >
                    <X size={compact ? 10 : 11} />
                </button>
            )}
        </div>
    );
};

export default QuickSlot;
