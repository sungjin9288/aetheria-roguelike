/**
 * Game Action Type Constants
 * 모든 reducer action type을 상수로 관리하여 오타를 방지합니다.
 *
 * 2026-09 Wave 7 Y2: `AT` 바로 옆에 `ActionPayloadMap`(AT 키 → payload 타입)을 두고
 * 거기서 `GameAction` 판별 유니온을 도출한다. 아래 import는 전부 `import type`이라
 * 런타임 의존(순환 포함)이 생기지 않는다 — `gameReducer.ts`에서 import 하지 않는 것이
 * 이 파일의 유일한 제약이다(`GameState`는 gameReducer 소유).
 */
import type { Item, Monster, Player, PostCombatResult, Relic } from '../types';
import type { CodexCategory, DailyProtocol, DailyProtocolMissionType } from '../types/player.js';
import type { GameEvent, LeaderboardEntry, LiveConfig, LogEntry } from '../types/session.js';
import type { GraveEntry } from '../utils/graveUtils.js';
import type { buildRunSummary } from '../utils/gameUtils.js';
import type { PostCombatChoiceId } from '../utils/postCombatChoice.js';

export type UseCombatItemPayload = {
    itemId: string;
    expectedTurn: number;
    seed: number;
    now: number;
};

export type AscendPayload = {
    expectedPrestigeRank: number;
    sourceReceiptKey: string | null;
};

export interface ResolveBoundedEncounterChoicePayload {
    encounterId: string;
    choiceId: string;
    expeditionId: string;
    occurrenceSequence: number;
}

export interface ResolveChainGoldChoicePayload {
    chainId: string;
    step: number;
    choiceIndex: number;
}

export interface DeferChainEventPayload {
    chainId: string;
    step: number;
    choiceIndex: number;
    expectedExploreCount: number;
}

export interface ResolveFallbackEventTransactionPayload {
    transactionId: string;
    choiceIndex: number;
}

/** 2026-09 N1b — 플레이어 호출 정찰의 단일 전이 페이로드 (비용·게이지·카드 개방). */
export interface ResolveScoutPayload {
    seed: number;
    now: number;
}

/**
 * 2026-09 Wave 19 K1 — AI 이벤트 응답 1건의 정산 페이로드.
 * `event`가 있으면 카드를 열고, `null`이면 조용히 idle로 돌아간다(폴백도 못 고른 경우 ·
 * `generateEvent`가 reject한 경우). **늦게 도착한 응답을 버리는 판정은 리듀서가 한다** —
 * 페이로드에는 "무엇을 받았는가"만 있고 "지금 반영해도 되는가"는 상태가 답한다.
 */
export interface ResolveAiEventPayload {
    event: GameEvent | null;
}

