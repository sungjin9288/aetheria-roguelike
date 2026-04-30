import { BALANCE } from '../../data/constants';
import { GS } from '../gameStates';
import { sanitizeQuickSlots } from './helpers';

export const uiActionMap = {
    SET_SYNC_STATUS: (state: any, action: any) =>
        ({ ...state, syncStatus: action.payload }),

    SET_GAME_STATE: (state: any, action: any) =>
        ({ ...state, gameState: action.payload, syncStatus: 'syncing' }),

    SET_AI_THINKING: (state: any, action: any) =>
        ({ ...state, isAiThinking: action.payload }),

    SET_VISUAL_EFFECT: (state: any, action: any) =>
        ({ ...state, visualEffect: action.payload }),

    SET_SIDE_TAB: (state: any, action: any) =>
        ({ ...state, sideTab: action.payload }),

    SET_SHOP_ITEMS: (state: any, action: any) =>
        ({ ...state, shopItems: action.payload }),

    RESET_RUNTIME_UI: (state: any) => ({
        ...state,
        gameState: GS.IDLE,
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

    ADD_LOG: (state: any, action: any) =>
        ({ ...state, logs: [...state.logs, action.payload].slice(-BALANCE.LOG_MAX_SIZE) }),

    UPDATE_LOG: (state: any, action: any) => ({
        ...state,
        logs: state.logs.map((log: any) => log.id === action.payload.id ? action.payload.log : log)
    }),

    CLEAR_LOGS: (state: any) =>
        ({ ...state, logs: [], syncStatus: 'syncing' }),

    SET_POST_COMBAT_RESULT: (state: any, action: any) =>
        ({ ...state, postCombatResult: action.payload }),

    SET_ONBOARDING_DISMISSED: (state: any) =>
        ({ ...state, onboardingDismissed: true }),

    SET_QUICK_SLOT: (state: any, action: any) => {
        const candidate = action.payload.item;
        if (candidate && !state.player.inv.some((item: any) => item.id === candidate.id)) {
            return state;
        }
        const next = [...state.quickSlots];
        next[action.payload.index] = candidate || null;
        return { ...state, quickSlots: next, syncStatus: 'syncing' };
    },
};

export const entityActionMap = {
    SET_PLAYER: (state: any, action: any) => {
        const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
        const mergedPlayer = { ...state.player, ...nextPlayer };
        return {
            ...state,
            player: mergedPlayer,
            quickSlots: sanitizeQuickSlots(state.quickSlots, mergedPlayer.inv),
            syncStatus: 'syncing'
        };
    },

    SET_EVENT: (state: any, action: any) =>
        ({ ...state, currentEvent: action.payload, syncStatus: 'syncing' }),

    SET_ENEMY: (state: any, action: any) => ({
        ...state,
        enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload,
        syncStatus: 'syncing'
    }),

    SET_GRAVE: (state: any, action: any) =>
        ({ ...state, grave: action.payload, syncStatus: 'syncing' }),
};
