/**
 * Class/Job domain types (2026-07 타입화 — classes.js CLASSES export).
 *
 * 18개 직업 + 스킬 트리(Tier 0-3)를 망라.
 *
 * 2026-09 L stage 1: `[key: string]: any` 인덱스 시그니처 3개 제거.
 * CLASSES 18개 · 스킬 152개 · 분기 선택지 64개가 실제로 쓰는 필드만 선언하고,
 * `type` / `effect` 처럼 닫힌 집합은 리터럴 유니온으로 고정했다.
 * 분기 `override`는 스킬 정의를 덮어쓰는 부분 객체이므로 `Partial<ClassSkill>` —
 * 즉 override 전용 키(`secondEffect` / `stunTurn` …)도 `ClassSkill`에 선언한다.
 */

/**
 * 스킬 분류 — classes.ts 실측 10종.
 * 속성명(화염/냉기…)은 적 weakness 매칭에, buff/debuff/escape는 행동 분기에 쓰인다.
 */
export type ClassSkillType =
    | 'buff'
    | 'debuff'
    | 'escape'
    | '냉기'
    | '대지'
    | '물리'
    | '빛'
    | '어둠'
    | '자연'
    | '화염';

/** 스킬 효과 키 — classes.ts 스킬 152개 + 분기 override 실측 30종. */
export type ClassSkillEffect =
    | 'all_up'
    | 'atk_up'
    | 'berserk'
    | 'bleed'
    | 'blind'
    | 'burn'
    | 'counter'
    | 'crit_cooldown'
    | 'crit_up'
    | 'curse'
    | 'curse_amp'
    | 'def_up'
    | 'drain'
    | 'escape_100'
    | 'exp_up'
    | 'extraTurn'
    | 'fear'
    | 'freeze'
    | 'gold_up'
    | 'hp_regen'
    | 'hp_up'
    | 'low_hp_atk'
    | 'mp_regen'
    | 'mp_up'
    | 'poison'
    | 'purify'
    | 'resetCooldowns'
    | 'stealth'
    | 'stun'
    | 'taunt';

/** 직업 스킬 정의 (능동/패시브 공용). */
export interface ClassSkill {
    name?: string;
    mp?: number;
    type?: ClassSkillType;
    mult?: number;
    desc?: string;
    passive?: boolean;
    effect?: ClassSkillEffect;
    val?: number;
    turn?: number;
    /** 이 스킬 전용 크리티컬 확률 (없으면 stats.critChance). */
    crit?: number;
    /** 흡혈 비율 (`drain` 계열 — 미정의 시 CombatEngine 기본 0.25). */
    drainRatio?: number;

    // --- 이하 skillBranches override로만 주입되는 키 (CombatEngine.actions가 읽는다) ---
    /** 상태이상 발동 확률 게이트 (미정의 시 1.0). */
    effectChance?: number;
    /** 분기 선택으로 추가되는 2차 상태이상. */
    secondEffect?: ClassSkillEffect;
    /** stun/freeze 지속 턴 override (미정의 시 1). */
    stunTurn?: number;
    /** curse 지속 턴 override (미정의 시 3). */
    curseTurn?: number;
    /** burn 지속 턴 override. */
    burnTurn?: number;
    /** DEF 배율 버프 override (1.2 = DEF +20%). */
    defBonus?: number;
    /** 사용 시 회복하는 MP override. */
    mpRestore?: number;

    // --- 이하 classes.ts에는 없고 런타임에서 파생 생성되는 스킬만 갖는 필드 ---
    /** 재사용 대기 턴 (무기 마법 / 성향 스킬 프리셋). */
    cooldown?: number;
    /** 장비 무기 공명으로 생성된 스킬 표시 (utils/equipmentUtils.ts). */
    fromWeapon?: boolean;
    /** 파생 원본 무기 이름 (fromWeapon과 짝). */
    weaponName?: string;
    /** 파생 원본 장비 슬롯 (fromWeapon과 짝). */
    slot?: string;
    /** 플레이 성향에서 생성된 스킬 표시 (utils/runProfile.ts). */
    fromTrait?: boolean;
}

/** 스킬 분기 선택지 (skillBranches[스킬명] 배열 원소). */
export interface SkillBranchChoice {
    /** 'A' | 'B' — 저장된 선택 키. */
    choice?: string;
    label?: string;
    desc?: string;
    /** 선택 시 스킬 정의를 덮어쓰는 부분 필드 (mult/effect/effectChance 등). */
    override?: Partial<ClassSkill>;
}

/** 직업 정의 (CLASSES 객체의 값). */
export interface ClassDef {
    tier?: number;
    reqLv?: number;
    desc?: string;
    hpMod?: number;
    mpMod?: number;
    atkMod?: number;
    skills?: ClassSkill[];
    /** 스킬명 → 분기 선택지 배열. */
    skillBranches?: Record<string, SkillBranchChoice[]>;
    /** 전직 가능한 상위 직업 목록. */
    next?: string[];
}
