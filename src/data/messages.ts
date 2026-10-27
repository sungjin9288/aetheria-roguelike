// cycle 321: unused DB import 제거 — messages.ts 어디에서도 DB 참조 0건.

import type { StatusId } from '../types/index.js';
import { josa, repickJosa, withJosa } from './koreanParticles.js';

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
// 2026-10 Wave 130: 생명을 바치는 공격 유물의 기록 표지 — 기록을 찾는 감사(`relicHpDrainAtkAudit`)가 같은 낱말을 읽는다.
const HP_DRAIN_ATK_COST_MARKER = '생명 대가';
// 2026-10 Wave 61 (원장 §61.3): 합성 보호 상품의 이름 하나 — 크리스털 교환 · 구매 로그 · 합성 화면이 "합성 보호권" ·
// "합성 보호석" · "보호권" 세 이름을 쓰고 있었다. 아래 SYNTHESIS_PROTECT_TOKEN_COST가 재사용하므로 top-level const로 둔다.
const SYNTHESIS_PROTECT_ITEM_NAME = '합성 보호권';
// 2026-10 Wave 62 (원장 §61.4 C16): 숫자 뒤 조사 — 금액을 실제로 받는 값('빈손의 시작'이면 절반)으로 다시 적을 때 조사가 따라
//   바뀐다("골드 70을" → "골드 35를"). 숫자의 끝소리는 끝자리로 정해진다: 0(십 · 백 · 천 · 만) · 1(일) · 3(삼) · 6(육) · 7(칠) ·
//   8(팔)은 받침이 있고 2 · 4 · 5 · 9는 없다. `MSG.NUMBER_PARTICLE`이 내보낸다(Wave 136에 첫 출발 안내 문구와 함께 이 파일 안 사용처가 사라졌다).
// 2026-10 Wave 130: 판정은 `koreanParticles.ts` 하나다 — 이 파일에 따로 있던 끝자리 표(Wave 129가 놓친 두 번째 판정기)를 지웠다.
const NUMBER_PARTICLE_PAIRS = [['을', '를'], ['이', '가'], ['은', '는'], ['과', '와']] as const;
const numberParticle = (particle: string, amount: number): string => repickJosa(amount, particle);

