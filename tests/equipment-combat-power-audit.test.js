import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CANONICAL_EQUIPMENT } from '../src/utils/equipmentBaseIdentity.js';
import { CLASSES } from '../src/data/classes.js';
import { BALANCE } from '../src/data/constants.js';
import { buildClassVitals } from '../src/hooks/gameActions/_shared.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import {
    EQUIPMENT_COMBAT_POWER_AUDIT_POLICY_VERSION,
    EQUIPMENT_COMBAT_POWER_FLOAT_TOLERANCE,
    buildEquipmentCombatPowerReport,
} from '../src/systems/equipmentCombatPowerAudit.ts';

const EVIDENCE_PATH = 'docs/evidence/qa/release-complete-core/equipment-combat-power.json';
const CLI_PATH = 'scripts/verify-equipment-combat-power.mjs';
const EXPECTED_DOMINANCE_PAIRS = [];

const cloneRows = () => CANONICAL_EQUIPMENT.map((row) => ({ ...row, jobs: [...row.jobs] }));

const buildPlayer = (job, tier, item = null) => {
    const level = BALANCE.TIER_REQ_LEVEL[tier];
    const vitals = buildClassVitals(level, job, { bonusHp: 0, bonusMp: 0, prestigeRank: 0 });
    const equip = { weapon: null, armor: null, offhand: null };
    if (item) equip[item.type === 'shield' ? 'offhand' : item.type] = item;
    return {
        name: 'equipment-audit', job, level,
        hp: vitals.maxHp, maxHp: vitals.maxHp,
        mp: vitals.maxMp, maxMp: vitals.maxMp,
        atk: 10, def: 5,
        equip, relics: [], stats: {}, meta: { bonusHp: 0, bonusMp: 0, prestigeRank: 0 },
        skillChoices: {}, titles: [], activeTitle: null,
    };
};

const projectionFor = (row, job) => {
    const baseline = calculateFullStats(buildPlayer(job, row.tier));
    const equipped = calculateFullStats(buildPlayer(job, row.tier, row));
    return {
        job,
        atk: equipped.atk - baseline.atk,
        def: equipped.def - baseline.def,
        maxHp: equipped.maxHp - baseline.maxHp,
        maxMp: equipped.maxMp - baseline.maxMp,
        crit: equipped.critChance - baseline.critChance,
        evasion: (equipped.evasion || 0) - (baseline.evasion || 0),
    };
};

const cli = (...args) => spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    cwd: process.cwd(),
});

test('projects the complete canonical catalog through production owners deterministically', () => {
    const report = buildEquipmentCombatPowerReport();
    assert.equal(report.ok, true);
    assert.equal(report.schemaVersion, 2);
    assert.equal(EQUIPMENT_COMBAT_POWER_AUDIT_POLICY_VERSION, 'equipment-combat-power-audit@2');
    assert.deepEqual(report, buildEquipmentCombatPowerReport());
    assert.deepEqual(report.catalog.counts, { total: 229, weapon: 117, armor: 91, shield: 21 });
    assert.deepEqual(report.catalog.tierCounts, {
        weapon: { 1: 20, 2: 22, 3: 22, 4: 22, 5: 22, 6: 9 },
        armor: { 1: 14, 2: 16, 3: 16, 4: 16, 5: 21, 6: 8 },
        shield: { 1: 2, 2: 5, 3: 5, 4: 4, 5: 2, 6: 3 },
    });
    assert.equal(report.rows.length, 229);
    assert.deepEqual(report.rows.map((row) => `${row.type}\0${row.name}`),
        [...report.rows.map((row) => `${row.type}\0${row.name}`)].sort());
    assert.ok(report.rows.every((row) => row.eligibleJobDeltas.length > 0));
    assert.ok(report.rows.every((row) => row.eligibleJobDeltas.every((delta) => row.jobs.includes(delta.job))));

    const sample = report.rows.find((row) => row.type === 'weapon' && row.dimensions.hands === 2);
    assert.ok(sample);
    assert.deepEqual(sample.eligibleJobDeltas, sample.jobs.map((job) => projectionFor(sample.source, job)));
});

