import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { DB } from '../src/data/db.js';
import { BALANCE } from '../src/data/constants.js';

const makePlayer = (overrides = {}) => ({
    name: 'TestHero',
    job: '전사',
    level: 10,
    hp: 300,
    maxHp: 300,
    mp: 50,
    maxMp: 50,
    atk: 20,
    def: 10,
    exp: 0,
    nextExp: 100,
    gold: 100,
    loc: '시작의 마을',
    equip: {
        weapon: DB.ITEMS.weapons[0],
        armor: DB.ITEMS.armors[0],
        offhand: null,
    },
    inv: [],
    stats: {
        kills: 0,
        killRegistry: {},
        abyssFloor: 0,
        codexBonusAtk: 0,
        codexBonusDef: 0,
        codexBonusHp: 0,
    },
    tempBuff: { atk: 0, def: 0, turn: 0, name: null },
    meta: { bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
    relics: [],
    titles: [],
    activeTitle: null,
    skillChoices: {},
    killStreak: 0,
    combatFlags: {},
    ...overrides,
});

test('calculateFullStats returns null for null player', () => {
    assert.equal(calculateFullStats(null), null);
});

test('calculateFullStats produces deterministic output for identical input', () => {
    const player = makePlayer();
    const a = calculateFullStats(player);
    const b = calculateFullStats(player);
    assert.equal(a.atk, b.atk);
    assert.equal(a.def, b.def);
    assert.equal(a.maxHp, b.maxHp);
    assert.equal(a.maxMp, b.maxMp);
    assert.equal(a.critChance, b.critChance);
});

test('calculateFullStats does not mutate the input player', () => {
    const player = makePlayer();
    const snapshot = JSON.stringify(player);
    calculateFullStats(player);
    assert.equal(JSON.stringify(player), snapshot);
});

test('calculateFullStats returns base stats shape with required keys', () => {
    const stats = calculateFullStats(makePlayer());
    const required = [
        'atk', 'def', 'maxHp', 'maxMp',
        'elem', 'isMagic', 'weaponHands',
        'activeSet', 'relics', 'critChance',
        'buildProfile', 'traitProfile', 'traitBonus',
        'titlePassive', 'activeSynergies',
        'killStreak', 'killStreakTier',
        'passiveGoldMult', 'passiveExpMult',
    ];
    for (const key of required) {
        assert.ok(key in stats, `missing key: ${key}`);
    }
});

test('calculateFullStats includes equipment attack in base atk', () => {
    const bare = calculateFullStats(makePlayer({
        equip: { weapon: null, armor: null, offhand: null },
    }));
    const armed = calculateFullStats(makePlayer());
    assert.ok(armed.atk > bare.atk, 'equipped weapon must increase atk');
});

test('calculateFullStats respects BALANCE.CRIT_CHANCE as baseline', () => {
    const stats = calculateFullStats(makePlayer());
    assert.ok(stats.critChance >= BALANCE.CRIT_CHANCE - 0.001);
});

test('calculateFullStats caps crit chance at 0.75', () => {
    const player = makePlayer({
        relics: [
            { id: 'r1', effect: 'omega', val: 1.0 },
            { id: 'r2', effect: 'omega', val: 1.0 },
        ],
    });
    const stats = calculateFullStats(player);
    assert.ok(stats.critChance <= 0.75);
});

test('calculateFullStats applies codex kill milestones', () => {
    const player = makePlayer({
        stats: {
            kills: 0,
            killRegistry: { 슬라임: 100, 고블린: 50, 오크: 10 },
            abyssFloor: 0,
        },
    });
    const stats = calculateFullStats(player);
    const baseline = calculateFullStats(makePlayer());
    assert.ok(stats.atk > baseline.atk);
    assert.ok(stats.def > baseline.def);
    assert.ok(stats.maxHp > baseline.maxHp);
});

test('calculateFullStats applies enhancement bonus to weapon atk', () => {
    const base = calculateFullStats(makePlayer());
    const enhanced = calculateFullStats(makePlayer({
        equip: {
            weapon: { ...DB.ITEMS.weapons[0], enhance: 5 },
            armor: DB.ITEMS.armors[0],
            offhand: null,
        },
    }));
    assert.ok(enhanced.atk > base.atk, 'enhance +5 must increase atk');
});

test('calculateFullStats applies enhancement bonus to armor def', () => {
    const base = calculateFullStats(makePlayer());
    const enhanced = calculateFullStats(makePlayer({
        equip: {
            weapon: DB.ITEMS.weapons[0],
            armor: { ...DB.ITEMS.armors[0], enhance: 5 },
            offhand: null,
        },
    }));
    assert.ok(enhanced.def > base.def, 'enhance +5 must increase def');
});

test('calculateFullStats marks isMagic true for mage jobs', () => {
    const stats = calculateFullStats(makePlayer({ job: '마법사' }));
    assert.equal(stats.isMagic, true);
});

test('calculateFullStats keeps isMagic false for physical weapon warrior', () => {
    const stats = calculateFullStats(makePlayer({ job: '전사' }));
    assert.equal(stats.isMagic, false);
});

test('calculateFullStats accumulates kill_stack relic atk bonus', () => {
    const killStackRelic = {
        id: 'kill_stack_test',
        effect: 'kill_stack',
        stackPer: 50,
        stackVal: 25,
    };
    const noKills = calculateFullStats(makePlayer({
        relics: [killStackRelic],
        stats: { kills: 0, killRegistry: {}, abyssFloor: 0 },
    }));
    const manyKills = calculateFullStats(makePlayer({
        relics: [killStackRelic],
        stats: { kills: 150, killRegistry: {}, abyssFloor: 0 },
    }));
    assert.ok(manyKills.atk > noKills.atk);
});

test('calculateFullStats glass_cannon relic trades def for atk', () => {
    const relic = { id: 'gc1', effect: 'glass_cannon', val: { atk: 0.5, def: -0.3 } };
    const stats = calculateFullStats(makePlayer({ relics: [relic] }));
    const baseline = calculateFullStats(makePlayer());
    assert.ok(stats.atk > baseline.atk);
    assert.ok(stats.def < baseline.def);
});

test('calculateFullStats low_hp_atk relic activates below threshold', () => {
    const relic = {
        id: 'lhatk',
        effect: 'low_hp_atk',
        val: { threshold: 0.5, bonus: 0.5 },
    };
    const highHp = calculateFullStats(makePlayer({
        hp: 280, maxHp: 300,
        relics: [relic],
    }));
    const lowHp = calculateFullStats(makePlayer({
        hp: 80, maxHp: 300,
        relics: [relic],
    }));
    assert.ok(lowHp.atk > highHp.atk, 'low HP must trigger bonus');
});

test('calculateFullStats kill streak atk bonus grows with streak tiers', () => {
    const noStreak = calculateFullStats(makePlayer({ killStreak: 0 }));
    const highStreak = calculateFullStats(makePlayer({
        killStreak: BALANCE.KILL_STREAK_TIERS[BALANCE.KILL_STREAK_TIERS.length - 1],
    }));
    assert.ok(highStreak.atk >= noStreak.atk);
    assert.ok(highStreak.killStreakTier >= 0);
    assert.equal(noStreak.killStreakTier, -1);
});

test('calculateFullStats abyss_atk_scale relic scales with floor', () => {
    const relic = {
        id: 'abyss1',
        effect: 'abyss_atk_scale',
        val: { perFloors: 5, atkPer: 0.1, maxBonus: 1.0 },
    };
    const lowFloor = calculateFullStats(makePlayer({
        relics: [relic],
        stats: { kills: 0, killRegistry: {}, abyssFloor: 0 },
    }));
    const highFloor = calculateFullStats(makePlayer({
        relics: [relic],
        stats: { kills: 0, killRegistry: {}, abyssFloor: 50 },
    }));
    assert.ok(highFloor.atk > lowFloor.atk);
});
