import assert from 'node:assert/strict';
import test from 'node:test';

import { DB } from '../src/data/db.ts';
import { BOSS_MONSTERS } from '../src/data/monsters.ts';
import {
    PROGRESSION_CHECKPOINT_LEVELS,
    buildProgressionDiagnostic,
} from '../src/systems/progressionSimulator.ts';
import { getBossSignatureDrops } from '../src/utils/bossSignatureHint.ts';

const codePointOrder = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const EXPECTED_JOBS = Object.keys(DB.CLASSES).sort(codePointOrder);
const EXPECTED_SIGNATURE_BOSSES = BOSS_MONSTERS
    .filter((boss) => getBossSignatureDrops(boss).length > 0)
    .sort(codePointOrder);

const options = {
    focusedSeeds: [20_260_824, 20_260_825],
    comparisonSeeds: [20_260_824, 20_260_825, 20_260_826],
    maxCombatTurns: 200,
};

test('schema v2 keeps diagnostic claims honest and covers every production cohort', () => {
    const report = buildProgressionDiagnostic(options);

    assert.equal(report.schemaVersion, 2);
    assert.equal(report.classification, 'diagnostic-production-path');
    assert.equal(report.actualPlayClaim, false);
    assert.equal(report.activationReady, false);
    assert.deepEqual(report.seeds, {
        focused: options.focusedSeeds,
        comparison: options.comparisonSeeds,
    });
    assert.deepEqual(
        report.rewardProgression.checkpoints.map(({ targetLevel }) => targetLevel),
        PROGRESSION_CHECKPOINT_LEVELS,
    );
    assert.deepEqual(report.combat.jobs.map(({ job }) => job), EXPECTED_JOBS);
    assert.deepEqual(report.loot.jobs.map(({ job }) => job), EXPECTED_JOBS);
    assert.equal(report.combat.jobs.length, 18);
    assert.equal(report.combat.jobs.every(({ cohorts }) => cohorts.length === 4), true);
    assert.equal(report.combat.jobs.every(({ cohorts }) => (
        cohorts.slice(1).every(({ encounterKeys }) => (
            JSON.stringify(encounterKeys) === JSON.stringify(cohorts[0].encounterKeys)
        ))
    )), true);
    assert.equal(
        report.combat.jobs.reduce(
            (total, { cohorts }) => total + cohorts.reduce((sum, cohort) => sum + cohort.encounters, 0),
            0,
        ),
        18 * 2 * 2 * options.focusedSeeds.length,
    );
    assert.deepEqual(report.unavailableMetrics, [
        'actual_expedition_count',
        'actual_play_time',
        'mandatory_story_frequency',
        'production_ai_event_frequency',
        'retention',
    ]);
    assert.deepEqual(report.hardErrors, []);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(Object.isFrozen(report.combat.jobs), true);
    assert.equal(Object.isFrozen(report.rewardProgression.checkpoints), true);
});

test('diagnostic output is deterministic and canonicalizes seed order without mutating inputs', () => {
    const reversed = {
        ...options,
        focusedSeeds: [...options.focusedSeeds].reverse(),
        comparisonSeeds: [...options.comparisonSeeds].reverse(),
    };
    const before = structuredClone(reversed);
    const first = buildProgressionDiagnostic(reversed);
    const second = buildProgressionDiagnostic(options);

    assert.deepEqual(first, second);
    assert.deepEqual(reversed, before);
});

