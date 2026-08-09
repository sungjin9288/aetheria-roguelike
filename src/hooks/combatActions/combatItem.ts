import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import type { Item } from '../../types/index.js';

export const createCombatItemActions = (deps: any, _shared: any, pendingControl: any) => {
    const {
        player,
        gameState,
        enemy,
        dispatch,
        addLog,
        claimCombatItem,
        claimCombatAction,
        combatTurn = 0,
    } = deps;
    const fallbackItemLocks = new Set<string>();

    return {
        combatUseItem: (item: Item) => {
            pendingControl.clear();
            if (gameState !== GS.COMBAT || !enemy) {
                addLog('error', MSG.COMBAT_NOT_IN_BATTLE);
                return;
            }

            const inventoryItem = player.inv.find((entry: any) => entry.id === item?.id);
            if (!inventoryItem) {
                addLog('error', MSG.COMBAT_ITEM_NOT_FOUND);
                return;
            }
            if (!['hp', 'mp', 'cure', 'buff'].includes(inventoryItem.type)) {
                addLog('error', MSG.COMBAT_CONSUMABLE_ONLY);
                return;
            }
            const accepted = claimCombatItem
                ? claimCombatItem(inventoryItem.id)
                : !fallbackItemLocks.has(inventoryItem.id);
            if (!accepted) return;
            fallbackItemLocks.add(inventoryItem.id);
            const combatClaimKey = `combat:${combatTurn}`;
            if (claimCombatAction && !claimCombatAction(combatClaimKey)) return;

            const seed = Math.floor(Math.random() * 4294967296);
            const now = Date.now();
            dispatch({
                type: AT.USE_COMBAT_ITEM,
                payload: { itemId: inventoryItem.id, expectedTurn: combatTurn, seed, now },
            });
        },
    };
};
