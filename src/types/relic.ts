/**
 * Relic domain type (cycle 60 phase D batch 11).
 *
 * effect마다 값의 형태가 다른 유물 데이터를 담는 호환 중심 인터페이스.
 *
 * 정착 전략: effect별 val 형태가 number / { atk, def } / { threshold, mult } /
 * { drop, gold } 등으로 매우 다양하므로 strict union 대신 [key: string]: any를
 * 사용해 런타임 호환성을 우선한다. effect 분기는 RelicEffect 문자열 enum
 * (자유 string)으로 강제하지 않고, 코드의 string equality 비교만으로 처리한다.
 */

export interface Relic {
    id?: string;
    name?: string;
    rarity?: string;
    desc?: string;
    /** 유물의 효과 키 (CombatEngine + 패시브 처리에서 분기). */
    effect?: string;
    /** 효과 매개변수 — number 단일값이거나 { threshold, mult } 같은 dict. */
    val?: any;
    /** 발동 임계값 (값에 따라 val 안에 들거나 외부에 있음). */
    threshold?: number;
    /** 동적으로 추가되는 임의 필드 (런타임 확장 호환). */
    [key: string]: any;
}

/**
 * 유물 시너지 정의 (`RELIC_SYNERGIES`).
 *
 * `bonus`는 시너지마다 쓰는 키가 다르지만, 20종 전체에서 등장하는 키 집합이
 * 유한하므로 인덱스 시그니처 대신 optional 필드로 전부 선언한다.
 * (`effect`만 필수 — 모든 분기가 `bonus.effect` 문자열 비교로 이뤄진다.)
 */
export interface RelicSynergyBonus {
    effect: string;
    atkMult?: number;
    cdReduction?: number;
    chaosAtk?: number;
    critChance?: number;
    critDmg?: number;
    damage?: number;
    defMult?: number;
    devour?: number;
    dotMult?: number;
    executeThreshold?: number;
    extraAction?: number;
    extraTurnChance?: number;
    fixedDmg?: number;
    freeSkillChance?: number;
    healOnSave?: number;
    healPerTurn?: number;
    hpCostReduction?: number;
    interval?: number;
    killHeal?: number;
    killStack?: number;
    lifeSteal?: number;
    lifeStealBonus?: number;
    lowHpAtk?: number;
    mpMult?: number;
    reflect?: number;
    regenPerTurn?: number;
    reviveCount?: number;
    reviveHeal?: number;
    skillMult?: number;
    statBonus?: number;
    stunOnReflect?: number;
}

export interface RelicSynergy {
    /** UI 표시용 시너지 이름. */
    label: string;
    /** 모두 보유해야 발동하는 유물 name 목록. */
    requires: string[];
    bonus: RelicSynergyBonus;
    desc: string;
}
