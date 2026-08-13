import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    buildEquipmentEconomyReport,
    EQUIPMENT_ECONOMY_CANDIDATE_DIGEST,
    EQUIPMENT_ECONOMY_PREDECESSOR_DIGEST,
    EQUIPMENT_ECONOMY_PRICE_REMOVED_INVARIANT,
    stableCanonicalize,
} from '../src/systems/equipmentEconomyAudit.ts';

const ROOT = process.cwd();
const EVIDENCE_ROOT = 'docs/evidence/qa/release-complete-core';
const EVIDENCE_PATH = `${EVIDENCE_ROOT}/equipment-economy.json`;

const fail = (message) => {
    console.error(message);
    process.exitCode = 1;
};

const parseArgs = (args) => {
    const optionTokens = args.filter((arg) => arg.startsWith('--'));
    const modes = optionTokens.filter((arg) => arg === '--write' || arg === '--verify');
    const unknown = optionTokens.filter((arg) => arg !== '--write' && arg !== '--verify');
    if (unknown.length > 0) throw new Error(`unknown evidence mode: ${unknown[0]}`);
    if (modes.length !== 1) {
        if (modes.length > 1) throw new Error('duplicate evidence mode is not allowed');
        throw new Error('exactly one --write or --verify mode is required');
    }
    if (args.length !== 2) throw new Error('exactly one evidence operation and path are required');

    const [mode, relativePath] = args;
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
    const rootStat = await lstat(ROOT);
    if (rootStat.isSymbolicLink()) throw new Error('symlink evidence root is forbidden');
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

const hashJson = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const priceRemovedRows = (rows) => rows.map((row) => {
    const { price: _price, ...rest } = row;
    return stableCanonicalize(rest);
});

const buildEvidence = () => {
    const report = buildEquipmentEconomyReport();
    if (report.errors.length > 0) throw new Error(`equipment economy report has errors: ${report.errors.join(', ')}`);

    const predecessorDigest = hashJson(report.predecessorCanonicalRows);
    const candidateDigest = hashJson(report.candidateCanonicalRows);
    const priceRemovedInvariantDigest = hashJson(priceRemovedRows(report.candidateCanonicalRows));
    if (predecessorDigest !== EQUIPMENT_ECONOMY_PREDECESSOR_DIGEST) {
        throw new Error(`predecessor digest mismatch: ${predecessorDigest}`);
    }
    if (candidateDigest !== EQUIPMENT_ECONOMY_CANDIDATE_DIGEST) {
        throw new Error(`candidate digest mismatch: ${candidateDigest}`);
    }
    if (priceRemovedInvariantDigest !== EQUIPMENT_ECONOMY_PRICE_REMOVED_INVARIANT) {
        throw new Error(`price-removed invariant mismatch: ${priceRemovedInvariantDigest}`);
    }

    return {
        hashAlgorithm: 'sha256',
        hashes: {
            predecessorDigest,
            candidateDigest,
            priceRemovedInvariantDigest,
            reportDigest: hashJson(report),
        },
        report,
    };
};

const main = async () => {
    const target = parseArgs(process.argv.slice(2));
    const evidence = buildEvidence();
    const expected = `${JSON.stringify(evidence, null, 2)}\n`;

    await assertNoSymlinkPath(target.relativePath, target.mode === '--write');
    if (target.mode === '--write') {
        await writeFile(target.absolutePath, expected, 'utf8');
        console.log(`equipment economy evidence written sha256=${evidence.hashes.reportDigest}`);
        return;
    }
    if (await readFile(target.absolutePath, 'utf8') !== expected) {
        throw new Error(`stale or malformed equipment economy evidence: ${target.relativePath}`);
    }
    console.log(`equipment economy evidence verified sha256=${evidence.hashes.reportDigest}`);
};

try {
    await main();
} catch (error) {
    fail(error instanceof Error ? error.message : String(error));
}
