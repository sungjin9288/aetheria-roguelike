export const APP_ID = 'aetheria-rpg';
export const ADMIN_UIDS = ['YOUR_ADMIN_UID_HERE']; // Replace with actual developer UID

export const CONSTANTS = {
    // Note: GEMINI_API_KEY moved to server-side (api/ai-proxy.js)
    // Client no longer needs this key directly
    USE_AI_PROXY: import.meta.env.VITE_USE_AI_PROXY === 'true' || false,
    AI_PROXY_URL: import.meta.env.VITE_AI_PROXY_URL || '/api/ai-proxy',
    MAX_LEVEL: 99,
    START_HP: 150,
    START_MP: 50,
    START_GOLD: 200,
    SAVE_KEY: 'aetheria_save_v3_6',
    DATA_VERSION: 3.6,
    REMOTE_CONFIG_ENABLED: import.meta.env.VITE_REMOTE_CONFIG === 'true' || false,
    MONSTER_PREFIXES: [
        { name: '허약한', mod: 0.7, expMod: 0.7 },
        { name: '일반적인', mod: 1.0, expMod: 1.0 },
        { name: '날렵한', mod: 1.1, expMod: 1.1 },
        { name: '단단한', mod: 1.2, expMod: 1.2 },
        { name: '광폭한', mod: 1.3, expMod: 1.4 },
        { name: '거대', mod: 1.5, expMod: 1.6 },
        { name: '고대', mod: 1.8, expMod: 2.0 },
    ]
};

// Game Balance Constants - Centralized magic numbers
export const BALANCE = {
    REST_COST: 100,
    SKILL_MP_COST: 10,
    CRIT_CHANCE: 0.1,
    DROP_CHANCE: 0.4,
    ESCAPE_CHANCE: 0.5,
    DAILY_AI_LIMIT: 50,
    EVENT_CHANCE_NOTHING: 0.3,
    PREFIX_CHANCE: 0.2,
    ITEM_PREFIX_CHANCE: 0.12,
    DEBOUNCE_SAVE_MS: 500,
    LOG_MAX_SIZE: 50,
    ENEMY_TURN_DELAY_MS: 450,   // 적 반격 딜레이 (ms)
    MILESTONE_KILLS: [10, 50, 100], // 킬 마일스톤 기준
};

Object.freeze(CONSTANTS);
Object.freeze(BALANCE);
