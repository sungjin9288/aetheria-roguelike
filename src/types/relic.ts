/**
 * Relic domain type (cycle 60 phase D batch 11 → 2026-09 Wave 3 L stage 1).
 *
 * effect마다 값의 형태가 다른 유물 데이터를 담는 인터페이스.
 *
 * 2026-09 L stage 1: `[key: string]: any` 인덱스 시그니처 제거.
 * `RELICS` 67개 엔트리가 실제로 쓰는 필드만 선언하며, `effect`는 데이터에 존재하는
 * 61개 id의 리터럴 유니온이다. 이제 `relic.오타` / `effect: 'typo'`가 컴파일 에러다.
 *
 * 2026-09 Wave 4 M: 이 파일의 마지막 `any` 필드였던 `val`을 닫았다. RELICS 67개 실측 결과
 * `val`의 형태는 `effect`가 완전히 결정한다(number 34종 / dict 23종 / 없음 4종,
 * 형태가 섞인 effect 0종). 따라서 `Relic`은 `effect`를 판별자로 하는 판별 유니온이고,
 * `relic.effect === 'x'` 비교 한 번으로 `val`이 자동으로 좁혀진다.
 * 판별 없이 훑는 헬퍼는 `data/relics.ts`의 `relicNumber()` / `relicDict()`를 쓴다.
 */

/** RELICS 데이터에 존재하는 희귀도 (5종). */
export type RelicRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * `val`이 number 단일값인 effect (RELICS 실측 34종).
 * `tests/data-shape-types.test.js`가 데이터와의 일치를 런타임 검증한다.
 */
export type NumericRelicEffect =
    | 'armor_pen'
    | 'battle_start_atk'
    | 'battle_start_heal'
    | 'cd_minus'
    | 'chaos_buff'
    | 'crit_block'
    | 'crit_dmg'
    | 'crit_mp_regen'
    | 'death_save'
    | 'devour_hp'
    | 'dot_mult'
    | 'double_strike'
    | 'drop_rate'
    | 'dual_crit'
    | 'echo_atk'
    | 'elem_boost'
    | 'event_chance'
    | 'execute_atk'
    | 'exp_mult'
    | 'first_turn_evade'
    | 'free_skill'
    | 'gold_mult'
    | 'low_hp_dmg'
    | 'mp_mult'
    | 'mp_regen_turn'
    | 'omega'
    | 'on_hit_freeze'
    | 'on_kill_heal'
    | 'reflect'
    | 'regen'
    | 'skill_lifesteal'
    | 'skill_mult'
    | 'status_resist'
    | 'stone_skin';

/**
 * `val`이 `RelicVal` dict인 effect (RELICS 실측 23종).
 */
export type DictRelicEffect =
    | 'abyss_atk_scale'
    | 'abyss_crit_scale'
    | 'abyss_floor_power'
    | 'ancient_power'
    | 'battle_start_buff'
    | 'boss_hunter'
    | 'combo_stack'
    | 'cooldown_reduce'
    | 'cursed_power'
    | 'entropy_tick'
    | 'execute_bonus'
    | 'fortress'
    | 'genesis'
    | 'glass_cannon'
    | 'hp_drain_atk'
    | 'kill_bonus'
    | 'kill_stack_atk'
    | 'low_hp_atk'
    | 'phoenix_revive'
    | 'reflect_crit'
    | 'spell_stack'
    | 'titan'
    | 'void_heart';

/**
 * `val` 자체가 없는 effect (RELICS 실측 4종).
 * 매개변수는 top-level 필드(`stackPer`/`stackVal`/`atkVal`/`defVal`/`mpVal`)에 있거나
 * 효과가 매개변수를 쓰지 않는다.
 */
export type ValuelessRelicEffect =
    | 'chaos_relic'
    | 'kill_stack'
    | 'mp_restore_battle'
    | 'triple_up';

/**
 * RELICS 데이터에 존재하는 effect id 전체 (61종).
 * 분기 코드가 오타난 id를 비교하면 TS2367로 잡힌다.
 */
export type RelicEffect = NumericRelicEffect | DictRelicEffect | ValuelessRelicEffect;

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

/** 모든 유물이 공유하는 메타 필드. */
interface RelicBase {
    id?: string;
    name?: string;
    rarity?: RelicRarity;
    desc?: string;
    /** 발동 임계값 (값에 따라 val 안에 들거나 외부에 있음). */
    threshold?: number;
    /** `triple_up`(룬 왕관)의 평탄 스탯 보정 — val과 별개로 top-level 보유. */
    atkVal?: number;
    defVal?: number;
    mpVal?: number;
    /** `kill_stack`(영혼 수집가) — 스택 간격 / 스택당 증가치. */
    stackPer?: number;
    stackVal?: number;
}

