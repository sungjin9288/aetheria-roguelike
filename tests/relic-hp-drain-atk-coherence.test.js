import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DB } from '../src/data/db.ts';
import { RELICS } from '../src/data/relics.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import {
    buildRelicHpDrainAtkReport,
    canonicalizeRelicHpDrainAtkReport,
} from '../src/systems/relicHpDrainAtkAudit.ts';
import { resolveHpDrainAtkRelic } from '../src/utils/hpDrainAtkRelic.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { migrateData } from '../src/utils/dataMigration.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bloodOathRing = RELICS.find((relic) => relic.id === 'blood_oath_ring');
const abyssalContract = RELICS.find((relic) => relic.id === 'abyssal_contract');
const soulDrain = RELICS.find((relic) => relic.id === 'soul_drain');

const makePlayer = (relics, overrides = {}) => ({
    name: 'paired-contract-test',
    job: '모험가',
    level: 50,
    hp: 1000,
    maxHp: 1000,
    mp: 500,
    maxMp: 500,
    atk: 1000,
    def: 500,
    inv: [],
    equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    relics,
    skillChoices: {},
    titles: [],
    activeTitle: null,
    killStreak: 0,
    combatFlags: {},
    status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
    ...overrides,
});

const turnSettlement = (relics, overrides) => {
    const result = CombatEngine.tickCombatState(makePlayer(relics, overrides));
    const log = result.logs.find((entry) => entry.text.includes('HP 대가'));
    return {
        hp: result.updatedPlayer.hp,
        label: log?.text.match(/^\[([^\]]+)\]/)?.[1],
        logs: result.logs,
    };
};

const pair = (selection) => selection && {
    id: selection.id,
    label: selection.label,
    atkBonus: selection.atkBonus,
    hpCost: selection.hpCost,
};

