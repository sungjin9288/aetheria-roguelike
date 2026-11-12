/**
 * 강화 갈래 화면 뷰모델 (2026-11 H6). 강화 카드와 장비 · 가방 상세가 읽는다 — 판정은 `utils/enhanceBranch.ts`가 소유한다.
 *
 * 갈래마다 실제 수치를 보인다: 장착한 장비면 이번 강화가 성공한 뒤의 능력치(`calculateFullStats`)에서 그 갈래를 붙이기
 * 전 → 붙인 뒤, 장착하지 않은 장비면 효과 문구만이다(장착해야 효과가 난다). 추천 · 경고 문구는 없다(Wave 88 원칙).
 */
import { MSG } from '../data/messages.js';
import {
    getEnhanceBranchDef,
    getEnhanceBranchKind,
    getEnhanceBranchOptions,
    getItemEnhanceBranches,
    getOwedEnhanceBranchLevels,
    withEnhanceResult,
    type EnhanceBranchId,
} from './enhanceBranch.js';
import { calculateFullStats, type FullStats } from './statsCalculator.js';
import type { EnhanceItemSlot } from './enhancementUtils.js';
import type { Item, Player } from '../types/index.js';
import type { EnhanceBranchStat } from '../data/enhanceBranches.js';

export interface EnhanceBranchStatChange {
    label: string;
    before: string;
    after: string;
}

export interface EnhanceBranchOptionView {
    id: EnhanceBranchId;
    name: string;
    effect: string;
    /** 장착한 장비일 때만 — 이번 강화가 성공한 뒤 그 갈래를 붙이기 전 → 붙인 뒤. */
    change: EnhanceBranchStatChange | null;
}

export interface EnhanceBranchStageView {
    level: number;
    options: EnhanceBranchOptionView[];
}

const formatPct = (value: number) => `${Math.round(value * 1000) / 10}%`;

const readStat = (stats: FullStats, player: Player, stat: EnhanceBranchStat): string => {
    if (stat === 'atkPct') return String(stats.atk);
    if (stat === 'crit') return formatPct(stats.critChance);
    if (stat === 'defPct') return String(stats.def);
    if (stat === 'hpPct') return String(stats.maxHp);
    if (stat === 'mpPct') return String(stats.maxMp);
    // 재생 틱은 저장된 최대 생명 × 비율이다(`tickCombatState`) — 같은 기준으로 보인다.
    return String(stats.equipRegenPerTurn > 0 ? Math.max(1, Math.floor((player.maxHp || 0) * stats.equipRegenPerTurn)) : 0);
};

const withItemInSlot = (player: Player, slot: NonNullable<EnhanceItemSlot>, item: Item): Player => ({
    ...player,
    equip: { ...(player.equip || {}), [slot]: item },
});

/** 이 장비가 지금 그 칸에 장착돼 있으면 그 칸, 아니면 `null`. */
const getEquippedSlot = (player: Player, item: Item, slot: EnhanceItemSlot): NonNullable<EnhanceItemSlot> | null => {
    if (!slot) return null;
    const equipped = player.equip?.[slot];
    if (!equipped) return null;
    return (equipped.id && equipped.id === item.id) || equipped === item ? slot : null;
};

/**
 * 이번 강화(`item.enhance + 1`)로 골라야 하는 갈래 단계와 각 갈래의 실제 수치. 골라야 할 갈래가 없으면 빈 배열.
 * 앞서 건너뛴 단계가 있으면 단계마다 한 줄이고, 뒤 단계의 수치는 앞 단계를 첫 갈래로 두고 잰 그 갈래 하나의 몫이다.
 */
export const getEnhanceBranchStages = (
    player: Player,
    item: Item | null | undefined,
    slot: EnhanceItemSlot,
): EnhanceBranchStageView[] => {
    if (!item) return [];
    const nextLevel = (item.enhance || 0) + 1;
    const owed = getOwedEnhanceBranchLevels(item, nextLevel);
    if (owed.length === 0) return [];
    const kind = getEnhanceBranchKind(item);
    const equippedSlot = getEquippedSlot(player, item, slot);
    const prefix: EnhanceBranchId[] = [];

    return owed.map((level) => {
        const optionIds = getEnhanceBranchOptions(kind, level);
        const base = withEnhanceResult(item, nextLevel, prefix);
        const baseStats = equippedSlot ? calculateFullStats(withItemInSlot(player, equippedSlot, base)) : null;
        const options = optionIds.map((id): EnhanceBranchOptionView => {
            const { stat, value } = getEnhanceBranchDef(id);
            let change: EnhanceBranchStatChange | null = null;
            if (equippedSlot && baseStats) {
                const chosen = withEnhanceResult(item, nextLevel, [...prefix, id]);
                const chosenStats = calculateFullStats(withItemInSlot(player, equippedSlot, chosen));
                if (chosenStats) {
                    change = {
                        label: MSG.ENHANCE_BRANCH_STAT_LABELS[stat],
                        before: readStat(baseStats, player, stat),
                        after: readStat(chosenStats, player, stat),
                    };
                }
            }
            return { id, name: MSG.ENHANCE_BRANCH_NAMES[stat], effect: MSG.ENHANCE_BRANCH_EFFECT(stat, value), change };
        });
        if (optionIds[0]) prefix.push(optionIds[0]);
        return { level, options };
    });
};

/** 장비에 붙은 갈래 한 줄 — 없으면 `null`. */
export const getEnhanceBranchSummary = (item: Item | null | undefined): string | null => {
    const branches = getItemEnhanceBranches(item);
    if (branches.length === 0) return null;
    return MSG.ENHANCE_BRANCH_CHOSEN(branches.map((id) => {
        const { level, stat, value } = getEnhanceBranchDef(id);
        return MSG.ENHANCE_BRANCH_CHOSEN_ITEM(level, MSG.ENHANCE_BRANCH_NAMES[stat], MSG.ENHANCE_BRANCH_EFFECT(stat, value));
    }));
};
