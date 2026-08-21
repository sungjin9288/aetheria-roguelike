#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'tsx/esm';

const OUTPUT_ROOT = 'docs/evidence/qa/release-complete-core';
const MODES = new Set(['--write', '--verify']);
const SEEDS = Object.freeze(Array.from({ length: 64 }, (_, index) => 20_260_810 + index));
const AUTHORITY_PATHS = Object.freeze({
    combatExp: 'src/systems/CombatEngine.outcome.ts',
    combatLoot: 'src/systems/CombatEngine.loot.ts',
    eventReward: 'src/hooks/gameActions/eventActions.ts',
    progressionProfile: 'src/data/progressionProfiles.ts',
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

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

const buildEvidence = async (root) => {
    const { RELICS } = await import('../src/data/relics.ts');
    const {
        buildRelicEventChanceReport,
        canonicalizeRelicEventChanceReport,
    } = await import('../src/systems/relicEventChanceAudit.ts');
    const exploreActionsSource = await readFile(path.join(root, 'src/hooks/gameActions/exploreActions.ts'), 'utf8');
    const report = buildRelicEventChanceReport({
        relics: RELICS,
        seeds: SEEDS,
        exploreActionsSource,
    });
    if (report.errors.length > 0) {
        throw new Error(`RELIC_EVENT_CHANCE_ERRORS:${report.errors.join('|')}`);
    }
    const authorityHashes = Object.fromEntries(await Promise.all(
        Object.entries(AUTHORITY_PATHS).map(async ([key, relativePath]) => [
            key,
            sha256(await readFile(path.join(root, relativePath))),
        ]),
    ));
    const canonicalReport = canonicalizeRelicEventChanceReport(report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    const reportHash = sha256(reportBytes);
    const evidenceBytes = Buffer.from(`${JSON.stringify({
        hashAlgorithm: 'sha256',
        reportHash,
        authorityHashes,
        report: canonicalReport,
    }, null, 2)}\n`, 'utf8');
    return { reportHash, evidenceBytes };
};

const main = async () => {
    const root = process.cwd();
    const { mode, outputPath } = parseArguments(process.argv.slice(2));
    const resolvedOutput = await resolveOutputPath(root, outputPath);
    const { reportHash, evidenceBytes } = await buildEvidence(root);

    if (mode === '--write') {
        await writeFile(resolvedOutput, evidenceBytes, { flag: 'w' });
        process.stdout.write(`relic-event-chance write ok: seeds=64 errors=0 sha256=${reportHash}\n`);
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
    process.stdout.write(`relic-event-chance verify ok: seeds=64 errors=0 sha256=${reportHash}\n`);
};

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'RELIC_EVENT_CHANCE_VERIFY_FAILED'}\n`);
    process.exitCode = 1;
});
