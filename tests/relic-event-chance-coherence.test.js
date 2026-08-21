import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAdditiveNumericRelicValue } from '../src/utils/relicEffectValues.ts';
import { compareEventChanceBonusRhythm } from '../src/systems/explorationRhythmSimulator.ts';
import { RELICS } from '../src/data/relics.ts';
import { migrateData } from '../src/utils/gameUtils.ts';
import {
    buildRelicEventChanceReport,
    canonicalizeRelicEventChanceReport,
} from '../src/systems/relicEventChanceAudit.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ancientMapCandidate = Object.freeze({
    id: 'ancient_map',
    effect: 'event_chance',
    val: 0.15,
});
const ancientMapLegacy = Object.freeze({
    id: 'ancient_map',
    effect: 'event_chance',
    val: 0.6,
});
const wandererCharm = Object.freeze({
    id: 'wanderer_charm',
    effect: 'event_chance',
    val: 0.3,
});

test('catalog presents a deliberate common-to-uncommon event chance curve', () => {
    const ancientMap = RELICS.find((relic) => relic.id === 'ancient_map');
    const charm = RELICS.find((relic) => relic.id === 'wanderer_charm');

    assert.deepEqual(ancientMap && {
        rarity: ancientMap.rarity,
        desc: ancientMap.desc,
        effect: ancientMap.effect,
        val: ancientMap.val,
    }, {
        rarity: 'common',
        desc: '이벤트 발생률 15% 증가',
        effect: 'event_chance',
        val: 0.15,
    });
    assert.deepEqual(charm && {
        rarity: charm.rarity,
        desc: charm.desc,
        effect: charm.effect,
        val: charm.val,
    }, {
        rarity: 'uncommon',
        desc: '이벤트 발생률 30% 증가',
        effect: 'event_chance',
        val: 0.3,
    });
});

test('migration preserves the active-run relic snapshot instead of rewriting it', () => {
    const migrated = migrateData({
        version: 5,
        player: {
            name: '기록된 탐험가',
            job: '모험가',
            stats: {},
            equip: {},
            relics: [ancientMapLegacy, wandererCharm],
        },
    });

    assert.deepEqual(migrated.player.relics, [ancientMapLegacy, wandererCharm]);
    assert.equal(getAdditiveNumericRelicValue(migrated.player.relics, 'event_chance'), 0.9);
});

test('event chance relic values add independently of inventory order', () => {
    assert.equal(getAdditiveNumericRelicValue([], 'event_chance'), 0);
    assert.equal(getAdditiveNumericRelicValue([ancientMapCandidate], 'event_chance'), 0.15);
    assert.equal(getAdditiveNumericRelicValue([wandererCharm], 'event_chance'), 0.3);
    assert.equal(getAdditiveNumericRelicValue(
        [ancientMapCandidate, wandererCharm],
        'event_chance',
    ), 0.45);
    assert.equal(getAdditiveNumericRelicValue(
        [wandererCharm, ancientMapCandidate],
        'event_chance',
    ), 0.45);
    assert.equal(getAdditiveNumericRelicValue(
        [ancientMapLegacy, wandererCharm],
        'event_chance',
    ), 0.9);
    assert.equal(getAdditiveNumericRelicValue(
        [wandererCharm, ancientMapLegacy],
        'event_chance',
    ), 0.9);
});

