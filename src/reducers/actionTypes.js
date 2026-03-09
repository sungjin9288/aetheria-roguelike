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
    SET_ENEMY: 'SET_ENEMY',
    SET_EVENT: 'SET_EVENT',
    SET_GRAVE: 'SET_GRAVE',

    // UI
    SET_AI_THINKING: 'SET_AI_THINKING',
    SET_VISUAL_EFFECT: 'SET_VISUAL_EFFECT',
    SET_SIDE_TAB: 'SET_SIDE_TAB',
    SET_SHOP_ITEMS: 'SET_SHOP_ITEMS',
    RESET_RUNTIME_UI: 'RESET_RUNTIME_UI',

    // Logs
    ADD_LOG: 'ADD_LOG',
    UPDATE_LOG: 'UPDATE_LOG',
    CLEAR_LOGS: 'CLEAR_LOGS',

    // Feature Additions
    SET_QUICK_SLOT: 'SET_QUICK_SLOT',
    SET_POST_COMBAT_RESULT: 'SET_POST_COMBAT_RESULT',
    SET_ONBOARDING_DISMISSED: 'SET_ONBOARDING_DISMISSED',

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
});

/**
 * 게임 상태(gameState) 문자열 상수 — 오타 방지 및 중앙화 (#3)
 * 모든 게임 상태는 이 객체를 사용하세요.
 */
export const GS = Object.freeze({
    IDLE:       'idle',
    COMBAT:     'combat',
    EVENT:      'event',
    DEAD:       'dead',
    ASCENSION:  'ascension',
    MOVING:     'moving',
    SHOP:       'shop',
    JOB_CHANGE: 'job_change',
    QUEST_BOARD: 'quest_board',
    CRAFTING:   'crafting',
});
