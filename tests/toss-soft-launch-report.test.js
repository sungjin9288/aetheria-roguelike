import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    buildSoftLaunchReport,
    evaluateSoftLaunchGate,
    verifySoftLaunchReport,
} from '../scripts/tossSoftLaunchReport.mjs';

const RELEASE = 'release-1';
const DEPLOYMENT = 'deployment-1';
const CANDIDATE = 'candidate-1';
const ARTIFACT_SHA = 'a'.repeat(64);
const EVIDENCE_SHA = 'b'.repeat(64);
const HOUR = 60 * 60 * 1_000;
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const generatorScript = path.join(repoRoot, 'scripts/generate-toss-soft-launch-report.mjs');
const verifierScript = path.join(repoRoot, 'scripts/verify-toss-soft-launch-report.mjs');
const opaqueId = (prefix, value) => `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
const digest = (value) => createHash('sha256').update(value).digest('hex');

const event = (cohortId, sessionId, name, receivedAt, serverSequence, outcome = 'accepted') => ({
    cohortId: opaqueId('c', cohortId),
    sessionId: opaqueId('s', sessionId),
    releaseId: RELEASE,
    deploymentId: DEPLOYMENT,
    name,
    outcome,
    receivedAt,
    serverSequence,
});

const journey = (cohortId, bootAt, sequenceBase = 1) => [
    event(cohortId, `${cohortId}-s1`, 'boot', bootAt, sequenceBase, 'ready'),
    event(cohortId, `${cohortId}-s1`, 'character_created', bootAt + 1_000, sequenceBase + 1, 'success'),
    event(cohortId, `${cohortId}-s1`, 'first_action', bootAt + 2_000, sequenceBase + 2, 'move'),
    event(cohortId, `${cohortId}-s1`, 'combat_start', bootAt + 3_000, sequenceBase + 3, 'normal'),
    event(cohortId, `${cohortId}-s1`, 'safe_expedition_return', bootAt + 4_000, sequenceBase + 4, 'success'),
    event(cohortId, `${cohortId}-s1`, 'save', bootAt + 5_000, sequenceBase + 5, 'success'),
    event(cohortId, `${cohortId}-s1`, 'restore', bootAt + 6_000, sequenceBase + 6, 'local'),
];

const createAuthority = ({
    cutoff,
    events,
    candidateId = CANDIDATE,
    artifactSha256 = ARTIFACT_SHA,
    releaseId = RELEASE,
    deploymentId = DEPLOYMENT,
    crashFreeSessions = true,
    durableAdReceipts = true,
    openP0 = 0,
} = {}) => ({
    schemaVersion: 1,
    candidateId,
    artifactSha256,
    releaseId,
    deploymentId,
    cutoff,
    inputSha256: digest(JSON.stringify(events)),
    eventCount: events.length,
    sequenceMin: Math.min(...events.map((row) => row.serverSequence)),
    sequenceMax: Math.max(...events.map((row) => row.serverSequence)),
    crashFreeSessions: {
        verified: crashFreeSessions,
        numerator: crashFreeSessions ? 1 : 0,
        denominator: crashFreeSessions ? 1 : 0,
        evidenceRef: 'evidence/crash-free-sessions.json',
        evidenceSha256: EVIDENCE_SHA,
    },
    durableAdReceipts: {
        verified: durableAdReceipts,
        succeeded: durableAdReceipts ? 1 : 0,
        attempted: durableAdReceipts ? 1 : 0,
        scope: durableAdReceipts ? 'server_transaction' : 'unavailable',
        evidenceRef: 'evidence/durable-ad-receipts.json',
        evidenceSha256: EVIDENCE_SHA,
    },
    openP0: {
        count: openP0,
        evidenceRef: 'evidence/open-p0.json',
        evidenceSha256: EVIDENCE_SHA,
    },
});

const writeAuthorityReceipts = async (directory, authority) => {
    await mkdir(path.join(directory, 'evidence'), { recursive: true });
    for (const [kind, value] of [
        ['crash_free_sessions', authority.crashFreeSessions],
        ['durable_ad_receipts', authority.durableAdReceipts],
        ['open_p0', authority.openP0],
    ]) {
        const publicValue = Object.fromEntries(Object.entries(value).filter(([key]) => (
            key !== 'evidenceRef' && key !== 'evidenceSha256'
        )));
        const bytes = `${JSON.stringify({
            schemaVersion: 1,
            kind,
            candidateId: authority.candidateId,
            artifactSha256: authority.artifactSha256,
            releaseId: authority.releaseId,
            deploymentId: authority.deploymentId,
            cutoff: authority.cutoff,
            inputSha256: authority.inputSha256,
            eventCount: authority.eventCount,
            sequenceMin: authority.sequenceMin,
            sequenceMax: authority.sequenceMax,
            value: publicValue,
        })}\n`;
        await writeFile(path.join(directory, value.evidenceRef), bytes);
        value.evidenceSha256 = digest(bytes);
    }
};

const buildReport = ({
    events,
    cutoff,
    candidateId = CANDIDATE,
    artifactSha256 = ARTIFACT_SHA,
    releaseId = RELEASE,
    deploymentId = DEPLOYMENT,
    authority,
}) => buildSoftLaunchReport({
    events,
    candidateId,
    artifactSha256,
    releaseId,
    deploymentId,
    cutoff,
    authority: authority || createAuthority({
        cutoff, events, candidateId, artifactSha256, releaseId, deploymentId,
    }),
});

test('retention denominators include only cohorts whose window matured by cutoff', () => {
    const cutoff = Date.parse('2026-08-20T00:00:00.000Z');
    const oldBoot = cutoff - (10 * 24 * HOUR);
    const newBoot = cutoff - (12 * HOUR);
    const events = [
        ...journey('old', oldBoot),
        event('old', 'old-s2', 'boot', oldBoot + 25 * HOUR, 20, 'ready'),
        event('old', 'old-s3', 'boot', oldBoot + 169 * HOUR, 21, 'ready'),
        ...journey('new', newBoot, 30),
    ];
    const report = buildReport({
        events,
        releaseId: RELEASE,
        deploymentId: DEPLOYMENT,
        cutoff,
    });
    assert.equal(report.cohorts.newUsers, 2);
    assert.deepEqual(report.metrics.d1Retention, {
        numerator: 1,
        denominator: 1,
        rate: 1,
        status: 'directional_only',
    });
    assert.deepEqual(report.metrics.d7Retention, {
        numerator: 1,
        denominator: 1,
        rate: 1,
        status: 'directional_only',
    });
});

test('first action counts only accepted actions after character creation', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const events = [
        event('blocked', 'blocked-s1', 'boot', start, 1, 'ready'),
        event('blocked', 'blocked-s1', 'first_action', start + 1_000, 2, 'move'),
        event('blocked', 'blocked-s1', 'character_created', start + 2_000, 3, 'success'),
        event('accepted', 'accepted-s1', 'boot', start, 4, 'ready'),
        event('accepted', 'accepted-s1', 'character_created', start + 1_000, 5, 'success'),
        event('accepted', 'accepted-s1', 'first_action', start + 2_000, 6, 'move'),
    ];
    const report = buildReport({
        events,
        releaseId: RELEASE,
        deploymentId: DEPLOYMENT,
        cutoff: start + 8 * 24 * HOUR,
    });
    assert.equal(report.metrics.firstAction.numerator, 1);
    assert.equal(report.metrics.firstAction.denominator, 2);
});

test('soft launch is reviewable at seven days or 100 users without pretending immature retention passed', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const sixDay = buildReport({
        events: journey('only', start), releaseId: RELEASE, deploymentId: DEPLOYMENT,
        cutoff: start + 6 * 24 * HOUR,
    });
    assert.equal(sixDay.observation.reviewable, false);

    const sevenDay = buildReport({
        events: journey('only', start), releaseId: RELEASE, deploymentId: DEPLOYMENT,
        cutoff: start + 7 * 24 * HOUR,
    });
    assert.equal(sevenDay.observation.reviewable, true);
    assert.equal(sevenDay.metrics.d7Retention.status, 'pending');

    const hundred = buildReport({
        events: Array.from({ length: 100 }, (_, index) => journey(`c${index}`, start, index * 10 + 1)).flat(),
        releaseId: RELEASE,
        deploymentId: DEPLOYMENT,
        cutoff: start + 24 * HOUR,
    });
    assert.equal(hundred.observation.reviewable, true);
    assert.equal(hundred.metrics.d1Retention.status, 'pending');
    assert.equal(hundred.metrics.d7Retention.status, 'pending');
});

test('missing crash or durable ad authority remains unavailable and blocks a passing claim', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const events = journey('only', start);
    const report = buildReport({
        events,
        releaseId: RELEASE,
        deploymentId: DEPLOYMENT,
        cutoff: start + 9 * 24 * HOUR,
        authority: createAuthority({
            cutoff: start + 9 * 24 * HOUR,
            events,
            crashFreeSessions: false,
            durableAdReceipts: false,
        }),
    });
    assert.equal(report.metrics.crashFreeSession.status, 'unavailable');
    assert.equal(report.metrics.adTransactionSuccess.status, 'unavailable');
    const gate = evaluateSoftLaunchGate(report);
    assert.equal(gate.ok, false);
    assert.ok(gate.blockers.includes('crash_free_session_unavailable'));
    assert.ok(gate.blockers.includes('ad_transaction_success_unavailable'));
});

test('mixed releases and duplicate server order authority fail closed', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const mixed = journey('one', start);
    mixed[0] = { ...mixed[0], releaseId: 'other-release' };
    assert.throws(() => buildReport({
        events: mixed, releaseId: RELEASE, deploymentId: DEPLOYMENT, cutoff: start + 9 * 24 * HOUR,
    }), /release authority/i);

    const duplicate = journey('one', start);
    duplicate[1] = { ...duplicate[1], receivedAt: duplicate[0].receivedAt, serverSequence: duplicate[0].serverSequence };
    assert.throws(() => buildReport({
        events: duplicate, releaseId: RELEASE, deploymentId: DEPLOYMENT, cutoff: start + 9 * 24 * HOUR,
    }), /order authority/i);
});

test('canonical outcomes, cutoff, and a prior combat are required', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    for (const mutate of [
        (events) => { events[0].outcome = 'failed'; },
        (events) => { events[2].outcome = 'accepted'; },
        (events) => { events[2].receivedAt = start + 10 * 24 * HOUR; },
    ]) {
        const events = journey('one', start);
        mutate(events);
        assert.throws(() => buildReport({
            events, releaseId: RELEASE, deploymentId: DEPLOYMENT,
            cutoff: start + 9 * 24 * HOUR,
        }), /event|cutoff|combat/i);
    }
    const reordered = journey('one', start);
    reordered[4].receivedAt = start + 2_500;
    const report = buildReport({
        events: reordered, releaseId: RELEASE, deploymentId: DEPLOYMENT,
        cutoff: start + 9 * 24 * HOUR,
    });
    assert.equal(report.metrics.safeReturn.numerator, 0);
});

test('opaque cohort authority and boot-first funnel ordering are mandatory', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const privateIds = journey('one', start);
    privateIds[0].cohortId = 'PRIVATE_NICKNAME';
    privateIds[0].sessionId = 'RAWUSERKEY123';
    assert.throws(() => buildReport({
        events: privateIds,
        cutoff: start + 9 * 24 * HOUR,
    }), /cohort authority/i);

    const reordered = journey('one', start);
    reordered[0].receivedAt = start + 10_000;
    const report = buildReport({
        events: reordered,
        cutoff: start + 9 * 24 * HOUR,
    });
    assert.equal(report.metrics.firstAction.denominator, 0);
    assert.equal(report.metrics.firstCombat.denominator, 0);
    assert.equal(report.metrics.safeReturn.denominator, 0);
});

test('retention requires a later accepted boot and uses half-open windows', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const events = [
        ...journey('one', start),
        event('one', 'one-s2', 'save', start + 25 * HOUR, 20, 'success'),
        event('one', 'one-s3', 'feedback_submission', start + 169 * HOUR, 21, 'success'),
        event('one', 'one-s4', 'boot', start + 48 * HOUR, 22, 'ready'),
        event('one', 'one-s5', 'boot', start + 192 * HOUR, 23, 'ready'),
    ];
    const report = buildReport({
        events, releaseId: RELEASE, deploymentId: DEPLOYMENT,
        cutoff: start + 10 * 24 * HOUR,
    });
    assert.equal(report.metrics.d1Retention.numerator, 0);
    assert.equal(report.metrics.d7Retention.numerator, 0);
});

test('crash-free KPI uses the bound authority aggregate instead of unrelated telemetry sessions', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const events = [
        ...journey('one', start),
        event('one', 'one-s1', 'fatal_error_boundary', start + 7_000, 20, 'caught'),
        ...Array.from({ length: 1_000 }, (_, index) => event(
            'one', `bogus-${index}`, 'feedback_submission', start + 8_000 + index, 21 + index, 'success',
        )),
    ];
    const authority = createAuthority({ cutoff: start + 9 * 24 * HOUR, events });
    authority.crashFreeSessions.numerator = 0;
    authority.crashFreeSessions.denominator = 1;
    const report = buildReport({
        events, releaseId: RELEASE, deploymentId: DEPLOYMENT,
        cutoff: start + 9 * 24 * HOUR,
        authority,
    });
    assert.equal(report.metrics.crashFreeSession.denominator, 1);
    assert.equal(report.metrics.crashFreeSession.rate, 0);
});

test('unknown metric status cannot bypass the standalone gate', () => {
    assert.equal(evaluateSoftLaunchGate({ observation: { reviewable: true }, metrics: {} }).ok, false);
    const forged = {
        observation: { reviewable: true },
        metrics: {
            crashFreeSession: { status: 'perfect' },
            openP0: { status: 'pass' },
        },
    };
    assert.equal(evaluateSoftLaunchGate(forged).ok, false);
});

test('standalone gate validates reviewability and directional retention consistency', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const report = buildReport({ events: journey('one', start), cutoff: start + 9 * 24 * HOUR });
    assert.equal(evaluateSoftLaunchGate(report).ok, true);

    const forgedWindow = structuredClone(report);
    forgedWindow.observation.elapsedHours = 0;
    assert.equal(evaluateSoftLaunchGate(forgedWindow).ok, false);

    const forgedRetention = structuredClone(report);
    for (const name of ['d1Retention', 'd7Retention']) {
        forgedRetention.metrics[name].status = 'pass';
    }
    assert.equal(evaluateSoftLaunchGate(forgedRetention).ok, false);
});

test('report verification binds every metric to the exact input export', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const events = journey('one', start);
    const cutoff = start + 9 * 24 * HOUR;
    const authority = createAuthority({ cutoff, events });
    const report = buildReport({
        events,
        releaseId: RELEASE,
        deploymentId: DEPLOYMENT,
        cutoff,
        authority,
    });
    assert.equal(verifySoftLaunchReport(report, events, authority).ok, true);
    const forged = structuredClone(report);
    forged.metrics.firstAction.rate = 0.5;
    assert.deepEqual(verifySoftLaunchReport(forged, events, authority), {
        ok: false,
        reason: 'report_input_binding_mismatch',
    });
    assert.equal(verifySoftLaunchReport(
        report,
        [...events, event('two', 'two-s1', 'boot', start, 99, 'ready')],
        authority,
    ).ok, false);
});

test('independent authority binds the exact candidate, artifact, release, deployment, and cutoff', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const cutoff = start + 9 * 24 * HOUR;
    const events = journey('one', start);
    const authority = createAuthority({ cutoff, events });
    const report = buildReport({ events, cutoff, authority });

    assert.equal(report.candidateId, CANDIDATE);
    assert.equal(report.artifactSha256, ARTIFACT_SHA);
    assert.match(report.authoritySha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(verifySoftLaunchReport(report, journey('one', start)), {
        ok: false,
        reason: 'authority_input_required',
    });
    assert.equal(verifySoftLaunchReport(report, journey('one', start), authority).ok, true);

    const wrongArtifact = createAuthority({ cutoff, events, artifactSha256: 'c'.repeat(64) });
    assert.deepEqual(verifySoftLaunchReport(report, journey('one', start), wrongArtifact), {
        ok: false,
        reason: 'authority_input_binding_mismatch',
    });
    assert.throws(() => buildReport({
        events: journey('one', start),
        cutoff,
        authority: wrongArtifact,
    }), /authority.*artifact|artifact.*authority/i);

    const ambiguousEvidenceRef = createAuthority({ cutoff, events });
    ambiguousEvidenceRef.openP0.evidenceRef = 'evidence//open-p0.json';
    assert.throws(() => buildReport({
        events: journey('one', start),
        cutoff,
        authority: ambiguousEvidenceRef,
    }), /open-p0 evidence/i);
});

test('save and restore metrics are separate, and fresh restore does not inflate the restore denominator', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const report = buildReport({
        events: [
            ...journey('one', start),
            event('one', 'one-s1', 'restore', start + 7_000, 8, 'fresh'),
        ],
        cutoff: start + 9 * 24 * HOUR,
    });

    assert.deepEqual(report.metrics.saveSuccess, {
        numerator: 1,
        denominator: 1,
        rate: 1,
        status: 'pass',
    });
    assert.deepEqual(report.metrics.restoreSuccess, {
        numerator: 1,
        denominator: 1,
        rate: 1,
        status: 'pass',
    });
    assert.equal(report.metrics.saveRestoreSuccess, undefined);
});

test('save and restore denominators require an earlier accepted boot in the same session', () => {
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const events = [
        event('one', 'one-s1', 'boot', start, 1, 'ready'),
        event('one', 'one-s1', 'save', start + 1_000, 2, 'failure'),
        ...Array.from({ length: 1_000 }, (_, index) => event(
            'one', `bogus-${index}`, 'save', start + 2_000 + index, 3 + index, 'success',
        )),
    ];
    const report = buildReport({ events, cutoff: start + 9 * 24 * HOUR });
    assert.deepEqual(report.metrics.saveSuccess, {
        numerator: 0,
        denominator: 1,
        rate: 0,
        status: 'fail',
    });
});

test('soft-launch generator writes immutable reports and rejects a symlink escape from build', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'aetheria-soft-launch-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const start = Date.parse('2026-08-01T00:00:00.000Z');
    const cutoff = start + 9 * 24 * HOUR;
    const eventsPath = path.join(directory, 'events.jsonl');
    const authorityPath = path.join(directory, 'authority.json');
    const reportPath = path.join(directory, 'build', 'toss-soft-launch', 'reports', 'soft-launch.json');
    const events = journey('one', start);
    await writeFile(eventsPath, `${events.map((row) => JSON.stringify(row)).join('\n')}\n`);
    const authority = createAuthority({ cutoff, events });
    await writeAuthorityReceipts(directory, authority);
    await writeFile(authorityPath, `${JSON.stringify(authority)}\n`);

    const generate = (out) => spawnSync(process.execPath, [generatorScript,
        '--events', eventsPath,
        '--authority', authorityPath,
        '--out', out,
    ], { cwd: directory, encoding: 'utf8' });

    const first = generate('build/toss-soft-launch/reports/soft-launch.json');
    assert.equal(first.status, 0, first.stderr);
    assert.equal((await readFile(reportPath, 'utf8')).includes('"authoritySha256"'), true);

    const missingDirectory = path.join(directory, 'missing-authority');
    await mkdir(missingDirectory);
    const missingAuthority = createAuthority({ cutoff, events });
    const missingAuthorityPath = path.join(missingDirectory, 'authority.json');
    await writeFile(missingAuthorityPath, `${JSON.stringify(missingAuthority)}\n`);
    const missingReceipt = spawnSync(process.execPath, [generatorScript,
        '--events', eventsPath,
        '--authority', missingAuthorityPath,
        '--out', 'build/toss-soft-launch/reports/missing.json',
    ], { cwd: directory, encoding: 'utf8' });
    assert.notEqual(missingReceipt.status, 0);
    assert.match(missingReceipt.stderr, /authority|ENOENT|evidence/i);

    const overwrite = generate('build/toss-soft-launch/reports/soft-launch.json');
    assert.notEqual(overwrite.status, 0);
    assert.match(overwrite.stderr, /immutable|exists/i);

    await mkdir(path.join(directory, 'outside'), { recursive: true });
    await mkdir(path.join(directory, 'build', 'toss-soft-launch'), { recursive: true });
    await symlink(
        path.join(directory, 'outside'),
        path.join(directory, 'build', 'toss-soft-launch', 'escape'),
    );
    const escaped = generate('build/toss-soft-launch/escape/soft-launch.json');
    assert.notEqual(escaped.status, 0);
    assert.match(escaped.stderr, /symlink|build/i);
    await assert.rejects(readFile(path.join(directory, 'outside', 'soft-launch.json')));

    const outsideBuild = generate('.');
    assert.notEqual(outsideBuild.status, 0);
    assert.match(outsideBuild.stderr, /build/i);
});

test('soft-launch CLI verifier requires the independent authority document', () => {
    const result = spawnSync(process.execPath, [verifierScript,
        '--report', 'report.json',
        '--events', 'events.jsonl',
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /authority/i);
});