const readSources = () => ({
    resolverSource: readFileSync(path.join(ROOT, 'src/utils/hpDrainAtkRelic.ts'), 'utf8'),
    statsSource: readFileSync(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8'),
    combatSource: readFileSync(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8'),
});

test('catalog bytes preserve the approved blood oath and abyssal contract pairs', () => {
    assert.deepEqual(bloodOathRing && {
        id: bloodOathRing.id,
        name: bloodOathRing.name,
        effect: bloodOathRing.effect,
        val: bloodOathRing.val,
    }, {
        id: 'blood_oath_ring',
        name: '혈맹의 반지',
        effect: 'hp_drain_atk',
        val: { atkBonus: 0.35, hpCost: 0.03 },
    });
    assert.deepEqual(abyssalContract && {
        id: abyssalContract.id,
        name: abyssalContract.name,
        effect: abyssalContract.effect,
        val: abyssalContract.val,
    }, {
        id: 'abyssal_contract',
        name: '심연의 계약',
        effect: 'hp_drain_atk',
        val: { atkBonus: 0.6, hpCost: 0.05 },
    });
});

test('historical RED records the additive attack, first-match cost, and wrong abyssal label', () => {
    const report = buildRelicHpDrainAtkReport({ relics: RELICS, ...readSources() });
    assert.deepEqual(report.predecessorRed, {
        bothRelicAttackBonusAdded: 0.95,
        firstMatchHpCosts: [0.03, 0.05],
        abyssalSettlementLabel: '혈맹의 반지',
    });
});

test('shared resolver returns no selection, preserves each single pair, and selects abyssal in either order', () => {
    assert.equal(resolveHpDrainAtkRelic([]), null);
    assert.deepEqual(pair(resolveHpDrainAtkRelic([bloodOathRing])), {
        id: 'blood_oath_ring', label: '혈맹의 반지', atkBonus: 0.35, hpCost: 0.03,
    });
    assert.deepEqual(pair(resolveHpDrainAtkRelic([abyssalContract])), {
        id: 'abyssal_contract', label: '심연의 계약', atkBonus: 0.6, hpCost: 0.05,
    });
    for (const relics of [[bloodOathRing, abyssalContract], [abyssalContract, bloodOathRing]]) {
        assert.deepEqual(pair(resolveHpDrainAtkRelic(relics)), {
            id: 'abyssal_contract', label: '심연의 계약', atkBonus: 0.6, hpCost: 0.05,
        });
    }
});

test('equal attack bonuses use an order-independent selected snapshot without separating cost or label', () => {
    const zeta = { id: 'zeta', name: '제타', effect: 'hp_drain_atk', val: { atkBonus: 0.6, hpCost: 0.09 } };
    const alpha = { id: 'alpha', name: '알파', effect: 'hp_drain_atk', val: { atkBonus: 0.6, hpCost: 0.02 } };
    const expected = { id: 'alpha', label: '알파', atkBonus: 0.6, hpCost: 0.02 };

    assert.deepEqual(pair(resolveHpDrainAtkRelic([zeta, alpha])), expected);
    assert.deepEqual(pair(resolveHpDrainAtkRelic([alpha, zeta])), expected);
});

test('calculateFullStats uses the paired strongest selection instead of additive duplicate bonuses', () => {
    const noRelic = calculateFullStats(makePlayer([]));
    const bloodOnly = calculateFullStats(makePlayer([bloodOathRing]));
    const abyssOnly = calculateFullStats(makePlayer([abyssalContract]));

    assert.equal(calculateFullStats(makePlayer([bloodOathRing, abyssalContract])).atk, abyssOnly.atk);
    assert.equal(calculateFullStats(makePlayer([abyssalContract, bloodOathRing])).atk, abyssOnly.atk);
    assert.ok(bloodOnly.atk > noRelic.atk);
    assert.ok(abyssOnly.atk > bloodOnly.atk);
});

test('normal settlements use the selected source label and paired HP cost in either inventory order', () => {
    const bloodOath = turnSettlement([bloodOathRing]);
    assert.equal(bloodOath.hp, 970);
    assert.equal(bloodOath.label, '혈맹의 반지');
    const abyssal = turnSettlement([abyssalContract]);
    assert.equal(abyssal.hp, 950);
    assert.equal(abyssal.label, '심연의 계약');

    for (const relics of [[bloodOathRing, abyssalContract], [abyssalContract, bloodOathRing]]) {
        const result = turnSettlement(relics);
        assert.equal(result.hp, 950);
        assert.equal(result.label, '심연의 계약');
    }
});

test('hell reaper retains abyssal attack, replaces only its cost with 0.02, and owns its narration', () => {
    const abyssalStats = calculateFullStats(makePlayer([abyssalContract]));
    for (const relics of [
        [bloodOathRing, abyssalContract, soulDrain],
        [abyssalContract, bloodOathRing, soulDrain],
    ]) {
        assert.equal(calculateFullStats(makePlayer(relics)).atk, abyssalStats.atk);
        const result = turnSettlement(relics);
        assert.equal(result.hp, 980);
        assert.equal(result.label, '지옥의 수확자');
    }
});

test('every malformed matching snapshot fails before tick state can mutate, including an unselected loser', () => {
    const malformed = [
        { effect: 'hp_drain_atk' },
        { effect: 'hp_drain_atk', val: 0.03 },
        { effect: 'hp_drain_atk', val: { hpCost: 0.03 } },
        { effect: 'hp_drain_atk', val: { atkBonus: 0.35 } },
        { effect: 'hp_drain_atk', val: { atkBonus: '0.35', hpCost: 0.03 } },
        { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: '0.03' } },
        { effect: 'hp_drain_atk', val: { atkBonus: -0.35, hpCost: 0.03 } },
        { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: -0.03 } },
        { effect: 'hp_drain_atk', val: { atkBonus: Number.NaN, hpCost: 0.03 } },
        { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: Number.NaN } },
        { effect: 'hp_drain_atk', val: { atkBonus: Number.POSITIVE_INFINITY, hpCost: 0.03 } },
        { effect: 'hp_drain_atk', val: { atkBonus: 0.35, hpCost: Number.POSITIVE_INFINITY } },
    ];

    for (const relic of malformed) {
        const player = makePlayer([relic], {
            hp: 500,
            status: ['poison'],
            tempBuff: { atk: 0.2, def: 0, turn: 2, name: 'test' },
            skillLoadout: { selected: 0, cooldowns: { test: 3 } },
        });
        const before = structuredClone(player);
        assert.throws(() => resolveHpDrainAtkRelic([relic]), /INVALID_HP_DRAIN_ATK_RELIC_VALUE/);
        assert.throws(() => calculateFullStats(player), /INVALID_HP_DRAIN_ATK_RELIC_VALUE/);
        assert.throws(() => CombatEngine.tickCombatState(player), /INVALID_HP_DRAIN_ATK_RELIC_VALUE/);
        assert.deepEqual(player, before);
    }

    const loser = { effect: 'hp_drain_atk', val: { atkBonus: '0.35', hpCost: 0.03 } };
    assert.throws(() => resolveHpDrainAtkRelic([abyssalContract, loser]), /INVALID_HP_DRAIN_ATK_RELIC_VALUE/);
    assert.throws(() => resolveHpDrainAtkRelic([loser, abyssalContract]), /INVALID_HP_DRAIN_ATK_RELIC_VALUE/);
});

