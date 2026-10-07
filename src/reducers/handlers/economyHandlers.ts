import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { DB } from '../../data/db';
import { SEASON_XP } from '../../data/seasonPass';
import {
    countNewCodexEntries,
    grantGold,
    makeItem,
    registerCodex,
    registerLootToCodex,
} from '../../utils/gameUtils';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';
import { getSellIncome, getSellPrice } from '../../utils/equipmentUtils';
import { getGoldIncome } from '../../utils/challengeRules';
import { getCraftingInvestmentPreview } from '../../utils/itemInvestmentPreview';
import { getInventoryCapacity, growsPastInventoryCapacity } from '../../utils/inventoryCapacity';
import { getBagTier, getNextBagRecipe } from '../../data/bagRecipes';
import { getAutoSellMaterialTargets } from '../../utils/bagCrafting';
import { incrementStat } from '../../utils/playerStateUtils';
import { syncQuestProgress } from '../../utils/questProgress';
import { getCanonicalShopOffer } from '../../utils/shopRotation';
import { endMerchantVisit, getActiveMerchantVisit, getMerchantOffer, markMerchantOfferSold } from '../../utils/wanderingMerchant';
import { resolveSynthesis, validateSynthesis } from '../../utils/synthesisUtils';
import { getSignatureSaleVerdict } from '../../utils/signatureSale';
import { getRecipeInputIds } from '../../utils/recipeInputSelection';
import { GS } from '../gameStates';
import type { GameState, HandlerMap } from '../gameReducer';
import { AT, type ActionOf } from '../actionTypes';
import {
    addNewTitles,
    addSeasonXp,
    advanceDailyProtocol,
    getDailyProtocolRewardLogs,
    sanitizeQuickSlots,
} from './helpers';
import { appendRewardLogs } from './rewardLog';
import type { Item, ItemRecipeDef, Player } from '../../types';

type EconomyLog = { type: string; text: string };

