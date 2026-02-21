import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Zap, X } from 'lucide-react';

/**
 * QuickSlot — 빠른 소모품 슬롯 (Feature #8)
 * props:
 *   slots: [item | null, item | null, item | null]
 *   onUse: (item) => void
 *   onAssign: (slotIdx, item) => void
 *   onUnassign: (slotIdx) => void
 *   gameState: string
 */
const QuickSlot = ({ slots = [null, null, null], onUse, gameState }) => {
    const canUse = gameState === 'combat' || gameState === 'idle';

    return (
        <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-cyber-blue/40 shrink-0" />
            <div className="flex gap-1.5">
                {slots.map((item, i) => (
                    <Motion.button
                        key={i}
                        whileTap={item && canUse ? { scale: 0.9 } : {}}
                        onClick={() => item && canUse && onUse(item, i)}
                        title={item ? `${item.name} — 빠른 사용 (슬롯 ${i + 1})` : `퀵슬롯 ${i + 1} (인벤에서 할당)`}
                        className={`relative w-9 h-9 rounded border text-center transition-all text-xs font-fira flex items-center justify-center
                            ${item
                                ? canUse
                                    ? 'border-cyber-blue/40 bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue cursor-pointer'
                                    : 'border-cyber-blue/20 bg-cyber-dark/30 text-cyber-blue/50 cursor-default'
                                : 'border-cyber-blue/10 bg-cyber-dark/20 text-cyber-blue/20 cursor-default'
                            }`}
                    >
                        {item ? (
                            <>
                                <span className="text-[10px] leading-tight text-center break-all">
                                    {item.name.slice(0, 3)}
                                </span>
                                {/* Slot number badge */}
                                <span className="absolute -top-1 -left-1 text-[9px] bg-cyber-dark border border-cyber-blue/20 px-0.5 rounded text-cyber-blue/50">
                                    {i + 1}
                                </span>
                            </>
                        ) : (
                            <span className="text-cyber-blue/20">{i + 1}</span>
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
export const QuickSlotAssigner = ({ item, slotCount = 3, onAssign, currentSlots }) => {
    const isAssigned = currentSlots?.some(s => s?.id === item?.id);

    if (!item || !['hp', 'mp', 'buff', 'cure'].includes(item.type)) return null;

    return (
        <div className="flex items-center gap-1 mt-1">
            <span className="text-cyber-blue/40 text-xs font-fira">퀵슬롯:</span>
            {Array.from({ length: slotCount }, (_, i) => {
                const occupied = currentSlots[i];
                return (
                    <button
                        key={i}
                        onClick={() => onAssign(i, item)}
                        className={`w-6 h-6 rounded border text-[10px] font-bold transition-all
                            ${occupied?.id === item?.id
                                ? 'border-cyber-green/60 bg-cyber-green/10 text-cyber-green'
                                : occupied
                                    ? 'border-cyber-blue/20 bg-cyber-dark/20 text-cyber-blue/30'
                                    : 'border-cyber-blue/30 hover:border-cyber-blue/60 bg-cyber-dark/30 text-cyber-blue/50'
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
                    className="text-red-400/50 hover:text-red-400 ml-1"
                    title="할당 해제"
                >
                    <X size={11} />
                </button>
            )}
        </div>
    );
};

export default QuickSlot;
