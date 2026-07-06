import { BALANCE } from '../data/constants';
import { toArray, makeItem } from '../utils/gameUtils';
import { getEquipmentIdentity, getNextEquipmentState, isTwoHandWeapon } from '../utils/equipmentUtils';
import { canEquip } from '../utils/equipmentValidation';
import { consumeInventoryItemByName, getEnhanceAvailability } from '../utils/enhancementUtils';
import { AT } from '../reducers/actionTypes';
import { MSG } from '../data/messages';
import type { Item } from '../types/index.js';

/**
 * createEquipmentActions — 장비 도메인 (착용·소모품 사용 useItem / 강화 enhanceItem).
 *   ctx로 deps(player/dispatch/addLog/getFullStats)를 받는다.
 */
export const createEquipmentActions = (ctx: any) => {
    const { player, dispatch, addLog, getFullStats } = ctx;

    return ({

        useItem: (item: Item) => {
            const inventoryItem = player.inv.find((entry: any) => entry.id === item.id);
            if (!inventoryItem) return addLog('error', MSG.INV_ITEM_NOT_FOUND);

            if (['weapon', 'armor', 'shield'].includes(inventoryItem.type)) {
                const currentEquip = { ...player.equip };
                const validation = canEquip(inventoryItem, player, currentEquip);
                if (!validation.ok) {
                    if (validation.reason === 'level') {
                        return addLog('error', MSG.EQUIP_LEVEL_REQUIRED(inventoryItem.name, validation.reqLevel));
                    }
                    if (validation.reason === 'job') {
                        return addLog('error', MSG.EQUIP_JOB_RESTRICT(player.job, inventoryItem.name));
                    }
                    addLog('error', MSG.EQUIP_TWO_HAND_SHIELD_BLOCK);
                    return;
                }

                const filteredInv = player.inv.filter((entry: any) => entry.id !== inventoryItem.id);
                const inventoryItemKey = getEquipmentIdentity(inventoryItem);

                const nextEquip = getNextEquipmentState(currentEquip, inventoryItem);
                const preservedKeys = new Set(
                    [nextEquip.weapon, nextEquip.offhand, nextEquip.armor]
                        .filter(Boolean)
                        .map((equippedItem: any) => getEquipmentIdentity(equippedItem))
                );

                const itemsToReturn = [currentEquip.weapon, currentEquip.offhand, currentEquip.armor]
                    .filter((equippedItem: any) => {
                        if (!equippedItem) return false;
                        const equippedKey = getEquipmentIdentity(equippedItem);
                        if (equippedKey === inventoryItemKey) return false;
                        if (preservedKeys.has(equippedKey)) return false;
                        if (equippedItem.id && equippedItem.id === inventoryItem.id) return false;
                        if (equippedItem.name === '맨손' || equippedItem.name === '천옷') return false;
                        return true;
                    })
                    .map((equippedItem: any) => equippedItem.id ? equippedItem : makeItem(equippedItem));

                const newInv = [...filteredInv, ...itemsToReturn];

                if (inventoryItem.type === 'weapon') {
                    if (isTwoHandWeapon(inventoryItem) && currentEquip.offhand) {
                        addLog('info', MSG.EQUIP_TWO_HAND_OFFHAND_RELEASE);
                    } else if (!isTwoHandWeapon(inventoryItem) && isTwoHandWeapon(currentEquip.weapon)) {
                        addLog('info', MSG.EQUIP_TWO_HAND_TO_ONE_HAND);
                    } else if (getEquipmentIdentity(nextEquip.offhand) === inventoryItemKey) {
                        addLog('info', MSG.EQUIP_OFFHAND_SET);
                    } else if (
                        getEquipmentIdentity(nextEquip.weapon) === inventoryItemKey &&
                        getEquipmentIdentity(nextEquip.offhand) === getEquipmentIdentity(currentEquip.weapon) &&
                        getEquipmentIdentity(currentEquip.weapon) !== inventoryItemKey
                    ) {
                        addLog('info', MSG.EQUIP_MAIN_SHIFT);
                    } else if (getEquipmentIdentity(nextEquip.weapon) === inventoryItemKey) {
                        addLog('info', MSG.EQUIP_MAIN_REPLACE);
                    }
                } else if (inventoryItem.type === 'shield' && currentEquip.offhand) {
                    addLog('info', MSG.EQUIP_OFFHAND_REPLACE);
                }

                dispatch({ type: AT.SET_PLAYER, payload: { ...player, inv: newInv, equip: nextEquip } });
                addLog('success', MSG.EQUIP_DONE(inventoryItem.name));
                return;
            }

            if (player.challengeModifiers?.includes('noPotion') && ['hp', 'mp', 'cure'].includes(inventoryItem.type)) {
                return addLog('warn', MSG.CHALLENGE_NO_CONSUMABLE);
            }

            if (inventoryItem.type === 'hp') {
                const stats = getFullStats();
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        hp: Math.min(stats.maxHp, player.hp + (inventoryItem.val || 0)),
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용.`);
                return;
            }

            if (inventoryItem.type === 'mp') {
                const stats = getFullStats();
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        mp: Math.min(stats.maxMp, player.mp + (inventoryItem.val || 0)),
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용.`);
                return;
            }

            if (inventoryItem.type === 'cure') {
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        status: toArray(player.status).filter((status: any) => status !== inventoryItem.effect),
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용: 상태이상 해제`);
                return;
            }

            if (inventoryItem.type === 'buff') {
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        tempBuff: {
                            atk: inventoryItem.effect === 'atk_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                            def: inventoryItem.effect === 'def_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                            turn: inventoryItem.turn || 3,
                            name: inventoryItem.name
                        },
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', MSG.ITEM_USE_BUFF(inventoryItem.name));
            }
        },

        // ── 아이템 강화 ──────────────────────────────────────────────────
        enhanceItem: (itemId: any) => {
            const equipSlot = typeof itemId === 'string' && itemId.startsWith('equip:')
                ? itemId.split(':')[1]
                : null;
            const item = player.inv.find((i: any) => i.id === itemId)
                || (equipSlot ? player.equip?.[equipSlot] : null)
                || player.equip.weapon?.id === itemId && player.equip.weapon
                || player.equip.armor?.id === itemId && player.equip.armor
                || player.equip.offhand?.id === itemId && player.equip.offhand;
            if (!item) return addLog('error', MSG.ITEM_NOT_FOUND);
            const availability = getEnhanceAvailability(item, player.gold, player.inv);
            if (availability.missing === 'invalid') return addLog('warn', MSG.ENHANCE_NOT_EQUIP);
            if (availability.missing === 'max') return addLog('warn', MSG.ENHANCE_MAX_LEVEL);

            const requirement = availability.requirement;
            const nextLevel = (item.enhance || 0) + 1;
            if (!requirement) return addLog('warn', MSG.ENHANCE_NOT_EQUIP);

            if (availability.missing === 'gold') return addLog('warn', MSG.ENHANCE_NO_GOLD(requirement.gold));
            if (availability.missing === 'material') {
                return addLog('warn', MSG.ENHANCE_NO_MATERIAL(requirement.materialName, requirement.materials));
            }

            const { nextInventory, removed } = consumeInventoryItemByName(player.inv, requirement.materialName, requirement.materials);
            if (removed < requirement.materials) {
                return addLog('warn', MSG.ENHANCE_NO_MATERIAL(requirement.materialName, requirement.materials));
            }
            const rate = BALANCE.ENHANCE_RATES[item.enhance || 0];
            const success = Math.random() < rate;
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: any) => ({
                    ...p,
                    gold: p.gold - requirement.gold,
                    inv: nextInventory,
                })
            });
            dispatch({ type: AT.ENHANCE_ITEM, payload: { itemId, slot: equipSlot, success } });
            if (success) {
                addLog('success', MSG.ENHANCE_SUCCESS(item.name, nextLevel));
            } else {
                addLog('warn', MSG.ENHANCE_FAIL(item.name, nextLevel));
            }
        },
    });
};
