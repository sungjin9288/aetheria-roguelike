import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import {
    evaluateTossReleaseGate,
    validateTossReleaseEvidence,
} from '../scripts/tossReleaseEvidence.mjs';
import {
    hashTossReleaseTree,
    verifyTossReleaseFiles,
} from '../scripts/verify-toss-release-evidence.mjs';

const SHA = 'a'.repeat(64);
const ATTACHMENT_SHA = 'b'.repeat(64);
const digest = (value) => createHash('sha256').update(value).digest('hex');

const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
    const typeBytes = Buffer.from(type, 'ascii');
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    typeBytes.copy(chunk, 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
    return chunk;
};

const pngFixture = (width, height) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    const pixels = Buffer.alloc((width + 1) * height);
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', deflateSync(pixels)),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
};

const observation = (id, phase, platform, overrides = {}) => ({
    observationId: id,
    sessionId: `obs_${digest(`session:${id}`).slice(0, 32)}`,
    phase,
    candidateId: 'candidate-1',
    artifactSha256: SHA,
    deploymentId: 'deployment-1',
    releaseId: 'release-1',
    runtime: 'sandbox',
    platform,
    osMajor: platform === 'ios' ? 18 : 15,
    deviceClass: 'phone',
    testerAlias: `tester-${id}`,
    observerAlias: `observer-${id}`,
    freshStateMethod: 'isolated_install',
    freshStateAttested: true,
    observed: true,
    startedAt: '2026-08-10T01:00:00.000Z',
    endedAt: '2026-08-10T01:05:00.000Z',
    firstScreenMs: 1_500,
    firstActionMs: 2_500,
    firstActionType: 'move',
    combatReached: true,
    safeReturnReached: true,
    saveRestorePassed: true,
    backgroundForegroundPassed: true,
    forcedRestartRestorePassed: true,
    backEventApplicable: true,
    backEventPassed: true,
    serviceWorkerAbsent: true,
    outcome: 'pass',
    issueIds: [],
    attachments: [{ ref: `capture-${id}.png`, sha256: digest(`capture:${id}`) }],
    ...overrides,
});

const verifiedGate = (overrides = {}) => ({
    status: 'verified',
    candidateId: 'candidate-1',
    releaseId: 'release-1',
    evidenceRef: 'external/receipt.json',
    evidenceSha256: ATTACHMENT_SHA,
    verifiedAt: '2026-08-10T02:00:00.000Z',
    expiresAt: null,
    approverRole: 'release_owner',
    ...overrides,
});

const releaseFixture = () => ({
    schemaVersion: 1,
    evaluatedAt: '2026-08-10T03:00:00.000Z',
    candidate: {
        candidateId: 'candidate-1',
        gitCommit: '1'.repeat(40),
        gitTree: '2'.repeat(40),
        cleanTree: true,
        sdkVersion: '3.0.3',
        aitPath: 'aetheria.ait',
        aitSha256: SHA,
        aitBytes: 72_000_000,
        distRoot: 'dist-toss',
        distTreeSha256: '3'.repeat(64),
        distBytes: 74_000_000,
        verifierReportPath: 'docs/evidence/toss/releases/candidate-1/bundle-report.json',
        verifierReportSha256: '4'.repeat(64),
        builtAt: '2026-08-10T00:00:00.000Z',
    },
    deployment: {
        candidateId: 'candidate-1',
        artifactSha256: SHA,
        appName: 'aetheria',
        environment: 'sandbox',
        deploymentId: 'deployment-1',
        releaseId: 'release-1',
        uploadedAt: '2026-08-10T00:30:00.000Z',
        receiptRef: 'external/console-deployment.json',
        receiptSha256: ATTACHMENT_SHA,
    },
    observations: [
        ...Array.from({ length: 5 }, (_, index) => observation(
            `internal-${index + 1}`,
            'internal',
            index % 2 === 0 ? 'ios' : 'android',
        )),
        ...Array.from({ length: 10 }, (_, index) => observation(
            `private-${index + 1}`,
            'private_qr',
            index % 2 === 0 ? 'ios' : 'android',
            {
                startedAt: '2026-08-10T01:10:00.000Z',
                endedAt: '2026-08-10T01:15:00.000Z',
            },
        )),
    ],
    issues: [],
    consoleAssets: [
        { kind: 'logo', path: 'assets/logo.png', width: 600, height: 600, sha256: '5'.repeat(64), candidateId: 'candidate-1', releaseId: 'release-1', originalPlay: false, testMarker: false },
        { kind: 'thumbnail', path: 'assets/thumbnail.png', width: 1932, height: 828, sha256: '6'.repeat(64), candidateId: 'candidate-1', releaseId: 'release-1', originalPlay: false, testMarker: false },
        ...Array.from({ length: 3 }, (_, index) => ({
            kind: 'portrait_screenshot',
            path: `assets/portrait-${index + 1}.png`,
            width: 1170,
            height: 2532,
            sha256: String(7 + index).repeat(64),
            candidateId: 'candidate-1',
            releaseId: 'release-1',
            originalPlay: true,
            testMarker: false,
        })),
    ],
    externalGates: Object.fromEntries([
        'app_name', 'sdk3_nonrollback', 'cors', 'game_navigation', 'business', 'settlement',
        'grac_rating', 'privacy_policy', 'support_channel', 'event_collector', 'sentry_release',
        'console_assets_review', 'ad_group', 'ad_activation_approval',
        'review_request_approval', 'review_accepted', 'public_release_approval',
    ].map((key) => [key, verifiedGate({ status: key.endsWith('approval') ? 'approved' : 'verified' })])),
});

