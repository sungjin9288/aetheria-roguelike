import test from 'node:test';
import assert from 'node:assert/strict';

import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.js';
import { ITEMS } from '../src/data/items.js';
import { MONSTERS } from '../src/data/monsters.js';
import { MAPS } from '../src/data/maps.js';
import { QUESTS, ACHIEVEMENTS } from '../src/data/quests.js';
import { CLASSES } from '../src/data/classes.js';

/**
 * 데이터 ↔ 도메인 타입 계약 가드 (2026-09 Wave 3 트랙 L stage 1).
 *
 * `src/types/{relic,item,monster,map,quest,class}.ts`에서 `[key: string]: any`
 * 인덱스 시그니처를 제거하면서, 선언한 필드/리터럴 유니온이 실제 데이터와 일치하는지는
 * 컴파일이 아니라 이 테스트가 런타임으로 못 박는다.
 *
 * - 필드 집합: 데이터에 있는 키가 타입 선언 목록 밖이면 실패(= 타입에 선언 누락).
 * - 리터럴 유니온: 데이터 값이 유니온 밖이거나, 유니온에 죽은 항목이 있으면 실패.
 *
 * 데이터를 추가할 때 타입도 같이 고치도록 강제하는 것이 목적이다.
 */

const keysOf = (entries) => {
    const seen = new Set();
    for (const entry of entries) {
        for (const key of Object.keys(entry ?? {})) seen.add(key);
    }
    return [...seen].sort();
};

const valuesOf = (entries, key) => {
    const seen = new Set();
    for (const entry of entries) {
        if (entry?.[key] !== undefined) seen.add(entry[key]);
    }
    return [...seen].sort();
};

/** 데이터 키가 타입 선언 목록의 부분집합인지 검사. */
const assertDeclared = (label, entries, declared) => {
    const allowed = new Set(declared);
    const undeclared = keysOf(entries).filter((key) => !allowed.has(key));
    assert.deepEqual(undeclared, [], `${label}: 타입에 선언되지 않은 필드 — ${undeclared.join(', ')}`);
};

/** 리터럴 유니온이 데이터 값 집합과 정확히 일치하는지 검사. */
const assertUnionExact = (label, entries, key, union) => {
    assert.deepEqual(valuesOf(entries, key), [...union].sort(), `${label}.${key} 유니온 불일치`);
};

// --- types/relic.ts ---

const RELIC_FIELDS = [
    'id', 'name', 'rarity', 'desc', 'effect', 'val', 'threshold',
    'atkVal', 'defVal', 'mpVal', 'stackPer', 'stackVal',
];

const RELIC_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RELIC_EFFECTS = [
    'abyss_atk_scale', 'abyss_crit_scale', 'abyss_floor_power', 'ancient_power', 'armor_pen',
    'battle_start_atk', 'battle_start_buff', 'battle_start_heal', 'boss_hunter', 'cd_minus',
    'chaos_buff', 'chaos_relic', 'combo_stack', 'cooldown_reduce', 'crit_block', 'crit_dmg',
    'crit_mp_regen', 'cursed_power', 'death_save', 'devour_hp', 'dot_mult', 'double_strike',
    'drop_rate', 'dual_crit', 'echo_atk', 'elem_boost', 'entropy_tick', 'event_chance',
    'execute_atk', 'execute_bonus', 'exp_mult', 'first_turn_evade', 'fortress', 'free_skill',
    'genesis', 'glass_cannon', 'gold_mult', 'hp_drain_atk', 'kill_bonus', 'kill_stack',
    'kill_stack_atk', 'low_hp_atk', 'low_hp_dmg', 'mp_mult', 'mp_regen_turn', 'mp_restore_battle',
    'omega', 'on_hit_freeze', 'on_kill_heal', 'phoenix_revive', 'reflect', 'reflect_crit',
    'regen', 'skill_lifesteal', 'skill_mult', 'spell_stack', 'status_resist', 'stone_skin',
    'titan', 'triple_up', 'void_heart',
];

/**
 * types/relic.ts NumericRelicEffect — `val`이 number 단일값인 effect (34종).
 * 2026-09 Wave 4 M: `Relic`이 `effect` 판별 유니온이 되면서 이 3분할이 타입 계약이다.
 */
