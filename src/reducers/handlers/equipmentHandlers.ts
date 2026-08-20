import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';
import {
    getEquipmentIdentity,
    getNextEquipmentState,
    isTwoHandWeapon,
} from '../../utils/equipmentUtils';
import { canEquip } from '../../utils/equipmentValidation';
import { consumeInventoryItemByName, getEnhancePreview } from '../../utils/enhancementUtils';
import { makeItem } from '../../utils/gameUtils';
import { resolveConsumableEffect, sanitizeConsumedQuickSlots } from '../../systems/consumableEffect';
import type { GameAction, GameState } from '../gameReducer';
import {
    addNewTitles,
    advanceDailyProtocol,
    getDailyProtocolRewardLogs,
    sanitizeQuickSlots,
} from './helpers';
import { appendRewardLogs } from './rewardLog';

type EquipmentLog = { type: string; text: string };
type EquipmentSlot = 'weapon' | 'armor' | 'offhand' | null;

const completeEquipmentTransaction = (
    state: GameState,
    player: any,
    logs: EquipmentLog[],
): GameState => {
    const trackedPlayer = trackExpeditionVitals(player);
    return {
        ...state,
        player: trackedPlayer,
        logs: appendRewardLogs(state.logs, logs),
        quickSlots: sanitizeQuickSlots(state.quickSlots, trackedPlayer.inv),
        syncStatus: 'syncing',
    };
};

const rejectEquipmentTransaction = (
    state: GameState,
    type: string,
    text: string,
): GameState => ({
    ...state,
    logs: appendRewardLogs(state.logs, [{ type, text }]),
});

const getEquipFeedback = (currentEquip: any, nextEquip: any, item: any) => {
    if (item.type === 'shield' && currentEquip.offhand) return MSG.EQUIP_OFFHAND_REPLACE;
    if (item.type !== 'weapon') return null;

    const itemKey = getEquipmentIdentity(item);
    if (isTwoHandWeapon(item) && currentEquip.offhand) return MSG.EQUIP_TWO_HAND_OFFHAND_RELEASE;
    if (!isTwoHandWeapon(item) && isTwoHandWeapon(currentEquip.weapon)) return MSG.EQUIP_TWO_HAND_TO_ONE_HAND;
    if (getEquipmentIdentity(nextEquip.offhand) === itemKey) return MSG.EQUIP_OFFHAND_SET;
    if (
        getEquipmentIdentity(nextEquip.weapon) === itemKey
        && getEquipmentIdentity(nextEquip.offhand) === getEquipmentIdentity(currentEquip.weapon)
        && getEquipmentIdentity(currentEquip.weapon) !== itemKey
    ) return MSG.EQUIP_MAIN_SHIFT;
    if (getEquipmentIdentity(nextEquip.weapon) === itemKey) return MSG.EQUIP_MAIN_REPLACE;
    return null;
};

const equipInventoryItem = (state: GameState, item: any): GameState => {
    const currentEquip = { ...(state.player.equip || {}) };
    const validation = canEquip(item, state.player, currentEquip);
    if (!validation.ok) {
        if (validation.reason === 'level') {
            return rejectEquipmentTransaction(
                state,
                'error',
                MSG.EQUIP_LEVEL_REQUIRED(item.name, validation.reqLevel),
            );
        }
        if (validation.reason === 'job') {
            return rejectEquipmentTransaction(
                state,
                'error',
                MSG.EQUIP_JOB_RESTRICT(state.player.job, item.name),
            );
        }
        return rejectEquipmentTransaction(state, 'error', MSG.EQUIP_TWO_HAND_SHIELD_BLOCK);
    }

    const nextEquip = getNextEquipmentState(currentEquip, item);
    const itemKey = getEquipmentIdentity(item);
    const preservedKeys = new Set(
        [nextEquip.weapon, nextEquip.offhand, nextEquip.armor]
            .filter(Boolean)
            .map((equippedItem: any) => getEquipmentIdentity(equippedItem)),
    );
    const returnedItems = [currentEquip.weapon, currentEquip.offhand, currentEquip.armor]
        .filter((equippedItem: any) => {
            if (!equippedItem) return false;
            const equippedKey = getEquipmentIdentity(equippedItem);
            if (equippedKey === itemKey || preservedKeys.has(equippedKey)) return false;
            if (equippedItem.id && equippedItem.id === item.id) return false;
            return equippedItem.name !== '맨손' && equippedItem.name !== '천옷';
        })
        .map((equippedItem: any) => equippedItem.id ? equippedItem : makeItem(equippedItem));
    const inventory = [
        ...(state.player.inv || []).filter((entry: any) => entry.id !== item.id),
        ...returnedItems,
    ];
    if (inventory.length > (state.player.maxInv || BALANCE.INV_MAX_SIZE)) {
        return rejectEquipmentTransaction(state, 'error', MSG.INV_FULL);
    }

    const logs: EquipmentLog[] = [];
    const feedback = getEquipFeedback(currentEquip, nextEquip, item);
    if (feedback) logs.push({ type: 'info', text: feedback });
    logs.push({ type: 'success', text: MSG.EQUIP_DONE(item.name) });

    return completeEquipmentTransaction(state, {
        ...state.player,
        inv: inventory,
        equip: nextEquip,
    }, logs);
};