test('local candidate without a deployment receipt is never Sandbox evidence', () => {
    const evidence = releaseFixture();
    evidence.deployment = null;
    const result = evaluateTossReleaseGate(evidence, 'sandbox');
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes('deployment_missing'));
});

test('exact candidate supports separate sandbox, private, review, and public gates', () => {
    const evidence = releaseFixture();
    assert.equal(validateTossReleaseEvidence(evidence).ok, true);
    for (const phase of ['sandbox', 'private-qr', 'review', 'public']) {
        assert.equal(evaluateTossReleaseGate(evidence, phase).ok, true, phase);
    }
});

test('observations fail closed on stale artifact, duplicate ID, one-platform coverage, or sensitive fields', () => {
    for (const mutate of [
        (evidence) => { evidence.observations[0].artifactSha256 = 'f'.repeat(64); },
        (evidence) => { evidence.observations[1].observationId = evidence.observations[0].observationId; },
        (evidence) => { evidence.observations[1].sessionId = evidence.observations[0].sessionId; },
        (evidence) => { evidence.observations[1].attachments[0].sha256 = evidence.observations[0].attachments[0].sha256; },
        (evidence) => { evidence.observations.filter((row) => row.phase === 'internal').forEach((row) => { row.platform = 'ios'; }); },
        (evidence) => { evidence.observations[0].nickname = 'PRIVATE_PLAYER'; },
        (evidence) => { evidence.observations[0].freshStateAttested = false; },
        (evidence) => { evidence.observations[0].combatReached = false; },
        (evidence) => { evidence.observations[0].safeReturnReached = false; },
        (evidence) => { evidence.observations[0].issueIds = ['missing-issue']; },
    ]) {
        const evidence = releaseFixture();
        mutate(evidence);
        assert.equal(evaluateTossReleaseGate(evidence, 'sandbox').ok, false);
    }
});

test('release evidence rejects unsafe refs, aliases, timeline drift, and expired release scope', () => {
    for (const mutate of [
        (evidence) => { evidence.candidate.aitPath = '../secret.ait'; },
        (evidence) => { evidence.candidate.distRoot = 'dist/../secret'; },
        (evidence) => { evidence.candidate.verifierReportPath = './report.json'; },
        (evidence) => { evidence.consoleAssets[0].path = '/tmp/logo.png'; },
        (evidence) => { evidence.observations[0].attachments[0].ref = 'private\\capture.png'; },
        (evidence) => { evidence.observations[0].testerAlias = 'REAL USER'; },
        (evidence) => { evidence.observations[0].freshStateMethod = 'manual note'; },
        (evidence) => { evidence.observations[0].firstActionType = 'custom action'; },
        (evidence) => { evidence.observations[0].startedAt = '2026-08-10T00:20:00.000Z'; },
        (evidence) => { evidence.observations[0].firstActionMs = 301_000; },
        (evidence) => { evidence.observations[0].firstActionMs = 1_000; },
        (evidence) => { evidence.externalGates.cors.releaseId = 'stale-release'; },
        (evidence) => { evidence.externalGates.cors.evidenceRef = 'external/../secret.json'; },
        (evidence) => { evidence.externalGates.cors.expiresAt = '2026-08-10T02:59:59.000Z'; },
        (evidence) => { evidence.externalGates.cors.verifiedAt = '2026-08-10T04:00:00.000Z'; },
        (evidence) => { evidence.deployment.uploadedAt = '2026-08-09T23:59:59.000Z'; },
        (evidence) => { evidence.evaluatedAt = '2026-08-10T01:01:00.000Z'; },
        (evidence) => { evidence.candidate.aitBytes = 101 * 1024 * 1024; },
    ]) {
        const evidence = releaseFixture();
        mutate(evidence);
        assert.equal(validateTossReleaseEvidence(evidence).ok, false);
    }
});

