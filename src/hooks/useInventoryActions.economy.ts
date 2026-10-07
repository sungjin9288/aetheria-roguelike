import { DB } from '../data/db';
import { getNextBagRecipe } from '../data/bagRecipes';
import { AT } from '../reducers/actionTypes';
// 2026-10 Wave 62 (원장 §61.4 C8): 재료 사본 선택은 리듀서와 같은 선택기 하나다 — 낮은 강화 → 접두어 없음 → 가방 앞쪽.
import { getRecipeInputIds } from '../utils/recipeInputSelection';
import type { Item } from '../types/index.js';
import type { InventoryActionCtx } from './actionDeps';

/** UI는 선택 식별자와 난수만 전달하고, 비용과 결과는 reducer가 최신 상태에서 확정한다. */
export const createEconomyActions = (ctx: InventoryActionCtx) => {
    const { player, gameState, dispatch } = ctx;

    return {
        market: (type: string, item: Item, source?: string) => {
            if (gameState !== 'shop') return;
            if (type === 'sell') {
                // id 없는 인스턴스는 reducer의 inv.find가 못 찾아 no-op이던 경로 —
                //   `equipment.useItem`과 같은 가드로 dispatch 전에 끝낸다.
                if (!item.id) return;
                dispatch({
                    type: AT.SELL_INVENTORY_ITEM,
                    payload: { itemId: item.id },
                });
                return;
            }
            if (type !== 'buy') return;
            // 이름 없는 제안은 getCanonicalShopOffer가 못 찾아 no-op이던 경로.
            if (!item.name) return;

            dispatch({
                type: AT.BUY_SHOP_ITEM,
                payload: {
                    source: source || 'stock',
                    itemName: item.name,
                    expectedGold: player.gold,
                    expectedInventorySize: (player.inv || []).length,
                    relicRoll: Math.random(),
                },
            });
        },

        // 2026-10 Wave 75: 행상인 상점에서 나오면 행상인이 떠난다(만남 종료) — 판정은 리듀서(`LEAVE_MERCHANT`).
        leaveMerchant: () => {
            dispatch({ type: AT.LEAVE_MERCHANT });
        },

        craft: (recipeId: string) => {
            const recipe = DB.ITEMS.recipes?.find((entry) => entry.id === recipeId);
            if (!recipe) return;
            dispatch({
                type: AT.CRAFT_RECIPE,
                payload: {
                    recipeId,
                    inputIds: getRecipeInputIds(player.inv || [], recipe),
                    relicRoll: Math.random(),
                },
            });
        },

        // 2026-09 Wave 33: 다음 가방 단계만 만든다. 단계·재료·골드 판정은 reducer(`CRAFT_BAG`)가 최신 상태에서 한다.
        craftBag: () => {
            const recipe = getNextBagRecipe(player.bagTier);
            if (!recipe) return;
            dispatch({
                type: AT.CRAFT_BAG,
                payload: {
                    tier: recipe.tier,
                    inputIds: getRecipeInputIds(player.inv || [], recipe),
                    relicRoll: Math.random(),
                },
            });
        },

        synthesize: (itemIds: string[], useProtect: boolean) => {
            dispatch({
                type: AT.SYNTHESIZE_ITEMS,
                payload: {
                    itemIds,
                    useProtect,
                    successRoll: Math.random(),
                    outputRoll: Math.random(),
                    relicRoll: Math.random(),
                },
            });
        },

        autoSell: () => {
            dispatch({ type: AT.AUTO_SELL_MATERIALS });
        },
    };
};
