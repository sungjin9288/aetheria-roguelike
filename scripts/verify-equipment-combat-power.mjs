import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const EVIDENCE_PATH = 'docs/evidence/qa/release-complete-core/equipment-combat-power.json';
const SOURCE_PATHS = Object.freeze({
    audit: 'src/systems/equipmentCombatPowerAudit.ts',
    classes: 'src/data/classes.ts',
    tier: 'src/data/constants.ts',
    signatureRegistry: 'src/data/signatureRegistry.json',
    signatureSets: 'src/data/signatureSets.json',
    buildClassVitals: 'src/hooks/gameActions/_shared.ts',
    calculateFullStats: 'src/utils/statsCalculator.ts',
    equipmentProfile: 'src/utils/equipmentUtils.ts',
    enemyEvasion: 'src/systems/CombatEngine.enemyAI.ts',
    signatureSetBonus: 'src/utils/signatureSetBonus.ts',
});
const EXPECTED_DOMINANCE_PAIRS = Object.freeze([]);
const EXPECTED_REPLAN_COHORTS = Object.freeze([]);
const EXPECTED_CLASSIFICATION_COUNTS = Object.freeze({
    'combat-power-defect': 0,
    'in-corridor': 154,
    intentional: 16,
    'price-only-defect': 9,
    'specialized-sidegrade': 50,
});

const stableCanonicalize = (value) => {
    if (Array.isArray(value)) return value.map(stableCanonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value)
            .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
            .map((key) => [key, stableCanonicalize(value[key])]),
    );
};

const hash = (value) => createHash('sha256').update(value).digest('hex');
const hashJson = (value) => hash(JSON.stringify(stableCanonicalize(value)));
const buildReport = () => JSON.parse(execFileSync(process.execPath, [
    '--import', 'tsx', '--input-type=module', '--eval',
    "import { buildEquipmentCombatPowerReport } from './src/systems/equipmentCombatPowerAudit.ts'; process.stdout.write(JSON.stringify(buildEquipmentCombatPowerReport()));",
], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));

const parseArgs = (args) => {
    if (args.length !== 2) throw new Error('exactly one evidence operation and path are required');
    const [mode, relativePath] = args;
    if (mode !== '--write' && mode !== '--verify') throw new Error(`unknown evidence mode: ${String(mode)}`);
    if (!relativePath) throw new Error('missing evidence path');
    if (path.isAbsolute(relativePath)) throw new Error('absolute evidence paths are forbidden');
    if (relativePath.includes('\\')) throw new Error('backslash evidence paths are forbidden');
    const segments = relativePath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error('dot or traversal evidence paths are forbidden');
    }
    if (relativePath !== EVIDENCE_PATH) throw new Error(`unknown evidence path: ${relativePath}`);
    return { mode, relativePath, absolutePath: path.join(ROOT, relativePath) };
};

const assertNoSymlinkPath = async (relativePath, allowMissingLeaf) => {
    const root = await lstat(ROOT);
    if (root.isSymbolicLink()) throw new Error('symlink evidence root is forbidden');
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

const sourceHash = async (relativePath) => hash(await readFile(path.join(ROOT, relativePath)));

const sourceSnapshot = () => {
    try {
        return { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() };
    } catch {
        return { head: null };
    }
};

const buildEvidence = async () => {
    const report = buildReport();
    if (!report.ok || report.errors.length > 0) {
        throw new Error(`equipment combat-power report has errors: ${report.errors.join(', ')}`);
    }
    const livePairs = report.dominancePairs.map((pair) => [
        pair.candidate.name,
        pair.dominator.name,
        pair.cohort,
    ]);
    if (JSON.stringify(livePairs) !== JSON.stringify(EXPECTED_DOMINANCE_PAIRS)) {
        throw new Error(`unexpected equipment dominance pairs: ${JSON.stringify(livePairs)}`);
    }
    if (JSON.stringify(report.replanCohorts) !== JSON.stringify(EXPECTED_REPLAN_COHORTS)) {
        throw new Error(`unexpected equipment replan cohorts: ${JSON.stringify(report.replanCohorts)}`);
    }
    if (report.requiresReplan || report.combatPowerDefects.length > 0) {
        throw new Error('equipment combat-power defects require replan');
    }
    if (JSON.stringify(report.classificationCounts) !== JSON.stringify(EXPECTED_CLASSIFICATION_COUNTS)) {
        throw new Error(`unexpected equipment classification counts: ${JSON.stringify(report.classificationCounts)}`);
    }
    const strictDominators = report.rows.map((row) => ({
        type: row.type,
        name: row.name,
        strictDominators: row.strictDominators,
    }));
    const authority = {
        catalogHash: hashJson(report.catalog.canonicalRows),
        classesHash: await sourceHash(SOURCE_PATHS.classes),
        tierHash: await sourceHash(SOURCE_PATHS.tier),
        signatureRegistryHash: await sourceHash(SOURCE_PATHS.signatureRegistry),
        signatureSetHash: await sourceHash(SOURCE_PATHS.signatureSets),
        productionOwners: {
            buildClassVitals: await sourceHash(SOURCE_PATHS.buildClassVitals),
            calculateFullStats: await sourceHash(SOURCE_PATHS.calculateFullStats),
            equipmentProfile: await sourceHash(SOURCE_PATHS.equipmentProfile),
            enemyEvasion: await sourceHash(SOURCE_PATHS.enemyEvasion),
            signatureSetBonus: await sourceHash(SOURCE_PATHS.signatureSetBonus),
        },
        auditSourceHash: await sourceHash(SOURCE_PATHS.audit),
        strictDominatorsHash: hashJson(strictDominators),
        dominancePairsHash: hashJson(report.dominancePairs),
    };
    return stableCanonicalize({
        schemaVersion: 2,
        policyVersion: report.policyVersion,
        sourceSnapshot: sourceSnapshot(),
        authority,
        reportHash: hashJson(report),
        rowsHash: hashJson(report.rows),
        classificationCounts: report.classificationCounts,
        outliers: report.outliers,
        combatPowerDefects: report.combatPowerDefects,
        strictDominators,
        dominancePairs: report.dominancePairs,
        requiresReplan: report.requiresReplan,
        replanCohorts: report.replanCohorts,
        report,
    });
};

const serialize = (evidence) => `${JSON.stringify(evidence)}\n`;

const writeAtomically = async (absolutePath, bytes) => {
    const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, bytes, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, absolutePath);
};

const main = async () => {
    const parsed = parseArgs(process.argv.slice(2));
    await assertNoSymlinkPath(parsed.relativePath, parsed.mode === '--write');
    const bytes = serialize(await buildEvidence());
    if (parsed.mode === '--verify') {
        const existing = await readFile(parsed.absolutePath, 'utf8');
        if (existing !== bytes) throw new Error('evidence bytes mismatch');
        process.stdout.write(`equipment combat-power evidence verified: ${hash(bytes)}\n`);
        return;
    }
    await writeAtomically(parsed.absolutePath, bytes);
    process.stdout.write(`equipment combat-power evidence written: ${hash(bytes)}\n`);
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