const consumeInventoryItem = (state: GameState, item: any): GameState => {
    const result = resolveConsumableEffect({ player: state.player, item });
    if (!result.ok) return state;
    const completed = completeEquipmentTransaction(state, result.player, [result.log]);
    return {
        ...completed,
        quickSlots: sanitizeConsumedQuickSlots(state.quickSlots, item, completed.player.inv || []),
    };
};

const useInventoryItem = (state: GameState, action: GameAction): GameState => {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    if (!itemId) return state;
    const item = (state.player.inv || []).find((entry: any) => entry.id === itemId);
    if (!item) return state;
    if (typeof item.type === 'string' && ['weapon', 'armor', 'shield'].includes(item.type)) {
        return equipInventoryItem(state, item);
    }
    return consumeInventoryItem(state, item);
};

const getEnhanceTarget = (state: GameState, itemId: string) => {
    const equip = state.player.equip || {};
    const fallbackSlotName = itemId.startsWith('equip:') ? itemId.split(':')[1] : null;
    const fallbackSlot = (
        fallbackSlotName === 'weapon' || fallbackSlotName === 'armor' || fallbackSlotName === 'offhand'
    ) ? fallbackSlotName : null;
    const equippedSlot = (['weapon', 'armor', 'offhand'] as const).find((slot) => equip[slot]?.id === itemId);
    const slot = fallbackSlot || equippedSlot || null;
    const item = (state.player.inv || []).find((entry: any) => entry.id === itemId)
        || (slot ? equip[slot] : null)
        || null;
    return { item, slot: slot as EquipmentSlot };
};

const enhanceItem = (state: GameState, action: GameAction): GameState => {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    if (!itemId) return state;

    const { item, slot } = getEnhanceTarget(state, itemId);
    if (!item) return state;
    if (getEquipmentIdentity(item) !== action.payload?.expectedItemIdentity) return state;

    const currentLevel = item.enhance || 0;
    if (currentLevel !== action.payload?.expectedLevel) return state;
    if ((state.player.gold || 0) !== action.payload?.expectedGold) return state;

    const roll = Number(action.payload?.roll);
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return state;

    const preview = getEnhancePreview(item, state.player.gold || 0, state.player.inv || [], slot);
    if (!preview) return rejectEquipmentTransaction(state, 'warn', MSG.ENHANCE_NOT_EQUIP);
    if (preview.missing === 'max') {
        return rejectEquipmentTransaction(state, 'warn', MSG.ENHANCE_MAX_LEVEL);
    }
    if (!preview.requirement) {
        return rejectEquipmentTransaction(state, 'warn', MSG.ENHANCE_NOT_EQUIP);
    }
    if (preview.missing === 'gold') {
        return rejectEquipmentTransaction(state, 'warn', MSG.ENHANCE_NO_GOLD(preview.requirement.gold));
    }
    if (preview.missing === 'material') {
        return rejectEquipmentTransaction(
            state,
            'warn',
            MSG.ENHANCE_NO_MATERIAL(preview.requirement.materialName, preview.requirement.materials),
        );
    }

    const {
        nextInventory: inventoryAfterCost,
        removed: removedMaterials,
    } = consumeInventoryItemByName(
        state.player.inv || [],
        preview.requirement.materialName,
        preview.requirement.materials,
    );
    if (removedMaterials < preview.requirement.materials) return state;

    const success = roll < preview.successRate;
    const nextLevel = currentLevel + 1;
    const inventory = inventoryAfterCost.map((inventoryItem: any) => (
        success && inventoryItem.id === itemId
            ? { ...inventoryItem, enhance: nextLevel }
            : inventoryItem
    ));
    const equip = { ...(state.player.equip || {}) };
    if (success && slot && equip[slot]) {
        equip[slot] = { ...equip[slot], enhance: nextLevel };
    }

    let player: any = {
        ...state.player,
        gold: (state.player.gold || 0) - preview.requirement.gold,
        inv: inventory,
        equip,
    };
    const daily = advanceDailyProtocol(
        player,
        'goldSpend',
        preview.requirement.gold,
        action.payload?.relicRoll,
    );
    const logs = getDailyProtocolRewardLogs(daily.reward);
    player = addNewTitles(daily.player, logs);
    logs.push({
        type: success ? 'success' : 'warn',
        text: success
            ? MSG.ENHANCE_SUCCESS(item.name || '장비', nextLevel)
            : MSG.ENHANCE_FAIL(item.name || '장비', nextLevel),
    });
    return completeEquipmentTransaction(state, player, logs);
};

export const equipmentActionMap = {
    USE_INVENTORY_ITEM: useInventoryItem,
    ENHANCE_ITEM: enhanceItem,
};
