// cycle 321: unused DB import 제거 — messages.ts 어디에서도 DB 참조 0건.

import type { StatusId } from '../types/index.js';

/**
 * messages.js — 게임 내 모든 메시지를 한국어로 통합 관리합니다.
 * CombatEngine, hooks 등에서 참조하세요.
 *
 * 2026-07 타입화: MSG 객체 리터럴 타입을 TypeScript가 그대로 추론하도록 두고
 * (const로 export), 각 함수의 파라미터에 실제 호출부 인자 타입을 명시해
 * `: any` 107건을 해소했다. MSG 자체에는 명시적 타입 주석을 달지 않는다 —
 * 리터럴 추론이 실제 함수 시그니처(파라미터/반환 타입)를 그대로 보존해
 * 소비처 33개 파일과의 호환성이 더 안전하다.
 */

/**
 * 2026-09 Wave 6 X2: 상태이상 라벨 단일 원천 — 7곳 이상 흩어져 있던 인라인
 * `Record<string, string>` 테이블(StatusBar.tsx / adventureGuide.ts / CombatPanel.tsx /
 * CombatEngine.actions·enemyAI·status.ts)을 이 두 테이블로 합친다.
 *
 * MSG 객체 리터럴 안에서 이 상수들을 그대로 재사용하기 위해 (자기 참조로 인한
 * TS7022 순환 추론을 피하려고) MSG 바깥의 top-level const로 둔다 — `satisfies`로
 * `Record<StatusId, string>` 형태만 검증하고 리터럴 타입은 그대로 보존한다
 * (헤더 주석의 "MSG엔 명시적 타입 주석 없음" 원칙과 동일하게, 이 상수들에도 `:` 대신
 * `satisfies`를 쓴다).
 *
 * 이미 프로덕션에 노출된 표기 drift가 있다 — poison만 다르다:
 *   - STATUS_LABELS (칩/만료 안내용, 기존 StatusBar.tsx·adventureGuide.ts·
 *     PLAYER_STATUS_EXPIRED 표기): poison → '중독'.
 *   - DOT_LABELS (전투 로그/DoT 표기용, 기존 CombatPanel.tsx·CombatEngine.actions·
 *     enemyAI·status.ts 표기): poison → '독'.
 * 두 표기 모두 이미 유저에게 노출된 문구라 이번 이관에서는 통일하지 않고 각자의
 * 원천 테이블로만 옮긴다 — 어느 쪽으로 통일할지는 별도 product 결정이 필요하다.
 */
const STATUS_LABELS = {
    bleed: '출혈', blind: '실명', burn: '화상', curse: '저주',
    fear: '공포', freeze: '빙결', poison: '중독', stun: '기절',
} satisfies Record<StatusId, string>;

const DOT_LABELS = {
    bleed: '출혈', blind: '실명', burn: '화상', curse: '저주',
    fear: '공포', freeze: '빙결', poison: '독', stun: '기절',
} satisfies Record<StatusId, string>;

// 2026-09 Wave 6 X2: RELIC_LIFESTEAL_PROC(아래)가 이 두 라벨을 재사용한다 — MSG 객체
// 리터럴 안에서 MSG.HELL_REAPER_LABEL처럼 자기 자신을 참조하면 TS7022(순환 추론)가
// 나므로, STATUS_LABELS/DOT_LABELS와 같은 이유로 top-level const로 둔다.
const HELL_REAPER_LABEL = '지옥의 수확자';
const VAMPIRE_LORD_LABEL = '흡혈 군주';