test('malformed hp_drain_atk rejects a reducer action before any reducer mutation', () => {
    const malformed = { effect: 'hp_drain_atk', val: { atkBonus: 0.6, hpCost: Number.NaN } };
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: makePlayer([malformed]),
        gameState: 'combat',
        enemy: {
            name: '훈련용 정령', baseName: '훈련용 정령', level: 1,
            hp: 10_000, maxHp: 10_000, atk: 1, def: 0, exp: 1, gold: 1,
            pattern: { guardChance: 0, heavyChance: 0 },
        },
        combatTurn: 0,
    };
    const before = structuredClone(state);
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);

    assert.throws(() => actionMap.RESOLVE_COMBAT_ACTION(state, {
        type: 'RESOLVE_COMBAT_ACTION',
        payload: { kind: 'attack', expectedTurn: 0, seed: 9, now: 1_700_000_000_000 },
    }), /INVALID_HP_DRAIN_ATK_RELIC_VALUE/);
    assert.deepEqual(state, before);
});

test('HP remains bounded at one, active-run snapshots survive migration/reload, and receipt replay is identity no-op', () => {
    assert.equal(turnSettlement([abyssalContract], { hp: 1 }).hp, 1);

    const legacyRelics = [structuredClone(bloodOathRing), structuredClone(abyssalContract)];
    const legacyBytes = JSON.stringify(legacyRelics);
    const migrated = migrateData({ version: 6, player: makePlayer(legacyRelics) });
    assert.equal(JSON.stringify(migrated.player.relics), legacyBytes);

    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: makePlayer([abyssalContract]),
        gameState: 'combat',
        enemy: {
            name: '훈련용 정령', baseName: '훈련용 정령', level: 1,
            hp: 10_000, maxHp: 10_000, atk: 1, def: 0, exp: 1, gold: 1,
            pattern: { guardChance: 0, heavyChance: 0 },
        },
        combatTurn: 0,
    };
    const action = {
        type: 'RESOLVE_COMBAT_ACTION',
        payload: { kind: 'attack', expectedTurn: 0, seed: 11, now: 1_700_000_000_001 },
    };
    const settled = actionMap.RESOLVE_COMBAT_ACTION(state, action);
    const replayed = actionMap.RESOLVE_COMBAT_ACTION(settled, action);
    assert.equal(replayed, settled);
});

test('source audit proves the resolver is shared, selected before turn mutation, and has no duplicate selector', () => {
    const report = buildRelicHpDrainAtkReport({ relics: RELICS, ...readSources() });
    assert.deepEqual(report.safeguards.sourcePolicy, {
        resolverUsedByStats: true,
        resolverUsedBeforeTickMutation: true,
        directHpDrainSelectorAbsent: true,
    });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report, canonicalizeRelicHpDrainAtkReport(report));
});

