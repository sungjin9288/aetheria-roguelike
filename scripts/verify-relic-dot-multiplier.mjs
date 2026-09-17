#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'tsx/esm';

const OUTPUT_ROOT = 'docs/evidence/qa/release-complete-core';
const MODES = new Set(['--write', '--verify']);
const SOURCE_PATHS = [
    'src/data/relics.ts',
    'src/systems/CombatEngine.actions.ts',
    'src/systems/relicDotMultiplierAudit.ts',
    'src/utils/dataMigration.ts',
    'src/reducers/handlers/combatHandlers.ts',
    'tests/relic-dot-multiplier-coherence.test.js',
    'scripts/verify-relic-dot-multiplier.mjs',
    'docs/superpowers/plans/2026-08-17-aetheria-relic-dot-multiplier-plan.md',
];

const parseArguments = (argv) => {
    const unknown = argv.find((argument) => argument.startsWith('--') && !MODES.has(argument));
    if (unknown) throw new Error(`UNKNOWN_ARGUMENT:${unknown}`);
    const modes = argv.filter((argument) => MODES.has(argument));
    if (modes.length !== 1) throw new Error('INVALID_MODE_ARGUMENT');
    if (argv.length !== 2 || argv[0] !== modes[0]) throw new Error('INVALID_ARGUMENTS');
    return { mode: modes[0], outputPath: argv[1] };
};

const resolveOutputPath = async (root, outputPath) => {
    if (typeof outputPath !== 'string'
        || outputPath.length === 0
        || outputPath.includes('\\')
        || path.isAbsolute(outputPath)) {
        throw new Error('INVALID_OUTPUT_PATH');
    }
    const segments = outputPath.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        throw new Error('INVALID_OUTPUT_PATH');
    }

    const outputRoot = path.resolve(root, OUTPUT_ROOT);
    const resolved = path.resolve(root, outputPath);
    if (!resolved.startsWith(`${outputRoot}${path.sep}`) || path.extname(resolved) !== '.json') {
        throw new Error('INVALID_OUTPUT_PATH');
    }

    let current = root;
    for (const segment of segments) {
        current = path.join(current, segment);
        try {
            const stat = await lstat(current);
            if (stat.isSymbolicLink()) throw new Error('SYMLINK_OUTPUT_PATH');
        } catch (error) {
            if (error?.code === 'ENOENT') continue;
            throw error;
        }
    }
    return resolved;
};

const hashSources = async (root) => Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async (relativePath) => {
    const bytes = await readFile(path.join(root, relativePath));
    return [relativePath, createHash('sha256').update(bytes).digest('hex')];
})));

const buildEvidence = async (root) => {
    const {
        buildRelicDotMultiplierReport,
        canonicalizeRelicDotMultiplierReport,
    } = await import('../src/systems/relicDotMultiplierAudit.ts');
    const report = buildRelicDotMultiplierReport();
    if (report.errors.length > 0) {
        throw new Error(`RELIC_DOT_MULTIPLIER_ERRORS:${report.errors.join('|')}`);
    }
    const canonicalReport = canonicalizeRelicDotMultiplierReport(report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    const reportHash = createHash('sha256').update(reportBytes).digest('hex');
    const sourceHashes = await hashSources(root);
    const evidenceBytes = Buffer.from(`${JSON.stringify({
        hashAlgorithm: 'sha256',
        reportHash,
        sourceHashes,
        report: canonicalReport,
    }, null, 2)}\n`, 'utf8');
    return { reportHash, sourceHashes, evidenceBytes };
};

const main = async () => {
    const root = process.cwd();
    const { mode, outputPath } = parseArguments(process.argv.slice(2));
    const resolvedOutput = await resolveOutputPath(root, outputPath);
    const { reportHash, sourceHashes, evidenceBytes } = await buildEvidence(root);

    if (mode === '--write') {
        await writeFile(resolvedOutput, evidenceBytes, { flag: 'w' });
        process.stdout.write(`relic-dot-multiplier write ok: vectors=10 malformed=5 sha256=${reportHash} sources=${Object.keys(sourceHashes).length}\n`);
        return;
    }

    let currentBytes;
    try {
        currentBytes = await readFile(resolvedOutput);
    } catch (error) {
        if (error?.code === 'ENOENT') throw new Error('EVIDENCE_NOT_FOUND');
        throw error;
    }
    if (!currentBytes.equals(evidenceBytes)) throw new Error('EVIDENCE_BYTE_MISMATCH');
    process.stdout.write(`relic-dot-multiplier verify ok: vectors=10 malformed=5 sha256=${reportHash} sources=${Object.keys(sourceHashes).length}\n`);
};

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'RELIC_DOT_MULTIPLIER_VERIFY_FAILED'}\n`);
    process.exitCode = 1;
});
