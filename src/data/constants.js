export const APP_ID = 'aetheria-rpg';
const ENV = import.meta.env || {};
// Admin UIDs — 환경변수에서 쉼표 구분으로 주입 (VITE_ADMIN_UIDS=uid1,uid2)
export const ADMIN_UIDS = (ENV.VITE_ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

export const CONSTANTS = {
    DEFAULT_JOB: '모험가',
    START_LOCATION: '시작의 마을',
    ABYSS_MAP_NAME: '혼돈의 심연',

    // Note: GEMINI_API_KEY moved to server-side (api/ai-proxy.js)
    // Client no longer needs this key directly
    USE_AI_PROXY: ENV.VITE_USE_AI_PROXY === 'true' || false,
    AI_PROXY_URL: ENV.VITE_AI_PROXY_URL || '/api/ai-proxy',
    MAX_LEVEL: 99,
    START_HP: 150,
    START_MP: 50,
    START_GOLD: 200,
    SAVE_KEY: 'aetheria_save_v5_0',
    DATA_VERSION: 5.0,
    REMOTE_CONFIG_ENABLED: ENV.VITE_REMOTE_CONFIG === 'true' || false,
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
    REST_COST: 60,              // 경제 완화 — Lv50 기준 1-2전투로 휴식 가능 (기존 80)
    SKILL_MP_COST: 10,
    CRIT_CHANCE: 0.1,
    DROP_CHANCE: 0.4,
    ESCAPE_CHANCE: 0.5,
    DAILY_AI_LIMIT: 50,
    EVENT_CHANCE_NOTHING: 0.2,
    PREFIX_CHANCE: 0.2,
    ITEM_PREFIX_CHANCE: 0.12,
    SPECIAL_EVENT_BASE_MULT: 0.25,
    SPECIAL_EVENT_MAX_CHANCE: 0.14,
    SPECIAL_EVENT_PITY_PER_EXPLORE: 0.015,
    ONE_HAND_ATK_RATIO: 0.44,
    OFFHAND_WEAPON_RATIO: 0.34,
    TWO_HAND_ATK_BONUS: 1.55,
    DUAL_WIELD_ATK_BONUS: 1.05,
    DUAL_WIELD_DEF_MULT: 0.92,
    ONE_HAND_CRIT_BONUS: 0.08,
    OFFHAND_ONE_HAND_CRIT_BONUS: 0.05,
    DEBOUNCE_SAVE_MS: 500,
    LOG_MAX_SIZE: 50,
    ENEMY_TURN_DELAY_MS: 450,       // 적 반격 딜레이 (ms)
    MILESTONE_KILLS: [10, 50, 100], // 킬 마일스톤 기준
    INV_MAX_SIZE: 20,               // 인벤토리 최대 슬롯 수
    STATUS_DOT_RATIO: 0.04,         // 상태이상 DoT 피해 비율 (maxHp 기준 4%)
    MIN_NOTHING_CHANCE: 0.12,
    QUIET_STREAK_NOTHING_REDUCTION: 0.05,
    RELIC_PITY_PER_EXPLORE: 0.01,
    RELIC_FIND_MAX_CHANCE: 0.18,
    ANOMALY_BASE_CHANCE: 0.12,
    ANOMALY_PITY_PER_EXPLORE: 0.03,
    ANOMALY_MAX_CHANCE: 0.3,
    KEY_EVENT_PITY_PER_EXPLORE: 0.04,
    KEY_EVENT_MAX_CHANCE: 0.35,
    // v4.0 — 신규 시스템 상수
    EXP_SCALE_RATE: 1.15,           // EXP 곡선 — 완화 (Lv50 ~45전투, Lv60 ~80전투 목표)
    EXP_LEVEL_CAP_50: 150000,       // (deprecated — 하한선 역할 제거, 상한선 EXP_LEVEL_HARD_CAP 사용)
    EXP_LEVEL_HARD_CAP: 150000,     // 레벨당 최대 EXP 요구량 상한선 반감 (기존 300K → 150K)
    RELIC_FIND_CHANCE: 0.08,        // 탐색 시 유물 발견 확률 (8%)
    PRESTIGE_ATK_BONUS: 5,          // 환생당 영구 ATK 증가
    PRESTIGE_HP_BONUS: 25,          // 환생당 영구 HP 증가
    PRESTIGE_MP_BONUS: 15,          // 환생당 영구 MP 증가
    BOSS_PHASE2_THRESHOLD: 0.5,     // 보스 HP 50% 이하 → 패턴 전환
    BOUNTY_EXP_MULT: 2.0,           // 현상수배 EXP = 킬수 × 레벨 × 2.0
    BOUNTY_GOLD_MULT: 3.0,          // 현상수배 골드 = 킬수 × 레벨 × 3.0 (기존 2.5)

    // v4.1 — 등급 시스템
    RARITY_TIERS: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    RARITY_SELL_MULT: { common: 1, uncommon: 1.2, rare: 1.5, epic: 2, legendary: 3 },
    RARITY_COLORS: { common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' },

    // v4.1 — 합성 시스템
    SYNTHESIS_INPUT_COUNT: 3,
    SYNTHESIS_SUCCESS_RATES: { 1: 1.0, 2: 0.95, 3: 0.85, 4: 0.7, 5: 0.5 },
    SYNTHESIS_GOLD_COSTS: { 1: 150, 2: 600, 3: 2500, 4: 10000, 5: 40000 }, // 합성 비용 전반 완화
    SYNTHESIS_FAIL_RETURN: 1,
    SYNTHESIS_PROTECT_COST: 30,

    // v4.1 — 프리미엄 재화
    PREMIUM_CURRENCY_NAME: '에테르 크리스탈',
    INV_EXPAND_COST: 50,
    INV_EXPAND_AMOUNT: 5,
    COSMETIC_TITLE_COST: 100,
    REVIVE_COST: 20,

    // v4.3 — 아이템 강화 시스템
    ENHANCE_MAX: 10,
    ENHANCE_STAT_BONUS: 0.1,   // 강화 레벨당 스탯 10% 보너스
    ENHANCE_COSTS: [0, 150, 400, 800, 1800, 3500, 7000, 13000, 25000, 50000], // 강화 비용 완화
    ENHANCE_RATES: [1.0, 0.95, 0.90, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25],

    // 레벨업 성장치
    HP_PER_LEVEL: 20,               // 레벨당 기본 HP 증가
    MP_PER_LEVEL: 10,               // 레벨당 기본 MP 증가
    ATK_PER_LEVEL: 2,               // 레벨당 기본 ATK 증가
    DEF_PER_LEVEL: 1,               // 레벨당 기본 DEF 증가

    // 레벨 마일스톤 보상
    LEVEL_MILESTONE_EVERY: 5,       // N레벨마다 골드 보너스
    LEVEL_MAJOR_MILESTONE_EVERY: 10, // N레벨마다 스탯 보너스
    MILESTONE_GOLD_PER_LV: 60,      // 마일스톤 골드 = level × 60
    MILESTONE_STAT_HP: 25,          // 메이저 마일스톤 HP 보너스
    MILESTONE_STAT_MP: 12,          // 메이저 마일스톤 MP 보너스
    MILESTONE_STAT_ATK: 4,          // 메이저 마일스톤 ATK 보너스

    // 아이템 티어별 장착 최소 레벨
    TIER_REQ_LEVEL: { 1: 1, 2: 10, 3: 28, 4: 45, 5: 60, 6: 75 },

    // 루팅 보너스 드랍
    LOOT_BONUS_MIN_LEVEL: 30,       // 보너스 장비 드랍 최소 추정 레벨
    LOOT_BOSS_BONUS_CHANCE: 0.25,   // 보스 보너스 장비 드랍 확률
    LOOT_NORMAL_BONUS_CHANCE: 0.06, // 일반 보너스 장비 드랍 확률
    LOOT_BASE_EXP: 10,             // 레벨 추정 기본 EXP
    LOOT_EXP_LEVEL_DIVISOR: 5,     // 레벨 추정 EXP 나눗수

    // 난이도 매니저
    DIFFICULTY_BATTLE_WINDOW: 20,   // 최근 N 전투 분석

    // 현상수배 카운트
    BOUNTY_MIN_COUNT: 5,            // 현상수배 최소 처치 수
    BOUNTY_COUNT_RANGE: 6,          // 현상수배 처치 수 범위 (min + 0~range-1)

    // 전투 계산 — 속성 배율
    ELEMENT_WEAK_MULT: 1.25,        // 속성 약점 피해 배율
    ELEMENT_RESIST_MULT: 0.75,      // 속성 저항 피해 배율
    // 전투 계산 — 기본 공식
    GUARD_DAMAGE_MULT: 0.65,        // 가드 중 받는 피해 배율
    DAMAGE_BASE_RATIO: 0.9,         // 데미지 최솟값 비율 (분산 하한)
    DAMAGE_VARIANCE: 0.2,           // 데미지 분산 폭
    // 상태이상 ATK 패널티 배율
    BLIND_ATK_MULT: 0.65,
    FEAR_ATK_MULT: 0.70,
    CURSE_ATK_MULT: 0.75,
    // 저주 DoT 비율 (maxHp 기준)
    CURSE_DOT_RATIO: 0.03,
    // 플레이어 기본 최대 HP (maxHp 미설정 시 fallback)
    DEFAULT_MAX_HP: 150,

    // v4.3 — 주간 미션
    WEEKLY_MISSIONS: [
        { id: 'weeklyKills', target: 50, reward: { gold: 10000, premiumCurrency: 5 }, label: '주간: 몬스터 50마리 처치' },
        { id: 'weeklyExplore', target: 20, reward: { gold: 8000, premiumCurrency: 5 }, label: '주간: 20회 탐험' },
        { id: 'weeklyBoss', target: 3, reward: { gold: 15000, premiumCurrency: 10 }, label: '주간: 보스 3마리 처치' },
    ],

    // v4.3 — 챌린지 런
    CHALLENGE_MODIFIERS: [
        { id: 'halfHp', label: '반피 런', desc: '최대 HP 50% 감소' },
        { id: 'noGold', label: '무일푼', desc: '시작 골드 0, 골드 획득 50% 감소' },
        { id: 'randomSkills', label: '혼돈의 기술', desc: '스킬 사용 시 무작위 스킬 발동' },
        { id: 'eliteOnly', label: '엘리트 런', desc: '모든 적이 Elite 판정' },
        { id: 'noPotion', label: '금욕', desc: '아이템 사용 불가' },
        { id: 'blindMap', label: '미지의 땅', desc: '위치 정보 숨김' },
    ],

    // v4.3 — 묘비 침략
    DAILY_INVADE_LIMIT: 5,

    // 발견 체인 (Discovery Chains)
    DISCOVERY_CHAINS: [
        {
            id: 'fire_convergence',
            label: '화염의 수렴',
            locations: ['화염의 협곡', '화염의 사원', '용의 둥지'],
            reward: { gold: 3000, exp: 2000, item: '용의 숨결' },
            desc: '세 곳의 화염 지역을 탐험하니 고대 용의 기운이 하나로 수렴합니다.',
        },
        {
            id: 'frozen_truth',
            label: '동결된 진실',
            locations: ['북부 설원', '얼음 성채', '빙하 심연'],
            reward: { gold: 3000, exp: 2000, item: '영원의 빙결정' },
            desc: '얼어붙은 세계의 끝에서 잊혀진 진실을 찾아냅니다.',
        },
        {
            id: 'void_resonance',
            label: '공허의 공명',
            locations: ['에테르 관문', '혼돈의 심연', '차원의 틈새'],
            reward: { gold: 5000, exp: 3000, premiumCurrency: 10 },
            desc: '차원의 경계가 공명하며 에테르의 비밀이 드러납니다.',
        },
        {
            id: 'ancient_pilgrimage',
            label: '고대 순례길',
            locations: ['잊혀진 폐허', '피라미드', '고대 보물고', '금지된 도서관'],
            reward: { gold: 8000, exp: 5000, premiumCurrency: 15 },
            desc: '고대 문명의 네 거점을 순례하여 잃어버린 지식을 모았습니다.',
        },
        {
            id: 'demon_trail',
            label: '마왕의 흔적',
            locations: ['암흑 성', '마왕성', '혼돈의 심연'],
            reward: { gold: 6000, exp: 4000, item: '마왕의 인장' },
            desc: '마왕의 세력 근거지를 모두 밟아, 그의 흔적을 추적합니다.',
        },
    ],

    // 스킬 교체 비용
    SKILL_SWAP_COST: 50,

    // 챌린지 보상 스케일링
    CHALLENGE_REWARD_SCALING: { threshold: 3, mult: 1.5 },

    // v5.0 — 진 엔딩
    PRIMAL_SHARD_DROP_CHANCE: 0.5,  // 마왕 처치 시 파편 드랍 확률 (기존 0.4 → 진 엔딩 접근성 개선)
    PRIMAL_SHARD_REQUIRED: 3,       // 진 보스 해금에 필요한 파편 수

    // v4.3 — 무한 심연 강화
    ABYSS_MILESTONE_REWARDS: {
        10:  { type: 'relic_choice' },
        25:  { type: 'relic_choice' },
        50:  { type: 'legendary_item' },
        75:  { type: 'prestige_points', amount: 1 },
        100: { type: 'legendary_item' },
        150: { type: 'relic_choice' },
        200: { type: 'prestige_points', amount: 2 },
        300: { type: 'legendary_item' },
        500: { type: 'prestige_points', amount: 3 },
    },
    ABYSS_BOSS_FLOORS: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    ABYSS_BOSS_NAMES: {
        10: '혼돈의 수호자',
        20: '심연의 파수꾼',
        30: '차원 분열자',
        40: '엔트로피 군주',
        50: '무한의 화신',
        60: '허무의 전령',
        70: '멸절의 사도',
        80: '공허의 심판자',
        90: '허무의 황제',
        100: '공허의 신',
    },

    // 연속 처치 (Kill Streak) 시스템
    KILL_STREAK_DECAY_MS: 30000,        // 30초 비전투 시 스트릭 초기화
    KILL_STREAK_TIERS: [3, 5, 10, 20], // 보너스 발동 임계 연속 처치 수
    KILL_STREAK_ATK_BONUS: [0.05, 0.10, 0.18, 0.30], // 각 티어 ATK 배율 보너스
    KILL_STREAK_CRIT_BONUS: [0.03, 0.06, 0.10, 0.15], // 각 티어 CRIT 보너스
};

Object.freeze(CONSTANTS);
Object.freeze(BALANCE);
