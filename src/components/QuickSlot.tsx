import { motion as Motion } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import { GS } from '../reducers/gameStates';
import type { GameMode } from '../reducers/gameStates';
import { getConsumableCompactLabel, getConsumableDescription } from '../utils/consumablePresentation';
import type { Item } from '../types/index.js';
import { MSG } from '../data/messages';

/**
 * QuickSlot — 빠른 소모품 슬롯 (Feature #8)
 * props:
 *   slots: [item | null, item | null, item | null]
 *   onUse: (item: Item) => void
 *   gameState: GameMode
 *
 * cycle 399: onAssign / onUnassign dead props 정리 — QuickSlot 본체
 *   destructure 미사용 + 외부 pass 0건. QuickSlotAssigner는 별개 컴포넌트로 onAssign 사용.
 */
// cycle 494: 조밀 prop 인터페이스 제거 — 1 callsite (TerminalView) 전달 0건.
//   본체 9 ternary 모두 false 가지 선택 cascade.
interface QuickSlotProps {
    slots: Array<Item | null>;
    onUse?: (item: Item, idx: number) => void;
    gameState?: GameMode;
}

// cycle 581: slots default [null, null, null] 제거 — 1 production caller
//   (TerminalView:287 <QuickSlot slots={quickSlots} ... />) 명시 전달이라
//   default 도달 불가. 청소 메가 시리즈 72번째.
const QuickSlot = ({ slots, onUse, gameState }: QuickSlotProps) => {
    const canUse = gameState === GS.COMBAT || gameState === GS.IDLE;

    // 2026-10 에테르 유리: 빈 칸 · 쓸 수 없는 칸 · 쓸 수 있는 칸을 톤으로만 가른다(회색 테두리 대신 층과 림). 칸은 44px 터치 하한.
    return (
        <div className="flex items-center gap-2">
            <div className="ae-sunk flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ae-gold">
                <Zap size={14} aria-hidden="true" />
            </div>
            <div className="flex gap-2">
                {slots.map((item, i) => (
                    <Motion.button
                        key={i}
                        data-testid={`quick-slot-${i}`}
                        whileTap={item && canUse ? { scale: 0.94 } : {}}
                        onClick={() => item && canUse && onUse?.(item, i)}
                        title={item ? `${item.name} — ${getConsumableDescription(item, { includeTurnCost: true })} · 빠른 사용 (슬롯 ${i + 1})` : MSG.QUICK_SLOT_EMPTY_LABEL(i + 1)}
                        aria-label={item ? `${item.name} — ${getConsumableDescription(item, { includeTurnCost: true })} · 슬롯 ${i + 1}` : MSG.QUICK_SLOT_EMPTY_LABEL(i + 1)}
                        className={`ae-quick-slot relative flex h-11 w-11 items-center justify-center rounded-ae-sm text-center font-fira tabular-nums
                            ${item
                                ? canUse
                                    ? 'is-ready cursor-pointer text-ae-ink'
                                    : 'is-idle cursor-default text-ae-ink-3'
                                : 'is-empty cursor-default text-ae-ink-3'
                            }`}
                    >
                        {item ? (
                            <>
                                <span className="text-[11px] font-bold leading-tight text-center">
                                    {getConsumableCompactLabel(item)}
                                </span>
                                {/* Slot number badge */}
                                <span className="ae-quick-slot-index absolute -left-1 -top-1 rounded-full px-1 text-[11px] font-bold leading-[1.35] text-ae-ink-2">
                                    {i + 1}
                                </span>
                            </>
                        ) : (
                            <span className="text-[12px]">{i + 1}</span>
                        )}
                    </Motion.button>
                ))}
            </div>
        </div>
    );
};

/** QuickSlotAssigner가 실제로 다루는 인벤토리 아이템 → 퀵슬롯 배치 콜백. */
type OnAssignQuickSlot = (idx: number, item: Item | null) => void;

interface QuickSlotAssignerProps {
    item?: Item | null;
    slotCount?: number;
    onAssign: OnAssignQuickSlot;
    currentSlots?: Array<Item | null>;
}

/**
 * QuickSlotAssigner — 인벤토리 아이템에서 퀵슬롯 할당 UI
 *
 * cycle 494: 컴팩트 prop cascade — cycle 482가 SmartInventory callsite에서
 *   compact 전달 제거 후 caller 0건. 본체 5 ternary 모두 false 가지 선택.
 */
export const QuickSlotAssigner = ({ item, slotCount = 3, onAssign, currentSlots }: QuickSlotAssignerProps) => {
    const isAssigned = currentSlots?.some((s) => s?.id === item?.id);

    if (!item || !item.type || !['hp', 'mp', 'buff', 'cure'].includes(item.type)) return null;

    return (
        <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-[12px] font-semibold text-ae-ink-3">퀵슬롯:</span>
            {Array.from({ length: slotCount }, (_, i) => {
                const occupied = currentSlots?.[i];
                return (
                    <button
                        key={i}
                        type="button"
                        data-testid={`quick-slot-assign-${i}`}
                        aria-label={MSG.QUICK_SLOT_ASSIGN_ARIA(i + 1, occupied?.name)}
                        aria-pressed={Boolean(occupied && occupied.id === item?.id)}
                        onClick={() => onAssign(i, item)}
                        className={`ae-quick-slot h-11 w-11 rounded-ae-sm font-fira text-[12px] font-bold tabular-nums
                            ${occupied?.id === item?.id
                                ? 'is-ready text-ae-ether-hi'
                                : occupied
                                    ? 'is-idle text-ae-ink-3'
                                    : 'is-empty text-ae-ink-2'
                            }`}
                        title={MSG.QUICK_SLOT_ASSIGN_ARIA(i + 1, occupied?.name)}
                    >
                        {i + 1}
                    </button>
                );
            })}
            {isAssigned && (
                <button
                    type="button"
                    data-testid="quick-slot-unassign"
                    aria-label={MSG.QUICK_SLOT_UNASSIGN}
                    onClick={() => {
                        const idx = currentSlots?.findIndex((s) => s?.id === item?.id) ?? -1;
                        if (idx >= 0) onAssign(idx, null);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-ae-sm text-ae-ink-3 hover:text-ae-ink"
                    title={MSG.QUICK_SLOT_UNASSIGN}
                >
                    <X size={14} aria-hidden="true" />
                </button>
            )}
        </div>
    );
};

export default QuickSlot;