const NUMERIC_RELIC_EFFECTS = [
    'armor_pen', 'battle_start_atk', 'battle_start_heal', 'cd_minus', 'chaos_buff',
    'crit_block', 'crit_dmg', 'crit_mp_regen', 'death_save', 'devour_hp', 'dot_mult',
    'double_strike', 'drop_rate', 'dual_crit', 'echo_atk', 'elem_boost', 'event_chance',
    'execute_atk', 'exp_mult', 'first_turn_evade', 'free_skill', 'gold_mult', 'low_hp_dmg',
    'mp_mult', 'mp_regen_turn', 'omega', 'on_hit_freeze', 'on_kill_heal', 'reflect',
    'regen', 'skill_lifesteal', 'skill_mult', 'status_resist', 'stone_skin',
];

/** types/relic.ts DictRelicEffect — `val`이 RelicVal dict인 effect (23종). */
const DICT_RELIC_EFFECTS = [
    'abyss_atk_scale', 'abyss_crit_scale', 'abyss_floor_power', 'ancient_power',
    'battle_start_buff', 'boss_hunter', 'combo_stack', 'cooldown_reduce', 'cursed_power',
    'entropy_tick', 'execute_bonus', 'fortress', 'genesis', 'glass_cannon', 'hp_drain_atk',
    'kill_bonus', 'kill_stack_atk', 'low_hp_atk', 'phoenix_revive', 'reflect_crit',
    'spell_stack', 'titan', 'void_heart',
];

/** types/relic.ts ValuelessRelicEffect — `val`을 아예 쓰지 않는 effect (4종). */
const VALUELESS_RELIC_EFFECTS = ['chaos_relic', 'kill_stack', 'mp_restore_battle', 'triple_up'];

/** types/relic.ts RelicValByEffect — dict effect별 필수 키 집합. */
const RELIC_VAL_BY_EFFECT = {
    abyss_atk_scale: ['perFloors', 'atkPer', 'maxBonus'],
    abyss_crit_scale: ['perFloors', 'critPer', 'maxBonus'],
    abyss_floor_power: ['minFloor', 'atkBonus', 'defBonus'],
    ancient_power: ['atk', 'crit'],
    battle_start_buff: ['atk', 'turns'],
    boss_hunter: ['spawn', 'drop'],
    combo_stack: ['stack', 'bonus'],
    cooldown_reduce: ['cdReduction', 'firstFree'],
    cursed_power: ['atk', 'hp_cost'],
    entropy_tick: ['interval', 'damage'],
    execute_bonus: ['threshold', 'mult'],
    fortress: ['def', 'hp'],
    genesis: ['statBonus', 'healPerTurn'],
    glass_cannon: ['atk', 'def'],
    hp_drain_atk: ['hpCost', 'atkBonus'],
    kill_bonus: ['exp', 'gold'],
    kill_stack_atk: ['perKill', 'max'],
    low_hp_atk: ['threshold', 'bonus'],
    phoenix_revive: ['healRatio', 'atkBuff', 'duration'],
    reflect_crit: ['reflect', 'critBonus'],
    spell_stack: ['perStack', 'max'],
    titan: ['hp', 'critReduce'],
    void_heart: ['survive', 'dmg_mult'],
};

/** types/relic.ts RelicVal — val이 dict일 때 등장 가능한 키 전체. */
const RELIC_VAL_FIELDS = [
    'atk', 'atkBonus', 'atkBuff', 'atkPer', 'bonus', 'cdReduction', 'crit', 'critBonus',
    'critPer', 'critReduce', 'damage', 'def', 'defBonus', 'dmg_mult', 'drop', 'duration',
    'exp', 'firstFree', 'gold', 'healPerTurn', 'healRatio', 'hp', 'hpCost', 'hp_cost',
    'interval', 'max', 'maxBonus', 'minFloor', 'mult', 'perFloors', 'perKill', 'perStack',
    'reflect', 'spawn', 'stack', 'statBonus', 'survive', 'threshold', 'turns',
];

const SYNERGY_EFFECTS = [
    'absolute_immortal', 'absolute_reflect', 'annihilator', 'arcane_singularity', 'arcane_surge',
    'blood_immortal', 'death_oracle', 'entropy_brand', 'entropy_god', 'eternal_fortress',
    'eternal_life', 'hell_reaper', 'immortal_warrior', 'infinite_devour', 'primordial_wrath',
    'time_dominator', 'time_master', 'unbreakable', 'vampire_lord', 'void_dragon',
];

