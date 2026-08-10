#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { evaluateTossReleaseGate } from './tossReleaseEvidence.mjs';

const execFileAsync = promisify(execFile);

const parseArgs = (argv) => {
    const values = {};
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error(`Invalid option: ${key}`);
        values[key.slice(2)] = argv[index + 1];
        index += 1;
    }
    return values;
};

const readJson = async (filePath, fallback) => {
    try {
        return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
        if (error?.code === 'ENOENT') return fallback;
        throw error;
    }
};

const readJsonl = async (filePath) => {
    try {
        const text = await readFile(filePath, 'utf8');
        return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
    }
};

export const loadTossReleaseEvidence = async (releaseDir) => ({
    schemaVersion: 1,
    evaluatedAt: (await readJson(path.join(releaseDir, 'evaluation.json'), {})).evaluatedAt ?? null,
    candidate: await readJson(path.join(releaseDir, 'candidate.json'), null),
    deployment: await readJson(path.join(releaseDir, 'deployment.json'), null),
    observations: await readJsonl(path.join(releaseDir, 'observations.jsonl')),
    issues: await readJsonl(path.join(releaseDir, 'issues.jsonl')),
    consoleAssets: await readJson(path.join(releaseDir, 'console-assets.json'), []),
    externalGates: await readJson(path.join(releaseDir, 'external-gates.json'), {}),
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => (
    isPlainObject(value)
    && Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
);

const isWithin = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);

const resolveRegularFile = async (root, relativePath) => {
    const rootReal = await realpath(root);
    const target = path.resolve(root, relativePath);
    if (!isWithin(path.resolve(root), target)) throw new Error('path_escape');
    const targetReal = await realpath(target);
    if (!isWithin(rootReal, targetReal)) throw new Error('path_symlink_escape');
    const stats = await lstat(target);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('regular_file_required');
    return { target, stats };
};

const hashRegularFile = async (root, relativePath) => {
    const { target, stats } = await resolveRegularFile(root, relativePath);
    return { sha256: sha256(await readFile(target)), bytes: stats.size, target };
};

export const hashTossReleaseTree = async (root, relativePath) => {
    const rootReal = await realpath(root);
    const treeRoot = path.resolve(root, relativePath);
    const treeReal = await realpath(treeRoot);
    if (!isWithin(rootReal, treeReal)) throw new Error('tree_symlink_escape');
    if (!(await lstat(treeRoot)).isDirectory()) throw new Error('tree_directory_required');
    const rows = [];
    const visit = async (directory) => {
        const entries = await readdir(directory, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const absolute = path.join(directory, entry.name);
            const stats = await lstat(absolute);
            if (stats.isSymbolicLink()) throw new Error('tree_symlink_forbidden');
            if (stats.isDirectory()) await visit(absolute);
            else if (stats.isFile()) {
                const relative = path.relative(treeRoot, absolute).split(path.sep).join('/');
                rows.push({ relative, bytes: stats.size, sha256: sha256(await readFile(absolute)) });
            } else throw new Error('tree_entry_invalid');
        }
    };
    await visit(treeRoot);
    const digest = createHash('sha256');
    let bytes = 0;
    for (const row of rows) {
        bytes += row.bytes;
        digest.update(`${row.relative}\0${row.bytes}\0${row.sha256}\n`);
    }
    return { sha256: digest.digest('hex'), bytes, files: rows.length, entries: rows };
};

const readAitSourceRecords = (bytes) => {
    if (bytes.length < 8 || bytes.subarray(0, 8).toString('ascii') !== 'AITBUNDL') {
        throw new Error('ait_header_invalid');
    }
    const records = new Map();
    const marker = Buffer.from('sources/');
    let cursor = 8;
    while (cursor < bytes.length) {
        const start = bytes.indexOf(marker, cursor);
        if (start < 0) break;
        let end = start;
        while (end < bytes.length && /[A-Za-z0-9._/-]/.test(String.fromCharCode(bytes[end]))) end += 1;
        const sourcePath = bytes.subarray(start, end).toString('utf8');
        const window = bytes.subarray(end, Math.min(bytes.length, end + 192)).toString('latin1');
        const digest = window.match(/[a-f0-9]{64}/)?.[0];
        if (digest) {
            if (records.has(sourcePath)) throw new Error('ait_source_duplicate');
            records.set(sourcePath, digest);
        }
        cursor = Math.max(end, start + marker.length);
    }
    return records;
};

const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const readPngDimensions = async (filePath) => {
    const bytes = await readFile(filePath);
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) throw new Error('png_invalid');
    let cursor = 8;
    let dimensions = null;
    const idat = [];
    let ended = false;
    while (cursor + 12 <= bytes.length && !ended) {
        const length = bytes.readUInt32BE(cursor);
        const type = bytes.toString('ascii', cursor + 4, cursor + 8);
        const dataStart = cursor + 8;
        const dataEnd = dataStart + length;
        if (dataEnd + 4 > bytes.length) throw new Error('png_chunk_truncated');
        const expectedCrc = bytes.readUInt32BE(dataEnd);
        if (crc32(bytes.subarray(cursor + 4, dataEnd)) !== expectedCrc) throw new Error('png_crc_invalid');
        const data = bytes.subarray(dataStart, dataEnd);
        if (type === 'IHDR') {
            if (dimensions || length !== 13 || data[8] !== 8 || data[12] !== 0) throw new Error('png_ihdr_invalid');
            dimensions = { width: data.readUInt32BE(0), height: data.readUInt32BE(4) };
            if (dimensions.width < 1 || dimensions.height < 1) throw new Error('png_dimensions_invalid');
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') {
            if (length !== 0) throw new Error('png_iend_invalid');
            ended = true;
        }
        cursor = dataEnd + 4;
    }
    if (!dimensions || idat.length === 0 || !ended || cursor !== bytes.length) throw new Error('png_incomplete');
    if (inflateSync(Buffer.concat(idat)).length === 0) throw new Error('png_pixels_missing');
    return dimensions;
};

