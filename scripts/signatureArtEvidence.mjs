import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import { validateStyleV2ExportHashUniqueness } from './equipmentArtEvidence.mjs';
import { buildSignaturePromptBatchFromRows, SIGNATURE_CELL_ORDER } from './signaturePromptContract.mjs';

const CATALOG_FIELDS = ['name', 'type', 'tier', 'elem', 'familyKey', 'runtimePath', 'cohort'];
const TOP_FIELDS = ['version', 'catalogSha256', 'catalogRowsSha256', 'cohort', 'registrySha256', 'generationReview', 'batches'];
const RECORD_FIELDS = ['batchId', 'catalogSha256', 'catalogRowsSha256', 'cohort', 'identityNames', 'itemSourceSheet', 'itemSourceSheetSha256', 'overlaySourceSheet', 'overlaySourceSheetSha256', 'replayKey', 'itemExports', 'overlayExports'];
const EXPORT_FIELDS = ['cell', 'name', 'runtimePath', 'exportSha256'];
const ARTWORK_FIELDS = ['styleVersion', 'familyKey', 'batchId', 'sourcePath', 'sourceSha256', 'exportSha256'];
const OVERLAY_FIELDS = [...ARTWORK_FIELDS, 'runtimePath'];
const REVIEW_FIELDS = ['tool', 'accepted', 'rejected'];
const ACCEPTED_FIELDS = ['batchId', 'surface', 'rawImage', 'rawSha256'];
const REJECTED_FIELDS = [...ACCEPTED_FIELDS, 'reason'];
const SHA256 = /^[0-9a-f]{64}$/;
const PNG_BASENAME = /^[^/\\]+\.png$/;
const execFileAsync = promisify(execFile);

const hash = (value) => createHash('sha256').update(value).digest('hex');
const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const hashCanonicalJson = (value) => hash(JSON.stringify(canonicalize(value)));
const sameKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const requireHash = (value, label) => {
    if (!SHA256.test(value || '')) throw new Error(`${label} is not a SHA-256 value`);
};
const requirePngBasename = (value, label) => {
    if (typeof value !== 'string' || !PNG_BASENAME.test(value) || value === '.' || value === '..') {
        throw new Error(`${label} must be a safe PNG basename`);
    }
};
const requireChildPath = (root, value, label, { allowLeadingSlash = false } = {}) => {
    if (typeof value !== 'string' || !value || (isAbsolute(value) && !(allowLeadingSlash && value.startsWith('/'))) || value.split('/').includes('..')) {
        throw new Error(`${label} has an invalid path`);
    }
    const child = resolve(root, value.replace(/^\/+/, ''));
    const inside = relative(root, child);
    if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
        throw new Error(`${label} escapes its declared root`);
    }
    return child;
};
const replayKey = (record) => hash(JSON.stringify({
    batchId: record.batchId,
    itemSourceSheetSha256: record.itemSourceSheetSha256,
    overlaySourceSheetSha256: record.overlaySourceSheetSha256,
    identityNames: record.identityNames,
}));

const inspectSources = async ({ repoRoot, batchPath, itemSource, overlaySource }) => {
    try {
        const { stdout } = await execFileAsync('python3', [
            resolve(repoRoot, 'scripts/inspect_signature_source_pair.py'),
            '--batch', batchPath,
            '--item-source-sheet', itemSource,
            '--overlay-source-sheet', overlaySource,
        ], { maxBuffer: 1024 * 1024 });
        const result = JSON.parse(stdout);
        if (!Array.isArray(result)) throw new Error('invalid inspector result');
        return result;
    } catch (error) {
        throw new Error(`Signature source reconstruction failed: ${error?.stderr?.trim() || error.message}`);
    }
};

