#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_ROOT = 'docs/evidence/qa/release-complete-core';
const MODES = new Set(['--write', '--verify']);

const parseArguments = (argv) => {
    if (argv.length !== 2 || !MODES.has(argv[0])) throw new Error('INVALID_ARGUMENTS');
    return { mode: argv[0], outputPath: argv[1] };
};

const resolveOutputPath = async (root, outputPath) => {
    if (typeof outputPath !== 'string'
        || outputPath.length === 0
        || outputPath.includes('\\')
        || path.isAbsolute(outputPath)) throw new Error('INVALID_OUTPUT_PATH');
    const segments = outputPath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
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
            if ((await lstat(current)).isSymbolicLink()) throw new Error('SYMLINK_OUTPUT_PATH');
        } catch (error) {
            if (error?.code === 'ENOENT') continue;
            throw error;
        }
    }
    return resolved;
};

const buildEvidence = async () => {
    const { BALANCE } = await import('../src/data/constants.ts');
    const { DB } = await import('../src/data/db.ts');
    const { EVENT_CHAINS } = await import('../src/data/eventChains.ts');
    const { BOUNDED_ENCOUNTERS } = await import('../src/data/boundedEncounters.ts');
    const { RELICS } = await import('../src/data/relics.ts');
    const { STRUCTURED_FALLBACK_TRANSACTIONS } = await import('../src/data/structuredFallbackEvents.ts');
    const { EXPLORATION_RHYTHM_PROFILE } = await import('../src/data/progressionProfiles.ts');
    const { buildCampfireEvent } = await import('../src/utils/campfireEvent.ts');
    const { buildScoutEvent } = await import('../src/utils/scoutEvents.ts');
    const {
        buildEventRewardCoherenceReport,
        canonicalizeEventRewardCoherenceReport,
    } = await import('../src/systems/eventRewardCoherenceAudit.ts');

    const report = canonicalizeEventRewardCoherenceReport(buildEventRewardCoherenceReport({
        chains: EVENT_CHAINS,
        boundedEncounters: BOUNDED_ENCOUNTERS,
        fallbackTransactions: STRUCTURED_FALLBACK_TRANSACTIONS,
        campfireEvent: buildCampfireEvent({ maxHp: 200, maxMp: 100 }),
        scoutEvent: buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99),
        maps: DB.MAPS,
        items: DB.ITEMS,
        relics: RELICS,
        frequency: {
            scoutChance: BALANCE.SCOUT_CHANCE,
            campfireChance: BALANCE.CAMPFIRE_CHANCE,
            eventMultiplier: EXPLORATION_RHYTHM_PROFILE.eventMultiplier,
            minimumNarrativeGap: 1,
        },
    }));
    if (report.errors.length > 0) throw new Error(`EVENT_REWARD_ERRORS:${report.errors.join('|')}`);

    const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const reportHash = createHash('sha256').update(reportBytes).digest('hex');
    return {
        bytes: Buffer.from(`${JSON.stringify({
            hashAlgorithm: 'sha256',
            reportHash,
            report,
        }, null, 2)}\n`, 'utf8'),
        report,
        reportHash,
    };
};

const main = async () => {
    const root = process.cwd();
    const { mode, outputPath } = parseArguments(process.argv.slice(2));
    const resolvedOutput = await resolveOutputPath(root, outputPath);
    const evidence = await buildEvidence();
    if (mode === '--write') {
        await writeFile(resolvedOutput, evidence.bytes, { flag: 'w' });
        process.stdout.write(
            `event-reward write ok: rows=${evidence.report.rows.length} errors=0 sha256=${evidence.reportHash}\n`,
        );
        return;
    }
    let current;
    try {
        current = await readFile(resolvedOutput);
    } catch (error) {
        if (error?.code === 'ENOENT') throw new Error('EVIDENCE_NOT_FOUND');
        throw error;
    }
    if (!current.equals(evidence.bytes)) throw new Error('EVIDENCE_BYTE_MISMATCH');
    process.stdout.write(
        `event-reward verify ok: rows=${evidence.report.rows.length} errors=0 sha256=${evidence.reportHash}\n`,
    );
};

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'EVENT_REWARD_VERIFY_FAILED'}\n`);
    process.exitCode = 1;
});
