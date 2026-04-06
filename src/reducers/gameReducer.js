import { DB } from '../data/db';
import { CONSTANTS } from '../data/constants';
import { DEFAULT_EXPLORE_STATE } from '../utils/explorationPacing';
import { bootstrapActionMap } from './handlers/bootstrapHandlers';
import { uiActionMap, entityActionMap } from './handlers/uiHandlers';
import { makeProgressionActionMap } from './handlers/progressionHandlers';
import { featureActionMap } from './handlers/featureHandlers';

// --- INITIAL STATE ---
export const INITIAL_STATE = {
    // Bootstrapping Flags
    bootStage: 'init', // init -> auth -> config -> data -> ready
    uid: null,

    // Game Data
    player: {
        name: '', job: '모험가', gender: 'male', level: 1, hp: CONSTANTS.START_HP, maxHp: CONSTANTS.START_HP, mp: CONSTANTS.START_MP, maxMp: CONSTANTS.START_MP, atk: 10, def: 5, exp: 0, nextExp: 100, gold: CONSTANTS.START_GOLD, loc: '시작의 마을',
        inv: [{ ...DB.ITEMS.consumables[0], id: 'starter_1' }, { ...DB.ITEMS.consumables[0], id: 'starter_2' }], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
        quests: [], achievements: [],
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0, bountyDate: null, bountyIssued: false, bountiesCompleted: 0, relicCount: 0, comboCount: 0, crafts: 0, abyssFloor: 0, demonKingSlain: 0, dailyProtocol: null, claimedAchievements: [], explores: 0, lowHpWins: 0, discoveries: 0, buildWins: {}, visitedMaps: ['시작의 마을'], exploreState: { ...DEFAULT_EXPLORE_STATE }, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} }, codexClaimed: [] },
        premiumCurrency: 0,
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
        weeklyProtocol: { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] },
        skillChoices: {},
        challengeModifiers: [],
        tempBuff: { atk: 0, def: 0, turn: 0, name: null }, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 0, totalPrestigeAtk: 0, totalPrestigeHp: 0, totalPrestigeMp: 0 },
        relics: [], titles: [], activeTitle: null,
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
        killStreak: 0,
        history: [], archivedHistory: [],
        eventChainProgress: {}
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
    liveConfig: { eventMultiplier: 1, announcement: '', seasonEvent: null },

    // Sync Guard
    lastLoadedTimestamp: 0,

    // Feature Additions
    quickSlots: [null, null, null],
    postCombatResult: null,
    onboardingDismissed: false,
    pendingRelics: null,
    runSummary: null,
    publicGraves: [],
};

// --- ACTION MAP ---
const ACTION_MAP = {
    ...bootstrapActionMap,
    ...uiActionMap,
    ...entityActionMap,
    ...makeProgressionActionMap(INITIAL_STATE),
    ...featureActionMap,
};

// --- REDUCER ---
export const gameReducer = (state, action) => {
    const handler = ACTION_MAP[action.type];
    return handler ? handler(state, action) : state;
};
