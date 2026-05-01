import { sanitizeQuickSlots } from './helpers';
import type { GameState, GameAction } from '../gameReducer';

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
            onboardingDismissed: action.payload.onboardingDismissed ?? state.onboardingDismissed,
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