const SYNERGY_BONUS_FIELDS = [
    'effect', 'atkMult', 'cdReduction', 'chaosAtk', 'critChance', 'critDmg', 'damage',
    'defMult', 'devour', 'dotMult', 'executeThreshold', 'extraAction', 'extraTurnChance',
    'fixedDmg', 'freeSkillChance', 'healOnSave', 'healPerTurn', 'hpCostReduction', 'interval',
    'killHeal', 'killStack', 'lifeSteal', 'lifeStealBonus', 'lowHpAtk', 'mpMult', 'reflect',
    'regenPerTurn', 'reviveCount', 'reviveHeal', 'skillMult', 'statBonus', 'stunOnReflect',
];

test('Relic: 데이터 필드가 types/relic.ts 선언 집합 안에 있다', () => {
    assertDeclared('RELICS', RELICS, RELIC_FIELDS);
    const valDicts = RELICS.map((relic) => relic.val).filter((val) => val && typeof val === 'object');
    assertDeclared('RELICS[].val', valDicts, RELIC_VAL_FIELDS);
});

test('Relic: effect / rarity 리터럴 유니온이 데이터와 정확히 일치한다', () => {
    assertUnionExact('RELICS', RELICS, 'effect', RELIC_EFFECTS);
    assertUnionExact('RELICS', RELICS, 'rarity', RELIC_RARITIES);
    assert.equal(RELIC_EFFECTS.length, 61);
});

test('Relic: effect 3분할(number/dict/없음)이 RelicEffect 61종을 정확히 덮는다', () => {
    const split = [...NUMERIC_RELIC_EFFECTS, ...DICT_RELIC_EFFECTS, ...VALUELESS_RELIC_EFFECTS];
    assert.equal(new Set(split).size, split.length, 'effect가 두 분할에 중복 등장');
    assert.deepEqual([...split].sort(), [...RELIC_EFFECTS].sort(), '3분할 합집합 ≠ RelicEffect');
    assert.equal(NUMERIC_RELIC_EFFECTS.length, 34);
    assert.equal(DICT_RELIC_EFFECTS.length, 23);
    assert.equal(VALUELESS_RELIC_EFFECTS.length, 4);
});

test('Relic: 모든 유물의 val 형태가 effect의 선언 형태와 일치한다', () => {
    const numeric = new Set(NUMERIC_RELIC_EFFECTS);
    const dict = new Set(DICT_RELIC_EFFECTS);
    for (const relic of RELICS) {
        const actual = relic.val === undefined
            ? 'none'
            : typeof relic.val === 'number' ? 'number'
            : (relic.val && typeof relic.val === 'object' && !Array.isArray(relic.val)) ? 'dict'
            : typeof relic.val;
        const declared = numeric.has(relic.effect) ? 'number' : dict.has(relic.effect) ? 'dict' : 'none';
        assert.equal(actual, declared, `${relic.id}(${relic.effect}): val 형태 ${actual} ≠ 선언 ${declared}`);
    }
});

test('Relic: dict effect별 val 키 집합이 RelicValByEffect 선언과 정확히 일치한다', () => {
    assert.deepEqual(Object.keys(RELIC_VAL_BY_EFFECT).sort(), [...DICT_RELIC_EFFECTS].sort());
    for (const relic of RELICS) {
        const declared = RELIC_VAL_BY_EFFECT[relic.effect];
        if (!declared) continue;
        assert.deepEqual(
            Object.keys(relic.val).sort(),
            [...declared].sort(),
            `${relic.id}(${relic.effect}): val 키 집합 불일치`,
        );
    }
    // RelicVal 39키 = dict effect별 키 집합의 합집합 (죽은 키 0개).
    const union = [...new Set(Object.values(RELIC_VAL_BY_EFFECT).flat())].sort();
    assert.deepEqual(union, [...RELIC_VAL_FIELDS].sort());
});

test('RelicSynergy: bonus 필드/effect 유니온이 데이터와 일치한다', () => {
    const synergies = Object.values(RELIC_SYNERGIES);
    assertDeclared('RELIC_SYNERGIES', synergies, ['label', 'requires', 'bonus', 'desc']);
    const bonuses = synergies.map((synergy) => synergy.bonus);
    assertDeclared('RELIC_SYNERGIES[].bonus', bonuses, SYNERGY_BONUS_FIELDS);
    assertUnionExact('RELIC_SYNERGIES[].bonus', bonuses, 'effect', SYNERGY_EFFECTS);
});

// --- types/item.ts ---

