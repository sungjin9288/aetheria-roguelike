import { BALANCE } from '../data/constants';
import { getNextBagRecipe, type BagRecipeDef } from '../data/bagRecipes';
import { getInventoryCapacity } from './inventoryCapacity';
import type { Item, Player } from '../types';

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

/**
 * 일괄 판매(`AUTO_SELL_MATERIALS`) 대상 — 값싼 재료(`INVENTORY_JUNK_MATERIAL_PRICE_MAX` 이하) 중에서 **다음 가방 단계에
 * 필요한 수량만큼은 남긴다**(2026-09 Wave 33). 가방 1·2단계 재료(멧돼지 가죽 · 벌레 껍질 · 철광석 · 박쥐 날개)가
 * 전부 그 가격대라, 남기지 않으면 일괄 판매 한 번이 가방 재료를 팔아 버린다. 리듀서와 인벤토리 버튼 수치가 이 함수를 읽는다.
 */
export const getAutoSellMaterialTargets = (player: Pick<Player, 'inv' | 'bagTier'>): Item[] => {
    const reserve = new Map<string, number>();
    for (const input of getNextBagRecipe(player.bagTier)?.inputs || []) reserve.set(input.name, input.qty);
    return (player.inv || []).filter((item) => {
        if (item.type !== 'mat' || (item.price || 0) > BALANCE.INVENTORY_JUNK_MATERIAL_PRICE_MAX) return false;
        const left = reserve.get(item.name || '') || 0;
        if (left > 0) {
            reserve.set(item.name || '', left - 1);
            return false;
        }
        return true;
    });
};