export const AT = Object.freeze({
    // Boot / Auth
    SET_BOOT_STAGE: 'SET_BOOT_STAGE',
    SET_UID: 'SET_UID',

    // Data Loading
    LOAD_DATA: 'LOAD_DATA',
    RESET_GAME: 'RESET_GAME',

    // Live State
    SET_LIVE_CONFIG: 'SET_LIVE_CONFIG',
    SET_LEADERBOARD: 'SET_LEADERBOARD',

    // Game Flow
    SET_GAME_STATE: 'SET_GAME_STATE',
    SET_SYNC_STATUS: 'SET_SYNC_STATUS',

    // Entities
    SET_PLAYER: 'SET_PLAYER',
    ACCEPT_QUEST: 'ACCEPT_QUEST',
    ABANDON_QUEST: 'ABANDON_QUEST',
    REQUEST_BOUNTY: 'REQUEST_BOUNTY',
    UPDATE_EXPEDITION_FOCUS_QUEST: 'UPDATE_EXPEDITION_FOCUS_QUEST',
    SET_ENEMY: 'SET_ENEMY',
    SET_EVENT: 'SET_EVENT',
    SET_GRAVE: 'SET_GRAVE',

    // UI
    SET_AI_THINKING: 'SET_AI_THINKING',
    SET_VISUAL_EFFECT: 'SET_VISUAL_EFFECT',
    SET_SIDE_TAB: 'SET_SIDE_TAB',
    SET_SHOP_ITEMS: 'SET_SHOP_ITEMS',
    SET_EXPEDITION_DEBRIEF_OPEN: 'SET_EXPEDITION_DEBRIEF_OPEN',
    RECORD_RETURN_SUPPLY_REWARD: 'RECORD_RETURN_SUPPLY_REWARD',
    CLEAR_ECONOMY_RECEIPT: 'CLEAR_ECONOMY_RECEIPT',

    // Logs
    ADD_LOG: 'ADD_LOG',
    UPDATE_LOG: 'UPDATE_LOG',

    // Feature Additions
    SET_QUICK_SLOT: 'SET_QUICK_SLOT',
    SET_POST_COMBAT_RESULT: 'SET_POST_COMBAT_RESULT',
    USE_INVENTORY_ITEM: 'USE_INVENTORY_ITEM',
    BUY_SHOP_ITEM: 'BUY_SHOP_ITEM',
    SELL_INVENTORY_ITEM: 'SELL_INVENTORY_ITEM',
    CRAFT_RECIPE: 'CRAFT_RECIPE',
    SYNTHESIZE_ITEMS: 'SYNTHESIZE_ITEMS',
    AUTO_SELL_MATERIALS: 'AUTO_SELL_MATERIALS',
    PURCHASE_PREMIUM_OFFER: 'PURCHASE_PREMIUM_OFFER',
    USE_COMBAT_ITEM: 'USE_COMBAT_ITEM',
    RESOLVE_COMBAT_ACTION: 'RESOLVE_COMBAT_ACTION',
    RESOLVE_BOUNDED_ENCOUNTER_CHOICE: 'RESOLVE_BOUNDED_ENCOUNTER_CHOICE',
    RESOLVE_CHAIN_GOLD_CHOICE: 'RESOLVE_CHAIN_GOLD_CHOICE',
    DEFER_CHAIN_EVENT: 'DEFER_CHAIN_EVENT',
    RESOLVE_FALLBACK_EVENT_TRANSACTION: 'RESOLVE_FALLBACK_EVENT_TRANSACTION',
    // 2026-09 N1b — 정찰 1회를 단일 reducer 전이로 해소 (연타 이중 과금 차단)
    RESOLVE_SCOUT: 'RESOLVE_SCOUT',
    // 2026-09 Wave 19 K1 — AI 이벤트 준비 → 정산 2전이. 훅이 EVENT를 먼저 세우고
    //   응답을 기다리던 구조를 대체한다(준비 중은 EVENT_PENDING이고, 응답의 반영
    //   권한은 리듀서 하나에 있다 — 늦게 도착한 응답은 상태 검사로 버려진다).
    BEGIN_AI_EVENT: 'BEGIN_AI_EVENT',
    RESOLVE_AI_EVENT: 'RESOLVE_AI_EVENT',

    // v4.0 — Relic / Prestige / Title / Daily
    SET_PENDING_RELICS: 'SET_PENDING_RELICS',
    ADD_RELIC: 'ADD_RELIC',
    DECLINE_RELIC: 'DECLINE_RELIC',
    ASCEND: 'ASCEND',
    UNLOCK_TITLES: 'UNLOCK_TITLES',
    SET_DAILY_PROTOCOL: 'SET_DAILY_PROTOCOL',
    UPDATE_DAILY_PROTOCOL: 'UPDATE_DAILY_PROTOCOL',

    // v5.0
    SET_RUN_SUMMARY: 'SET_RUN_SUMMARY',

    // v4.1 — Codex & Synthesis
    UPDATE_CODEX: 'UPDATE_CODEX',

    // v4.2 — Season Pass
    ADD_SEASON_XP: 'ADD_SEASON_XP',
    CLAIM_QUEST_REWARD: 'CLAIM_QUEST_REWARD',
    CLAIM_ACHIEVEMENT_REWARD: 'CLAIM_ACHIEVEMENT_REWARD',
    CLAIM_SEASON_REWARD: 'CLAIM_SEASON_REWARD',
    CLAIM_CODEX_REWARD: 'CLAIM_CODEX_REWARD',

    // v4.3 — Enhancement + Weekly + Challenge + Skill Branch
    ENHANCE_ITEM: 'ENHANCE_ITEM',
    CLAIM_WEEKLY_MISSION: 'CLAIM_WEEKLY_MISSION',
    UPDATE_WEEKLY_PROTOCOL: 'UPDATE_WEEKLY_PROTOCOL',
    CHOOSE_SKILL_BRANCH: 'CHOOSE_SKILL_BRANCH',

    // v4.3 — Grave PvP
    INVADE_GRAVE: 'INVADE_GRAVE',

    // v5.0 — 내러티브 이벤트 체인
    UPDATE_EVENT_CHAIN: 'UPDATE_EVENT_CHAIN',

    // 2026-07 — 에테르 거울 (에센스 소비 영구 업그레이드 트리)
    PURCHASE_MIRROR_NODE: 'PURCHASE_MIRROR_NODE',

    // 2026-09 — 전투 후 "밀어붙인다 / 숨을 고른다" 2선택 (단일 reducer 전이 + 1회 한정)
    RESOLVE_POST_COMBAT_CHOICE: 'RESOLVE_POST_COMBAT_CHOICE',
} as const);

