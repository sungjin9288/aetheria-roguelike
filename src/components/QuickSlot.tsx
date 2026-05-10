import { motion as Motion } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import { GS } from '../reducers/gameStates';

/**
 * QuickSlot — 빠른 소모품 슬롯 (Feature #8)
 * props:
 *   slots: [item | null, item | null, item | null]
 *   onUse: (item: any) => void
 *   gameState: string
 *
 * cycle 399: onAssign / onUnassign dead props 정리 — QuickSlot 본체
 *   destructure 미사용 + 외부 pass 0건. QuickSlotAssigner는 별개 컴포넌트로 onAssign 사용.
 */
// cycle 494: 조밀 prop 인터페이스 제거 — 1 callsite (TerminalView) 전달 0건.
//   본체 9 ternary 모두 false 가지 선택 cascade.
interface QuickSlotProps {
    slots?: any[];
    onUse?: (item: any, idx: number) => void;
    gameState?: string;
}

const QuickSlot = ({ slots = [null, null, null], onUse, gameState }: QuickSlotProps) => {
    const canUse = gameState === GS.COMBAT || gameState === GS.IDLE;

    return (
        <div className="flex items-center gap-2">
            <div className="flex shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[#d5b180] h-8 w-8">
                <Zap size={12} />
            </div>
            <div className="flex gap-1.5">
                {slots.map((item: any, i: any) => (
                    <Motion.button
                        key={i}
                        data-testid={`quick-slot-${i}`}
                        whileTap={item && canUse ? { scale: 0.9 } : {}}
                        onClick={() => item && canUse && onUse?.(item, i)}
                        title={item ? `${item.name} — 빠른 사용 (슬롯 ${i + 1})` : `퀵슬롯 ${i + 1} (인벤에서 할당)`}
                        className={`relative flex items-center justify-center rounded-[0.95rem] border text-center text-xs font-fira transition-all backdrop-blur-md h-10 w-10
                            ${item
                                ? canUse
                                    ? 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10 text-[#dff7f5] shadow-[0_12px_22px_rgba(125,212,216,0.1)] cursor-pointer hover:border-[#d5b180]/22 hover:bg-[#d5b180]/10'
                                    : 'border-white/8 bg-white/[0.03] text-slate-500 cursor-default'
                                : 'border-white/6 bg-black/18 text-slate-600 cursor-default'
                            }`}
                    >
                        {item ? (
                            <>
                                <span className="text-[10px] leading-tight text-center break-all">
                                    {item.name.slice(0, 3)}
                                </span>
                                {/* Slot number badge */}
                                <span className="absolute rounded-full border border-white/10 bg-[rgba(9,12,18,0.95)] text-slate-400 -left-1 -top-1 px-1 py-0 text-[8px]">
                                    {i + 1}
                                </span>
                            </>
                        ) : (
                            <span className="text-slate-600">{i + 1}</span>
                        )}
                    </Motion.button>
                ))}
            </div>
        </div>
    );
};

/**
 * QuickSlotAssigner — 인벤토리 아이템에서 퀵슬롯 할당 UI
 *
 * cycle 494: 컴팩트 prop cascade — cycle 482가 SmartInventory callsite에서
 *   compact 전달 제거 후 caller 0건. 본체 5 ternary 모두 false 가지 선택.
 */
export const QuickSlotAssigner = ({ item, slotCount = 3, onAssign, currentSlots }: any) => {
    const isAssigned = currentSlots?.some((s: any) => s?.id === item?.id);

    if (!item || !['hp', 'mp', 'buff', 'cure'].includes(item.type)) return null;

    return (
        <div className="mt-1 flex items-center gap-1">
            <span className="font-fira text-slate-400/70 text-xs">퀵슬롯:</span>
            {Array.from({ length: slotCount }, (_: any, i: any) => {
                const occupied = currentSlots[i];
                return (
                    <button
                        key={i}
                        data-testid={`quick-slot-assign-${i}`}
                        onClick={() => onAssign(i, item)}
                        className={`h-6 w-6 text-[10px] rounded border font-bold transition-all backdrop-blur-md
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
                    data-testid="quick-slot-unassign"
                    onClick={() => {
                        const idx = currentSlots?.findIndex((s: any) => s?.id === item?.id);
                        if (idx >= 0) onAssign(idx, null);
                    }}
                    className="ml-1 text-rose-300/55 hover:text-rose-200"
                    title="할당 해제"
                >
                    <X size={11} />
                </button>
            )}
        </div>
    );
};

export default QuickSlot;