test('P0 and blocking P1 require an exact-candidate retest observation', () => {
    const evidence = releaseFixture();
    evidence.issues.push({
        issueId: 'issue-1',
        observationIds: [],
        discoveredCandidateId: 'candidate-0',
        discoveryEvidenceRef: 'external/issue-1-discovery.json',
        discoveryEvidenceSha256: 'c'.repeat(64),
        severity: 'P1',
        category: 'technical',
        blocking: true,
        status: 'fixed',
        repro: 'button unavailable',
        expected: 'button available',
        actual: 'button unavailable',
        redactionAttested: true,
        fixedCandidateId: 'candidate-1',
        fixedAt: '2026-08-10T01:30:00.000Z',
        retestObservationId: null,
    });
    assert.equal(evaluateTossReleaseGate(evidence, 'sandbox').ok, false);
    evidence.issues[0].retestObservationId = 'internal-2';
    const retest = evidence.observations.find((row) => row.observationId === 'internal-2');
    retest.issueIds = ['issue-1'];
    retest.startedAt = '2026-08-10T02:00:00.000Z';
    retest.endedAt = '2026-08-10T02:05:00.000Z';
    assert.equal(evaluateTossReleaseGate(evidence, 'sandbox').ok, true);
});

test('an explicitly blocking issue is blocking at every severity', () => {
    const evidence = releaseFixture();
    evidence.issues.push({
        issueId: 'issue-p2', observationIds: ['internal-1'], discoveredCandidateId: 'candidate-1',
        discoveryEvidenceRef: 'external/issue-p2.json', discoveryEvidenceSha256: 'd'.repeat(64), severity: 'P2',
        category: 'confusion', blocking: true, status: 'open', repro: 'unclear choice',
        expected: 'clear choice', actual: 'unclear choice', redactionAttested: true,
        fixedCandidateId: null, fixedAt: null, retestObservationId: null,
    });
    evidence.observations[0].issueIds = ['issue-p2'];
    assert.equal(evaluateTossReleaseGate(evidence, 'sandbox').ok, false);
});

test('fixed issues require prior-candidate discovery and a post-fix bound retest', () => {
    const evidence = releaseFixture();
    evidence.issues.push({
        issueId: 'issue-2', observationIds: [], discoveredCandidateId: 'candidate-0',
        discoveryEvidenceRef: 'external/issue-2.json', discoveryEvidenceSha256: 'e'.repeat(64),
        severity: 'P0', category: 'technical', blocking: true, status: 'fixed',
        repro: 'startup blocked', expected: 'startup succeeds', actual: 'startup blocked',
        redactionAttested: true, fixedCandidateId: 'candidate-1',
        fixedAt: '2026-08-10T01:30:00.000Z', retestObservationId: 'internal-3',
    });
    const retest = evidence.observations.find((row) => row.observationId === 'internal-3');
    retest.issueIds = ['issue-2'];
    retest.startedAt = '2026-08-10T02:00:00.000Z';
    retest.endedAt = '2026-08-10T02:05:00.000Z';
    assert.equal(evaluateTossReleaseGate(evidence, 'sandbox').ok, true);

    evidence.issues[0].discoveredCandidateId = 'candidate-1';
    assert.equal(evaluateTossReleaseGate(evidence, 'sandbox').ok, false);
    evidence.issues[0].discoveredCandidateId = 'candidate-0';
    retest.startedAt = '2026-08-10T01:00:00.000Z';
    assert.equal(evaluateTossReleaseGate(evidence, 'sandbox').ok, false);
});

test('committed issue prose rejects raw identity and filesystem evidence', () => {
    const evidence = releaseFixture();
    evidence.issues.push({
        issueId: 'issue-private', observationIds: ['internal-1'], discoveredCandidateId: 'candidate-1',
        discoveryEvidenceRef: 'external/issue-private.json', discoveryEvidenceSha256: 'f'.repeat(64),
        severity: 'P2', category: 'technical', blocking: false, status: 'open',
        repro: 'PRIVATE_NICKNAME at /Users/private/save.json', expected: 'safe summary',
        actual: 'raw userKey exposed', redactionAttested: true, fixedCandidateId: null,
        fixedAt: null, retestObservationId: null,
    });
    evidence.observations[0].issueIds = ['issue-private'];
    assert.equal(validateTossReleaseEvidence(evidence).ok, false);
});