// cycle 301: ActionType type alias 제거 — 외부 import 0건. AT const literal types로 충분.

// cycle 210: dead duplicate GS / GameStateValue export 제거 — gameStates.ts의 GS export가
//   유일한 정식 source. src/ 전체에서 GS는 항상 './reducers/gameStates'로부터 import.
//   actionTypes.ts의 GS는 분리 후 정리되지 않은 잔해. cycle 195/206/207 dead cleanup 패턴.

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 7 Y2 — action payload 판별 유니온
//
// `ActionPayloadMap`이 "AT 키 → payload 타입"의 단일 원천이고, `GameAction`은 여기서
// 기계적으로 도출된다. 따라서 (a) 핸들러는 `action.payload`를 캐스트 없이 좁혀진 타입으로
// 받고, (b) 모든 `dispatch({ type: AT.X, payload })` 호출부가 이 맵에 대해 컴파일 검증된다.
//
// 슬라이스 규칙(계획서 §11): **핸들러와 모든 dispatch 호출부에서 모양을 확인한 키만**
// 실타입으로 넣는다. 이번 패스에서 닫지 못한 키도 유니온이 AT 63종을 전부 덮도록
// 맵에는 남긴다 — 빠뜨리면 그 키의 dispatch payload가 `never`로 떨어져 통합이 막힌다.
// ─────────────────────────────────────────────────────────────────────────────

/** `SET_PLAYER`/`LOAD_DATA`가 넘기는 부분 갱신 — reducer가 `{...state.player, ...patch}`로 병합한다. */
export type PlayerPatch = Partial<Player>;

/** 런 요약(`state.runSummary`) — 생산자 `gameUtils.buildRunSummary`가 곧 정의다. */
export type RunSummary = ReturnType<typeof buildRunSummary>;

/** `LOAD_DATA` — 클라우드/로컬 스냅샷을 `migrateData()`로 정규화한 결과(+ QA 시드). */
export interface LoadDataPayload {
    player: PlayerPatch;
    gameState?: string;
    enemy?: Monster | null;
    grave?: GraveEntry | GraveEntry[] | null;
    currentEvent?: GameEvent | null;
    quickSlots?: Array<Item | null> | null;
    /** Firestore Timestamp(`toMillis()`) 또는 ms 숫자. */
    lastActive?: number | { toMillis?: () => number } | null;
}

/** `RESOLVE_COMBAT_ACTION` — 공격/기술/도주 1턴 (`systems/combatActionTurn.ts`). */
export interface ResolveCombatActionPayload {
    kind: 'attack' | 'skill' | 'escape';
    expectedTurn: number;
    seed: number;
    now: number;
}

/** `UPDATE_DAILY_PROTOCOL` — 일일 임무 진척 1건. `itemRng`는 결정론 테스트 전용 주입구. */
export interface UpdateDailyProtocolPayload {
    type: DailyProtocolMissionType;
    amount?: number;
    relicRoll?: number;
    now?: number;
    logSeed?: number;
    itemRng?: () => number;
}

/** `UPDATE_WEEKLY_PROTOCOL` — 주간 임무 진척 1건. */
export interface UpdateWeeklyProtocolPayload {
    type: 'kills' | 'explores' | 'bossKills';
    now?: number;
}

/** `BUY_SHOP_ITEM` — UI는 선택 대상과 스냅샷만 넘기고 가격/지급은 reducer가 확정한다. */
export interface BuyShopItemPayload {
    source: string;
    itemName: string;
    /** `Player['gold']`와 같은 스냅샷 — reducer가 `state.player.gold !== expectedGold`로 그대로 비교한다. */
    expectedGold: Player['gold'];
    expectedInventorySize: number;
    relicRoll?: number;
}

/** `CRAFT_RECIPE` — 소비할 재료 인스턴스 id까지 호출부가 확정해 넘긴다. */
export interface CraftRecipePayload {
    recipeId: string;
    inputIds: string[];
    relicRoll?: number;
}

/** `SYNTHESIZE_ITEMS` — 합성 롤은 호출부 seed, 판정은 reducer. */
export interface SynthesizeItemsPayload {
    itemIds: string[];
    useProtect: boolean;
    successRoll: number;
    outputRoll: number;
    relicRoll?: number;
}

