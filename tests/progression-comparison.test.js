import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { BASELINE_PROGRESSION_PROFILE } from '../src/data/progressionProfiles.ts';
import { DB } from '../src/data/db.ts';
import {
    ProgressionSimulationError,
    simulateProgressionComparison,
} from '../src/systems/progressionSimulator.ts';

const candidateProfile = (axis, multiplier) => ({
    ...BASELINE_PROGRESSION_PROFILE,
    version: 2,
    [`${axis}Multiplier`]: multiplier,
});

const runComparison = (axis, multiplier, seeds = [11, 23]) => simulateProgressionComparison({
    seeds,
    predecessorProfile: BASELINE_PROGRESSION_PROFILE,
    candidateProfile: candidateProfile(axis, multiplier),
    declaredAxis: axis,
});

test('multi-seed comparison is deterministic, canonical, and remains report-only', () => {
    const first = runComparison('exp', 1.2, [23, 11]);
    const second = runComparison('exp', 1.2, [11, 23]);

    assert.deepEqual(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.deepEqual(first.seeds, [11, 23]);
    assert.equal(first.classification, 'report-only');
    assert.equal(first.activationReady, false);
    assert.equal(first.gates.profileTransition, true);
    assert.equal(first.gates.hardCorrectness, true);
    assert.equal(first.gates.targetMetricDirection.matched, true);
    assert.equal(first.gates.productFunnelEvidence, false);
    assert.equal(first.gates.fullCombatModel, false);
    assert.deepEqual(first.blockers, [
        'production_funnel_evidence_missing',
        'full_combat_model_unavailable',
    ]);
    assert.deepEqual(first.unavailableMetrics, [
        'actual_play_time',
        'combat_player_action_turns',
        'death_rate',
        'expedition_count',
        'retention',
    ]);

    assert.deepEqual(first.aggregates.checkpoints.map((entry) => entry.targetLevel), [2, 5, 10, 20, 45, 60, 75]);
    for (const entry of first.aggregates.checkpoints) {
        assert.equal(entry.predecessor.p10 <= entry.predecessor.p50, true);
        assert.equal(entry.predecessor.p50 <= entry.predecessor.p90, true);
        assert.equal(entry.candidate.p10 <= entry.candidate.p50, true);
        assert.equal(entry.candidate.p50 <= entry.candidate.p90, true);
    }
    assert.equal(first.aggregates.checkpoints.at(-1).candidate.p50 < first.aggregates.checkpoints.at(-1).predecessor.p50, true);
    assert.equal(first.correctness.predecessorPrematureEquipCount, 0);
    assert.equal(first.correctness.candidatePrematureEquipCount, 0);
    assert.equal(first.correctness.predecessorJobSnapshotCount, 18 * first.seeds.length);
    assert.equal(first.correctness.candidateJobSnapshotCount, 18 * first.seeds.length);
    assert.equal(first.aggregates.combatMatrix.classification, 'un-geared-auto-attack-proxy');
    assert.equal(first.aggregates.combatMatrix.authority, 'makeCombatActionMap.RESOLVE_COMBAT_ACTION');
    assert.equal(first.aggregates.combatMatrix.jobs.length, 18);
    for (const job of first.aggregates.combatMatrix.jobs) {
        assert.equal(job.encounters, first.seeds.length);
        assert.equal(job.wins + job.deaths + job.escapes, job.encounters);
        assert.equal(job.truncated, 0);
        assert.equal(job.turns.p10 <= job.turns.p50, true);
        assert.equal(job.turns.p50 <= job.turns.p90, true);
    }

    assert.equal(
        createHash('sha256').update(JSON.stringify(first)).digest('hex'),
        createHash('sha256').update(JSON.stringify(second)).digest('hex'),
    );
});

test('event and loot axes move their bounded proxy in the declared direction', () => {
    const event = runComparison('event', 1.2);
    assert.equal(event.gates.targetMetricDirection.metric, 'narrative_event_occurrences');
    assert.equal(event.gates.targetMetricDirection.matched, true);
    assert.equal(
        event.aggregates.narrativeEvents.candidate.total
            > event.aggregates.narrativeEvents.predecessor.total,
        true,
    );
    assert.equal(event.aggregates.rewardActions.candidate.total, event.aggregates.rewardActions.predecessor.total);

    const loot = runComparison('loot', 1.2);
    assert.equal(loot.gates.targetMetricDirection.metric, 'equipment_drop_attempts');
    assert.equal(loot.gates.targetMetricDirection.matched, true);
    assert.equal(
        loot.aggregates.equipmentDropAttempts.candidate.total
            > loot.aggregates.equipmentDropAttempts.predecessor.total,
        true,
    );
});

test('comparison seed and predecessor authority fail closed', () => {
    for (const seeds of [
        [],
        [1],
        [1, 1],
        [1, Number.NaN],
        [-1, 1],
        [0, 2 ** 32],
    ]) {
        assert.throws(
            () => runComparison('exp', 1.2, seeds),
            (error) => error instanceof ProgressionSimulationError
                && error.code === 'INVALID_COMPARISON_SEEDS',
        );
    }

    assert.throws(
        () => simulateProgressionComparison({
            seeds: [1, 2],
            predecessorProfile: { ...BASELINE_PROGRESSION_PROFILE, version: 2 },
            candidateProfile: { ...BASELINE_PROGRESSION_PROFILE, version: 3, expMultiplier: 1.1 },
            declaredAxis: 'exp',
        }),
        (error) => error instanceof ProgressionSimulationError
            && error.code === 'UNSUPPORTED_PREDECESSOR_PROFILE',
    );

    assert.throws(
        () => simulateProgressionComparison({
            seeds: [1, 2],
            predecessorProfile: BASELINE_PROGRESSION_PROFILE,
            candidateProfile: { ...BASELINE_PROGRESSION_PROFILE, version: 2, expMultiplier: 1.2, lootMultiplier: 1.2 },
            declaredAxis: 'exp',
        }),
        (error) => error instanceof ProgressionSimulationError
            && error.code === 'INVALID_PROFILE_TRANSITION',
    );

    assert.throws(
        () => simulateProgressionComparison({
            seeds: [1, 2],
            predecessorProfile: BASELINE_PROGRESSION_PROFILE,
            candidateProfile: BASELINE_PROGRESSION_PROFILE,
            declaredAxis: 'exp',
        }),
        (error) => error instanceof ProgressionSimulationError
            && error.code === 'INVALID_PROFILE_TRANSITION',
    );
});

test('comparison exposes failed hard correctness as an explicit blocker', () => {
    const originalMultipliers = Object.values(DB.MONSTERS).map((monster) => ({
        monster,
        hpMult: monster.hpMult,
        atkMult: monster.atkMult,
    }));

    try {
        for (const { monster } of originalMultipliers) {
            monster.hpMult = 1_000_000_000;
            monster.atkMult = 0.000000001;
        }

        const report = runComparison('exp', 1.2);
        assert.equal(report.gates.hardCorrectness, false);
        assert.equal(report.correctness.combatMatrixTruncatedCount > 0, true);
        assert.equal(report.blockers.includes('hard_correctness_failed'), true);
    } finally {
        for (const { monster, hpMult, atkMult } of originalMultipliers) {
            monster.hpMult = hpMult;
            monster.atkMult = atkMult;
        }
    }
});

test('event comparison defers small valid deltas to the aggregate direction blocker', () => {
    const report = simulateProgressionComparison({
        seeds: [11, 23],
        predecessorProfile: BASELINE_PROGRESSION_PROFILE,
        candidateProfile: candidateProfile('event', 1 + Number.EPSILON),
        declaredAxis: 'event',
    });

    assert.equal(report.gates.targetMetricDirection.matched, false);
    assert.equal(report.blockers.includes('target_metric_direction_mismatch'), true);
});

test('comparison validates a malformed candidate before running predecessor seeds', () => {
    const warrior = DB.CLASSES['전사'];
    const originalReqLv = warrior.reqLv;
    try {
        warrior.reqLv = Number.NaN;
        assert.throws(
            () => simulateProgressionComparison({
                seeds: [11, 23],
                predecessorProfile: BASELINE_PROGRESSION_PROFILE,
                candidateProfile: { ...BASELINE_PROGRESSION_PROFILE, version: 2, expMultiplier: Number.NaN },
                declaredAxis: 'exp',
            }),
            (error) => error instanceof ProgressionSimulationError
                && error.code === 'INVALID_PROFILE',
        );
    } finally {
        warrior.reqLv = originalReqLv;
    }
});

test('comparison CLI emits a deterministic SHA-256 envelope and rejects unsafe flags', () => {
    const repoRoot = fileURLToPath(new URL('..', import.meta.url));
    const scriptPath = fileURLToPath(new URL('../scripts/compare-progression.mjs', import.meta.url));
    const args = [
        '--import', 'tsx', scriptPath,
        '--axis', 'exp',
        '--multiplier', '1.2',
        '--seed-start', '20260810',
        '--seed-count', '2',
    ];
    const first = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8' });

    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stderr, '');
    const envelope = JSON.parse(first.stdout);
    assert.equal(envelope.hashAlgorithm, 'sha256');
    assert.equal(envelope.report.classification, 'report-only');
    assert.equal(envelope.report.activationReady, false);
    assert.deepEqual(envelope.report.seeds, [20260810, 20260811]);
    assert.equal(
        envelope.reportHash,
        createHash('sha256').update(JSON.stringify(envelope.report)).digest('hex'),
    );

    const unsafe = spawnSync(process.execPath, [
        '--import', 'tsx', scriptPath,
        '--axis', 'exp',
        '--multiplier', '2',
        '--seed-count', '2',
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(unsafe.status, 1);
    assert.match(unsafe.stderr, /INVALID_PROFILE_TRANSITION/);
    assert.equal(unsafe.stdout, '');

    const overflowingSeedRange = spawnSync(process.execPath, [
        '--import', 'tsx', scriptPath,
        '--axis', 'exp',
        '--multiplier', '1.2',
        '--seed-start', String(0xffffffff),
        '--seed-count', '2',
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(overflowingSeedRange.status, 1);
    assert.match(overflowingSeedRange.stderr, /INVALID_COMPARISON_SEEDS/);
    assert.equal(overflowingSeedRange.stdout, '');
});