export const MSG = {
    // --- 전투 (Combat) ---
    // cycle 116: COMBAT_ATTACK 제거 — COMBAT_ATTACK_DETAIL이 active.
    COMBAT_ATTACK_DETAIL: (name: string | undefined, dmg: number, cur: number, max: number | undefined, tags: string[]) =>
        `${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    COMBAT_ENEMY_HIT: (name: string | undefined, dmg: number, rng: () => number = Math.random) => {
        const variants = [
            `${withJosa(name, '이/가')} ${dmg} 피해를 가했습니다.`,
            `${name}의 공격! ${dmg} 피해를 받았습니다.`,
            `${name}에게 가격당했습니다. (${dmg})`,
        ];
        return variants[Math.floor(rng() * variants.length)];
    },
    COMBAT_ENEMY_HEAVY_HIT: (name: string | undefined, dmg: number, rng: () => number = Math.random) => {
        const variants = [
            `${name}의 강타! ${dmg} 피해를 입었습니다.`,
            `${withJosa(name, '이/가')} 맹렬하게 공격합니다! ${dmg} 피해!`,
            `강력한 일격! ${name}의 공격에 ${dmg} 피해를 받았습니다.`,
        ];
        return variants[Math.floor(rng() * variants.length)];
    },
    COMBAT_ENEMY_GUARD: (name: string | undefined) => `${withJosa(name, '이/가')} 방어 자세를 취했습니다.`,
    COMBAT_ENEMY_STUNNED: (name: string | undefined) => `${withJosa(name, '이/가')} 기절하여 턴을 잃습니다.`,
    COMBAT_CRIT: '치명타!',
    // 게임 필 감사 GF-02: 처치 순간 쓰러진 적 위에 찍는 도장.
    COMBAT_DEFEATED_STAMP: '처치',
    // 게임 필 감사 GF-11: 화면 낭독기가 읽는 이번 차례 요약(눈에 보이지 않는 알림 영역) — 조각을 ' · '로 잇는다.
    COMBAT_FEEDBACK_ENEMY_DAMAGE: (dmg: number, crit: boolean) => `${crit ? '치명타 · ' : ''}적에게 ${dmg} 피해`,
    COMBAT_FEEDBACK_KILL: (name: string) => `${name} 처치`,
    COMBAT_FEEDBACK_PLAYER_DAMAGE: (dmg: number, heavy: boolean) => `${heavy ? '강타 · ' : ''}${dmg} 피해 받음`,
    COMBAT_FEEDBACK_PLAYER_HEAL: (amount: number) => `생명 ${amount} 회복`,
    COMBAT_FEEDBACK_DEFEAT: '쓰러졌습니다',
    COMBAT_FEEDBACK_SEPARATOR: ' · ',

    // --- 스킬 (Skill) ---
    // slice 19: tags 추가 — 치명타/약점/저항을 본문에 통합 (COMBAT_ATTACK_DETAIL 동일 패턴)
    // 소유자 결정 D27(2026-10-26): 머리표 뒤 쌍점을 뺀다 — "[강타]: 숲 요정에게" → "[강타] 숲 요정에게"(다른 기술 줄과 같은 모양).
    SKILL_USE: (skillName: string | undefined, dmg: number, name: string | undefined, cur: number, max: number | undefined, tags: string[]) =>
        `[${skillName}] ${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    // 2026-10 Wave 52: 위력이 없는 보조 기술은 피해 줄 대신 사용 줄을 남긴다(효과 줄은 뒤따른다).
    SKILL_USE_SUPPORT: (skillName: string | undefined) => `[${skillName}] 사용!`,
    // 2026-10 Wave 53: 생명을 바치는 기술 · 다음 공격 강화 소진.
    SKILL_HP_COST: (skillName: string, cost: number) => `[${skillName}] 계약의 대가로 생명 ${withJosa(cost, '을/를')} 바쳤습니다.`,
    SKILL_NEXT_ATTACK_ARMED: (skillName: string, mult: number) => `[${skillName}] 다음 공격의 피해가 ${mult}배가 됩니다.`,
    NEXT_ATTACK_MULT_PROC: (mult: number) => `그림자 일격! 피해 ${mult}배`,
    SKILL_BUFF_ACTIVE: (name: string, turns: number) => `${name} 강화 효과가 ${turns}턴 동안 적용됩니다.`,
    // 2026-10 Wave 130: 지속 피해 라벨(`DOT_LABELS`)을 받는다 — 효과 키(bleed · burn)가 그대로 찍혔다.
    SKILL_STATUS_BONUS: (dotLabel: string, dmg: number) => `[${dotLabel}] 추가 피해 +${dmg}`,
    SKILL_NO_MP: '기력이 부족합니다.',
    SKILL_ON_COOLDOWN: (name: string, turns: number) => `${name} 재사용까지 ${turns}턴 남았습니다.`,
    SKILL_NONE: '사용 가능한 기술이 없습니다.',

    // --- 탈출 (Escape) ---
    ESCAPE_SUCCESS: '성공적으로 탈출했습니다!',
    ESCAPE_FAIL: '탈출 실패!',
    ESCAPE_FAIL_DMG: (name: string | undefined, dmg: number) => `${withJosa(name, '이/가')} 뒤쫓아 ${dmg} 피해를 입혔습니다.`,

    // --- 전투 결과 (Victory / Defeat) ---
    VICTORY: (exp: number, gold: number) => `승리했습니다. 경험 +${exp} · 골드 +${gold}`,
    FIRST_BOSS_GOLD: (gold: number) => `첫 보스 토벌 보상 · 골드 +${gold}`,
    BLOOD_OATH_HEAL: (health: number) => `피의 서약으로 생명을 ${health}만큼 회복했습니다.`,
    WORLD_DEVOUR_HEALTH: (health: number) => `세계 포식자가 영혼을 흡수했습니다. 다음 전투 한 번의 기본 최대 생명과 현재 생명이 ${health}만큼 늘어납니다.`,
    IMMORTAL_WARRIOR_HEAL: (health: number) => `불멸의 전사 효과로 생명을 ${health}만큼 회복했습니다.`,
    INFINITE_DEVOUR_HEAL: (health: number) => `무한 포식 효과로 생명을 ${health}만큼 회복했습니다.`,
    STAR_CORE_RESTORE: '별의 핵이 기력을 모두 회복했습니다.',
    LOOT_GET: (name: string) => `전리품: ${name}`,
    // 2026-10 Wave 67: 같은 전리품은 묶어서 보인다(utils/lootSummary.ts) — "벌레 껍질 · 벌레 껍질"이 "벌레 껍질 x2"가 된다.
    LOOT_STACK: (name: string, count: number) => (count > 1 ? `${name} x${count}` : name),
    LOOT_SUMMARY_MORE: (count: number) => ` 외 ${count}`,
    // 2026-09 Wave 39: 후반 강화 재료 드롭 — 도감 소재 기록의 획득처는 몬스터별 전리품 표만 읽으므로(적 레벨 규칙은 표 밖) 이 규칙을 따로 알린다.
    CODEX_ENHANCE_MATERIAL_LATE_SOURCE: (level: number) => `레벨 ${level} 이상 지역의 적에게서도 드물게 얻습니다 · 보스는 더 자주`,
    LOOT_PREFIX: (name: string) => `접두사 부여: [${name}]`,
    PRESTIGE_RARE_DROP: (name: string) => `✦ [심연의 메아리] 보스가 희귀 장비를 떨어뜨렸습니다: ${name}`,
    SIGNATURE_DISCOVERED: (name: string) => `✦ 전설 각인 ─ ${name} 획득!`,
    // 2026-10 Wave 134: 전설 각인 획득 화면 · 전투 결과 카드의 머리말 — 영어 'Legendary'였다.
    SIGNATURE_DROP_LABEL: '전설 각인',
    SIGNATURE_DROP_CODEX_NOTE: '도감에 기록됨',
    // 2026-10 Wave 134: 시즌 이벤트 띠의 보너스 — 경험은 영어 약어 'XP'였다(옆의 골드는 한국어).
    SEASON_EVENT_GOLD_BONUS: (pct: number) => `골드 +${pct}%`,
    SEASON_EVENT_EXP_BONUS: (pct: number) => `경험 +${pct}%`,
    COMBAT_LOOT_CAPACITY_BLOCKED: (count: number) => `가방이 가득해 전리품 ${count}개를 챙기지 못했습니다.`,
    SIGNATURE_SELL_BLOCKED: (name: string | undefined) => `[${name}]${josa(name, '은/는')} 전설 각인 아이템이라 판매할 수 없습니다.`,
    SIGNATURE_SYNTH_BLOCKED: (name: string) => `[${name}]${josa(name, '은/는')} 전설 각인 아이템이라 합성 재료로 사용할 수 없습니다.`,
    SIGNATURE_BOSS_HINT: (bossName: string, count: number, topName: string, topPct: number | string) => (
        count > 1
            ? `✦ [${bossName}] 전설 각인 ${count}종 드롭 가능 — 최고 [${topName}] ${topPct}%`
            : `✦ [${bossName}] 전설 각인 [${topName}] 드롭 가능 — ${topPct}%`
    ),
    SIGNATURE_PITY_RESONANCE: (pct: number | string, pity: number | undefined) => `✦ 각인 공명 +${pct}% — 보스 ${pity}회 연속 무획득 보정 적용`,
    // fix/signature-set-two-hand: 양손 시그니처 무기가 세트 카운트에 2피스로 반영됐을 때
    // EquipmentPanel "세트 진행도" 카드에 표시하는 힌트 1줄.
    SIGNATURE_SET_TWO_HAND_HINT: '💡 양손 무기는 보조 칸을 함께 차지해 2피스로 계산됩니다.',
    OUTFIT_SET_TWO_HAND_SLOT: '양손 무기가 함께 사용',
    OUTFIT_SET_TWO_HAND_HINT: '양손 무기는 보조 장비 칸까지 2피스로 계산됩니다.',
    // 2026-10 Wave 58: 직업 장비 세트 "다음 단계" 안내 — 문구를 보너스 표에서 만든다(생명 · 기력 보너스가 빠져 있었다).
    OUTFIT_BONUS_LABELS: { atk: '공격력', def: '방어력', hp: '최대 생명', mp: '최대 기력' },
    OUTFIT_NEXT_STEP_HINT: (stage: string, parts: string) => `1개 더 맞추면 ${stage} 효과 (${parts})`,
    OUTFIT_STAGE_PARTIAL2: '2단계',
    OUTFIT_STAGE_FULL: '풀세트',
    LEGACY_ESSENCE: (n: number) => `계승 정수 +${n}`,
    // 2026-10 Wave 130: 처치 정수가 올리는 단계는 정수 사다리다 — "계승 단계"는 계승(회차) 단계의 이름이라 둘이 겹쳤다.
    LEGACY_RANK: (n: number) => `정수 사다리 ${n}단계 달성`,
    // 2026-07 — 에테르 거울: revive 노드(런당 1회 치명상 부활) 발동 로그.
    MIRROR_REVIVE: '[에테르 수호] 거울의 가호가 치명상을 막아냈습니다!',
    MIRROR_PURCHASE: (name: string, newLevel: number, cost: number) => `에테르 거울에 ${name} ${newLevel}단계를 새겼습니다. 계승 정수 -${cost}`,
    // 2026-10 Wave 96: 끝없는 거울 — 거울 8노드를 다 채운 뒤 비용이 오르는 작은 영구 능력치.
    MIRROR_ENDLESS_PURCHASE: (name: string, newLevel: number, cost: number, stat: string, gain: number) => (
        `에테르 거울에 ${name} ${newLevel}단계를 새겼습니다. ${stat} +${gain} · 계승 정수 -${cost}`
    ),
    MIRROR_ENDLESS_STAT_LABELS: { atk: '영구 공격력', hp: '영구 생명', mp: '영구 기력' } as const,
    MIRROR_ENDLESS_PATH_LABEL: '끝없는',
    MIRROR_ENDLESS_PATH_SUMMARY: '거울을 모두 채운 뒤에도 계승 정수로 영구 능력치를 조금씩 새깁니다. 비용은 단계마다 오르다가 상한에서 멈추고, 능력치마다 새길 수 있는 단계에는 한계가 있습니다.',
    MIRROR_ENDLESS_EFFECT: (stat: string, total: number) => (total > 0 ? `거울로 새긴 ${stat} +${total}` : `거울로 새긴 ${stat} 없음`),
    MIRROR_ENDLESS_LOCKED: '거울 8가지 성장을 모두 채우면 열립니다',
    MIRROR_ENDLESS_LEVEL: (level: number, maxLevel: number) => `${level}/${maxLevel}단계`,
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
    START_BOOT_RELIC: '새 여정의 유물 선택지가 열렸습니다. 지금 고르지 않아도 여정 중에 다시 발견할 수 있습니다.',

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
    SYNTHESIS_PROTECT_ITEM_NAME,
    /** 합성 화면의 보호 비용 줄 — 보호권을 가지고 있을 때. */
    SYNTHESIS_PROTECT_TOKEN_COST: (owned: number) => `${SYNTHESIS_PROTECT_ITEM_NAME} 1개 · 보유 ${owned}개`,
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
    ENHANCE_NO_MATERIAL: (name: string, count: number) => `${withJosa(name, '이/가')} 부족합니다. (필요: ${count}개)`,
    ENHANCE_NOT_EQUIP: '강화는 장비 아이템에만 가능합니다.',

    // --- 주간 미션 (Weekly Mission) ---
    // cycle 116: WEEKLY_MISSION_COMPLETE/RESET 제거 — 0건 사용. CLAIM만 active.
    WEEKLY_MISSION_CLAIM: (gold: number, crystals?: number) => `주간 보상 · 골드 +${gold}${crystals ? ` · 에테르 크리스탈 +${crystals}` : ''}`,

    // --- 도전 설정 ---
    // cycle 116: CHALLENGE_COMPLETE 제거 — 0건 사용. START만 active.
    CHALLENGE_START: (labels: string[]) => `⚔ 도전 여정 시작: ${labels.join(', ')}`,
    // 2026-10 Wave 62 (원장 §61.4 C1): 도전 규칙 선택 화면 — 보상 "+N%"는 엔진 표(`BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT`)에서
    //   계산하고, 오르는 것이 전투 경험치 · 골드임을 말한다(이전 "+N% 보상"은 무엇이 오르는지 말하지 않았다).
    CHALLENGE_PICKER_TITLE: '도전 규칙',
    CHALLENGE_PICKER_SELECT: '선택',
    CHALLENGE_PICKER_HINT: '더 어려운 규칙에는 더 큰 보상이 따릅니다.',
    CHALLENGE_PICKER_REWARD: (percent: number) => `전투 경험 · 골드 +${percent}%`,

    // --- 진 엔딩 (True Ending) ---
    // cycle 116: TRUE_BOSS_PHASE3 제거 — 0건 사용. UNLOCK/APPEAR만 active.
    TRUE_BOSS_UNLOCK: '세계의 근원이 흔들립니다... 숨겨진 문이 열렸습니다!',
    TRUE_BOSS_APPEAR: '원시의 신이 강림했습니다. 이것이 진짜 끝입니다.',
    PRIMAL_SHARD_DROP: (count: number) => `원시의 파편 획득! (${count}/3)`,
    // 2026-10 Wave 89 (소유자 결정 §93.4 b + 콜렉터): 회차 규칙 — 계승 단계마다 이름 있는 규칙 하나(비틀기 · 표적 세트 · 정복 보상).
    ASCENSION_RULE_START: (ruleName: string, twist: string, setName: string) => `📜 회차 규칙 [${ruleName}] — ${twist} 강제 · 이번 회차 '${setName}' 각인이 더 자주 나옵니다.`,
    ASCENSION_RULE_CONQUERED: (ruleName: string) => `📜 회차 규칙 ${withJosa(`[${ruleName}]`, '을/를')} 정복했습니다.`,
    ASCENSION_RULE_CONQUEST_SIGNATURE: (itemName: string) => `정복의 전리품: ${itemName}`,
    ASCENSION_RULE_CONQUEST_COMPLETE: '모든 전설 각인을 이미 모았습니다 — 정복의 전리품은 없습니다.',
    ASCENSION_RULE_LOCKED: '회차 규칙',
    // 2026-10 Wave 91 (소유자 결정 "a, c 섞어서"): 무거운 회차 규칙 셋은 받아들일지 고른다 — 거절하면 비틀기 · 표적 · 정복 보상이 모두 없다.
    ASCENSION_RULE_OPTIONAL_HINT: '이 규칙은 거절할 수 있습니다. 거절하면 표적 각인 배율과 정복 보상이 없습니다.',
    ASCENSION_RULE_ACCEPTED: '받아들임',
    ASCENSION_RULE_DECLINED: '거절함',
    ASCENSION_RULE_DECLINED_DETAIL: '비틀기 없음 · 표적 배율 없음 · 이 단계의 정복 보상은 규칙이 다시 돌아올 때',
    ASCENSION_RULE_DECLINED_START: (ruleName: string) => `📜 회차 규칙 ${withJosa(`[${ruleName}]`, '을/를')} 거절했습니다 — 이번 회차에는 표적 각인 배율과 정복 보상이 없습니다.`,
    ASCENSION_RULE_NEXT: (ruleName: string) => `다음 회차 규칙: ${ruleName}`,
    // 2026-10 Wave 105: 겹친 규칙의 두 비틀기.
    ASCENSION_RULE_TWIST_PAIR: (first: string, second: string) => `${first} + ${second}`,
    // 2026-10 Wave 92: 선택형 규칙의 받아들임 · 거절 측정 차이(데이터 `outlook`) — 숫자만 보이고 판단은 플레이어 몫이다.
    ASCENSION_RULE_OUTLOOK_ACCEPTED: (deaths: string, signatures: string) => `받아들이면: 사망 ${deaths}회 · 새 각인 +${signatures}개 · 정복 보상`,
    ASCENSION_RULE_OUTLOOK_DECLINED: (deaths: string, signatures: string) => `거절하면: 사망 ${deaths}회 · 새 각인 +${signatures}개`,
    // 2026-10 Wave 93 · 94: 순환별 측정, 잰 단계를 밝힌다 — 카드 뽑기 뒤로는 규칙이 다른 단계에 올 수 있다.
    ASCENSION_RULE_OUTLOOK_SOURCE: (measuredRank: number, samples: number) => `그 회차 평균 · 모의 플레이 ${samples}판 · 고정 순서 계승 ${measuredRank}단계에서 잰 값`,
    // 2026-10 Wave 116: 겹친 규칙은 고정 순서가 아니라 2순환 카드 뽑기에서 잰다. Wave 123: 단계 구간마다 따로 재고 그 구간을 밝힌다.
    ASCENSION_RULE_OUTLOOK_SOURCE_STACKED: (fromRank: number, toRank: number, samples: number) => `그 회차 평균 · 모의 플레이 ${samples}판 · 2순환 카드 뽑기, 계승 ${fromRank} ~ ${toRank}단계에서 잰 값`,
    // 2026-10 Wave 126: 겹친 카드는 그 카드(두 비틀기)의 받아들임 측정이다 — 거절 쪽은 같은 규칙 · 구간의 측정이라 판 수를 따로 밝힌다.
    ASCENSION_RULE_OUTLOOK_SOURCE_STACKED_CARD: (fromRank: number, toRank: number, acceptedSamples: number, declinedSamples: number) => `그 회차 평균 · 이 두 비틀기 카드 받아들임 ${acceptedSamples}판 · 거절 ${declinedSamples}판 · 2순환 카드 뽑기, 계승 ${fromRank} ~ ${toRank}단계에서 잰 값`,
    ASCENSION_RULE_OFFER_TITLE: '다음 회차 규칙 — 카드 한 장을 고르세요',
    ASCENSION_RULE_OFFER_HINT: '이번 순환에서 아직 정복하지 않은 규칙에서 뽑았습니다. 다시 뽑으면 지금 패로 돌아올 수 없습니다.',
    // 2026-10 Wave 95: 회차 규칙 패 다시 뽑기 — 첫 번째는 무료, 그 뒤는 다음 여정으로 넘어가는 정수 사다리를 내려놓는다.
    ASCENSION_RULE_REROLL_FREE: '다시 뽑기 · 무료',
    ASCENSION_RULE_REROLL_PAID: (before: number, after: number) => `다시 뽑기 · 넘어가는 정수 사다리 ${before} → ${after}단계`,
    ASCENSION_RULE_REROLL_SPENT: '다시 뽑기를 모두 썼습니다.',
    ASCENSION_RULE_REROLL_COUNT: (count: number, max: number) => `다시 뽑음 ${count}/${max}`,
    ASCENSION_RULE_CARD_OPTIONAL: '거절 가능',
    ASCENSION_RULE_DETAIL: (twist: string, setName: string, titleName: string) => `${twist} 강제 · '${setName}' 각인 드롭 ×3 · 마왕을 쓰러뜨리면 칭호 [${titleName}] + 그 세트의 없는 각인 하나`,
    COLLECTION_SUMMARY_TITLE: '수집 완주',
    COLLECTION_SET_ROW: (setName: string, owned: number, total: number) => `${setName} ${owned}/${total}`,
    COLLECTION_CONQUEST_ROW: (owned: number, total: number) => `회차 규칙 정복 ${owned}/${total}`,
    COLLECTION_FEATURED: (ruleName: string, setName: string) => `이번 회차 [${ruleName}] · 표적 세트 '${setName}'`,
    PRIMAL_SHARD_HINT: (count: number) => `원시의 파편 ${count}/3개. 마왕을 쓰러뜨리면 진실이 드러납니다.`,

    // --- 심연 마일스톤 (Abyss Milestone) ---
    ABYSS_MILESTONE: (floor: number) => `🌀 심연 ${floor}층 마일스톤 달성!`,
    ABYSS_BOSS_APPEAR: (name: string) => `💀 심연 보스 출현: ${name}`,

    // --- 다른 차원의 묘비 (2026-10 Wave 70) — 다른 플레이어의 공개 묘비가 탐험 이벤트로 나타난다 ---
    DIMENSION_GRAVE_UNKNOWN_NAME: '이름 없는 모험가',
    DIMENSION_GRAVE_UNKNOWN_PLACE: '알 수 없는 곳',
    DIMENSION_GRAVE_TITLE: '다른 차원의 묘비',
    DIMENSION_GRAVE_DESC: (name: string, level: number, place: string, item: string) =>
        `차원의 틈 너머로 묘비 하나가 비칩니다. 다른 차원에서 쓰러진 모험가 ${name}(레벨 ${level}) · ${place}. 묘비 곁을 망령이 지키고 있습니다. 놓인 유품: [${item}]`,
    DIMENSION_GRAVE_CHOICE_INVADE: '침공 — 망령과 싸워 유품을 차지한다',
    DIMENSION_GRAVE_CHOICE_PRAY: '기도 — 잠든 모험가의 명복을 빈다',
    DIMENSION_GRAVE_CHOICE_LEAVE: '지나친다 — 차원의 틈을 닫는다',
    DIMENSION_GRAVE_INVADE_LOG: (name: string) => `${name}의 망령이 차원의 틈을 넘어 덤벼듭니다!`,
    DIMENSION_GRAVE_PRAY_LOG: (name: string, heal: number) => `${name}의 망령이 고요히 잠듭니다. 생명 ${heal} 회복.`,
    DIMENSION_GRAVE_LEAVE_LOG: '차원의 틈이 닫히고 묘비가 사라졌습니다.',
    DIMENSION_GRAVE_SHADE_NAME: (name: string) => `${name}의 망령`,
    DIMENSION_GRAVE_SIGNATURE_ITEM: (item: string) => `전설 · ${item}`,
    DIMENSION_GRAVE_VICTORY: (name: string, item: string) => `${name}의 망령이 흩어졌습니다. 다른 차원의 유품 [${item}] 획득.`,
    DIMENSION_GRAVE_PREVIEW_INVADE: (item: string) => `현재 지역 정예급 망령과 전투 · 이기면 [${item}]`,
    DIMENSION_GRAVE_PREVIEW_PRAY: (percent: number) => `최대 생명의 ${percent}% 회복 · 전투 없음`,
    DIMENSION_GRAVE_PREVIEW_LEAVE: '아무 일도 일어나지 않음',

    // --- 떠돌이 행상인 (2026-10 Wave 75) — 사냥 지역에서 드물게 만나는 상인. 물품은 만날 때마다 바뀌고 판매도 된다 ---
    MERCHANT_TITLE: '떠돌이 행상인',
    MERCHANT_DESC: (count: number, rare: boolean) => rare
        ? `짐을 잔뜩 진 떠돌이 행상인이 길을 막아 섭니다. "오늘은 귀한 물건이 있다네." 보따리에 ${count}가지 물건이 보입니다.`
        : `짐을 잔뜩 진 떠돌이 행상인이 길을 막아 섭니다. "필요한 게 있으면 사고, 짐이 무거우면 팔고 가게." 보따리에 ${count}가지 물건이 보입니다.`,
    MERCHANT_CHOICE_BROWSE: '물건을 살펴본다 — 사고팔기',
    MERCHANT_CHOICE_PASS: '지나친다',
    MERCHANT_PREVIEW_BROWSE: (count: number, rare: number) => (rare > 0
        ? `이번 만남에만 파는 물건 ${count}가지(희귀 ${rare}) · 가방 물건 판매 가능`
        : `이번 만남에만 파는 물건 ${count}가지 · 가방 물건 판매 가능`),
    MERCHANT_PREVIEW_PASS: '행상인이 떠납니다',
    MERCHANT_LEAVE_LOG: '행상인이 짐을 꾸려 다음 길로 떠났습니다.',
    MERCHANT_SHOP_EYEBROW: '길 위의 거래',
    MERCHANT_SHOP_NOTE: '이번 만남에만 파는 물건입니다 · 떠나면 다시 볼 수 없습니다.',
    MERCHANT_RARE_BADGE: '희귀',
    MERCHANT_SOLD_OUT: '모두 팔렸습니다',
    MERCHANT_BUY_UNAVAILABLE: '행상인에게 그 물건이 없습니다.',
    MERCHANT_BUY_ACTION: '구매',
    MERCHANT_BUY_BLOCKED: '불가',

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
    // 2026-09 Wave 42: 직업 강점 · 약점 라벨 (전직 화면 — utils/classPresentation.getClassTraitLabels)
    CLASS_TRAIT_STRENGTHS: '강점',
    CLASS_TRAIT_WEAKNESSES: '약점',
    CLASS_TRAIT_LABELS: {
        toughness: '높은 생명',
        mana: '넉넉한 기력',
        firepower: '높은 화력',
        control: '행동 봉쇄',
        sustain: '자가 회복',
        crit: '치명타',
        evasion: '회피',
        affliction: '지속 피해',
        elements: '다양한 속성',
        guard: '방어 기술',
        weaken: '적 약화',
        escape: '확정 이탈',
        tempo: '추가 행동',
        purify: '상태이상 정화',
        growth: '빠른 성장',
        fortune: '추가 골드',
        exorcism: '퇴마',
        frail: '낮은 생명',
        low_mana: '적은 기력',
        low_firepower: '낮은 화력',
        no_sustain: '회복 기술 없음',
        mono_element: '단일 속성',
        physical_only: '속성 공격 없음',
    },
    CLASS_TIER_1: '1차 전직',
    CLASS_TIER_2: '2차 전직',
    CLASS_TIER_3: '최종 전직',

    // --- 도감 ---
    // cycle 116: CODEX_NEW_ENTRY/DISCOVERED/UNDISCOVERED/PROGRESS 제거 — 0건 사용.
    MONSTER_WEAKNESS: '약점',
    MONSTER_RESISTANCE: '내성',
    MONSTER_KILL_COUNT: (n: number) => `처치 ${n}회`,
    // 2026-10 Wave 61: 몬스터 · 소재 기록 — 기록은 처치할 때 열리고, 전리품 · 획득처는 엔진과 같은 표를 읽는다(`utils/codexDropSources.ts`).
    //   소재는 어느 상점에서도 팔지 않으므로 상점을 획득처로 말하지 않고, 가격은 판매가(`getSellPrice`)로 보인다.
    CODEX_MONSTER_HEADER_HINT: '처치한 생물만 이름과 전투 정보가 기록됩니다',
    CODEX_MONSTER_UNDISCOVERED_HINT: '이름 없는 칸을 나열하지 않고 처음 처치할 때 새 기록을 엽니다',
    CODEX_MONSTER_DROPS_LABEL: '고유 전리품',
    CODEX_MATERIAL_EMPTY_HINT: '몬스터 전리품 등으로 소재를 얻으면 이름과 획득처가 기록됩니다',
    CODEX_MATERIAL_SOURCES: (sources: string) => `획득처: ${sources}`,
    CODEX_MATERIAL_SOURCES_MORE: (count: number) => ` 외 ${count}종`,
    CODEX_MATERIAL_SOURCE_SPECIAL: '몬스터 전리품이 아닌 특별한 경로로 얻습니다',
    CODEX_MATERIAL_SELL_PRICE: (gold: number) => `판매가 ${gold.toLocaleString()} 골드`,
    EQUIP_STAT_COMPARE: '능력 비교',
    // cycle 116: EQUIP_EQUIPPED / UI_EQUIPPED 둘 다 '장착 중' 중복 정의였음. 둘 다 제거.

    // --- 인벤토리/장비 액션 ---
    INV_ITEM_NOT_FOUND: '가방에 없는 아이템입니다.',
    EQUIP_JOB_RESTRICT: (job: string | undefined, name: string | undefined) => `${withJosa(job, '은/는')} ${withJosa(name, '을/를')} 장착할 수 없습니다.`,
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
    // Wave 62 C6: 강화 칸 하나를 쓰는 모든 경로가 같은 규칙(`systems/tempBuffMerge.ts` — 세기 = (공격 + 방어 + 반격) × 남은 턴)을 쓴다.
    CONSUMABLE_BUFF_DOMINATED: '지금 걸린 강화가 같거나 더 강합니다(증가량 × 남은 턴). 물약은 쓰지 않았습니다.',
    // 2026-10 Wave 61 (원장 §61.3): 소모품 효과 문구 — 판정(엘릭서 · 소모품 종류)은 `systems/consumableRules.ts`가
    //   엔진과 함께 소유한다. 엘릭서(접두어 사본 포함)는 val과 무관하게 실효 최대 생명까지 회복하므로 수치를 그리지 않는다.
    CONSUMABLE_HP_FULL_RESTORE: '생명 완전 회복',
    CONSUMABLE_HP_RESTORE: (val: number) => `생명 ${val} 회복`,
    CONSUMABLE_MP_RESTORE: (val: number) => `기력 ${val} 회복`,
    /** 정화 아이템 — 라벨은 상태 칩과 같은 `STATUS_LABELS`(원시 효과 id를 그리던 상점 줄: "poison 해제"). */
    CONSUMABLE_CURE_STATUS: (label: string) => `${label} 해제`,
    CONSUMABLE_CURE_ANY: '상태이상 해제',
    CONSUMABLE_BUFF_TURNS: (turn: number) => `${turn}턴 강화`,
    ITEM_USE_BUFF: (name: string) => `${withJosa(name, '을/를')} 사용해 강화 효과를 얻었습니다.`,
    GOLD_INSUFFICIENT: '골드가 부족합니다.',
    INV_FULL: '가방이 가득 찼습니다.',
    SHOP_BUY_DONE: (name: string | undefined) => `${name} 구매 완료.`,
    SHOP_SELL_DONE: (name: string | undefined, gold: number) => `${name} 판매 · 골드 +${gold}`,
    CRAFT_MAT_INSUFFICIENT: (name: string) => `재료 부족: ${name}`,
    CRAFT_DONE: (name: string) => `${name} 제작 완료`,
    // 2026-10 Wave 62 (원장 §61.4 C8): 같은 이름의 사본 중 강화된 것이 있을 때, 제작에 쓰일 사본의 강화 수치(낮은 강화부터 쓴다).
    CRAFT_INPUT_ENHANCE_USED: (levels: readonly number[]) => `${levels.map((level) => `+${level}`).join(' · ')} 사용`,
    // 합성 재료 목록 · 칸의 강화 수치 표시(+N) — 강화된 사본을 고르면 강화가 함께 사라진다.
    SYNTHESIS_INPUT_ENHANCE: (level: number) => `+${level}`,
    // 2026-09 Wave 33 — 제작소 가방 단계(data/bagRecipes.ts). 이번 런에만 유효하다.
    BAG_CRAFTED: (name: string, capacity: number) => `${name} 제작 완료 — 이번 여정의 가방이 ${capacity}칸이 됐습니다.`,
    BAG_TAB_LABEL: '가방',
    BAG_PANEL_TITLE: '가방 제작',
    BAG_PANEL_META: '재료를 모아 이번 여정의 가방을 한 단계씩 넓힙니다.',
    BAG_CAPACITY: (capacity: number, base: number, bonus: number) => `지금 가방 ${capacity}칸 · 기본 ${base}칸 + 제작 ${bonus}칸`,
    BAG_RUN_SCOPE_NOTE: '제작한 가방은 이번 여정에만 유효합니다. 쓰러지거나 계승하면 기본 가방으로 돌아갑니다.',
    BAG_SLOTS: (slots: number) => `+${slots}칸`,
    BAG_STATE_DONE: '제작 완료',
    BAG_STATE_LOCKED: '이전 가방을 먼저 만드세요',
    BAG_ACTION_CRAFT: '제작',
    BAG_ACTION_CHECK: '재료 확인',
    BAG_ALL_DONE: '모든 가방을 만들었습니다.',
    BAG_GOLD: (gold: number) => `골드 ${gold.toLocaleString('ko-KR')}`,
    // 2026-10 Wave 61: 누적 처치 임무(`kills`)의 다음 단계 — 보스 처치도 함께 센다(CombatEngine.handleVictory).
    QUEST_NEXT_STEP_KILLS: (remaining: number) => `몬스터 ${remaining}회 더 처치 (보스 포함)`,
    // 2026-10 Wave 64: 누적 골드 임무(`gold_earned`) — 경로 · 다음 단계 · 귀환 · 작전 목표 문구.
    QUEST_ROUTE_GOLD: '골드 수입',
    QUEST_NEXT_STEP_GOLD: (remaining: number) => `골드 ${remaining} 더 벌기`,
    QUEST_RETURN_GOLD: '골드',
    QUEST_OBJECTIVE_GOLD: (goal: number) => `누적 골드 ${goal} 달성`,
    QUEST_EXTRACTION_GOLD: (goal: number) => `누적 골드 ${goal} 달성 후 마을 귀환`,
    QUEST_REWARD_ITEM: (name: string) => `보상 아이템: ${name}`,
    // 2026-10 임무 문구 감사: 칭호 보상 표시(formatRewardParts) — 수령하면 칭호가 지급되는데 보상 줄에서 빠져 있었다.
    QUEST_REWARD_TITLE: (label: string) => `칭호 ${label}`,
    QUEST_TRAIT_BONUS: (title: string, gold: number) => `${title} 공명 보상 · 골드 +${gold}`,
    // W2 (Wave 5): Quest.title은 타입상 optional이고 현상수배/카탈로그 양쪽을 받는
    //   호출부가 있어 QUEST_ACCEPTED / QUEST_ABANDONED와 같은 시그니처로 맞춘다.
    QUEST_DONE: (title: string | undefined) => `임무 완료: ${title}`,
    STORY_JOURNAL_TITLE: '지금까지의 이야기',
    STORY_JOURNAL_PREVIOUS: '앞선 이야기 다시 읽기',
    STORY_JOURNAL_NEXT: (title: string | undefined, level: number | undefined) => `다음 이야기: ${title} · 수락 조건 레벨 ${level}. 마을 게시판에서 확인하세요.`,
    ACH_REWARD_ITEM: (name: string) => `업적 보상 아이템: ${name}`,
    ACH_DONE: (title: string | undefined) => `업적 달성: ${title}`,
    // 2026-10 Wave 108 (소유자 결정 "영구 보상은 처음 한 번만"): 다시 달성한 업적의 크리스털은 계정당 한 번만 준다.
    ACH_CRYSTAL_ALREADY_GRANTED: (amount: number) => `에테르 크리스탈 ${amount}개는 이전 여정에서 이미 받았습니다`,
    PREMIUM_INSUFFICIENT: (name: string) => `${withJosa(name, '이/가')} 부족합니다.`,
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
    TOWN_BUFF_CLEAR: '마을에 돌아와 임시 강화 효과와 상태이상을 정리했습니다.',
    EXPLORE_BLOCKED: '탐험할 수 없는 상태입니다.',
    TOWN_PEACEFUL: '마을 주변은 평화롭습니다.',
    // 2026-09 Wave 16 H3: safe 지역의 explore 라벨 — ControlPanel이 하드코딩하던
    //   한국어 문자열을 MSG로 옮기고, 이야기 스텝 대기 케이스를 새로 구분한다.
    TOWN_EXPLORE_INVESTIGATE: '도시 조사 · 전투 가능',
    TOWN_EXPLORE_CHAIN: '단서를 따라간다',
    // ── 2026-10 통합 감사(town-nav): 마을 시설 · 원정 조작판 · 닫기/뒤로 · 상점 전환 · 접근 가능한 이름 ──
    //   마을 시설은 행동 종류만 그린다(Wave 136) — 이유 · 상태 문구를 붙이지 않는다. 에테르 거울은 공개된 시설이다(CL-02).
    TOWN_FACILITIES_TITLE: '마을 시설',
    TOWN_FACILITY_LABELS: {
        rest: '휴식',
        quests: '임무',
        market: '상점',
        class: '전직',
        craft: '제작',
        mirror: '에테르 거울',
        // 소유자 결정 2026-10-26 D2(UX-04): 크리스탈 교환도 마을 시설이다 — 기록의 설정 탭에 묻혀 있었다.
        crystal: '에테르 교환소',
    },
    // 원정 조작판 — 이동은 하나, 탐험이 주 행동, 가방은 기록의 가방 탭을 연다(UX-03 · UX-07).
    FIELD_ACTION_BAG: '가방',
    // 같은 동작(이 화면을 닫고 이전으로)은 한 이름이다(UX-09) — 화면을 바꾸는 패널은 '뒤로', 위에 덮는 화면은 '닫기'(UI_CLOSE).
    UI_BACK: '뒤로',
    EVENT_LEAVE_LOG: (title: string) => `${title} · 선택하지 않고 지나쳤습니다.`,
    STATUS_CRYSTAL_ARIA: (count: number) => `크리스탈 ${count}개 · 에테르 교환소 열기`,
    // 상태 표시줄 아바타는 기록(모험 기록)을 연다 — '장비 콘솔'은 화면 언어 밖의 이름이었다(UX-07).
    STATUS_AVATAR_ARCHIVE_ARIA: '모험 기록 열기',
    SHOP_MODE_GROUP_ARIA: '구매 · 판매 전환',
    SHOP_MODE_BUY: '구매',
    SHOP_MODE_SELL: '판매',
    // 빠른 칸 배치 단추의 이름 — 숫자만 읽히던 단추가 무엇을 하는지 말한다(A11Y-05). 이 물건이 든 칸은 aria-pressed가 알린다.
    //   화면 이름은 옆 라벨 '빠른 칸:'과 같다(가방 화면 · 빈 칸 라벨 QUICK_SLOT_EMPTY_LABEL).
    QUICK_SLOT_ASSIGN_ARIA: (slot: number, itemName?: string) => (
        itemName ? `빠른 칸 ${slot}: ${itemName}` : `빠른 칸 ${slot}에 넣기`
    ),
    QUICK_SLOT_UNASSIGN: '빠른 칸에서 빼기',
    ARCHIVE_RAIL_MORE_ARIA: '다음 기록 탭 보기',
    ARCHIVE_RAIL_START_ARIA: '처음 기록 탭 보기',
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
    // 2026-10 Wave 62 C20: 상점 머리말 — 판매 등급과 가방에 더해, 가격 배율이 있는 상점(황금 왕국)은 물가를 말한다.
    SHOP_HEADER_META: (maxTier: number, bagCount: number, bagCapacity: number, pricePercent: number) => (
        `판매 등급 ${maxTier}${pricePercent !== 100 ? ` · 물가 ${pricePercent}%` : ''} · 가방 ${bagCount}/${bagCapacity}`
    ),
    REST_GOLD_INSUFFICIENT: (cost: number) => `휴식할 골드가 부족합니다. 필요 골드: ${cost}`,
    // cycle 116: REST_DONE 제거 — REST_DONE_FULL이 active.
    SKILL_SWAP_SAFE_ONLY: '기술 교체는 안전한 지역에서만 가능합니다.',
    SKILL_SWAP_GOLD_INSUFFICIENT: (cost: number) => `기술을 바꿀 골드가 부족합니다. 필요 골드: ${cost}`,
    SKILL_NO_BRANCH: '해당 기술에 분기가 없습니다.',
    SKILL_INVALID_BRANCH: '유효하지 않은 분기입니다.',
    JOB_CHANGE_INVALID: '전직 가능한 직업이 아닙니다.',
    JOB_CHANGE_LEVEL: '전직 레벨이 부족합니다.',
    QUEST_TOWN_ONLY: '임무 수락은 마을 게시판에서만 가능합니다.',
    QUEST_ALREADY_COMPLETED: '이미 완료해 보상을 받은 임무입니다.',
    QUEST_LEVEL_REQUIRED: (lv: number | undefined) => `레벨 ${lv} 이상부터 수락할 수 있는 임무입니다.`,
    QUEST_PREREQUISITE_REQUIRED: (title: string | undefined) => `‘${title}’ 임무를 먼저 완료해야 이어지는 이야기를 받을 수 있습니다.`,
    QUEST_ACCEPTED: (title: string | undefined) => `임무 수락: ${title}`,
    QUEST_ABANDON_TOWN_ONLY: '임무 포기는 마을 게시판에서만 가능합니다.',
    QUEST_ABANDON_REWARD_PENDING: '완료한 임무는 보상을 받은 뒤 목록에서 정리할 수 있습니다.',
    QUEST_ABANDONED: (title: string | undefined) => `${title} 임무를 포기했습니다. 같은 임무는 다시 수락할 수 있습니다.`,
    EXPEDITION_FOCUS_TOWN_ONLY: '원정 임무 편성은 마을에서만 바꿀 수 있습니다.',
    EXPEDITION_FOCUS_LIMIT: '이번 원정에는 임무를 최대 3개까지 지정할 수 있습니다.',
    EXPEDITION_FOCUS_REQUIRED: '원정 임무를 최소 1개는 유지해야 합니다.',
    EXPEDITION_FOCUS_ADDED: (title: string | undefined) => `이번 원정 임무 추가: ${title}`,
    EXPEDITION_FOCUS_REMOVED: (title: string | undefined) => `이번 원정 임무 제외: ${title}`,
    BOUNTY_TOWN_ONLY: '현상수배 수주는 마을 게시판에서만 가능합니다.',
    // Wave 32 이후 하루 1회 제한이 없다 — 진행 중인 현상수배가 없으면 바로 새로 발급된다(REQUEST_BOUNTY).
    BOUNTY_ABANDONED: '현상수배 임무를 포기했습니다. 게시판에서 바로 새 현상수배를 받을 수 있습니다.',
    BOUNTY_ABANDON_WARNING: '새 현상수배는 바로 받을 수 있지만 대상과 수량은 새로 정해집니다.',
    // cycle 116: BOUNTY_ACCEPTED 제거 — BOUNTY_ACCEPTED_NEW가 active.
    ASCEND_PENDING_QUESTS_TITLE: '먼저 받을 임무 보상',
    // 2026-10 Wave 108: 계승하면 임무 · 이야기를 처음부터 다시 한다(수령 기록이 남지 않는다).
    // 2026-10 Wave 109: 사망 · 다시 시작 · 계승 화면의 "남는 것 / 새로 시작하는 것" — 항목은 `JOURNEY_RESET_SURFACE`(utils/journeyScope.ts)가
    //   정하고 계약 테스트가 실제 전이로 확인한다. 화면에 항목을 손으로 적지 말 것.
    JOURNEY_ITEM_LABELS: {
        essenceGrowth: '정수로 새긴 영구 성장',
        prestigeLedger: '계승 단계와 기록',
        classJourney: '직업 여정',
        settings: '설정',
        seasonPass: '시즌 진행',
        crystals: '에테르 크리스탈',
        codex: '도감',
        signatureCollection: '전설 각인 수집',
        unrecoveredGraves: '회수하지 못한 유해',
        level: '레벨',
        gear: '장비와 가방',
        relics: '유물',
        questsStory: '임무와 이야기',
        journeyTitles: '이번 여정의 칭호와 업적',
        activeExpedition: '현재 원정',
    } as const,
    JOURNEY_KEPT_HEADING: '그대로 남는 것',
    JOURNEY_RESET_HEADING: '새로 시작하는 것',
    JOURNEY_KEPT_LINE: (items: string) => `다음 여정에 남는 것: ${items}`,
    JOURNEY_RESET_LINE: (items: string) => `처음부터 다시: ${items}`,
    MENU_RESET_TITLE: '현재 여정 다시 시작',
    MENU_RESET_SUMMARY: '이번 여정을 처음부터 다시 합니다. 정수로 새긴 영구 성장과 계승 기록은 남습니다.',
    MENU_RESET_LOSS: (items: string) => `새로 시작: ${items}`,
    MENU_RESET_PRESERVED: (items: string) => `그대로 보존: ${items}`,
    CODEX_SUBTITLE: '발견한 장비와 생물, 제작 기록 — 계승해도 남고, 쓰러지면 처음부터 다시 모읍니다',
    TRUE_ENDING_PENDING_GUIDANCE: '완료한 임무 보상을 지금 수령할 수 있습니다. 계승하면 임무와 이야기를 처음부터 다시 하니, 보상 장비를 이번 여정에서 사용하려면 현재 여정을 계속하세요.',
    // 2026-10 Wave 134: 진 엔딩 화면은 계승 화면과 같은 단추 이름 · 같은 표(JOURNEY_RESET_SURFACE)를 쓴다 — 'True Ending' ·
    //   'New Game+'(= 계승) 영어 이름과 손으로 쓴 보존 목록("…도감 · 계승 기록만 이어 갑니다" — 각인 수집 · 직업 여정 · 시즌이 빠졌다)이 있었다.
    TRUE_ENDING_TITLE: '진 엔딩',
    ASCENSION_CONFIRM: '계승하고 새 여정',
    ASCENSION_CONFIRMING: '계승 중…',
    ASCENSION_CONTINUE: '현재 여정 계속',
    ASCEND_PENDING_QUESTS_GUIDANCE: '계승하면 임무와 이야기를 처음부터 다시 합니다. 완료한 임무 보상은 계승 전에 받으세요.',
    ASCEND_PENDING_QUESTS_BLOCKED: '완료한 임무 보상을 모두 받은 뒤 계승할 수 있습니다.',
    ASCEND_CANCEL: '계승을 미루고 현재 여정을 계속합니다.',

    // --- 이동/탐험 동적 메시지 ---
    MOVE_EXITS: (exits: string) => `이동 가능한 지역: ${exits}`,
    // 2026-10 Wave 62 (원장 §61.2 A10): 도전 규칙 '길 잃은 여행' — 위치 이름 자리표시와, 지역을 드러내지 않는 이동 로그.
    BLIND_MAP_LOCATION: '???',
    MOVE_EXITS_BLIND: (count: number) => `이동할 수 있는 길이 ${count}갈래 있습니다. 어디로 이어지는지는 알 수 없습니다.`,
    MOVE_AREA_DANGER_BLIND: '이곳은 위험해 보입니다. 정예와 구역 보스를 주의하고, 생명이 부족하면 돌아가세요.',
    MOVE_AREA_DESC_BLIND: '짙은 안개에 가려 이곳이 어디인지 알 수 없습니다.',
    BLIND_MAP_ROUTE_DESC: '어디로 이어지는지 알 수 없는 길입니다.',
    BLIND_MAP_ROUTE_NAME: '미확인 경로',
    // 첫 방문 보상의 실제 지급 로그 — 길 잃은 여행(이름 숨김)이나 빈손의 시작(골드 절반)으로 데이터 문구와 달라질 때 쓴다.
    FIRST_VISIT_REWARD: (loc: string, gold: number, exp: number) => `${loc}에 처음 발을 들였습니다. 골드 ${gold} · 경험 ${exp}`,
    MOVE_ARRIVED: (loc: string) => `${loc}에 도착했습니다.`,
    MOVE_NEW_AREA: (loc: string) => `처음 발견한 지역은 ${loc}입니다.`,
    // C-2 (B+ 2026-06): 갓 진입한 위험 지역(권장 레벨 근접) 경고 — 정예/보스 readability.
    MOVE_AREA_DANGER: (lv: number | string) => `이 지역의 권장 레벨은 ${lv}입니다. 정예와 구역 보스를 주의하고, 생명이 부족하면 돌아가세요.`,
    GRAVE_FOUND_MULTI: (count: number) => `근처에서 당신의 유해 ${count}구를 발견했습니다.`,
    GRAVE_FOUND_SINGLE: '근처에서 당신의 유해를 발견했습니다.',
    FIRST_JOURNEY_TITLE: '숲에 남은 전쟁의 흔적',
    FIRST_JOURNEY_REASON: '마법전쟁이 끝난 뒤에도 고요한 숲에는 변이가 남아 있습니다. 마을을 나서 숲을 조사하고, 첫 발견을 기록하세요.',
    ENDGAME_JOURNEY_TITLE: '마왕성의 봉인',
    ENDGAME_JOURNEY_SCOPE: '마왕을 쓰러뜨린 뒤 열리는 문을 조사합니다.',
    ENDGAME_JOURNEY_SHARDS: (count: number, required: number) => `원시의 파편 ${count}/${required}`,
    // 2026-10 Wave 103 (소유자 결정 §107.6): 봉인이 열리는 조건(계승 단계 · 파편 확률)은 말하지 않는다 — 첫 파편 뒤의 단서만.
    ENDGAME_JOURNEY_CLUE_COLLECT: '파편은 마왕의 잔해에서 나왔습니다. 남은 파편이 어딘가에 있습니다.',
    ENDGAME_JOURNEY_CLUE_WAIT: '파편이 모두 모였지만 봉인은 아직 반응하지 않습니다. 더 먼 여정이 필요해 보입니다.',
    ENDGAME_JOURNEY_READY: '다음 마왕 토벌 직후 파편을 사용하고 연속 전투에 들어갑니다. 회복과 소모품을 준비하세요.',
    ENDGAME_JOURNEY_PRESERVED: '모은 파편은 계승 후에도 남습니다.',
    ENDGAME_JOURNEY_COMPLETE_TITLE: '종장 기록',
    ENDGAME_JOURNEY_COMPLETE: '진 엔딩을 확인했습니다. 완주 기록은 다음 여정에도 남습니다.',
    START_JOURNEY: (name: string) => `${name}의 첫 여정이 시작됩니다.`,
    START_SKILL: (name: string) => `첫 기술로 익힌 능력은 ${name}입니다.`,
    ABYSS_FLOOR_WARNING: (floor: number) => `🌀 심연 ${floor}층 — 강대한 적들이 기다립니다...`,
    ENEMY_APPEAR: (name: string) => `${name} 등장!`,
    EVENT_RESULT_DEFAULT: '선택의 결과가 반영되었습니다.',
    EVENT_REWARD_UNAVAILABLE: '이 선택의 보상 정보를 확인할 수 없습니다. 다른 선택을 골라주세요.',
    CHAIN_RELIC_ALREADY_OWNED: (name: string) => `${withJosa(name, '은/는')} 이미 보유하고 있습니다. 다른 선택을 골라주세요.`,
    CHAIN_RELIC_SLOTS_FULL: '유물 칸이 가득 차 이 유물을 받을 수 없습니다. 다른 선택지를 고르세요.',
    // 캠프파이어 노드 (Phase 2, B+ 2026-06): 휴식 vs 단련 결정 (StS 캠프파이어).
    CAMPFIRE_DESC: '사그라드는 모닥불을 발견했습니다. 잠시 숨을 고를 수 있습니다. 무엇을 하시겠습니까?',
    CAMPFIRE_REST_CHOICE: '휴식 — 생명과 기력을 회복한다',
    CAMPFIRE_FORGE_CHOICE: '단련 — 무기를 손질해 다음 전투를 대비한다',
    CAMPFIRE_REST_LOG: (health: number, energy: number) => `불 곁에서 숨을 고르며 생명 +${health} · 기력 +${energy} 회복했습니다.`,
    CAMPFIRE_FORGE_LOG: (pct: number, turns: number) => `무기를 벼립니다. 다음 전투 ${turns}턴 동안 공격력 +${pct}%.`,
    // 2026-10 U5: 회복이 실효 최대치에서 멈춰 적힌 양보다 적게 오른 한정 조우의 결과 줄 — 실제로 오른 양만 말한다
    //   (적힌 양을 그대로 찍던 결함). 일반 · 모닥불 사건은 결과 문구 속 수치를 실제 양으로 고친다(eventPresentation).
    EVENT_RECOVERY_CAPPED: (healed: { hp?: number; mp?: number }) => `이미 최대치에 가까워 ${[
        healed.hp !== undefined ? `생명 +${healed.hp}` : '',
        healed.mp !== undefined ? `기력 +${healed.mp}` : '',
    ].filter(Boolean).join(' · ')}만 회복했습니다.`,
    // 2026-10 Wave 62 (원장 §61.4 C16): 숫자 뒤 조사 짝(받침 있음 · 없음)과 금액에 맞는 조사 — 사건 결과 · 미리보기 문구 속 골드
    //   금액을 실제로 받는 금액으로 다시 적을 때 조사를 맞춘다(eventPresentation.reportPaidGold — "골드 70을" → "골드 35를").
    NUMBER_PARTICLE_PAIRS,
    NUMBER_PARTICLE: numberParticle,
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
    BOSS_GAUGE_AVOID_LOG: '흔적을 피해 계속 나아갑니다. 기척은 여전히 짙게 남아 있습니다.',
    MAP_BADGE_BOSS_GAUGE: (pct: number) => `게이지 ${pct}%`,
    EXPEDITION_CLEAR_RECAP: (bossName: string, kills: number, gold: number) => (
        `원정 완료 · ${bossName} 격파 · 적 ${kills}마리 처치 · 골드 +${gold}`
    ),
    EXPEDITION_RETURN_LEVEL: (start: number, end: number) => end > start ? `레벨 ${start} → ${end}` : `레벨 ${end}`,
    EXPEDITION_RETURN_EXP: '경험 획득',
    EXPEDITION_RETURN_HP: (hp: number, percent: number) => `생명 ${hp.toLocaleString('ko-KR')} · ${percent}%`,
    EVENT_SUCCESS_GOLD: (gold: number) => `선택에 성공했습니다. 골드 +${gold}`,
    EVENT_FAIL_DAMAGE: (dmg: number) => `선택의 대가로 생명 ${withJosa(dmg, '을/를')} 잃었습니다.`,
    REST_DONE_FULL: (cost: number) => `휴식을 마치고 생명과 기력을 모두 회복했습니다. 골드 -${cost}`,
    JOB_CHANGE_DONE: (jobName: string) => `${jobName} 전직 완료!`,
    BOUNTY_ACCEPTED_NEW: (target: string, count: number) => `새로운 현상수배 수락: ${target} ${count}마리`,
    TITLE_UNLOCKED: (label: string) => `새 칭호를 얻었습니다. ${label}`,
    // 2026-10 Wave 72 (소유자 결정): 정예 목격 칭호 — 지역마다 하나, 효과는 장착과 상관없이 모은 만큼 합산된다(`utils/eliteTitles.ts`).
    ELITE_TITLE_NAME: (mapName: string) => `${mapName}의 정예 목격자`,
    ELITE_TITLE_PASSIVE: (bonusLabel: string) => `${bonusLabel} · 장착하지 않아도 모은 칭호만큼 합산`,
    ELITE_TITLE_UNLOCKED: (name: string, bonusLabel: string) => `정예와 마주쳤습니다. 새 칭호 [${name}] — ${bonusLabel}(모은 정예 칭호에 합산)`,
    ELITE_TITLE_GROUP: (count: number, total: number) => `정예 목격 칭호 ${count}/${total}`,
    ELITE_TITLE_GROUP_TOTAL: (bonusLabel: string) => (bonusLabel ? `합산 효과 ${bonusLabel}` : '합산 효과 없음'),
    // 능력치 화면 '계승 기록' — 원천별 합(레벨 비례 전 원래 양). 2026-10 Wave 108부터 이야기 보상 · 정예 칭호는 이번 여정 값이다.
    STATS_STORY_BONUS_LABEL: '이야기 보상 · 이번 여정',
    // 2026-10 Wave 130: 처치 정수가 쌓는 단계는 계승 화면과 같은 이름 '정수 사다리'다 — 능력치 화면이 "계승 단계"라 불러 계승(회차) 단계와 겹쳤다.
    STATS_ESSENCE_LADDER_LABEL: '정수 사다리',
    STATS_ESSENCE_LADDER_RANK: (rank: number) => `정수 사다리 ${rank}단계`,
    STATS_ELITE_TITLE_LABEL: (count: number, total: number) => `정예 목격 ${count}/${total} · 이번 여정`,
    STATS_PERMANENT_NONE: '없음',
    // 2026-10 Wave 61: 새 칭호는 아직 없는 칭호일 때만 알린다(`title` null) — 계승 11단계부터는 10단계의 '에테르의 신'이 다시 온다.
    ASCEND_DONE: (rank: number, title: string | null) => (title
        ? `에테르 계승 ${rank}단계에 도달했습니다. 새 칭호 ${withJosa(`'${title}'`, '과/와')} 영구 성장이 다음 여정에 적용됩니다.`
        : `에테르 계승 ${rank}단계에 도달했습니다. 영구 성장이 다음 여정에 적용됩니다.`),
    ASCEND_NEW_TITLE_LABEL: '새 칭호',
    ASCEND_TITLE_OWNED_LABEL: '칭호 (이미 보유)',
    DAILY_PROTOCOL_DONE: (count: number, reward: string) => (
        `${count > 1 ? `오늘의 임무 ${count}개 완료` : '오늘의 임무 완료'} · ${reward}`
    ),
    DAILY_PROTOCOL_RELIC_COMPLETE: (name: string) => `유물 파편 완성 · ${name} 획득`,
    CHAIN_REWARD_RELIC: (name: string) => `이야기 보상 · 유물 ${withJosa(name, '을/를')} 얻었습니다.`,
    // 2026-10: 앞머리는 체인 보상의 `buffIntro`다(최후의 영웅 '최후의 영웅이 합류해' · 잊혀진 사령관 · 물의 사도) —
    //   셋 모두 '최후의 영웅이 합류해'를 찍던 결함. 없으면 아래 일반 문구.
    CHAIN_REWARD_COMBAT_BONUS: (attackPercent: number, turns: number, intro: string = '이야기의 힘이 깃들어') => `${intro} ${turns}턴 동안 공격력이 ${attackPercent}% 오릅니다.`,

    // --- 체인 저널 (Quest 탭) ---
    CHAIN_JOURNAL_TITLE: '진행 중인 이야기',
    CHAIN_JOURNAL_STEP: (current: number, total: number) => `${current}/${total} 단계`,
    CHAIN_JOURNAL_NEXT_LOC: (loc: string) => `다음 이야기: ${loc}`,
    // Wave 62 C17: 층 조건이 있는 스텝(심연의 신호) — 그 층에 닿아야 발동한다.
    CHAIN_JOURNAL_NEXT_LOC_FLOOR: (loc: string, floor: number) => `다음 이야기: ${loc} ${floor}층`,

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
    DEMON_KING_SLAIN_ASCEND: '⚡ 마왕이 쓰러졌습니다. 계승의 문이 열렸습니다...',
    TRUE_GOD_SLAIN: '🌟 원시의 신이 쓰러졌습니다. 세계의 진실이 밝혀집니다...',
    VOID_GOD_SLAIN: '💀 공허의 신이 쓰러졌습니다. 공허가 잠시 물러났습니다... 당신은 심연의 끝을 정복했습니다.',
    ABYSS_RECORD: (floor: number) => `🏆 심연 최고 기록 경신! ${floor}층 돌파`,

    // --- 전투 아이템/스킬 ---
    COMBAT_CHAOS_SKILL: (name: string) => `뒤섞인 기술: [${name}]${josa(name, '이/가')} 발동했습니다!`,
    // 2026-10 Wave 62 (원장 §61.4 C15): 뽑힌 기술을 쓸 수 없어도(기력 부족 · 재사용 대기) 차례는 지나간다 — 기력은 쓰지 않는다.
    COMBAT_CHAOS_SKILL_FIZZLE: (name: string) => `뒤섞인 기술: [${name}]${josa(name, '을/를')} 쓸 수 없어 이번 차례를 놓쳤습니다.`,
    COMBAT_DOT_KILL: (name: string) => `[지속 피해] ${withJosa(name, '이/가')} 쓰러졌습니다!`,
    COMBAT_COUNTER_KILL: (name: string) => `[반사·반격] ${withJosa(name, '이/가')} 쓰러졌습니다!`,
    ITEM_USE_SIMPLE: (name: string) => `${name} 사용.`,
    ITEM_USE_CURE: (name: string) => `${name} 사용: 상태이상 해제`,

    // --- 전투 승리 ---
    QUEST_CONDITION_MET: (count: number) => `임무 조건 달성: ${count}개`,
    // 2026-10 Wave 61: 연속 처치 단계는 공격력과 치명타 확률을 함께 올린다(BALANCE.KILL_STREAK_ATK_BONUS · KILL_STREAK_CRIT_BONUS).
    KILL_STREAK_BONUS: (streak: number, atkPct: number, critPct: number) => `🔥 ${streak}연속 처치! 공격력 +${atkPct}% · 치명타 확률 +${critPct}%p 보너스 발동`,

    // --- 심연 ---
    ABYSS_DESCEND: (floor: number) => `심연 ${floor}층을 돌파했습니다. 다음은 ${floor + 1}층입니다.`,
    ABYSS_LEGENDARY_ITEM: (name: string | undefined) => `🏆 전설 아이템 획득: [${name}]`,
    // cycle 194: ABYSS_PRESTIGE_POINTS 제거 — abyss milestone 'prestige_points' reward type이
    //   dead config(player.prestigePoints가 spend/UI 미구현)였음. 보상 타입을 relic_choice/
    //   legendary_item으로 교체해 메시지도 자연 dead → 정리.

    // --- Firebase 동기화 ---
    SYNC_SERVER_LOADED: '서버 데이터와 동기화되었습니다.',
    SYNC_SAVE_RESTORED: '저장된 여정을 불러왔습니다.',
    SYNC_AUTH_TIMEOUT: '인증 지연으로 오프라인 모드로 시작했습니다.',
    SYNC_NO_CONFIG: '클라우드 설정을 찾을 수 없어 오프라인 모드로 시작했습니다.',
    SYNC_AUTH_FAIL: '클라우드 인증 실패로 오프라인 모드로 시작했습니다.',
    SYNC_TIMEOUT: '클라우드 응답 지연으로 오프라인 모드로 시작했습니다.',
    SYNC_CONNECT_FAIL: '클라우드 연결 실패로 오프라인 모드로 시작했습니다.',

    // --- 탐험 선택지 ---
    CHOICE_DEFAULT: (n: number) => `선택지 ${n}`,

    // --- 이동 기본값 ---
    MOVE_NO_EXITS: '없음',

    // --- 화면 낭독기 전용 이름 · 제목 · 소식 (감사 A11Y-01 · 03 · 06) ---
    //   눈에 보이지 않는 글이다. 대화상자 이름은 그 화면의 제목과 같은 말을 쓴다.
    A11Y_DIALOG_EXPEDITION_DEBRIEF: '원정 귀환 기록',
    A11Y_DIALOG_ENHANCE: (name: string) => `${name} 강화 확인`,
    A11Y_DIALOG_ASCENSION: '다음 여정으로 계승',
    A11Y_DIALOG_MIRROR: '에테르 거울 영구 성장',
    A11Y_DIALOG_PREMIUM_SHOP: '에테르 교환소',
    A11Y_COMBAT_ACTIONS_HEADING: '전투 행동',
    A11Y_PLAYER_STATUS_HEADING: '내 상태',
    A11Y_LOG_HEADING: '모험 기록',
    A11Y_COMBAT_LIVE_LABEL: '이번 차례',
    A11Y_COMBAT_HP: (hp: number, maxHp: number) => `생명 ${hp}/${maxHp}`,
    COMBAT_LOG_SUMMARY_LABEL: '최근 전투',

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
    PRODUCT_EVENTS_TITLE: '기기 활동 기록',
    PRODUCT_EVENTS_DESCRIPTION: '최근 활동을 이 기기에 최대 200건 보관합니다. 이름·대화·저장 데이터는 포함하지 않으며 서버로 전송하지 않습니다.',
    PRODUCT_EVENTS_ACTIVE: '이 빌드는 새 활동의 로컬 기록을 지원합니다.',
    PRODUCT_EVENTS_WRITE_FAILED: '최근 활동을 저장하지 못했습니다. 기기의 저장 공간과 접근 권한을 확인해 주세요.',
    PRODUCT_EVENTS_INACTIVE: '릴리스 정보가 없는 빌드에서는 새 활동을 기록하지 않습니다.',
    PRODUCT_EVENTS_COUNT: (count: number) => `보관 중인 활동 · ${count}건`,
    PRODUCT_EVENTS_INVALID: '기록을 읽을 수 없습니다. 지우기를 눌러 손상된 기록을 정리할 수 있습니다.',
    PRODUCT_EVENTS_UNAVAILABLE: '이 기기의 저장소에 접근할 수 없습니다.',
    PRODUCT_EVENTS_EXPORT: '활동 기록 내보내기',
    PRODUCT_EVENTS_COPY: '활동 기록 복사',
    PRODUCT_EVENTS_COPIED: '활동 기록을 클립보드에 복사했습니다.',
    PRODUCT_EVENTS_CLEAR: '활동 기록 지우기',
    PRODUCT_EVENTS_EXPORTED: '활동 기록 파일의 다운로드를 요청했습니다.',
    PRODUCT_EVENTS_EXPORT_FAILED: '활동 기록을 내보내지 못했습니다.',
    PRODUCT_EVENTS_CLEARED: '활동 기록을 지웠습니다. 이후 활동부터 다시 보관합니다.',
    PRODUCT_EVENTS_CLEAR_FAILED: '활동 기록을 지우지 못했습니다.',
    ERROR_REPORT_CLEARED: '오류 리포트를 지웠습니다.',
    // --- 장비 비교 델타 라벨 (A2 · 2026-09 감사 G4) ---
    // ShopPanel(getComparisonMeta) / combatActions(_helpers.getLootUpgradeHint)가
    // 각자 한국어 라벨을 하드코딩하고 있어 표기 드리프트가 가능했다. 단일 원천.
    EQUIP_DELTA_LABEL: { atk: '공격력', def: '방어력', crit: '치명타', mp: '기력' } as Record<string, string>,
    EQUIP_DELTA_NONE: '현재 장비와 동일한 효율',
    EQUIP_DELTA_NONE_COMPACT: '변화 없음',
    EQUIP_DELTA_OFFHAND_RELEASED: '보조손 해제',
    // 2026-10 Wave 58: 쌍수 배율(공격력 ×DUAL_WIELD_ATK_BONUS · 방어력 ×DUAL_WIELD_DEF_MULT)을 비교 칩에 함께 적는다.
    EQUIP_DUAL_WIELD_ON: (atkPct: number, defPct: number) => `쌍수 — 공격력 +${atkPct}% · 방어력 -${defPct}%`,
    EQUIP_DUAL_WIELD_OFF: (atkPct: number, defPct: number) => `쌍수 해제 — 공격력 -${atkPct}% · 방어력 +${defPct}%`,
    // --- 상시 HUD 원정 신호 (2026-09 · 보스 접근 게이지 / 심연 데일리 다이브) ---
    HUD_BOSS_GAUGE: (ticks: number, total: number) => `보스 접근 ${ticks}/${total}`,
    HUD_BOSS_GAUGE_FULL: (bossName: string) => `${bossName} 조우 임박`,
    HUD_ABYSS_DAILY_DIVE: (remaining: number, mult: number) => `오늘의 다이브 ${remaining}전투 ${mult}배`,

    // --- 에테르 거울 진입 (2026-09 · 승천 화면 CTA) ---
    MIRROR_CTA_LABEL: '에테르 거울 열기',
    MIRROR_CTA_HINT: (essence: number) => `계승 정수 ${withJosa(essence, '으로/로')} 영구 성장을 새길 수 있습니다.`,
    // 2026-09 Wave 32: 계승 시 정수 사다리 이월(BALANCE.ESSENCE_LADDER_ASCEND_CARRY).
    // 2026-10 Wave 114: 넘어가는 몫은 비율과 고정 상한(BALANCE.ESSENCE_LADDER_ASCEND_CARRY_MAX_RANKS) 중 작은 쪽이다.
    ASCEND_LADDER_CARRY: (before: number, kept: number, percent: number, maxRanks: number) =>
        `정수 사다리 ${before}단계 중 ${kept}단계(${percent}%, 최대 ${maxRanks}단계)만 다음 여정으로 이어집니다. 나머지는 위 표의 내려놓는 몫이고, 계승 정수는 그대로입니다.`,
    // 2026-10 Wave 95: 유료 다시 뽑기의 대가가 이 계승에 들어갔다.
    ASCEND_LADDER_REROLL_COST: (paid: number) => `회차 규칙을 대가를 치르고 ${paid}번 다시 뽑아 넘어가는 몫이 줄었습니다.`,
    // 2026-10 Wave 98: 끝없는 거울이 열렸으면 계승한 뒤의 정수로 몇 단계를 살 수 있는지 알린다(표시만).
    ASCEND_MIRROR_ENDLESS_STEPS: (essence: number, steps: number, nextCost: number, atk: number, hp: number, mp: number) =>
        `계승 뒤 정수 ${essence.toLocaleString('ko-KR')}: 끝없는 거울을 ${steps.toLocaleString('ko-KR')}단계 더 새길 수 있습니다. 단계마다 공격력 +${atk} · 생명 +${hp} · 기력 +${mp} 중 하나, 다음 단계 비용 정수 ${nextCost.toLocaleString('ko-KR')}.`,
    ASCEND_MIRROR_ENDLESS_SHORT: (essence: number, shortfall: number) =>
        `계승 뒤 정수 ${essence.toLocaleString('ko-KR')}: 끝없는 거울의 다음 단계까지 정수 ${shortfall.toLocaleString('ko-KR')} 더 필요합니다.`,
    // 2026-10 Wave 99: 이번 회차(지금 계승 단계)에 새긴 끝없는 거울 — 사망 재시작을 넘어 회차 내내 센다.
    ASCEND_MIRROR_ENDLESS_CYCLE: (steps: number, atk: number, hp: number, mp: number) =>
        `이번 회차에 새긴 끝없는 거울 ${steps.toLocaleString('ko-KR')}단계: 영구 공격력 +${atk} · 생명 +${hp} · 기력 +${mp}`,
    ASCEND_MIRROR_ENDLESS_CYCLE_NONE: '이번 회차에는 끝없는 거울을 새기지 않았습니다.',
    // 2026-10 Wave 114: 끝없는 거울 세 능력치가 모두 한계(BALANCE.MIRROR_ENDLESS_MAX_LEVEL)에 닿았다.
    ASCEND_MIRROR_ENDLESS_MAXED: (maxLevel: number) =>
        `끝없는 거울이 한계에 닿았습니다 — 공격력 · 생명 · 기력 모두 ${maxLevel}단계입니다. 정수로 더 새길 능력치는 없습니다.`,
    // 2026-10 Wave 100: 계승 화면 "이번 회차 요약" — 회차 규칙 정복 · 새 전설 각인 · 새 정예 칭호 · 끝없는 거울(Wave 99 줄).
    CYCLE_SUMMARY_TITLE: '이번 회차 요약',
    CYCLE_SUMMARY_RULE_CONQUERED: (rule: string, title: string) => `회차 규칙 [${rule}] 정복 · 칭호 「${title}」`,
    CYCLE_SUMMARY_RULE_DECLINED: (rule: string) => `회차 규칙 [${rule}] 거절 · 정복 보상 없음`,
    CYCLE_SUMMARY_RULE_OPEN: (rule: string) => `회차 규칙 [${rule}] 아직 정복하지 못함`,
    CYCLE_SUMMARY_SIGNATURES: (count: number, names: string, discovered: number, total: number) =>
        `새 전설 각인 ${count}개: ${names} (도감 ${discovered}/${total})`,
    CYCLE_SUMMARY_SIGNATURES_MORE: (shown: string, rest: number) => `${shown} 외 ${rest}개`,
    CYCLE_SUMMARY_SIGNATURES_NONE: (discovered: number, total: number) => `새 전설 각인 없음 (도감 ${discovered}/${total})`,
    CYCLE_SUMMARY_ELITE: (gained: number, owned: number, total: number) => `새 정예 칭호 ${gained}개 (${owned}/${total})`,
    CYCLE_SUMMARY_ELITE_NONE: (owned: number, total: number) => `새 정예 칭호 없음 (${owned}/${total})`,
    // 2026-10 Wave 103 (소유자 결정 §107.6): 아직 도감에 없는 각인 · 장비 · 유물의 이름은 보이지 않는다.
    SIGNATURE_SET_UNKNOWN_CANDIDATE: '아직 발견하지 못한 전설 각인',
    BUILD_ADVICE_UNOWNED_RELICS: (count: number) => `이 성장에 어울리는 유물이 ${count}개 더 있습니다. 어떤 유물인지는 얻어야 알 수 있습니다.`,
    BUILD_ADVICE_UNOWNED_RELICS_NONE: '현재 성장에 어울리는 유물을 모두 보유하고 있습니다.',
    JOB_OUTFIT_UNKNOWN_ITEM: '???',
    JOB_OUTFIT_SEEN: '도감',
    // --- 2026-09 D1: 플레이어가 직접 부르는 정찰 ---
    SCOUT_ACTION_LABEL: '정찰',
    SCOUT_ACTION_COST_LABEL: (gold: number) => `골드 ${gold.toLocaleString('ko-KR')}`,
    SCOUT_ACTION_FREE_LABEL: (remaining: number) => `무료 ${remaining}회 남음`,
    SCOUT_ACTION_HINT: '앞길을 미리 살펴 다음 한 걸음을 고릅니다.',
    SCOUT_SAFE_ONLY: '안전지대에서는 정찰할 곳이 없습니다.',
    SCOUT_BUSY: '지금은 정찰할 수 없습니다.',
    SCOUT_GOLD_INSUFFICIENT: (cost: number) => `정찰에는 골드 ${withJosa(cost.toLocaleString('ko-KR'), '이/가')} 필요합니다.`,
    SCOUT_PAID_LOG: (cost: number) => `골드 ${withJosa(cost.toLocaleString('ko-KR'), '을/를')} 들여 앞길을 정찰합니다.`,
    SCOUT_FREE_LOG: (remaining: number) => `거울의 눈으로 앞길을 정찰합니다. 남은 무료 정찰 ${remaining}회`,
    SCOUT_TIME_PASSES: '정찰하는 동안에도 시간은 흐릅니다.',

    // --- H4 (Wave 3 감사): 엔진/리듀서/탐험 계층의 하드코딩 한국어 회수 ---
    //   문구는 이전과 한 글자도 다르지 않다 — 소유만 MSG로 옮긴다.
    COMBAT_BLIND_MISS: '[실명] 공격이 빗나갔습니다!',
    COMBAT_FEAR_FLINCH: '[공포] 두려움에 움츠립니다!',
    RETURN_SUPPLY_DELIVERED: '귀환 보급 지급 · 하급 체력 물약 1개',
    EXPLORE_KEY_EVENT: '💎 [잊혀진 열쇠]가 빛나며 숨겨진 <고대 보물고> 입구가 열립니다!',
    EXPLORE_RELIC_DISCOVERED: '✨ [유물 발견] 고대의 기운이 느껴집니다! 유물을 선택하세요.',
    EXPLORE_ANOMALY: (desc: string) => `[기상 이변] ${desc}`,
    EXPLORE_ANOMALY_POISON: '자욱한 독안개가 밀려옵니다! (중독)',
    EXPLORE_ANOMALY_MANA_REGEN: '강력한 마력의 폭풍이 붑니다. (기력 30% 회복)',
    EXPLORE_ANOMALY_BURN: '피부를 찌르는 산성비가 내립니다. (화상)',
    EXPLORE_CHAIN_EVENT: (label: string, desc: string) => `📜 [${label}] ${desc}`,
    /** Wave 127: 임무 수령이 연 체인 단계 — 이벤트 없이 다음 단서를 알린다. */
    CHAIN_QUEST_START: (label: string, text: string) => `📜 [${label}] ${text}`,
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
    // 2026-10: 체인 보상의 `buffName`이 없을 때의 일반 이름 — '기사의 혼령'은 이제 최후의 영웅 데이터가 직접 든다.
    CHAIN_REWARD_COMBAT_BONUS_NAME: '이야기의 가호',
    // 2026-10: 이야기 선택지 미리보기 — 진행 머리말과, 체인을 영구히 닫는 선택(`chain_advance_fail`)의 표시.
    //   실패 선택은 진행도를 'failed'로 고정한다 — 2026-10 Wave 108부터 이야기는 사망 · 계승에서 처음부터 다시 하므로 이번 여정에서 끝이다.
    CHAIN_PREVIEW_PROGRESS: '이야기 진행',
    CHAIN_PREVIEW_ENDS: '이야기가 여기서 끝남 · 이번 여정에서는 다시 이어지지 않음',
    // 2026-10 Wave 108 (소유자 결정 "죽으면 모든 게 초기화", Wave 72의 영구 전환을 대체): 이야기 능력치 보상은 이번 여정 범위다 —
    //   이야기도 사망 · 계승에서 처음부터 다시 하므로 다시 얻을 수 있다(Lv30까지 레벨에 비례하는 규칙은 그대로).
    CHAIN_PREVIEW_STAT_BONUS: '이번 여정 능력 상승',
    // Wave 62 C3: 데이터가 전설 등급을 선언한 유물 보상(`reward.rarity === 'legendary'`)은 미리보기도 전설이라 말한다.
    CHAIN_PREVIEW_LEGENDARY_RELIC: '전설 유물 보상',
    // Wave 62 C19: 실제 전투를 여는 이야기 선택지(`outcome.combat`) — 보상 · 진행은 승리했을 때만 정산된다.
    CHAIN_PREVIEW_COMBAT: (rewardLabel: string | null) => (
        rewardLabel ? `전투 시작 · 승리하면 ${rewardLabel}` : '전투 시작 · 승리하면 이야기 진행'
    ),
    // Wave 62 C6: 지금 걸린 강화가 더 세서 이 선택의 강화가 붙지 않을 때 미리보기 끝에 붙인다(정산과 같은 `mergeTempBuff`).
    EVENT_PREVIEW_BUFF_KEPT: '지금 걸린 강화가 더 강해 이 강화는 붙지 않음',
    // 2026-10: 일반 사건 미리보기 — 기력만 잃는 결과를 '생명 손실'로 말하던 결함.
    EVENT_PREVIEW_MP_LOSS: '기력 손실 위험',
    ELITE_ENEMY_PREFIX: '정예',
    ELITE_ENEMY_NAME: (baseName: string) => `정예 ${baseName}`,
    // --- Wave 4 O2: 유물 선택 추천 사유 (빌드 공명 추첨과 표기를 맞춘다) ---
    //   '현재 성장 보완'은 이제 실제로 현재 빌드가 굴리는 효과일 때만 쓴다.
    //   빌드와 무관한 후보는 아래 문구로 구분해 "왜 추천됐는지"가 어긋나지 않게 한다.
    RELIC_REASON_NEW_DIRECTION: '새로운 성장 방향',
    // 2026-09 Wave 47: 유물 선택 시너지 힌트 문구 — RelicChoicePanel에서 utils/relicSynergyHint.ts로 옮기며 MSG 소유로 이동.
    //   두 조각 조합 완성(RELIC_REASON_PAIR_COMPLETE · RELIC_PAIR_COMPLETE_BADGE)은 새 문구다.
    //   Wave 48(소유자 결정 "조합 진행 우선 + 효과 짝 문구 정리"): 조합 보너스가 없는 효과 짝은 '강한/좋은/이어지는 조합'이
    //   아니라 '함께 쓰기 좋음'이다 — '조합'은 실제 조합(RELIC_SYNERGIES)만 부른다.
    RELIC_SYNERGY_LEGENDARY_COMPLETE: '전설 조합 완성',
    RELIC_EFFECT_PAIR_LABEL: '함께 쓰기 좋음',
    RELIC_REASON_EFFECT_PAIR: '현재 유물과 함께 쓰기 좋음',
    RELIC_REASON_PAIR_COMPLETE: '조합 효과 발동',
    RELIC_PAIR_COMPLETE_BADGE: '조합 완성',
    RELIC_SYNERGY_COMPLETE_LINE: (label: string) => `${label} 완성`,
    // Wave 49(소유자 결정 "측정 후 조건부 반영"): 가진 조각이 없는 실제 조합의 첫 조각.
    RELIC_REASON_COMBO_START: '새 조합 시작',
    RELIC_COMBO_START_LINE: (label: string) => `${label} 조합의 첫 조각`,
    // Wave 50(소유자 결정 "조합에 단점을 붙인다"): 조합의 대가 — 문구는 데이터(`drawback`)에서 만든다.
    RELIC_SYNERGY_DRAWBACK_TEXT: {
        damageTaken: (pct: number) => `받는 피해 ${pct}% 증가`,
        def: (pct: number) => `방어력 ${pct}% 감소`,
        atk: (pct: number) => `공격력 ${pct}% 감소`,
    },
    RELIC_SYNERGY_DRAWBACK_LINE: (text: string) => `대가 · ${text}`,

    // 2026-10 보상 · 성장 순간(감사 GF-08 · GF-09 · GF-10 · UX-10 · CL-05): 고른 순간 · 오른 순간이 조용히 지나가지 않게 한다.
    //   모두 화면의 짧은 띠 · 카드 문구다 — 기록 줄은 더하지 않는다(줄 하나가 자연 플레이 측정의 짝 비교를 흔든다, Wave 111).
    //   유물을 받은 순간의 띠: 받은 유물, 그 유물로 켜진 조합은 이름과 대가를 함께(고르는 카드 · 능력치 화면이 이미 보이는 값이다).
    RELIC_ACQUIRED_LABEL: '유물 획득',
    // 보스 · 토벌 의뢰 우두머리가 처음 나타나는 순간의 띠 — 위협 수치는 기록 줄(BOSS_THREAT)에 두고 권고는 붙이지 않는다(Wave 88 · 111).
    BOSS_ENTRY_BANNER: '보스 등장',
    HUNT_CHAMPION_ENTRY_BANNER: '우두머리 등장',
    // 전투 결과 카드: 보스를 쓰러뜨린 카드의 머리말, 탐험할 수 없는 곳(조작판에 탐험 단추가 없는 곳)에서 '계속 탐험' 대신 쓰는 이름.
    POST_COMBAT_BOSS_LABEL: '보스 처치',
    POST_COMBAT_CLOSE_LABEL: '닫기',
    // 레벨 상승 띠의 부제 — 레벨이 다음 직업의 전직 레벨에 닿은 순간. 직업 이름은 말하지 않는다(전직 화면이 고르는 곳이다).
    JOB_CHANGE_READY: '전직할 수 있습니다',

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
        `[${isHellReaper ? HELL_REAPER_LABEL : VAMPIRE_LORD_LABEL}] 생명 +${steal} 흡혈!`
    ),
    RELIC_EXECUTE_PROC: '[처형자의 날] 처형 피해!',
    RELIC_COMBO_PROC: '[연격의 반지] 축적된 연격이 폭발했습니다!',
    RELIC_VOID_HEART_PROC: '[허공의 심장] 허공 각성 일격!',
    RELIC_EXECUTE_ATK_PROC: '[예언의 돌판] 예언 처형! 피해 2배!',
    RELIC_ECHO_ATK_PROC: '[공허의 메아리] 강화된 공격!',
    RELIC_FREEZE_ON_HIT: (enemyName: string | undefined) => `[동결의 닻] ${enemyName} 빙결!`,
    SKILL_BLIND_MISS: '[실명] 기술이 빗나갔습니다!',
    SKILL_ENEMY_STATUS_APPLIED: (skillName: string | undefined, enemyName: string | undefined, label: string) => (
        `[${skillName}] ${enemyName}에게 [${label}] 부여!`
    ),
    SKILL_BRANCH_STATUS_APPLIED: (enemyName: string | undefined, label: string) => (
        `[분기 효과] ${enemyName}에게 [${label}] 추가 부여!`
    ),
    SKILL_DRAIN_HEAL: (heal: number) => `[생명흡수] 생명 +${heal} 흡수!`,
    SKILL_HP_REGEN_PROC: (skillName: string | undefined, heal: number) => `[${skillName}] 생명 +${heal} 회복!`,
    // Wave 51(소유자 결정 "성직자의 컨셉"): 회복의 빛이 언데드 · 마족을 태운다.
    SKILL_HOLY_SMITE: (skillName: string | undefined, enemyName: string | undefined, dmg: number) => `[${skillName}] 신성한 빛이 ${withJosa(enemyName, '을/를')} 태웁니다! ${dmg} 신성 피해`,
    SKILL_REGEN_TICK: (skillName: string, heal: number) => `[${skillName}] 생명 지속 회복 +${heal}`,
    // 2026-10 Wave 54: 기력 지속 회복 · 연속 타격 태그.
    SKILL_MP_REGEN_TICK: (skillName: string, amount: number) => `[${skillName}] 기력 지속 회복 +${amount}`,
    COMBAT_TAG_HITS: (hits: number) => `${hits}연타`,
    SKILL_MP_REGEN_PROC: (skillName: string | undefined, amount: number) => `[${skillName}] 기력 +${amount} 회복!`,
    SKILL_PURIFY_PROC: (skillName: string | undefined) => `[${skillName}] 상태이상이 정화되었습니다!`,
    SKILL_STEALTH_PROC: (skillName: string | undefined) => `[${skillName}] 다음 적 공격을 회피합니다!`,
    // 2026-10 Wave 53: 여러 번 막는 은신 — 두 번째부터 확률이면 그 확률을 함께 말한다.
    SKILL_STEALTH_HITS: (skillName: string | undefined, hits: number, laterChancePct: number | null) =>
        `[${skillName}] 적 공격 ${hits}번을 회피합니다${laterChancePct === null ? '' : `(두 번째부터 ${laterChancePct}%)`}!`,
    RELIC_TIME_MASTER_EXTRA_TURN: '[시간 지배자] 시간이 멈춥니다 — 추가 행동!',
    RELIC_ECHO_ATK_ARMED: '[공허의 메아리] 다음 공격이 강화됩니다!',
    SKILL_CRIT_COOLDOWN_RESET: '[인과율 조작] 치명타! 모든 기술의 재사용 대기 -1턴.',
    RELIC_FIRST_SKILL_FREE: '[시간 군주의 왕관] 첫 기술 기력 소모 없음!',
    RELIC_FREE_SKILL_PROC: '[주문 메아리] 기력 소모 없음!',
    RELIC_SKILL_LIFESTEAL_PROC: (heal: number) => `[영혼 흡수] 생명 +${heal}`,
    RELIC_SKILL_MULT_PROC: '[정신 연소] 기술 피해 강화!',
    RELIC_DOT_MULT_PROC: '[죽음의 낙인] 지속 피해가 증폭됩니다!',

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.enemyAI.ts.
    STEALTH_EVADE_PROC: (enemyName: string | undefined) => `[은신] ${enemyName}의 공격을 회피했습니다!`,
    // 2026-10 Wave 56: 그림자 망토 첫 공격 회피 · 운명의 거울 반사.
    CLOAK_EVADE_PROC: (enemyName: string | undefined) => `[그림자 망토] ${enemyName}의 첫 공격을 회피했습니다!`,
    MIRROR_REFLECT_PROC: (dmg: number) => `[운명의 거울] 받은 피해 반사 ${dmg}!`,
    // 2026-10 Wave 57: 원소 저항 장비 · 혼돈의 심장(빌린 유물 · 켜진 조합) · 혼돈의 보석(전투 내내).
    EQUIP_ELEMENT_RESIST_PROC: (element: string, pct: number, before: number, after: number) => (
        `[${element} 저항] 받는 피해 -${pct}% (${before} → ${after})`
    ),
    EQUIP_RESIST_STAT: (elements: string, pct: number) => `${elements} 피해 -${pct}%`,
    EQUIP_RESIST_ALL_ELEMENTS: '모든 원소',
    EQUIP_REGEN_STAT: (pct: number) => `매 턴 생명 ${pct}% 회복`,
    CHAOS_HEART_BORROW: (name: string, desc: string) => `[혼돈의 심장] 이번 전투 동안 「${name}」 — ${desc}`,
    CHAOS_HEART_SYNERGY: (label: string, drawback: string) => `[혼돈의 심장] 조합 「${label}」${josa(label, '이/가')} 켜졌습니다 (대가: ${drawback})`,
    CHAOS_HEART_BORROWED_TAG: '혼돈의 심장 · 이번 전투',
    CHAOS_GEM_PROC: (stat: 'atk' | 'def', pct: number) => (
        `[혼돈의 보석] 이번 전투 동안 ${stat === 'atk' ? '공격력' : '방어력'} +${pct}%`
    ),
    STEALTH_EVADE_MISS: (enemyName: string | undefined) => `[은신] ${enemyName}에게 들켰습니다!`,
    // 2026-10 Wave 55: 실명 빗나감 · 지속 턴이 끝난 지속 피해.
    ENEMY_BLIND_MISS: (enemyName: string | undefined) => `[실명] ${enemyName}의 공격이 빗나갔습니다!`,
    ENEMY_DOT_EXPIRED: (label: string, enemyName: string | undefined) => `${enemyName}의 ${withJosa(label, '이/가')} 사라졌습니다.`,
    ENEMY_DOT_CHIP_TURNS: (label: string, turns: number) => `${label} · ${turns}턴`,
    ARMOR_EVADE_PROC: (enemyName: string | undefined) => `[회피] ${enemyName}의 공격을 회피했습니다!`,
    ENEMY_PHASE_STATUS_APPLIED: (phase: number, label: string) => `[${phase}페이즈] [${label}] 상태이상 부여!`,
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
    ENEMY_TELEGRAPH_PHASE2_IMMINENT: (formName?: string) => `⚡ 2페이즈 임박 — ${formName || '형태 변환'}`,
    ENEMY_TELEGRAPH_GUARD_HIGH: (pct: number) => `방어 자세 (${pct}%)`,
    ENEMY_TELEGRAPH_HEAVY_HIGH: (pct: number) => `맹공 준비 (${pct}%)`,
    ENEMY_TELEGRAPH_GUARD_MED: (pct: number) => `방어 가능 (${pct}%)`,
    ENEMY_TELEGRAPH_HEAVY_MED: (pct: number) => `맹공 주의 (${pct}%)`,
    ENEMY_TELEGRAPH_NORMAL: '일반 공격 예상',
    // 2026-10 Wave 59: 보스 기믹(소유자 결정 "보스 기믹 전부 설명대로 구현").
    ENEMY_TELEGRAPH_PHASE3_IMMINENT: (formName?: string) => `💀 3페이즈 임박 — ${formName || '최종 형태'}`,
    ENEMY_TELEGRAPH_BREATH: '🔥 브레스 준비 — 다음 행동',
    ENEMY_GUARD_COUNTER_STANCE: (enemyName: string | undefined) => (
        `${withJosa(enemyName, '이/가')} 반격 자세를 취했습니다. 지금 공격하면 반격당합니다.`
    ),
    ENEMY_GUARD_COUNTER_HIT: (enemyName: string | undefined, dmg: number) => `[반격] ${enemyName}의 반격! ${dmg} 피해를 받았습니다.`,
    ENEMY_GUARD_HEAL: (enemyName: string | undefined, heal: number) => `${withJosa(enemyName, '이/가')} 방어 자세로 생명을 ${heal} 회복했습니다.`,
    ENEMY_BREATH_HIT: (enemyName: string | undefined, dmg: number) => `🔥 ${enemyName}의 브레스! ${dmg} 피해를 받았습니다.`,
    ENEMY_SUMMON: (enemyName: string | undefined, summonName: string, count: number) => (
        `${withJosa(enemyName, '이/가')} ${summonName} ${count}체를 깨웠습니다! 공격할 때마다 하나씩 쓰러집니다.`
    ),
    ENEMY_SUMMON_HIT: (summonName: string, count: number, dmg: number) => `[${summonName} ${count}체] 함께 공격! ${dmg} 피해를 받았습니다.`,
    ENEMY_SUMMON_SLAIN: (summonName: string, left: number) => `${summonName} 하나가 쓰러졌습니다. (남은 ${left}체)`,
    ENEMY_LONG_FIGHT_ENRAGE: (enemyName: string | undefined, pct: number) => `[장기전] ${enemyName}의 공격력 +${pct}% — 길어질수록 강해집니다.`,
    LONG_FIGHT_REWARD: (pct: number) => `[장기전 보상] 처치 골드 · 경험 +${pct}%`,
    PLAYER_STATUS_STACKED: (label: string, stacks: number) => `[${label}] ${stacks}중첩 — 효과가 강해집니다!`,
    PLAYER_FROST_BUILDUP: (stacks: number, max: number) => `[냉기 누적] ${stacks}/${max} — ${max}에 닿으면 얼어붙습니다.`,
    PLAYER_FROZEN_BY_FROST: '[빙결] 냉기가 쌓여 얼어붙었습니다!',
    BOSS_RELIC_REWARD: (bossName: string) => `${bossName} 토벌 보상 · 유물 선택`,

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.status.ts.
    ENEMY_DOT_TICK: (label: string, enemyName: string | undefined, dmg: number) => (
        `[${label}] ${enemyName}에게 ${dmg} 지속 피해!`
    ),
    ENEMY_CURSE_DOT_TICK: (enemyName: string | undefined, dmg: number) => `[저주] ${enemyName}에게 ${dmg} 저주 피해!`,

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.relics.ts.
    RELIC_CRIT_MP_RESTORE: (amount: number) => `[피의 갈증] 기력 +${amount}`,
    RELIC_HEAL_ON_SAVE_PROC: (bonus: number) => `[난공불락] 부활하며 생명 +${bonus} 회복!`,
    RELIC_DEATH_SAVE_REVIVE: (count: number) => `[절대 불사] ${count}회 부활!`,
    RELIC_DEATH_SAVE_FIRST: '[불사의 의지] 치명상을 버텼습니다!',
    RELIC_VOID_HEART_REVIVE: '[허공의 심장] 죽음을 거부했습니다. 다음 공격이 강화됩니다!',
    RELIC_REVIVE_TOKEN_USED: '[에테르 부활석] 저장된 에테르가 생명과 기력을 절반까지 되돌렸습니다.',
    RELIC_PHOENIX_REVIVE: (hp: number, atkPercent: number, duration: number) => (
        `[불사조의 깃털] 재의 잿더미에서 부활! 생명 +${hp} · 공격력 +${atkPercent}% (${duration}턴)`
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
    // 2026-10 Wave 131: 조합의 이름을 쓴다("[시너지 처형 분노]"는 화면에 없는 이름이었다 — 화면 용어는 '조합').
    KILL_STACK_SOURCE_SYNERGY: (labels: string) => `[${labels}]`,

    // 2026-09 Wave 6 X2: systems 이관 — CombatEngine.ts.
    RELIC_TURN_MP_REGEN: (val: number) => `[비전 서지] 기력 +${val}`,
    RELIC_TURN_HP_REGEN: (label: string | undefined, heal: number) => `[${label}] 생명 +${heal} 재생`,
    RELIC_LABEL_EARTH_HEART: '대지의 심장',
    RELIC_LABEL_ETERNAL_LIFE: '영원의 생명',
    RELIC_LABEL_GENESIS_CORE: '창세의 핵',
    RELIC_LABEL_ETERNAL_FORTRESS: '영원의 요새',
    HP_DRAIN_ATK_COST_MARKER,
    RELIC_HP_DRAIN_ATK_COST: (label: string | undefined, dmg: number) => `[${label}] ${HP_DRAIN_ATK_COST_MARKER} -${dmg}`,

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
    // 2026-10 Wave 130: 기세 안내는 단계가 바뀔 때만 한 번 나온다(`applyDynamicDifficulty`) — 전투 시작마다 같은 문장이 반복됐다.
    DIFFICULTY_GM_OVERWHELM: '⚔️ 당신의 기세가 압도적입니다 — 약간의 긴장과 함께 보상이 크게 늘어납니다.',
    // 2026-10 Wave 61: 하향 단계는 적만 약하게 하지 않는다 — 처치 골드 · 경험치도 낮춘다(DifficultyManager DIFF_TABLE의 goldMult · expMult < 1).
    DIFFICULTY_GM_CRISIS: '🛡️ 잠시 숨을 고를 시간입니다. 몬스터가 약해지는 대신 얻는 골드와 경험도 줄어듭니다.',
    DIFFICULTY_GM_DISADVANTAGE: '🛡️ 어려운 상황이군요. 몬스터 강도를 낮추는 대신 얻는 골드와 경험도 조금 줄어듭니다.',

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
        `${completedName} 완주! ${withJosa(nextName, '이/가')} 열렸습니다 · 보상 규모 ×${scale}`
    ),
    SEASON_ROTATION_TITLE: '시즌이 끝나면',
    /** 완주 안내 — 남은 수령 수와 다음 시즌 보상 배율을 함께 보여준다. */
    SEASON_ROTATION_NOTICE: (nextName: string, scale: string) => (
        `30단계 보상을 모두 받으면 ${withJosa(nextName, '이/가')} 열립니다 · 숫자 보상 ×${scale}`
    ),
    SEASON_CLAIMS_REMAINING: (remaining: number) => `완주까지 남은 보상 ${remaining}개`,
    SEASON_CLAIMS_READY: '마지막 보상을 받으면 다음 시즌이 시작됩니다',
    SEASON_SCALE_BADGE: (scale: string) => `보상 ×${scale}`,
    // 2026-10 Wave 61: 시즌 보상 줄의 칭호 — 이미 가진 칭호는 수령해도 다시 지급되지 않는다(CLAIM_SEASON_REWARD).
    SEASON_REWARD_TITLE: (title: string) => `칭호 ${title}`,
    SEASON_REWARD_TITLE_OWNED: (title: string) => `칭호 ${title} (보유 중)`,
    SEASON_ARCHIVE_TITLE: '지난 시즌 기록',
    SEASON_ARCHIVE_EMPTY: '아직 완주한 시즌이 없습니다',
    SEASON_ARCHIVE_SUMMARY: (count: number) => `완주 ${count}회`,
    SEASON_ARCHIVE_ENTRY: (name: string, claimedCount: number) => (
        `${name} · 보상 ${claimedCount}개 수령`
    ),

    // 2026-09 Wave 13 E2: 지역의 선언 레벨과 실제 진입 레벨(경로 게이트)이 갈라지는 곳(Wave 27 실측 16곳).
    //   선언 레벨은 그 지역 자신의 잠금(`getMapAccess`가 비교하는 값)이고, 경로 게이트는
    //   시작의 마을에서 실제로 걸어 들어갈 수 있게 되는 레벨이다(`utils/mapRouteGate.ts`).
    //   표시만 정직하게 하고 잠금 자체는 바꾸지 않는다 — 그래서 문구가 둘을 함께 말한다.
    MAP_ROUTE_GATE_LEVEL: (routeLevel: number) => `실제 진입 레벨 ${routeLevel}`,
    // 2026-10 Wave 61: 지도 목록 띠의 레벨 범위 — 그 띠에 실제로 놓인 지역의 최소 ~ 최대(MapNavigator가 센다).
    MAP_BAND_LEVEL_RANGE: (minLevel: number, maxLevel: number) => (
        minLevel === maxLevel ? `레벨 ${minLevel}` : `레벨 ${minLevel}~${maxLevel}`
    ),
    MAP_BAND_LEVEL_FROM: (minLevel: number) => `레벨 ${minLevel} 이상`,
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

    // Wave 19 K1 — AI 이벤트 "준비 중" 모드(GS.EVENT_PENDING)의 문구.
    /** 준비 중 패널 본문. 예전에는 ControlPanel JSX에 한국어로 박혀 있었다. */
    AI_EVENT_PREPARING: '이야기를 준비하고 있습니다...',
    /** 준비 중에 들어온 터미널 명령 안내 — 선택지가 아직 없으므로 1/2/3을 말하지 않는다. */
    AI_EVENT_PREPARING_BLOCKED: '이야기를 준비하는 중입니다. 잠시만 기다려 주세요.',
    /** 생성 호출 자체가 실패했을 때(폴백도 못 고른 경우) 남기는 로그. */
    AI_EVENT_FAILED: '이야기를 불러오지 못했습니다. 탐험을 다시 시도해 주세요.',

    // Wave 20 L1 — 터미널(`utils/commandParser.ts`)의 한국어 14자리.
    //   §5 DO("한국어 로그 메시지는 MSG 객체에서")가 유일하게 비어 있던 표면이다.
    //   파서가 `Record<GameMode, string | null>`로 전수화되면서 같은 객체를 다시
    //   타이핑하게 됐으므로 함께 옮긴다.

    // ── 모드별 차단 안내 (`blockedStateMessages`) ────────────────────────────
    //   `event_pending`은 위 `AI_EVENT_PREPARING_BLOCKED`가 이미 소유한다.
    CMD_BLOCKED_EVENT: '이벤트 진행 중입니다. 1, 2, 3 중 하나를 선택하세요.',
    CMD_BLOCKED_JOB_CHANGE: '전직 선택 중입니다. 화면에서 직업을 선택하거나 닫아 주세요.',
    CMD_BLOCKED_QUEST_BOARD: '임무 게시판이 열려 있습니다. 수락 또는 닫기를 먼저 완료하세요.',
    CMD_BLOCKED_SHOP: '상점 이용 중입니다. 다른 행동은 상점을 닫은 뒤 진행하세요.',
    CMD_BLOCKED_CRAFTING: '제작 화면이 열려 있습니다. 제작을 완료하거나 닫아 주세요.',
    CMD_BLOCKED_ASCENSION: '계승 여부를 먼저 결정해야 합니다.',
    CMD_BLOCKED_DEAD: '여정이 끝났습니다. 결과 화면에서 다시 시작하세요.',

    // ── 명령 응답 ────────────────────────────────────────────────────────────
    CMD_SKILL_CYCLED: '기술 칸을 전환했습니다.',
    /** `[상태]` 접두사는 `command-surface-contract`가 읽는다 — 바꾸지 말 것. */
    //   인자 대부분이 `| undefined`인 것은 기존 템플릿 리터럴의 동작을 그대로
    //   보존하기 위해서다(`Player`에서 전부 선택 필드다 — MSG의 기존 관례와 같다).
    CMD_STATUS: (
        level: number | undefined, name: string | undefined, job: string | undefined,
        hp: number | undefined, maxHp: number, mp: number | undefined,
        maxMp: number | undefined, gold: number | undefined, loc: string | undefined,
    ) => (
        `[상태] 레벨 ${level} ${name} (${job}) | 생명: ${hp}/${maxHp} | 기력: ${mp}/${maxMp} | 골드: ${gold} | 위치: ${loc}`
    ),
    CMD_INVENTORY: (count: number) => `[가방] 아이템 ${count}개`,
    CMD_QUEST: (count: number) => `[임무] ${count}개 진행 중`,
    CMD_MAP: (visited: number, total: number, loc: string | undefined) => (
        `[지도] 발견한 지역 ${visited}/${total} | 현재 위치: ${loc} | 이동은 move <지역> 명령으로 진행`
    ),
    /** 2026-10 Wave 62 (원장 §61.2 A10): 길 잃은 여행 — 지도 명령도 위치 · 탐험 지도를 드러내지 않는다. */
    CMD_MAP_BLIND: '[지도] 지도 정보가 숨겨져 있습니다 | 이동은 move <지역> 명령으로 진행',
    CMD_HELP: '이동: move <지역>\n행동: explore, rest, shop\n전투: attack(a), skill(s), nextskill(sn), escape(r)\n정보: status, inventory, quest, map',
    CMD_UNKNOWN: (command: string) => `알 수 없는 명령어: ${command} (/help)`,

    // ── Wave 27 N1: 이벤트 선택 거부 안내 ────────────────────────────────────
    //   선택이 거부돼 이벤트가 열린 채 남으면(비용 부족·가방 가득·무효 제안) 리듀서가 같은
    //   문장을 오류 로그와 `currentEvent.choiceFeedback`에 싣는다 — 이벤트 화면은
    //   FOCUS_PANEL_STATES라 TerminalView(로그)가 마운트되지 않으므로, 플레이어는 누른
    //   선택지의 미리보기 줄에서 이 문장을 본다(eventPresentation.getEventChoicePreview).
    EVENT_CHOICE_OFFER_INVALID: '이 제안은 더 이상 유효하지 않습니다. 다른 선택지를 고르거나 뒤로 나가세요.',
    EVENT_CHOICE_INVENTORY_FULL: '가방이 가득 차 보상을 받을 수 없습니다. 가방을 정리한 뒤 다시 고르세요.',
    EVENT_CHOICE_RESOURCE_LABELS: { hp: '생명', mp: '기력', gold: '골드' },
    EVENT_CHOICE_RESOURCE_SHORT: (label: string, required: number, current: number) => (
        `${label} ${required} 필요 · 현재 ${current}`
    ),
    EVENT_CHOICE_COST_UNPAYABLE: (detail: string) => (
        detail ? `지금은 대가를 치를 수 없습니다 (${detail})` : '지금은 대가를 치를 수 없습니다.'
    ),
    FALLBACK_HP_POTION_REQUIRED: '체력 회복 물약이 필요합니다.',

    // Wave 27 N2 — 유물 보유 상한에서의 교체 흐름(D3).
    //   상한에 닿은 뒤 들어온 유물(체인 완주 보상 · 심연 마일스톤 선택지)은 사라지지도,
    //   상한을 넘지도 않는다 — 유물 선택 패널이 "보유 유물 하나와 교체"를 제안한다.
    /** 체인 완주 보상 유물이 상한에서 교체 제안으로 바뀔 때의 로그. */
    CHAIN_REWARD_RELIC_REPLACE_OFFER: (name: string) => (
        `이야기 보상 · 유물 ${name} — 칸이 가득 찼습니다. 보유 유물 하나와 바꾸거나 넘길 수 있습니다.`
    ),
    /** 상한에서 교체 없이 추가하려 할 때(`ADD_RELIC`) 남기는 거부 안내. */
    RELIC_SLOTS_FULL_REPLACE: '유물 칸이 가득 찼습니다. 보유 유물 하나와 바꾸거나 이번에는 고르지 마세요.',
    RELIC_REPLACED: (released: string, gained: string) => `유물 교체 · ${released} → ${gained}`,
    /** 유물 선택 패널 — 상한일 때만 보이는 안내 줄. */
    RELIC_CHOICE_CAPACITY_FULL: (owned: number, capacity: number) => (
        `유물 칸 ${owned}/${capacity} · 새 유물을 고르면 보유 유물 하나와 바꿉니다.`
    ),
    RELIC_REPLACE_PROMPT: (name: string) => `${name} 대신 내려놓을 유물을 고르세요.`,
    RELIC_REPLACE_OPTION_LABEL: (released: string, gained: string) => `${released} 내려놓고 ${gained} 받기`,
    RELIC_REPLACE_BACK: '다른 유물 보기',

    // ── Wave 62 — 강해지는 쪽 규칙(C3 · C4 · C5 · C6) · 약해지는 쪽 서사(C19) ──
    /** C3: "전설의 유물"을 약속한 이야기 보상인데 전설 유물을 모두 가졌을 때 — 남은 가장 높은 등급으로 내려간다. */
    CHAIN_REWARD_RELIC_RARITY_FALLBACK: (promised: string, given: string) => (
        `이야기 보상 · ${promised} 유물을 이미 모두 가졌습니다. 남은 가장 높은 등급(${given})에서 고릅니다.`
    ),
    /** C4: 정찰 "정예의 흔적" 보장 유물이 유물 칸이 가득 찬 채 열릴 때. */
    SCOUT_RELIC_REPLACE_OFFER: '정예의 흔적 보상 · 유물 선택 — 칸이 가득 찼습니다. 보유 유물 하나와 바꾸거나 넘길 수 있습니다.',
    /** Wave 77: 유물 칸이 가득 찬 채 탐험에서 유물을 발견했을 때 — 교체 제안으로 열린다. */
    /** Wave 79: 칸이 찼고 지금 유물보다 나은 카드가 없을 때 — 선택 화면 대신 계승 정수(유물의 잔향). */
    EXPLORE_RELIC_ECHO: (essence: number) => (
        `✨ [유물의 잔향] 유물을 발견했지만 지금 가진 유물보다 나은 것이 없습니다. 남은 기운을 거둡니다 — 계승 정수 +${essence}`
    ),
    // 2026-10 Wave 80: 지역 토벌 의뢰
    HUNT_CONTRACT_POSTED: (map: string, goal: number) => `📜 [토벌 의뢰] ${map} — 이 지역의 마물을 ${goal}마리 처치하십시오. (임무 탭)`,
    HUNT_CONTRACT_STAGE_KILLS_DONE: (map: string, gold: number, traceGoal: number, elitePoints: number) => (
        `📜 [토벌 의뢰] ${map} 1단계 완료 — 골드 +${gold}. 다음: 정예 추적 ${traceGoal}점(정예 처치 +${elitePoints} · 일반 처치 +1)`
    ),
    HUNT_CONTRACT_STAGE_ELITES_DONE: (map: string, materials: number, material: string, champion: string, omenKills: number) => (
        `📜 [토벌 의뢰] ${map} 2단계 완료 — ${material} ×${materials}. 우두머리 「${champion}」의 기척이 느껴집니다 — 이 지역에서 ${omenKills}마리를 더 쓰러뜨리면 모습을 드러냅니다`
    ),
    HUNT_CONTRACT_COMPLETE: (map: string, champion: string, item: string, essence: number) => (
        `🏆 [토벌 의뢰 완수] ${map} 우두머리 「${champion}」 토벌 — ${item} · 계승 정수 +${essence}`
    ),
    HUNT_CHAMPION_NAME: (champion: string, species: string) => `${champion} ${species}`,
    HUNT_CHAMPION_ENRAGED_NAME: (champion: string, species: string) => `격노한 ${champion} ${species}`,
    HUNT_CHAMPION_ENRAGE_LOG: (champion: string) => `「${champion}」 격노 — 공격이 거세집니다!`,
    HUNT_CHAMPION_NEAR: (champion: string, map: string) => `⚠️ [토벌 의뢰] ${map} — 우두머리 「${champion}」 접근. 다음 조우를 대비하십시오`,
    HUNT_CHAMPION_APPEAR: (champion: string, map: string) => `⚔️ [토벌 의뢰] ${map} 우두머리 「${champion}」 출현!`,
    // Wave 86: 준비 안내 — 우두머리는 그 지역에서 기다린다(기척은 떠나도 남는다).
    HUNT_CHAMPION_PREPARE: (hpPct: number, mpPct: number) => `🛡️ 준비가 부족합니다 — 생명 ${hpPct}% · 기력 ${mpPct}%. 안전지대에서 쉬고 와도 우두머리는 이 지역에서 기다립니다`,
    HUNT_CHAMPION_UNPREPARED: (hpPct: number, mpPct: number) => `🛡️ 생명 ${hpPct}% · 기력 ${mpPct}%로 맞섭니다 — 위험하면 도주하십시오. 우두머리는 쫓지 않습니다`,
    // Wave 87: 격노 강타 예상치 — 실제 엔진으로 계산한 한 방(최대 생명의 몇 % · 몇 번에 쓰러지는지).
    // Wave 88: 보스 출현 · 게이지 도전 카드 — 마지막 페이즈 강타 · 브레스 가운데 가장 센 한 행동(하수인 포함, utils/enemyThreat.ts).
    BOSS_THREAT: (hit: number, maxHp: number, pct: number, hits: number) => `🩸 보스의 가장 센 한 방 예상 최대 ${hit} — 최대 생명 ${maxHp}의 ${pct}% (${hits}번에 쓰러짐)`,
    HUNT_CHAMPION_THREAT: (hit: number, maxHp: number, pct: number, hits: number) => `🩸 격노 강타 예상 최대 ${hit} — 최대 생명 ${maxHp}의 ${pct}% (${hits}번에 쓰러짐)`,
    // 2026-10 Wave 111 (소유자 결정 — 1회차 초반 사망 감사 원장 §117): 정예(보스 · 의뢰 우두머리 제외)도 나타날 때 격노 강타를 포함한
    //   가장 센 한 방을 보인다. 정보만이다 — 물약 · 도주 판단은 플레이어 몫(Wave 88 원칙).
    ELITE_THREAT: (hit: number, maxHp: number, pct: number, hits: number) => `🩸 정예의 가장 센 한 방 예상 최대 ${hit} — 최대 생명 ${maxHp}의 ${pct}% (${hits}번에 쓰러짐)`,
    ELITE_COMBAT_CHIP: (pct: number, hits: number) => `정예 · 한 방 최대 생명의 ${pct}% · ${hits}번에 쓰러짐`,
    // 2026-10 감사 CL-06: 보스도 싸우는 동안 같은 모양의 칩 — 나타날 때의 기록 줄(BOSS_THREAT)과 같은 추정기. 정보만이다(Wave 88).
    BOSS_COMBAT_CHIP: (pct: number, hits: number) => `보스 · 한 방 최대 생명의 ${pct}% · ${hits}번에 쓰러짐`,
    // 2026-10 감사 CL-09: 보스 카드의 대응 문구는 '공략 요령'이다 — 판단 요약 칸의 '권장 대응'(선택한 기술 기준, 원장 §135.5 현행 유지)과
    //   같은 이름 아래 다른 말을 하고 있었다.
    COMBAT_BOSS_SIGNATURE_LABEL: '보스 기믹',
    COMBAT_BOSS_CLUE_LABEL: '공략 요령',
    // 2026-10 감사 CL-03: 전투 기술 칸 — 가진 기술을 모두 펼쳐 누르면 바로 쓴다(이전에는 한 개 + 이름 없는 순환 단추).
    COMBAT_SKILL_TRAY_ARIA: '전투 기술',
    COMBAT_SKILL_READY_LABEL: '준비한 기술',
    COMBAT_SKILL_CHIP_COOLDOWN: (turns: number) => `${turns}턴`,
    // 칸마다 약점 표시 — 누르면 곧바로 쓰므로 쓰기 전에 볼 곳이 칸이다(전투 예고의 '… 약점'과 같은 판정, 정보만).
    COMBAT_SKILL_CHIP_WEAK: '약점',
    // 2026-10 감사 VD-02 · GF-05: 전투 조작판의 내 생명 · 기력 막대 — 맞으면 이 칸이 번쩍인다.
    COMBAT_VITALS_ARIA: '내 생명 · 기력',
    COMBAT_VITALS_HP: '생명',
    COMBAT_VITALS_MP: '기력',
    HUNT_CHAMPION_ESCAPE: '🏃 우두머리는 쫓지 않습니다 — 기척은 남아 이 지역에서 다시 맞설 수 있습니다',
    HUNT_CONTRACT_STATUS_UNREADY: (hpPct: number, mpPct: number) => ` · 준비 부족(생명 ${hpPct}% · 기력 ${mpPct}%)`,
    HUNT_CONTRACT_PANEL_TITLE: '지역 토벌 의뢰',
    HUNT_CONTRACT_PANEL_HINT: '회차마다 다시 — 처치 · 정예 · 우두머리, 5차까지',
    HUNT_CONTRACT_STAGE_LABELS: ['처치', '정예 추적', '우두머리'] as const,
    HUNT_CONTRACT_STATUS_LOCKED: (level: number) => `레벨 ${level} 지역`,
    HUNT_CONTRACT_STATUS_STAGE: (stage: number, label: string, progress: number, goal: number) => `${stage}단계 ${label} ${progress}/${goal}`,
    HUNT_CONTRACT_STATUS_CHAMPION: (champion: string) => `3단계 우두머리 「${champion}」 — 이 지역에서 탐험`,
    HUNT_CONTRACT_STATUS_OMEN: (champion: string, progress: number, goal: number) => `3단계 우두머리 「${champion}」의 기척 ${progress}/${goal}`,
    HUNT_CONTRACT_STATUS_DONE: '완수',
    HUNT_CONTRACT_ROUND_TAG: (round: number, max: number) => `${round}/${max}차 · `,
    HUNT_CONTRACT_NEXT_ROUND: (map: string, round: number, max: number, killGoal: number) => (
        `📜 [토벌 의뢰] ${map} ${round}/${max}차 의뢰가 이어집니다 — 처치 ${killGoal}부터, 우두머리는 더 강해집니다`
    ),
    EXPLORE_RELIC_REPLACE_OFFER: '✨ [유물 발견] 고대의 유물이 눈에 들어옵니다 — 칸이 가득 찼습니다. 보유 유물 하나와 바꾸거나 넘길 수 있습니다.',
    /** C4: 사건 결과가 여는 유물 선택이 유물 칸이 가득 찬 채 열릴 때. */
    EVENT_RELIC_REPLACE_OFFER: (count: number) => (
        `기묘한 기운이 남았습니다. 유물 선택지 ${count}개 — 칸이 가득 찼습니다. 보유 유물 하나와 바꾸거나 넘길 수 있습니다.`
    ),
    /** C5: 회피 뒤 그 지역을 이만큼 더 탐험하는 동안 보스 카드가 뜨지 않는다(게이지는 만충 그대로). */
    BOSS_GAUGE_AVOID_SUPPRESSED: (explores: number) => (
        `이 지역을 ${explores}번 더 탐험하는 동안에는 보스를 피해 다닙니다. 그 뒤 다시 도전할 수 있습니다.`
    ),
    /** C6: 들어온 강화가 지금 걸린 강화보다 약해(세기 = 증가량 × 남은 턴) 적용되지 않았을 때. */
    TEMP_BUFF_KEPT_STRONGER: (incoming: string, kept: { atk: number; def: number; counter: number; turns: number }) => {
        const parts = [
            kept.atk !== 0 && `공격력 ${kept.atk > 0 ? '+' : ''}${kept.atk}%`,
            kept.def !== 0 && `방어력 ${kept.def > 0 ? '+' : ''}${kept.def}%`,
            kept.counter > 0 && `반격 ${kept.counter}%`,
        ].filter(Boolean).join(' · ');
        return `지금 걸린 강화(${parts} · ${kept.turns}턴)가 더 강해 ${withJosa(incoming, '은/는')} 적용되지 않았습니다.`;
    },
    WAR_DRUM_BUFF_LABEL: '전쟁의 북',
    WAR_DRUM_BUFF_LOG: (atkPercent: number, turns: number) => `[전쟁의 북] 전투 시작 공격력 +${atkPercent}% (${turns}턴)`,
    // 2026-10 Wave 130: 전투 시작 유물 기록 — 훅에 있던 "+N HP" 문구를 옮겼다.
    RELIC_BATTLE_START_HEAL: (heal: number) => `[재생 코어] 전투 시작 회복 · 생명 +${heal}`,
    RELIC_CURSED_POWER_START_COST: (selfDamage: number) => `[저주받은 반지] 전투 시작 대가 · 생명 -${selfDamage}`,
    // 2026-10 Wave 130: 발견 체인 완료 — 보상 줄이 "300G, 200 EXP"였다.
    DISCOVERY_JOURNEY_DESC: (desc: string) => `🔍 ${desc}`,
    DISCOVERY_JOURNEY_COMPLETE: (label: string, rewards: string) => `🏆 [발견 여정 완료] ${label}! 보상: ${rewards}`,
    DISCOVERY_JOURNEY_REWARD_GOLD: (gold: number) => `골드 ${gold}`,
    DISCOVERY_JOURNEY_REWARD_EXP: (exp: number) => `경험 ${exp}`,
    DISCOVERY_JOURNEY_REWARD_CRYSTAL: (count: number) => `크리스탈 ${count}`,
    // 2026-10 Wave 130: 지난 원정 요약 줄 — "+N EXP"였다.
    LAST_EXPEDITION_SUMMARY_LINE: (battles: number, explores: number, expGained: number) =>
        `전투 ${battles} · 탐험 ${explores} · 경험 +${expGained.toLocaleString('ko-KR')}`,
    CAMPFIRE_FORGE_BUFF_NAME: '모닥불 단련',
    /** C19: 체인 전투 선택지 — 이야기 전투에서 지거나 물러나면 그 단계는 다시 찾아온다. */
    CHAIN_COMBAT_RETRY_NOTICE: '이 시험은 이기기 전까지 끝나지 않습니다. 물러나거나 쓰러져도 같은 자리에서 다시 마주칩니다.',

    // ── Wave 28 P1 — 서명 사본 판매(D4) ──
    //   쓸 수 있는 유일한 사본만 보호한다. 도감 기록은 획득 순간에 남으므로 판매해도 수집은 사라지지 않는다.
    SIGNATURE_SELL_LOCKED: '전설 각인 — 판매 불가',
    SIGNATURE_SELL_PROTECTED_BADGE: '보호됨',
    SIGNATURE_SELL_DUPLICATE: '전설 각인 사본 — 한 점은 남습니다 · 도감 기록 유지',
    SIGNATURE_SELL_OFF_PATH: '전설 각인 — 지금 직업과 앞으로의 전직으로는 착용 불가 · 도감 기록 유지',

    // ── Wave 28 P3 — 계승 제안 미루기(D6) ──
    //   한 번 미루면 이번 여정에서는 마왕을 다시 쓰러뜨려도 계승 화면이 뜨지 않는다. 조작판에서 다시 연다.
    // 2026-09 Wave 40: 계승 화면 — 다음 세계의 적 전투 레벨 가산과 영구 스탯 레벨 연동.
    ASCENSION_ENEMY_LEVEL_BONUS: (current: number, next: number) => `적 전투 레벨 +${current}% → +${next}%`,
    ASCENSION_META_RAMP: (level: number) => `영구 능력치는 레벨에 비례해 적용되고 레벨 ${level}에 전부 적용됩니다. 매 여정은 약하게 시작합니다.`,
    STATS_META_RAMP: (percent: number, level: number) => `지금 ${percent}% 적용 · 레벨 ${level}에 전부 적용`,
    // 2026-10 Wave 130: 사망 화면 · 진 엔딩의 레벨 표기 — "Lv.25"였다(화면 용어는 "레벨 N").
    LEVEL_LABEL: (level: number) => `레벨 ${level}`,
    ASCENSION_DEFERRED_NOTICE: '이번 여정에서는 마왕을 다시 쓰러뜨려도 계승을 묻지 않습니다. 준비되면 조작판의 [계승하기]를 누르세요.',
    DEMON_KING_SLAIN_ASCEND_DEFERRED: '⚡ 마왕이 쓰러졌습니다. 계승은 조작판의 [계승하기]에서 언제든 선택할 수 있습니다.',
    ASCENSION_REOPEN_LABEL: '계승하기',

    // ── Wave 28 P4 — 임무 목표 지역의 실제 진입 레벨 ──
    //   수락 규칙은 그대로다. 지금 레벨로 아직 걸어 들어갈 수 없는 목표 지역일 때만 보인다.
    QUEST_OBJECTIVE_GATE_NOTICE: (map: string, level: number) => `목표 지역 ${map} · 레벨 ${level}부터 걸어서 진입`,
    // 2026-10 임무 문구 감사: 평생 누적 기록으로 진행도를 읽는 임무(`isLifetimeCounterQuest`) 표시.
    //   수락 순간 이미 채워져 있을 수 있다 — 수락 뒤부터 세는 임무처럼 읽히지 않게 목표 줄 앞에 붙인다.
    QUEST_LIFETIME_COUNTER_CHIP: '누적',
    QUEST_LIFETIME_COUNTER_HINT: '수락하기 전의 기록도 함께 셉니다.',

    // ── Wave 129 — 이름 뒤 조사는 받침에 맞춘다(data/koreanParticles.ts) ──
    //   utils · 컴포넌트가 이름 뒤에 고정 조사를 붙이던 문구다("도적로 전직" · "수정 동굴으로 출발").
    TOWN_DEPART_FIRST: (destination: string) => `${withJosa(destination, '으로/로')} 첫 출발`,
    TOWN_DEPART: (destination: string) => `${withJosa(destination, '으로/로')} 출발`,
    MAP_MOVE_TO: (name: string) => `${withJosa(name, '으로/로')} 이동`,
    MAP_MOVE_TO_BLIND: '이 경로로 이동',
    JOB_CHANGE_CONFIRM: (jobName: string) => `${withJosa(jobName, '으로/로')} 전직`,
    SKILL_BRANCH_CONFIRM: (branchLabel: string | undefined) => `${withJosa(branchLabel, '으로/로')} 성장 확정`,
    SKILL_BRANCH_QUESTION: (skillName: string) => `${withJosa(skillName, '을/를')} 어떻게 바꿀까?`,
    CODEX_COMPARE_EQUIPPED: (itemName: string | undefined) => `현재 ${withJosa(itemName, '과/와')} 비교`,
    QUEST_ABANDON_PROGRESS_LOSS: (progressText: string) => `지금까지의 진행도 ${withJosa(progressText, '이/가')} 사라집니다.`,
    QA_EVENT_MULTIPLIER_SET: (value: number) => `이벤트 보상 배율을 ${withJosa(`x${value}`, '으로/로')} 바꿨습니다.`,
    RETURN_REST_GOLD: (cost: string) => `골드 ${withJosa(cost, '으로/로')} 생명과 기력을 모두 회복합니다.`,
    RETURN_USE_RECOVERY_ITEM: (itemName: string | undefined) => `${withJosa(itemName, '을/를')} 사용해 다음 출발을 준비하세요.`,
    RETURN_BUY_SUPPLY: (itemName: string | undefined) => `${withJosa(itemName, '을/를')} 마련해 다음 원정의 위험을 낮추세요.`,
    TRAIT_LOOT_SUMMARY: (traitName: string) => `${withJosa(traitName, '과/와')} 잘 맞는 전리품입니다.`,
    TRAIT_LOOT_SUMMARY_DEFAULT_TRAIT: '현재 성향',
    ELITE_ENRAGE_LOG: (baseName: string) => `${withJosa(baseName, '이/가')} 광폭화합니다! 공격이 거세집니다!`,

    // ── Wave 131 — 한 개념, 한 이름 ──
    //   같은 개념을 화면 · 기록이 두 이름으로 부르던 곳이다("퀘스트 수락"과 '임무' 탭, "에센스 +5"와 '계승 정수',
    //   "엘리트 몬스터"와 '정예', "도망" 단추와 '도주' 기록, '무덤' 탭과 '묘비'). 화면 이름은 탭 · 게시판 · 단추가 쓰는 쪽이다.
    ELITE_APPEAR: '⚠️ 정예 개체가 나타났습니다!',
    ELITE_PREFIX_APPEAR: (prefix: string) => `⚠️ [${prefix}] 정예 개체가 나타났습니다!`,
    PREFIX_APPEAR: (prefix: string) => `[${prefix}] 개체가 나타났습니다.`,
    MOBILE_SUMMARY_QUEST_PILL: (done: number, total: number) => `임무 ${done}/${total}`,
    QUEST_EMPTY_TOWN_HINT: '마을 게시판에서 새 임무를 수락할 수 있습니다.',
    QUEST_EMPTY_FIELD_HINT: '마을로 이동하면 임무 게시판을 이용할 수 있습니다.',
    ESSENCE_REWARD: (amount: number) => `계승 정수 +${amount}`,
    PRESTIGE_RANK_LABEL: (rank: number) => `계승 ${rank}단계`,
    TRUE_ENDING_STAT_PRESTIGE: '계승 단계',
    QUICK_SLOT_EMPTY_LABEL: (slot: number) => `빠른 칸 ${slot} (가방에서 할당)`,
    BAG_AUTOSELL_NOTICE: (count: number, capacity: number, sellable: number) => `가방 ${count}/${capacity} — 저가 재료 ${sellable}개 정리 가능`,
    STATUS_AILMENT_ARIA: (count: number, labels: string) => `상태이상 ${count}개: ${labels}`,
    ENEMY_DEBUFF_LABEL: '적 약화',
    ENEMY_DEBUFF_ARIA: (labels: string) => `적 약화: ${labels}`,
    COMBAT_ACTION_ESCAPE: '도주',
    GRAVE_MINE_HEADING: '내 유해',
    GRAVE_RECOVERY_ITEMS_LABEL: '장비 · 아이템',
    GRAVE_UNNAMED_ITEM: '이름 없는 아이템',
    SYNTHESIS_SELECT_REQUIRED: (count: number) => `같은 종류 · 같은 등급 장비 ${count}개를 골라야 합성할 수 있습니다.`,
    SYNTHESIS_SELECT_HINT: (count: number) => `같은 종류 · 같은 등급 장비 ${count}개 선택`,
    SYNTHESIS_PANEL_META: '같은 등급 장비를 골라 합성 결과를 확인합니다.',

    // ── 통합 수용 6차(원장 §144) — 한 판의 이름은 '여정'이다 ──
    //   사망 화면 한 장이 끝난 한 판을 "이번 모험 기록" · "모험 종료" · "새 모험 시작"과 "다음 여정에 남는 것"으로 함께 불렀다.
    //   '모험 기록'(기록 콘솔) · '모험 도감' · 직업 '모험가'는 다른 개념의 이름이라 그대로다.
    RUN_SUMMARY_EYEBROW: '이번 여정 기록',
    RUN_SUMMARY_ENDED_AT: (loc: string) => `${loc}에서 여정 종료`,
    RUN_SUMMARY_PARTIAL_TRACKING: '업데이트 이후의 이번 여정 기록만 집계했습니다.',
    RUN_SUMMARY_REFLECTION_ARIA: '여정 종료 원인과 다음 여정 요약',
    // 2026-10 감사 UX-14: 사망 화면 한 장이 다음 판을 '다음 시도'와 '다음 여정에 남는 것'으로 함께 불렀고, 돌아보기 칸은
    //   "연속 처치 운영 유효" · "보스권 도달" 같은 전보체 · 은어였다. 다음 판은 '다음 여정'이고 칸은 플레이어 말이다.
    //   어느 칸을 고르는지는 utils/outcomeAnalysis.ts(`getRunSummaryReflectionStrip`)가 판정한다.
    RUN_SUMMARY_NEXT_JOURNEY_LABEL: '다음 여정 추천',
    RUN_REFLECTION_LABELS: { result: '결과', lesson: '배운 점', next: '다음 여정' },
    RUN_REFLECTION: {
        steady: { cause: '고르게 성장함', lesson: '여정을 돌아봄', next: '같은 방향으로 더 강하게' },
        escapes: { cause: '도주가 잦았음', lesson: '싸우기 전 준비가 부족함', next: '회복과 장비 점검' },
        relics: { cause: '유물이 적었음', lesson: '이벤트를 더 만나야 함', next: '새 지역과 임무 찾기' },
        bossGate: { cause: '보스 앞에서 멈춤', lesson: '방어와 회복이 부족함', next: '소모품 넉넉히 챙기기' },
        kills: { cause: '싸움이 적었음', lesson: '초반 사냥이 짧았음', next: '첫 지역 더 탐험하기' },
        gold: { cause: '골드가 적었음', lesson: '구매 시점이 중요함', next: '상점과 전리품 비교하기' },
        discovery: { cause: '가 본 지역이 적었음', lesson: '이벤트를 놓쳤음', next: '새 지역 가 보기' },
        streakBroken: { cause: '연속 처치가 끊김', lesson: '흐름을 잇지 못함', next: '약한 적부터 처치하기' },
        breakthrough: {
            causeBoss: '보스 구간에 닿음',
            causeStreak: '연속 처치가 강했음',
            causeDiscovery: '넓게 탐험함',
            lessonStreak: '연속 처치가 통함',
            lessonDiscovery: '넓은 탐험이 통함',
            lessonGrowth: '성장 방향이 맞았음',
            nextBoss: '다른 속성 무기 준비',
            nextKeep: '같은 강점 이어 가기',
        },
        growth: { cause: '보스를 쓰러뜨렸음', lesson: '기반은 충분했음', next: '약했던 곳 보강하기' },
    },
    RUN_SUMMARY_FOCUS_STRONG_STREAK: '공격을 이어 가며 연속 처치 보너스를 안정적으로 지켰습니다.',
    RUN_SUMMARY_STATS_ARIA: '이번 여정 성과',
    RUN_SUMMARY_RESTART: '새 여정 시작',
    // 사망 화면: 무엇에 쓰러졌는지 · 그 적이 얼마나 남았는지(정보만 — 추천은 붙이지 않는다).
    RUN_SUMMARY_KILLED_BY_LABEL: '나를 쓰러뜨린 적',
    RUN_SUMMARY_KILLER_HP: (percent: number) => `남은 생명 ${percent}%`,
    // 사망 화면: 이번 회차에 끝낸 여정의 최고 레벨과 이번 여정(`utils/cycleBestLevel.ts`).
    RUN_SUMMARY_BEST_LEVEL: (best: number, level: number) => `이번 회차 최고 레벨 ${best} · 이번 여정 레벨 ${level}`,
    RUN_SUMMARY_BEST_LEVEL_NEW: (previous: number) => `이번 회차 최고 레벨 경신 · 이전 최고 레벨 ${previous}`,
    // 사망 화면: 이번 여정에 모은 계승 정수 · 지금 가진 계승 정수 — 에테르 거울로 바로 새길 수 있다.
    RUN_SUMMARY_ESSENCE_TITLE: '계승 정수',
    RUN_SUMMARY_ESSENCE_GAINED: (amount: number) => `이번 여정에 모은 계승 정수 ${amount.toLocaleString('ko-KR')}`,
    RUN_SUMMARY_ESSENCE_HELD: (essence: number) => `지금 가진 계승 정수 ${essence.toLocaleString('ko-KR')}`,
    // 사망 직후의 짧은 순간 — 누르면 여정 기록으로 넘어간다(움직임 줄이기 설정이면 곧바로 기록).
    DEATH_BEAT_TITLE: '쓰러졌습니다',
    DEATH_BEAT_KILLED_BY: (name: string) => `${name}에게 쓰러졌습니다`,
    DEATH_BEAT_SKIP: '눌러서 여정 기록 보기',
    // 다시 오르는 여정의 레벨업 기록 — 이번 회차 최고 레벨을 넘었을 때 한 번(소유자 결정 D22: 남은 레벨은 말하지 않는다).
    CYCLE_BEST_LEVEL_PASSED: (best: number) => `이번 회차 최고 레벨 ${withJosa(best, '을/를')} 넘었습니다.`,
    // 계승 화면 영구 능력치 정산 — 지금 값에서 내려놓는 몫을 빼고 계승 보상을 더한 값이 다음 여정으로 이어진다.
    ASCEND_GROWTH_TITLE: '영구 능력치 정산',
    ASCEND_GROWTH_HINT: '지금 값에서 내려놓는 몫을 빼고 계승 보상을 더한 값이 다음 여정으로 이어집니다.',
    ASCEND_GROWTH_COLUMNS: { stat: '능력치', before: '지금', dropped: '내려놓는 몫', reward: '계승 보상', after: '다음 여정' } as const,
    ASCEND_GROWTH_STAT_LABELS: { atk: '공격력', hp: '생명', mp: '기력', essence: '계승 정수' } as const,
    RELIC_CHOICE_TITLE: '이번 여정의 힘을 고르세요',
    // --- w3:combat ---
    // 2026-10 에테르 유리 전투 화면 — 행동 단추 · 신호 · 소모품 · 단계 배너 문구(컴포넌트에 쓰던 한국어를 옮겼다).
    COMBAT_ACTION_ATTACK: '공격',
    COMBAT_ACTION_SKILL: '기술',
    COMBAT_ACTION_ITEM: '아이템',
    COMBAT_FORECAST_ARIA: '전투 판단 요약',
    COMBAT_SIGNALS_ARIA: '전투 신호',
    COMBAT_SIGNATURE_HINT_LABEL: '전설 각인',
    COMBAT_SIGNATURE_HINT_MORE: (count: number) => `외 ${count}`,
    COMBAT_CONSUMABLES_HEADING: '전투 소모품',
    PHASE_BANNER_ENTER: (phase: number) => `${phase}단계 진입`,
    PHASE_BANNER_FINAL: '최종 단계',
    // --- /w3:combat ---
    // --- w3:field ---
    // 2026-10 에테르 유리 — 원정 · 마을 조작판, 기록 창(w3:field).
    FIELD_DOCK_LABEL: '원정 행동',
    FIELD_ACTION_MAP: '지도',
    FIELD_ROUTE_SIGNAL_LABEL: '추천 경로',
    FIELD_ROUTE_SIGNAL_SR: '현재 위치에서 추천 경로',
    FIELD_ROUTE_RECOMMENDED: '추천',
    FIELD_ROUTE_IDLE: '대기',
    FIELD_ROUTE_NONE: '경로 없음',
    FIELD_REGION_EYEBROW: '현재 지역',
    FIELD_REGION_KIND: { safe: '안전지대', boss: '보스 권역', field: '탐험 지역' },
    // --- /w3:field ---
    // --- w3:town ---
    /** 2026-10 에테르 유리(마을 시설): 상점 세트 맞춤 칩 · 구매 영수증 · 제작 방식 묶음 이름. */
    SHOP_SET_MATCH_CHIP: '세트',
    SHOP_SET_MATCH_TITLE: (job: string) => `${job} 세트 매치 — 같은 직업 호환 장비를 모으면 세트 효과 발동`,
    SHOP_PURCHASE_RECEIPT: (itemName: string) => `구매 완료 · ${itemName}`,
    CRAFTING_MODE_GROUP_ARIA: '제작 방식',
    // --- /w3:town ---
    // --- w3:choice ---
    // 2026-10 에테르 유리(선택 카드) — 유물 선택 화면의 머리 · 칸 · 카드 줄 · 넘기기(문구는 그대로, 자리만 MSG로 옮겼다).
    RELIC_CHOICE_EYEBROW: '유물 선택',
    RELIC_CHOICE_SLOTS_SR: '보유 유물',
    RELIC_CHOICE_RECOMMENDED: '추천',
    RELIC_LEGENDARY_COMBO_BADGE: '전설 조합',
    RELIC_NEAR_LEGENDARY_LINE: (label: string) => `${label}까지 1개 남음`,
    RELIC_EFFECT_PAIR_LINE: (names: string) => `함께 쓰기 · ${names}`,
    RELIC_CHOICE_SKIP: '이번에는 고르지 않기',
    RELIC_CHOICE_CARD_LABEL: (name: string) => `${name} 선택`,
    // 전직 카드 — 이름 · 잠금 줄(문구는 그대로, 자리만 MSG로 옮겼다).
    JOB_CHANGE_OPTION_LABEL: (jobName: string, lockedLevel: number | null) => (
        `${jobName} 전직 미리보기${lockedLevel === null ? ', 지금 가능' : `, 레벨 ${lockedLevel} 필요`}`
    ),
    JOB_CHANGE_LEVEL_SHORT: (level: number) => `레벨 ${level}`,
    JOB_CHANGE_READY_SHORT: '가능',
    // --- /w3:choice ---
    // --- w3:moments ---
    // 순간 · 결과 카드(전투 결과 · 원정 정리 · 이야기 장)의 화면 문구 — 컴포넌트에 있던 글을 그대로 옮겼다(뜻 · 글자 불변).
    POST_COMBAT_EYEBROW: '전투 결과',
    POST_COMBAT_TITLE: (enemy: string) => `${enemy} 전투 정리`,
    POST_COMBAT_ENEMY_FALLBACK: '적',
    POST_COMBAT_CLOSE_ARIA: '전투 결과 닫기',
    POST_COMBAT_STATE_LABEL: '상태',
    POST_COMBAT_RECOMMEND_LABEL: '추천',
    POST_COMBAT_STATE_FALLBACK: '진행 가능',
    POST_COMBAT_REWARDS_ARIA: '전투 보상',
    POST_COMBAT_EXP: (n: number) => `경험 +${n}`,
    POST_COMBAT_GOLD: (n: number) => `골드 +${n}`,
    POST_COMBAT_LOOT_COUNT: (n: number) => `전리품 ${n}개`,
    POST_COMBAT_CONTINUE: '계속 탐험',
    POST_COMBAT_LEVEL_UP: '레벨 상승',
    POST_COMBAT_NOTE_FALLBACK: (enemy: string) => `${enemy} 전투를 정리했습니다.`,
    POST_COMBAT_SIGNAL_BOSS: '보스 보상',
    POST_COMBAT_SIGNAL_BOSS_BONUS: (n: number) => `첫 토벌 골드 +${n}`,
    POST_COMBAT_SIGNAL_BOSS_LOOT: '보스 전리품',
    POST_COMBAT_SIGNAL_UPGRADE: '장비 갱신',
    POST_COMBAT_SIGNAL_TRAIT: '성향 공명',
    EXPEDITION_DEBRIEF_UNDER_MINUTE: '1분 미만',
    EXPEDITION_DEBRIEF_MINUTES: (m: number) => `${m}분`,
    EXPEDITION_DEBRIEF_HOURS: (h: number, r: number) => (r > 0 ? `${h}시간 ${r}분` : `${h}시간`),
    EXPEDITION_DEBRIEF_BATTLES: '전투',
    EXPEDITION_DEBRIEF_EXPLORES: '탐험',
    EXPEDITION_DEBRIEF_GOLD: '골드 변화',
    EXPEDITION_DEBRIEF_TIMES: (n: number) => `${n}회`,
    EXPEDITION_DEBRIEF_EYEBROW: '원정 기록',
    EXPEDITION_DEBRIEF_TITLE: '원정 귀환',
    EXPEDITION_DEBRIEF_LOWEST_HP: '가장 위험했던 순간',
    EXPEDITION_DEBRIEF_NEW_ITEMS: '새로 챙긴 것',
    EXPEDITION_DEBRIEF_NO_ITEMS: '새 아이템 없음',
    EXPEDITION_DEBRIEF_MORE_ITEMS: (n: number) => ` 외 ${n}종`,
    EXPEDITION_DEBRIEF_USED_ITEMS: (n: number) => `사용·소모 ${n}개`,
    EXPEDITION_DEBRIEF_QUESTS: '달성한 임무',
    EXPEDITION_DEBRIEF_NO_QUESTS: '이번 원정에서 새로 달성한 임무 없음',
    EXPEDITION_DEBRIEF_NEXT: '이어서 할 일',
    MILESTONE_STORY_CONTINUE: '다음 장면으로',
    RUN_SUMMARY_ENDED_BADGE: '종료',
    RUN_SUMMARY_STAT_KILLS: '처치',
    RUN_SUMMARY_STAT_BOSSES: '보스',
    RUN_SUMMARY_STAT_RELICS: '유물',
    RUN_SUMMARY_STAT_GOLD: '획득 골드',
    RUN_SUMMARY_ESCAPES: (n: number) => `도주 ${n}회`,
    RUN_SUMMARY_DISCOVERIES: (n: number) => `새 지역 ${n}곳`,
    RUN_SUMMARY_STREAK: (n: number) => `최대 ${n}연속`,
    RUN_SUMMARY_SIGNATURES: (n: number) => `전설 각인 ${n}종 획득`,
    RUN_SUMMARY_SHARE_ARIA: '결과 공유',
    RUN_SUMMARY_SHARE_COPIED_ARIA: '결과 복사 완료',
    RUN_SUMMARY_SHARE_COPIED: '복사 완료',
    // --- /w3:moments ---
    // --- w3:archive-a ---
    ARCHIVE_TAB_LOADING: '불러오는 중…',
    ENHANCE_DECISION_CLOSE_ARIA: '강화 확인 닫기',
    // --- /w3:archive-a ---
    // --- w3:archive-b ---
    // 설정 탭(SystemTab · tabs/system/*)
    SYSTEM_PLAYER_SETTINGS_DESC: '화면과 장비 설명을 편한 방식으로 맞춥니다.',
    SYSTEM_READABILITY_DESC: '글자와 경계가 흐리게 느껴질 때 선명하게를 선택합니다.',
    SYSTEM_EQUIPMENT_DETAIL_DESC: '자동은 초반에는 핵심만, 성장한 뒤에는 세부 효과까지 보여 줍니다.',
    SYSTEM_READABILITY_CHANGED: (label: string) => `화면을 ${label} 표시로 바꿨습니다.`,
    SYSTEM_EQUIPMENT_DETAIL_CHANGED: (label: string) => `장비 정보를 ${label} 표시로 바꿨습니다.`,
    SYSTEM_TITLE_NONE: '선택 안 함',
    SYSTEM_TITLE_NONE_HINT: '칭호를 선택하면 고유 효과가 적용됩니다.',
    SYSTEM_TITLE_PICKER: (count: number) => `칭호 바꾸기 · ${count}개 보유`,
    SYSTEM_TITLE_ACTIVE: '적용 중',
    SYSTEM_TITLE_APPLIED: (label: string) => `[${label}] 칭호를 적용했습니다.`,
    SYSTEM_TITLE_CLEARED: '칭호 적용을 해제했습니다.',
    SYSTEM_SECONDARY_TITLE: '기타',
    SYSTEM_SECONDARY_DESC: '순위, 의견, 저장과 기기 점검은 필요할 때 펼쳐 봅니다.',
    SYSTEM_LEADERBOARD_DESC: '다른 모험가와 누적 처치 기록을 비교합니다.',
    SYSTEM_LEADERBOARD_EMPTY: '아직 순위 기록을 불러오지 못했습니다.',
    SYSTEM_LEADERBOARD_ME: '나',
    SYSTEM_LEADERBOARD_RANK: (rank: number) => `계승 ${rank}`,
    SYSTEM_FEEDBACK_DESC: '불편했던 점이나 이상한 동작을 개발팀에 알립니다.',
    SYSTEM_FEEDBACK_ARIA: '의견 내용',
    SYSTEM_FEEDBACK_PLACEHOLDER: '불편했던 점이나 이상한 동작을 적어 주세요.',
    SYSTEM_FEEDBACK_SEND: '보내기',
    SYSTEM_FEEDBACK_SENT: '의견을 보냈습니다.',
    SYSTEM_FEEDBACK_FAILED: '의견을 보내지 못했습니다.',
    SYSTEM_SUPPORT_DESC: '플레이 기록을 보관하거나 문제 확인 정보를 준비합니다.',
    SYSTEM_PLAY_RECORD_EXPORTED: '플레이 기록을 저장했습니다.',
    SYSTEM_QA_COPY: '점검 정보 복사',
    SYSTEM_QA_EXPORT: '점검 파일 저장',
    SYSTEM_QA_COPIED: '기기 점검 정보를 복사했습니다.',
    SYSTEM_QA_COPY_FAILED: '기기 점검 정보를 복사하지 못했습니다.',
    SYSTEM_QA_EXPORTED: '기기 점검 파일을 저장했습니다.',
    SYSTEM_QA_VIEWPORT: '화면',
    SYSTEM_QA_STATE: '상태',
    SYSTEM_QA_SYNC: '동기화',
    SYSTEM_QA_STORY: '이야기',
    SYSTEM_ADMIN_TITLE: '운영 설정',
    SYSTEM_ADMIN_DESC: '승인된 운영자만 보상 배율과 공지를 바꿀 수 있습니다.',
    SYSTEM_ADMIN_MULTIPLIER: '보상 배율',
    SYSTEM_ADMIN_BROADCAST: '공지 등록',
    SYSTEM_ADMIN_MULTIPLIER_PROMPT: '이벤트 보상 배율을 입력하세요. (1-5)',
    SYSTEM_ADMIN_MULTIPLIER_RANGE: '배율은 1에서 5 사이여야 합니다.',
    SYSTEM_ADMIN_MULTIPLIER_FAILED: '이벤트 보상 배율을 바꾸지 못했습니다.',
    SYSTEM_ADMIN_BROADCAST_PROMPT: '공지 내용을 입력하세요. (최대 100자)',
    SYSTEM_ADMIN_BROADCAST_EMPTY: '공지 내용을 입력해 주세요.',
    SYSTEM_ADMIN_BROADCAST_DONE: '공지를 등록했습니다.',
    SYSTEM_ADMIN_BROADCAST_FAILED: '공지를 등록하지 못했습니다.',
    // 임무 탭(QuestTab)
    QUEST_TAB_ACTIVE_COUNT: (count: number) => `진행 ${count}`,
    QUEST_TAB_CLAIMABLE_COUNT: (count: number) => `보상 대기 ${count}`,
    QUEST_TAB_BOARD_OPEN: '게시판 이용 가능',
    QUEST_TAB_BOARD_TOWN_ONLY: '수락은 마을 전용',
    QUEST_TAB_INTRO: '새 임무와 현상수배는 마을 게시판에서 받을 수 있습니다. 여기서는 진행 상황과 받을 보상을 확인합니다.',
    QUEST_TAB_OPEN_BOARD: '임무 게시판 열기',
    QUEST_TAB_ACTIVE_TITLE: '진행 중인 임무',
    QUEST_TAB_EMPTY: '진행 중인 임무가 없습니다.',
    QUEST_TAB_BOUNTY: '현상수배',
    QUEST_TAB_IN_PROGRESS: '진행 중',
    QUEST_TAB_CLAIM: '수령',
    QUEST_TAB_CLAIMED: '수령됨',
    QUEST_TAB_OBJECTIVE: (text: string) => `목표: ${text}`,
    QUEST_TAB_OBJECTIVE_LEVEL: (goal: number | undefined) => `레벨 ${goal} 달성`,
    QUEST_TAB_OBJECTIVE_COUNT: (target: string | undefined, goal: number | undefined) => `${target} ${goal}회 달성`,
    QUEST_TAB_PROGRESS_LEVEL: (progress: number, goal: number | undefined) => `레벨 ${progress}/${goal}`,
    QUEST_TAB_DAILY_TITLE: '오늘의 임무',
    QUEST_TAB_DAILY_TYPE: { kills: '처치', explores: '탐험', goldSpend: '골드 소비' },
    QUEST_TAB_RELIC_SHARD_REWARD: '유물 파편 +1',
    QUEST_TAB_RELIC_SHARDS: (count: number) => `유물 파편 ×${count}`,
    QUEST_TAB_WEEKLY_TITLE: '주간 임무',
    QUEST_TAB_WEEKLY_REWARD: (gold: number, crystals?: number) => `골드 +${gold}${crystals ? ` · 에테르 크리스탈 +${crystals}` : ''}`,
    QUEST_TAB_DISCOVERY_TITLE: '발견 여정',
    QUEST_TAB_DISCOVERY_DONE: '완료',
    QUEST_TAB_DISCOVERY_VISITS: (visited: number, total: number) => `${visited}/${total} 방문`,
    // 업적 탭(AchievementPanel)
    ACHIEVEMENT_PANEL_TITLE: '업적',
    ACHIEVEMENT_PANEL_SUMMARY: (unlocked: number, claimed: number, total: number) => `달성 ${unlocked}/${total} · 보상 수령 ${claimed}/${total}`,
    ACHIEVEMENT_PANEL_CLAIMABLE_TITLE: '받을 보상',
    ACHIEVEMENT_PANEL_COUNT: (count: number) => `${count}개`,
    ACHIEVEMENT_PANEL_CLAIM: '받기',
    ACHIEVEMENT_PANEL_CLAIM_DETAIL: '보상 받기',
    ACHIEVEMENT_PANEL_CLAIMED: '보상 수령 완료',
    ACHIEVEMENT_PANEL_NEXT_TITLE: '다음 목표',
    ACHIEVEMENT_PANEL_NEXT_HINT: '가장 가까운 기록',
    ACHIEVEMENT_PANEL_JOURNEY_TITLE: '업적 여정',
    ACHIEVEMENT_PANEL_JOURNEY_HINT: '단계를 눌러 전체 기록 보기',
    ACHIEVEMENT_PANEL_CATEGORY_ARIA: '업적 분야',
    ACHIEVEMENT_PANEL_STEPS: (claimed: number, total: number) => `${claimed}/${total} 단계`,
    ACHIEVEMENT_PANEL_ALL_DONE: '모든 기록 완료',
    ACHIEVEMENT_PANEL_NEXT_MILESTONE: (title: string) => `다음 · ${title}`,
    ACHIEVEMENT_PANEL_REWARD: (text: string) => `보상 · ${text}`,
    ACHIEVEMENT_PANEL_REWARD_NONE: '기록 달성',
    ACHIEVEMENT_PANEL_UNTITLED: '이름 없는 업적',
    ACHIEVEMENT_PANEL_UNTITLED_DESC: '모험 기록을 달성하세요.',
    SEASON_PANEL_TITLE: '시즌 여정',
    SEASON_PANEL_TIER: (tier: number, total: number) => `${tier} / ${total} 단계`,
    SEASON_PANEL_DONE: '시즌 여정 완료',
    SEASON_PANEL_TO_NEXT: (remaining: number) => `다음 단계까지 ${remaining}`,
    SEASON_PANEL_XP: (current: number, max: number) => `${current}/${max} 시즌 경험`,
    SEASON_PANEL_TRACK_ARIA: (tier: number, total: number) => `시즌 여정 ${tier}/${total}단계`,
    SEASON_PANEL_CLAIMABLE_TITLE: '받을 보상',
    SEASON_PANEL_COUNT: (count: number) => `${count}개`,
    SEASON_PANEL_TIER_REWARD: (tier: number) => `${tier}단계 보상`,
    SEASON_PANEL_TIER_LABEL: (tier: number) => `${tier}단계`,
    SEASON_PANEL_CLAIM: '받기',
    SEASON_PANEL_EXTRA_PART: (part: string) => `추가 ${part}`,
    SEASON_PANEL_EXTRA_REWARD: (text: string) => `추가 보상 · ${text}`,
    SEASON_PANEL_NEXT_TITLE: '다음 보상',
    SEASON_PANEL_NEXT_HINT: '가까운 3단계',
    SEASON_PANEL_ALL_UNLOCKED: '모든 보상 해금',
    SEASON_PANEL_ALL_OPENED: '모든 시즌 보상을 열었습니다',
    SEASON_PANEL_SOURCES_TITLE: '성장하는 방법',
    SEASON_PANEL_JOURNEY_TITLE: '전체 여정',
    SEASON_PANEL_JOURNEY_HINT: '구간을 눌러 보상 보기',
    SEASON_PANEL_CHAPTER_META: (from: number, to: number, reached: number, claimed: number, size: number) => (
        `${from}–${to}단계 · 도달 ${reached}/${size} · 수령 ${claimed}/${size}`
    ),
    SEASON_PANEL_TIER_CLAIMED: '수령 완료',
    SEASON_PANEL_TIER_READY: '받을 수 있음',
    SEASON_PANEL_TIER_LOCKED: '미도달',
    CODEX_PANEL_TITLE: '모험 도감',
    CODEX_PANEL_TAB_LABELS: { equip: '장비', monster: '몬스터', recipe: '제작법', material: '소재', legend: '전설' },
    CODEX_PANEL_CATEGORY_ARIA: '도감 분류',
    CODEX_PANEL_CLAIMABLE_TITLE: '받을 수집 보상',
    CODEX_PANEL_COUNT: (count: number) => `${count}개`,
    CODEX_PANEL_CLAIM: '받기',
    CODEX_PANEL_NEXT_TITLE: '다음 수집 목표',
    CODEX_PANEL_NEXT_HINT: '가장 가까운 보상',
    CODEX_PANEL_GOAL_REWARD: (reward: string, remaining: number) => `${reward} · ${remaining}개 남음`,
    CODEX_EQUIP_KIND_ARIA: '장비 종류',
    CODEX_EQUIP_KIND_LABELS: { weapons: '무기', armors: '방어구', shields: '방패' },
    CODEX_EQUIP_NEXT_REWARD: '다음 장비 수집 보상',
    CODEX_EQUIP_CLAIM_ABOVE: '상단에서 보상을 받을 수 있습니다',
    CODEX_EQUIP_TIER: (tier: number, rarity: string) => `${tier}단계 · ${rarity}`,
    CODEX_EQUIP_UNDISCOVERED: '미발견 장비',
    CODEX_EQUIP_ALL_CLAIMED: '모든 장비 수집 보상을 받았습니다',
    CODEX_EQUIP_CARD_LIFE: '생명',
    CODEX_EQUIP_CARD_WILL: '기력',
    CODEX_EQUIP_CARD_TWO_HAND: '양손',
    CODEX_EQUIP_CARD_PRICE: (price: number | string) => `골드 ${price}`,
    CODEX_MATERIAL_TITLE: '소재 기록',
    CODEX_MATERIAL_DESC: '획득한 소재와 다시 구할 수 있는 몬스터를 확인합니다',
    CODEX_MATERIAL_EMPTY_TITLE: '첫 소재를 찾아보세요',
    CODEX_MATERIAL_UNDISCOVERED: (count: number) => `미발견 소재 ${count}개`,
    CODEX_MATERIAL_UNDISCOVERED_HINT: '실제로 획득한 소재만 상세 기록을 엽니다',
    CODEX_RECIPE_TITLE: '제작 기록',
    CODEX_RECIPE_DESC: '직접 완성한 제작법과 다시 만들 준비를 확인합니다',
    CODEX_RECIPE_EMPTY_TITLE: '첫 제작법을 기록하세요',
    CODEX_RECIPE_EMPTY_HINT: '마을 제작소에서 제작에 성공하면 제작법과 결과 장비가 함께 도감에 남습니다',
    CODEX_RECIPE_GROUP_READY: '지금 제작 가능',
    CODEX_RECIPE_GROUP_PREP: '재료 준비 필요',
    CODEX_RECIPE_STATUS_READY: '제작 가능',
    CODEX_RECIPE_STATUS_PREP: '준비 필요',
    CODEX_RECIPE_INPUTS_TITLE: '필요 재료',
    CODEX_RECIPE_INPUT_ROW: (name: string, qty: number | undefined, owned: number) => `${name} · 필요 ${qty ?? 0}개 · 보유 ${owned}개`,
    CODEX_RECIPE_UNDISCOVERED: (count: number) => `미발견 제작법 ${count}개`,
    CODEX_RECIPE_UNDISCOVERED_HINT: '아직 만들지 않은 제작법은 빈 카드 대신 남은 수로만 보여 줍니다',
    CODEX_MONSTER_TITLE: '몬스터 연구',
    CODEX_MONSTER_STEP_HP: '최대 생명 +5',
    CODEX_MONSTER_STEP_DEF: '방어력 +1',
    CODEX_MONSTER_STEP_ATK: '공격력 +1',
    CODEX_MONSTER_BONUS_LABELS: { hp: '생명', atk: '공격력', def: '방어력' },
    CODEX_MONSTER_LOCATION: (location: string) => `출현 지역 · ${location}`,
    CODEX_MONSTER_LOCATION_UNKNOWN: '아직 확인되지 않음',
    CODEX_MONSTER_BRIEF_LABELS: { signature: '기믹', counter: '대응', phase: '페이즈', warning: '위협', builds: '추천' },
    CODEX_MONSTER_RESEARCH_TITLE: '연구 보너스',
    CODEX_MONSTER_RESEARCH_ROW: (target: number, label: string, done: boolean) => `${target}회 처치 · ${label}${done ? ' · 달성' : ''}`,
    CODEX_MONSTER_GROUP_REGULAR: '발견한 몬스터',
    CODEX_MONSTER_GROUP_BOSS: '발견한 보스',
    CODEX_MONSTER_GROUP_COUNT: (count: number) => `${count}종`,
    CODEX_MONSTER_LIST_KILLS: (kills: number) => `${kills}회`,
    CODEX_MONSTER_NEXT_TITLE: '다음 연구 목표',
    CODEX_MONSTER_RESEARCH_REMAINING: (label: string, remaining: number) => `${label} · ${remaining}회 남음`,
    CODEX_MONSTER_EMPTY_TITLE: '첫 연구를 시작하세요',
    CODEX_MONSTER_EMPTY_HINT: '탐험 중 몬스터를 처음 처치하면 출현 지역과 약점, 전리품 정보가 열립니다',
    CODEX_MONSTER_UNDISCOVERED: (count: number) => `미발견 기록 ${count}종`,
    CODEX_LEGEND_TITLE: '전설 수집',
    CODEX_LEGEND_DESC: '발견한 전설 각인과 세트 장비를 기록합니다',
    CODEX_LEGEND_FALLBACK_CATEGORY: '전설',
    CODEX_LEGEND_SOURCES_TITLE: '획득처',
    CODEX_LEGEND_SOURCE_RATE: (pct: number) => `${pct}%`,
    CODEX_LEGEND_PITY_TITLE: '각인 공명',
    CODEX_LEGEND_PITY_CAPPED: '상한 도달',
    CODEX_LEGEND_PITY_ACTIVE: (pity: number) => `보스 ${pity}회 누적`,
    CODEX_LEGEND_PITY_LOADING: (pity: number, threshold: number, remaining: number) => `적재 ${pity}/${threshold} · 임계까지 ${remaining}회`,
    CODEX_LEGEND_PITY_IDLE: (threshold: number) => `보스 ${threshold}회 연속 무획득 시 배율 상승`,
    CODEX_LEGEND_PITY_PCT: (pct: number) => `+${pct}%`,
    CODEX_LEGEND_SETS_TITLE: '전설 세트',
    CODEX_LEGEND_SET_STATUS: (equipped: number, discovered: number, total: number) => (
        `${equipped > 0 ? `장착 ${equipped}` : '미장착'} · 수집 ${discovered}/${total}`
    ),
    CODEX_LEGEND_COLLECTION_TITLE: '전설 장비 기록',
    CODEX_LEGEND_UNDISCOVERED: '미발견 전설',
    // --- /w3:archive-b ---
    // --- w3:shell ---
    // 앱 셸(상태 표시줄 · 시즌 띠 · 데스크톱 배치 · 시작 · 부팅 · 오류 화면) — 2026-10 에테르 유리 3차.
    SHELL_LEVEL: (level: number | string) => `레벨 ${level}`,
    SHELL_GOLD_UNIT: '골드',
    SHELL_IN_COMBAT: '전투 중',
    SHELL_ENEMY_HEADING: '교전 대상',
    SHELL_BOSS: '보스',
    SHELL_LIFE: '생명',
    SHELL_WILL: '기력',
    SHELL_KILL_STREAK: (count: number) => `연속 처치 ${count}`,
    SHELL_ANNOUNCEMENT_LABEL: '공지',
    SHELL_SEASON_EVENT_FALLBACK_NAME: '시즌 이벤트',
    SHELL_SEASON_EVENT_ACTIVE: (name: string) => `${name} 진행 중`,
    SHELL_SEASON_EVENT_DAYS_LEFT: (days: number) => (days <= 0 ? '오늘 끝남' : `${days}일 남음`),
    SHELL_SEASON_EVENT_MOVE: (map: string) => `${withJosa(map, '으로/로')} 이동`,
    SHELL_DESKTOP_CHARACTER_REGION: '내 캐릭터',
    SHELL_DESKTOP_ARCHIVE_REGION: '모험 기록',
    SHELL_DESKTOP_ARCHIVE_LOCKED_TITLE: '모험 기록',
    SHELL_DESKTOP_ARCHIVE_LOCKED_BODY: '지금 화면을 마치면 모험 기록이 다시 열립니다.',
    SHELL_FACT_ATK: '공격력',
    SHELL_FACT_DEF: '방어력',
    SHELL_EQUIP_HEADING: '장착 장비',
    SHELL_EQUIP_SLOTS: { weapon: '무기', armor: '방어구', offhand: '보조 장비' } as const,
    SHELL_EQUIP_EMPTY: '비어 있음',
    SHELL_INTRO_TAGLINE: '달빛 아래 펼쳐지는 모험',
    SHELL_INTRO_EYEBROW: '첫 여정',
    SHELL_INTRO_LEAD: '당신의 이름이 이곳의 첫 기록이 됩니다.',
    SHELL_INTRO_NAME_LABEL: '모험가의 이름',
    SHELL_INTRO_NAME_PLACEHOLDER: '이름 입력',
    SHELL_INTRO_REROLL: '이름 다시 뽑기',
    SHELL_BOOT_PREPARING: '모험을 준비하고 있습니다.',
    SHELL_FATAL_TITLE: '게임 화면을 불러오지 못했습니다',
    SHELL_FATAL_BODY: '앱을 다시 열어 주세요. 같은 문제가 계속되면 고객센터에 알려 주세요.',
    // --- /w3:shell ---
    // === 소유자 결정 2026-10-26 · 문구 · 데이터 정리 ===
    // D5: 기술 성장(분기)을 고를 수 있게 된 순간의 기록 한 줄 — 어느 기술인지와 어디서 고르는지만 말한다(튜토리얼 · 반복 안내 아님).
    SKILL_BRANCH_OPENED: (skillNames: readonly string[]) => (
        `${skillNames.join(' · ')}의 성장을 고를 수 있습니다. 기록의 기술 탭에서 고릅니다.`
    ),
    // === 소유자 결정 2026-10-26 · 마을 · 진입점 · 데스크톱 ===
    // D2: 보유 유물 목록은 기록의 상태 탭이 그린다(설정 탭에서 옮김) — 펼친 채로 보인다.
    STATS_RELIC_TITLE: (count: number, capacity: number) => `보유 유물 ${count}/${capacity}`,
    STATS_RELIC_DESC: '이번 여정에서 얻은 유물과 효과입니다.',
    // D12: 지도 단추는 늘 보인다 — 열 수 없을 때는 눌리지 않고, 이름이 그 이유를 말한다.
    FIELD_ACTION_MAP_UNAVAILABLE: '지도 · 지금은 모험 기록을 열 수 없습니다',
    // D6: 데스크톱 기록 열의 세로 탭 목록 이름.
    ARCHIVE_TAB_LIST_ARIA: '모험 기록 선택',
    // D17(UX-09): 덮는 화면의 닫기 단추 이름은 "<무엇> 닫기"다 — 컴포넌트에 적혀 있던 이름을 옮겼다(끝 낱말은 UI_CLOSE와 같다).
    PREMIUM_SHOP_CLOSE_ARIA: '에테르 교환소 닫기',
    MIRROR_PANEL_CLOSE_ARIA: '에테르 거울 닫기',
    // === 소유자 결정 2026-10-26 · 전투 · 기록 ===
    // D25(감사 GF-07): 적이 자기 차례에 한 행동의 기록 배지 — 내 행동(전투 · 치명타)과 가른다. 강타는 '치명타'가 아니다.
    LOG_BADGE_ENEMY_ACTION: '적 행동',
    // D25: 전투 요약의 지난 차례는 한 줄로 접는다(표시만 — 기록 줄은 그대로다). 첫 줄('내 행동')과 접힌 나머지 줄 수.
    COMBAT_LOG_PREVIOUS_TURN: (firstText: string, moreCount: number) => (
        `지난 차례 · ${firstText}${moreCount > 0 ? ` 외 ${moreCount}줄` : ''}`
    ),

    // === 소유자 결정 2026-10-26 · 설정 · 접근성 · 진동 ===
    // D24: 전설 획득은 초점을 옮기지 않는 상태 알림이다(대화상자가 아니다) — 알림 칸이 읽는 한 문장.
    A11Y_LEGENDARY_STATUS: (name: string, desc?: string) => (desc ? `전설 각인 획득: ${name}. ${desc}` : `전설 각인 획득: ${name}`),
    // D3 · D23: 기록 탭 '플레이 설정'의 진동 · 한 글자 단축키 켬/끔(기본 켬).
    SYSTEM_HAPTICS_TITLE: '진동',
    SYSTEM_HAPTICS_DESC: '맞을 때 · 치명타 · 레벨 상승 · 전설 획득 · 쓰러질 때 기기를 짧게 울립니다. 진동을 지원하지 않는 기기에서는 울리지 않습니다.',
    SYSTEM_SHORTCUTS_TITLE: '한 글자 단축키',
    SYSTEM_SHORTCUTS_DESC: '전투 중 1 · 2 · 3(공격 · 기술 · 도주)과 빠른 칸 Q · W · E. 끄면 이 키를 눌러도 아무 일도 일어나지 않습니다.',
    SYSTEM_TOGGLE_ON: '켜기',
    SYSTEM_TOGGLE_OFF: '끄기',
    SYSTEM_TOGGLE_STATE: (enabled: boolean) => (enabled ? '켜짐' : '꺼짐'),
    SYSTEM_HAPTICS_CHANGED: (enabled: boolean) => (enabled ? '진동을 켰습니다.' : '진동을 껐습니다.'),
    SYSTEM_SHORTCUTS_CHANGED: (enabled: boolean) => (enabled ? '한 글자 단축키를 켰습니다.' : '한 글자 단축키를 껐습니다.'),

    // === 소유자 결정 2026-10-26 · 한 행동 처치 ===
    // D1: 적이 행동하기 전에 끝난 일반 전투의 결과는 조우 · 처치 · 전리품 한 장이다 — 그 시트의 이름표와 제목.
    POST_COMBAT_SWIFT_EYEBROW: '한 번에 처치',
    POST_COMBAT_SWIFT_TITLE: (enemy: string) => `${enemy} 처치`,
};
