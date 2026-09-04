import { sanitizeQuickSlots } from './helpers';
import type { GameState, GameAction } from '../gameReducer';
import { MSG } from '../../data/messages';

const getBootstrapLogs = (state: GameState, playerName: string) => {
    if (state.logs.length > 0 || !playerName.trim()) return state.logs;
    return [{ id: 'bootstrap-restore', type: 'system', text: MSG.SYNC_SAVE_RESTORED }];
};

export const bootstrapActionMap = {
    SET_BOOT_STAGE: (state: GameState, action: GameAction) =>
        ({ ...state, bootStage: action.payload }),

    SET_UID: (state: GameState, action: GameAction) =>
        ({ ...state, uid: action.payload }),

    LOAD_DATA: (state: GameState, action: GameAction) => {
        const loadedPlayer = { ...state.player, ...action.payload.player };
        return {
            ...state,
            player: loadedPlayer,
            gameState: action.payload.gameState || 'idle',
            enemy: action.payload.enemy || null,
            grave: action.payload.grave || null,
            currentEvent: action.payload.currentEvent || null,
            quickSlots: sanitizeQuickSlots(action.payload.quickSlots, loadedPlayer.inv),
            logs: getBootstrapLogs(state, loadedPlayer.name),
            bootStage: 'ready',
            syncStatus: 'synced',
            lastLoadedTimestamp: action.payload.lastActive?.toMillis
                ? action.payload.lastActive.toMillis()
                : (action.payload.lastActive || Date.now())
        };
    },

    SET_LIVE_CONFIG: (state: GameState, action: GameAction) =>
        ({ ...state, liveConfig: { ...state.liveConfig, ...action.payload } }),

    SET_LEADERBOARD: (state: GameState, action: GameAction) =>
        ({ ...state, leaderboard: action.payload }),
};
