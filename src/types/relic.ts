/**
 * Relic domain type (cycle 60 phase D batch 11 → 2026-09 Wave 3 L stage 1).
 *
 * effect마다 값의 형태가 다른 유물 데이터를 담는 인터페이스.
 *
 * 2026-09 L stage 1: `[key: string]: any` 인덱스 시그니처 제거.
 * `RELICS` 67개 엔트리가 실제로 쓰는 필드만 선언하며, `effect`는 데이터에 존재하는
 * 61개 id의 리터럴 유니온이다. 이제 `relic.오타` / `effect: 'typo'`가 컴파일 에러다.
 * `val`만 effect별 다형(number | dict)이라 `any`로 남았고, dict 키 집합은 `RelicVal`에
 * 문서화했다.
 */

/** RELICS 데이터에 존재하는 희귀도 (5종). */
export type RelicRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * RELICS 데이터에 존재하는 effect id 전체 (61종).
 * 분기 코드가 오타난 id를 비교하면 TS2367로 잡힌다.
 */
export type RelicEffect =
    | 'abyss_atk_scale'
    | 'abyss_crit_scale'
    | 'abyss_floor_power'
    | 'ancient_power'
    | 'armor_pen'
    | 'battle_start_atk'
    | 'battle_start_buff'
    | 'battle_start_heal'
    | 'boss_hunter'
    | 'cd_minus'
    | 'chaos_buff'
    | 'chaos_relic'
    | 'combo_stack'
    | 'cooldown_reduce'
    | 'crit_block'
    | 'crit_dmg'
    | 'crit_mp_regen'
    | 'cursed_power'
    | 'death_save'
    | 'devour_hp'
    | 'dot_mult'
    | 'double_strike'
    | 'drop_rate'
    | 'dual_crit'
    | 'echo_atk'
    | 'elem_boost'
    | 'entropy_tick'
    | 'event_chance'
    | 'execute_atk'
    | 'execute_bonus'
    | 'exp_mult'
    | 'first_turn_evade'
    | 'fortress'
    | 'free_skill'
    | 'genesis'
    | 'glass_cannon'
    | 'gold_mult'
    | 'hp_drain_atk'
    | 'kill_bonus'
    | 'kill_stack'
    | 'kill_stack_atk'
    | 'low_hp_atk'
    | 'low_hp_dmg'
    | 'mp_mult'
    | 'mp_regen_turn'
    | 'mp_restore_battle'
    | 'omega'
    | 'on_hit_freeze'
    | 'on_kill_heal'
    | 'phoenix_revive'
    | 'reflect'
    | 'reflect_crit'
    | 'regen'
    | 'skill_lifesteal'
    | 'skill_mult'
    | 'spell_stack'
    | 'status_resist'
    | 'stone_skin'
    | 'titan'
    | 'triple_up'
    | 'void_heart';

/**
 * `relic.val`이 dict일 때 등장하는 키 전체 (RELICS 실측).
 * effect별로 쓰는 키가 다르므로 전부 optional.
 */
export interface RelicVal {
    atk?: number;
    atkBonus?: number;
    atkBuff?: number;
    atkPer?: number;
    bonus?: number;
    cdReduction?: number;
    crit?: number;
    critBonus?: number;
    critPer?: number;
    critReduce?: number;
    damage?: number;
    def?: number;
    defBonus?: number;
    dmg_mult?: number;
    drop?: number;
    duration?: number;
    exp?: number;
    firstFree?: boolean;
    gold?: number;
    healPerTurn?: number;
    healRatio?: number;
    hp?: number;
    hpCost?: number;
    hp_cost?: number;
    interval?: number;
    max?: number;
    maxBonus?: number;
    minFloor?: number;
    mult?: number;
    perFloors?: number;
    perKill?: number;
    perStack?: number;
    reflect?: number;
    spawn?: number;
    stack?: number;
    statBonus?: number;
    survive?: number;
    threshold?: number;
    turns?: number;
}

export interface Relic {
    id?: string;
    name?: string;
    rarity?: RelicRarity;
    desc?: string;
    /** 유물의 효과 키 (CombatEngine + 패시브 처리에서 분기). */
    effect?: RelicEffect;
    /**
     * 효과 매개변수 — effect마다 number 단일값이거나 `RelicVal` dict다.
     * 유니온으로 좁히면 131개 소비처가 전부 런타임 narrowing(`typeof`/`as`)을 요구해
     * 이번 슬라이스(런타임 변경 0) 범위를 넘는다. 키 집합은 `RelicVal`에 문서화하고
     * `tests/data-shape-types.test.js`가 데이터 쪽을 검증한다.
     */
    // L-TODO(types): `number | RelicVal` 유니온화 — 소비처 narrowing 슬라이스 필요.
    val?: any;
    /** 발동 임계값 (값에 따라 val 안에 들거나 외부에 있음). */
    threshold?: number;
    /** `ancient_power` 계열의 평탄 스탯 보정 (val과 별개로 top-level 보유). */
    atkVal?: number;
    defVal?: number;
    mpVal?: number;
    /** `kill_stack_atk` 계열 — 스택당 증가치 / 스택 상한. */
    stackPer?: number;
    stackVal?: number;
}

/**
 * 유물 시너지 정의 (`RELIC_SYNERGIES`).
 *
 * `bonus`는 시너지마다 쓰는 키가 다르지만, 20종 전체에서 등장하는 키 집합이
 * 유한하므로 인덱스 시그니처 대신 optional 필드로 전부 선언한다.
 * (`effect`만 필수 — 모든 분기가 `bonus.effect` 문자열 비교로 이뤄진다.)
 */
export type RelicSynergyEffect =
    | 'absolute_immortal'
    | 'absolute_reflect'
    | 'annihilator'
    | 'arcane_singularity'
    | 'arcane_surge'
    | 'blood_immortal'
    | 'death_oracle'
    | 'entropy_brand'
    | 'entropy_god'
    | 'eternal_fortress'
    | 'eternal_life'
    | 'hell_reaper'
    | 'immortal_warrior'
    | 'infinite_devour'
    | 'primordial_wrath'
    | 'time_dominator'
    | 'time_master'
    | 'unbreakable'
    | 'vampire_lord'
    | 'void_dragon';

export interface RelicSynergyBonus {
    effect: RelicSynergyEffect;
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