/** `RelicVal`에서 필요한 키만 골라 필수로 만드는 헬퍼 (키 이름/타입의 단일 출처는 `RelicVal`). */
type RelicValOf<K extends keyof RelicVal> = Required<Pick<RelicVal, K>>;

/**
 * dict effect별 `val` 실제 형태 (RELICS 실측).
 * 23종의 키 집합 합집합이 `RelicVal`의 39키와 정확히 같다 —
 * `tests/data-shape-types.test.js`가 이를 데이터로 검증한다.
 */
export interface RelicValByEffect {
    abyss_atk_scale: RelicValOf<'perFloors' | 'atkPer' | 'maxBonus'>;
    abyss_crit_scale: RelicValOf<'perFloors' | 'critPer' | 'maxBonus'>;
    abyss_floor_power: RelicValOf<'minFloor' | 'atkBonus' | 'defBonus'>;
    ancient_power: RelicValOf<'atk' | 'crit'>;
    battle_start_buff: RelicValOf<'atk' | 'turns'>;
    boss_hunter: RelicValOf<'spawn' | 'drop'>;
    combo_stack: RelicValOf<'stack' | 'bonus'>;
    cooldown_reduce: RelicValOf<'cdReduction' | 'firstFree'>;
    cursed_power: RelicValOf<'atk' | 'hp_cost'>;
    entropy_tick: RelicValOf<'interval' | 'damage'>;
    execute_bonus: RelicValOf<'threshold' | 'mult'>;
    fortress: RelicValOf<'def' | 'hp'>;
    genesis: RelicValOf<'statBonus' | 'healPerTurn'>;
    glass_cannon: RelicValOf<'atk' | 'def'>;
    hp_drain_atk: RelicValOf<'hpCost' | 'atkBonus'>;
    kill_bonus: RelicValOf<'exp' | 'gold'>;
    kill_stack_atk: RelicValOf<'perKill' | 'max'>;
    low_hp_atk: RelicValOf<'threshold' | 'bonus'>;
    phoenix_revive: RelicValOf<'healRatio' | 'atkBuff' | 'duration'>;
    reflect_crit: RelicValOf<'reflect' | 'critBonus'>;
    spell_stack: RelicValOf<'perStack' | 'max'>;
    titan: RelicValOf<'hp' | 'critReduce'>;
    void_heart: RelicValOf<'survive' | 'dmg_mult'>;
}

/**
 * `val`이 number 단일값인 유물 (34 effect).
 *
 * effect마다 별개 constituent로 펼치는 이유: `effect`가 단일 리터럴이어야 TS가
 * `relics.find((r) => r.effect === 'crit_dmg')` 콜백에서 타입 술어를 추론해
 * `val`을 자동으로 좁혀준다. 34종을 `effect: NumericRelicEffect` 한 인터페이스로 묶으면
 * 추론이 되지 않아 소비처마다 `typeof` 분기가 필요해진다 (dict/valueless도 같은 이유).
 */
export type NumericRelic = {
    [K in NumericRelicEffect]: RelicBase & { effect: K; val: number };
}[NumericRelicEffect];

/** `val`이 dict인 유물 (23 effect). effect별로 키 집합이 정확히 고정된다. */
export type DictRelic = {
    [K in DictRelicEffect]: RelicBase & { effect: K; val: RelicValByEffect[K] };
}[DictRelicEffect];

/** `val`을 쓰지 않는 유물 (4 effect — 매개변수가 top-level이거나 아예 없다). */
export type ValuelessRelic = {
    [K in ValuelessRelicEffect]: RelicBase & { effect: K; val?: undefined };
}[ValuelessRelicEffect];

/**
 * 유물 1개.
 *
 * 2026-09 Wave 4 M: `val: any`를 제거하고 `effect`를 판별자로 하는
 * 판별 유니온으로 바꿨다. `relic.effect === 'glass_cannon'` 비교 한 번이면 `val`이
 * `{ atk: number; def: number }`로 자동으로 좁혀진다(`Array#find` 콜백도 TS의 추론
 * 타입 술어 덕에 그대로 좁혀진다). 판별이 불가능한 일반 헬퍼(합산 루프·최댓값 스캔)는
 * `data/relics.ts`의 `relicNumber()` / `relicDict()` 순수 접근자를 쓴다.
 */
export type Relic = NumericRelic | DictRelic | ValuelessRelic;

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
