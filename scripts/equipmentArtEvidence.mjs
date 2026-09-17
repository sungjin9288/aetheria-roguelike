import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import { buildEquipmentPromptBatchFromRows } from './equipmentPromptContract.mjs';

const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const CATALOG_FIELDS = ['name', 'type', 'tier', 'elem', 'familyKey', 'runtimePath', 'cohort'];
const PROVENANCE_FIELDS = ['version', 'catalogSha256', 'catalogRowsSha256', 'cohort', 'generationReview', 'batches'];
const RECORD_FIELDS = [
    'batchId',
    'catalogSha256',
    'catalogRowsSha256',
    'cohort',
    'identityNames',
    'sourceSheet',
    'sourceSheetSha256',
    'replayKey',
    'exports',
];
const EXPORT_FIELDS = ['cell', 'name', 'runtimePath', 'exportSha256'];
const GENERATION_REVIEW_FIELDS = ['tool', 'accepted', 'rejected'];
const ACCEPTED_GENERATION_FIELDS = ['batchId', 'rawImage', 'rawSha256'];
const REJECTED_GENERATION_FIELDS = [...ACCEPTED_GENERATION_FIELDS, 'reason'];
const ARTWORK_FIELDS = ['styleVersion', 'familyKey', 'batchId', 'sourcePath', 'sourceSha256', 'exportSha256'];
const SHA256 = /^[0-9a-f]{64}$/;
const PNG_BASENAME = /^[^/\\]+\.png$/;
const execFileAsync = promisify(execFile);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const hashCanonicalJson = (value) => hash(JSON.stringify(canonicalize(value)));
const compareCodePoints = (left, right) => {
    const leftPoints = [...String(left)];
    const rightPoints = [...String(right)];
    const length = Math.min(leftPoints.length, rightPoints.length);
    for (let index = 0; index < length; index += 1) {
        const difference = leftPoints[index].codePointAt(0) - rightPoints[index].codePointAt(0);
        if (difference !== 0) return difference;
    }
    return leftPoints.length - rightPoints.length;
};
const sameKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

const requireChildPath = (root, path, label, { allowLeadingSlash = false } = {}) => {
    if (typeof path !== 'string' || !path
        || (isAbsolute(path) && !(allowLeadingSlash && path.startsWith('/')))
        || path.split('/').includes('..')) {
        throw new Error(`${label} has an invalid path`);
    }
    const child = resolve(root, path.replace(/^\/+/, ''));
    const inside = relative(root, child);
    if (!inside || inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) {
        throw new Error(`${label} escapes its declared root`);
    }
    return child;
};

const requireHash = (value, label) => {
    if (!SHA256.test(value || '')) throw new Error(`${label} is not a SHA-256 value`);
};