test('fails closed for malformed catalog mutations without coercing or omitting rows', () => {
    const mutate = (change) => {
        const rows = cloneRows();
        change(rows);
        return buildEquipmentCombatPowerReport({ rows });
    };
    const cases = [
        ['NaN val', (rows) => { rows[0].val = Number.NaN; }],
        ['Infinity val', (rows) => { rows[0].val = Infinity; }],
        ['invalid tier', (rows) => { rows[0].tier = 0; }],
        ['invalid weapon hands', (rows) => { rows.find((row) => row.type === 'weapon').hands = 3; }],
        ['invalid armor hands', (rows) => { rows.find((row) => row.type === 'armor').hands = 1; }],
        ['invalid jobs shape', (rows) => { rows[0].jobs = '전사'; }],
        ['unknown job', (rows) => { rows[0].jobs = ['없는직업']; }],
        ['invalid hp', (rows) => { rows.find((row) => row.type === 'armor').hp = Infinity; }],
        ['invalid mp', (rows) => { rows.find((row) => row.type === 'shield').mp = Infinity; }],
        ['invalid crit', (rows) => { rows.find((row) => row.type === 'shield').crit = Infinity; }],
        ['invalid evasion', (rows) => { rows.find((row) => row.type === 'armor').evasion = Infinity; }],
        ['unknown element', (rows) => { rows[0].elem = 'unknown-element'; }],
        ['duplicate identity', (rows) => { rows[1].name = rows[0].name; }],
        ['missing identity', (rows) => { rows.pop(); }],
    ];

    for (const [label, change] of cases) {
        const report = mutate(change);
        assert.equal(report.ok, false, label);
        assert.ok(report.errors.length > 0, label);
        assert.equal(report.catalog.suppliedCount, label === 'missing identity' ? 228 : 229, label);
        assert.equal(report.rows.length, 0, label);
    }
});

test('classifies controlled same-cohort mutations without a universal combat score', () => {
    const armor = cloneRows().filter((row) => row.type === 'armor' && row.tier === 1);
    assert.ok(armor.length >= 4);
    const [candidate, dominator, , broadTarget] = armor;

    const combatDefectRows = cloneRows();
    Object.assign(combatDefectRows.find((row) => row.name === candidate.name), {
        val: 1, price: 999, jobs: ['전사'], elem: undefined, hp: undefined, mp: undefined, crit: undefined, evasion: undefined,
    });
    Object.assign(combatDefectRows.find((row) => row.name === dominator.name), {
        val: 999, price: 1, jobs: ['전사', '나이트'], elem: undefined, hp: undefined, mp: undefined, crit: undefined, evasion: undefined,
    });
    const defect = buildEquipmentCombatPowerReport({ rows: combatDefectRows });
    assert.equal(defect.rows.find((row) => row.name === candidate.name).classification, 'combat-power-defect');
    assert.ok(defect.replanCohorts.includes('armor:T1'));
    assert.equal(defect.requiresReplan, true);

    const sidegradeRows = cloneRows();
    Object.assign(sidegradeRows.find((row) => row.name === candidate.name), {
        val: 1, jobs: ['전사'], elem: '화염', hp: undefined, mp: undefined, crit: undefined, evasion: undefined,
    });
    const sidegrade = buildEquipmentCombatPowerReport({ rows: sidegradeRows });
    assert.equal(sidegrade.rows.find((row) => row.name === candidate.name).classification, 'specialized-sidegrade');

    const priceRows = cloneRows();
    const cohort = priceRows.filter((row) => row.type === 'armor' && row.tier === 1).sort((left, right) => left.val - right.val);
    const comparable = cohort[Math.floor(cohort.length / 2)];
    priceRows.find((row) => row.name === comparable.name).price = 1;
    const priceOnly = buildEquipmentCombatPowerReport({ rows: priceRows });
    assert.equal(priceOnly.rows.find((row) => row.name === comparable.name).classification, 'price-only-defect');

    const intentionalRows = cloneRows();
    Object.assign(intentionalRows.find((row) => row.name === broadTarget.name), {
        val: 1, jobs: Object.keys(CLASSES), elem: undefined, hp: undefined, mp: undefined, crit: undefined, evasion: undefined,
    });
    const intentional = buildEquipmentCombatPowerReport({ rows: intentionalRows });
    assert.equal(intentional.rows.find((row) => row.name === broadTarget.name).classification, 'intentional');
});

