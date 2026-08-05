import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { DB } from '../../data/db';
import { SEASON_XP } from '../../data/seasonPass';
import { isSignatureItem } from '../../data/signatureItems';
import {
    countNewCodexEntries,
    grantGold,
    makeItem,
    registerCodex,
    registerLootToCodex,
} from '../../utils/gameUtils';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';
import { getCraftingInvestmentPreview } from '../../utils/itemInvestmentPreview';
import { incrementStat } from '../../utils/playerStateUtils';
import { getCanonicalShopOffer } from '../../utils/shopRotation';
import { resolveSynthesis, validateSynthesis } from '../../utils/synthesisUtils';
import { GS } from '../gameStates';
import type { GameAction, GameState } from '../gameReducer';
import {
    addNewTitles,
    addSeasonXp,
    advanceDailyProtocol,
    getDailyProtocolRewardLogs,
    sanitizeQuickSlots,
} from './helpers';
import { appendRewardLogs } from './rewardLog';

type EconomyLog = { type: string; text: string };

const completeTransaction = (
    state: GameState,
    player: any,
    logs: EconomyLog[],
    economyReceipt: GameState['economyReceipt'] = null,
): GameState => {
    const trackedPlayer = trackExpeditionVitals(player);
    return {
        ...state,
        player: trackedPlayer,
        logs: appendRewardLogs(state.logs, logs),
        quickSlots: sanitizeQuickSlots(state.quickSlots, trackedPlayer.inv),
        economyReceipt,
        syncStatus: 'syncing',
    };
};

const rejectTransaction = (state: GameState, type: string, text: string): GameState => ({
    ...state,
    logs: appendRewardLogs(state.logs, [{ type, text }]),
});

const buyShopItem = (state: GameState, action: GameAction): GameState => {
    if (state.gameState !== GS.SHOP) return state;
    const { source, itemName, expectedGold, expectedInventorySize, relicRoll } = action.payload || {};
    const inventory = state.player.inv || [];
    if (state.player.gold !== expectedGold || inventory.length !== expectedInventorySize) return state;

    const offer = getCanonicalShopOffer(
        source,
        itemName,
        state.player.level || 1,
        state.player.loc || '',
    );
    if (!offer) return state;
    if ((state.player.gold || 0) < offer.price) {
        return rejectTransaction(state, 'error', MSG.GOLD_INSUFFICIENT);
    }
    if (inventory.length >= (state.player.maxInv || BALANCE.INV_MAX_SIZE)) {
        return rejectTransaction(state, 'error', MSG.INV_FULL);
    }
    if (
        ['weapon', 'armor', 'shield'].includes(offer.item.type as string)
        && Array.isArray(offer.item.jobs)
        && !offer.item.jobs.includes(state.player.job)
    ) {
        return rejectTransaction(state, 'error', MSG.EQUIP_JOB_RESTRICT(state.player.job, offer.item.name));
    }

    const purchasedItem = makeItem(offer.item);
    const codexBefore = countNewCodexEntries(state.player);
    let player = registerLootToCodex({
        ...state.player,
        gold: (state.player.gold || 0) - offer.price,
        inv: [...inventory, purchasedItem],
    }, [offer.item]);
    const newCodexEntries = countNewCodexEntries(player) - codexBefore;
    player = addSeasonXp(player, SEASON_XP.codexDiscover * newCodexEntries);

    const daily = advanceDailyProtocol(player, 'goldSpend', offer.price, relicRoll);
    const logs = [
        ...getDailyProtocolRewardLogs(daily.reward),
        { type: 'success', text: MSG.SHOP_BUY_DONE(offer.item.name) },
    ];
    return completeTransaction(state, daily.player, logs, {
        key: `buy:${purchasedItem.id}`,
        type: 'buy',
        itemName: offer.item.name || '',
    });
};