export const MSG = {
    // --- 전투 (Combat) ---
    // cycle 116: COMBAT_ATTACK 제거 — COMBAT_ATTACK_DETAIL이 active.
    COMBAT_ATTACK_DETAIL: (name: string | undefined, dmg: number, cur: number, max: number | undefined, tags: string[]) =>
        `${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    COMBAT_ENEMY_HIT: (name: string | undefined, dmg: number, rng: () => number = Math.random) => {
        const variants = [
            `${name}이(가) ${dmg} 피해를 가했습니다.`,
            `${name}의 공격! ${dmg} 피해를 받았습니다.`,
            `${name}에게 가격당했습니다. (${dmg})`,
        ];
        return variants[Math.floor(rng() * variants.length)];
    },
    COMBAT_ENEMY_HEAVY_HIT: (name: string | undefined, dmg: number, rng: () => number = Math.random) => {
        const variants = [
            `${name}의 강타! ${dmg} 피해를 입었습니다.`,
            `${name}이(가) 맹렬하게 공격합니다! ${dmg} 피해!`,
            `강력한 일격! ${name}의 공격에 ${dmg} 피해를 받았습니다.`,
        ];
        return variants[Math.floor(rng() * variants.length)];
    },
    COMBAT_ENEMY_GUARD: (name: string | undefined) => `${name}이(가) 방어 자세를 취했습니다.`,
    COMBAT_ENEMY_STUNNED: (name: string | undefined) => `${name}이(가) 기절하여 턴을 잃습니다.`,
    COMBAT_CRIT: '치명타!',

    // --- 스킬 (Skill) ---
    // slice 19: tags 추가 — 치명타/약점/저항을 본문에 통합 (COMBAT_ATTACK_DETAIL 동일 패턴)
    SKILL_USE: (skillName: string | undefined, dmg: number, name: string | undefined, cur: number, max: number | undefined, tags: string[]) =>
        `[${skillName}]: ${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    SKILL_BUFF_ACTIVE: (name: string, turns: number) => `${name} 강화 효과가 ${turns}턴 동안 적용됩니다.`,
    SKILL_STATUS_BONUS: (effect: string, dmg: number) => `[${effect}] 추가 피해 +${dmg}`,
    SKILL_NO_MP: '기력이 부족합니다.',
    SKILL_ON_COOLDOWN: (name: string, turns: number) => `${name} 재사용까지 ${turns}턴 남았습니다.`,
    SKILL_NONE: '사용 가능한 스킬이 없습니다.',

    // --- 탈출 (Escape) ---
    ESCAPE_SUCCESS: '성공적으로 탈출했습니다!',
    ESCAPE_FAIL: '탈출 실패!',
    ESCAPE_FAIL_DMG: (name: string | undefined, dmg: number) => `${name}이(가) 뒤쫓아 ${dmg} 피해를 입혔습니다.`,

    // --- 전투 결과 (Victory / Defeat) ---
    VICTORY: (exp: number, gold: number) => `승리했습니다. 경험 +${exp} · 골드 +${gold}`,
    FIRST_BOSS_GOLD: (gold: number) => `첫 보스 토벌 보상 · 골드 +${gold}`,
    BLOOD_OATH_HEAL: (health: number) => `피의 서약으로 생명을 ${health}만큼 회복했습니다.`,
    WORLD_DEVOUR_HEALTH: (health: number) => `세계 포식자가 영혼을 흡수했습니다. 다음 전투 한 번의 기본 최대 생명과 현재 생명이 ${health}만큼 늘어납니다.`,
    IMMORTAL_WARRIOR_HEAL: (health: number) => `불멸의 전사 효과로 생명을 ${health}만큼 회복했습니다.`,
    INFINITE_DEVOUR_HEAL: (health: number) => `무한 포식 효과로 생명을 ${health}만큼 회복했습니다.`,
    STAR_CORE_RESTORE: '별의 핵이 기력을 모두 회복했습니다.',
    LOOT_GET: (name: string) => `전리품: ${name}`,
    LOOT_PREFIX: (name: string) => `접두사 부여: [${name}]`,
    PRESTIGE_RARE_DROP: (name: string) => `✦ [심연의 메아리] 보스가 희귀 장비를 떨어뜨렸습니다: ${name}`,
    SIGNATURE_DISCOVERED: (name: string) => `✦ 전설 각인 ─ ${name} 획득!`,
    COMBAT_LOOT_CAPACITY_BLOCKED: (count: number) => `가방이 가득해 전리품 ${count}개를 챙기지 못했습니다.`,
    SIGNATURE_SELL_BLOCKED: (name: string | undefined) => `[${name}]은(는) 전설 각인 아이템이라 판매할 수 없습니다.`,
    SIGNATURE_SYNTH_BLOCKED: (name: string) => `[${name}]은(는) 전설 각인 아이템이라 합성 재료로 사용할 수 없습니다.`,
    SIGNATURE_BOSS_HINT: (bossName: string, count: number, topName: string, topPct: number | string) => (
        count > 1
            ? `✦ [${bossName}] 전설 각인 ${count}종 드롭 가능 — 최고 [${topName}] ${topPct}%`
            : `✦ [${bossName}] 전설 각인 [${topName}] 드롭 가능 — ${topPct}%`
    ),
    SIGNATURE_PITY_RESONANCE: (pct: number | string, pity: number | undefined) => `✦ 각인 공명 +${pct}% — 보스 ${pity}회 연속 무획득 보정 적용`,
    // fix/signature-set-two-hand: 양손 시그니처 무기가 세트 카운트에 2피스로 반영됐을 때
    // EquipmentPanel "세트 진행도" 카드에 표시하는 힌트 1줄.
    SIGNATURE_SET_TWO_HAND_HINT: '💡 양손 무기는 보조 슬롯을 함께 차지해 2피스로 계산됩니다.',
    OUTFIT_SET_TWO_HAND_SLOT: '양손 무기가 함께 사용',
    OUTFIT_SET_TWO_HAND_HINT: '양손 무기는 보조 장비 칸까지 2피스로 계산됩니다.',
    LEGACY_ESSENCE: (n: number) => `계승 정수 +${n}`,
    LEGACY_RANK: (n: number) => `계승 단계 ${n} 달성`,
    // 2026-07 — 에테르 거울: revive 노드(런당 1회 치명상 부활) 발동 로그.
    MIRROR_REVIVE: '[에테르 수호] 거울의 가호가 치명상을 막아냈습니다!',
    MIRROR_PURCHASE: (name: string, newLevel: number, cost: number) => `에테르 거울에 ${name} ${newLevel}단계를 새겼습니다. 계승 정수 -${cost}`,
    // slice 19: 스탯 상승 표기 — 레벨업이 무엇을 바꿨는지 로그에서 즉시 확인 (성장 가시화)
    LEVEL_UP: (level: number, attack: number, health: number) => `레벨 ${level} 상승 · 공격력 +${attack} · 생명 +${health}`,
    LEVEL_MILESTONE: (level: number, gold: number) => `레벨 ${level} 달성 · 골드 ${gold.toLocaleString()} 획득`,
    LEVEL_MAJOR_MILESTONE: (level: number, attack: number, health: number, energy: number) => `레벨 ${level} 성장 보너스 · 공격력 +${attack} · 생명 +${health} · 기력 +${energy}`,
    EQUIP_LEVEL_REQUIRED: (name: string, level: number) => `${name} 장착에는 레벨 ${level} 이상이 필요합니다.`,
    BUFF_EXPIRED: '강화 효과가 끝났습니다.',
    DEFEAT: '전투에서 쓰러졌습니다. 계승한 힘은 다음 여정에도 남습니다.',
    // C-1 (B+ 2026-06): 첫 죽음 영구 메타 보상 안내 — "죽음도 성장이다".
    FIRST_DEATH_META: (attack: number, health: number) => `첫 패배를 딛고 영구적인 힘을 얻었습니다. 공격력 +${attack} · 최대 생명 +${health}. 다음 여정은 더 강하게 시작합니다.`,
    // B-1 (B+ 2026-06): 시작 부트 — 캐릭터 생성 직후 첫 유물 선택 안내.
    START_BOOT_RELIC: '새 여정의 유물 선택지가 열렸습니다. 지금 고르지 않아도 모험 중 다시 발견할 수 있습니다.',

    // --- 상태이상 (Status Effects) ---
    // cycle 107: 플레이어가 freeze/stun 상태에서 턴을 스킵할 때의 안내 — 적의
    // stunnedTurns 처리(MSG.COMBAT_ENEMY_STUNNED)와 짝.
    PLAYER_STATUS_SKIP: (effect: string) => {
        const label = effect === 'freeze' ? '빙결' : effect === 'stun' ? '기절' : effect;
        return `[${label}] 행동 불가 — 턴을 잃었습니다.`;
    },

    STATUS_DOT: (effect: string, dmg: number) => {
        // cycle 106: bleed → 출혈 라벨 추가. CombatEngine player DoT 분기에 bleed가
        // 누락돼 있던 회귀 fix와 함께 (enemy.dots 분기에선 이미 '출혈' 사용 중이라
        // surface 일관성 회복). 2026-09 Wave 6 X2: 라벨 값을 STATUS_LABELS(공유
        // 테이블)에서 가져오도록 소유만 옮겼다 — poison/burn/bleed 외 effect는
        // 이전처럼 그대로 통과(라벨 미적용) 동작을 보존한다.
        const label = effect === 'poison' ? STATUS_LABELS.poison
            : effect === 'burn' ? STATUS_LABELS.burn
            : effect === 'bleed' ? STATUS_LABELS.bleed
            : effect;
        return `[${label}] 상태이상 피해 ${dmg}`;
    },

    // H1 (Wave 3 감사): 플레이어 상태이상 만료 안내 — BALANCE.PLAYER_STATUS_DURATION_TURNS
    // 턴이 지나 CombatEngine.tickCombatState가 상태를 해제할 때의 로그.
    // 2026-09 Wave 6 X2: 인라인 labels 테이블 제거 — STATUS_LABELS(공유 테이블) 재사용.
    PLAYER_STATUS_EXPIRED: (effect: string) => {
        const label = STATUS_LABELS[effect as StatusId] || effect;
        return `[${label}] 효과가 사라졌습니다.`;
    },

    // 2026-09 Wave 6 X2: 상태이상 라벨 단일 원천 (컴포넌트/CombatEngine 재사용).
    // STATUS_LABELS/DOT_LABELS의 정의와 drift 기록은 위 top-level const 주석 참고.
    STATUS_LABELS,
    DOT_LABELS,

    // cycle 116: 데드 마일스톤 / 도감 메시지 키 제거 — MILESTONE_KILLS_*, MILESTONE_BOSS_*,
    // CODEX_DISCOVER/MILESTONE 등은 active 컴포넌트에서 inline 메시지로 대체되어 0건 사용.

    // --- 등급 (Rarity) ---
    RARITY_LABEL: { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' } as Record<string, string>,

    // --- 합성 (Synthesis) ---
    SYNTHESIS_SUCCESS: (name: string) => `✨ 합성 성공! [${name}] 획득!`,
    SYNTHESIS_FAIL: '합성 실패... 일부 재료가 소실되었습니다.',
    SYNTHESIS_PROTECTED: '합성 보호 활성화 — 재료가 보존되었습니다.',
    SYNTHESIS_NOT_ENOUGH: '합성에 필요한 재료가 부족합니다.',
    SYNTHESIS_NOT_ENOUGH_GOLD: '합성에 필요한 골드가 부족합니다.',

    // --- 프리미엄 (Premium) ---
    PREMIUM_PURCHASE: (name: string, cost: number) => `${name} 교환 완료 (에테르 크리스탈 ${cost}개)`,
    PREMIUM_INV_EXPAND: (size: number) => `가방을 ${size}칸까지 확장했습니다.`,

    // --- 강화 (Enhancement) ---
    ENHANCE_SUCCESS: (name: string, lv: number) => `✨ [${name}] +${lv} 강화 성공!`,
    ENHANCE_FAIL: (name: string, lv: number) => `💔 [${name}] +${lv} 강화 실패. 등급 유지.`,
    ENHANCE_MAX_LEVEL: '이미 최고 강화 등급입니다 (+10).',
    ENHANCE_NO_GOLD: (cost: number) => `강화할 골드가 부족합니다. 필요 골드: ${cost}`,
    ENHANCE_NO_MATERIAL: (name: string, count: number) => `${name}이(가) 부족합니다. (필요: ${count}개)`,
    ENHANCE_NOT_EQUIP: '강화는 장비 아이템에만 가능합니다.',

    // --- 주간 미션 (Weekly Mission) ---
    // cycle 116: WEEKLY_MISSION_COMPLETE/RESET 제거 — 0건 사용. CLAIM만 active.
    WEEKLY_MISSION_CLAIM: (gold: number, crystals?: number) => `주간 보상 · 골드 +${gold}${crystals ? ` · 에테르 크리스탈 +${crystals}` : ''}`,

    // --- 도전 설정 ---
    // cycle 116: CHALLENGE_COMPLETE 제거 — 0건 사용. START만 active.
    CHALLENGE_START: (labels: string[]) => `⚔ 도전 모험 시작: ${labels.join(', ')}`,

    // --- 진 엔딩 (True Ending) ---
    // cycle 116: TRUE_BOSS_PHASE3 제거 — 0건 사용. UNLOCK/APPEAR만 active.
    TRUE_BOSS_UNLOCK: '세계의 근원이 흔들립니다... 숨겨진 문이 열렸습니다!',
    TRUE_BOSS_APPEAR: '원시의 신이 강림했습니다. 이것이 진짜 끝입니다.',
    PRIMAL_SHARD_DROP: (count: number) => `원시의 파편 획득! (${count}/3)`,
    PRIMAL_SHARD_HINT: (count: number) => `원시의 파편 ${count}/3개. 마왕을 쓰러뜨리면 진실이 드러납니다.`,

    // --- 심연 마일스톤 (Abyss Milestone) ---
    ABYSS_MILESTONE: (floor: number) => `🌀 심연 ${floor}층 마일스톤 달성!`,
    ABYSS_BOSS_APPEAR: (name: string) => `💀 심연 보스 출현: ${name}`,

    // --- 묘비 침략 (Grave Invasion) ---
    INVADE_SUCCESS: (name: string, item: string) => `⚔ ${name}의 묘비 침략 성공! [${item}] 획득.`,
    INVADE_FAIL: (name: string) => `⚔ ${name}의 묘비 침략 실패. 아무것도 얻지 못했습니다.`,
    INVADE_LIMIT: '오늘의 침략 횟수를 모두 사용했습니다. (5회/일)',
    INVADE_NO_ITEMS: '묘비에 침략할 아이템이 없습니다.',

    // --- 신규 직업 스킬 (Sprint 16) ---
    SKILL_EXTRA_TURN: (name: string) => `[${name}] 시간이 흘러갑니다 — 추가 행동 획득!`,
    SKILL_RESET_COOLDOWNS: (name: string) => `${name} 효과로 모든 기술을 바로 다시 사용할 수 있습니다.`,

    // cycle 116: 데드 키 제거 — REST_FULL/PARTIAL(REST_DONE_FULL이 active),
    // INVENTORY_FULL(INV_FULL active), BOSS_ENCOUNTER/AREA_BOSS_ENCOUNTER,
    // SAFE_ZONE_ARRIVE, MOVE_BLOCKED_COMBAT/EVENT(MOVE_BLOCKED active),
    // DISCOVERY_CHAIN_TRIGGER/COMPLETE(exploreUtils inline string 사용),
    // CHALLENGE_REWARD_BONUS, SKILL_CURSE_AMPLIFY(cycle 108에서 의도 구현했지만
    // inline 메시지로 대체).

    // --- 스킬 교체 ---
    SKILL_SWAP: (skillName: string, oldName: string, newName: string) => `${skillName} 성장 변경: ${oldName} → ${newName}`,
    SKILL_SWAP_COST: (gold: number) => `기술 교체 비용 · 골드 ${gold}`,

    // --- 직업/클래스 ---
    CLASS_TIER_0: '기본',
    CLASS_TIER_1: '1차 전직',
    CLASS_TIER_2: '2차 전직',
    CLASS_TIER_3: '최종 전직',

    // --- 도감 ---
    // cycle 116: CODEX_NEW_ENTRY/DISCOVERED/UNDISCOVERED/PROGRESS 제거 — 0건 사용.
    MONSTER_WEAKNESS: '약점',
    MONSTER_RESISTANCE: '내성',
    MONSTER_KILL_COUNT: (n: number) => `처치 ${n}회`,
    EQUIP_STAT_COMPARE: '능력 비교',
    // cycle 116: EQUIP_EQUIPPED / UI_EQUIPPED 둘 다 '장착 중' 중복 정의였음. 둘 다 제거.

    // --- 인벤토리/장비 액션 ---
    INV_ITEM_NOT_FOUND: '가방에 없는 아이템입니다.',
    EQUIP_JOB_RESTRICT: (job: string | undefined, name: string | undefined) => `${job}은(는) ${name}을(를) 장착할 수 없습니다.`,
    EQUIP_TWO_HAND_SHIELD_BLOCK: '양손 무기 사용 중에는 방패를 장착할 수 없습니다.',
    EQUIP_TWO_HAND_OFFHAND_RELEASE: '양손 무기로 전환되어 보조 손 장비가 해제되었습니다.',
    EQUIP_TWO_HAND_TO_ONE_HAND: '양손 무기를 해제하고 한손 무기 체계로 전환했습니다.',
    EQUIP_OFFHAND_SET: '보조 손에 한손 무기를 장착했습니다.',
    EQUIP_MAIN_SHIFT: '새 무기를 주손에 장착하고 기존 무기를 보조손으로 이동했습니다.',
    EQUIP_MAIN_REPLACE: '주손 무기를 교체했습니다.',
    EQUIP_OFFHAND_REPLACE: '보조 손 장비를 교체했습니다.',
    EQUIP_DONE: (name: string) => `${name} 장착.`,
    CHALLENGE_NO_CONSUMABLE: '물약 없이: 회복과 보조 아이템을 사용할 수 없습니다.',
    CONSUMABLE_INVALID: '사용할 수 없는 소모품입니다.',
    CONSUMABLE_FULL_HP: '생명이 이미 가득합니다.',
    CONSUMABLE_FULL_MP: '기력이 이미 가득합니다.',
    CONSUMABLE_STATUS_ABSENT: '해제할 상태이상이 없습니다.',
    CONSUMABLE_BUFF_DOMINATED: '더 강하거나 오래가는 강화 효과가 이미 적용 중입니다.',
    ITEM_USE_BUFF: (name: string) => `${name}을 사용해 강화 효과를 얻었습니다.`,
    GOLD_INSUFFICIENT: '골드가 부족합니다.',
    INV_FULL: '가방이 가득 찼습니다.',
    SHOP_BUY_DONE: (name: string | undefined) => `${name} 구매 완료.`,
    SHOP_SELL_DONE: (name: string | undefined, gold: number) => `${name} 판매 · 골드 +${gold}`,
    CRAFT_MAT_INSUFFICIENT: (name: string) => `재료 부족: ${name}`,
    CRAFT_DONE: (name: string) => `${name} 제작 완료`,
    QUEST_REWARD_ITEM: (name: string) => `보상 아이템: ${name}`,
    QUEST_TRAIT_BONUS: (title: string, gold: number) => `${title} 공명 보상 · 골드 +${gold}`,
    // W2 (Wave 5): Quest.title은 타입상 optional이고 현상수배/카탈로그 양쪽을 받는
    //   호출부가 있어 QUEST_ACCEPTED / QUEST_ABANDONED와 같은 시그니처로 맞춘다.
    QUEST_DONE: (title: string | undefined) => `퀘스트 완료: ${title}`,
    ACH_REWARD_ITEM: (name: string) => `업적 보상 아이템: ${name}`,
    ACH_DONE: (title: string | undefined) => `업적 달성: ${title}`,
    PREMIUM_INSUFFICIENT: (name: string) => `${name}이(가) 부족합니다.`,
    ITEM_NOT_FOUND: '아이템을 찾을 수 없습니다.',
    SKILL_BRANCH_CHOSEN: (name: string, branchName: string) => `${name} 성장 선택: ${branchName}`,
    SKILL_BRANCH_ALREADY_CHOSEN: (name: string) => `${name}의 첫 성장 선택은 끝났습니다. 안전한 지역에서 다시 선택할 수 있습니다.`,
    BULK_SELL_DONE: (count: number, gold: number) => `재료 ${count}개 판매 · 골드 +${gold}`,

    // --- 이동/탐험 ---
    MOVE_BLOCKED: '지금은 이동할 수 없는 상태입니다.',
    MAP_NOT_FOUND: '존재하지 않는 지역입니다.',
    MOVE_SEASON_ONLY: '⚡ 시즌 이벤트 기간에만 접근할 수 있는 지역입니다.',
    MOVE_NO_EXIT: '갈 수 없는 곳입니다.',
    MOVE_LEVEL_REQUIRED: (lv: number | string) => `레벨 ${lv} 이상에서 입장할 수 있습니다.`,
    TOWN_BUFF_CLEAR: '마을에 돌아와 임시 강화 효과와 상태 이상을 정리했습니다.',
    EXPLORE_BLOCKED: '탐색할 수 없는 상태입니다.',
    TOWN_PEACEFUL: '마을 주변은 평화롭습니다.',
    // 2026-09 Wave 16 H3: safe 지역의 explore 라벨 — ControlPanel이 하드코딩하던
    //   한국어 문자열을 MSG로 옮기고, 이야기 스텝 대기 케이스를 새로 구분한다.
    TOWN_EXPLORE_INVESTIGATE: '도시 조사 · 전투 가능',
    TOWN_EXPLORE_CHAIN: '단서를 따라간다',
    MAP_UNKNOWN: '알 수 없는 위치입니다. 시작 마을로 이동하세요.',
    EXPLORE_NOTHING: '아무 일도 일어나지 않았습니다.',
    EXPLORE_QUIET: '주변이 조용합니다.',
    EXPLORE_RELIC_FOUND: '✨ [유물 발견] 전투 직전, 고대의 유물이 눈에 들어옵니다!',
    REST_SAFE_ONLY: '휴식은 안전한 지역에서만 가능합니다.',
    // 2026-09 Wave 17 I1: 상점 진입 문구 — commandParser가 하드코딩하던 한국어를
    //   MSG로 옮긴다(CLAUDE.md §5). 전투 중 차단 문구는 새로 생긴 가드의 것이다.
    SHOP_SAFE_ONLY: '상점은 안전 지역에서만 이용할 수 있습니다.',
    SHOP_BLOCKED: '전투 중에는 상점을 이용할 수 없습니다.',
    SHOP_ENTERED: '상점에 입장했습니다.',
    REST_GOLD_INSUFFICIENT: (cost: number) => `휴식할 골드가 부족합니다. 필요 골드: ${cost}`,
    // cycle 116: REST_DONE 제거 — REST_DONE_FULL이 active.
    SKILL_SWAP_SAFE_ONLY: '스킬 교체는 안전한 지역에서만 가능합니다.',
    SKILL_SWAP_GOLD_INSUFFICIENT: (cost: number) => `기술을 바꿀 골드가 부족합니다. 필요 골드: ${cost}`,
    SKILL_NO_BRANCH: '해당 스킬에 분기가 없습니다.',
    SKILL_INVALID_BRANCH: '유효하지 않은 분기입니다.',
    JOB_CHANGE_INVALID: '전직 가능한 직업이 아닙니다.',
    JOB_CHANGE_LEVEL: '전직 레벨이 부족합니다.',
    QUEST_TOWN_ONLY: '퀘스트 수락은 마을 게시판에서만 가능합니다.',
    QUEST_ALREADY_COMPLETED: '이미 완료해 보상을 받은 퀘스트입니다.',
    QUEST_LEVEL_REQUIRED: (lv: number | undefined) => `레벨 ${lv} 이상부터 수락할 수 있는 퀘스트입니다.`,
    QUEST_PREREQUISITE_REQUIRED: (title: string | undefined) => `‘${title}’ 임무를 먼저 완료해야 이어지는 이야기를 받을 수 있습니다.`,
    QUEST_ACCEPTED: (title: string | undefined) => `퀘스트 수락: ${title}`,
    QUEST_ABANDON_TOWN_ONLY: '임무 포기는 마을 게시판에서만 가능합니다.',
    QUEST_ABANDON_REWARD_PENDING: '완료한 임무는 보상을 받은 뒤 목록에서 정리할 수 있습니다.',
    QUEST_ABANDONED: (title: string | undefined) => `${title} 임무를 포기했습니다. 같은 임무는 다시 수락할 수 있습니다.`,
    EXPEDITION_FOCUS_TOWN_ONLY: '원정 임무 편성은 마을에서만 바꿀 수 있습니다.',
    EXPEDITION_FOCUS_LIMIT: '이번 원정에는 임무를 최대 3개까지 지정할 수 있습니다.',
    EXPEDITION_FOCUS_REQUIRED: '원정 임무를 최소 1개는 유지해야 합니다.',
    EXPEDITION_FOCUS_ADDED: (title: string | undefined) => `이번 원정 임무 추가: ${title}`,
    EXPEDITION_FOCUS_REMOVED: (title: string | undefined) => `이번 원정 임무 제외: ${title}`,
    BOUNTY_TOWN_ONLY: '현상수배 수주는 마을 게시판에서만 가능합니다.',
    BOUNTY_ABANDONED: '현상수배 임무를 포기했습니다. 오늘은 새 현상수배를 받을 수 없습니다.',
    BOUNTY_DAILY_LIMIT: '오늘 현상수배는 이미 발급되었습니다. 내일 다시 요청하세요.',
    // cycle 116: BOUNTY_ACCEPTED 제거 — BOUNTY_ACCEPTED_NEW가 active.
    ASCEND_CANCEL: '계승을 미루고 현재 여정을 계속합니다.',

    // --- 이동/탐험 동적 메시지 ---
    MOVE_EXITS: (exits: string) => `이동 가능한 지역: ${exits}`,
    MOVE_ARRIVED: (loc: string) => `${loc}에 도착했습니다.`,
    MOVE_NEW_AREA: (loc: string) => `처음 발견한 지역은 ${loc}입니다.`,
    // C-2 (B+ 2026-06): 갓 진입한 위험 지역(권장 레벨 근접) 경고 — 정예/보스 readability.
    MOVE_AREA_DANGER: (lv: number | string) => `이 지역의 권장 레벨은 ${lv}입니다. 정예와 구역 보스를 주의하고, 생명이 부족하면 돌아가세요.`,
    GRAVE_FOUND_MULTI: (count: number) => `근처에서 당신의 유해 ${count}구를 발견했습니다.`,
    GRAVE_FOUND_SINGLE: '근처에서 당신의 유해를 발견했습니다.',
    START_JOURNEY: (name: string) => `${name}의 첫 여정이 시작됩니다.`,
    START_SKILL: (name: string) => `첫 기술로 익힌 능력은 ${name}입니다.`,
    ABYSS_FLOOR_WARNING: (floor: number) => `🌀 심연 ${floor}층 — 강대한 적들이 기다립니다...`,
    ENEMY_APPEAR: (name: string) => `${name} 등장!`,
    EVENT_RESULT_DEFAULT: '선택의 결과가 반영되었습니다.',
    EVENT_REWARD_UNAVAILABLE: '이 선택의 보상 정보를 확인할 수 없습니다. 다른 선택을 골라주세요.',
    CHAIN_RELIC_ALREADY_OWNED: (name: string) => `${name}은 이미 보유하고 있습니다. 다른 선택을 골라주세요.`,
    CHAIN_RELIC_SLOTS_FULL: '유물 슬롯이 가득 찼습니다. 자리를 마련한 뒤 다시 선택하세요.',
    // 캠프파이어 노드 (Phase 2, B+ 2026-06): 휴식 vs 단련 결정 (StS 캠프파이어).
    CAMPFIRE_DESC: '사그라드는 모닥불을 발견했습니다. 잠시 숨을 고를 수 있습니다. 무엇을 하시겠습니까?',
    CAMPFIRE_REST_CHOICE: '휴식 — 생명과 기력을 회복한다',
    CAMPFIRE_FORGE_CHOICE: '단련 — 무기를 손질해 다음 전투를 대비한다',
    CAMPFIRE_REST_LOG: (health: number, energy: number) => `불 곁에서 숨을 고르며 생명 +${health} · 기력 +${energy} 회복했습니다.`,
    CAMPFIRE_FORGE_LOG: (pct: number, turns: number) => `무기를 벼립니다. 다음 전투 ${turns}턴 동안 공격력 +${pct}%.`,
    // 탐험 스카우팅 (2026-07): 사전 정찰 카드 — 체인/캠프파이어 다음 우선순위 결정 노드.
    SCOUT_DESC: '앞길에서 낯선 기척이 느껴집니다. 어떻게 정찰하시겠습니까?',
    SCOUT_COMBAT_CHOICE: '전투의 기척 — 적과 맞서며 처치 보상을 더 받는다',
    // 관대함 하향 (2026-07 밸런스 감사): "전투 회피 = 안전"으로만 읽히지 않도록 이변
    //   위험을 문구에 명시 — anomaly 확률 실제 가중(SCOUT_SIGNAL_ANOMALY_MULT)과 정합.
    SCOUT_ANOMALY_CHOICE: '이상 신호 — 전투를 피하고 이변의 흔적을 살핀다',
    SCOUT_UNKNOWN_CHOICE: '짙은 안개 — 결과를 알 수 없는 길로 들어간다',
    SCOUT_ELITE_CHOICE: '정예의 흔적 — 강력한 적과 싸워 유물을 노린다',
    SCOUT_COMBAT_LOG: '기척을 쫓아 적과 정면으로 마주칩니다.',
    SCOUT_ANOMALY_LOG: '이상 신호를 따라 주변을 조심스럽게 살핍니다.',
    SCOUT_UNKNOWN_LOG: '짙은 안개 속으로 발을 내딛습니다.',
    SCOUT_ELITE_LOG: '정예의 흔적을 따라가 강력한 적과 마주칩니다.',
    // 원정 보스 접근 게이지 (2026-07): 던전 진입 시 원정 목표 배너 + 만충 시 도전/회피 선택.
    EXPEDITION_GOAL_BANNER: (bossName: string) => `🎯 원정 목표: ${bossName} — 흔적을 쫓아 접근하라.`,
    BOSS_GAUGE_FULL_DESC: (bossName: string) => `${bossName}의 흔적이 짙어졌습니다. 지금 정면으로 맞서시겠습니까?`,
    BOSS_GAUGE_CHALLENGE_CHOICE: '도전 — 구역 보스와 정면으로 맞선다',
    BOSS_GAUGE_AVOID_CHOICE: '회피 — 흔적을 피해 계속 나아간다',
    BOSS_GAUGE_CHALLENGE_LOG: (bossName: string) => `${bossName}에게 정면으로 도전합니다.`,
    BOSS_GAUGE_AVOID_LOG: '흔적을 피해 발걸음을 돌립니다. 기척은 여전히 짙게 남아 있습니다.',
    MAP_BADGE_BOSS_GAUGE: (pct: number) => `게이지 ${pct}%`,
    EXPEDITION_CLEAR_RECAP: (bossName: string, kills: number, gold: number) => (
        `원정 완료 · ${bossName} 격파 · 적 ${kills}마리 처치 · 골드 +${gold}`
    ),
    EVENT_SUCCESS_GOLD: (gold: number) => `선택에 성공했습니다. 골드 +${gold}`,
    EVENT_FAIL_DAMAGE: (dmg: number) => `선택의 대가로 생명 ${dmg}을 잃었습니다.`,
    REST_DONE_FULL: (cost: number) => `휴식을 마치고 생명과 기력을 모두 회복했습니다. 골드 -${cost}`,
    JOB_CHANGE_DONE: (jobName: string) => `${jobName} 전직 완료!`,
    BOUNTY_ACCEPTED_NEW: (target: string, count: number) => `새로운 현상수배 수락: ${target} ${count}마리`,
    TITLE_UNLOCKED: (label: string) => `새 칭호를 얻었습니다. ${label}`,
    ASCEND_DONE: (rank: number, title: string) => `에테르 계승 ${rank}단계에 도달했습니다. 새 칭호 '${title}'와 영구 성장이 다음 여정에 적용됩니다.`,
    DAILY_PROTOCOL_DONE: (count: number, reward: string) => (
        `${count > 1 ? `오늘의 임무 ${count}개 완료` : '오늘의 임무 완료'} · ${reward}`
    ),
    DAILY_PROTOCOL_RELIC_COMPLETE: (name: string) => `유물 파편 완성 · ${name} 획득`,
    CHAIN_REWARD_RELIC: (name: string) => `이야기 보상 · 유물 ${name}을 얻었습니다.`,
    CHAIN_REWARD_COMBAT_BONUS: (attackPercent: number, turns: number) => `최후의 영웅이 합류해 ${turns}턴 동안 공격력이 ${attackPercent}% 오릅니다.`,

    // --- 체인 저널 (Quest 탭) ---
    CHAIN_JOURNAL_TITLE: '진행 중인 이야기',
    CHAIN_JOURNAL_STEP: (current: number, total: number) => `${current}/${total} 단계`,
    CHAIN_JOURNAL_NEXT_LOC: (loc: string) => `다음 이야기: ${loc}`,

    // --- 맵 exit 배지 (MapNavigator) ---
    MAP_BADGE_BOSS: '보스',
    MAP_BADGE_HIGH_EVENT: '이벤트↑',
    MAP_BADGE_SHOP: '상점',
    MAP_BADGE_GRAVE: '유해 회수↑',

    // --- 복귀 브리핑 카드 (리텐션 훅) ---
    RETURN_BRIEFING_TITLE: '복귀를 환영합니다',
    RETURN_BRIEFING_AWAY: (hours: number) => `마지막 접속 이후 ${hours}시간이 지났습니다.`,
    RETURN_BRIEFING_LOCATION_LABEL: '현재 위치',
    RETURN_BRIEFING_STATUS_LABEL: '현재 상태',
    RETURN_BRIEFING_DAILY_LABEL: '오늘의 진행',
    RETURN_BRIEFING_DAILY_VALUE: (completed: number, total: number) => `${completed}/${total} 완료`,
    RETURN_BRIEFING_REWARDS_LABEL: '받을 임무 보상',
    RETURN_BRIEFING_REWARDS_VALUE: (count: number) => `${count}건`,
    RETURN_BRIEFING_CHAINS_LABEL: '진행 중인 이야기',
    RETURN_BRIEFING_CHAINS_VALUE: (count: number) => `${count}건`,
    RETURN_BRIEFING_OPEN_REWARDS: '임무 보상 확인',
    RETURN_BRIEFING_CONTINUE: '현재 여정 이어가기',

    // --- 심연 데일리 다이브 (리텐션 훅) ---
    ABYSS_DAILY_DIVE_START: (mult: number) => `🌀 오늘의 첫 다이브 — 보상 ${mult}배 적용!`,

    // cycle 116: GM_OVERWHELM/CRISIS/UNDERDOG 제거 — 게임 마스터 톤 메시지가 0건 사용
    // (DifficultyManager가 자체 로그를 inline string으로 처리).

    // --- 전투 요약 (PostCombat Digest) ---
    COMBAT_DIGEST_KILL: (name: string) => `${name} 처치`,
    COMBAT_DIGEST_LOOT: (items: string) => `전리품 ${items}`,
    COMBAT_DIGEST: (parts: string) => `전투 정리: ${parts}`,
    COMBAT_DIGEST_BOSS_REWARD: (bonus: number, hint: string) => `보스 보상: ${bonus > 0 ? `첫 토벌 골드 +${bonus}` : '보스 전리품'} · ${hint}`,
    KILL_STACK_ATTACK: (source: string, percent: number) => `${source} 효과로 이번 원정의 공격력이 ${percent}% 올랐습니다.`,
    COMBAT_DIGEST_EQUIP_UPGRADE: (name: string, summary: string) => `장비 갱신: ${name} · ${summary}`,
    COMBAT_DIGEST_TRAIT_HINT: (name: string, summary: string) => `성향 공명: ${name} · ${summary}`,
    COMBAT_DIGEST_DEFAULT_SUMMARY: '장비 효율 상승',

    // --- 전투 상태 ---
    COMBAT_NOT_IN_BATTLE: '전투 상태가 아닙니다.',
    COMBAT_ITEM_NOT_FOUND: '가방에 없는 아이템입니다.',
    COMBAT_CONSUMABLE_ONLY: '전투 중에는 소모품만 사용할 수 있습니다.',
    DEMON_KING_SLAIN_ASCEND: '⚡ 마왕이 쓰러졌습니다. 에테르 환생의 문이 열렸습니다...',
    TRUE_GOD_SLAIN: '🌟 원시의 신이 쓰러졌습니다. 세계의 진실이 밝혀집니다...',
    VOID_GOD_SLAIN: '💀 공허의 신이 쓰러졌습니다. 공허가 잠시 물러났습니다... 당신은 심연의 끝을 정복했습니다.',
    ABYSS_RECORD: (floor: number) => `🏆 심연 최고 기록 경신! ${floor}층 도달`,

    // --- 전투 아이템/스킬 ---
    COMBAT_CHAOS_SKILL: (name: string) => `뒤섞인 기술: [${name}]이(가) 발동했습니다!`,
    COMBAT_DOT_KILL: (name: string) => `[지속 피해] ${name}이(가) 쓰러졌습니다!`,
    COMBAT_COUNTER_KILL: (name: string) => `[반사·반격] ${name}이(가) 쓰러졌습니다!`,
    ITEM_USE_SIMPLE: (name: string) => `${name} 사용.`,
    ITEM_USE_CURE: (name: string) => `${name} 사용: 상태이상 해제`,

    // --- 전투 승리 ---
    QUEST_CONDITION_MET: (count: number) => `퀘스트 조건 달성: ${count}개`,
    KILL_STREAK_BONUS: (streak: number, atkPct: number) => `🔥 ${streak}연속 처치! 공격력 +${atkPct}% 보너스 발동`,

    // --- 심연 ---
    ABYSS_DESCEND: (floor: number) => `심연의 더 깊은 곳으로 진입했습니다. (현재: ${floor}층)`,
    ABYSS_LEGENDARY_ITEM: (name: string | undefined) => `🏆 전설 아이템 획득: [${name}]`,
    // cycle 194: ABYSS_PRESTIGE_POINTS 제거 — abyss milestone 'prestige_points' reward type이
    //   dead config(player.prestigePoints가 spend/UI 미구현)였음. 보상 타입을 relic_choice/
    //   legendary_item으로 교체해 메시지도 자연 dead → 정리.

    // --- Firebase 동기화 ---
    SYNC_SERVER_LOADED: '서버 데이터와 동기화되었습니다.',
    SYNC_SAVE_RESTORED: '저장된 모험을 불러왔습니다.',
    SYNC_AUTH_TIMEOUT: '인증 지연으로 오프라인 모드로 시작했습니다.',
    SYNC_NO_CONFIG: '클라우드 설정을 찾을 수 없어 오프라인 모드로 시작했습니다.',
    SYNC_AUTH_FAIL: '클라우드 인증 실패로 오프라인 모드로 시작했습니다.',
    SYNC_TIMEOUT: '클라우드 응답 지연으로 오프라인 모드로 시작했습니다.',
    SYNC_CONNECT_FAIL: '클라우드 연결 실패로 오프라인 모드로 시작했습니다.',

    // --- 탐험 선택지 ---
    CHOICE_DEFAULT: (n: number) => `선택지 ${n}`,

    // --- 이동 기본값 ---
    MOVE_NO_EXITS: '없음',

    // --- UI 라벨 (버튼/섹션) ---
    UI_CLOSE: '닫기',
    UI_REFRESH: '갱신',
    UI_REVIEW: '검토',
    UI_NOTABLE: '주목',
    // cycle 116: UI_ALL / UI_EQUIPPED 제거 — 0건 사용 (INV_FILTER_ALL과 inline string으로 대체).
    UI_LOOT_REVIEW: '전리품 검토',
    UI_LOOT_FOCUS: '전리품 주목',
    UI_LOOT_FOCUS_HINT: '이번 전투에서 얻은 장비를 우선 확인하세요.',
    UI_AUTO_EQUIP_BEST: '최적 장비 자동 장착',

    // --- 인벤토리 필터 ---
    INV_FILTER_ALL: '전체',
    INV_FILTER_WEAPON: '무기',
    INV_FILTER_ARMOR: '방어구',
    INV_FILTER_SHIELD: '보조',
    INV_FILTER_CONSUMABLE: '회복',
    INV_FILTER_MATERIAL: '재료',
    // cycle 116: INV_FULL_WARNING 제거 — INV_FULL이 active.

    // --- E1: 로컬 에러 리포트 (SystemTab "저장과 기기 점검") ---
    ERROR_REPORT_COUNT: (count: number) => `저장된 오류 리포트 · ${count}건`,
    ERROR_REPORT_LAST: (code: string, time: string) => `최근 오류 · ${code} (${time})`,
    ERROR_REPORT_EMPTY: '저장된 오류 리포트가 없습니다.',
    ERROR_REPORT_CLEAR_BUTTON: '오류 리포트 지우기',
    ERROR_REPORT_CLEARED: '오류 리포트를 지웠습니다.',
    // --- 장비 비교 델타 라벨 (A2 · 2026-09 감사 G4) ---
    // ShopPanel(getComparisonMeta) / combatActions(_helpers.getLootUpgradeHint)가
    // 각자 한국어 라벨을 하드코딩하고 있어 표기 드리프트가 가능했다. 단일 원천.
    EQUIP_DELTA_LABEL: { atk: '공격력', def: '방어력', crit: '치명타', mp: '기력' } as Record<string, string>,
    EQUIP_DELTA_NONE: '현재 장비와 동일한 효율',
    EQUIP_DELTA_NONE_COMPACT: '변화 없음',
    EQUIP_DELTA_OFFHAND_RELEASED: '보조손 해제',
    // --- 상시 HUD 원정 신호 (2026-09 · 보스 접근 게이지 / 심연 데일리 다이브) ---
    HUD_BOSS_GAUGE: (ticks: number, total: number) => `보스 접근 ${ticks}/${total}`,
    HUD_BOSS_GAUGE_FULL: (bossName: string) => `${bossName} 조우 임박`,
    HUD_ABYSS_DAILY_DIVE: (remaining: number, mult: number) => `오늘의 다이브 ${remaining}전투 ${mult}배`,

    // --- 에테르 거울 진입 (2026-09 · 승천 화면 CTA) ---
    MIRROR_CTA_LABEL: '에테르 거울 열기',
    MIRROR_CTA_HINT: (essence: number) => `계승 정수 ${essence}로 영구 성장을 새길 수 있습니다.`,
    // --- 2026-09 D1: 플레이어가 직접 부르는 정찰 ---
    SCOUT_ACTION_LABEL: '정찰',
    SCOUT_ACTION_COST_LABEL: (gold: number) => `골드 ${gold.toLocaleString('ko-KR')}`,
    SCOUT_ACTION_FREE_LABEL: (remaining: number) => `무료 ${remaining}회 남음`,
    SCOUT_ACTION_HINT: '앞길을 미리 살펴 다음 한 걸음을 고릅니다.',
    SCOUT_SAFE_ONLY: '안전지대에서는 정찰할 곳이 없습니다.',
    SCOUT_BUSY: '지금은 정찰할 수 없습니다.',
    SCOUT_GOLD_INSUFFICIENT: (cost: number) => `정찰에는 골드 ${cost.toLocaleString('ko-KR')}이 필요합니다.`,
    SCOUT_PAID_LOG: (cost: number) => `골드 ${cost.toLocaleString('ko-KR')}을 들여 앞길을 정찰합니다.`,
    SCOUT_FREE_LOG: (remaining: number) => `거울의 눈으로 앞길을 정찰합니다. 남은 무료 정찰 ${remaining}회`,
    SCOUT_TIME_PASSES: '정찰하는 동안에도 시간은 흐릅니다.',

    // --- 2026-09 D2: 전투 후 밀어붙이기 / 숨 고르기 ---
    POST_COMBAT_CHOICE_TITLE: '다음 한 걸음',
    POST_COMBAT_PUSH_CHOICE: '밀어붙인다',
    POST_COMBAT_PUSH_BUFF_NAME: '맹공의 기세',
    POST_COMBAT_BREATHER_CHOICE: '숨을 고른다',
    POST_COMBAT_PUSH_DETAIL: (pct: number, turns: number) => `다음 전투 ${turns}턴 공격력 +${pct}% · 보스가 더 빨리 다가옵니다`,
    POST_COMBAT_BREATHER_DETAIL: (pct: number) => `생명 ${pct}% 회복 · 연속 처치가 끊깁니다`,
    POST_COMBAT_PUSH_LOG: (pct: number, turns: number) => `숨 돌릴 틈 없이 밀어붙입니다. 다음 전투 ${turns}턴 동안 공격력 +${pct}%.`,
    POST_COMBAT_PUSH_GAUGE_LOG: '거칠어진 발소리를 따라 보스의 기척이 한 걸음 가까워집니다.',
    POST_COMBAT_BREATHER_LOG: (health: number) => `자리를 잡고 숨을 고릅니다. 생명 +${health} 회복, 연속 처치는 여기서 끊깁니다.`,

    // --- H4 (Wave 3 감사): 엔진/리듀서/탐험 계층의 하드코딩 한국어 회수 ---
    //   문구는 이전과 한 글자도 다르지 않다 — 소유만 MSG로 옮긴다.
    COMBAT_BLIND_MISS: '[실명] 공격이 빗나갔습니다!',
    COMBAT_FEAR_FLINCH: '[공포] 두려움에 움츠립니다!',
    RETURN_SUPPLY_DELIVERED: '귀환 보급 지급 · 하급 체력 물약 1개',
    EXPLORE_KEY_EVENT: '💎 [잊혀진 열쇠]가 빛나며 숨겨진 <고대 보물고> 입구가 열립니다!',
    EXPLORE_RELIC_DISCOVERED: '✨ [유물 발견] 고대의 기운이 느껴집니다! 유물을 선택하세요.',
    EXPLORE_ANOMALY: (desc: string) => `[기상 이변] ${desc}`,
    EXPLORE_ANOMALY_POISON: '자욱한 독안개가 밀려옵니다! (중독)',
    EXPLORE_ANOMALY_MANA_REGEN: '강력한 마력의 폭풍이 붑니다. (MP 30% 회복)',
    EXPLORE_ANOMALY_BURN: '피부를 찌르는 산성비가 내립니다. (화상)',
    EXPLORE_CHAIN_EVENT: (label: string, desc: string) => `📜 [${label}] ${desc}`,
    // --- 2026-09 Wave 3 I: 이벤트 결과 어휘 확장 (유물 / 상태이상 / 정예 / 버프) ---
    // 이벤트 outcome이 ±골드를 넘어 분기할 때의 로그. 모델·풀 어느 쪽에서 왔든
    //   aiEventUtils.normalizeOutcomes를 통과한 값만 여기로 온다.
    EVENT_RELIC_CHOICE: (count: number) => (
        count > 1
            ? `기묘한 기운이 남았습니다. 유물 선택지 ${count}개가 열렸습니다.`
            : '기묘한 기운이 남았습니다. 유물 하나를 고를 수 있습니다.'
    ),
    EVENT_STATUS_APPLIED: (effect: string, turns: number) => {
        const label = effect === 'poison' ? '중독'
            : effect === 'burn' ? '화상'
            : effect === 'bleed' ? '출혈'
            : effect === 'curse' ? '저주'
            : effect;
        return `[${label}] 선택의 흔적이 몸에 남았습니다. 다음 전투에서 ${turns}턴 동안 따라붙습니다.`;
    },
    EVENT_BUFF_NAME: '고조된 기세',
    EVENT_BUFF_APPLIED: (attackPercent: number, defensePercent: number, turns: number) => {
        const parts = [
            attackPercent > 0 && `공격력 +${attackPercent}%`,
            defensePercent > 0 && `방어력 +${defensePercent}%`,
        ].filter(Boolean).join(' · ');
        return `기세가 올랐습니다. 다음 전투 ${turns}턴 동안 ${parts}.`;
    },
    EVENT_ELITE_AMBUSH: '기척이 짙어집니다 — 정예가 앞을 막아섰습니다.',
    // --- I4 (2026-09 Wave 3): eventActions 하드코딩 한국어 회수 (출력 문구는 모두 동일) ---
    CHAIN_REWARD_STAT_LABEL: { atk: '공격력', def: '방어력', hp: '생명', mp: '기력' } as Record<string, string>,
    CHAIN_REWARD_STAT_BONUS: (parts: string) => `이야기 보상 · ${parts}`,
    CHAIN_REWARD_COMBAT_BONUS_NAME: '기사의 혼령',
    ELITE_ENEMY_PREFIX: '정예',
    ELITE_ENEMY_NAME: (baseName: string) => `정예 ${baseName}`,
    // --- Wave 4 O2: 유물 선택 추천 사유 (빌드 공명 추첨과 표기를 맞춘다) ---
    //   '현재 성장 보완'은 이제 실제로 현재 빌드가 굴리는 효과일 때만 쓴다.
    //   빌드와 무관한 후보는 아래 문구로 구분해 "왜 추천됐는지"가 어긋나지 않게 한다.
    RELIC_REASON_NEW_DIRECTION: '새로운 성장 방향',

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.actions.ts.
    // 문구는 이전과 한 글자도 다르지 않다 — 소유만 MSG로 옮긴다.
    // COMBAT_TAG_CRIT('치명타', 태그용)은 기존 COMBAT_CRIT('치명타!', 단독 로그용)과
    // 문구가 달라 재사용하지 않는다 — 느낌표 유무로 별개 문구.
    COMBAT_TAG_CRIT: '치명타',
    COMBAT_TAG_GUARD_BREAK: '방어 격파',
    COMBAT_TAG_ELEMENT_WEAK: '속성 약점',
    COMBAT_TAG_ELEMENT_RESIST: '속성 저항',
    COMBAT_TAG_DOUBLE_STRIKE: (bonus: number) => `연격 +${bonus}`,
    COMBAT_TAG_ARMOR_IGNORE: '방어 무시',
    COMBAT_TAG_COMBO: '연속 베기',
    COMBAT_TAG_VOID_HEART: '허공 각성',
    HELL_REAPER_LABEL,
    VAMPIRE_LORD_LABEL,
    RELIC_LIFESTEAL_PROC: (isHellReaper: boolean, steal: number) => (
        `[${isHellReaper ? HELL_REAPER_LABEL : VAMPIRE_LORD_LABEL}] +${steal} HP 흡혈!`
    ),
    RELIC_EXECUTE_PROC: '[처형자의 날] 처형 피해!',
    RELIC_COMBO_PROC: '[연격의 반지] 축적된 연격이 폭발했습니다!',
    RELIC_VOID_HEART_PROC: '[허공의 심장] 허공 각성 일격!',
    RELIC_EXECUTE_ATK_PROC: '[예언의 돌판] 예언 처형! 피해 2배!',
    RELIC_ECHO_ATK_PROC: '[공허의 메아리] 강화된 공격!',
    RELIC_FREEZE_ON_HIT: (enemyName: string | undefined) => `[동결의 닻] ${enemyName} 빙결!`,
    SKILL_BLIND_MISS: '[실명] 스킬이 빗나갔습니다!',
    SKILL_ENEMY_STATUS_APPLIED: (skillName: string | undefined, enemyName: string | undefined, label: string) => (
        `[${skillName}] ${enemyName}에게 [${label}] 부여!`
    ),
    SKILL_BRANCH_STATUS_APPLIED: (enemyName: string | undefined, label: string) => (
        `[분기 효과] ${enemyName}에게 [${label}] 추가 부여!`
    ),
    SKILL_DRAIN_HEAL: (heal: number) => `[생명흡수] +${heal} HP 흡수!`,
    SKILL_HP_REGEN_PROC: (skillName: string | undefined, heal: number) => `[${skillName}] +${heal} HP 회복!`,
    SKILL_MP_REGEN_PROC: (skillName: string | undefined, amount: number) => `[${skillName}] +${amount} MP 회복!`,
    SKILL_PURIFY_PROC: (skillName: string | undefined) => `[${skillName}] 상태이상이 정화되었습니다!`,
    SKILL_STEALTH_PROC: (skillName: string | undefined) => `[${skillName}] 다음 적 공격을 회피합니다!`,
    RELIC_TIME_MASTER_EXTRA_TURN: '[시간 지배자] 시간이 멈춥니다 — 추가 행동!',
    RELIC_ECHO_ATK_ARMED: '[공허의 메아리] 다음 공격이 강화됩니다!',
    SKILL_CRIT_COOLDOWN_RESET: '[인과율 조작] 치명타! 모든 쿨타임 -1.',
    RELIC_FIRST_SKILL_FREE: '[시간 군주의 왕관] 첫 스킬 MP 무소비!',
    RELIC_FREE_SKILL_PROC: '[주문 메아리] MP 소모 없음!',
    RELIC_SKILL_LIFESTEAL_PROC: (heal: number) => `[영혼 흡수] +${heal} HP`,
    RELIC_SKILL_MULT_PROC: '[정신 연소] 스킬 피해 강화!',
    RELIC_DOT_MULT_PROC: '[죽음의 낙인] 지속 피해가 증폭됩니다!',

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.enemyAI.ts.
    STEALTH_EVADE_PROC: (enemyName: string | undefined) => `[은신] ${enemyName}의 공격을 회피했습니다!`,
    ARMOR_EVADE_PROC: (enemyName: string | undefined) => `[회피] ${enemyName}의 공격을 회피했습니다!`,
    ENEMY_PHASE_STATUS_APPLIED: (phase: number, label: string) => `[Phase ${phase}] [${label}] 상태이상 부여!`,
    ANCIENT_SEAL_RESIST: '[고대의 봉인] 상태이상을 저항했습니다!',
    CRIT_BLOCK_PROC: '[강철 의지] 강타를 흘려냈습니다!',
    REFLECT_DAMAGE_PROC: (dmg: number) => `[반사] 반사 피해 ${dmg}!`,
    ABSOLUTE_REFLECT_STUN_PROC: '[절대 반사] 반사 충격으로 적이 기절!',
    ENEMY_ATK_REDUCED_STATUS: (label: string, enemyName: string | undefined) => (
        `[${label}] ${enemyName}의 공격력이 감소합니다!`
    ),
    PLAYER_CURSE_DMG_AMP: (pct: number, before: number, after: number) => (
        `[저주] 받는 피해 +${pct}% (${before} → ${after})`
    ),
    TITAN_CRIT_REDUCE_PROC: (pct: number, before: number, after: number) => (
        `[타이탄의 허리띠] 강타 피해 -${pct}% (${before} → ${after})`
    ),
    ENEMY_HEAVY_STATUS_ON_HIT: (enemyName: string | undefined, label: string) => (
        `[${enemyName}] 강타 — [${label}] 상태이상 부여!`
    ),
    PLAYER_COUNTER_PROC: (buffName: string, enemyName: string | undefined, dmg: number) => (
        `[${buffName}] 반격! ${enemyName}에게 ${dmg} 피해!`
    ),
    ENEMY_TELEGRAPH_STUNNED: '기절 중 — 행동 불가',
    ENEMY_TELEGRAPH_PHASE2_IMMINENT: (formName?: string) => `⚡ Phase 2 임박 — ${formName || '형태 변환'}`,
    ENEMY_TELEGRAPH_GUARD_HIGH: (pct: number) => `방어 태세 (${pct}%)`,
    ENEMY_TELEGRAPH_HEAVY_HIGH: (pct: number) => `맹공 준비 (${pct}%)`,
    ENEMY_TELEGRAPH_GUARD_MED: (pct: number) => `방어 가능 (${pct}%)`,
    ENEMY_TELEGRAPH_HEAVY_MED: (pct: number) => `맹공 주의 (${pct}%)`,
    ENEMY_TELEGRAPH_NORMAL: '일반 공격 예상',

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.status.ts.
    ENEMY_DOT_TICK: (label: string, enemyName: string | undefined, dmg: number) => (
        `[${label}] ${enemyName}에게 ${dmg} 지속 피해!`
    ),
    ENEMY_CURSE_DOT_TICK: (enemyName: string | undefined, dmg: number) => `[저주] ${enemyName}에게 ${dmg} 저주 피해!`,

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.relics.ts.
    RELIC_CRIT_MP_RESTORE: (amount: number) => `[피의 갈증] +${amount} MP`,
    RELIC_HEAL_ON_SAVE_PROC: (bonus: number) => `[난공불락] 부활 시 +${bonus} HP 회복!`,
    RELIC_DEATH_SAVE_REVIVE: (count: number) => `[절대 불사] ${count}회 부활!`,
    RELIC_DEATH_SAVE_FIRST: '[불사의 의지] 치명상을 버텼습니다!',
    RELIC_VOID_HEART_REVIVE: '[허공의 심장] 죽음을 거부했습니다. 다음 공격이 강화됩니다!',
    RELIC_REVIVE_TOKEN_USED: '[에테르 부활석] 저장된 에테르가 생명과 기력을 절반까지 되돌렸습니다.',
    RELIC_PHOENIX_REVIVE: (hp: number, atkPercent: number, duration: number) => (
        `[불사조의 깃털] 재의 잿더미에서 부활! +${hp} HP, ATK +${atkPercent}% (${duration}턴)`
    ),
    ENTROPY_LABEL_GOD: '엔트로피의 신',
    ENTROPY_LABEL_BRAND: '엔트로피 낙인',
    ENTROPY_LABEL_ENGINE: '엔트로피 엔진',
    ENTROPY_TICK_PROC: (label: string, enemyName: string | undefined, dmg: number) => (
        `[${label}] 시간 무게 — ${enemyName} 고정 피해 ${dmg}!`
    ),

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.outcome.ts.
    FIRST_BOSS_REWARD_HINT_FALLBACK: '초회 토벌 보너스를 확보했습니다.',
    KILL_STACK_SOURCE_RELIC: '[허공의 왕좌]',
    KILL_STACK_SOURCE_SYNERGY: '[시너지 처형 분노]',

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.ts.
    RELIC_TURN_MP_REGEN: (val: number) => `[비전 서지] +${val} MP`,
    RELIC_TURN_HP_REGEN: (label: string | undefined, heal: number) => `[${label}] +${heal} HP 재생`,
    RELIC_LABEL_EARTH_HEART: '대지의 심장',
    RELIC_LABEL_ETERNAL_LIFE: '영원의 생명',
    RELIC_LABEL_GENESIS_CORE: '창세의 핵',
    RELIC_LABEL_ETERNAL_FORTRESS: '영원의 요새',
    RELIC_HP_DRAIN_ATK_COST: (label: string | undefined, dmg: number) => `[${label}] HP 대가 -${dmg}`,

    // 2026-09 Wave 6 X2: systems 이관 — DifficultyManager.ts.
    // cycle 116에서 "0건 사용"으로 제거됐던 GM 톤 메시지를 다시 들인다 — DifficultyManager가
    // 자체 inline string으로 처리하던 걸 MSG 소유로 옮기는 것뿐, 새 기능은 아니다.
    DIFFICULTY_LABEL_OVERWHELM: '압도',
    DIFFICULTY_LABEL_ADVANTAGE: '우세',
    DIFFICULTY_LABEL_BALANCED: '균형',
    DIFFICULTY_LABEL_CLOSE: '박빙',
    DIFFICULTY_LABEL_DISADVANTAGE: '열세',
    DIFFICULTY_LABEL_CRISIS: '위기',
    DIFFICULTY_LABEL_BEGINNER_GRACE: '신입 보호',
    DIFFICULTY_GM_OVERWHELM: '⚔️ [GM] 당신의 기세가 압도적입니다 — 약간의 긴장과 함께 보상이 크게 늘어납니다.',
    DIFFICULTY_GM_CRISIS: '🛡️ [GM] 잠시 숨을 고를 시간입니다. 몬스터가 약해집니다.',
    DIFFICULTY_GM_DISADVANTAGE: '🛡️ [GM] 어려운 상황이군요. 몬스터 강도를 낮춥니다.',

    // 2026-09 Wave 6 X2: systems 이관 — combatActionTurn.ts / combatItemTurn.ts.
    LOCATION_UNKNOWN_FALLBACK: '알 수 없는 곳',
    ENEMY_NAME_FALLBACK: '적',

    // 2026-09 Wave 6 X2: systems 이관 — FeedbackValidator.ts (피드백 폼 검증 메시지).
    FEEDBACK_MIN_LENGTH: (min: number) => `최소 ${min}자 이상 입력해주세요.`,
    FEEDBACK_MAX_LENGTH: (max: number) => `${max}자를 초과할 수 없습니다.`,
    FEEDBACK_RATE_LIMITED: (waitSeconds: number) => `잠시 후 다시 시도해주세요. (${waitSeconds}초)`,

    // 2026-09 Wave 6 X2: systems 이관 — TokenQuotaManager.ts (AI 이벤트 일일 한도 초과 안내).
    AI_QUOTA_EXHAUSTED: '⚡ 에테르니아의 마력이 소진되었습니다. 내일 다시 시도해주세요.',
    // 2026-09 Wave 12 D3: 쿼터는 '디스패치' 미터다 — 프록시로 나간 요청은 응답이 깨졌거나
    //   최근 본 이야기와 겹쳐 버려져도 한 건을 쓴다. 채택되지 못한 호출이 있을 때만 이 문구로
    //   바꿔, 소진 안내가 "50번을 썼는데 이야기는 몇 번이었는지"를 함께 말하게 한다.
    AI_QUOTA_EXHAUSTED_LEDGER: (adopted: number, dispatched: number) =>
        `⚡ 에테르니아의 마력이 소진되었습니다. 오늘 보낸 부름 ${dispatched}번 중 ${adopted}번이 이야기로 돌아왔습니다. 내일 다시 시도해주세요.`,

    // 2026-09 Wave 6 X2: systems 이관 — consumableEffect.ts (아이템 이름 결손 시 표시용 폴백).
    CONSUMABLE_NAME_FALLBACK: '소모품',

    // 2026-09 Wave 12 D2: 시즌 여정 회전 (완주 → 다음 시즌).
    SEASON_NAME: (ordinal: number) => `시즌 ${ordinal}`,
    SEASON_SUBTITLE: '평소의 모험이 성장으로 이어집니다',
    /** 완주 로그 — 리셋 직전에 남긴다. */
    SEASON_ROTATED: (completedName: string, nextName: string, scale: string) => (
        `${completedName} 완주! ${nextName}이 열렸습니다 · 보상 규모 ×${scale}`
    ),
    SEASON_ROTATION_TITLE: '시즌이 끝나면',
    /** 완주 안내 — 남은 수령 수와 다음 시즌 보상 배율을 함께 보여준다. */
    SEASON_ROTATION_NOTICE: (nextName: string, scale: string) => (
        `30단계 보상을 모두 받으면 ${nextName}이 열립니다 · 숫자 보상 ×${scale}`
    ),
    SEASON_CLAIMS_REMAINING: (remaining: number) => `완주까지 남은 보상 ${remaining}개`,
    SEASON_CLAIMS_READY: '마지막 보상을 받으면 다음 시즌이 시작됩니다',
    SEASON_SCALE_BADGE: (scale: string) => `보상 ×${scale}`,
    SEASON_ARCHIVE_TITLE: '지난 시즌 기록',
    SEASON_ARCHIVE_EMPTY: '아직 완주한 시즌이 없습니다',
    SEASON_ARCHIVE_SUMMARY: (count: number) => `완주 ${count}회`,
    SEASON_ARCHIVE_ENTRY: (name: string, claimedCount: number) => (
        `${name} · 보상 ${claimedCount}개 수령`
    ),

    // 2026-09 Wave 13 E2: 지역의 선언 레벨과 실제 진입 레벨(경로 게이트)이 갈라지는 10곳.
    //   선언 레벨은 그 지역 자신의 잠금(`getMapAccess`가 비교하는 값)이고, 경로 게이트는
    //   시작의 마을에서 실제로 걸어 들어갈 수 있게 되는 레벨이다(`utils/mapRouteGate.ts`).
    //   표시만 정직하게 하고 잠금 자체는 바꾸지 않는다 — 그래서 문구가 둘을 함께 말한다.
    MAP_ROUTE_GATE_LEVEL: (routeLevel: number) => `실제 진입 레벨 ${routeLevel}`,
    MAP_ROUTE_GATE_NOTE: (declaredLevel: number, routeLevel: number) => (
        `이 지역의 잠금은 레벨 ${declaredLevel}이지만, 여기로 이어지는 모든 길이 더 높은 지역을 지나 실제 진입은 레벨 ${routeLevel}부터입니다.`
    ),
    /** 무한 심연 — `level: 'infinite'`은 NaN 비교라 지역 자체에는 레벨 잠금이 아예 없다. */
    MAP_ROUTE_GATE_NOTE_UNGATED: (routeLevel: number) => (
        `이 지역 자체에는 레벨 잠금이 없지만, 여기로 이어지는 모든 길이 더 높은 지역을 지나 실제 진입은 레벨 ${routeLevel}부터입니다.`
    ),

    // Wave 19 K2
    /** `openArchive`가 허용 상태 화이트리스트 밖에서 거부할 때(예: 전투 중 복귀 브리핑 버튼). */
    ARCHIVE_BLOCKED: '지금 상태에서는 아카이브를 열 수 없습니다.',
};
