export const APP_ID = 'aetheria-rpg';
// Admin UIDs — 환경변수에서 쉼표 구분으로 주입 (VITE_ADMIN_UIDS=uid1,uid2)
export const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

export const CONSTANTS = {
    // Note: GEMINI_API_KEY moved to server-side (api/ai-proxy.js)
    // Client no longer needs this key directly
    USE_AI_PROXY: import.meta.env.VITE_USE_AI_PROXY === 'true' || false,
    AI_PROXY_URL: import.meta.env.VITE_AI_PROXY_URL || '/api/ai-proxy',
    MAX_LEVEL: 99,
    START_HP: 150,
    START_MP: 50,
    START_GOLD: 200,
    SAVE_KEY: 'aetheria_save_v4_0',
    DATA_VERSION: 4.0,
    REMOTE_CONFIG_ENABLED: import.meta.env.VITE_REMOTE_CONFIG === 'true' || false,
    MONSTER_PREFIXES: [
        { name: '허약한', mod: 0.7, expMod: 0.7, dropMod: 0.8 },
        { name: '일반적인', mod: 1.0, expMod: 1.0, dropMod: 1.0 },
        { name: '날렵한', mod: 1.1, expMod: 1.1, dropMod: 1.2 },
        { name: '단단한', mod: 1.2, expMod: 1.2, dropMod: 1.2 },
        { name: '광폭한', mod: 1.3, expMod: 1.4, dropMod: 1.5 },
        { name: '거대', mod: 1.5, expMod: 1.6, dropMod: 2.0 },
        { name: '고대', mod: 1.8, expMod: 2.0, dropMod: 3.0, isElite: true },
        { name: '재앙의', mod: 2.5, expMod: 3.0, dropMod: 5.0, isElite: true },
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
    SPECIAL_EVENT_BASE_MULT: 0.25,
    SPECIAL_EVENT_MAX_CHANCE: 0.14,
    ONE_HAND_ATK_RATIO: 0.48,
    OFFHAND_WEAPON_RATIO: 0.42,
    TWO_HAND_ATK_BONUS: 1.35,
    DUAL_WIELD_ATK_BONUS: 1.08,
    DUAL_WIELD_DEF_MULT: 0.92,
    ONE_HAND_CRIT_BONUS: 0.06,
    OFFHAND_ONE_HAND_CRIT_BONUS: 0.04,
    DEBOUNCE_SAVE_MS: 500,
    LOG_MAX_SIZE: 50,
    ENEMY_TURN_DELAY_MS: 450,       // 적 반격 딜레이 (ms)
    MILESTONE_KILLS: [10, 50, 100], // 킬 마일스톤 기준
    INV_MAX_SIZE: 20,               // 인벤토리 최대 슬롯 수
    AUTO_EXPLORE_HP_THRESHOLD: 0.3, // 자동 탐색 HP 정지 임계값 (30%)
    AUTO_EXPLORE_INTERVAL_MS: 1400, // 자동 탐색 인터벌 (ms)
    STATUS_DOT_RATIO: 0.04,         // 상태이상 DoT 피해 비율 (maxHp 기준 4%)
    // v4.0 — 신규 시스템 상수
    EXP_SCALE_RATE: 1.2,            // EXP 곡선 완화 (기존 1.5 → 1.2)
    EXP_LEVEL_CAP_50: 800000,       // Lv50+ EXP 하한선
    RELIC_FIND_CHANCE: 0.08,        // 탐색 시 유물 발견 확률 (8%)
    PRESTIGE_ATK_BONUS: 5,          // 환생당 영구 ATK 증가
    PRESTIGE_HP_BONUS: 25,          // 환생당 영구 HP 증가
    PRESTIGE_MP_BONUS: 15,          // 환생당 영구 MP 증가
    BOSS_PHASE2_THRESHOLD: 0.5,     // 보스 HP 50% 이하 → 패턴 전환
    BOUNTY_EXP_MULT: 2.0,           // 현상수배 EXP = 킬수 × 레벨 × 2.0
    BOUNTY_GOLD_MULT: 2.5,          // 현상수배 골드 = 킬수 × 레벨 × 2.5
};

Object.freeze(CONSTANTS);
Object.freeze(BALANCE);
