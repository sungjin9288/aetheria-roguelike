import { INITIAL_STATE } from '../../reducers/gameReducer';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { resolveCombatItemTurn } from '../../systems/combatItemTurn';
import { handleVictoryOutcome } from './combatVictory';
import type { Item } from '../../types/index.js';

export const createCombatItemActions = (deps: any, { emitUnlockedTitles }: any, pendingControl: any) => {
    const {
        player,
        gameState,
        enemy,
        dispatch,
        addLog,
        addStoryLog,
        liveConfig,
        claimCombatItem,
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

            const seed = Math.floor(Math.random() * 4294967296);
            const now = Date.now();
            const result = resolveCombatItemTurn({
                player,
                enemy,
                item: inventoryItem,
                initialPlayer: INITIAL_STATE.player,
                seed,
                now,
            });

            dispatch({
                type: AT.USE_COMBAT_ITEM,
                payload: { itemId: inventoryItem.id, seed, now },
            });

            if (result.kind === 'victory') {
                handleVictoryOutcome({
                    playerAfterCombat: result.player,
                    deadEnemy: enemy,
                    stats: result.victoryStats,
                    dispatch,
                    addLog,
                    addStoryLog,
                    emitUnlockedTitles,
                    extendedChecks: false,
                    liveConfig,
                });
                return;
            }

            if (result.kind === 'defeat' && typeof addStoryLog === 'function') {
                void addStoryLog('death', { loc: player.loc });
                void addStoryLog('ruinRecap', { name: player.name, level: player.level });
            }
        },
    };
};
