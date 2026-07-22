import type { Item, ItemRecipeDef, Player } from '../types/index.js';
import { findItemByName, getItemRarity } from './gameUtils.js';
import { getEquipmentDecision, getItemStatText } from './equipmentUtils.js';

const ITEM_TYPE_LABELS: Record<string, string> = {
    weapon: '무기',
    armor: '방어구',
    shield: '보조 장비',
    hp: '생명 회복',
    mp: '기력 회복',
    cure: '상태 회복',
    buff: '전투 보조',
    mat: '재료',
};

export interface ItemOutcomePreview {
    item: Item;
    typeLabel: string;
    tierLabel: string | null;
    rarity: string;
    statText: string;
    equipmentDecision: ReturnType<typeof getEquipmentDecision>;
}

export interface CraftingInvestmentPreview {
    recipe: ItemRecipeDef;
    output: ItemOutcomePreview | null;
    inputs: Array<{ name: string; required: number; owned: number; enough: boolean }>;
    hasGold: boolean;
    canCraft: boolean;
    lockReason: string | null;
}

export const getItemOutcomePreview = (player: Player, item: Item | null | undefined): ItemOutcomePreview | null => {
    if (!item) return null;

    return {
        item,
        typeLabel: ITEM_TYPE_LABELS[item.type || ''] || '아이템',
        tierLabel: (item.tier || 0) > 0 ? `${item.tier}단계` : null,
        rarity: getItemRarity(item),
        statText: getItemStatText(item),
        equipmentDecision: getEquipmentDecision(player, item),
    };
};

export const getCraftingInvestmentPreview = (player: Player, recipe: ItemRecipeDef): CraftingInvestmentPreview => {
    const output = getItemOutcomePreview(player, findItemByName(recipe.name));
    const inputs = (recipe.inputs || []).map((input) => {
        const name = input.name || '';
        const required = input.qty || 0;
        const owned = (player.inv || []).filter((item) => item?.name === name).length;
        return { name, required, owned, enough: owned >= required };
    });
    const goldCost = recipe.gold || 0;
    const hasGold = (player.gold || 0) >= goldCost;
    const missingInput = inputs.find((input) => !input.enough);
    const lockReason = !output
        ? '제작 결과 정보를 찾을 수 없습니다.'
        : !hasGold
            ? `골드 부족 · ${player.gold || 0}/${goldCost}`
            : missingInput
                ? `재료 부족 · ${missingInput.name} ${missingInput.owned}/${missingInput.required}`
                : null;

    return {
        recipe,
        output,
        inputs,
        hasGold,
        canCraft: Boolean(output) && hasGold && !missingInput,
        lockReason,
    };
};

export const getSynthesisOutcomePreviews = (player: Player, outputs: Item[]) => (
    outputs.map((item) => getItemOutcomePreview(player, item)).filter(Boolean) as ItemOutcomePreview[]
);
