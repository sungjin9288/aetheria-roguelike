import { BALANCE } from '../../data/constants';
import { sanitizeQuickSlots } from './helpers';

export const uiActionMap = {
    SET_SYNC_STATUS: (state, action) =>
        ({ ...state, syncStatus: action.payload }),

    SET_GAME_STATE: (state, action) =>
        ({ ...state, gameState: action.payload, syncStatus: 'syncing' }),

    SET_AI_THINKING: (state, action) =>
        ({ ...state, isAiThinking: action.payload }),

    SET_VISUAL_EFFECT: (state, action) =>
        ({ ...state, visualEffect: action.payload }),

    SET_SIDE_TAB: (state, action) =>
        ({ ...state, sideTab: action.payload }),

    SET_SHOP_ITEMS: (state, action) =>
        ({ ...state, shopItems: action.payload }),

    RESET_RUNTIME_UI: (state) => ({
        ...state,
        gameState: 'idle',
        logs: [],
        enemy: null,
        currentEvent: null,
        shopItems: [],
        sideTab: 'inventory',
        isAiThinking: false,
        visualEffect: null,
        quickSlots: [null, null, null],
        postCombatResult: null,
        pendingRelics: null,
        runSummary: null,
        syncStatus: 'syncing'
    }),

    ADD_LOG: (state, action) =>
        ({ ...state, logs: [...state.logs, action.payload].slice(-BALANCE.LOG_MAX_SIZE) }),

    UPDATE_LOG: (state, action) => ({
        ...state,
        logs: state.logs.map(log => log.id === action.payload.id ? action.payload.log : log)
    }),

    CLEAR_LOGS: (state) =>
        ({ ...state, logs: [], syncStatus: 'syncing' }),

    SET_POST_COMBAT_RESULT: (state, action) =>
        ({ ...state, postCombatResult: action.payload }),

    SET_ONBOARDING_DISMISSED: (state) =>
        ({ ...state, onboardingDismissed: true }),

    SET_QUICK_SLOT: (state, action) => {
        const candidate = action.payload.item;
        if (candidate && !state.player.inv.some((item) => item.id === candidate.id)) {
            return state;
        }
        const next = [...state.quickSlots];
        next[action.payload.index] = candidate || null;
        return { ...state, quickSlots: next, syncStatus: 'syncing' };
    },
};

export const entityActionMap = {
    SET_PLAYER: (state, action) => {
        const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
        const mergedPlayer = { ...state.player, ...nextPlayer };
        return {
            ...state,
            player: mergedPlayer,
            quickSlots: sanitizeQuickSlots(state.quickSlots, mergedPlayer.inv),
            syncStatus: 'syncing'
        };
    },

    SET_EVENT: (state, action) =>
        ({ ...state, currentEvent: action.payload, syncStatus: 'syncing' }),

    SET_ENEMY: (state, action) => ({
        ...state,
        enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload,
        syncStatus: 'syncing'
    }),

    SET_GRAVE: (state, action) =>
        ({ ...state, grave: action.payload, syncStatus: 'syncing' }),
};