test('hard dominance compares every candidate job while the ranger sidegrade prevents its former defect', () => {
    const rows = cloneRows();
    delete rows.find((row) => row.name === '레인저 외투').evasion;
    const report = buildEquipmentCombatPowerReport({ rows });
    const candidate = report.rows.find((row) => row.name === '레인저 외투');
    const dominator = report.rows.find((row) => row.name === '강화가죽갑옷');

    assert.ok(candidate);
    assert.ok(dominator);
    assert.ok(dominator.jobs.length > candidate.jobs.length);
    assert.ok(dominator.dimensions.atk.effective.median < candidate.dimensions.atk.effective.median);
    assert.equal(candidate.classification, 'combat-power-defect');
    assert.deepEqual(candidate.strictDominators, [
        { name: '강화가죽갑옷', type: 'armor' },
    ]);

    const liveCandidate = buildEquipmentCombatPowerReport().rows.find((row) => row.name === '레인저 외투');
    assert.equal(liveCandidate.classification, 'specialized-sidegrade');
    assert.deepEqual(liveCandidate.strictDominators, []);
    assert.deepEqual(report.hardDominancePolicy, {
        candidateJobCoverage: 'required',
        candidateProtections: ['job-access', 'lower-hand-occupancy', 'element', 'effective-secondary-benefit', 'declared-signature-tradeoff'],
        dimensions: ['atk', 'def', 'maxHp', 'maxMp', 'crit', 'evasion'],
        excludedInputs: ['raw-val', 'cohort-median'],
        floatingDimensions: ['crit', 'evasion'],
        floatingTolerance: EQUIPMENT_COMBAT_POWER_FLOAT_TOLERANCE,
        integerLikeDimensions: ['atk', 'def', 'maxHp', 'maxMp'],
        priceRule: 'dominator-price-no-higher',
        scope: 'exact-role-and-tier',
        strictImprovement: 'at-least-one-candidate-job-dimension',
    });
});

test('candidate-side categorical and effective-secondary protections block hard dominance', () => {
    const excludesPair = (mutate, candidateName, dominatorName) => {
        const rows = cloneRows();
        mutate(rows);
        const report = buildEquipmentCombatPowerReport({ rows });
        assert.equal(report.ok, true);
        assert.equal(report.dominancePairs.some((pair) => (
            pair.candidate.name === candidateName && pair.dominator.name === dominatorName
        )), false);
    };

    excludesPair(
        (rows) => { rows.find((row) => row.name === '강화가죽갑옷').jobs = ['도적', '어쌔신']; },
        '레인저 외투',
        '강화가죽갑옷',
    );
    excludesPair(
        (rows) => { rows.find((row) => row.name === '폭풍 스태프').hands = 1; },
        '폭풍 스태프',
        '고대 마탑 스태프',
    );
    excludesPair(
        (rows) => { rows.find((row) => row.name === '폭풍 스태프').elem = '어둠'; },
        '폭풍 스태프',
        '고대 마탑 스태프',
    );
    excludesPair(
        (rows) => { rows.find((row) => row.name === '레인저 외투').hpBonus = 1; },
        '레인저 외투',
        '강화가죽갑옷',
    );
    excludesPair(
        (rows) => { rows.find((row) => row.name === '성운 지팡이').mp = 1; },
        '성운 지팡이',
        '신전 도시의 지팡이',
    );
    excludesPair(
        (rows) => { rows.find((row) => row.name === '독아 채찍').crit = 0.081; },
        '독아 채찍',
        '독사의 송곳니',
    );
    excludesPair(
        (rows) => { rows.find((row) => row.name === '레인저 외투').evasion = 0.001; },
        '레인저 외투',
        '강화가죽갑옷',
    );

    const signatureRows = cloneRows();
    Object.assign(signatureRows.find((row) => row.name === '신전 도시의 지팡이'), { val: 1, price: 99999 });
    Object.assign(signatureRows.find((row) => row.name === '성운 지팡이'), { val: 999, price: 1 });
    const signatureReport = buildEquipmentCombatPowerReport({ rows: signatureRows });
    const signatureCandidate = signatureReport.rows.find((row) => row.name === '신전 도시의 지팡이');
    assert.equal(signatureCandidate.dimensions.signature, true);
    assert.deepEqual(signatureCandidate.strictDominators, []);

    const liveReport = buildEquipmentCombatPowerReport();
    assert.equal(liveReport.rows.find((row) => row.name === '신전 도시의 지팡이').dimensions.signature, true);
    assert.deepEqual(liveReport.rows.find((row) => row.name === '성운 지팡이').strictDominators, []);
});