/** `ENHANCE_ITEM` — expected* 는 rapid tap 재생(replay) 거부용 스냅샷. */
export interface EnhanceItemPayload {
    itemId: string;
    /** `equipmentUtils.getEquipmentIdentity`의 반환형 — 식별 불가 장비는 null이다. */
    expectedItemIdentity: string | null;
    expectedLevel: number;
    expectedGold: number;
    roll: number;
    relicRoll?: number;
}

/** `PURCHASE_PREMIUM_OFFER` — 프리미엄 상점 1건. */
export interface PurchasePremiumOfferPayload {
    offerId: string;
    expectedCurrency: number;
}

/** `PURCHASE_MIRROR_NODE` — 에테르 거울 노드 1단계. */
export interface PurchaseMirrorNodePayload {
    nodeId: string;
    expectedEssence: number;
    expectedLevel: number;
}

/** 퀘스트/업적 id는 카탈로그(숫자)와 런타임 생성(현상수배 문자열)이 섞인다. */
export type QuestId = string | number;

/** AT 키 → payload 타입. `undefined`는 "payload 없는 액션"을 뜻한다. */
export interface ActionPayloadMap {
    // ── Boot / Auth ──────────────────────────────────────────────────────
    [AT.SET_BOOT_STAGE]: string;
    [AT.SET_UID]: string | null;

    // ── Data Loading ─────────────────────────────────────────────────────
    [AT.LOAD_DATA]: LoadDataPayload;
    [AT.RESET_GAME]: undefined;

    // ── Live State ───────────────────────────────────────────────────────
    [AT.SET_LIVE_CONFIG]: Partial<LiveConfig>;
    [AT.SET_LEADERBOARD]: LeaderboardEntry[];

    // ── Game Flow ────────────────────────────────────────────────────────
    [AT.SET_GAME_STATE]: string;
    [AT.SET_SYNC_STATUS]: string;

    // ── Entities ─────────────────────────────────────────────────────────
    [AT.SET_PLAYER]: PlayerPatch | ((player: Player) => PlayerPatch);
    [AT.ACCEPT_QUEST]: { questId: QuestId };
    [AT.ABANDON_QUEST]: { questId: QuestId };
    [AT.REQUEST_BOUNTY]: { requestedAt: number; seed: number };
    [AT.UPDATE_EXPEDITION_FOCUS_QUEST]: { questId: QuestId; selected: boolean };
    [AT.SET_ENEMY]: Monster | null | ((enemy: Monster | null) => Monster | null);
    [AT.SET_EVENT]: GameEvent | null;
    [AT.SET_GRAVE]: GraveEntry | GraveEntry[] | null;

    // ── UI ───────────────────────────────────────────────────────────────
    [AT.SET_AI_THINKING]: boolean;
    [AT.SET_VISUAL_EFFECT]: string | null;
    [AT.SET_SIDE_TAB]: string;
    [AT.SET_SHOP_ITEMS]: Item[];
    [AT.SET_EXPEDITION_DEBRIEF_OPEN]: boolean;
    [AT.RECORD_RETURN_SUPPLY_REWARD]: { expeditionId: string };
    [AT.CLEAR_ECONOMY_RECEIPT]: undefined;

    // ── Logs ─────────────────────────────────────────────────────────────
    [AT.ADD_LOG]: LogEntry;
    [AT.UPDATE_LOG]: { id: string; log: LogEntry };

    // ── Feature Additions ────────────────────────────────────────────────
    [AT.SET_QUICK_SLOT]: { index: number; item: Item | null };
    // 2026-09 Wave 8 Z1: 생산자(combatVictory.ts) 리터럴에서 도출한 실제 계약으로 확정.
    //   카드(PostCombatCard) · 상태(GameState.postCombatResult) · 이 payload가 같은 타입이다.
    [AT.SET_POST_COMBAT_RESULT]: PostCombatResult | null;
    [AT.USE_INVENTORY_ITEM]: { itemId: string };
    [AT.BUY_SHOP_ITEM]: BuyShopItemPayload;
    [AT.SELL_INVENTORY_ITEM]: { itemId: string };
    [AT.CRAFT_RECIPE]: CraftRecipePayload;
    [AT.SYNTHESIZE_ITEMS]: SynthesizeItemsPayload;
    [AT.AUTO_SELL_MATERIALS]: undefined;
    [AT.PURCHASE_PREMIUM_OFFER]: PurchasePremiumOfferPayload;
    [AT.USE_COMBAT_ITEM]: UseCombatItemPayload;
    [AT.RESOLVE_COMBAT_ACTION]: ResolveCombatActionPayload;
    [AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE]: ResolveBoundedEncounterChoicePayload;
    [AT.RESOLVE_CHAIN_GOLD_CHOICE]: ResolveChainGoldChoicePayload;
    [AT.DEFER_CHAIN_EVENT]: DeferChainEventPayload;
    [AT.RESOLVE_FALLBACK_EVENT_TRANSACTION]: ResolveFallbackEventTransactionPayload;
    [AT.RESOLVE_SCOUT]: ResolveScoutPayload;
    [AT.BEGIN_AI_EVENT]: undefined;
    [AT.RESOLVE_AI_EVENT]: ResolveAiEventPayload;