test('review assets and external approvals are distinct fail-closed gates', () => {
    const missingPortrait = releaseFixture();
    missingPortrait.consoleAssets = missingPortrait.consoleAssets.filter((asset, index) => (
        asset.kind !== 'portrait_screenshot' || index < 4
    ));
    assert.equal(evaluateTossReleaseGate(missingPortrait, 'review').ok, false);

    const noReviewApproval = releaseFixture();
    noReviewApproval.externalGates.review_request_approval.status = 'unverified';
    assert.equal(evaluateTossReleaseGate(noReviewApproval, 'review').ok, false);
    assert.equal(evaluateTossReleaseGate(noReviewApproval, 'private-qr').ok, true);

    const noPublicApproval = releaseFixture();
    noPublicApproval.externalGates.public_release_approval.status = 'unverified';
    assert.equal(evaluateTossReleaseGate(noPublicApproval, 'review').ok, true);
    assert.equal(evaluateTossReleaseGate(noPublicApproval, 'public').ok, false);

    const duplicatePortrait = releaseFixture();
    const portraits = duplicatePortrait.consoleAssets.filter((asset) => asset.kind === 'portrait_screenshot');
    portraits[1].sha256 = portraits[0].sha256;
    portraits[2].sha256 = portraits[0].sha256;
    assert.equal(evaluateTossReleaseGate(duplicatePortrait, 'review').ok, false);

    const noAdApproval = releaseFixture();
    noAdApproval.externalGates.ad_activation_approval.status = 'unverified';
    assert.equal(evaluateTossReleaseGate(noAdApproval, 'public').ok, true);
    assert.equal(evaluateTossReleaseGate(noAdApproval, 'ad-activation').ok, false);
    const noAdGroup = releaseFixture();
    noAdGroup.externalGates.ad_group.status = 'unverified';
    assert.equal(evaluateTossReleaseGate(noAdGroup, 'ad-activation').ok, false);
    assert.equal(evaluateTossReleaseGate(releaseFixture(), 'ad-activation').ok, true);
});

test('private QR observations begin only after the internal observation phase completes', () => {
    const evidence = releaseFixture();
    evidence.observations.find((row) => row.phase === 'private_qr').startedAt = '2026-08-10T01:04:00.000Z';
    assert.equal(evaluateTossReleaseGate(evidence, 'private-qr').ok, false);
});

test('review request approval is issued only after private QR observations complete', () => {
    const evidence = releaseFixture();
    evidence.externalGates.review_request_approval.verifiedAt = '2026-08-10T01:14:59.000Z';
    assert.equal(evaluateTossReleaseGate(evidence, 'private-qr').ok, true);
    const result = evaluateTossReleaseGate(evidence, 'review');
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes('review_requested_before_private_qr_complete'));
});

