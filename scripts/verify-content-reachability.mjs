import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildContentReachabilityReport, canonicalizeContentReachability } from '../src/systems/contentReachability.ts';

const ROOT = process.cwd();
const EVIDENCE_ROOT = 'docs/evidence/qa/release-complete-core';

const fail = (message) => {
    console.error(message);
    process.exitCode = 1;
};

const parseArgs = (args) => {
    if (args.length !== 2 || !['--write', '--verify'].includes(args[0])) {
        throw new Error('usage: --write|--verify <repo-relative evidence .json path>');
    }
    const [mode, value] = args;
    if (!value || path.isAbsolute(value) || value.includes('\\')) throw new Error('evidence path must be repository-relative');
    const segments = value.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('evidence path contains unsafe segments');
    if (!value.startsWith(`${EVIDENCE_ROOT}/`) || !value.endsWith('.json')) throw new Error('evidence path is outside the canonical reachability folder');
    return { mode, relativePath: value, absolutePath: path.join(ROOT, value) };
};

const hashReport = (report) => createHash('sha256')
    .update(JSON.stringify(canonicalizeContentReachability(report)))
    .digest('hex');

const main = async () => {
    const target = parseArgs(process.argv.slice(2));
    const report = buildContentReachabilityReport();
    if (report.errors.length > 0) throw new Error(`content reachability has errors: ${report.errors.join(', ')}`);
    const envelope = {
        hashAlgorithm: 'sha256',
        reportHash: hashReport(report),
        report,
    };
    const expected = `${JSON.stringify(envelope, null, 2)}\n`;
    if (target.mode === '--write') {
        await writeFile(target.absolutePath, expected, 'utf8');
        console.log(JSON.stringify({ hashAlgorithm: envelope.hashAlgorithm, reportHash: envelope.reportHash }));
        return;
    }
    const actual = await readFile(target.absolutePath, 'utf8');
    if (actual !== expected) throw new Error(`stale or malformed evidence: ${target.relativePath}`);
    console.log(JSON.stringify({ hashAlgorithm: envelope.hashAlgorithm, reportHash: envelope.reportHash }));
};

try {
    await main();
} catch (error) {
    fail(error instanceof Error ? error.message : String(error));
}
