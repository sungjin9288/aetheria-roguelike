import { BALANCE } from '../../data/constants';
import { GS } from '../gameStates';
import { sanitizeQuickSlots } from './helpers';
import type { HandlerMap } from '../gameReducer';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';
import { clampVitalsToEffectiveMax } from '../../utils/effectiveVitals';

export const uiActionMap = {
    SET_SYNC_STATUS: (state, action) =>
        ({ ...state, syncStatus: action.payload }),

    // 2026-09 D3: 다른 화면으로 넘어가면 지난 전투 결과 카드는 내린다 — 카드(z-40 하단 고정)가
    //   전투/이벤트/상점 화면의 주 행동 위에 남아 조작을 가리는 것을 막는다 (lessons R12).
    //   탐험 대기(idle)에서는 유지 — 승리 직후 판단 카드가 바로 사라지면 안 되기 때문.
    SET_GAME_STATE: (state, action) => ({
        ...state,
        gameState: action.payload,
        economyReceipt: action.payload === 'shop' ? state.economyReceipt : null,
        postCombatResult: action.payload === GS.IDLE ? state.postCombatResult : null,
        syncStatus: 'syncing',
    }),

    SET_AI_THINKING: (state, action) =>
        ({ ...state, isAiThinking: action.payload }),

    SET_VISUAL_EFFECT: (state, action) =>
        ({ ...state, visualEffect: action.payload }),

    SET_SIDE_TAB: (state, action) =>
        ({ ...state, sideTab: action.payload }),

    SET_SHOP_ITEMS: (state, action) =>
        ({ ...state, shopItems: action.payload }),

    SET_EXPEDITION_DEBRIEF_OPEN: (state, action) =>
        ({ ...state, expeditionDebriefOpen: action.payload === true }),

    CLEAR_ECONOMY_RECEIPT: (state) => state.economyReceipt
        ? { ...state, economyReceipt: null }
        : state,

    ADD_LOG: (state, action) =>
        ({ ...state, logs: [...state.logs, action.payload].slice(-BALANCE.LOG_MAX_SIZE) }),

    UPDATE_LOG: (state, action) => ({
        ...state,
        logs: state.logs.map((log) => log.id === action.payload.id ? action.payload.log : log)
    }),

    SET_POST_COMBAT_RESULT: (state, action) =>
        ({ ...state, postCombatResult: action.payload }),

    SET_QUICK_SLOT: (state, action) => {
        const candidate = action.payload.item;
        if (candidate && !(state.player.inv || []).some((item) => item.id === candidate.id)) {
            return state;
        }
        const next = [...state.quickSlots];
        next[action.payload.index] = candidate || null;
        return { ...state, quickSlots: next, syncStatus: 'syncing' };
    },
} satisfies HandlerMap;

export const entityActionMap = {
    SET_PLAYER: (state, action) => {
        const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
        const mergedPlayer = trackExpeditionVitals({ ...state.player, ...nextPlayer });
        return {
            ...state,
            player: mergedPlayer,
            quickSlots: sanitizeQuickSlots(state.quickSlots, mergedPlayer.inv),
            syncStatus: 'syncing'
        };
    },

    // 2026-09 Wave 30: 칭호 패시브(생명/기력 +N)는 유효 최대치의 입력이다. `SET_PLAYER {activeTitle}`로 바꾸던
    //   동안 생명 칭호를 해제해도 현재 생명이 옛 최대치에 남았다(D8과 같은 클래스의 마지막 전이, 원장 §27.6).
    SET_ACTIVE_TITLE: (state, action) => ({
        ...state,
        player: trackExpeditionVitals(clampVitalsToEffectiveMax({ ...state.player, activeTitle: action.payload })),
        syncStatus: 'syncing',
    }),

    SET_EVENT: (state, action) =>
        ({ ...state, currentEvent: action.payload, syncStatus: 'syncing' }),

    SET_ENEMY: (state, action) => ({
        ...state,
        enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload,
        syncStatus: 'syncing'
    }),

    SET_GRAVE: (state, action) =>
        ({ ...state, grave: action.payload, syncStatus: 'syncing' }),
} satisfies HandlerMap;