test('CLI file verification binds git, artifact, dist, receipts, report, and PNG bytes', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'aetheria-release-repo-'));
    const releaseDir = path.join(repoRoot, 'docs', 'evidence', 'toss', 'releases', 'candidate-1');
    await mkdir(path.join(repoRoot, 'dist-toss'), { recursive: true });
    await mkdir(path.join(releaseDir, 'external'), { recursive: true });
    await mkdir(path.join(releaseDir, 'assets'), { recursive: true });
    await writeFile(path.join(repoRoot, 'tracked.txt'), 'candidate source\n');
    execFileSync('git', ['init', '-q'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: repoRoot });
    execFileSync('git', ['config', 'user.name', 'Release Test'], { cwd: repoRoot });
    execFileSync('git', ['add', 'tracked.txt'], { cwd: repoRoot });
    execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repoRoot });

    const distFile = Buffer.from('exact web bundle');
    await writeFile(path.join(repoRoot, 'dist-toss', 'index.html'), distFile);

    const evidence = releaseFixture();
    evidence.candidate.gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    evidence.candidate.gitTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    evidence.candidate.aitPath = 'aetheria.ait';
    evidence.candidate.distRoot = 'dist-toss';
    const tree = await hashTossReleaseTree(repoRoot, 'dist-toss');
    evidence.candidate.distTreeSha256 = tree.sha256;
    evidence.candidate.distBytes = tree.bytes;
    const verifier = Buffer.from(`${JSON.stringify({
        ok: true,
        files: tree.files,
        totalBytes: tree.bytes,
        maxBytes: 80 * 1024 * 1024,
        missing: [],
        forbidden: [],
        unexpected: [],
        testHarnessMarkers: [],
    })}\n`);
    const ait = Buffer.concat([
        Buffer.from('AITBUNDL'),
        ...tree.entries.flatMap((entry) => [
            Buffer.from(`sources/${entry.relative}\0`),
            Buffer.from(entry.sha256),
        ]),
    ]);
    await writeFile(path.join(repoRoot, 'aetheria.ait'), ait);
    evidence.candidate.aitSha256 = digest(ait);
    evidence.candidate.aitBytes = ait.length;
    await writeFile(path.join(releaseDir, 'bundle-report.json'), verifier);
    evidence.candidate.verifierReportPath = 'docs/evidence/toss/releases/candidate-1/bundle-report.json';
    evidence.candidate.verifierReportSha256 = digest(verifier);
    evidence.deployment.artifactSha256 = evidence.candidate.aitSha256;
    const deploymentReceipt = Buffer.from(`${JSON.stringify({
        schemaVersion: 1,
        kind: 'deployment',
        candidateId: evidence.candidate.candidateId,
        artifactSha256: evidence.candidate.aitSha256,
        deploymentId: evidence.deployment.deploymentId,
        releaseId: evidence.deployment.releaseId,
        environment: evidence.deployment.environment,
        uploadedAt: evidence.deployment.uploadedAt,
    })}\n`);
    evidence.deployment.receiptRef = 'external/deployment.json';
    evidence.deployment.receiptSha256 = digest(deploymentReceipt);
    await writeFile(path.join(releaseDir, evidence.deployment.receiptRef), deploymentReceipt);
    for (const [key, gate] of Object.entries(evidence.externalGates)) {
        const receipt = Buffer.from(`${JSON.stringify({
            schemaVersion: 1,
            kind: 'external_gate',
            gate: key,
            candidateId: gate.candidateId,
            releaseId: gate.releaseId,
            status: gate.status,
            verifiedAt: gate.verifiedAt,
            expiresAt: gate.expiresAt,
            approverRole: gate.approverRole,
        })}\n`);
        gate.evidenceRef = `external/${key}.json`;
        gate.evidenceSha256 = digest(receipt);
        await writeFile(path.join(releaseDir, gate.evidenceRef), receipt);
    }
    for (const asset of evidence.consoleAssets) {
        const bytes = pngFixture(asset.width, asset.height);
        await writeFile(path.join(releaseDir, asset.path), bytes);
        asset.sha256 = digest(bytes);
    }
    for (const row of evidence.observations) {
        const bytes = Buffer.from(`capture:${row.observationId}`);
        await writeFile(path.join(releaseDir, row.attachments[0].ref), bytes);
        row.attachments[0].sha256 = digest(bytes);
    }

    assert.deepEqual(
        await verifyTossReleaseFiles(evidence, { releaseDir, repoRoot }),
        { ok: true, errors: [] },
    );

    await writeFile(path.join(repoRoot, 'rogue-source.ts'), 'uncommitted source');
    assert.equal((await verifyTossReleaseFiles(evidence, { releaseDir, repoRoot })).ok, false);
    await rm(path.join(repoRoot, 'rogue-source.ts'));

    const weakVerifier = Buffer.from('{"ok":true}\n');
    await writeFile(path.join(releaseDir, 'bundle-report.json'), weakVerifier);
    const priorVerifierSha = evidence.candidate.verifierReportSha256;
    evidence.candidate.verifierReportSha256 = digest(weakVerifier);
    assert.equal((await verifyTossReleaseFiles(evidence, { releaseDir, repoRoot })).ok, false);
    await writeFile(path.join(releaseDir, 'bundle-report.json'), verifier);
    evidence.candidate.verifierReportSha256 = priorVerifierSha;

    const cors = evidence.externalGates.cors;
    const priorCors = { evidenceRef: cors.evidenceRef, evidenceSha256: cors.evidenceSha256 };
    cors.evidenceRef = evidence.deployment.receiptRef;
    cors.evidenceSha256 = evidence.deployment.receiptSha256;
    assert.equal((await verifyTossReleaseFiles(evidence, { releaseDir, repoRoot })).ok, false);
    Object.assign(cors, priorCors);

    await writeFile(path.join(repoRoot, 'aetheria.ait'), 'tampered artifact');
    assert.equal((await verifyTossReleaseFiles(evidence, { releaseDir, repoRoot })).ok, false);
    await writeFile(path.join(repoRoot, 'aetheria.ait'), ait);
    await symlink(path.join(releaseDir, 'assets', 'logo.png'), path.join(releaseDir, 'assets', 'logo-link.png'));
    evidence.consoleAssets[0].path = 'assets/logo-link.png';
    assert.equal((await verifyTossReleaseFiles(evidence, { releaseDir, repoRoot })).ok, false);
});