const sellInventoryItem = (state: GameState, action: GameAction): GameState => {
    if (state.gameState !== GS.SHOP) return state;
    const item = (state.player.inv || []).find((entry: any) => entry.id === action.payload?.itemId);
    if (!item) return state;
    if (isSignatureItem(item)) {
        return rejectTransaction(state, 'warning', MSG.SIGNATURE_SELL_BLOCKED(item.name));
    }

    const sellPrice = Math.floor((item.price || 0) * 0.5);
    const logs: EconomyLog[] = [];
    let player = grantGold({
        ...state.player,
        inv: (state.player.inv || []).filter((entry: any) => entry.id !== item.id),
    }, sellPrice);
    player = addNewTitles(player, logs);
    logs.push({ type: 'success', text: MSG.SHOP_SELL_DONE(item.name, sellPrice) });
    return completeTransaction(state, player, logs);
};

const getRecipeInputIds = (player: any, recipe: any) => {
    const available = [...(player.inv || [])];
    const inputIds: string[] = [];
    for (const input of recipe.inputs || []) {
        const required = Math.max(0, input.qty || 0);
        for (let index = 0; index < required; index += 1) {
            const matchIndex = available.findIndex((item: any) => item.name === input.name);
            if (matchIndex < 0) return inputIds;
            const [match] = available.splice(matchIndex, 1);
            if (match.id) inputIds.push(match.id);
        }
    }
    return inputIds;
};

const craftRecipe = (state: GameState, action: GameAction): GameState => {
    if (state.gameState !== GS.CRAFTING) return state;
    const recipe = DB.ITEMS.recipes?.find((entry: any) => entry.id === action.payload?.recipeId);
    if (!recipe) return state;

    const inputIds = Array.isArray(action.payload?.inputIds) ? action.payload.inputIds : [];
    const expectedIds = getRecipeInputIds(state.player, recipe);
    const requiredCount = (recipe.inputs || []).reduce((total: number, input: any) => total + (input.qty || 0), 0);
    if (inputIds.length !== requiredCount) {
        const preview = getCraftingInvestmentPreview(state.player, recipe);
        const missingInput = preview.inputs.find((input) => !input.enough);
        return missingInput
            ? rejectTransaction(state, 'error', MSG.CRAFT_MAT_INSUFFICIENT(missingInput.name))
            : state;
    }
    if (expectedIds.length !== requiredCount || inputIds.some((id: string, index: number) => id !== expectedIds[index])) {
        return state;
    }

    const preview = getCraftingInvestmentPreview(state.player, recipe);
    if (!preview.output) return rejectTransaction(state, 'error', MSG.ITEM_NOT_FOUND);
    if (!preview.hasGold) return rejectTransaction(state, 'error', MSG.GOLD_INSUFFICIENT);

    const usedIds = new Set(inputIds);
    const craftedItem = makeItem(preview.output.item);
    const codexBefore = countNewCodexEntries(state.player);
    let player = incrementStat({
        ...state.player,
        gold: (state.player.gold || 0) - (recipe.gold || 0),
        inv: [
            ...(state.player.inv || []).filter((item: any) => !usedIds.has(item.id)),
            craftedItem,
        ],
    }, 'crafts');
    player = registerCodex(player, 'recipes', recipe.id);
    player = registerLootToCodex(player, [craftedItem]);
    const newCodexEntries = countNewCodexEntries(player) - codexBefore;
    player = addSeasonXp(player, SEASON_XP.craft + SEASON_XP.codexDiscover * newCodexEntries);

    const daily = advanceDailyProtocol(player, 'goldSpend', recipe.gold || 0, action.payload?.relicRoll);
    const logs = getDailyProtocolRewardLogs(daily.reward);
    player = addNewTitles(daily.player, logs);
    logs.push({ type: 'success', text: MSG.CRAFT_DONE(recipe.name || '') });
    return completeTransaction(state, player, logs);
};

