import { getNextBagRecipe, type BagRecipeDef } from '../data/bagRecipes';
import { getInventoryCapacity } from './inventoryCapacity';
import type { Player } from '../types';

export interface BagCraftReadiness {
    recipe: BagRecipeDef;
    inputs: { name: string; qty: number; owned: number }[];
    hasMaterials: boolean;
    hasGold: boolean;
    ready: boolean;
    /** 만든 뒤의 가방 상한 */
    nextCapacity: number;
}

/**
 * 다음 가방 단계의 준비 상태(2026-09 Wave 33). 제작소 가방 탭과 모험 가이드가 같은 판정을 읽는다 —
 * 정본 판정은 reducer `CRAFT_BAG`이고 이것은 안내용 미리보기다. 모두 만들었으면 null.
 */
export const getBagCraftReadiness = (player: Pick<Player, 'bagTier' | 'maxInv' | 'inv' | 'gold'>): BagCraftReadiness | null => {
    const recipe = getNextBagRecipe(player.bagTier);
    if (!recipe) return null;
    const inventory = player.inv || [];
    const inputs = recipe.inputs.map((input) => ({
        ...input,
        owned: inventory.filter((item) => item.name === input.name).length,
    }));
    const hasMaterials = inputs.every((input) => input.owned >= input.qty);
    const hasGold = (player.gold || 0) >= recipe.gold;
    return {
        recipe,
        inputs,
        hasMaterials,
        hasGold,
        ready: hasMaterials && hasGold,
        nextCapacity: getInventoryCapacity(player) + recipe.slots,
    };
};
