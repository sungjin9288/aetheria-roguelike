import { BALANCE } from '../../data/constants';
import { GS } from '../gameStates';
import { sanitizeQuickSlots } from './helpers';
import type { GameState, GameAction } from '../gameReducer';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';

export const uiActionMap = {
    SET_SYNC_STATUS: (state: GameState, action: GameAction) =>
        ({ ...state, syncStatus: action.payload }),

    // 2026-09 D3: 다른 화면으로 넘어가면 지난 전투 결과 카드는 내린다 — 카드(z-40 하단 고정)가
    //   전투/이벤트/상점 화면의 주 행동 위에 남아 조작을 가리는 것을 막는다 (lessons R12).
    //   탐험 대기(idle)에서는 유지 — 승리 직후 판단 카드가 바로 사라지면 안 되기 때문.
    SET_GAME_STATE: (state: GameState, action: GameAction) => ({
        ...state,
        gameState: action.payload,
        economyReceipt: action.payload === 'shop' ? state.economyReceipt : null,
        postCombatResult: action.payload === GS.IDLE ? state.postCombatResult : null,
        syncStatus: 'syncing',
    }),

    SET_AI_THINKING: (state: GameState, action: GameAction) =>
        ({ ...state, isAiThinking: action.payload }),

    SET_VISUAL_EFFECT: (state: GameState, action: GameAction) =>
        ({ ...state, visualEffect: action.payload }),

    SET_SIDE_TAB: (state: GameState, action: GameAction) =>
        ({ ...state, sideTab: action.payload }),

    SET_SHOP_ITEMS: (state: GameState, action: GameAction) =>
        ({ ...state, shopItems: action.payload }),

    SET_EXPEDITION_DEBRIEF_OPEN: (state: GameState, action: GameAction) =>
        ({ ...state, expeditionDebriefOpen: action.payload === true }),

    CLEAR_ECONOMY_RECEIPT: (state: GameState) => state.economyReceipt
        ? { ...state, economyReceipt: null }
        : state,

    ADD_LOG: (state: GameState, action: GameAction) =>
        ({ ...state, logs: [...state.logs, action.payload].slice(-BALANCE.LOG_MAX_SIZE) }),

    UPDATE_LOG: (state: GameState, action: GameAction) => ({
        ...state,
        logs: state.logs.map((log: any) => log.id === action.payload.id ? action.payload.log : log)
    }),

    SET_POST_COMBAT_RESULT: (state: GameState, action: GameAction) =>
        ({ ...state, postCombatResult: action.payload }),

    SET_QUICK_SLOT: (state: GameState, action: GameAction) => {
        const candidate = action.payload.item;
        if (candidate && !(state.player.inv || []).some((item: any) => item.id === candidate.id)) {
            return state;
        }
        const next = [...state.quickSlots];
        next[action.payload.index] = candidate || null;
        return { ...state, quickSlots: next, syncStatus: 'syncing' };
    },
};

export const entityActionMap = {
    SET_PLAYER: (state: GameState, action: GameAction) => {
        const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
        const mergedPlayer = trackExpeditionVitals({ ...state.player, ...nextPlayer });
        return {
            ...state,
            player: mergedPlayer,
            quickSlots: sanitizeQuickSlots(state.quickSlots, mergedPlayer.inv),
            syncStatus: 'syncing'
        };
    },

    SET_EVENT: (state: GameState, action: GameAction) =>
        ({ ...state, currentEvent: action.payload, syncStatus: 'syncing' }),

    SET_ENEMY: (state: GameState, action: GameAction) => ({
        ...state,
        enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload,
        syncStatus: 'syncing'
    }),

    SET_GRAVE: (state: GameState, action: GameAction) =>
        ({ ...state, grave: action.payload, syncStatus: 'syncing' }),
};
