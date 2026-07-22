import type { Item } from '../types/index.js';
import { BALANCE, CONSTANTS } from '../data/constants.js';
import { getWeaponAttackValue, isWeapon } from './equipmentUtils.js';

export type EnhanceItemSlot = 'weapon' | 'armor' | 'offhand' | null;

export interface EnhancePreview {
    item: Item;
    slot: EnhanceItemSlot;
    currentLevel: number;
    nextLevel: number;
    successRate: number;
    statLabel: '공격력' | '방어력';
    currentStat: number;
    nextStat: number;
    statDelta: number;
    requirement: ReturnType<typeof getEnhanceRequirement> | null;
    materialCount: number;
    canEnhance: boolean;
    affordable: boolean;
    missing: string | null;
    hint: string;
    failureText: string;
}

// cycle 578: inventory default [] 제거 — 3 callsite (EquipmentPanel:58 +
//   internal:18 + test:31) 모두 명시 전달이라 default 도달 불가. body의
//   (inventory || []) defensive guard 보존. 청소 메가 시리즈 70번째 batch.
export const countInventoryItemByName = (inventory: Item[], itemName: string) => (
    (inventory || []).filter((item: Item | null | undefined) => item?.name === itemName).length
);

// cycle 516: currentLevel default 제거 — 1 internal callsite (line 58) +
//   2 test callsite 모두 명시 전달이라 default 0 도달 불가. util default
//   청소 메가 시리즈 14번째 (cycle 502-515).
export const getEnhanceRequirement = (currentLevel: any) => ({
    gold: BALANCE.ENHANCE_COSTS[currentLevel] ?? 0,
    materials: BALANCE.ENHANCE_MATERIAL_COSTS[currentLevel] ?? 1,
    materialName: CONSTANTS.ENHANCE_MATERIAL_NAME,
});

// cycle 578: inventory default [] 제거 — internal:62 + test:32 모두 명시.
export const getEnhanceMaterialCount = (inventory: Item[]) => (
    countInventoryItemByName(inventory, CONSTANTS.ENHANCE_MATERIAL_NAME)
);

export const getItemEnhanceBonus = (item: Item | null | undefined, level: number, slot: EnhanceItemSlot) => {
    if (!item || !['weapon', 'armor', 'shield'].includes(item.type as string)) return 0;

    const offhandRatio = isWeapon(item) && slot === 'offhand' ? BALANCE.OFFHAND_WEAPON_RATIO : 1;
    const scaledBonus = Math.floor((item.val || 0) * BALANCE.ENHANCE_STAT_BONUS * level * offhandRatio);
    return level > 0 ? Math.max(level, scaledBonus) : 0;
};

const getEnhanceStat = (item: Item, level: number, slot: EnhanceItemSlot) => {
    const weaponSlot = slot === 'offhand' ? 'offhand' : 'main';
    const baseStat = isWeapon(item)
        ? getWeaponAttackValue(item, weaponSlot)
        : (item.val || 0);

    return baseStat + getItemEnhanceBonus(item, level, slot);
};

// cycle 503: 누적량 default 제거 — 1 callsite (useInventoryActions:559) 항상
//   3 args (count 명시) 전달이라 default 1 도달 불가. cycle 502 incrementStat
//   amount 파라미터 cleanup 동일 lens.
// cycle 578: inventory default [] 제거 — useInventoryActions:563 + test:43
//   모두 명시. body의 (inventory || []) defensive guard 보존.
export const consumeInventoryItemByName = (inventory: Item[], itemName: string, count: number) => {
    let removed = 0;
    const nextInventory = (inventory || []).filter((item: Item | null | undefined) => {
        if (item?.name === itemName && removed < count) {
            removed += 1;
            return false;
        }
        return true;
    });

    return { nextInventory, removed };
};

// cycle 506: gold / inventory default 제거 — 3 callsite 모두 3 args 전달이라
//   default 도달 불가. cycle 502-505 util default 청소 메가 시리즈 5번째.
export const getEnhanceAvailability = (item: Item | null | undefined, gold: number, inventory: Item[]) => {
    if (!item || !['weapon', 'armor', 'shield'].includes(item.type as string)) {
        return {
            canEnhance: false,
            affordable: false,
            missing: 'invalid',
            hint: '강화 불가',
            requirement: null,
        };
    }

    const currentLevel = item.enhance || 0;
    if (currentLevel >= BALANCE.ENHANCE_MAX) {
        return {
            canEnhance: false,
            affordable: false,
            missing: 'max',
            hint: '최대 강화',
            requirement: null,
        };
    }

    const requirement = getEnhanceRequirement(currentLevel);
    const materialCount = getEnhanceMaterialCount(inventory);

    if (gold < requirement.gold) {
        return {
            canEnhance: true,
            affordable: false,
            missing: 'gold',
            hint: '골드 부족',
            requirement,
        };
    }

    if (materialCount < requirement.materials) {
        return {
            canEnhance: true,
            affordable: false,
            missing: 'material',
            hint: '재료 부족',
            requirement,
        };
    }

    return {
        canEnhance: true,
        affordable: true,
        missing: null,
        hint: '강화 가능',
        requirement,
    };
};

export const getEnhancePreview = (
    item: Item | null | undefined,
    gold: number,
    inventory: Item[],
    slot: EnhanceItemSlot,
): EnhancePreview | null => {
    if (!item || !['weapon', 'armor', 'shield'].includes(item.type as string)) return null;

    const availability = getEnhanceAvailability(item, gold, inventory);
    const currentLevel = item.enhance || 0;
    const nextLevel = Math.min(BALANCE.ENHANCE_MAX, currentLevel + 1);
    const currentStat = getEnhanceStat(item, currentLevel, slot);
    const nextStat = getEnhanceStat(item, nextLevel, slot);

    return {
        item,
        slot,
        currentLevel,
        nextLevel,
        successRate: BALANCE.ENHANCE_RATES[currentLevel] ?? 0,
        statLabel: item.type === 'weapon' ? '공격력' : '방어력',
        currentStat,
        nextStat,
        statDelta: nextStat - currentStat,
        requirement: availability.requirement,
        materialCount: getEnhanceMaterialCount(inventory),
        canEnhance: availability.canEnhance,
        affordable: availability.affordable,
        missing: availability.missing,
        hint: availability.hint,
        failureText: '실패하면 강화 단계는 유지되고 골드와 강화 재료는 소모됩니다.',
    };
};