const ITEM_FIELDS = [
    'id', 'name', 'type', 'desc', 'desc_stat', 'tier', 'price', 'jobs', 'enhance', 'elem',
    'signature', 'hands', 'val', 'mp', 'crit', 'hp', 'subtype', 'effect', 'turn',
    'mpBonus', 'hpBonus', 'evasion', 'rarity',
];

const ITEM_TYPES = ['weapon', 'armor', 'shield', 'hp', 'mp', 'cure', 'buff', 'mat', 'key'];

test('Item: 장비/소비/소재 필드가 types/item.ts 선언 집합 안에 있다', () => {
    const items = [...ITEMS.weapons, ...ITEMS.armors, ...ITEMS.consumables, ...ITEMS.materials];
    assertDeclared('ITEMS', items, ITEM_FIELDS);
    assertUnionExact('ITEMS', items, 'type', ITEM_TYPES);
});

test('Item: prefixes / sets / recipes 필드가 선언 집합 안에 있다', () => {
    assertDeclared('ITEMS.prefixes', ITEMS.prefixes, ['name', 'type', 'stat', 'val', 'elem', 'price']);
    assertDeclared('ITEMS.sets', ITEMS.sets, ['prefix', 'setBonus', 'desc']);
    assertDeclared('ITEMS.recipes', ITEMS.recipes, ['id', 'name', 'inputs', 'gold']);
    const inputs = ITEMS.recipes.flatMap((recipe) => recipe.inputs ?? []);
    assertDeclared('ITEMS.recipes[].inputs', inputs, ['name', 'qty']);
});

test('Item: ItemDatabase 카테고리가 7개로 고정되어 있다', () => {
    assert.deepEqual(
        Object.keys(ITEMS).sort(),
        ['armors', 'consumables', 'materials', 'prefixes', 'recipes', 'sets', 'weapons'],
    );
});

// --- types/monster.ts ---

const MONSTER_TEMPLATE_FIELDS = [
    'name', 'baseName', 'hp', 'maxHp', 'atk', 'def', 'exp', 'gold', 'level',
    'weakness', 'resistance', 'isBoss', 'isElite', 'dropMod', 'statusOnHit',
    'hpMult', 'atkMult', 'defMult', 'expMult', 'goldMult', 'pattern', 'phase2', 'phase3',
    'dots', 'blindTurns', 'fearTurns', 'cursedTurns', 'stunnedTurns', 'tauntTurns',
    'cursed', 'taunted', 'guarding', 'phase2Triggered', 'phase3Triggered',
];

const ELEMENT_KEYS = ['냉기', '대지', '물리', '바람', '빛', '어둠', '에테르', '자연', '화염'];

test('Monster: 템플릿 필드가 types/monster.ts 선언 집합 안에 있다', () => {
    const monsters = Object.values(MONSTERS);
    assertDeclared('MONSTERS', monsters, MONSTER_TEMPLATE_FIELDS);
});

test('Monster: weakness / resistance 가 ElementKey 유니온 안에 있다', () => {
    const monsters = Object.values(MONSTERS);
    const elements = new Set(ELEMENT_KEYS);
    for (const [name, monster] of Object.entries(MONSTERS)) {
        if (monster.weakness !== undefined) {
            assert.ok(elements.has(monster.weakness), `${name}.weakness=${monster.weakness}`);
        }
        if (monster.resistance !== undefined) {
            assert.ok(elements.has(monster.resistance), `${name}.resistance=${monster.resistance}`);
        }
    }
    // 유니온에 죽은 항목이 없는지 (weakness ∪ resistance 가 9종 전부를 덮는다)
    const used = new Set([...valuesOf(monsters, 'weakness'), ...valuesOf(monsters, 'resistance')]);
    assert.deepEqual([...used].sort(), [...ELEMENT_KEYS].sort());
});

test('Monster: pattern 187개가 guardChance / heavyChance 를 모두 정의한다', () => {
    const monsters = Object.values(MONSTERS);
    const patterns = [
        ...monsters.map((monster) => monster.pattern),
        ...monsters.flatMap((monster) => [monster.phase2?.pattern, monster.phase3?.pattern]),
    ].filter(Boolean);
    assert.equal(patterns.length, 187);
    for (const pattern of patterns) {
        assert.equal(typeof pattern.guardChance, 'number');
        assert.equal(typeof pattern.heavyChance, 'number');
    }
    assertDeclared('MONSTERS pattern', patterns, ['guardChance', 'heavyChance']);
});

