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
    START_GOLD: 500,
    SAVE_KEY: 'aetheria_save_v3_4', // Versioning 3.4
    DATA_VERSION: 3.4,
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

Object.freeze(CONSTANTS);
