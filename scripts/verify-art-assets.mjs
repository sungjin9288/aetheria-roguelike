import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildArtCatalog, compareCodePoints } from './artCatalog.mjs';
import { buildEquipmentCatalogRows, getEquipmentCohort } from './dump-equipment-catalog.mjs';
import { validateEquipmentArtEvidence } from './equipmentArtEvidence.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const DEFAULT_CHARACTER_MANIFEST = resolve(REPO_ROOT, 'src/data/characterArtManifest.json');
const DEFAULT_EQUIPMENT_MANIFEST = resolve(REPO_ROOT, 'src/data/equipmentArtManifest.json');
const DEFAULT_INSPECTOR = resolve(REPO_ROOT, 'scripts/inspect_art_pixels.py');
const DEFAULT_PUBLIC_ROOT = resolve(REPO_ROOT, 'public');
const EQUIPMENT_COHORTS = new Set([
    'armor',
    'offhand-headgear',
    'signature-mythic',
    'weapon-core',
    'weapon-ranged-magic',
]);

const byValue = compareCodePoints;
const sortValues = (values) => [...new Set(values)].sort(byValue);

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const readPngIhdr = async (path) => {
    let data;
    try {
        data = await readFile(path);
    } catch (error) {
        return { error: error.code === 'ENOENT' ? 'missing file' : error.message };
    }

    if (data.length === 0) return { error: 'empty file' };
    if (data.length < 29) return { error: 'too short for PNG IHDR' };
    if (!data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return { error: 'invalid PNG signature' };
    if (data.readUInt32BE(8) !== 13 || data.subarray(12, 16).toString('ascii') !== 'IHDR') {
        return { error: 'missing PNG IHDR' };
    }

    return {
        data,
        height: data.readUInt32BE(20),
        width: data.readUInt32BE(16),
    };
};

const parseArtMetadata = (manifest, kind) => {
    const art = manifest?.art || {};
    const width = Number(art.width);
    const height = Number(art.height);
    const margin = Number(art.margin);
    const footBaseline = kind === 'character' ? Number(art.footBaseline) : null;
    const valid = Number.isInteger(width) && width > 0
        && Number.isInteger(height) && height > 0
        && Number.isInteger(margin) && margin >= 0
        && (kind !== 'character' || (Number.isInteger(footBaseline) && footBaseline >= 0 && footBaseline < height));

    return valid ? { width, height, margin, footBaseline } : null;
};

const resolvePublicPath = (publicRoot, runtimePath) => {
    if (typeof runtimePath !== 'string' || !runtimePath) return null;
    const relativePath = runtimePath.replace(/^\/+/, '');
    if (!relativePath || relativePath.split('/').includes('..')) return null;
    return resolve(publicRoot, relativePath);
};

const getEquipmentRuntimePath = (entry) => {
    if (typeof entry !== 'string' || !entry) return null;
    if (entry.startsWith('/')) return entry;
    return `/assets/equipment-exact/${entry.endsWith('.png') ? entry : `${entry}.png`}`;
};

const runPixelInspector = ({ inspectorPath, pythonCommand, path, margin, footBaseline }) => {
    const args = [inspectorPath, '--path', path, '--margin', String(margin)];
    if (footBaseline !== null) args.push('--foot-baseline', String(footBaseline));
    const result = spawnSync(pythonCommand, args, { encoding: 'utf8' });
    if (result.error) return { error: `pixel inspector unavailable: ${result.error.message}` };
    if (result.status !== 0) {
        return { error: `pixel inspector failed: ${(result.stderr || result.stdout || `exit ${result.status}`).trim()}` };
    }
    try {
        return { result: JSON.parse(result.stdout) };
    } catch (error) {
        return { error: `pixel inspector emitted invalid JSON: ${error.message}` };
    }
};

const addDuplicateRuntimePaths = (entries, duplicates) => {
    const paths = new Map();
    for (const entry of entries) {
        if (!entry.runtimePath) continue;
        paths.set(entry.runtimePath, (paths.get(entry.runtimePath) || 0) + 1);
    }
    for (const [runtimePath, count] of paths) {
        if (count > 1) duplicates.push(`runtime-path:${runtimePath}`);
    }
};

const addSetDifference = ({ expected, actual, prefix, missing, extra }) => {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    for (const name of expectedSet) {
        if (!actualSet.has(name)) missing.push(`${prefix}:${name}`);
    }
    for (const name of actualSet) {
        if (!expectedSet.has(name)) extra.push(`${prefix}:${name}`);
    }
};

const validateAsset = async ({
    identity,
    runtimePath,
    metadata,
    publicRoot,
    inspectorPath,
    pythonCommand,
    invalidPng,
    invalidAlpha,
    invalidBounds,
    exports,
}) => {
    const path = resolvePublicPath(publicRoot, runtimePath);
    if (!path) {
        invalidPng.push(`${identity}:invalid runtime path`);
        return;
    }

    const png = await readPngIhdr(path);
    if (png.error) {
        invalidPng.push(`${identity}:${png.error}`);
        return;
    }
    if (png.width !== metadata.width || png.height !== metadata.height) {
        invalidPng.push(`${identity}:expected ${metadata.width}x${metadata.height}, got ${png.width}x${png.height}`);
        return;
    }

    exports.push({
        identity,
        path: runtimePath,
        sha256: createHash('sha256').update(png.data).digest('hex'),
    });

    const inspection = runPixelInspector({
        inspectorPath,
        pythonCommand,
        path,
        margin: metadata.margin,
        footBaseline: metadata.footBaseline,
    });
    if (inspection.error) {
        invalidAlpha.push(`${identity}:${inspection.error}`);
        invalidBounds.push(`${identity}:${inspection.error}`);
        return;
    }

    const result = inspection.result;
    if (!result.hasAlpha || !result.hasTransparentPixels) {
        invalidAlpha.push(`${identity}:requires alpha channel and transparent pixels`);
    }
    if (!result.boundsWithinMargin) {
        invalidBounds.push(`${identity}:opaque bounds exceed margin ${metadata.margin}`);
    }
    if (metadata.footBaseline !== null && !result.footBaselineMatches) {
        invalidBounds.push(`${identity}:expected foot baseline ${metadata.footBaseline}, got ${result.footBaseline}`);
    }
};

export const verifyArtAssets = async ({
    catalog = null,
    characterManifest = null,
    equipmentManifest = null,
    characterManifestPath = DEFAULT_CHARACTER_MANIFEST,
    equipmentManifestPath = DEFAULT_EQUIPMENT_MANIFEST,
    inspectorPath = DEFAULT_INSPECTOR,
    publicRoot = DEFAULT_PUBLIC_ROOT,
    pythonCommand = 'python3',
    scope = 'all',
    cohort = null,
    equipmentProvenancePath = null,
    equipmentSourceDir = null,
} = {}) => {
    if (!['all', 'characters', 'equipment'].includes(scope)) {
        throw new Error(`Unknown art verification scope: ${scope}`);
    }
    if (cohort !== null && (!EQUIPMENT_COHORTS.has(cohort) || scope !== 'equipment')) {
        throw new Error(`Unknown or incompatible equipment art cohort: ${String(cohort)}`);
    }

    const resolvedCatalog = catalog || await buildArtCatalog();
    const resolvedCharacterManifest = characterManifest || await readJson(characterManifestPath);
    const resolvedEquipmentManifest = equipmentManifest || await readJson(equipmentManifestPath);
    const resolvedInspectorPath = inspectorPath instanceof URL ? fileURLToPath(inspectorPath) : inspectorPath;
    const verifyCharacters = scope === 'all' || scope === 'characters';
    const verifyEquipment = scope === 'all' || scope === 'equipment';
    const equipmentCatalog = cohort
        ? resolvedCatalog.equipment.filter((entry) => getEquipmentCohort({ name: entry.name, familyKey: entry.family }) === cohort)
        : resolvedCatalog.equipment;
    const verifiedSurfaces = Object.freeze([
        ...(verifyCharacters ? ['characters'] : []),
        ...(verifyEquipment ? ['equipment'] : []),
    ]);
    const report = {
        ok: false,
        scope,
        cohort,
        verifiedSurfaces,
        catalogSha256: resolvedCatalog.catalogSha256,
        counts: {
            classes: resolvedCatalog.classes.length,
            equipment: equipmentCatalog.length,
            definedFamilies: resolvedCatalog.definedFamilies.length,
            usedFamilies: resolvedCatalog.usedFamilies.length,
        },
        missing: [],
        extra: [],
        duplicates: [],
        invalidPng: [],
        invalidAlpha: [],
        invalidBounds: [],
        invalidStyleVersion: [],
        invalidArtwork: [],
        exports: [],
    };
    Object.defineProperties(report, {
        scope: { value: scope, enumerable: true, writable: false, configurable: false },
        cohort: { value: cohort, enumerable: true, writable: false, configurable: false },
        verifiedSurfaces: { value: verifiedSurfaces, enumerable: true, writable: false, configurable: false },
    });

    const characterEntries = resolvedCharacterManifest?.entries || {};
    const equipmentEntries = resolvedEquipmentManifest?.entries || {};
    const selectedAssets = [];

    if (verifyCharacters) {
        addSetDifference({
            expected: resolvedCatalog.classes.map((entry) => entry.name),
            actual: Object.keys(characterEntries),
            prefix: 'character',
            missing: report.missing,
            extra: report.extra,
        });
        if (resolvedCharacterManifest?.catalogSha256 !== resolvedCatalog.catalogSha256) {
            report.missing.push('character:catalogSha256 mismatch');
        }
        const metadata = parseArtMetadata(resolvedCharacterManifest, 'character');
        if (!metadata) {
            report.missing.push('character:art metadata');
        } else {
            selectedAssets.push(...Object.entries(characterEntries).map(([name, entry]) => ({
                identity: `character:${name}`,
                runtimePath: entry?.runtimePath,
                metadata,
            })));
        }
    }

    if (verifyEquipment) {
        const expectedEquipmentNames = equipmentCatalog.map((entry) => entry.name);
        const expectedEquipmentNameSet = new Set(expectedEquipmentNames);
        addSetDifference({
            expected: expectedEquipmentNames,
            actual: cohort
                ? Object.keys(equipmentEntries).filter((name) => expectedEquipmentNameSet.has(name))
                : Object.keys(equipmentEntries),
            prefix: 'equipment',
            missing: report.missing,
            extra: report.extra,
        });
        if (resolvedEquipmentManifest?.catalogSha256 !== resolvedCatalog.catalogSha256) {
            report.missing.push('equipment:catalogSha256 mismatch');
        }
        if (!cohort && resolvedEquipmentManifest?.styleVersion !== 2) {
            report.invalidStyleVersion.push(`equipment:expected styleVersion 2, got ${String(resolvedEquipmentManifest?.styleVersion)}`);
        }
        if (cohort) {
            for (const entry of equipmentCatalog) {
                const styleVersion = resolvedEquipmentManifest?.artwork?.[entry.name]?.styleVersion;
                if (styleVersion !== 2) {
                    report.invalidStyleVersion.push(`equipment:${entry.name}:expected styleVersion 2, got ${String(styleVersion)}`);
                }
            }
            try {
                const provenancePath = equipmentProvenancePath
                    || resolve(REPO_ROOT, `docs/evidence/art/equipment-${cohort}-provenance.json`);
                const sourceDir = equipmentSourceDir
                    || resolve(REPO_ROOT, `scripts/art_sources/equipment/v2/${cohort}`);
                await validateEquipmentArtEvidence({
                    catalog: await buildEquipmentCatalogRows(),
                    manifest: resolvedEquipmentManifest,
                    provenance: await readJson(provenancePath),
                    cohort,
                    sourceDir,
                    publicRoot,
                    repoRoot: REPO_ROOT,
                    requireManifestArtwork: true,
                });
            } catch (error) {
                report.invalidArtwork.push(`equipment:${error.message}`);
            }
        }
        const metadata = parseArtMetadata(resolvedEquipmentManifest, 'equipment');
        if (!metadata) {
            report.missing.push('equipment:art metadata');
        } else {
            selectedAssets.push(...equipmentCatalog.map(({ name }) => ({
                identity: `equipment:${name}`,
                runtimePath: getEquipmentRuntimePath(equipmentEntries[name]),
                metadata,
            })));
        }
    }

    addDuplicateRuntimePaths(selectedAssets, report.duplicates);
    for (const asset of selectedAssets) {
        await validateAsset({
            ...asset,
            publicRoot,
            inspectorPath: resolvedInspectorPath,
            pythonCommand,
            invalidPng: report.invalidPng,
            invalidAlpha: report.invalidAlpha,
            invalidBounds: report.invalidBounds,
            exports: report.exports,
        });
    }

    for (const key of ['missing', 'extra', 'duplicates', 'invalidPng', 'invalidAlpha', 'invalidBounds', 'invalidStyleVersion', 'invalidArtwork']) {
        report[key] = sortValues(report[key]);
    }
    report.exports.sort((left, right) => compareCodePoints(left.identity, right.identity) || compareCodePoints(left.path, right.path));
    report.ok = !report.missing.length
        && !report.extra.length
        && !report.duplicates.length
        && !report.invalidPng.length
        && !report.invalidAlpha.length
        && !report.invalidBounds.length
        && !report.invalidStyleVersion.length
        && !report.invalidArtwork.length;
    return report;
};

export const writeArtVerificationReport = async (report, path) => {
    if (!report.ok) throw new Error('Refusing to write failing art verification as approved evidence');
    if (report.scope !== 'all' || report.verifiedSurfaces?.join(',') !== 'characters,equipment') {
        throw new Error('Refusing to write partial-scope art verification as approved evidence');
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

const parseCli = (args) => {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        const optionName = {
            '--scope': 'scope',
            '--cohort': 'cohort',
            '--write-report': 'writeReport',
            '--character-manifest': 'characterManifestPath',
            '--equipment-manifest': 'equipmentManifestPath',
            '--equipment-provenance': 'equipmentProvenancePath',
            '--equipment-source-dir': 'equipmentSourceDir',
            '--public-root': 'publicRoot',
        }[argument];
        if (!optionName) throw new Error(`Unknown art verifier argument: ${argument}`);

        const value = args[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
        if (argument === '--scope' && !['all', 'characters', 'equipment'].includes(value)) {
            throw new Error(`Invalid value for --scope: ${value}`);
        }
        if (argument === '--cohort' && !EQUIPMENT_COHORTS.has(value)) {
            throw new Error(`Invalid value for --cohort: ${value}`);
        }
        options[optionName] = value;
        index += 1;
    }
    if (options.cohort && options.scope && options.scope !== 'equipment') {
        throw new Error('--cohort can only be used with --scope equipment');
    }
    return options;
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
    try {
        const options = parseCli(process.argv.slice(2));
        const report = await verifyArtAssets({
            scope: options.scope || (options.cohort ? 'equipment' : 'all'),
            cohort: options.cohort || null,
            ...(options.characterManifestPath ? { characterManifestPath: resolve(options.characterManifestPath) } : {}),
            ...(options.equipmentManifestPath ? { equipmentManifestPath: resolve(options.equipmentManifestPath) } : {}),
            ...(options.equipmentProvenancePath ? { equipmentProvenancePath: resolve(options.equipmentProvenancePath) } : {}),
            ...(options.equipmentSourceDir ? { equipmentSourceDir: resolve(options.equipmentSourceDir) } : {}),
            ...(options.publicRoot ? { publicRoot: resolve(options.publicRoot) } : {}),
        });
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (options.writeReport) {
            await writeArtVerificationReport(report, resolve(options.writeReport));
        }
        if (!report.ok) process.exitCode = 1;
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}