test('loot and pity cohorts use structured victory receipts across production fixtures', () => {
    const report = buildProgressionDiagnostic(options);

    assert.equal(report.loot.authority, 'combatReceipt.lootSettlement');
    assert.equal(report.loot.jobs.every((row) => row.classification === 'production-victory-receipt'), true);
    assert.equal(report.loot.jobs.every((row) => row.kills === options.focusedSeeds.length * 32), true);
    assert.equal(report.loot.jobs.every((row) => (
        row.rolledItems === row.admittedItems + row.blockedItems
        && row.admittedItemIdsMatchedInventory === row.admittedItems
        && row.firstItemAttempt.observedSeeds + row.firstItemAttempt.unobservedSeeds === options.focusedSeeds.length
        && row.firstEquipmentAttempt.observedSeeds + row.firstEquipmentAttempt.unobservedSeeds === options.focusedSeeds.length
        && row.noItemStreak.p90 <= 32
        && row.noEquipmentStreak.p90 <= 32
    )), true);
    assert.deepEqual(
        report.loot.signatureBosses.map(({ boss }) => boss),
        EXPECTED_SIGNATURE_BOSSES,
    );
    assert.equal(report.loot.signatureBosses.every((row) => (
        row.attempts === options.focusedSeeds.length * 32
        && row.pityAfterMax >= row.pityBeforeMax
        && row.blockedSignatures === 0
        && row.firstSignatureAttempt.observedSeeds
            + row.firstSignatureAttempt.unobservedSeeds === options.focusedSeeds.length
        && row.noSignatureStreak.p90 <= 32
    )), true);
    assert.equal(report.loot.capacityPressure.oneSlot.samples, (
        EXPECTED_JOBS.length + EXPECTED_SIGNATURE_BOSSES.length
    ) * options.focusedSeeds.length);
    assert.equal(report.loot.capacityPressure.full.samples, (
        EXPECTED_JOBS.length + EXPECTED_SIGNATURE_BOSSES.length
    ) * options.focusedSeeds.length);
    assert.ok(report.loot.capacityPressure.full.capacityBlockedDrops > 0);
    assert.ok(report.loot.capacityPressure.full.blockedBossSignatures > 0);
    assert.ok(report.loot.capacityPressure.oneSlot.admittedBossSignatures > 0);
    assert.ok(report.loot.capacityPressure.oneSlot.pityResets > 0);
    assert.ok(report.loot.capacityPressure.full.pityIncrements > 0);
});

test('exploration cohort reuses the production outcome step and reports optional-decision pressure', () => {
    const report = buildProgressionDiagnostic(options);
    const exploration = report.exploration;
    const opportunities = options.comparisonSeeds.length * 4_096;

    assert.equal(exploration.classification, 'production-outcome-step-proxy');
    assert.equal(exploration.authority, 'resolveExplorationRhythmOutcomeStep');
    assert.equal(exploration.opportunities, opportunities);
    assert.equal(Object.values(exploration.outcomes).reduce((sum, count) => sum + count, 0), opportunities);
    assert.equal(
        exploration.optionalDecisions.count,
        exploration.outcomes.campfire
            + exploration.outcomes.scout
            + exploration.outcomes.generalNarrative,
    );
    assert.equal(
        exploration.optionalDecisions.density,
        exploration.optionalDecisions.count / opportunities,
    );
    assert.ok(exploration.optionalDecisions.gap.p10 <= exploration.optionalDecisions.gap.p50);
    assert.ok(exploration.optionalDecisions.gap.p50 <= exploration.optionalDecisions.gap.p90);
    assert.ok(exploration.optionalDecisions.longestStreak >= 0);
    for (const rhythm of Object.values(exploration.outcomeRhythm)) {
        assert.ok(rhythm.gap.p10 <= rhythm.gap.p50);
        assert.ok(rhythm.gap.p50 <= rhythm.gap.p90);
        assert.ok(rhythm.longestStreak.p10 <= rhythm.longestStreak.p50);
        assert.ok(rhythm.longestStreak.p50 <= rhythm.longestStreak.p90);
    }
    assert.ok(exploration.pity.maxSinceNarrative >= 0);
    assert.ok(exploration.pity.maxSinceRelic >= 0);
    assert.ok(exploration.pity.narrativeActivations > 0);
    assert.ok(exploration.pity.discoveryActivations > 0);
    assert.ok(exploration.pity.relicActivations > 0);
});

test('invalid seeds and combat limits fail closed', () => {
    for (const focusedSeeds of [[], [1, 1], [-1], [2 ** 32], [Number.NaN]]) {
        assert.throws(
            () => buildProgressionDiagnostic({ ...options, focusedSeeds }),
            /focusedSeeds must contain unique uint32 integers/,
        );
    }
    assert.throws(
        () => buildProgressionDiagnostic({ ...options, comparisonSeeds: [1] }),
        /comparisonSeeds must contain 2 to 1000 unique uint32 integers/,
    );
    for (const maxCombatTurns of [0, 1.5, 201, Number.NaN]) {
        assert.throws(
            () => buildProgressionDiagnostic({ ...options, maxCombatTurns }),
            /maxCombatTurns must be a safe integer between 1 and 200/,
        );
    }
});
