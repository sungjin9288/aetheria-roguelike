import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compareExplorationRhythm } from '../src/systems/explorationRhythmSimulator.ts';
import { simulateProgressionComparison } from '../src/systems/progressionSimulator.ts';
import {
    BASELINE_PROGRESSION_PROFILE,
    EXPLORATION_RHYTHM_PROFILE,
} from '../src/data/progressionProfiles.ts';

const ROOT = process.cwd();
const EVIDENCE_ROOT = 'docs/evidence/qa/release-complete-core';

const parseTarget = (mode, relativePath) => {
    if (!mode || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('\\')) throw new Error('usage: --seed-start N --seed-count N --write|--verify <safe .json path>');
    const segments = relativePath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('evidence path contains unsafe segments');
    if (!relativePath.startsWith(`${EVIDENCE_ROOT}/`) || !relativePath.endsWith('.json')) throw new Error('evidence path is outside the canonical evidence folder');
    return { mode, relativePath, absolutePath: path.join(ROOT, relativePath) };
};

const parseInteger = (value, label) => {
    if (!/^\d+$/.test(String(value || ''))) throw new Error(`${label} must be an integer`);
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error(`${label} must be a safe integer`);
    return number;
};

const parseArgs = (args) => {
    if (args.length !== 6) throw new Error('usage: --seed-start N --seed-count N --write|--verify <safe .json path>');
    const values = new Map();
    for (let index = 0; index < args.length; index += 2) {
        const flag = args[index];
        const value = args[index + 1];
        if (!['--seed-start', '--seed-count', '--write', '--verify'].includes(flag)
            || values.has(flag)) throw new Error(`unknown or duplicate argument: ${flag}`);
        values.set(flag, value);
    }
    const modes = ['--write', '--verify'].filter((flag) => values.has(flag));
    if (!values.has('--seed-start') || !values.has('--seed-count') || modes.length !== 1) {
        throw new Error('usage: --seed-start N --seed-count N --write|--verify <safe .json path>');
    }
    return {
        seedStart: parseInteger(values.get('--seed-start'), '--seed-start'),
        seedCount: parseInteger(values.get('--seed-count'), '--seed-count'),
        target: parseTarget(modes[0], values.get(modes[0])),
    };
};

const progressionEvidenceFor = (seedStart, seedCount) => {
    const seeds = Array.from({ length: seedCount }, (_, index) => seedStart + index);
    const report = simulateProgressionComparison({
        seeds,
        predecessorProfile: BASELINE_PROGRESSION_PROFILE,
        candidateProfile: EXPLORATION_RHYTHM_PROFILE,
        declaredAxis: 'event',
    });
    const expectedBlockers = ['production_funnel_evidence_missing', 'full_combat_model_unavailable'];
    if (!report.gates.profileTransition
        || !report.gates.hardCorrectness
        || !report.gates.targetMetricDirection.matched
        || report.correctness.combatMatrixTruncatedCount !== 0
        || report.activationReady
        || JSON.stringify(report.blockers) !== JSON.stringify(expectedBlockers)) {
        throw new Error(`progression evidence failed for ${seedCount} seeds`);
    }
    return {
        seedStart,
        seedCount,
        reportHash: createHash('sha256').update(JSON.stringify(report)).digest('hex'),
    };
};

const main = async () => {
    const { seedStart, seedCount, target } = parseArgs(process.argv.slice(2));
    if (seedCount < 2 || seedCount > 1_000 || seedStart > 0xffffffff || seedStart + seedCount - 1 > 0xffffffff) throw new Error('seed range must remain within 2 to 1000 uint32 seeds');
    const seeds = Array.from({ length: seedCount }, (_, index) => seedStart + index);
    const report = compareExplorationRhythm(seeds);
    if (!Object.values(report.gates).every(Boolean) || report.blockers.length > 0) throw new Error('exploration rhythm gates did not pass');
    const reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
    const progressionEvidence = {
        candidateProfile: EXPLORATION_RHYTHM_PROFILE,
        focused: progressionEvidenceFor(20_260_810, 64),
        full: progressionEvidenceFor(20_260_810, 1_000),
    };
    const envelope = {
        hashAlgorithm: 'sha256',
        reportHash,
        progressionEvidence,
        report,
    };
    const expected = `${JSON.stringify(envelope, null, 2)}\n`;
    if (target.mode === '--write') await writeFile(target.absolutePath, expected, 'utf8');
    else if (await readFile(target.absolutePath, 'utf8') !== expected) throw new Error(`stale or malformed evidence: ${target.relativePath}`);
    console.log(JSON.stringify({ hashAlgorithm: 'sha256', reportHash }));
};

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
