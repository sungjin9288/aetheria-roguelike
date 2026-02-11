import { DB } from '../data/db'; // Adjust path if needed

// --- INITIAL STATE ---
export const INITIAL_STATE = {
    // Bootstrapping Flags
    bootStage: 'init', // init -> auth -> config -> data -> ready
    uid: null,

    // Game Data
    player: {
        name: '', job: '모험가', gender: 'male', level: 1, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5, exp: 0, nextExp: 100, gold: 200, loc: '시작의 마을',
        inv: [{ ...DB.ITEMS.consumables[0], id: 'starter_1' }, { ...DB.ITEMS.consumables[0], id: 'starter_2' }], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
        quests: [], achievements: [], stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
        tempBuff: { atk: 0, turn: 0 }, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        history: [], archivedHistory: []
    },

    // Runtime State
    version: 2.7,
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
    lastLoadedTimestamp: 0
};

// --- REDUCER (Atomic Logic) ---
export const gameReducer = (state, action) => {
    switch (action.type) {
        case 'SET_BOOT_STAGE':
            return { ...state, bootStage: action.payload };
        case 'SET_UID':
            return { ...state, uid: action.payload };
        case 'LOAD_DATA':
            // Atomic Load: Merges initialized data and sets ready
            return {
                ...state,
                player: { ...state.player, ...action.payload.player },
                gameState: action.payload.gameState || 'idle',
                enemy: action.payload.enemy || null,
                // If name exists, we are ready. If not, we stay in 'ready' stage but Intro component handles name input.
                bootStage: 'ready',
                syncStatus: 'synced',
                lastLoadedTimestamp: action.payload.lastActive?.toMillis() || Date.now()
            };
        case 'SET_LIVE_CONFIG':
            return { ...state, liveConfig: { ...state.liveConfig, ...action.payload } };
        case 'SET_LEADERBOARD':
            return { ...state, leaderboard: action.payload };

        // Runtime Updates
        case 'SET_SYNC_STATUS':
            return { ...state, syncStatus: action.payload };
        case 'SET_GAME_STATE':
            return { ...state, gameState: action.payload, syncStatus: 'syncing' };
        case 'SET_PLAYER': {
            const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
            return { ...state, player: { ...state.player, ...nextPlayer }, syncStatus: 'syncing' };
        }
        case 'SET_EVENT':
            return { ...state, currentEvent: action.payload, syncStatus: 'syncing' };
        case 'SET_ENEMY':
            return { ...state, enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload, syncStatus: 'syncing' };
        case 'SET_GRAVE':
            return { ...state, grave: action.payload, syncStatus: 'syncing' };
        case 'SET_AI_THINKING':
            return { ...state, isAiThinking: action.payload };
        case 'SET_VISUAL_EFFECT':
            return { ...state, visualEffect: action.payload };
        case 'SET_SIDE_TAB':
            return { ...state, sideTab: action.payload };
        case 'SET_SHOP_ITEMS':
            return { ...state, shopItems: action.payload };
        case 'ADD_LOG':
            return { ...state, logs: [...state.logs, action.payload].slice(-50) };
        case 'UPDATE_LOG':
            return {
                ...state,
                logs: state.logs.map(log => log.id === action.payload.id ? action.payload.log : log)
            };
        case 'RESET_GAME':
            return { ...INITIAL_STATE, bootStage: 'ready', uid: state.uid, syncStatus: 'syncing' };
        default:
            return state;
    }
};
