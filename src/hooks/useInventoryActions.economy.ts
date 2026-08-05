import { DB } from '../data/db';
import { AT } from '../reducers/actionTypes';
import type { Item } from '../types/index.js';

const getRecipeInputIds = (inventory: Item[], recipe: any) => {
    const available = [...inventory];
    const inputIds: string[] = [];
    for (const input of recipe.inputs || []) {
        for (let count = 0; count < (input.qty || 0); count += 1) {
            const index = available.findIndex((item) => item.name === input.name);
            if (index < 0) return inputIds;
            const [item] = available.splice(index, 1);
            if (item.id) inputIds.push(item.id);
        }
    }
    return inputIds;
};

/** UI는 선택 식별자와 난수만 전달하고, 비용과 결과는 reducer가 최신 상태에서 확정한다. */
export const createEconomyActions = (ctx: any) => {
    const { player, gameState, dispatch } = ctx;

    return {
        market: (type: any, item: Item, source?: string) => {
            if (gameState !== 'shop') return;
            if (type === 'sell') {
                dispatch({
                    type: AT.SELL_INVENTORY_ITEM,
                    payload: { itemId: item.id },
                });
                return;
            }
            if (type !== 'buy') return;

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

        craft: (recipeId: any) => {
            const recipe = DB.ITEMS.recipes?.find((entry: any) => entry.id === recipeId);
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

        synthesize: (itemIds: any, useProtect: any) => {
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