    // ── v4.0 — Relic / Prestige / Title / Daily ──────────────────────────
    [AT.SET_PENDING_RELICS]: Relic[] | null;
    [AT.ADD_RELIC]: Relic;
    [AT.DECLINE_RELIC]: undefined;
    [AT.ASCEND]: AscendPayload;
    [AT.UNLOCK_TITLES]: string[];
    [AT.SET_DAILY_PROTOCOL]: DailyProtocol | null;
    [AT.UPDATE_DAILY_PROTOCOL]: UpdateDailyProtocolPayload;

    // ── v5.0 ─────────────────────────────────────────────────────────────
    [AT.SET_RUN_SUMMARY]: RunSummary | null;

    // ── v4.1 — Codex & Synthesis ─────────────────────────────────────────
    [AT.UPDATE_CODEX]: { category: CodexCategory; name: string };

    // ── v4.2 — Season Pass ───────────────────────────────────────────────
    [AT.ADD_SEASON_XP]: number;
    [AT.CLAIM_QUEST_REWARD]: { questId: QuestId };
    // 업적 id는 카탈로그 전용(문자열) — 현상수배 같은 런타임 생성이 없다.
    [AT.CLAIM_ACHIEVEMENT_REWARD]: { achievementId: string };
    [AT.CLAIM_SEASON_REWARD]: { tier: number };
    [AT.CLAIM_CODEX_REWARD]: { milestoneId: string };

    // ── v4.3 — Enhancement + Weekly + Challenge + Skill Branch ───────────
    [AT.ENHANCE_ITEM]: EnhanceItemPayload;
    [AT.CLAIM_WEEKLY_MISSION]: { missionId: string };
    [AT.UPDATE_WEEKLY_PROTOCOL]: UpdateWeeklyProtocolPayload;
    [AT.CHOOSE_SKILL_BRANCH]: { skillName: string; choice: string };

    // ── v4.3 — Grave PvP ─────────────────────────────────────────────────
    [AT.INVADE_GRAVE]: { reward: Item | null; uid?: string };

    // ── v5.0 — 내러티브 이벤트 체인 ───────────────────────────────────────
    //   `step`은 다음 스텝 번호이거나, 실패 분기에서 'failed' 문자열이다.
    [AT.UPDATE_EVENT_CHAIN]: { chainId: string; step: number | 'failed' };

    // ── 2026-07 — 에테르 거울 ────────────────────────────────────────────
    [AT.PURCHASE_MIRROR_NODE]: PurchaseMirrorNodePayload;

    // ── 2026-09 — 전투 후 2선택 ──────────────────────────────────────────
    [AT.RESOLVE_POST_COMBAT_CHOICE]: { choice: PostCombatChoiceId };
}

/** 모든 action type 리터럴의 유니온 — `AT`의 값 집합과 같다. */
export type ActionType = keyof ActionPayloadMap;

/**
 * reducer가 받는 action — `ActionPayloadMap`에서 도출한 판별 유니온.
 * payload 타입이 `undefined`인 키는 payload 자체를 생략한다.
 */
export type GameAction = {
    [K in ActionType]: ActionPayloadMap[K] extends undefined
        ? { type: K; payload?: undefined }
        : { type: K; payload: ActionPayloadMap[K] };
}[ActionType];

/** 특정 action type 하나로 좁힌 action 멤버 — 핸들러 시그니처에 쓴다. */
export type ActionOf<K extends ActionType> = Extract<GameAction, { type: K }>;

type AssertNever<T extends never> = T;

/**
 * 컴파일 가드 — `AT`에 키를 추가하고 `ActionPayloadMap`에 빠뜨리면 여기서 에러가 난다.
 * (맵에 없는 키는 dispatch payload가 `never`로 떨어져 조용히 호출부를 막는다.)
 */
export type ActionPayloadMapIsExhaustive =
    AssertNever<Exclude<(typeof AT)[keyof typeof AT], ActionType>>;
