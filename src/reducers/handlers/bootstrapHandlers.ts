import { sanitizeQuickSlots } from './helpers';

export const bootstrapActionMap = {
    SET_BOOT_STAGE: (state: any, action: any) =>
        ({ ...state, bootStage: action.payload }),

    SET_UID: (state: any, action: any) =>
        ({ ...state, uid: action.payload }),

    LOAD_DATA: (state: any, action: any) => {
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

    SET_LIVE_CONFIG: (state: any, action: any) =>
        ({ ...state, liveConfig: { ...state.liveConfig, ...action.payload } }),

    SET_LEADERBOARD: (state: any, action: any) =>
        ({ ...state, leaderboard: action.payload }),
};
