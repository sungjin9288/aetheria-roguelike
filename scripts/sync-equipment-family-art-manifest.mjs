import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildArtCatalog } from './artCatalog.mjs';
import { validateEquipmentFamilyArtEvidence } from './equipmentFamilyArtEvidence.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const parseArgs = (args) => {
    const names = new Map([
        ['--manifest', 'manifest'],
        ['--provenance', 'provenance'],
        ['--source-dir', 'sourceDir'],
        ['--public-root', 'publicRoot'],
        ['--output', 'output'],
    ]);
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
        const key = names.get(args[index]);
        const value = args[index + 1];
        if (!key || !value || value.startsWith('--')) throw new Error(`Invalid option: ${args[index] || '<missing>'}`);
        options[key] = resolve(value);
    }
    for (const [argument, key] of names) {
        if (!options[key]) throw new Error(`Missing required option: ${argument}`);
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
        buildArtCatalog(),
        readJson(options.manifest),
        readJson(options.provenance),
    ]);
    const families = await validateEquipmentFamilyArtEvidence({
        catalogSha256: catalog.catalogSha256,
        definedFamilies: catalog.definedFamilies,
        manifest,
        provenance,
        sourceDir: options.sourceDir,
        publicRoot: options.publicRoot,
        repoRoot: REPO_ROOT,
    });
    await writeAtomic(options.output, {
        ...manifest,
        art: { ...manifest.art, families },
    });
    process.stdout.write(`synced ${Object.keys(families).length} family exemplar records\n`);
};

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