const requireText = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is invalid`);
};

const requirePngBasename = (value, label) => {
    if (typeof value !== 'string' || !PNG_BASENAME.test(value) || value === '.' || value === '..') {
        throw new Error(`${label} must be a safe PNG basename`);
    }
};

export const validateStyleV2ExportHashUniqueness = (
    manifest,
    { artworkOverrides = {}, familyOverrides = {}, overlayOverrides = {} } = {},
) => {
    const hashes = new Map();
    const surfaces = [
        ['equipment', { ...(manifest?.artwork || {}), ...artworkOverrides }],
        ['family', { ...(manifest?.art?.families || {}), ...familyOverrides }],
        ['signature-overlay', { ...(manifest?.art?.signatureOverlays || {}), ...overlayOverrides }],
    ];
    for (const [surface, entries] of surfaces) {
        for (const [identity, entry] of Object.entries(entries)) {
            if (entry?.styleVersion !== 2) continue;
            requireHash(entry.exportSha256, `${surface}:${identity} export hash`);
            const prior = hashes.get(entry.exportSha256);
            if (prior) {
                throw new Error(`StyleVersion 2 export hash is duplicated: ${prior} and ${surface}:${identity}`);
            }
            hashes.set(entry.exportSha256, `${surface}:${identity}`);
        }
    }
};

const buildReplayKey = (batchId, sourceSheetSha256, identityNames) => hash(JSON.stringify({
    batchId,
    sourceSheetSha256,
    identityNames,
}));

const inspectTrackedSource = async ({ repoRoot, trackedBatchPath, source, publicRoot }) => {
    const inspector = resolve(repoRoot, 'scripts/inspect_equipment_source_sheet.py');
    try {
        const { stdout } = await execFileAsync('python3', [
            inspector,
            '--batch', trackedBatchPath,
            '--source-sheet', source,
            '--public-root', publicRoot,
        ], { maxBuffer: 1024 * 1024 });
        const exports = JSON.parse(stdout);
        if (!Array.isArray(exports)) throw new Error('invalid inspector output');
        return exports;
    } catch (error) {
        const detail = error?.stderr?.trim() || error.message;
        throw new Error(`Equipment source reconstruction failed: ${detail}`);
    }
};

const validateCatalog = (catalog, manifest, provenance, cohort) => {
    if (!Array.isArray(catalog)) throw new Error('Equipment catalog must be an array');
    const names = new Set();
    const runtimePaths = new Set();
    let previousName = null;

    for (const row of catalog) {
        if (!sameKeys(row, CATALOG_FIELDS)) throw new Error('Equipment catalog row schema is invalid');
        if (typeof row.name !== 'string' || !row.name) throw new Error('Equipment catalog identity is invalid');
        if (previousName !== null && compareCodePoints(previousName, row.name) >= 0) {
            throw new Error('Equipment catalog order is invalid');
        }
        if (names.has(row.name) || runtimePaths.has(row.runtimePath)) {
            throw new Error('Equipment catalog identity or runtime path is duplicated');
        }
        names.add(row.name);
        runtimePaths.add(row.runtimePath);
        previousName = row.name;
    }

    const rowsSha256 = hash(JSON.stringify(catalog));
    if (manifest?.pipeline?.catalog?.rowsSha256 !== rowsSha256
        || provenance.catalogRowsSha256 !== rowsSha256) {
        throw new Error('Equipment catalog rows are not bound to the active evidence');
    }
    if (provenance.catalogSha256 !== manifest.catalogSha256 || provenance.cohort !== cohort) {
        throw new Error('Equipment evidence is not bound to the active manifest cohort');
    }
    const rows = catalog.filter((row) => row.cohort === cohort);
    const assetRoot = manifest?.art?.assetRoot;
    if (typeof assetRoot !== 'string' || !assetRoot) throw new Error('Equipment manifest asset root is invalid');
    for (const row of rows) {
        const entry = manifest?.entries?.[row.name];
        if (typeof entry !== 'string' || !entry || entry.split('/').includes('..')) {
            throw new Error(`${row.name}:manifest runtime path is invalid`);
        }
        const suffix = entry.endsWith('.png') ? entry : `${entry}.png`;
        const runtimePath = `${assetRoot.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
        if (runtimePath !== row.runtimePath) throw new Error(`${row.name}:manifest runtime path mismatch`);
    }
    return { rowsSha256, rows };
};

const validateGenerationReview = ({ manifest, provenance, cohort, preparedBatches }) => {
    const review = provenance.generationReview;
    if (!sameKeys(review, GENERATION_REVIEW_FIELDS)
        || !Array.isArray(review.accepted)
        || !Array.isArray(review.rejected)) {
        throw new Error('Equipment generation review schema is invalid');
    }
    requireText(review.tool, 'Equipment generation review tool');

    const rawCandidates = new Set();
    const rawImages = new Set();
    const acceptedBatches = new Set();
    const validateCandidate = (candidate, fields, label) => {
        if (!sameKeys(candidate, fields)) throw new Error(`Equipment generation review ${label} schema is invalid`);
        requireText(candidate.batchId, `Equipment generation review ${label} batch id`);
        requireText(candidate.rawImage, `Equipment generation review ${label} raw image`);
        requirePngBasename(candidate.rawImage, `Equipment generation review ${label} raw image`);
        requireHash(candidate.rawSha256, `Equipment generation review ${label} raw hash`);
        if (rawCandidates.has(candidate.rawSha256) || rawImages.has(candidate.rawImage)) {
            throw new Error(`Equipment generation review raw candidate is duplicated: ${candidate.rawImage}`);
        }
        rawCandidates.add(candidate.rawSha256);
        rawImages.add(candidate.rawImage);
    };

    for (const candidate of review.accepted) {
        validateCandidate(candidate, ACCEPTED_GENERATION_FIELDS, 'accepted record');
        if (!preparedBatches.has(candidate.batchId) || acceptedBatches.has(candidate.batchId)) {
            throw new Error(`Equipment generation review accepted batch is invalid: ${candidate.batchId}`);
        }
        acceptedBatches.add(candidate.batchId);
    }
    if (acceptedBatches.size !== preparedBatches.size) {
        throw new Error(`Equipment generation review accepted batch coverage is incomplete: ${acceptedBatches.size}/${preparedBatches.size}`);
    }

    for (const candidate of review.rejected) {
        validateCandidate(candidate, REJECTED_GENERATION_FIELDS, 'rejected record');
        if (!preparedBatches.has(candidate.batchId)) {
            throw new Error(`Equipment generation review rejected batch is outside the active cohort: ${candidate.batchId}`);
        }
        requireText(candidate.reason, 'Equipment generation review rejection reason');
    }

    const pinnedHash = manifest?.pipeline?.provenance?.cohorts?.[cohort]?.generationReviewSha256;
    requireHash(pinnedHash, `Equipment generation review pin for ${cohort}`);
    if (hashCanonicalJson(review) !== pinnedHash) {
        throw new Error(`Equipment generation review hash does not match the ${cohort} manifest pin`);
    }
};