test('matching malformed values fail closed while unrelated effects are ignored', () => {
    for (const val of [undefined, '0.15', Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
        assert.throws(
            () => getAdditiveNumericRelicValue([
                { id: 'broken', effect: 'event_chance', val },
            ], 'event_chance'),
            { message: 'INVALID_RELIC_EFFECT_VALUE' },
        );
    }

    assert.equal(getAdditiveNumericRelicValue([
        { id: 'other', effect: 'glass_cannon', val: { atk: 0.2 } },
        ancientMapCandidate,
    ], 'event_chance'), 0.15);
    assert.throws(
        () => getAdditiveNumericRelicValue([
            { id: 'huge-a', effect: 'event_chance', val: Number.MAX_VALUE },
            { id: 'huge-b', effect: 'event_chance', val: Number.MAX_VALUE },
        ], 'event_chance'),
        { message: 'INVALID_RELIC_EFFECT_VALUE' },
    );
});

test('controlled rhythm comparison isolates the event chance bonus', () => {
    const seeds = [11, 23, 37, 53];
    const equal = compareEventChanceBonusRhythm(seeds, 0.3, 0.3);
    assert.deepEqual(equal.predecessor, equal.candidate);
    assert.equal(equal.gates.generalNarrativeReduced, false);
    assert.equal(equal.gates.expLootInvariant, true);
    assert.equal('expLootRewardInvariant' in equal.gates, false);
    assert.equal(equal.gates.globalProgressionProfileInvariant, true);
    assert.equal(equal.gates.mandatoryStoryInvariant, true);
    assert.equal(equal.gates.bossChallengeInvariant, true);

    const mapOnly = compareEventChanceBonusRhythm(seeds, 0.6, 0.15);
    assert.equal(mapOnly.eventChanceBonus.predecessor, 0.6);
    assert.equal(mapOnly.eventChanceBonus.candidate, 0.15);
    assert.ok(mapOnly.candidate.generalNarrative < mapOnly.predecessor.generalNarrative);
    assert.equal(mapOnly.gates.generalNarrativeReduced, true);

    const stacked = compareEventChanceBonusRhythm(seeds, 0.9, 0.45);
    assert.equal(stacked.eventChanceBonus.predecessor, 0.9);
    assert.equal(stacked.eventChanceBonus.candidate, 0.45);
    assert.ok(stacked.candidate.generalNarrative < stacked.predecessor.generalNarrative);
    assert.equal(stacked.gates.generalNarrativeReduced, true);
});

test('controlled rhythm comparison rejects ambiguous bonuses', () => {
    for (const bonus of [Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
        assert.throws(
            () => compareEventChanceBonusRhythm([11, 23], bonus, 0.15),
            /INVALID_EVENT_CHANCE_BONUS/,
        );
    }
});

test('event chance audit binds catalog, stacking, rhythm direction, and runtime priority', () => {
    const source = readFileSync(path.join(ROOT, 'src/hooks/gameActions/exploreActions.ts'), 'utf8');
    const report = buildRelicEventChanceReport({
        relics: RELICS,
        seeds: [11, 23, 37, 53],
        exploreActionsSource: source,
    });

    assert.deepEqual(report.policy, {
        stacking: 'additive',
        ancientMapCandidate: 0.15,
        wandererCharm: 0.3,
        candidateBothOrders: [0.45, 0.45],
        legacyAncientMap: 0.6,
        legacyBothOrders: [0.9, 0.9],
        activeRunSnapshot: 'preserved',
    });
    assert.equal(report.rhythm.mapOnly.gates.generalNarrativeReduced, true);
    assert.equal(report.rhythm.stacked.gates.generalNarrativeReduced, true);
    assert.ok(report.rhythm.mapOnly.candidate.generalNarrative
        < report.rhythm.charm.candidate.generalNarrative);
    assert.ok(report.rhythm.charm.candidate.generalNarrative
        < report.rhythm.stacked.candidate.generalNarrative);
    assert.deepEqual(report.rhythm.none.predecessor, report.rhythm.none.candidate);
    assert.deepEqual(report.rhythm.charm.predecessor, report.rhythm.charm.candidate);
    assert.deepEqual(report.runtimePriority, {
        mandatoryStoryBeforeOptionalRoll: true,
        bossChallengeBeforeOptionalRoll: true,
    });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report, canonicalizeRelicEventChanceReport(report));
});

test('event chance audit fails closed on catalog and runtime priority drift', () => {
    const relics = RELICS.map((relic) => ({ ...relic }));
    relics.find((relic) => relic.id === 'ancient_map').val = 0.6;
    relics.find((relic) => relic.id === 'wanderer_charm').desc = '낡은 설명';
    const report = buildRelicEventChanceReport({
        relics,
        seeds: [11, 23],
        exploreActionsSource: 'runExplorePostDecisionRoll(); getChainEventForLoc(); buildBossChallengeEvent();',
    });

    assert.ok(report.errors.includes('ANCIENT_MAP_POLICY_MISMATCH'));
    assert.ok(report.errors.includes('WANDERER_CHARM_POLICY_MISMATCH'));
    assert.ok(report.errors.includes('MANDATORY_STORY_PRIORITY_MISMATCH'));
    assert.ok(report.errors.includes('BOSS_CHALLENGE_PRIORITY_MISMATCH'));
    assert.deepEqual(report.errors, [...report.errors].sort());
});

test('strict event chance evidence CLI rejects unsafe arguments and stale bytes', () => {
    const script = path.join(ROOT, 'scripts/verify-relic-event-chance.mjs');
    const outputRelative = 'docs/evidence/qa/release-complete-core/relic-event-chance.json';
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
        ['--verify', '../relic-event-chance.json'],
        ['--verify', '/tmp/relic-event-chance.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\relic-event-chance.json'],
        ['--verify', 'docs/evidence/qa/./release-complete-core/relic-event-chance.json'],
    ]) {
        assert.notEqual(run(...args).status, 0, args.join(' '));
    }

    const suffix = randomUUID();
    const evidenceDir = path.join(ROOT, 'docs/evidence/qa/release-complete-core');
    const mismatchName = `relic-event-chance-mismatch-${suffix}.json`;
    const mismatchPath = path.join(evidenceDir, mismatchName);
    const symlinkName = `relic-event-chance-symlink-${suffix}.json`;
    const symlinkPath = path.join(evidenceDir, symlinkName);
    try {
        writeFileSync(mismatchPath, `${readFileSync(path.join(ROOT, outputRelative), 'utf8')} `);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${mismatchName}`).stderr,
            /EVIDENCE_BYTE_MISMATCH/,
        );
        symlinkSync('relic-event-chance.json', symlinkPath);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${symlinkName}`).stderr,
            /SYMLINK_OUTPUT_PATH/,
        );
    } finally {
        if (existsSync(mismatchPath)) unlinkSync(mismatchPath);
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
    }
});

test('canonical event chance evidence binds report and authority bytes to SHA-256', () => {
    const evidence = JSON.parse(readFileSync(
        path.join(ROOT, 'docs/evidence/qa/release-complete-core/relic-event-chance.json'),
        'utf8',
    ));
    assert.deepEqual(Object.keys(evidence).sort(), [
        'authorityHashes',
        'hashAlgorithm',
        'report',
        'reportHash',
    ]);
    assert.equal(evidence.hashAlgorithm, 'sha256');
    assert.deepEqual(Object.keys(evidence.authorityHashes).sort(), [
        'combatExp',
        'combatLoot',
        'eventReward',
        'progressionProfile',
    ]);
    Object.values(evidence.authorityHashes).forEach((hash) => assert.match(hash, /^[a-f0-9]{64}$/));
    const canonicalReport = canonicalizeRelicEventChanceReport(evidence.report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    assert.equal(evidence.reportHash, createHash('sha256').update(reportBytes).digest('hex'));
});