test('audit fails closed on catalog, pair policy, label policy, and source-owner drift', () => {
    const relics = RELICS.map((relic) => ({ ...relic, val: relic.val && typeof relic.val === 'object' ? { ...relic.val } : relic.val }));
    relics.find((relic) => relic.id === 'blood_oath_ring').val.atkBonus = 0.36;
    relics.find((relic) => relic.id === 'abyssal_contract').name = '잘못된 계약';
    const report = buildRelicHpDrainAtkReport({
        relics,
        resolverSource: 'relic?.effect === \'hp_drain_atk\'',
        statsSource: '',
        combatSource: '',
    });

    assert.ok(report.errors.includes('BLOOD_OATH_RING_CATALOG_MISMATCH'));
    assert.ok(report.errors.includes('ABYSSAL_CONTRACT_CATALOG_MISMATCH'));
    assert.ok(report.errors.includes('NORMAL_TURN_LABEL_POLICY_MISMATCH'));
    assert.ok(report.errors.includes('SHARED_RESOLVER_SOURCE_POLICY_MISMATCH'));
    assert.deepEqual(report.errors, [...report.errors].sort());
});

test('strict evidence verifier rejects unsafe arguments, stale bytes, and symlink targets', () => {
    const script = path.join(ROOT, 'scripts/verify-relic-hp-drain-atk.mjs');
    const outputRelative = 'docs/evidence/qa/release-complete-core/relic-hp-drain-atk.json';
    const run = (...args) => spawnSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    assert.equal(run('--verify', outputRelative).status, 0);
    for (const args of [
        [],
        ['--unknown', outputRelative],
        ['--verify', outputRelative, '--verify', outputRelative],
        ['--write', outputRelative, '--verify', outputRelative],
        ['--verify', '../relic-hp-drain-atk.json'],
        ['--verify', '/tmp/relic-hp-drain-atk.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\relic-hp-drain-atk.json'],
        ['--verify', 'docs/evidence/qa/./release-complete-core/relic-hp-drain-atk.json'],
    ]) {
        assert.notEqual(run(...args).status, 0, args.join(' '));
    }

    const suffix = randomUUID();
    const evidenceDir = path.join(ROOT, 'docs/evidence/qa/release-complete-core');
    const mismatchName = `relic-hp-drain-atk-mismatch-${suffix}.json`;
    const mismatchPath = path.join(evidenceDir, mismatchName);
    const symlinkName = `relic-hp-drain-atk-symlink-${suffix}.json`;
    const symlinkPath = path.join(evidenceDir, symlinkName);
    try {
        writeFileSync(mismatchPath, `${readFileSync(path.join(ROOT, outputRelative), 'utf8')} `);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${mismatchName}`).stderr,
            /EVIDENCE_BYTE_MISMATCH/,
        );
        symlinkSync('relic-hp-drain-atk.json', symlinkPath);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${symlinkName}`).stderr,
            /SYMLINK_OUTPUT_PATH/,
        );
    } finally {
        if (existsSync(mismatchPath)) unlinkSync(mismatchPath);
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
    }
});

test('canonical evidence binds production vectors, malformed/migration/replay contracts, and every source receipt hash', () => {
    const evidence = JSON.parse(readFileSync(
        path.join(ROOT, 'docs/evidence/qa/release-complete-core/relic-hp-drain-atk.json'),
        'utf8',
    ));
    assert.equal(evidence.hashAlgorithm, 'sha256');
    assert.deepEqual(Object.keys(evidence.authorityHashes).sort(), [
        'audit', 'catalog', 'combatEngine', 'focusedTest', 'plan', 'resolver', 'statsCalculator', 'verifier',
    ]);
    Object.values(evidence.authorityHashes).forEach((hash) => assert.match(hash, /^[a-f0-9]{64}$/));
    const canonicalReport = canonicalizeRelicHpDrainAtkReport(evidence.report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    assert.equal(evidence.reportHash, createHash('sha256').update(reportBytes).digest('hex'));
    assert.equal(evidence.report.safeguards.migrationPreservesSnapshotBytes, true);
    assert.equal(evidence.report.safeguards.reducerReplayContract, 'object-identity-no-op');
    assert.equal(evidence.report.receipt.changedPaths.length, 8);
});
