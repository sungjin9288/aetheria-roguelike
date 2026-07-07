export const APP_ID = 'aetheria-rpg';
// Vite env (test 환경에선 import.meta.env 부재 가능 — plain Node/tsx 실행 시 process.env로 폴백.
// Vite/브라우저에선 import.meta.env가 항상 존재하므로 이 폴백은 실제 빌드 동작에 영향 없음).
const ENV: ImportMetaEnv = (typeof import.meta !== 'undefined' && import.meta.env)
    || (typeof process !== 'undefined' && process.env as any)
    || ({} as ImportMetaEnv);
// Admin UIDs — 환경변수에서 쉼표 구분으로 주입 (VITE_ADMIN_UIDS=uid1,uid2)
export const ADMIN_UIDS = (ENV.VITE_ADMIN_UIDS || '').split(',').map((s: string) => s.trim()).filter(Boolean);

/**
 * 게임 전역 상수. 1차 타입화 — 핵심 키는 명시 타입, 나머지는 인덱스 시그니처로
 * 점진 타입화(기존 접근 호환). 신규 키 추가 시 가능하면 명시 타입을 부여할 것.
 */
export interface GameConstants {
    [key: string]: any;
    DEFAULT_JOB: string;
    START_LOCATION: string;
    MAX_LEVEL: number;
    START_HP: number;
    START_MP: number;
    START_GOLD: number;
    START_NEXT_EXP: number;
    DATA_VERSION: number;
}

