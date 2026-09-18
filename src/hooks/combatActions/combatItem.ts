import { AT, type UseCombatItemPayload } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { resolveConsumableEffect } from '../../systems/consumableEffect';
import type { Item } from '../../types/index.js';
import type { CombatActionDeps, CombatPendingControl, CombatSharedHelpers } from '../actionDeps';

export const createCombatItemActions = (
    deps: CombatActionDeps,
    _shared: CombatSharedHelpers,
    pendingControl: CombatPendingControl,
) => {
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

            const inventoryItem = (player.inv || []).find((entry) => entry.id === item?.id);
            if (!inventoryItem) {
                addLog('error', MSG.COMBAT_ITEM_NOT_FOUND);
                return;
            }
            if (!['hp', 'mp', 'cure', 'buff'].includes(inventoryItem.type!)) {
                addLog('error', MSG.COMBAT_CONSUMABLE_ONLY);
                return;
            }
            const preview = resolveConsumableEffect({ player, item: inventoryItem });
            if (!preview.ok) {
                addLog('warn', preview.message);
                return;
            }
            // id는 makeItem이 항상 부여한다(인벤에 들어온 아이템의 신원).
            const inventoryItemId = inventoryItem.id!;
            const accepted = claimCombatItem
                ? claimCombatItem(inventoryItemId)
                : !fallbackItemLocks.has(inventoryItemId);
            if (!accepted) return;
            fallbackItemLocks.add(inventoryItemId);
            const combatClaimKey = `combat:${combatTurn}`;
            if (claimCombatAction && !claimCombatAction(combatClaimKey)) return;

            const seed = Math.floor(Math.random() * 4294967296);
            const now = Date.now();
            const payload: UseCombatItemPayload = {
                itemId: inventoryItemId,
                expectedTurn: combatTurn,
                seed,
                now,
            };
            dispatch({
                type: AT.USE_COMBAT_ITEM,
                payload,
            });
        },
    };
};
