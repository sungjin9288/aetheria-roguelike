import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { MSG } from '../data/messages';
import { DEFAULT_EXPLORE_STATE } from '../utils/explorationPacing';
import { bootstrapActionMap } from './handlers/bootstrapHandlers';
import { uiActionMap, entityActionMap } from './handlers/uiHandlers';
import { makeProgressionActionMap } from './handlers/progressionHandlers';
import { makeFeatureActionMap } from './handlers/featureHandlers';
import type { Player, Item, Monster, PostCombatResult, Relic } from '../types';
import type { LogEntry, GameEvent, LiveConfig, LeaderboardEntry } from '../types/session.js';
import type { GraveEntry } from '../utils/graveUtils.js';
import type { buildRunSummary } from '../utils/gameUtils.js';
import { createCurrentRunProgress } from '../utils/runProgress';
import { deliverPendingReturnSupplyRewards } from '../utils/returnSupplyReward';
import { returnSupplyRewardActionMap } from './handlers/rewardedAdHandlers';
import { boundedEncounterActionMap } from './handlers/boundedEncounterHandlers';
import type { ActionOf, ActionType, GameAction } from './actionTypes';

/**
 * Game state shape — cycle 60 phase D Player 적용 + 2026-09 Wave 6 X4에서
 * enemy/currentEvent/grave/shopItems/logs/leaderboard/liveConfig/quickSlots/
 * pendingRelics/runSummary/visualEffect까지 도메인 타입으로 닫았다.
 * 2026-09 Wave 8 Z1에서 마지막 구조적 `any`였던 `postCombatResult`도 닫혔다 —
 * 생산자(hooks/combatActions/combatVictory.ts)의 dispatch 리터럴에서 도출한
 * `PostCombatResult`(types/combat.ts)가 카드·QA 주입·액션 payload의 단일 계약이다.
 * 소비자가 가정하던 별칭 `loot`는 생산자가 없어 dead read였고 카드에서 제거했다
 * (QA 시드만 쓰는 `hpLow`/`mpLow`는 타입에 optional로 기록).
 * 훅 주입 경계(`hooks/actionDeps.ts`, Wave 6 X1)는 이 필드들을 `GameState['x']`로 참조하므로
 * 여기가 단일 원천이다 — 세션 형태 타입은 `types/session.ts`에 둔다.
 */
export interface GameState {
    bootStage: string;
    uid: string | null;
    player: Player;
    // cycle 306: state.version dead 제거 — INITIAL_STATE 외 read/write 0건.
    //   Firebase sync는 매 save마다 CONSTANTS.DATA_VERSION 직접 기록.
    gameState: string;
    logs: LogEntry[];
    enemy: Monster | null;
    currentEvent: GameEvent | null;
    // 구형 save는 단일 GraveEntry, 신형(2026-07 다중 지역 묘비)은 GraveEntry[] — 둘 다
    //   graveUtils.normalizeGraves()가 흡수한다(utils의 사설 GraveInput과 동형).
    grave: GraveEntry | GraveEntry[] | null;
    shopItems: Item[];
    sideTab: string;
    isAiThinking: boolean;
    visualEffect: string | null;
    syncStatus: string;
    leaderboard: LeaderboardEntry[];
    liveConfig: LiveConfig;
    lastLoadedTimestamp: number;
    presentationEpoch: number;
    quickSlots: Array<Item | null>;
    postCombatResult: PostCombatResult | null;
    pendingRelics: Relic[] | null;
    runSummary: ReturnType<typeof buildRunSummary> | null;
    expeditionDebriefOpen: boolean;
    questClaimReceipt: { key: string; questId: string | number; title: string } | null;
    economyReceipt: { key: string; type: 'buy'; itemName: string } | null;
    combatTurn: number;
    combatReceipt: {
        key: string;
        kind: 'continue' | 'victory' | 'defeat' | 'escape' | 'rejected';
        stories: Array<{ type: string; data: Record<string, unknown> }>;
        lootSettlement?: LootSettlementReceipt;
    } | null;
    // cycle 305: publicGraves dead state 제거 — INITIAL_STATE [] 외 SET 0건,
    //   UI read 0건. INVADE_GRAVE 핸들러의 filter도 항상 [] 입력 → no-op.
}