test('crit and evasion use one tolerance while integer-like dimensions remain exact', () => {
    const withCandidateCrit = (crit) => {
        const rows = cloneRows();
        rows.find((row) => row.name === '독아 채찍').crit = crit;
        return buildEquipmentCombatPowerReport({ rows }).dominancePairs.some((pair) => (
            pair.candidate.name === '독아 채찍' && pair.dominator.name === '독사의 송곳니'
        ));
    };
    assert.equal(withCandidateCrit(0.08 + EQUIPMENT_COMBAT_POWER_FLOAT_TOLERANCE / 2), true);
    assert.equal(withCandidateCrit(0.08 + EQUIPMENT_COMBAT_POWER_FLOAT_TOLERANCE * 2), false);

    const rows = cloneRows();
    rows.find((row) => row.name === '레인저 외투').val = 16;
    const report = buildEquipmentCombatPowerReport({ rows });
    assert.equal(report.dominancePairs.some((pair) => (
        pair.candidate.name === '레인저 외투' && pair.dominator.name === '강화가죽갑옷'
    )), false);
});

test('every live outlier has one stable classification and every other row stays in-corridor', () => {
    const report = buildEquipmentCombatPowerReport();
    const classifications = new Set(['intentional', 'specialized-sidegrade', 'price-only-defect', 'combat-power-defect']);
    for (const row of report.rows) {
        if (row.classification === 'in-corridor') {
            assert.equal(row.classificationReasons.length, 0);
        } else {
            assert.ok(classifications.has(row.classification));
            assert.ok(row.classificationReasons.length > 0);
            assert.deepEqual(row.classificationReasons, [...row.classificationReasons].sort());
        }
    }
    assert.deepEqual(report.classificationCounts, {
        'combat-power-defect': 0,
        'in-corridor': 154,
        intentional: 16,
        'price-only-defect': 9,
        'specialized-sidegrade': 50,
    });
    assert.deepEqual(report.dominancePairs.map((pair) => [
        pair.candidate.name,
        pair.dominator.name,
        pair.cohort,
    ]), EXPECTED_DOMINANCE_PAIRS);
    for (const pair of report.dominancePairs) {
        const candidate = report.rows.find((row) => row.name === pair.candidate.name && row.type === pair.candidate.type);
        assert.deepEqual(pair.perJobComparisons.map((comparison) => comparison.job), candidate.jobs);
        assert.ok(pair.perJobComparisons.every((comparison) => (
            Object.values(comparison.dimensions).every((dimension) => dimension.relation !== 'lower')
        )));
        assert.ok(pair.perJobComparisons.some((comparison) => (
            Object.values(comparison.dimensions).some((dimension) => dimension.relation === 'greater')
        )));
    }
    assert.deepEqual(report.combatPowerDefects, []);
    assert.equal(report.requiresReplan, false);
    assert.deepEqual(report.replanCohorts, []);
});

