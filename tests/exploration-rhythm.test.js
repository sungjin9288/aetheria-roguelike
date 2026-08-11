import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    BASELINE_EXPLORATION_RHYTHM,
    CANDIDATE_EXPLORATION_RHYTHM,
    compareExplorationRhythm,
} from '../src/systems/explorationRhythmSimulator.ts';
import { canOfferOptionalExploreDecision } from '../src/utils/explorationPacing.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('approved exploration rhythm policies keep EXP and loot unchanged', () => {
    assert.deepEqual(BASELINE_EXPLORATION_RHYTHM, {
        id: 'baseline',
        version: 1,
        campfireChance: 0.08,
        scoutChance: 0.25,
        eventMultiplier: 1,
        minimumOrdinaryGap: 0,
    });
    assert.deepEqual(CANDIDATE_EXPLORATION_RHYTHM, {
        id: 'exploration-rhythm',
        version: 2,
        campfireChance: 0.08,
        scoutChance: 0.15,
        eventMultiplier: 0.8,
        minimumOrdinaryGap: 1,
    });
});

test('optional decision predicate requires one ordinary explore outcome', () => {
    assert.equal(canOfferOptionalExploreDecision({ exploreState: { sinceNarrativeEvent: 0 } }), false);
    assert.equal(canOfferOptionalExploreDecision({ exploreState: { sinceNarrativeEvent: 1 } }), true);
    assert.equal(canOfferOptionalExploreDecision({}), false);

    const expedition = { explores: 20 };
    assert.equal(canOfferOptionalExploreDecision({
        explores: 20,
        exploreState: { sinceNarrativeEvent: 8 },
    }, expedition), false);
    assert.equal(canOfferOptionalExploreDecision({
        explores: 21,
        exploreState: { sinceNarrativeEvent: 1 },
    }, expedition), true);
});

test('fixed seed comparison proves optional spacing and target direction', () => {
    const report = compareExplorationRhythm([11, 23, 37, 53]);
    assert.equal(report.gates.noOptionalBackToBack, true);
    assert.equal(report.gates.candidateMedianGapInRange, true);
    assert.ok(report.candidate.optionalGap.p50 >= 4);
    assert.ok(report.candidate.optionalGap.p50 <= 5);
    assert.equal(report.candidate.optionalBackToBackCount, 0);
    assert.ok(report.candidate.optionalGap.p10 < report.candidate.optionalGap.p90);
    assert.ok(report.candidate.generalNarrative < report.predecessor.generalNarrative);
    assert.ok(report.candidate.scout < report.predecessor.scout);
    assert.equal(report.gates.expLootInvariant, true);
    assert.equal(report.candidate.discoveryBreakdown.relic, 20);
    assert.equal(report.candidate.discovery, report.candidate.discoveryBreakdown.anomaly + 20);
});

test('invalid seeds and duplicate seeds fail closed', () => {
    assert.throws(() => compareExplorationRhythm([1]), /at least|seeds/i);
    assert.throws(() => compareExplorationRhythm([1, 1]), /unique|seeds/i);
    assert.throws(() => compareExplorationRhythm([-1, 2]), /uint32|seeds/i);
    assert.throws(() => compareExplorationRhythm([1, 0x1_0000_0000]), /uint32|seeds/i);
});

test('rhythm evidence CLI rejects ambiguous write mode without touching tracked evidence', () => {
    const evidence = 'docs/evidence/qa/release-complete-core/exploration-rhythm.json';
    const before = readFileSync(path.join(ROOT, evidence), 'utf8');
    const result = spawnSync(process.execPath, [
        '--import', 'tsx',
        'scripts/compare-exploration-rhythm.mjs',
        '--seed-start', '11',
        '--seed-count', '2',
        '--write', evidence,
        '--verify', evidence,
    ], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(readFileSync(path.join(ROOT, evidence), 'utf8'), before);
});

test('rhythm evidence CLI rejects unknown and duplicate flags', () => {
    const evidence = 'docs/evidence/qa/release-complete-core/exploration-rhythm.json';
    for (const extra of [
        ['--bogus', 'ignored'],
        ['--seed-start', '7'],
    ]) {
        const result = spawnSync(process.execPath, [
            '--import', 'tsx',
            'scripts/compare-exploration-rhythm.mjs',
            '--seed-start', '20260810',
            '--seed-count', '64',
            '--verify', evidence,
            ...extra,
        ], { cwd: ROOT, encoding: 'utf8' });
        assert.equal(result.status, 1);
    }
});

test('tracked rhythm evidence binds the candidate to 64 and 1000 seed progression reports', () => {
    const evidence = JSON.parse(readFileSync(path.join(
        ROOT,
        'docs/evidence/qa/release-complete-core/exploration-rhythm.json',
    ), 'utf8'));
    assert.deepEqual(evidence.progressionEvidence.candidateProfile, {
        id: 'exploration-rhythm',
        version: 2,
        expMultiplier: 1,
        lootMultiplier: 1,
        eventMultiplier: 0.8,
    });
    assert.equal(evidence.progressionEvidence.focused.seedCount, 64);
    assert.equal(evidence.progressionEvidence.full.seedCount, 1000);
    assert.match(evidence.progressionEvidence.focused.reportHash, /^[a-f0-9]{64}$/);
    assert.match(evidence.progressionEvidence.full.reportHash, /^[a-f0-9]{64}$/);
});
