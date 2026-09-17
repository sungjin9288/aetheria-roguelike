import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH,
    canonicalJson,
    verifyEvidenceBytes,
} from '../scripts/progression-diagnostic-evidence.mjs';

const run = (script, args = []) => spawnSync(
    process.execPath,
    ['--import', 'tsx', script, ...args],
    { cwd: process.cwd(), encoding: 'utf8' },
);

test('package exposes deterministic progression diagnostic commands', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    assert.equal(pkg.scripts['progression:diagnose'], 'node --import tsx scripts/simulate-progression-diagnostic.mjs');
    assert.equal(
        pkg.scripts['progression:diagnostic:verify'],
        `node --import tsx scripts/progression-diagnostic-evidence.mjs --verify ${PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH}`,
    );
});

test('diagnostic CLIs reject unknown, duplicate, and unsafe arguments before simulation', () => {
    for (const args of [
        ['--verify', '../outside.json'],
        ['--verify', PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH, '--verify', PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH],
        ['--unknown', PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH],
    ]) {
        const result = run('scripts/progression-diagnostic-evidence.mjs', args);
        assert.notEqual(result.status, 0);
    }
    const diagnose = run('scripts/simulate-progression-diagnostic.mjs', ['--seed', '1']);
    assert.notEqual(diagnose.status, 0);
});

test('canonical serializer is key-ordered and evidence verification fails closed', () => {
    assert.equal(canonicalJson({ z: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"z":1}\n');
    const expected = Buffer.from('{"ok":true}\n');
    assert.throws(
        () => verifyEvidenceBytes(Buffer.from('{"ok":false}\n'), expected),
        /EVIDENCE_BYTE_MISMATCH/,
    );
});

test('tracked evidence is canonical, source-bound, and verify mode is read-only', async () => {
    const before = await readFile(PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH);
    const evidence = JSON.parse(before.toString('utf8'));
    const paths = evidence.sources.map(({ path }) => path);

    assert.equal(evidence.schemaVersion, 2);
    assert.equal(evidence.sourceManifestVersion, 3);
    assert.deepEqual(paths, [...new Set(paths)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
    assert.equal(evidence.sources.every(({ path, sha256 }) => (
        !path.startsWith('/') && /^[a-f0-9]{64}$/.test(sha256)
    )), true);
    for (const requiredPath of [
        'package-lock.json',
        'tsconfig.json',
        'tests/progression-diagnostic.test.js',
        'tests/progression-diagnostic-cli.test.js',
    ]) {
        assert.ok(paths.includes(requiredPath));
    }
    assert.equal(canonicalJson(evidence), before.toString('utf8'));
    assert.equal(Object.hasOwn(evidence, 'gitHead'), false);
    assert.equal(Object.hasOwn(evidence, 'generatedAt'), false);

    const result = run('scripts/progression-diagnostic-evidence.mjs', [
        '--verify',
        PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const after = await readFile(PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH);
    assert.equal(createHash('sha256').update(after).digest('hex'), createHash('sha256').update(before).digest('hex'));
});
