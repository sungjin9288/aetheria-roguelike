import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const CATALOG_FIELDS = ['name', 'type', 'tier', 'elem', 'familyKey', 'runtimePath', 'cohort'];
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
const ARTWORK_FIELDS = ['styleVersion', 'familyKey', 'batchId', 'sourcePath', 'sourceSha256', 'exportSha256'];
const SHA256 = /^[0-9a-f]{64}$/;

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
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

const buildReplayKey = (batchId, sourceSheetSha256, identityNames) => hash(JSON.stringify({
    batchId,
    sourceSheetSha256,
    identityNames,
}));

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
    if (!provenance || provenance.version !== 1 || !Array.isArray(provenance.batches)) {
        throw new Error('Equipment provenance shape is invalid');
    }
    const { rows, rowsSha256 } = validateCatalog(catalog, manifest, provenance, cohort);
    const rowsByName = new Map(rows.map((row) => [row.name, row]));
    const batchIds = new Set();
    const names = new Set();
    const runtimePaths = new Set();
    const familyHashes = new Map();
    const artwork = {};

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
        if (batch.replayKey !== buildReplayKey(batchId, sourceSheetSha256, identityNames)) {
            throw new Error(`Equipment provenance replay key is invalid: ${batchId}`);
        }

        const source = requireChildPath(sourceDir, batch.sourceSheet, `${batchId} source sheet`);
        const sourceBytes = await readFile(source);
        if (hash(sourceBytes) !== sourceSheetSha256) throw new Error(`Equipment source hash mismatch: ${batchId}`);

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
            const runtime = requireChildPath(
                publicRoot,
                entry.runtimePath,
                `${entry.name} runtime export`,
                { allowLeadingSlash: true },
            );
            const runtimeBytes = await readFile(runtime);
            if (hash(runtimeBytes) !== entry.exportSha256) throw new Error(`Equipment runtime hash mismatch: ${entry.name}`);

            const hashes = familyHashes.get(row.familyKey) || new Set();
            if (hashes.has(entry.exportSha256)) throw new Error(`Equipment family export is duplicated: ${entry.name}`);
            hashes.add(entry.exportSha256);
            familyHashes.set(row.familyKey, hashes);

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
    return artwork;
};