export const validateEquipmentArtEvidence = async ({
    catalog,
    manifest,
    provenance,
    cohort,
    sourceDir,
    publicRoot,
    repoRoot,
    requireManifestArtwork = false,
}) => {
    if (!sameKeys(provenance, PROVENANCE_FIELDS) || provenance.version !== 1 || !Array.isArray(provenance.batches)) {
        throw new Error('Equipment provenance top-level schema is invalid');
    }
    const { rows, rowsSha256 } = validateCatalog(catalog, manifest, provenance, cohort);
    const rowsByName = new Map(rows.map((row) => [row.name, row]));
    const batchIds = new Set();
    const names = new Set();
    const runtimePaths = new Set();
    const exportHashes = new Set();
    const sourceSheets = new Set();
    const sourceHashes = new Set();
    const artwork = {};
    const declaredBatchIds = new Set();
    for (const batch of provenance.batches) {
        if (typeof batch?.batchId !== 'string' || !batch.batchId || declaredBatchIds.has(batch.batchId)) {
            throw new Error(`Equipment provenance batch id is invalid: ${String(batch?.batchId)}`);
        }
        declaredBatchIds.add(batch.batchId);
    }
    validateGenerationReview({
        manifest,
        provenance,
        cohort,
        preparedBatches: declaredBatchIds,
    });

    for (const batch of provenance.batches) {
        if (!sameKeys(batch, RECORD_FIELDS)) throw new Error('Equipment provenance batch schema is invalid');
        const { batchId, identityNames, sourceSheetSha256, exports } = batch;
        if (typeof batchId !== 'string' || !batchId || batchIds.has(batchId)) {
            throw new Error(`Equipment provenance batch id is invalid: ${String(batchId)}`);
        }
        if (batch.catalogSha256 !== provenance.catalogSha256
            || batch.catalogRowsSha256 !== rowsSha256
            || batch.cohort !== cohort) {
            throw new Error(`Equipment provenance batch is outside the active evidence: ${batchId}`);
        }
        if (!Array.isArray(identityNames) || identityNames.length < 1 || identityNames.length > CELL_ORDER.length
            || new Set(identityNames).size !== identityNames.length
            || !Array.isArray(exports) || exports.length !== identityNames.length) {
            throw new Error(`Equipment provenance identity order is invalid: ${batchId}`);
        }
        requireHash(sourceSheetSha256, `${batchId} source hash`);
        requirePngBasename(batch.sourceSheet, `${batchId} source sheet`);
        if (batch.sourceSheet !== `${batchId}.png`) {
            throw new Error(`Equipment source sheet is not bound to its tracked batch: ${batchId}`);
        }
        if (sourceSheets.has(batch.sourceSheet) || sourceHashes.has(sourceSheetSha256)) {
            throw new Error(`Equipment source provenance is duplicated: ${batchId}`);
        }
        if (batch.replayKey !== buildReplayKey(batchId, sourceSheetSha256, identityNames)) {
            throw new Error(`Equipment provenance replay key is invalid: ${batchId}`);
        }

        const trackedBatchPath = resolve(sourceDir, 'batches', `${batchId}.json`);
        const trackedBatch = JSON.parse(await readFile(trackedBatchPath, 'utf8'));
        const expectedTrackedBatch = buildEquipmentPromptBatchFromRows({
            catalog,
            catalogSha256: provenance.catalogSha256,
            batchId,
            names: identityNames.join(','),
        });
        const trackedIdentities = trackedBatch?.identities;
        if (hashCanonicalJson(trackedBatch) !== hashCanonicalJson(expectedTrackedBatch)
            || trackedBatch?.version !== 1
            || trackedBatch.batchId !== batchId
            || trackedBatch.catalogSha256 !== provenance.catalogSha256
            || trackedBatch.catalogRowsSha256 !== rowsSha256
            || trackedBatch.cohort !== cohort
            || trackedBatch?.grid?.columns !== 3
            || trackedBatch?.grid?.rows !== 2
            || trackedBatch?.grid?.cellOrder?.join('\0') !== CELL_ORDER.join('\0')
            || trackedBatch?.identityNames?.join('\0') !== identityNames.join('\0')
            || !Array.isArray(trackedIdentities)
            || trackedIdentities.length !== identityNames.length) {
            throw new Error(`Equipment provenance is not bound to its tracked batch: ${batchId}`);
        }
        for (const [index, identity] of trackedIdentities.entries()) {
            const row = rowsByName.get(identityNames[index]);
            if (!row
                || identity.cell !== CELL_ORDER[index]
                || identity.name !== identityNames[index]
                || CATALOG_FIELDS.some((field) => identity[field] !== row[field])) {
                throw new Error(`Equipment tracked batch identity is invalid: ${batchId}`);
            }
        }

        const source = requireChildPath(sourceDir, batch.sourceSheet, `${batchId} source sheet`);
        const sourceBytes = await readFile(source);
        if (hash(sourceBytes) !== sourceSheetSha256) throw new Error(`Equipment source hash mismatch: ${batchId}`);
        const reconstructedExports = await inspectTrackedSource({
            repoRoot,
            trackedBatchPath,
            source,
            publicRoot,
        });
        if (reconstructedExports.length !== exports.length) {
            throw new Error(`Equipment source export count mismatch: ${batchId}`);
        }

        for (const [index, entry] of exports.entries()) {
            if (!sameKeys(entry, EXPORT_FIELDS)
                || entry.cell !== CELL_ORDER[index]
                || entry.name !== identityNames[index]) {
                throw new Error(`Equipment provenance export order is invalid: ${batchId}`);
            }
            const row = rowsByName.get(entry.name);
            if (!row || row.runtimePath !== entry.runtimePath || names.has(entry.name) || runtimePaths.has(entry.runtimePath)) {
                throw new Error(`Equipment provenance export is not a unique catalog identity: ${entry.name}`);
            }
            requireHash(entry.exportSha256, `${entry.name} export hash`);
            const reconstructed = reconstructedExports[index];
            if (reconstructed?.cell !== entry.cell
                || reconstructed?.name !== entry.name
                || reconstructed?.exportSha256 !== entry.exportSha256) {
                throw new Error(`Equipment source does not reproduce its runtime export: ${entry.name}`);
            }
            const runtime = requireChildPath(
                publicRoot,
                entry.runtimePath,
                `${entry.name} runtime export`,
                { allowLeadingSlash: true },
            );
            const runtimeBytes = await readFile(runtime);
            if (hash(runtimeBytes) !== entry.exportSha256) throw new Error(`Equipment runtime hash mismatch: ${entry.name}`);

            if (exportHashes.has(entry.exportSha256)) throw new Error(`Equipment export is duplicated: ${entry.name}`);
            exportHashes.add(entry.exportSha256);

            names.add(entry.name);
            runtimePaths.add(entry.runtimePath);
            artwork[entry.name] = {
                styleVersion: 2,
                familyKey: row.familyKey,
                batchId,
                sourcePath: relative(repoRoot, source).split(sep).join('/'),
                sourceSha256: sourceSheetSha256,
                exportSha256: entry.exportSha256,
            };
        }
        sourceSheets.add(batch.sourceSheet);
        sourceHashes.add(sourceSheetSha256);
        batchIds.add(batchId);
    }

    if (names.size !== rows.length || rows.some((row) => !names.has(row.name))) {
        throw new Error(`Equipment provenance coverage is incomplete: ${names.size}/${rows.length}`);
    }
    if (requireManifestArtwork) {
        for (const row of rows) {
            const actual = manifest.artwork?.[row.name];
            if (!sameKeys(actual, ARTWORK_FIELDS)
                || ARTWORK_FIELDS.some((field) => actual[field] !== artwork[row.name][field])) {
                throw new Error(`${row.name}:artwork metadata mismatch`);
            }
        }
    }
    validateStyleV2ExportHashUniqueness(manifest, { artworkOverrides: artwork });
    return artwork;
};