const validateReview = (review, manifest, batchIds) => {
    if (!sameKeys(review, REVIEW_FIELDS) || !Array.isArray(review.accepted) || !Array.isArray(review.rejected)
        || typeof review.tool !== 'string' || !review.tool.trim()) {
        throw new Error('Signature generation review schema is invalid');
    }
    const acceptedPairs = new Set();
    const rawNames = new Set();
    const rawHashes = new Set();
    const validate = (candidate, fields, rejected) => {
        if (!sameKeys(candidate, fields) || !batchIds.has(candidate.batchId) || !['item', 'overlay'].includes(candidate.surface)) {
            throw new Error('Signature generation review candidate is invalid');
        }
        requirePngBasename(candidate.rawImage, 'Signature generation review rawImage');
        requireHash(candidate.rawSha256, 'Signature generation review raw hash');
        if (rawNames.has(candidate.rawImage) || rawHashes.has(candidate.rawSha256)) {
            throw new Error('Signature generation review raw candidate is duplicated');
        }
        if (rejected && (typeof candidate.reason !== 'string' || !candidate.reason.trim())) {
            throw new Error('Signature generation review rejection reason is invalid');
        }
        const pair = `${candidate.batchId}:${candidate.surface}`;
        if (!rejected && acceptedPairs.has(pair)) throw new Error('Signature generation review accepted surface is duplicated');
        if (!rejected) acceptedPairs.add(pair);
        rawNames.add(candidate.rawImage);
        rawHashes.add(candidate.rawSha256);
    };
    review.accepted.forEach((candidate) => validate(candidate, ACCEPTED_FIELDS, false));
    review.rejected.forEach((candidate) => validate(candidate, REJECTED_FIELDS, true));
    const expected = new Set([...batchIds].flatMap((batchId) => [`${batchId}:item`, `${batchId}:overlay`]));
    if (acceptedPairs.size !== expected.size || [...expected].some((pair) => !acceptedPairs.has(pair))) {
        throw new Error('Signature generation review accepted coverage is incomplete');
    }
    const pin = manifest?.pipeline?.provenance?.cohorts?.['signature-mythic']?.generationReviewSha256;
    requireHash(pin, 'Signature generation review pin');
    if (hashCanonicalJson(review) !== pin) throw new Error('Signature generation review hash does not match manifest pin');
};

