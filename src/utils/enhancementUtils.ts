import type { Item } from '../types/index.js';
import { BALANCE, CONSTANTS } from '../data/constants.js';

export const countInventoryItemByName = (inventory: Item[] = [], itemName: string) => (
    (inventory || []).filter((item: Item | null | undefined) => item?.name === itemName).length
);

export const getEnhanceRequirement = (currentLevel: any = 0) => ({
    gold: BALANCE.ENHANCE_COSTS[currentLevel] ?? 0,
    materials: BALANCE.ENHANCE_MATERIAL_COSTS[currentLevel] ?? 1,
    materialName: CONSTANTS.ENHANCE_MATERIAL_NAME,
});

export const getEnhanceMaterialCount = (inventory: Item[] = []) => (
    countInventoryItemByName(inventory, CONSTANTS.ENHANCE_MATERIAL_NAME)
);

export const consumeInventoryItemByName = (inventory: Item[] = [], itemName: string, count: number = 1) => {
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

export const getEnhanceAvailability = (item: Item | null | undefined, gold: number = 0, inventory: Item[] = []) => {
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