test('Monster: 보스 페이즈 필드가 BossPhase 선언 집합 안에 있다', () => {
    const phases = Object.values(MONSTERS)
        .flatMap((monster) => [monster.phase2, monster.phase3])
        .filter(Boolean);
    assertDeclared('MONSTERS phase', phases, ['threshold', 'name', 'atkBonus', 'defBonus', 'pattern', 'log', 'statusEffect']);
});

// --- types/map.ts ---

const MAP_FIELDS = [
    'name', 'type', 'level', 'desc', 'lore', 'exits', 'monsters', 'bossMonsters',
    'boss', 'eventChance', 'seasonOnly', 'graveDropBonus', 'shopBonus',
];

test('GameMap: 지역 필드/타입 유니온이 types/map.ts 선언과 일치한다', () => {
    const maps = Object.values(MAPS);
    assertDeclared('MAPS', maps, MAP_FIELDS);
    assertUnionExact('MAPS', maps, 'type', ['safe', 'field', 'dungeon', 'boss']);
});

// 2026-09 N3: 입장 최소 레벨의 단일 진실 원천은 `level`이다. `minLv`는 52개 지역 중
//   정의가 0개인데도 mapTopology/mapAccess/adventureGuide/questOperations/MapNavigator가
//   `minLv ?? level` 순으로 읽어 죽은 우선순위를 만들고 있었다. 리더와 타입 필드를 모두
//   걷어냈으므로, 데이터가 다시 minLv를 쓰면 아무도 읽지 않는 필드가 된다 — 0건 고정.
test('GameMap: minLv를 정의한 지역이 0개다 (N3 — 죽은 우선순위 재도입 차단)', () => {
    const offenders = Object.entries(MAPS)
        .filter(([, map]) => Object.hasOwn(map, 'minLv'))
        .map(([name]) => name);
    assert.deepEqual(offenders, [], 'minLv는 제거된 필드다 — 입장 레벨은 level로만 표현한다');
});

// 2026-09 N3: 일반 적의 상태이상 부여는 몬스터 최상위 `statusOnHit`(보스는 phase2/phase3의
//   `statusEffect`)만 살아 있다. pattern 안의 statusEffect/statusChance는 187개 중 정의가
//   0개라 CombatEngine.enemyAI / combatForecast의 분기가 죽어 있었다 — 리더와 함께 제거.
test('MonsterPattern: pattern에 statusEffect/statusChance를 정의한 항목이 0개다 (N3)', () => {
    const offenders = [];
    for (const [name, monster] of Object.entries(MONSTERS)) {
        const patterns = [
            ['base', monster.pattern],
            ['phase2', monster.phase2?.pattern],
            ['phase3', monster.phase3?.pattern],
        ];
        for (const [slot, pattern] of patterns) {
            if (!pattern) continue;
            if (Object.hasOwn(pattern, 'statusEffect') || Object.hasOwn(pattern, 'statusChance')) {
                offenders.push(`${name}.${slot}`);
            }
        }
    }
    assert.deepEqual(offenders, [], 'pattern 상태이상 키는 제거된 필드다 — statusOnHit / phase statusEffect를 쓸 것');
});

// --- types/quest.ts ---

const QUEST_FIELDS = [
    'id', 'title', 'desc', 'target', 'goal', 'reward', 'minLv', 'location',
    'prerequisiteQuestId', 'type', 'buildTag', 'buildLabel', 'objective', 'threshold',
];

const QUEST_TYPES = [
    'bounty_count', 'build_victory', 'combat_count', 'craft', 'discovery_count',
    'escape_count', 'explore_count', 'signature_collect', 'survive_low_hp',
];

const ACHIEVEMENT_TARGETS = [
    'abyssRecord', 'bossKills', 'bountiesCompleted', 'crafts', 'deaths', 'demonKingSlain',
    'discoveries', 'discoveryChains', 'escapes', 'explores', 'kills', 'level', 'maxKillStreak',
    'prestige', 'relicCount', 'rests', 'signatureSetsCompleted', 'signaturesDiscovered',
    'synths', 'total_gold',
];

test('Quest: 필드/타입/빌드태그 유니온이 types/quest.ts 선언과 일치한다', () => {
    assertDeclared('QUESTS', QUESTS, QUEST_FIELDS);
    assertUnionExact('QUESTS', QUESTS, 'type', QUEST_TYPES);
    assertUnionExact('QUESTS', QUESTS, 'buildTag', ['arcane', 'crusher', 'dual', 'explorer', 'fortress']);
});

