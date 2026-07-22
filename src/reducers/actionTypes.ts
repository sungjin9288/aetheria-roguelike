/**
 * Game Action Type Constants
 * 모든 reducer action type을 상수로 관리하여 오타를 방지합니다.
 */
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
    SET_EXPEDITION_FOCUS: 'SET_EXPEDITION_FOCUS',
    SET_ENEMY: 'SET_ENEMY',
    SET_EVENT: 'SET_EVENT',
    SET_GRAVE: 'SET_GRAVE',

    // UI
    SET_AI_THINKING: 'SET_AI_THINKING',
    SET_VISUAL_EFFECT: 'SET_VISUAL_EFFECT',
    SET_SIDE_TAB: 'SET_SIDE_TAB',
    SET_SHOP_ITEMS: 'SET_SHOP_ITEMS',
    SET_EXPEDITION_DEBRIEF_OPEN: 'SET_EXPEDITION_DEBRIEF_OPEN',

    // Logs
    ADD_LOG: 'ADD_LOG',
    UPDATE_LOG: 'UPDATE_LOG',

    // Feature Additions
    SET_QUICK_SLOT: 'SET_QUICK_SLOT',
    SET_POST_COMBAT_RESULT: 'SET_POST_COMBAT_RESULT',

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
    CLAIM_SEASON_REWARD: 'CLAIM_SEASON_REWARD',
    CLAIM_CODEX_REWARD: 'CLAIM_CODEX_REWARD',

    // v4.3 — Enhancement + Weekly + Challenge + Skill Branch
    ENHANCE_ITEM: 'ENHANCE_ITEM',
    CLAIM_WEEKLY_MISSION: 'CLAIM_WEEKLY_MISSION',
    UPDATE_WEEKLY_PROTOCOL: 'UPDATE_WEEKLY_PROTOCOL',
    CHOOSE_SKILL_BRANCH: 'CHOOSE_SKILL_BRANCH',

    // v4.3 — Grave PvP
    INVADE_GRAVE: 'INVADE_GRAVE',

    // v5.0 — True Ending
    TRIGGER_TRUE_ENDING: 'TRIGGER_TRUE_ENDING',

    // v5.0 — 내러티브 이벤트 체인
    UPDATE_EVENT_CHAIN: 'UPDATE_EVENT_CHAIN',

    // 2026-07 — 에테르 거울 (에센스 소비 영구 업그레이드 트리)
    PURCHASE_MIRROR_NODE: 'PURCHASE_MIRROR_NODE',
} as const);

// cycle 301: ActionType type alias 제거 — 외부 import 0건. AT const literal types로 충분.

// cycle 210: dead duplicate GS / GameStateValue export 제거 — gameStates.ts의 GS export가
//   유일한 정식 source. src/ 전체에서 GS는 항상 './reducers/gameStates'로부터 import.
//   actionTypes.ts의 GS는 분리 후 정리되지 않은 잔해. cycle 195/206/207 dead cleanup 패턴.
