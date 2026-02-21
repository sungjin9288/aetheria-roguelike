import { DB } from '../data/db';
import { CONSTANTS } from '../data/constants';
import { AT } from './actionTypes';

// --- INITIAL STATE ---
export const INITIAL_STATE = {
    // Bootstrapping Flags
    bootStage: 'init', // init -> auth -> config -> data -> ready
    uid: null,

    // Game Data
    player: {
        name: '', job: '모험가', gender: 'male', level: 1, hp: CONSTANTS.START_HP, maxHp: CONSTANTS.START_HP, mp: CONSTANTS.START_MP, maxMp: CONSTANTS.START_MP, atk: 10, def: 5, exp: 0, nextExp: 100, gold: CONSTANTS.START_GOLD, loc: '시작의 마을',
        inv: [{ ...DB.ITEMS.consumables[0], id: 'starter_1' }, { ...DB.ITEMS.consumables[0], id: 'starter_2' }], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
        quests: [], achievements: [], stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
        tempBuff: { atk: 0, turn: 0 }, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        history: [], archivedHistory: []
    },

    // Runtime State
    version: CONSTANTS.DATA_VERSION,

    gameState: 'idle',
    logs: [],
    enemy: null,
    currentEvent: null,
    grave: null,
    shopItems: [],
    sideTab: 'inventory',
    isAiThinking: false,
    visualEffect: null,
    syncStatus: 'offline', // offline, syncing, synced

    // Shared Data
    leaderboard: [],
    liveConfig: { eventMultiplier: 1, announcement: '' },

    // Sync Guard
    lastLoadedTimestamp: 0,

    // Feature Additions
    quickSlots: [null, null, null],   // 퀵슬롯 3개
    postCombatResult: null,            // 전투 결과 요약 카드
    onboardingDismissed: false,        // 온보딩 안내 숨김 여부
};

// --- REDUCER (Atomic Logic) ---
export const gameReducer = (state, action) => {
    switch (action.type) {
        case AT.SET_BOOT_STAGE:
            return { ...state, bootStage: action.payload };
        case AT.SET_UID:
            return { ...state, uid: action.payload };
        case AT.LOAD_DATA:
            return {
                ...state,
                player: { ...state.player, ...action.payload.player },
                gameState: action.payload.gameState || 'idle',
                enemy: action.payload.enemy || null,
                bootStage: 'ready',
                syncStatus: 'synced',
                lastLoadedTimestamp: action.payload.lastActive?.toMillis() || Date.now()
            };
        case AT.SET_LIVE_CONFIG:
            return { ...state, liveConfig: { ...state.liveConfig, ...action.payload } };
        case AT.SET_LEADERBOARD:
            return { ...state, leaderboard: action.payload };

        case AT.SET_SYNC_STATUS:
            return { ...state, syncStatus: action.payload };
        case AT.SET_GAME_STATE:
            return { ...state, gameState: action.payload, syncStatus: 'syncing' };
        case AT.SET_PLAYER: {
            const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
            return { ...state, player: { ...state.player, ...nextPlayer }, syncStatus: 'syncing' };
        }
        case AT.SET_EVENT:
            return { ...state, currentEvent: action.payload, syncStatus: 'syncing' };
        case AT.SET_ENEMY:
            return { ...state, enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload, syncStatus: 'syncing' };
        case AT.SET_GRAVE:
            return { ...state, grave: action.payload, syncStatus: 'syncing' };
        case AT.SET_AI_THINKING:
            return { ...state, isAiThinking: action.payload };
        case AT.SET_VISUAL_EFFECT:
            return { ...state, visualEffect: action.payload };
        case AT.SET_SIDE_TAB:
            return { ...state, sideTab: action.payload };
        case AT.SET_SHOP_ITEMS:
            return { ...state, shopItems: action.payload };
        case AT.ADD_LOG:
            return { ...state, logs: [...state.logs, action.payload].slice(-CONSTANTS.LOG_MAX_SIZE || -50) };
        case AT.UPDATE_LOG:
            return {
                ...state,
                logs: state.logs.map(log => log.id === action.payload.id ? action.payload.log : log)
            };
        case AT.SET_QUICK_SLOT: {
            const next = [...state.quickSlots];
            next[action.payload.index] = action.payload.item;
            return { ...state, quickSlots: next };
        }
        case AT.SET_POST_COMBAT_RESULT:
            return { ...state, postCombatResult: action.payload };
        case AT.SET_ONBOARDING_DISMISSED:
            return { ...state, onboardingDismissed: true };
        case AT.RESET_GAME:
            return { ...INITIAL_STATE, bootStage: 'ready', uid: state.uid, syncStatus: 'syncing' };
        default:
            return state;
    }
};