export const CONSTANTS: GameConstants = {
    DEFAULT_JOB: '모험가',
    START_LOCATION: '시작의 마을',
    ABYSS_MAP_NAME: '혼돈의 심연',
    ENHANCE_MATERIAL_NAME: '강화 재료',

    // Note: GEMINI_API_KEY moved to server-side (api/ai-proxy.js)
    // Client no longer needs this key directly
    USE_AI_PROXY: ENV.VITE_USE_AI_PROXY === 'true' || false,
    AI_PROXY_URL: ENV.VITE_AI_PROXY_URL || '/api/ai-proxy',
    MAX_LEVEL: 99,
    START_HP: 150,
    START_MP: 50,
    START_GOLD: 200,
    // slice 23: 150 → 200 — 초반 레벨 간격 감속 (학습 구간 확보). 전투 템포
    //   (slice 19)는 빠르게 유지하되 레벨당 전투 수를 늘린다. Lv1→5 누적
    //   요구 745 → 998 (+34%).
    START_NEXT_EXP: 200,
    // cycle 195: SAVE_KEY 제거 — Firebase Firestore 사용으로 localStorage save key 미사용 (dead).
    DATA_VERSION: 5.0,
    // cycle 309: REMOTE_CONFIG_ENABLED 제거 — RemoteConfigLoader.ts (dead module) 외
    //   read 0건. RemoteConfigLoader 자체가 import 0건이라 cascade dead.
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
/**
 * 밸런스 상수. 1차 타입화 — 자주 참조되는 스칼라 키는 명시 타입, 나머지(배열/객체/
 * 레코드 등 이질 구조)는 인덱스 시그니처로 호환 유지. 새 밸런스 수치는 가능한 한
 * 명시 타입을 추가해 오타·단위 실수를 컴파일 타임에 차단할 것.
 */
export interface BalanceConfig {
    [key: string]: any;
    REST_COST: number;
    SKILL_MP_COST: number;
    CRIT_CHANCE: number;
    DROP_CHANCE: number;
    ESCAPE_CHANCE: number;
    EVENT_CHANCE_NOTHING: number;
    MAP_HIGH_EVENT_CHANCE_THRESHOLD: number;
    SIGNATURE_SET_MIN_ITEMS: number;
    EXP_SCALE_RATE: number;
    EXP_LEVEL_HARD_CAP: number;
    HP_PER_LEVEL: number;
    MP_PER_LEVEL: number;
    ATK_PER_LEVEL: number;
    DEF_PER_LEVEL: number;
    MONSTER_HP_BASE: number;
    MONSTER_HP_PER_LEVEL: number;
    MONSTER_DEF_BASE: number;
    MONSTER_DEF_PER_LEVEL: number;
    MONSTER_DEF_PER_DEPTH: number;
    MONSTER_GOLD_BASE: number;
    FIRST_RELIC_PITY_EXPLORES: number;
    BOSS_PHASE2_THRESHOLD: number;
    INV_MAX_SIZE: number;
    STATUS_DOT_RATIO: number;
    DAMAGE_BASE_RATIO: number;
    DAMAGE_VARIANCE: number;
    ENEMY_DEF_K: number;
    GUARD_DAMAGE_MULT: number;
    ELEMENT_WEAK_MULT: number;
    ELEMENT_RESIST_MULT: number;
    DEFAULT_MAX_HP: number;
    RETURN_BRIEFING_HOURS: number;
    ABYSS_DAILY_DIVE_MULT: number;
    ABYSS_DAILY_DIVE_COMBAT_COUNT: number;
}

export const BALANCE: BalanceConfig = {
    REST_COST: 60,              // 경제 완화 — Lv50 기준 1-2전투로 휴식 가능 (기존 80)
    SKILL_MP_COST: 10,
    CRIT_CHANCE: 0.1,
    DROP_CHANCE: 0.4,
    ESCAPE_CHANCE: 0.5,
    DAILY_AI_LIMIT: 50,
    EVENT_CHANCE_NOTHING: 0.2,
    MAP_HIGH_EVENT_CHANCE_THRESHOLD: 0.28,  // MapNavigator '이벤트↑' 배지 임계값 — 상위 지역군(eventChance 0.28+) 강조
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
    // 장비 비교 점수식(getEquipmentScore) 가중치 — ShopPanel/SmartInventory 공용 (2026-07 감사 중복 제거).
    EQUIP_SCORE_CRIT_WEIGHT: 2,
    EQUIP_SCORE_MP_DIVISOR: 5,
    DEBOUNCE_SAVE_MS: 500,
    LOG_MAX_SIZE: 50,
    ENEMY_TURN_DELAY_MS: 450,       // 적 반격 딜레이 (ms)
    // cycle 195: MILESTONE_KILLS 제거 — checkMilestones에서 10/50/100을 inline 하드코딩하고 있어 dead config.
    //   향후 milestone 변경 시 checkMilestones 함수를 직접 수정하거나 이 상수 재도입 필요.
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
    // cycle 195: EXP_LEVEL_CAP_50 제거 — deprecated 상태로 cycle 99에서 EXP_LEVEL_HARD_CAP으로 이행 완료.
    EXP_LEVEL_HARD_CAP: 150000,     // 레벨당 최대 EXP 요구량 상한선 반감 (기존 300K → 150K)
    RELIC_FIND_CHANCE: 0.08,        // 탐색 시 유물 발견 확률 (8%)
    // 2026-07 감사: 시너지 소프트 pity — 보유 유물 기준 "1개만 더 모으면 완성"되는
    //   시너지 잔여 유물이 pool에 있으면, 유물 3(4)지선다 중 이 슬롯 수만큼은 그
    //   잔여 유물 후보군에서 가중 추첨으로 보장한다 (pickWeightedRelics owned 옵션).
    SYNERGY_PITY_SLOT: 1,
    // fix/signature-set-two-hand: 시그니처 세트 발동에 필요한 최소 "서로 다른 세트
    //   아이템" 수. 2H 가중치(카운트 2)는 티어 도달 공정성용이고, 발동 자체는 모아야
    //   한다 — 세트의 메리트는 수집에서 나온다는 설계 원칙 (2H 단독 발동 차단).
    SIGNATURE_SET_MIN_ITEMS: 2,
    PRESTIGE_ATK_BONUS: 5,          // 환생당 영구 ATK 증가
    PRESTIGE_HP_BONUS: 25,          // 환생당 영구 HP 증가
    PRESTIGE_MP_BONUS: 15,          // 환생당 영구 MP 증가
    // PR #5 (2026-06) — 프레스티지 적 난이도 스케일링. 기존 프레스티지는 플레이어
    //   스탯만 올려(런이 점점 쉬워짐) 로그라이크 "깊을수록 어려움" 원칙에 역행했다.
    //   환생 rank당 적 hp/atk/def를 곱연산으로 올려 매 승천이 더 단단해지게 한다.
    //   rank0은 변화 없음(신규 플레이어/기본 곡선 불변). PER_RANK 0.05: rank5 +25%,
    //   rank10 +50%. 플레이어 flat 보너스(+5 atk/+25 hp)와 rank10 "스탯 2배" 해금이
    //   부분 상쇄 → net firmer하되 공정. (prestige-enemy-scaling.test.js로 가드)
    PRESTIGE_ENEMY_STAT_PER_RANK: 0.05,   // 환생 rank당 적 hp/atk/def 증가율
    PRESTIGE_ENEMY_REWARD_PER_RANK: 0.08, // 환생 rank당 적 exp/gold 증가율 (난도 보상)
    // PR #8 (2026-06) — 프레스티지 해금 효과(PRESTIGE_UNLOCKS). AscensionScreen이
    //   광고하던 rank별 해금이 대부분 dead display text였던 것을 실제 구현.
    //   getPrestigeUnlocks(rank)가 단일 진실 원천(systems/prestigeUnlocks.ts).
    PRESTIGE_ESSENCE_BONUS: 0.10,    // rank≥1: 에센스 획득 +10%
    RELIC_CHOICE_BASE: 3,            // 유물 선택지 기본 3 (rank≥2면 +1 → 4지선다)
    PRESTIGE_RELIC_SLOT_BONUS: 1,    // rank≥2: 유물 최대 보유 +1 (5→6)
    PRESTIGE_ELITE_BONUS: 0.25,      // rank≥3: 엘리트 몬스터 출현 확률 +25%
    PRESTIGE_R10_STAT_MULT: 2,       // rank≥10: 영구 스탯 보너스 ×2 (에테르 초월)
    // feat/prestige-rank-ladder — rank4~9 해금 사다리. PR #8/#10/#11과 동일하게
    //   getPrestigeUnlocks(rank)가 단일 진실 원천. 비퇴행·순수 보너스만 추가.
    PRESTIGE_R4_CAMPFIRE_BONUS: 0.04,     // rank≥4: 캠프파이어 발견율 +4%p
    START_BOOT_RELIC_CHOICES_BONUS: 1,    // rank≥5: 시작 부트 유물 선택지 +1 (3→4)
    PRESTIGE_R6_RELIC_PITY_MULT: 1.5,     // rank≥6: 유물 발견 pity 누적 가속 ×1.5
    CHALLENGE_MODIFIER_SLOTS: 3,          // 챌린지 모디파이어 동시 선택 기본 상한
    PRESTIGE_R7_CHALLENGE_SLOT_BONUS: 1,  // rank≥7: 챌린지 모디파이어 슬롯 +1 (3→4)
    PRESTIGE_R8_ESSENCE_BONUS: 0.10,      // rank≥8: 에센스 획득 추가 +10%p (rank1과 누적 +20%)
    PRESTIGE_R9_ELITE_REWARD_MULT: 1.25,  // rank≥9: 정예 처치 EXP/골드 보상 ×1.25

    // 2026-07 감사 — 장르 갭 (a): 에테르 거울 (에센스 소비 영구 업그레이드 트리).
    //   노드 정의/비용은 data/mirror.ts(MIRROR_NODES), 효과 계산은
    //   systems/mirrorUpgrades.ts(getMirrorEffects)가 단일 진실 원천.
    //   여기 상수는 "레벨당 효과 크기"만 — 노드 존재/비용/최대레벨은 MIRROR_NODES 참조.
    MIRROR_START_GOLD_PER_LEVEL: 100,        // start_gold: 레벨당 시작 골드 +100
    MIRROR_CAMPFIRE_BONUS_PER_LEVEL: 0.02,   // campfire_rate: 레벨당 캠프파이어 확률 +2%p
    MIRROR_RELIC_PITY_BONUS_PER_LEVEL: 0.25, // relic_pity: 레벨당 유물 pity 누적 +25%
    MIRROR_REST_DISCOUNT_PER_LEVEL: 0.20,    // rest_discount: 레벨당 휴식 비용 -20%
    MIRROR_ESSENCE_FLOW_BONUS_PER_LEVEL: 0.10, // essence_flow: 레벨당 에센스 획득 +10%
    MIRROR_REVIVE_HP_RATIO: 0.30,            // revive: 부활 시 HP 30%로 복구
    BOSS_PHASE2_THRESHOLD: 0.5,     // 보스 HP 50% 이하 → 패턴 전환
    BOUNTY_EXP_MULT: 2.0,           // 현상수배 EXP = 킬수 × 레벨 × 2.0
    BOUNTY_GOLD_MULT: 3.0,          // 현상수배 골드 = 킬수 × 레벨 × 3.0 (기존 2.5)

    // v4.1 — 등급 시스템
    // cycle 195: RARITY_TIERS / RARITY_SELL_MULT 제거 — UI 컴포넌트는 RARITY_CLASSES 사용,
    //   판매 multiplier는 ShopPanel 등이 별도 처리. 두 키 모두 dead config.
    // Hex 컬러 (인라인 스타일/아이콘/프레임용). Tailwind 클래스 버전은 RARITY_CLASSES 사용.
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
    // cycle 195: COSMETIC_TITLE_COST 제거 — cycle 185 이후 PREMIUM_SHOP.cosmeticTitles 각 항목에
    //   개별 cost 정의 (100/100/150/200). 통합 상수 dead.
    REVIVE_COST: 20,

    // v4.3 — 아이템 강화 시스템
    ENHANCE_MAX: 10,
    ENHANCE_STAT_BONUS: 0.1,   // 강화 레벨당 스탯 10% 보너스
    ENHANCE_COSTS: [150, 400, 800, 1800, 3500, 7000, 13000, 25000, 50000, 90000], // +0 -> +1부터 비용 필요
    ENHANCE_RATES: [1.0, 0.95, 0.90, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25],
    ENHANCE_MATERIAL_COSTS: [1, 1, 1, 2, 2, 3, 3, 4, 4, 5],

    // 레벨업 성장치
    HP_PER_LEVEL: 20,               // 레벨당 기본 HP 증가
    MP_PER_LEVEL: 10,               // 레벨당 기본 MP 증가
    ATK_PER_LEVEL: 3,               // 레벨당 기본 ATK 증가 (slice 19: 2 → 3, 레벨업 턴수 단축 체감)
    DEF_PER_LEVEL: 1,               // 레벨당 기본 DEF 증가

    // slice 19 — 몬스터 스폰 곡선 (기존 spawnEnemy inline 120+30L / 10+2L)
    // HP 곡선 70+32L: Lv1 -32%, Lv20 -1%, Lv50 +3% — 초반 전투 템포만 선택적 가속
    MONSTER_HP_BASE: 70,
    MONSTER_HP_PER_LEVEL: 32,
    // PR #3 (2026-06) — 적 DEF 곡선. spawnEnemy가 이전엔 def를 아예 안 만들어
    //   enemy.def는 항상 undefined였고 calculateDamage도 무시 → 적 방어력 완전 dead.
    //   def = BASE + level×PER_LEVEL (+ depth×PER_DEPTH). 비율 경감 K=100과 결합 시
    //   초반(Lv≤6 def≈4~9)은 ~4~8% 경감(무시 가능), 중후반(Lv30 def≈33 / Lv50 def≈53)은
    //   33~35% 경감으로 firmer. mid-game-ttk-bands 밴드(2~9턴) 내 검증 완료.
    MONSTER_DEF_BASE: 3,
    MONSTER_DEF_PER_LEVEL: 1,
    MONSTER_DEF_PER_DEPTH: 1,       // 무한 심연 depth당 추가 def (level 외 추가 압박)
    MONSTER_GOLD_BASE: 16,          // 초반 휴식 경제: Lv1 골드 18 → 3-4전투당 휴식 1회

    // slice 19 — 첫 유물 보장: 유물 0개 상태로 N탐험 경과 시 다음 전투형 탐험에서 유물 선택 보장
    FIRST_RELIC_PITY_EXPLORES: 6,

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
    // 신입 보호 (B+ 재설계 2026-06): 적을 "약화"시키지 않는다 — Lv1·첫 N전투에서
    //   불운한 즉사만 방지하는 초미세 상한 보정. EXP/골드 강제 보너스 제거(중립).
    //   기존(적 약화 HP×0.88/ATK×0.82)은 초반을 너무 쉽게 만들던 주원인 → 제거.
    BEGINNER_GRACE_MAX_LEVEL: 1,    // 이 레벨 이하에서만 적용 (기존 3)
    BEGINNER_GRACE_BATTLES: 2,      // 첫 N전투까지만 적용 (기존 5)
    BEGINNER_GRACE_ENEMY_MULT: 0.95, // 적 HP/ATK 상한 (기존 0.88/0.82 → 거의 정상)

    // 첫 죽음 메타 보상 (C-1, B+ 2026-06): 첫 사망 시 영구 메타 보너스 1회 지급 →
    //   "죽어도 남는다"를 1회차에 학습시켜 가혹한 완전 리셋 페널티를 공정하게 완충.
    //   메타는 RUN을 넘어 보존되어 다음 런 starter 스탯이 강해진다.
    FIRST_DEATH_BONUS_ATK: 2,       // 첫 죽음 영구 ATK
    FIRST_DEATH_BONUS_HP: 20,       // 첫 죽음 영구 최대 HP

    // 시작 부트 (B-1, B+ 2026-06): 캐릭터 생성 직후 유물 N선택 제공 → 첫 빌드 결정을
    //   0분에 노출(Hades 거울 / StS Neow). 느린 초반을 "내 빌드 실험"으로 전환.
    START_BOOT_RELIC_CHOICES: 3,

    // 초반 정예 (A-4, B+ 2026-06): Lv ≤ cap에서 낮은 확률로 "정예" 개체 스폰 →
    //   "방심하면 죽는" 첫 위협 모먼트. 완전 엘리트(1.8~2.5x)는 Lv1에 불공정하므로
    //   전용 완화 배율로 TTK를 빠듯하게(영리하면 승리 가능). 도망·첫 죽음 메타가 안전망.
    EARLY_ELITE_LEVEL_CAP: 6,       // 이 맵 레벨 이하에서만 초반 정예 스폰
    EARLY_ELITE_CHANCE: 0.10,       // 초반 전투당 정예 스폰 확률
    EARLY_ELITE_MULT: 1.5,          // 정예 HP/ATK 배율 (완전 엘리트보다 완화)

    // 캠프파이어 노드 (Phase 2, B+ 2026-06): 던전 탐험 중 "휴식 vs 단련" 반복 결정
    //   (Slay the Spire 캠프파이어). 위협(A-1/A-4)이 강해진 만큼 회복은 실질 선택이 됨.
    //   휴식=즉시 생존, 단련=다음 전투 공격 버프(다가올 위험에 베팅). 결정 밀도 ↑.
    CAMPFIRE_CHANCE: 0.08,          // 던전 탐험당 모닥불 조우 확률
    CAMPFIRE_HEAL_RATIO: 0.4,       // 휴식 선택 시 maxHP/maxMP 회복 비율
    CAMPFIRE_FORGE_ATK: 0.4,        // 단련 선택 시 다음 전투 ATK 버프 비율 (+40%)
    CAMPFIRE_FORGE_TURNS: 5,        // 단련 버프 지속 턴 (다음 전투를 대체로 커버)

    // 탐험 스카우팅 (2026-07 감사 (b)): 던전 탐험 시 사전 정찰 선택 카드 2~3장을 제시해
    //   "정보 없는 단일 버튼 탐험"에 사전 결정 지점을 추가한다 (StS 노드맵/FTL 비콘 이식).
    //   체인 > 캠프파이어 > 스카우팅 > 나머지 롤 순으로 우선순위. 매번 뜨면 모바일 루프
    //   마찰이 크므로(스카우팅 1회 = 탭 +1) 확률형. 0.25 = 탐험 4회당 ~1회 —
    //   캠프파이어(8%)·체인과 합쳐 "탐험 ~3회당 결정 1회"가 되는 결정 밀도 목표치.
    //   (초기 구현 0.06은 기능이 사실상 안 보이는 수준이라 상향. 플레이테스트 후 재조정 대상.)
    SCOUT_CHANCE: 0.25,                 // 던전 탐험당 스카우팅 조우 확률
    SCOUT_ELITE_CARD_CHANCE: 0.15,      // 3번째 슬롯이 "정예의 흔적" 카드로 대체될 확률
    SCOUT_COMBAT_REWARD_BONUS: 0.1,     // "전투의 기척" 선택 시 해당 전투 처치 보상(EXP/골드) +10%
    SCOUT_ELITE_HP_MULT: 1.5,           // "정예의 흔적" 확정 스폰 HP/ATK 배율 (초반 정예와 동일 완화 배율)

    // 원정 보스 접근 게이지 (2026-07 감사 축4 — 모바일 세션 정합): 구역 보스의 기존 15%
    //   순수 랜덤 강제 조우(exploreUtils.spawnEnemy)를 제거하고, 미격파 구역 보스가 있는
    //   던전에서 탐험할 때마다 누적되는 게이지로 대체한다. 만충 시 다음 탐험에서
    //   "도전 vs 회피" 선택 카드(StS 위험 선택)를 제시 — 15% 기댓값(~6.7탐험당 1회)과
    //   유사한 리듬을 유지하도록 1/0.14 ≈ 7.1탐험에 만충.
    BOSS_GAUGE_PER_EXPLORE: 0.14,   // 미격파 구역 보스 던전 탐험당 게이지 누적량 (약 7~8탐험에 만충)

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
    ENEMY_DEF_K: 100,               // 적 DEF 비율 경감 분모: mitigated = dmg × K/(K+def).
                                    //   def=K면 정확히 절반. flat 차감과 달리 스케일 붕괴 없음.
    // 상태이상 ATK 패널티 배율
    BLIND_ATK_MULT: 0.65,
    FEAR_ATK_MULT: 0.70,
    CURSE_ATK_MULT: 0.75,
    // 저주 DoT 비율 (maxHp 기준)
    CURSE_DOT_RATIO: 0.03,
    // cycle 108: 플레이어가 curse 상태일 때 받는 피해 배율. 적 cursedTurns가
    // CURSE_ATK_MULT(0.75)로 적의 ATK를 줄이는 것과 짝을 이루는 player-side 페널티.
    // MSG.SKILL_CURSE_AMPLIFY("저주가 강화되어 피해가 증폭됩니다") 의도 구현.
    CURSE_PLAYER_DMG_TAKEN_MULT: 1.30,
    // cycle 109: 플레이어가 blind 상태일 때 공격이 빗나갈 확률. 적의 BLIND_ATK_MULT(0.65)
    // 처럼 적 ATK를 줄이는 것과 짝을 이루는 player-side 페널티. 다중 턴 효과 — 저주해제
    // 주문서 / purify 스킬 / 휴식으로 해제될 때까지 매 행동마다 roll.
    BLIND_PLAYER_MISS_CHANCE: 0.30,
    // cycle 110: 플레이어가 fear 상태일 때 flinch(턴 무위) 확률. 적의 FEAR_ATK_MULT
    // (0.70)와 짝을 이루는 player-side 페널티. blind miss(0.30)보다 약간 낮게 — 두 개가
    // 동시에 부여되는 상황에서 over-disable 방지. 다중 턴 효과.
    FEAR_PLAYER_FLINCH_CHANCE: 0.25,
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
            // cycle 177: '용의 숨결' items.ts 미등록 → '용의 화염' (tier 5 화염 무기).
            reward: { gold: 3000, exp: 2000, item: '용의 화염' },
            desc: '세 곳의 화염 지역을 탐험하니 고대 용의 기운이 하나로 수렴합니다.',
        },
        {
            id: 'frozen_truth',
            label: '동결된 진실',
            locations: ['북부 설원', '얼음 성채', '빙하 심연'],
            // cycle 177: '영원의 빙결정' items.ts 미등록 → '빙결의 왕관검' (tier 5 냉기 무기).
            reward: { gold: 3000, exp: 2000, item: '빙결의 왕관검' },
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
            // cycle 177: '마왕의 인장' items.ts 미등록 → '마왕의 대낫' (tier 5 어둠 무기 — 보스 흔적).
            reward: { gold: 6000, exp: 4000, item: '마왕의 대낫' },
            desc: '마왕의 세력 근거지를 모두 밟아, 그의 흔적을 추적합니다.',
        },
    ],

    // 스킬 교체 비용
    SKILL_SWAP_COST: 50,

    // 챌린지 보상 스케일링 — rank≥7 해금 시 4번째 슬롯이 열리므로 풀 스택(4개) 상위 티어 필요
    CHALLENGE_REWARD_SCALING: { threshold: 3, mult: 1.5, fullThreshold: 4, fullMult: 2.0 },

    // v5.0 — 진 엔딩
    PRIMAL_SHARD_DROP_CHANCE: 0.5,  // 마왕 처치 시 파편 드랍 확률 (기존 0.4 → 진 엔딩 접근성 개선)
    PRIMAL_SHARD_REQUIRED: 3,       // 진 보스 해금에 필요한 파편 수

    // v4.3 — 무한 심연 강화
    ABYSS_MILESTONE_REWARDS: {
        // cycle 194: 'prestige_points' reward type을 사용 가능한 보상으로 교체.
        //   기존엔 player.prestigePoints 카운터가 어디에서도 소비/표시되지 않는 dead currency였음
        //   (combatBossHandlers에서 +1만 하고 끝). UI/ASCEND/spend 시스템 미구현 상태에서 player가
        //   abyss 75/200/500층 도달해도 visible 보상 0건이던 회귀.
        //   대안: 75/500은 relic_choice (선택지 다양화), 200은 legendary_item (기존 패턴 일관).
        10:  { type: 'relic_choice' },
        25:  { type: 'relic_choice' },
        50:  { type: 'legendary_item' },
        75:  { type: 'relic_choice' },     // was prestige_points 1
        100: { type: 'legendary_item' },
        150: { type: 'relic_choice' },
        200: { type: 'legendary_item' },   // was prestige_points 2
        300: { type: 'legendary_item' },
        500: { type: 'relic_choice' },     // was prestige_points 3 — 최종 마일스톤도 의미 있는 보상
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

    // 인벤토리 UX 임계값
    INV_FULL_THRESHOLD: 18,             // 인벤토리 과밀 경고 임계 (최대의 ~90%)

    // 리텐션 훅 — 복귀 브리핑 카드
    RETURN_BRIEFING_HOURS: 6,           // 마지막 플레이로부터 이 시간(h) 이상 경과 시 복귀 브리핑 표시

    // 리텐션 훅 — 심연 데일리 다이브
    ABYSS_DAILY_DIVE_MULT: 1.5,         // 혼돈의 심연 일일 첫 다이브 EXP/골드 배율
    ABYSS_DAILY_DIVE_COMBAT_COUNT: 5,   // 배율이 적용되는 하루 첫 전투 수 (1회는 체감 없음 — 리뷰 후속)
};

Object.freeze(CONSTANTS);
Object.freeze(BALANCE);

/**
 * 희귀도 등급 → Tailwind 텍스트 색상 클래스
 * BALANCE.RARITY_COLORS는 hex 값, RARITY_CLASSES는 tailwind 클래스.
 * 두 값의 이름이 혼동되지 않도록 분리되어 있다.
 */
export const RARITY_CLASSES: Record<string, string> = Object.freeze({
    common: 'text-slate-300',
    uncommon: 'text-cyan-400',
    rare: 'text-purple-400',
    epic: 'text-yellow-400',
    legendary: 'text-red-400',
});
