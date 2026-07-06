/**
 * Class/Job domain types (2026-07 타입화 — classes.js CLASSES export).
 *
 * 18개 직업 + 스킬 트리(Tier 0-3)를 망라. Relic/Monster와 동일한 전략:
 * 모든 필드 optional + `[key: string]: any` 인덱스 시그니처로 런타임
 * 확장 필드(skillBranches 분기 override 등 다형 데이터)를 폭넓게 허용한다.
 */

/** 스킬 분기 선택지 (skillBranches[스킬명] 배열 원소). */
export interface SkillBranchChoice {
    choice?: string;
    label?: string;
    desc?: string;
    /** 선택 시 스킬 정의를 덮어쓰는 부분 필드 (mult/effect/effectChance 등). */
    override?: Record<string, any>;
    [key: string]: any;
}

/** 직업 스킬 정의 (능동/패시브 공용). */
export interface ClassSkill {
    name?: string;
    mp?: number;
    type?: string;
    mult?: number;
    desc?: string;
    passive?: boolean;
    effect?: string;
    val?: number | Record<string, any>;
    turn?: number;
    effectChance?: number;
    [key: string]: any;
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
    [key: string]: any;
}