const pushMismatch = (errors, condition, code) => {
    if (!condition) errors.push(code);
};

const validBundleReport = (report, dist) => (
    hasExactKeys(report, [
        'ok', 'files', 'totalBytes', 'maxBytes', 'missing', 'forbidden', 'unexpected',
        'testHarnessMarkers',
    ])
    && report.ok === true
    && report.files === dist.files
    && report.totalBytes === dist.bytes
    && report.maxBytes === 80 * 1024 * 1024
    && ['missing', 'forbidden', 'unexpected', 'testHarnessMarkers']
        .every((key) => Array.isArray(report[key]) && report[key].length === 0)
);

const validDeploymentReceipt = (receipt, evidence) => (
    hasExactKeys(receipt, [
        'schemaVersion', 'kind', 'candidateId', 'artifactSha256', 'deploymentId', 'releaseId',
        'environment', 'uploadedAt',
    ])
    && receipt.schemaVersion === 1
    && receipt.kind === 'deployment'
    && receipt.candidateId === evidence.candidate.candidateId
    && receipt.artifactSha256 === evidence.candidate.aitSha256
    && receipt.deploymentId === evidence.deployment.deploymentId
    && receipt.releaseId === evidence.deployment.releaseId
    && receipt.environment === evidence.deployment.environment
    && receipt.uploadedAt === evidence.deployment.uploadedAt
);

const validExternalReceipt = (receipt, key, gate) => (
    hasExactKeys(receipt, [
        'schemaVersion', 'kind', 'gate', 'candidateId', 'releaseId', 'status', 'verifiedAt',
        'expiresAt', 'approverRole',
    ])
    && receipt.schemaVersion === 1
    && receipt.kind === 'external_gate'
    && receipt.gate === key
    && receipt.candidateId === gate.candidateId
    && receipt.releaseId === gate.releaseId
    && receipt.status === gate.status
    && receipt.verifiedAt === gate.verifiedAt
    && receipt.expiresAt === gate.expiresAt
    && receipt.approverRole === gate.approverRole
);

