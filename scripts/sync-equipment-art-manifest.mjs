import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateEquipmentArtEvidence } from './equipmentArtEvidence.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const parseArgs = (args) => {
    const options = {};
    const names = new Map([
        ['--catalog', 'catalog'],
        ['--manifest', 'manifest'],
        ['--provenance', 'provenance'],
        ['--source-dir', 'sourceDir'],
        ['--public-root', 'publicRoot'],
        ['--output', 'output'],
    ]);
    for (let index = 0; index < args.length; index += 2) {
        const key = names.get(args[index]);
        const value = args[index + 1];
        if (!key || !value || value.startsWith('--')) throw new Error(`Invalid option: ${args[index] || '<missing>'}`);
        options[key] = resolve(value);
    }
    for (const key of names.values()) {
        if (!options[key]) throw new Error(`Missing required option: ${[...names].find(([, name]) => name === key)[0]}`);
    }
    return options;
};

const writeAtomic = async (path, value) => {
    await mkdir(dirname(path), { recursive: true });
    const staged = `${path}.${process.pid}.stage`;
    try {
        await writeFile(staged, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        await rename(staged, path);
    } finally {
        await unlink(staged).catch(() => {});
    }
};

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    const [catalog, manifest, provenance] = await Promise.all([
        readJson(options.catalog),
        readJson(options.manifest),
        readJson(options.provenance),
    ]);
    if (!Array.isArray(catalog) || !manifest?.entries || provenance?.version !== 1) {
        throw new Error('Catalog, manifest, or provenance has an invalid shape');
    }
    const selectedArtwork = await validateEquipmentArtEvidence({
        catalog,
        manifest,
        provenance,
        cohort: provenance.cohort,
        sourceDir: options.sourceDir,
        publicRoot: options.publicRoot,
        repoRoot: REPO_ROOT,
    });
    await writeAtomic(options.output, {
        ...manifest,
        artwork: { ...(manifest.artwork || {}), ...selectedArtwork },
    });
    process.stdout.write(`synced ${Object.keys(selectedArtwork).length} ${provenance.cohort} artwork records\n`);
};

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