export const validateSignatureArtEvidence = async ({
    catalog,
    manifest,
    registryDocument,
    provenance,
    sourceDir,
    publicRoot,
    repoRoot,
    requireManifestArtwork = false,
}) => {
    if (!Array.isArray(catalog) || !sameKeys(provenance, TOP_FIELDS) || provenance.version !== 1 || provenance.cohort !== 'signature-mythic') {
        throw new Error('Signature provenance top-level schema is invalid');
    }
    const registry = registryDocument?.entries;
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
        throw new Error('Signature registry document is invalid');
    }
    const registryNames = Object.keys(registry);
    if (registryNames.length !== 25) throw new Error(`Signature registry coverage is invalid: ${registryNames.length}/25`);
    const registryBytes = await readFile(resolve(repoRoot, 'src/data/signatureRegistry.json'));
    if (hash(registryBytes) !== provenance.registrySha256) throw new Error('Signature registry hash mismatch');

    const rowsHash = hash(JSON.stringify(catalog));
    if (manifest?.pipeline?.catalog?.rowsSha256 !== rowsHash || provenance.catalogRowsSha256 !== rowsHash
        || provenance.catalogSha256 !== manifest.catalogSha256) {
        throw new Error('Signature catalog rows are not bound to active evidence');
    }
    const rows = catalog.filter((row) => row.cohort === 'signature-mythic');
    const rowsByName = new Map(rows.map((row) => [row.name, row]));
    if (rows.length !== 25 || registryNames.some((name) => !rowsByName.has(name)) || rows.some((row) => !registry[row.name])) {
        throw new Error('Signature catalog and registry coverage differ');
    }
    for (const row of rows) {
        if (!sameKeys(row, CATALOG_FIELDS)) throw new Error(`Signature catalog row schema is invalid: ${row.name}`);
        const spriteKey = registry[row.name]?.spriteKey;
        if (manifest.entries?.[row.name] !== spriteKey || row.runtimePath !== `/assets/equipment-exact/${spriteKey}.png`) {
            throw new Error(`Signature catalog, manifest, and registry route differ: ${row.name}`);
        }
    }

    const batchIds = new Set(provenance.batches.map((record) => record?.batchId));
    if (!Array.isArray(provenance.batches) || batchIds.size !== provenance.batches.length) {
        throw new Error('Signature provenance batch ids are invalid');
    }
    validateReview(provenance.generationReview, manifest, batchIds);

    const names = new Set();
    const runtimePaths = new Set();
    const exportHashes = new Set();
    const sourceNames = new Set();
    const sourceHashes = new Set();
    const artwork = {};
    const overlays = {};
    for (const record of provenance.batches) {
        if (!sameKeys(record, RECORD_FIELDS) || record.cohort !== 'signature-mythic'
            || record.catalogSha256 !== provenance.catalogSha256 || record.catalogRowsSha256 !== rowsHash
            || !Array.isArray(record.identityNames) || record.identityNames.length < 1 || record.identityNames.length > 6
            || !Array.isArray(record.itemExports) || !Array.isArray(record.overlayExports)
            || record.itemExports.length !== record.identityNames.length || record.overlayExports.length !== record.identityNames.length) {
            throw new Error(`Signature provenance record is invalid: ${record?.batchId}`);
        }
        requirePngBasename(record.itemSourceSheet, `${record.batchId} item source`);
        requirePngBasename(record.overlaySourceSheet, `${record.batchId} overlay source`);
        if (record.itemSourceSheet !== `${record.batchId}-item.png` || record.overlaySourceSheet !== `${record.batchId}-overlay.png`) {
            throw new Error(`Signature source names do not bind batchId: ${record.batchId}`);
        }
        requireHash(record.itemSourceSheetSha256, `${record.batchId} item source hash`);
        requireHash(record.overlaySourceSheetSha256, `${record.batchId} overlay source hash`);
        if (record.replayKey !== replayKey(record)) throw new Error(`Signature replay key is invalid: ${record.batchId}`);
        for (const value of [record.itemSourceSheet, record.overlaySourceSheet]) {
            if (sourceNames.has(value)) throw new Error(`Signature source path is duplicated: ${value}`);
            sourceNames.add(value);
        }
        for (const value of [record.itemSourceSheetSha256, record.overlaySourceSheetSha256]) {
            if (sourceHashes.has(value)) throw new Error(`Signature source hash is duplicated: ${record.batchId}`);
            sourceHashes.add(value);
        }

        const batchPath = resolve(sourceDir, 'batches', `${record.batchId}.json`);
        const trackedBatch = JSON.parse(await readFile(batchPath, 'utf8'));
        const expectedBatch = buildSignaturePromptBatchFromRows({
            catalog,
            registry,
            catalogSha256: provenance.catalogSha256,
            batchId: record.batchId,
            names: record.identityNames.join(','),
        });
        if (hashCanonicalJson(trackedBatch) !== hashCanonicalJson(expectedBatch)) {
            throw new Error(`Signature tracked prompt batch is invalid: ${record.batchId}`);
        }
        const families = new Set(record.identityNames.map((name) => rowsByName.get(name)?.familyKey));
        if (families.size !== 1) throw new Error(`Signature batch is not family-pure: ${record.batchId}`);

        const itemSource = requireChildPath(sourceDir, record.itemSourceSheet, `${record.batchId} item source`);
        const overlaySource = requireChildPath(sourceDir, record.overlaySourceSheet, `${record.batchId} overlay source`);
        const [itemBytes, overlayBytes] = await Promise.all([readFile(itemSource), readFile(overlaySource)]);
        if (hash(itemBytes) !== record.itemSourceSheetSha256 || hash(overlayBytes) !== record.overlaySourceSheetSha256) {
            throw new Error(`Signature source hash mismatch: ${record.batchId}`);
        }
        const reconstructed = await inspectSources({ repoRoot, batchPath, itemSource, overlaySource });
        if (reconstructed.length !== record.identityNames.length) throw new Error(`Signature source reconstruction count mismatch: ${record.batchId}`);

        for (const [index, name] of record.identityNames.entries()) {
            const row = rowsByName.get(name);
            const itemExport = record.itemExports[index];
            const overlayExport = record.overlayExports[index];
            if (!row || names.has(name) || !sameKeys(itemExport, EXPORT_FIELDS) || !sameKeys(overlayExport, EXPORT_FIELDS)
                || itemExport.cell !== SIGNATURE_CELL_ORDER[index] || overlayExport.cell !== SIGNATURE_CELL_ORDER[index]
                || itemExport.name !== name || overlayExport.name !== name
                || itemExport.runtimePath !== row.runtimePath
                || overlayExport.runtimePath !== `/assets/equipment-wearable-exact/${registry[name].spriteKey}.png`) {
                throw new Error(`Signature export identity is invalid: ${name}`);
            }
            requireHash(itemExport.exportSha256, `${name} item export hash`);
            requireHash(overlayExport.exportSha256, `${name} overlay export hash`);
            if (reconstructed[index]?.itemExportSha256 !== itemExport.exportSha256
                || reconstructed[index]?.overlayExportSha256 !== overlayExport.exportSha256) {
                throw new Error(`Signature source does not reproduce runtime exports: ${name}`);
            }
            for (const entry of [itemExport, overlayExport]) {
                if (runtimePaths.has(entry.runtimePath) || exportHashes.has(entry.exportSha256)) {
                    throw new Error(`Signature runtime path or export hash is duplicated: ${name}`);
                }
                const runtime = requireChildPath(publicRoot, entry.runtimePath, `${name} runtime`, { allowLeadingSlash: true });
                if (hash(await readFile(runtime)) !== entry.exportSha256) throw new Error(`Signature runtime hash mismatch: ${name}`);
                runtimePaths.add(entry.runtimePath);
                exportHashes.add(entry.exportSha256);
            }
            artwork[name] = {
                styleVersion: 2,
                familyKey: row.familyKey,
                batchId: record.batchId,
                sourcePath: relative(repoRoot, itemSource).split(sep).join('/'),
                sourceSha256: record.itemSourceSheetSha256,
                exportSha256: itemExport.exportSha256,
            };
            overlays[name] = {
                styleVersion: 2,
                familyKey: row.familyKey,
                batchId: record.batchId,
                sourcePath: relative(repoRoot, overlaySource).split(sep).join('/'),
                sourceSha256: record.overlaySourceSheetSha256,
                exportSha256: overlayExport.exportSha256,
                runtimePath: overlayExport.runtimePath,
            };
            names.add(name);
        }
    }
    if (names.size !== 25 || rows.some((row) => !names.has(row.name))) throw new Error(`Signature provenance coverage is incomplete: ${names.size}/25`);
    if (requireManifestArtwork) {
        for (const row of rows) {
            const itemActual = manifest.artwork?.[row.name];
            const overlayActual = manifest.art?.signatureOverlays?.[row.name];
            if (!sameKeys(itemActual, ARTWORK_FIELDS) || ARTWORK_FIELDS.some((field) => itemActual[field] !== artwork[row.name][field])) {
                throw new Error(`${row.name}:signature item artwork metadata mismatch`);
            }
            if (!sameKeys(overlayActual, OVERLAY_FIELDS) || OVERLAY_FIELDS.some((field) => overlayActual[field] !== overlays[row.name][field])) {
                throw new Error(`${row.name}:signature overlay artwork metadata mismatch`);
            }
        }
    }
    validateStyleV2ExportHashUniqueness(manifest, { artworkOverrides: artwork, overlayOverrides: overlays });
    return { artwork, overlays };
};
