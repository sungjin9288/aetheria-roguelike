import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    buildProgressionDiagnostic,
    simulateProgression,
} from '../src/systems/progressionSimulator.ts';

const ROOT = process.cwd();
const CODE_POINT_COMPARE = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const HASH_ALGORITHM = 'sha256';
const PROGRESSION_V1_BASELINE_HASH = 'd39dce20512a279d0525c403d99a5534345ca506aaa05e5fb2a0ae06eb09a17c';

export const PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH =
    'docs/evidence/qa/release-complete-core/progression-diagnostic-v2.json';
export const PROGRESSION_DIAGNOSTIC_FOCUSED_SEEDS = Object.freeze(
    Array.from({ length: 64 }, (_, index) => 20_260_824 + index),
);
export const PROGRESSION_DIAGNOSTIC_COMPARISON_SEEDS = Object.freeze(
    Array.from({ length: 1_000 }, (_, index) => 20_260_824 + index),
);

const hash = (value) => createHash(HASH_ALGORITHM).update(value).digest('hex');

const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value)
            .sort(CODE_POINT_COMPARE)
            .map((key) => [key, canonicalize(value[key])]),
    );
};

export const canonicalJson = (value) => `${JSON.stringify(canonicalize(value))}\n`;

const parseArgs = (args) => {
    if (args.length !== 2) throw new Error('exactly one evidence operation and path are required');
    const [mode, relativePath] = args;
    if (mode !== '--write' && mode !== '--verify') {
        throw new Error(`unknown evidence mode: ${String(mode)}`);
    }
    if (path.isAbsolute(relativePath)) throw new Error('absolute evidence paths are forbidden');
    if (relativePath.includes('\\')) throw new Error('backslash evidence paths are forbidden');
    const segments = relativePath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error('dot or traversal evidence paths are forbidden');
    }
    if (relativePath !== PROGRESSION_DIAGNOSTIC_EVIDENCE_PATH) {
        throw new Error(`unknown evidence path: ${relativePath}`);
    }
    return { mode, relativePath, absolutePath: path.join(ROOT, relativePath) };
};

const assertNoSymlinkPath = async (relativePath, allowMissingLeaf) => {
    const root = await lstat(ROOT);
    if (root.isSymbolicLink()) throw new Error('symlink repository root is forbidden');
    let current = ROOT;
    for (const segment of relativePath.split('/')) {
        current = path.join(current, segment);
        try {
            const stat = await lstat(current);
            if (stat.isSymbolicLink()) throw new Error(`symlink evidence path is forbidden: ${relativePath}`);
        } catch (error) {
            if (allowMissingLeaf && current === path.join(ROOT, relativePath) && error?.code === 'ENOENT') return;
            throw error;
        }
    }
};

const collectSourcePaths = async () => {
    const collected = [
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'scripts/progression-diagnostic-evidence.mjs',
        'scripts/simulate-progression-diagnostic.mjs',
        'tests/combat-loot-capacity-authority.test.js',
        'tests/combat-engine-loot.test.js',
        'tests/normal-loot-tier.test.js',
        'tests/library-loot.test.js',
        'tests/exploration-rhythm.test.js',
        'tests/progression-comparison.test.js',
        'tests/progression-diagnostic-cli.test.js',
        'tests/progression-diagnostic.test.js',
        'tests/progression-simulator.test.js',
    ];
    const visit = async (relativeDirectory) => {
        const absoluteDirectory = path.join(ROOT, relativeDirectory);
        const entries = await readdir(absoluteDirectory, { withFileTypes: true });
        entries.sort((left, right) => CODE_POINT_COMPARE(left.name, right.name));
        for (const entry of entries) {
            const relativePath = `${relativeDirectory}/${entry.name}`;
            const stat = await lstat(path.join(ROOT, relativePath));
            if (stat.isSymbolicLink()) throw new Error(`symlink source path is forbidden: ${relativePath}`);
            if (stat.isDirectory()) {
                await visit(relativePath);
            } else if (stat.isFile() && /\.(?:js|json|ts|tsx)$/.test(entry.name)) {
                collected.push(relativePath);
            }
        }
    };
    await visit('src');
    return [...new Set(collected)].sort(CODE_POINT_COMPARE);
};

