import { DB } from '../data/db';
import { CONSTANTS } from '../data/constants';
import { DEFAULT_EXPLORE_STATE } from '../utils/explorationPacing';
import { bootstrapActionMap } from './handlers/bootstrapHandlers';
import { uiActionMap, entityActionMap } from './handlers/uiHandlers';
import { makeProgressionActionMap } from './handlers/progressionHandlers';
import { featureActionMap } from './handlers/featureHandlers';
import type { Player } from '../types';

/**
 * Game state shape — cycle 60 phase D — Player 도메인 타입 적용.
 * 다른 필드(enemy, grave, currentEvent 등)는 점진 적용 예정 — 현재는 any.
 */
export interface GameState {
    bootStage: string;
    uid: string | null;
    player: Player;
    // cycle 306: state.version dead 제거 — INITIAL_STATE 외 read/write 0건.
    //   Firebase sync는 매 save마다 CONSTANTS.DATA_VERSION 직접 기록.
    gameState: string;
    logs: any[];
    enemy: any;
    currentEvent: any;
    grave: any;
    shopItems: any[];
    sideTab: string;
    isAiThinking: boolean;
    visualEffect: any;
    syncStatus: string;
    leaderboard: any[];
    liveConfig: any;
    lastLoadedTimestamp: number;
    quickSlots: any[];
    postCombatResult: any;
    pendingRelics: any;
    runSummary: any;
    expeditionDebriefOpen: boolean;
    // cycle 305: publicGraves dead state 제거 — INITIAL_STATE [] 외 SET 0건,
    //   UI read 0건. INVADE_GRAVE 핸들러의 filter도 항상 [] 입력 → no-op.
}

// --- INITIAL STATE ---
export const INITIAL_STATE: GameState = {
    // Bootstrapping Flags
    bootStage: 'init', // init -> auth -> config -> data -> ready
    uid: null,

    // Game Data
    player: {
        name: '', job: '모험가', gender: 'male', level: 1, hp: CONSTANTS.START_HP, maxHp: CONSTANTS.START_HP, mp: CONSTANTS.START_MP, maxMp: CONSTANTS.START_MP, atk: 12, def: 5, exp: 0, nextExp: CONSTANTS.START_NEXT_EXP, gold: CONSTANTS.START_GOLD, loc: '시작의 마을',
        inv: [{ ...DB.ITEMS.consumables[0], id: 'starter_1' }, { ...DB.ITEMS.consumables[0], id: 'starter_2' }], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
        quests: [], achievements: [],
        expeditionFocusQuestIds: [],
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0, bountyDate: null, bountyIssued: false, bountiesCompleted: 0, relicCount: 0, crafts: 0, syntheses: 0, maxKillStreak: 0, abyssFloor: 0, abyssRecord: 0, demonKingSlain: 0, dailyProtocol: null, claimedAchievements: [], claimedQuestIds: [], explores: 0, exploresByLocation: {}, escapes: 0, buildWins: {}, discoveryChains: [], visitedMaps: ['시작의 마을'], exploreState: { ...DEFAULT_EXPLORE_STATE }, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} }, codexClaimed: [], lastSeenAt: null, abyssDailyDive: null },
        premiumCurrency: 0,
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
        weeklyProtocol: { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] },
        skillChoices: {},
        challengeModifiers: [],
        tempBuff: { atk: 0, def: 0, turn: 0, name: null }, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        settings: { readabilityMode: 'standard', equipmentDetailMode: 'auto' },
        meta: {
            essence: 0,
            rank: 0,
            bonusAtk: 0,
            bonusHp: 0,
            bonusMp: 0,
            prestigeRank: 0,
            mirror: {},
            storyMilestones: { seen: [], pending: [] },
        },
        relics: [], titles: [], activeTitle: null,
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
        killStreak: 0,
        history: [], archivedHistory: [],
        eventChainProgress: {},
        activeExpedition: null,
        lastExpeditionSummary: null,
    },

    // Runtime State
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
    pendingRelics: null,
    runSummary: null,
    expeditionDebriefOpen: false,
};

// --- REDUCER ---
export interface GameAction {
    type: string;
    payload?: any;
}

type ActionHandler = (state: GameState, action: GameAction) => GameState;
type ActionMap = Record<string, ActionHandler>;

// --- ACTION MAP ---
const ACTION_MAP: ActionMap = {
    ...bootstrapActionMap,
    ...uiActionMap,
    ...entityActionMap,
    ...makeProgressionActionMap(INITIAL_STATE),
    ...featureActionMap,
};

export const gameReducer = (state: GameState, action: GameAction): GameState => {
    const handler = ACTION_MAP[action.type];
    return handler ? handler(state, action) : state;
};
