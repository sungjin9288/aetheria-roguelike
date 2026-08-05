import { BALANCE } from '../../data/constants';
import { GS } from '../gameStates';
import { resolveCombatItemTurn } from '../../systems/combatItemTurn';
import { appendGrave } from '../../utils/graveUtils.js';
import type { GameAction, GameState } from '../gameReducer';
import { addNewTitles, sanitizeQuickSlots } from './helpers';

const appendCombatLogs = (
    currentLogs: any[],
    entries: Array<{ type: string; text: string }>,
    now: number,
    seed: number,
) => [
    ...currentLogs,
    ...entries.map((entry, index) => ({
        id: `combat-item-${now}-${seed}-${index}`,
        type: entry.type,
        text: entry.text,
    })),
].slice(-BALANCE.LOG_MAX_SIZE);

export const makeCombatActionMap = (initialPlayer: any) => ({
    USE_COMBAT_ITEM: (state: GameState, action: GameAction): GameState => {
        if (state.gameState !== GS.COMBAT || !state.enemy) return state;

        const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
        const seed = Number(action.payload?.seed);
        const now = Number(action.payload?.now);
        if (!itemId || !Number.isFinite(seed) || !Number.isFinite(now)) return state;

        const item = (state.player.inv || []).find((entry: any) => entry.id === itemId);
        if (!item || typeof item.type !== 'string' || !['hp', 'mp', 'cure', 'buff'].includes(item.type)) return state;

        const result = resolveCombatItemTurn({
            player: state.player,
            enemy: state.enemy,
            item,
            initialPlayer,
            seed,
            now,
        });
        const logs = [...result.logs];
        const player = result.kind === 'defeat'
            ? addNewTitles(result.player, logs)
            : result.player;

        return {
            ...state,
            player,
            enemy: result.enemy,
            gameState: result.kind === 'defeat'
                ? GS.DEAD
                : result.kind === 'victory'
                    ? GS.IDLE
                    : state.gameState,
            grave: result.kind === 'defeat'
                ? appendGrave(state.grave, result.graveData)
                : state.grave,
            runSummary: result.kind === 'defeat' ? result.runSummary : state.runSummary,
            logs: appendCombatLogs(state.logs, logs, now, seed),
            quickSlots: sanitizeQuickSlots(state.quickSlots, player.inv),
            visualEffect: result.visualEffect,
            syncStatus: 'syncing',
        };
    },
});
