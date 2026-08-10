import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateSignatureArtEvidence } from './signatureArtEvidence.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (target) => JSON.parse(await readFile(target, 'utf8'));

const parseArgs = (args) => {
    const options = {};
    const names = new Map([
        ['--catalog', 'catalog'], ['--manifest', 'manifest'], ['--registry', 'registry'],
        ['--provenance', 'provenance'], ['--source-dir', 'sourceDir'],
        ['--public-root', 'publicRoot'], ['--output', 'output'],
    ]);
    for (let index = 0; index < args.length; index += 2) {
        const key = names.get(args[index]);
        const value = args[index + 1];
        if (!key || !value || value.startsWith('--')) throw new Error(`Invalid option: ${args[index] || '<missing>'}`);
        options[key] = resolve(value);
    }
    for (const key of names.values()) if (!options[key]) throw new Error(`Missing signature sync option: ${key}`);
    return options;
};

const writeAtomic = async (target, value) => {
    await mkdir(dirname(target), { recursive: true });
    const staged = `${target}.${process.pid}.stage`;
    try {
        await writeFile(staged, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        await rename(staged, target);
    } finally {
        await unlink(staged).catch(() => {});
    }
};

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    const [catalog, manifest, registryDocument, provenance] = await Promise.all([
        readJson(options.catalog), readJson(options.manifest), readJson(options.registry), readJson(options.provenance),
    ]);
    const selected = await validateSignatureArtEvidence({
        catalog, manifest, registryDocument, provenance,
        sourceDir: options.sourceDir, publicRoot: options.publicRoot, repoRoot: REPO_ROOT,
    });
    const next = {
        ...manifest,
        art: {
            ...manifest.art,
            signatureOverlay: {
                width: 72,
                height: 72,
                margin: 4,
                assetRoot: '/assets/equipment-wearable-exact/',
            },
            signatureOverlays: { ...(manifest.art?.signatureOverlays || {}), ...selected.overlays },
        },
        artwork: { ...(manifest.artwork || {}), ...selected.artwork },
    };
    const complete = catalog.length === 229
        && Object.keys(next.artwork).length === 229
        && Object.values(next.artwork).every((entry) => entry?.styleVersion === 2)
        && Object.keys(next.art?.families || {}).length === 22
        && Object.values(next.art?.families || {}).every((entry) => entry?.styleVersion === 2)
        && Object.keys(next.art?.signatureOverlays || {}).length === 25
        && Object.values(next.art?.signatureOverlays || {}).every((entry) => entry?.styleVersion === 2);
    next.styleVersion = complete ? 2 : next.styleVersion;
    await writeAtomic(options.output, next);
    process.stdout.write(`synced ${Object.keys(selected.artwork).length} signature item and overlay records\n`);
};

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