test('writes and strictly verifies tamper-evident exact-byte evidence', async () => {
    for (const args of [
        [], ['--write'], ['--verify'], ['--write', EVIDENCE_PATH, 'extra'],
        ['--write', '../equipment-combat-power.json'], ['--write', `/${EVIDENCE_PATH}`],
        ['--write', 'docs\\evidence\\qa\\release-complete-core\\equipment-combat-power.json'],
        ['--write', 'docs/./evidence/qa/release-complete-core/equipment-combat-power.json'],
        ['--write', EVIDENCE_PATH, '--verify'], ['--other', EVIDENCE_PATH],
    ]) {
        assert.notEqual(cli(...args).status, 0, args.join(' '));
    }

    assert.equal(cli('--write', EVIDENCE_PATH).status, 0);
    const bytes = await readFile(EVIDENCE_PATH, 'utf8');
    assert.equal(cli('--verify', EVIDENCE_PATH).status, 0);
    assert.equal(await readFile(EVIDENCE_PATH, 'utf8'), bytes);

    const envelope = JSON.parse(bytes);
    assert.equal(envelope.schemaVersion, 2);
    assert.equal(envelope.policyVersion, 'equipment-combat-power-audit@2');
    assert.equal(envelope.report.rows.length, 229);
    assert.deepEqual(envelope.classificationCounts, envelope.report.classificationCounts);
    assert.deepEqual(envelope.combatPowerDefects, envelope.report.combatPowerDefects);
    assert.deepEqual(envelope.dominancePairs, envelope.report.dominancePairs);
    assert.deepEqual(envelope.strictDominators, envelope.report.rows.map((row) => ({
        name: row.name,
        strictDominators: row.strictDominators,
        type: row.type,
    })));
    assert.equal(envelope.requiresReplan, envelope.report.requiresReplan);
    assert.match(envelope.authority.signatureRegistryHash, /^[a-f0-9]{64}$/);
    assert.match(envelope.authority.signatureSetHash, /^[a-f0-9]{64}$/);
    assert.match(envelope.authority.strictDominatorsHash, /^[a-f0-9]{64}$/);
    assert.match(envelope.authority.dominancePairsHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(envelope.authority.productionOwners).sort(), [
        'buildClassVitals', 'calculateFullStats', 'enemyEvasion', 'equipmentProfile', 'signatureSetBonus',
    ]);

    const tamper = [
        (value) => { value.authority.catalogHash = '0'.repeat(64); },
        (value) => { value.authority.signatureRegistryHash = '1'.repeat(64); },
        (value) => { value.authority.signatureSetHash = '2'.repeat(64); },
        (value) => { value.report.rows[0].dimensions.price += 1; },
        (value) => { value.report.rows[0].eligibleJobDeltas[0].atk += 1; },
        (value) => { value.report.rows[0].classification = 'intentional'; },
        (value) => { value.strictDominators[0].strictDominators.push({ name: 'tamper', type: 'armor' }); },
        (value) => { value.dominancePairs.push({ candidate: { name: 'tamper' } }); },
        (value) => { value.report.dominancePairs.push({ dominator: { name: 'tamper' } }); },
        (value) => { value.classificationCounts['in-corridor'] += 1; },
        (value) => { value.reportHash = 'f'.repeat(64); },
        (value) => { value.authority.productionOwners.calculateFullStats = 'e'.repeat(64); },
    ];
    for (const mutate of tamper) {
        const value = JSON.parse(bytes);
        mutate(value);
        const tamperedBytes = `${JSON.stringify(value)}\n`;
        await writeFile(EVIDENCE_PATH, tamperedBytes);
        assert.notEqual(cli('--verify', EVIDENCE_PATH).status, 0);
        assert.equal(await readFile(EVIDENCE_PATH, 'utf8'), tamperedBytes);
    }
    await writeFile(EVIDENCE_PATH, `${bytes}\n`);
    assert.notEqual(cli('--verify', EVIDENCE_PATH).status, 0);
    assert.equal(await readFile(EVIDENCE_PATH, 'utf8'), `${bytes}\n`);
    assert.equal(cli('--write', EVIDENCE_PATH).status, 0);
    assert.equal(await readFile(EVIDENCE_PATH, 'utf8'), bytes);

    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'aetheria-equipment-evidence-'));
    const symlinkTarget = path.join(temporaryDirectory, 'target.json');
    await writeFile(symlinkTarget, bytes);
    await unlink(EVIDENCE_PATH);
    try {
        await symlink(symlinkTarget, EVIDENCE_PATH);
        assert.notEqual(cli('--verify', EVIDENCE_PATH).status, 0);
        assert.equal(await readFile(symlinkTarget, 'utf8'), bytes);
    } finally {
        await unlink(EVIDENCE_PATH).catch(() => {});
        await writeFile(EVIDENCE_PATH, bytes);
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
});