const buildSourceManifest = async () => {
    const paths = await collectSourcePaths();
    return Promise.all(paths.map(async (relativePath) => ({
        path: relativePath,
        sha256: hash(await readFile(path.join(ROOT, relativePath))),
    })));
};

const assertReport = (report) => {
    const combatCohorts = report.combat.jobs.flatMap(({ cohorts }) => cohorts);
    if (report.schemaVersion !== 2
        || report.actualPlayClaim
        || report.activationReady
        || report.hardErrors.length > 0
        || report.combat.jobs.length !== 18
        || combatCohorts.length !== 72
        || combatCohorts.some(({ truncated }) => truncated !== 0)
        || report.loot.capacityPressure.full.capacityBlockedDrops <= 0
        || report.loot.capacityPressure.full.blockedBossSignatures <= 0
        || report.loot.capacityPressure.oneSlot.admittedBossSignatures <= 0
        || report.loot.capacityPressure.oneSlot.pityResets <= 0
        || report.loot.capacityPressure.full.pityIncrements <= 0) {
        throw new Error('PROGRESSION_DIAGNOSTIC_HARD_GATE_FAILED');
    }
};

export const buildProgressionDiagnosticEvidence = async () => {
    const sourcesBefore = await buildSourceManifest();
    const report = buildProgressionDiagnostic({
        focusedSeeds: PROGRESSION_DIAGNOSTIC_FOCUSED_SEEDS,
        comparisonSeeds: PROGRESSION_DIAGNOSTIC_COMPARISON_SEEDS,
        maxCombatTurns: 200,
    });
    assertReport(report);
    const v1Report = simulateProgression({ seed: 20_260_824 });
    const v1BaselineHash = hash(JSON.stringify(v1Report));
    if (v1BaselineHash !== PROGRESSION_V1_BASELINE_HASH) {
        throw new Error('PROGRESSION_SCHEMA_V1_BASELINE_DRIFT');
    }
    const sourcesAfter = await buildSourceManifest();
    if (JSON.stringify(sourcesAfter) !== JSON.stringify(sourcesBefore)) {
        throw new Error('SOURCE_MANIFEST_CHANGED_DURING_DIAGNOSTIC');
    }
    return canonicalize({
        schemaVersion: 2,
        classification: 'deterministic-production-path-diagnostic',
        hashAlgorithm: HASH_ALGORITHM,
        sourceManifestVersion: 3,
        seedPolicy: {
            focused: { start: PROGRESSION_DIAGNOSTIC_FOCUSED_SEEDS[0], count: PROGRESSION_DIAGNOSTIC_FOCUSED_SEEDS.length },
            comparison: { start: PROGRESSION_DIAGNOSTIC_COMPARISON_SEEDS[0], count: PROGRESSION_DIAGNOSTIC_COMPARISON_SEEDS.length },
        },
        v1Baseline: { seed: 20_260_824, reportHash: v1BaselineHash },
        reportHash: hash(canonicalJson(report)),
        sources: sourcesAfter,
        report,
    });
};

export const verifyEvidenceBytes = (actual, expected) => {
    if (!Buffer.from(actual).equals(Buffer.from(expected))) throw new Error('EVIDENCE_BYTE_MISMATCH');
};

const writeAtomically = async (absolutePath, bytes) => {
    const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
    try {
        await writeFile(temporaryPath, bytes, { flag: 'wx' });
        await rename(temporaryPath, absolutePath);
    } finally {
        await unlink(temporaryPath).catch((error) => {
            if (error?.code !== 'ENOENT') throw error;
        });
    }
};

const main = async () => {
    const target = parseArgs(process.argv.slice(2));
    await assertNoSymlinkPath(target.relativePath, target.mode === '--write');
    const expected = Buffer.from(canonicalJson(await buildProgressionDiagnosticEvidence()));
    if (target.mode === '--verify') {
        verifyEvidenceBytes(await readFile(target.absolutePath), expected);
        process.stdout.write(`progression diagnostic evidence verified: ${hash(expected)}\n`);
        return;
    }
    await writeAtomically(target.absolutePath, expected);
    process.stdout.write(`progression diagnostic evidence written: ${hash(expected)}\n`);
};

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