const validIssueDiscoveryReceipt = (receipt, issue, evidence) => {
    const observedAt = Date.parse(receipt?.observedAt || '');
    const linkedObservations = evidence.observations.filter((row) => issue.observationIds.includes(row.observationId));
    const linkedStart = linkedObservations.length > 0
        ? Math.min(...linkedObservations.map((row) => Date.parse(row.startedAt)))
        : null;
    const linkedEnd = linkedObservations.length > 0
        ? Math.max(...linkedObservations.map((row) => Date.parse(row.endedAt)))
        : null;
    return (
    hasExactKeys(receipt, [
        'schemaVersion', 'kind', 'issueId', 'discoveredCandidateId', 'observedAt',
    ])
    && receipt.schemaVersion === 1
    && receipt.kind === 'issue_discovery'
    && receipt.issueId === issue.issueId
    && receipt.discoveredCandidateId === issue.discoveredCandidateId
    && Number.isFinite(observedAt)
    && observedAt <= Date.parse(evidence.evaluatedAt)
    && (issue.status !== 'fixed' || observedAt <= Date.parse(issue.fixedAt))
    && (linkedStart === null || (observedAt >= linkedStart && observedAt <= linkedEnd))
    );
};

export const verifyTossReleaseFiles = async (evidence, { releaseDir, repoRoot }) => {
    const errors = [];
    try {
        const expectedReleaseDir = path.resolve(
            repoRoot,
            'docs',
            'evidence',
            'toss',
            'releases',
            evidence.candidate.candidateId,
        );
        pushMismatch(errors, path.resolve(releaseDir) === expectedReleaseDir, 'release_directory_contract_mismatch');
        pushMismatch(errors, evidence.candidate.aitPath === 'aetheria.ait', 'candidate_ait_path_invalid');
        pushMismatch(errors, evidence.candidate.distRoot === 'dist-toss', 'candidate_dist_path_invalid');
        pushMismatch(
            errors,
            evidence.candidate.verifierReportPath
                === `docs/evidence/toss/releases/${evidence.candidate.candidateId}/bundle-report.json`,
            'candidate_verifier_report_path_invalid',
        );
        const ait = await hashRegularFile(repoRoot, evidence.candidate.aitPath);
        pushMismatch(errors, ait.sha256 === evidence.candidate.aitSha256, 'candidate_ait_sha_mismatch');
        pushMismatch(errors, ait.bytes === evidence.candidate.aitBytes, 'candidate_ait_size_mismatch');

        const dist = await hashTossReleaseTree(repoRoot, evidence.candidate.distRoot);
        pushMismatch(errors, dist.sha256 === evidence.candidate.distTreeSha256, 'candidate_dist_sha_mismatch');
        pushMismatch(errors, dist.bytes === evidence.candidate.distBytes, 'candidate_dist_size_mismatch');
        const aitSources = readAitSourceRecords(await readFile(ait.target));
        pushMismatch(errors, aitSources.size === dist.files, 'candidate_ait_source_count_mismatch');
        for (const entry of dist.entries) {
            pushMismatch(
                errors,
                aitSources.get(`sources/${entry.relative}`) === entry.sha256,
                'candidate_ait_dist_binding_mismatch',
            );
        }

        const verifier = await hashRegularFile(repoRoot, evidence.candidate.verifierReportPath);
        pushMismatch(errors, verifier.sha256 === evidence.candidate.verifierReportSha256,
            'candidate_verifier_report_sha_mismatch');
        const verifierReport = JSON.parse(await readFile(verifier.target, 'utf8'));
        pushMismatch(errors, validBundleReport(verifierReport, dist), 'candidate_verifier_report_invalid');

        const deploymentReceipt = await hashRegularFile(releaseDir, evidence.deployment.receiptRef);
        pushMismatch(errors, deploymentReceipt.sha256 === evidence.deployment.receiptSha256,
            'deployment_receipt_sha_mismatch');
        pushMismatch(errors, validDeploymentReceipt(
            JSON.parse(await readFile(deploymentReceipt.target, 'utf8')),
            evidence,
        ), 'deployment_receipt_scope_mismatch');

        for (const [key, gate] of Object.entries(evidence.externalGates)) {
            if (gate.status !== 'verified' && gate.status !== 'approved') continue;
            const receipt = await hashRegularFile(releaseDir, gate.evidenceRef);
            pushMismatch(errors, receipt.sha256 === gate.evidenceSha256, `external_gate_${key}_receipt_sha_mismatch`);
            pushMismatch(errors, validExternalReceipt(
                JSON.parse(await readFile(receipt.target, 'utf8')),
                key,
                gate,
            ), `external_gate_${key}_receipt_scope_mismatch`);
        }

        for (const observation of evidence.observations) {
            for (const attachment of observation.attachments) {
                const file = await hashRegularFile(releaseDir, attachment.ref);
                pushMismatch(errors, file.sha256 === attachment.sha256, 'observation_attachment_sha_mismatch');
            }
        }

        for (const issue of evidence.issues) {
            const discovery = await hashRegularFile(releaseDir, issue.discoveryEvidenceRef);
            pushMismatch(errors, discovery.sha256 === issue.discoveryEvidenceSha256,
                'issue_discovery_evidence_sha_mismatch');
            pushMismatch(errors, validIssueDiscoveryReceipt(
                JSON.parse(await readFile(discovery.target, 'utf8')),
                issue,
                evidence,
            ), 'issue_discovery_evidence_scope_mismatch');
        }

        for (const asset of evidence.consoleAssets) {
            const file = await hashRegularFile(releaseDir, asset.path);
            const dimensions = await readPngDimensions(file.target);
            pushMismatch(errors, file.sha256 === asset.sha256, 'console_asset_sha_mismatch');
            pushMismatch(errors, dimensions.width === asset.width && dimensions.height === asset.height,
                'console_asset_dimensions_mismatch');
        }

        const [{ stdout: commit }, { stdout: tree }, { stdout: status }] = await Promise.all([
            execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }),
            execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repoRoot }),
            execFileAsync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: repoRoot }),
        ]);
        pushMismatch(errors, commit.trim() === evidence.candidate.gitCommit, 'candidate_git_commit_mismatch');
        pushMismatch(errors, tree.trim() === evidence.candidate.gitTree, 'candidate_git_tree_mismatch');
        const allowedUntrackedRoots = [
            path.resolve(repoRoot, evidence.candidate.aitPath),
            path.resolve(repoRoot, evidence.candidate.distRoot),
            path.resolve(repoRoot, evidence.candidate.verifierReportPath),
            path.resolve(releaseDir),
        ];
        const dirtyEntries = status.split('\0').filter(Boolean).filter((entry) => {
            if (!entry.startsWith('?? ')) return true;
            const absolute = path.resolve(repoRoot, entry.slice(3));
            return !allowedUntrackedRoots.some((allowed) => isWithin(allowed, absolute));
        });
        pushMismatch(errors, dirtyEntries.length === 0 && evidence.candidate.cleanTree === true,
            'candidate_git_tree_dirty');
    } catch (error) {
        errors.push(`release_file_verification_failed:${error.message}`);
    }
    return { ok: errors.length === 0, errors: [...new Set(errors)] };
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (!args['release-dir'] || !args.phase) {
        throw new Error('Usage: --release-dir <path> --phase sandbox|private-qr|review|public|ad-activation');
    }
    const releaseDir = path.resolve(args['release-dir']);
    const evidence = await loadTossReleaseEvidence(releaseDir);
    const gate = evaluateTossReleaseGate(evidence, args.phase);
    const files = gate.ok
        ? await verifyTossReleaseFiles(evidence, { releaseDir, repoRoot: process.cwd() })
        : { ok: false, errors: ['schema_or_phase_gate_failed'] };
    const result = {
        ok: gate.ok && files.ok,
        phase: args.phase,
        blockers: [...gate.blockers, ...files.errors],
        releaseDir,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