const completeTransaction = (
    state: GameState,
    player: Player,
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

const buyShopItem = (state: GameState, action: ActionOf<typeof AT.BUY_SHOP_ITEM>): GameState => {
    if (state.gameState !== GS.SHOP) return state;
    const { source, itemName, expectedGold, expectedInventorySize, relicRoll } = action.payload || {};
    const inventory = state.player.inv || [];
    if (state.player.gold !== expectedGold || inventory.length !== expectedInventorySize) return state;

    // 2026-10 Wave 75: 떠돌이 행상인의 물건은 이번 만남의 재고(`player.merchantVisit`)가 값을 정한다 — 그 지역에 있을 때만.
    const fromMerchant = source === 'merchant';
    const offer = fromMerchant
        ? getMerchantOffer(state.player, itemName)
        : getCanonicalShopOffer(
            source,
            itemName,
            state.player.level || 1,
            state.player.loc || '',
        );
    if (!offer) return fromMerchant ? rejectTransaction(state, 'error', MSG.MERCHANT_BUY_UNAVAILABLE) : state;
    if ((state.player.gold || 0) < offer.price) {
        return rejectTransaction(state, 'error', MSG.GOLD_INSUFFICIENT);
    }
    // 구매는 언제나 +1 — 상한에서도, 보상이 상한을 넘긴 뒤에도 거부된다(Wave 27 N2 D2 규칙).
    if (growsPastInventoryCapacity(state.player, inventory.length + 1)) {
        return rejectTransaction(state, 'error', MSG.INV_FULL);
    }
    if (
        ['weapon', 'armor', 'shield'].includes(offer.item.type as string)
        && Array.isArray(offer.item.jobs)
        && (state.player.job === undefined || !offer.item.jobs.includes(state.player.job))
    ) {
        return rejectTransaction(state, 'error', MSG.EQUIP_JOB_RESTRICT(state.player.job, offer.item.name));
    }

    const purchasedItem = makeItem(offer.item);
    const codexBefore = countNewCodexEntries(state.player);
    const buyer = fromMerchant ? markMerchantOfferSold(state.player, itemName) : state.player;
    let player = registerLootToCodex({
        ...buyer,
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

const sellInventoryItem = (state: GameState, action: ActionOf<typeof AT.SELL_INVENTORY_ITEM>): GameState => {
    if (state.gameState !== GS.SHOP) return state;
    const item = (state.player.inv || []).find((entry) => entry.id === action.payload?.itemId);
    if (!item) return state;
    // Wave 28 (D4): 서명은 쓸 수 있는 유일한 사본만 보호한다 — 중복 사본과 전직 경로 밖 사본은 일반 판매가로 판다.
    const signatureVerdict = getSignatureSaleVerdict(item, state.player);
    if (signatureVerdict && !signatureVerdict.sellable) {
        return rejectTransaction(state, 'warning', MSG.SIGNATURE_SELL_BLOCKED(item.name));
    }

    const sellPrice = getSellPrice(item);
    const logs: EconomyLog[] = [];
    let player = grantGold({
        ...state.player,
        inv: (state.player.inv || []).filter((entry) => entry.id !== item.id),
    }, sellPrice);
    player = addNewTitles(player, logs);
    // 2026-10 Wave 62 (원장 §61.4 C16): 로그는 실제로 받은 골드('빈손의 시작'이면 절반 — `grantGold`와 같은 규칙)를 적는다.
    //   상점 판매 목록의 판매가와 같은 함수(`getSellIncome`)다.
    logs.push({ type: 'success', text: MSG.SHOP_SELL_DONE(item.name, getSellIncome(state.player, item)) });
    return completeTransaction(state, player, logs);
};

const craftRecipe = (state: GameState, action: ActionOf<typeof AT.CRAFT_RECIPE>): GameState => {
    if (state.gameState !== GS.CRAFTING) return state;
    const recipe = DB.ITEMS.recipes?.find((entry) => entry.id === action.payload?.recipeId);
    if (!recipe) return state;

    const inputIds = Array.isArray(action.payload?.inputIds) ? action.payload.inputIds : [];
    // 2026-10 Wave 62 (원장 §61.4 C8): 기대 재료 id는 훅과 같은 선택기(`utils/recipeInputSelection`)가 정한다 —
    //   같은 이름의 사본 중 낮은 강화 → 접두어 없음 → 가방 앞쪽. 이름이 같은 첫 사본을 쓰던 동안 +5 사본이 먼저 사라졌다.
    const expectedIds = getRecipeInputIds(state.player.inv, recipe);
    const requiredCount = (recipe.inputs || []).reduce((total, input) => total + (input.qty || 0), 0);
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

    const usedIds = new Set<Item['id']>(inputIds);
    const craftedItem = makeItem(preview.output.item);
    const codexBefore = countNewCodexEntries(state.player);
    let player = incrementStat({
        ...state.player,
        gold: (state.player.gold || 0) - (recipe.gold || 0),
        inv: [
            ...(state.player.inv || []).filter((item) => !usedIds.has(item.id)),
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
    // Wave 61: 제작 임무("아이템 N개 제작")는 제작한 그 자리에서 진행된다 — 다음 탐험 · 전투까지 수령 버튼이 없었다.
    player = { ...player, quests: syncQuestProgress(player, '', DB.QUESTS).updatedQuests };
    logs.push({ type: 'success', text: MSG.CRAFT_DONE(recipe.name || '') });
    return completeTransaction(state, player, logs);
};

/**
 * 가방 단계 제작(2026-09 Wave 33). 단계는 지금 단계 + 1만 받는다 — 건너뛰거나 다시 만드는 요청은 동일 참조다.
 * 재료·골드가 모자라면 거부 로그만 남긴다. 결과는 이번 런의 `bagTier`이고 영구 상태가 아니다(사망·계승에서 0).
 */
const craftBag = (state: GameState, action: ActionOf<typeof AT.CRAFT_BAG>): GameState => {
    if (state.gameState !== GS.CRAFTING) return state;
    const recipe = getNextBagRecipe(state.player.bagTier);
    if (!recipe || action.payload?.tier !== recipe.tier) return state;

    const inputIds = Array.isArray(action.payload?.inputIds) ? action.payload.inputIds : [];
    const expectedIds = getRecipeInputIds(state.player.inv, recipe);
    const requiredCount = recipe.inputs.reduce((total, input) => total + input.qty, 0);
    if (expectedIds.length !== requiredCount) {
        const inventory = state.player.inv || [];
        const missing = recipe.inputs.find((input) => inventory.filter((item) => item.name === input.name).length < input.qty);
        return missing ? rejectTransaction(state, 'error', MSG.CRAFT_MAT_INSUFFICIENT(missing.name)) : state;
    }
    if (inputIds.length !== requiredCount || inputIds.some((id: string, index: number) => id !== expectedIds[index])) {
        return state;
    }
    if ((state.player.gold || 0) < recipe.gold) return rejectTransaction(state, 'error', MSG.GOLD_INSUFFICIENT);

    const usedIds = new Set<Item['id']>(inputIds);
    let player = incrementStat({
        ...state.player,
        gold: (state.player.gold || 0) - recipe.gold,
        inv: (state.player.inv || []).filter((item) => !usedIds.has(item.id)),
        bagTier: getBagTier(state.player.bagTier) + 1,
    }, 'crafts');
    player = addSeasonXp(player, SEASON_XP.craft);

    const daily = advanceDailyProtocol(player, 'goldSpend', recipe.gold, action.payload?.relicRoll);
    const logs = getDailyProtocolRewardLogs(daily.reward);
    player = addNewTitles(daily.player, logs);
    logs.push({ type: 'success', text: MSG.BAG_CRAFTED(recipe.name, getInventoryCapacity(player)) });
    return completeTransaction(state, player, logs);
};

const synthesizeItems = (state: GameState, action: ActionOf<typeof AT.SYNTHESIZE_ITEMS>): GameState => {
    if (state.gameState !== GS.CRAFTING) return state;
    const itemIds = Array.isArray(action.payload?.itemIds) ? action.payload.itemIds : [];
    if (itemIds.length !== BALANCE.SYNTHESIS_INPUT_COUNT || new Set(itemIds).size !== itemIds.length) return state;

    const items = itemIds
        .map((id: string) => (state.player.inv || []).find((item) => item.id === id))
        .filter((item): item is Item => Boolean(item));
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

    // Wave 61: 보호는 실패할 수 있는 합성에만 의미가 있다 — 성공률 100%(보호 토글이 보이지 않는 단계)에서도 보호권 ·
    //   크리스털을 차감하던 결함(원장 §61 A18). 화면이 이전 합성의 토글 상태를 그대로 보내도 여기서 거른다.
    const canFail = 'successRate' in validation && Number(validation.successRate) < 1;
    const useProtect = action.payload?.useProtect === true && canFail;
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
    const usedIds = new Set<Item['id']>(itemIds);
    const protectStats = useToken ? { synthProtects: ownedTokens - 1 } : {};
    const premiumSpent = useToken ? 0 : result.premiumSpent;
    const spentPlayer: Player = {
        ...state.player,
        gold: (state.player.gold || 0) - result.goldSpent,
        premiumCurrency: (state.player.premiumCurrency || 0) - premiumSpent,
        inv: [
            ...(state.player.inv || []).filter((item) => !usedIds.has(item.id)),
            ...result.returnedItems,
        ],
        stats: { ...state.player.stats, ...protectStats },
    };
    // 업적 · 칭호는 "합성 N회 성공"이다 — 실패 · 보호된 실패는 세지 않는다(2026-10 Wave 58).
    let player = result.success ? incrementStat(spentPlayer, 'syntheses') : spentPlayer;

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
    // 2026-09 Wave 33: 다음 가방 단계에 필요한 재료는 그 수량만큼 남긴다(getAutoSellMaterialTargets).
    const targets = getAutoSellMaterialTargets(state.player);
    if (targets.length === 0) return state;

    const targetIds = new Set(targets.map((item) => item.id));
    const totalGold = targets.reduce(
        (total, item) => total + getSellPrice(item),
        0,
    );
    const logs: EconomyLog[] = [];
    let player = grantGold({
        ...state.player,
        inv: (state.player.inv || []).filter((item) => !targetIds.has(item.id)),
    }, totalGold);
    player = addNewTitles(player, logs);
    // 받은 골드는 합계에 수입 규칙을 한 번 건 값이다(`grantGold`가 합계로 지급한다).
    logs.push({ type: 'success', text: MSG.BULK_SELL_DONE(targets.length, getGoldIncome(state.player, totalGold)) });
    return completeTransaction(state, player, logs);
};

/** 행상인 만남 카드 → 행상인 상점(사고팔기). 카드가 열려 있고 그 지역의 만남이 유효할 때만. */
const openMerchantShop = (state: GameState): GameState => {
    if (state.gameState !== GS.EVENT || !state.currentEvent?.isWanderingMerchant) return state;
    if (!getActiveMerchantVisit(state.player)) return state;
    return { ...state, gameState: GS.SHOP, currentEvent: null };
};

/** 행상인이 떠난다 — 만남 카드나 행상인 상점에서 나오면 만남이 끝난다(다시 볼 수 없다). */
const leaveMerchant = (state: GameState): GameState => {
    const fromCard = state.gameState === GS.EVENT && Boolean(state.currentEvent?.isWanderingMerchant);
    const fromShop = state.gameState === GS.SHOP && Boolean(getActiveMerchantVisit(state.player));
    if (!fromCard && !fromShop && !state.player.merchantVisit) return state;
    return {
        ...state,
        player: endMerchantVisit(state.player),
        ...(fromCard || fromShop ? { gameState: GS.IDLE, currentEvent: null } : {}),
        logs: appendRewardLogs(state.logs, [{ type: 'info', text: MSG.MERCHANT_LEAVE_LOG }]),
    };
};

export const economyActionMap = {
    BUY_SHOP_ITEM: buyShopItem,
    SELL_INVENTORY_ITEM: sellInventoryItem,
    CRAFT_RECIPE: craftRecipe,
    CRAFT_BAG: craftBag,
    SYNTHESIZE_ITEMS: synthesizeItems,
    AUTO_SELL_MATERIALS: autoSellMaterials,
    OPEN_MERCHANT_SHOP: openMerchantShop,
    LEAVE_MERCHANT: leaveMerchant,
} satisfies HandlerMap;