test('Quest: target 의 통계 키가 Wave 3 H5 이후 소문자 level 로 통일돼 있다', () => {
    assert.ok(QUESTS.some((quest) => quest.target === 'level'));
    assert.equal(QUESTS.filter((quest) => quest.target === 'Level').length, 0);
});

test('QuestReward: 보상 키가 5종(exp/gold/item/title/premiumCurrency) 안에 있다', () => {
    const rewards = [...QUESTS, ...ACHIEVEMENTS].map((entry) => entry.reward).filter(Boolean);
    assertDeclared('reward', rewards, ['exp', 'gold', 'item', 'title', 'premiumCurrency']);
});

test('Achievement: 필드/target 유니온이 types/quest.ts 선언과 일치한다', () => {
    assertDeclared('ACHIEVEMENTS', ACHIEVEMENTS, ['id', 'title', 'desc', 'target', 'goal', 'reward']);
    assertUnionExact('ACHIEVEMENTS', ACHIEVEMENTS, 'target', ACHIEVEMENT_TARGETS);
});

// --- types/class.ts ---

const CLASS_FIELDS = ['tier', 'reqLv', 'desc', 'hpMod', 'mpMod', 'atkMod', 'skills', 'skillBranches', 'next'];

const CLASS_SKILL_FIELDS = [
    'name', 'mp', 'type', 'mult', 'desc', 'passive', 'effect', 'val', 'turn', 'crit', 'drainRatio',
    'effectChance', 'secondEffect', 'stunTurn', 'curseTurn', 'burnTurn', 'defBonus', 'mpRestore',
    'cooldown', 'fromWeapon', 'weaponName', 'slot', 'fromTrait',
];

const CLASS_SKILL_TYPES = ['buff', 'debuff', 'escape', '냉기', '대지', '물리', '빛', '어둠', '자연', '화염'];

const CLASS_SKILL_EFFECTS = [
    'all_up', 'atk_up', 'berserk', 'bleed', 'blind', 'burn', 'counter', 'crit_cooldown',
    'crit_up', 'curse', 'curse_amp', 'def_up', 'drain', 'escape_100', 'exp_up', 'extraTurn',
    'fear', 'freeze', 'gold_up', 'hp_regen', 'hp_up', 'low_hp_atk', 'mp_regen', 'mp_up',
    'poison', 'purify', 'resetCooldowns', 'stealth', 'stun', 'taunt',
];

test('ClassDef: 직업/스킬 필드가 types/class.ts 선언 집합 안에 있다', () => {
    const classes = Object.values(CLASSES);
    assertDeclared('CLASSES', classes, CLASS_FIELDS);
    const skills = classes.flatMap((def) => def.skills ?? []);
    assertDeclared('CLASSES[].skills', skills, CLASS_SKILL_FIELDS);
    assertUnionExact('CLASSES[].skills', skills, 'type', CLASS_SKILL_TYPES);
});

test('ClassSkill: effect / secondEffect 가 ClassSkillEffect 유니온 안에 있다', () => {
    const classes = Object.values(CLASSES);
    const skills = classes.flatMap((def) => def.skills ?? []);
    const overrides = classes
        .flatMap((def) => Object.values(def.skillBranches ?? {}))
        .flat()
        .map((branch) => branch.override)
        .filter(Boolean);
    const effects = new Set(CLASS_SKILL_EFFECTS);
    for (const effect of [...valuesOf(skills, 'effect'), ...valuesOf(overrides, 'effect'), ...valuesOf(overrides, 'secondEffect')]) {
        assert.ok(effects.has(effect), `선언되지 않은 스킬 effect — ${effect}`);
    }
    // 유니온에 죽은 항목이 없는지 (스킬 정의가 30종 전부를 쓴다)
    assert.deepEqual(valuesOf(skills, 'effect'), [...CLASS_SKILL_EFFECTS].sort());
});

test('SkillBranchChoice: override 키가 ClassSkill 필드의 부분집합이다', () => {
    const branches = Object.values(CLASSES)
        .flatMap((def) => Object.values(def.skillBranches ?? {}))
        .flat();
    assertDeclared('skillBranches[]', branches, ['choice', 'label', 'desc', 'override']);
    const overrides = branches.map((branch) => branch.override).filter(Boolean);
    assertDeclared('skillBranches[].override', overrides, CLASS_SKILL_FIELDS);
});
