import { BALANCE, CONSTANTS } from '../data/constants.js';

export const countInventoryItemByName = (inventory = [], itemName) => (
    (inventory || []).filter((item: any) => item?.name === itemName).length
);

export const getEnhanceRequirement = (currentLevel: any = 0) => ({
    gold: BALANCE.ENHANCE_COSTS[currentLevel] ?? 0,
    materials: BALANCE.ENHANCE_MATERIAL_COSTS[currentLevel] ?? 1,
    materialName: CONSTANTS.ENHANCE_MATERIAL_NAME,
});

export const getEnhanceMaterialCount = (inventory: any = []) => (
    countInventoryItemByName(inventory, CONSTANTS.ENHANCE_MATERIAL_NAME)
);

export const consumeInventoryItemByName = (inventory = [], itemName, count = 1) => {
    let removed = 0;
    const nextInventory = (inventory || []).filter((item: any) => {
        if (item?.name === itemName && removed < count) {
            removed += 1;
            return false;
        }
        return true;
    });

    return { nextInventory, removed };
};

export const getEnhanceAvailability = (item, gold = 0, inventory = []) => {
    if (!item || !['weapon', 'armor', 'shield'].includes(item.type)) {
        return {
            canEnhance: false,
            affordable: false,
            missing: 'invalid',
            hint: '강화 불가',
            requirement: null,
            materialCount: getEnhanceMaterialCount(inventory),
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
            materialCount: getEnhanceMaterialCount(inventory),
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
            materialCount,
        };
    }

    if (materialCount < requirement.materials) {
        return {
            canEnhance: true,
            affordable: false,
            missing: 'material',
            hint: '재료 부족',
            requirement,
            materialCount,
        };
    }

    return {
        canEnhance: true,
        affordable: true,
        missing: null,
        hint: '강화 가능',
        requirement,
        materialCount,
    };
};