const synthesizeItems = (state: GameState, action: GameAction): GameState => {
    if (state.gameState !== GS.CRAFTING) return state;
    const itemIds = Array.isArray(action.payload?.itemIds) ? action.payload.itemIds : [];
    if (itemIds.length !== BALANCE.SYNTHESIS_INPUT_COUNT || new Set(itemIds).size !== itemIds.length) return state;

    const items = itemIds
        .map((id: string) => (state.player.inv || []).find((item: any) => item.id === id))
        .filter(Boolean);
    if (items.length !== itemIds.length) return state;

    const validation = validateSynthesis(items, state.player.gold);
    if (!validation.valid) {
        if (validation.reason === 'SIGNATURE_INPUT') {
            return rejectTransaction(state, 'warning', MSG.SIGNATURE_SYNTH_BLOCKED(validation.signatureName || ''));
        }
        if (validation.reason === 'NO_GOLD') {
            return rejectTransaction(state, 'error', MSG.SYNTHESIS_NOT_ENOUGH_GOLD);
        }
        return rejectTransaction(state, 'error', MSG.SYNTHESIS_NOT_ENOUGH);
    }

    const useProtect = action.payload?.useProtect === true;
    const successRoll = Number(action.payload?.successRoll);
    const outputRoll = Number(action.payload?.outputRoll);
    if (
        !Number.isFinite(successRoll) || successRoll < 0 || successRoll >= 1
        || !Number.isFinite(outputRoll) || outputRoll < 0 || outputRoll >= 1
    ) return state;

    const ownedTokens = state.player.stats?.synthProtects || 0;
    const useToken = useProtect && ownedTokens > 0;
    if (useProtect && !useToken && (state.player.premiumCurrency || 0) < BALANCE.SYNTHESIS_PROTECT_COST) {
        return rejectTransaction(state, 'error', MSG.PREMIUM_INSUFFICIENT(BALANCE.PREMIUM_CURRENCY_NAME));
    }

    const result = resolveSynthesis(items, null, useProtect, successRoll, outputRoll);
    const usedIds = new Set(itemIds);
    const protectStats = useToken ? { synthProtects: ownedTokens - 1 } : {};
    const premiumSpent = useToken ? 0 : result.premiumSpent;
    let player = incrementStat({
        ...state.player,
        gold: (state.player.gold || 0) - result.goldSpent,
        premiumCurrency: (state.player.premiumCurrency || 0) - premiumSpent,
        inv: [
            ...(state.player.inv || []).filter((item: any) => !usedIds.has(item.id)),
            ...result.returnedItems,
        ],
        stats: { ...state.player.stats, ...protectStats },
    }, 'syntheses');

    const logs: EconomyLog[] = [];
    const codexBefore = countNewCodexEntries(player);
    if (result.success && result.outputItem) {
        const outputItem = makeItem(result.outputItem);
        player = registerLootToCodex({ ...player, inv: [...(player.inv || []), outputItem] }, [outputItem]);
        logs.push({ type: 'success', text: MSG.SYNTHESIS_SUCCESS(outputItem.name || '') });
    } else if (useProtect) {
        logs.push({ type: 'info', text: MSG.SYNTHESIS_PROTECTED });
    } else {
        logs.push({ type: 'error', text: MSG.SYNTHESIS_FAIL });
    }

    const newCodexEntries = countNewCodexEntries(player) - codexBefore;
    if (result.success) {
        player = addSeasonXp(player, SEASON_XP.synthesize + SEASON_XP.codexDiscover * newCodexEntries);
    }
    const daily = advanceDailyProtocol(player, 'goldSpend', result.goldSpent, action.payload?.relicRoll);
    logs.unshift(...getDailyProtocolRewardLogs(daily.reward));
    player = addNewTitles(daily.player, logs);
    return completeTransaction(state, player, logs);
};

const autoSellMaterials = (state: GameState): GameState => {
    const targets = (state.player.inv || []).filter(
        (item: any) => item.type === 'mat' && (item.price || 0) <= 30,
    );
    if (targets.length === 0) return state;

    const targetIds = new Set(targets.map((item: any) => item.id));
    const totalGold = targets.reduce(
        (total: number, item: any) => total + Math.floor((item.price || 0) * 0.5),
        0,
    );
    const logs: EconomyLog[] = [];
    let player = grantGold({
        ...state.player,
        inv: (state.player.inv || []).filter((item: any) => !targetIds.has(item.id)),
    }, totalGold);
    player = addNewTitles(player, logs);
    logs.push({ type: 'success', text: MSG.BULK_SELL_DONE(targets.length, totalGold) });
    return completeTransaction(state, player, logs);
};

export const economyActionMap = {
    BUY_SHOP_ITEM: buyShopItem,
    SELL_INVENTORY_ITEM: sellInventoryItem,
    CRAFT_RECIPE: craftRecipe,
    SYNTHESIZE_ITEMS: synthesizeItems,
    AUTO_SELL_MATERIALS: autoSellMaterials,
};