export interface LootSettlementReceipt {
    rolledCount: number;
    admittedCount: number;
    blockedCount: number;
    admittedItemIds: string[];
    admittedSignatureCount: number;
    blockedSignatureCount: number;
    pityBefore: number;
    pityAfter: number;
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
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0, bountyDate: null, bountyIssued: false, bountiesCompleted: 0, relicCount: 0, crafts: 0, syntheses: 0, maxKillStreak: 0, abyssFloor: 0, abyssRecord: 0, demonKingSlain: 0, dailyProtocol: null, claimedAchievements: [], claimedQuestIds: [], explores: 0, exploresByLocation: {}, escapes: 0, buildWins: {}, discoveryChains: [], visitedMaps: ['시작의 마을'], currentRun: createCurrentRunProgress({ visitedMaps: ['시작의 마을'] }), exploreState: { ...DEFAULT_EXPLORE_STATE }, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} }, codexClaimed: [], lastSeenAt: null, abyssDailyDive: null },
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
            essenceLifetime: 0,
            rank: 0,
            bonusAtk: 0,
            bonusHp: 0,
            bonusMp: 0,
            prestigeRank: 0,
            mirror: {},
            storyMilestones: { seen: [], pending: [] },
            endgame: {
                version: 1,
                primalShards: 0,
                legacyInventoryMigrated: true,
                lastEndgameReceiptKey: null,
                trueEndingSeen: false,
            },
        },
        relics: [], titles: [], activeTitle: null,
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
        killStreak: 0,
        history: [],
        eventChainProgress: {},
        activeExpedition: null,
        lastExpeditionSummary: null,
        expeditionSequence: 0,
        returnSupplyRewards: { version: 1, receipts: {} },
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
    liveConfig: {
        eventMultiplier: 1,
        progressionProfile: { id: 'exploration-rhythm', version: 3 },
        announcement: '',
        seasonEvent: null,
    },

    // Sync Guard
    lastLoadedTimestamp: 0,
    presentationEpoch: 0,

    // Feature Additions
    quickSlots: [null, null, null],
    postCombatResult: null,
    pendingRelics: null,
    runSummary: null,
    expeditionDebriefOpen: false,
    questClaimReceipt: null,
    economyReceipt: null,
    combatTurn: 0,
    combatReceipt: null,
};

// --- REDUCER ---
/**
 * 2026-09 Wave 7 Y2: `GameAction`은 `actionTypes.ts`의 `ActionPayloadMap`에서 도출된
 * 판별 유니온이다. 기존 import 경로(`from '../gameReducer'`)를 유지하려고 여기서 재수출한다.
 */
export type { ActionOf, ActionType, GameAction } from './actionTypes';

/**
 * 핸들러 맵 — 키는 action type 리터럴, 값은 **그 키로 좁혀진** action을 받는 핸들러다.
 * 각 핸들러 맵은 `satisfies HandlerMap`으로 선언한다(키 집합은 리터럴로 남기면서
 * `action.payload`가 캐스트 없이 좁혀지도록 컨텍스트 타입만 받는다).
 */
export type HandlerMap = {
    [K in ActionType]?: (state: GameState, action: ActionOf<K>) => GameState;
};

// --- ACTION MAP ---
const ACTION_MAP = {
    ...bootstrapActionMap,
    ...uiActionMap,
    ...entityActionMap,
    ...makeProgressionActionMap(INITIAL_STATE),
    ...makeFeatureActionMap(INITIAL_STATE.player),
    ...returnSupplyRewardActionMap,
    ...boundedEncounterActionMap,
} satisfies HandlerMap;

export const gameReducer = (state: GameState, action: GameAction): GameState => {
    // 맵을 유니온 키로 조회하면 handler의 파라미터도 유니온이 되어 TS가 "핸들러 K와 action K가
    // 같은 멤버"임을 스스로 세우지 못한다. 그 상관관계를 이 한 줄에서만 못 박고
    // (payload는 절대 넓히지 않는다 — action/handler 모두 동일한 `GameAction` 유니온),
    // 개별 핸들러 안에서는 캐스트 없이 좁혀진 payload를 쓴다.
    const handler = ACTION_MAP[action.type] as
        | ((state: GameState, action: GameAction) => GameState)
        | undefined;
    if (!handler) return state;
    const nextState = handler(state, action);
    if (nextState === state) return state;
    const delivery = deliverPendingReturnSupplyRewards(nextState.player);
    if (delivery.player === nextState.player) return nextState;
    const deliveryLogs = delivery.deliveredExpeditionIds.map((expeditionId) => ({
        id: `return-supply:${expeditionId}`,
        type: 'success',
        text: MSG.RETURN_SUPPLY_DELIVERED,
    }));
    return {
        ...nextState,
        player: delivery.player,
        logs: [...nextState.logs, ...deliveryLogs].slice(-BALANCE.LOG_MAX_SIZE),
        syncStatus: 'syncing',
    };
};
