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

    // Logs
    ADD_LOG: 'ADD_LOG',
    UPDATE_LOG: 'UPDATE_LOG',

    // Feature Additions
    SET_QUICK_SLOT: 'SET_QUICK_SLOT',
    SET_POST_COMBAT_RESULT: 'SET_POST_COMBAT_RESULT',
    SET_ONBOARDING_DISMISSED: 'SET_ONBOARDING_DISMISSED',
});
