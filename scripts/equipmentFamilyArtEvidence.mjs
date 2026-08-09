import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { validateStyleV2ExportHashUniqueness } from './equipmentArtEvidence.mjs';

const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const PROVENANCE_FIELDS = [
    'version',
    'catalogSha256',
    'definedFamiliesSha256',
    'generationReview',
    'batches',
];
const RECORD_FIELDS = [
    'batchId',
    'catalogSha256',
    'definedFamiliesSha256',
    'familyKeys',
    'sourceSheet',
    'sourceSheetSha256',
    'replayKey',
    'exports',
];
const EXPORT_FIELDS = ['cell', 'familyKey', 'runtimePath', 'exportSha256'];
const GENERATION_REVIEW_FIELDS = ['tool', 'accepted', 'rejected'];
const ACCEPTED_FIELDS = ['batchId', 'rawImage', 'rawSha256'];
const REJECTED_FIELDS = [...ACCEPTED_FIELDS, 'reason'];
const FAMILY_ART_FIELDS = [
    'runtimePath',
    'styleVersion',
    'batchId',
    'sourcePath',
    'sourceSha256',
    'exportSha256',
];
const SHA256 = /^[0-9a-f]{64}$/;
const PNG_BASENAME = /^[^/\\]+\.png$/;

const hash = (value) => createHash('sha256').update(value).digest('hex');
const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const hashCanonicalJson = (value) => hash(JSON.stringify(canonicalize(value)));
const sameKeys = (value, fields) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...fields].sort().join('\0');
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
const resolveChild = (root, path, label, { allowLeadingSlash = false } = {}) => {
    if (typeof path !== 'string' || !path
        || (isAbsolute(path) && !(allowLeadingSlash && path.startsWith('/')))
        || path.split('/').includes('..')) {
        throw new Error(`${label} has an invalid path`);
    }
    const child = resolve(root, path.replace(/^\/+/, ''));
    const inside = relative(root, child);
    if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
        throw new Error(`${label} escapes its declared root`);
    }
    return child;
};
const definedFamiliesHash = (families) => hash(JSON.stringify(families));
const replayKey = (batchId, sourceSheetSha256, familyKeys) => hash(JSON.stringify({
    batchId,
    sourceSheetSha256,
    familyKeys,
}));

const validateGenerationReview = ({ manifest, provenance, batchIds }) => {
    const review = provenance.generationReview;
    if (!sameKeys(review, GENERATION_REVIEW_FIELDS)
        || !Array.isArray(review.accepted)
        || !Array.isArray(review.rejected)) {
        throw new Error('Family generation review schema is invalid');
    }
    requireText(review.tool, 'Family generation review tool');

    const rawHashes = new Set();
    const rawImages = new Set();
    const acceptedBatches = new Set();
    const validateCandidate = (candidate, fields, label) => {
        if (!sameKeys(candidate, fields)) throw new Error(`Family generation review ${label} schema is invalid`);
        requireText(candidate.batchId, `Family generation review ${label} batch id`);
        requireText(candidate.rawImage, `Family generation review ${label} raw image`);
        requirePngBasename(candidate.rawImage, `Family generation review ${label} raw image`);
        requireHash(candidate.rawSha256, `Family generation review ${label} raw hash`);
        if (rawHashes.has(candidate.rawSha256) || rawImages.has(candidate.rawImage)) {
            throw new Error('Family generation review raw candidate is duplicated');
        }
        rawHashes.add(candidate.rawSha256);
        rawImages.add(candidate.rawImage);
    };
    for (const candidate of review.accepted) {
        validateCandidate(candidate, ACCEPTED_FIELDS, 'accepted record');
        if (!batchIds.has(candidate.batchId) || acceptedBatches.has(candidate.batchId)) {
            throw new Error(`Family generation review accepted batch is invalid: ${candidate.batchId}`);
        }
        acceptedBatches.add(candidate.batchId);
    }
    if (acceptedBatches.size !== batchIds.size) {
        throw new Error(`Family generation review coverage is incomplete: ${acceptedBatches.size}/${batchIds.size}`);
    }
    for (const candidate of review.rejected) {
        validateCandidate(candidate, REJECTED_FIELDS, 'rejected record');
        if (!batchIds.has(candidate.batchId)) {
            throw new Error(`Family generation review rejected batch is invalid: ${candidate.batchId}`);
        }
        requireText(candidate.reason, 'Family generation review rejection reason');
    }
    const pin = manifest?.pipeline?.provenance?.familyExemplars?.generationReviewSha256;
    requireHash(pin, 'Family generation review manifest pin');
    if (hashCanonicalJson(review) !== pin) throw new Error('Family generation review does not match manifest pin');
};

export const validateEquipmentFamilyArtEvidence = async ({
    catalogSha256,
    definedFamilies,
    manifest,
    provenance,
    sourceDir,
    publicRoot,
    repoRoot,
    requireManifestArtwork = false,
}) => {
    if (!Array.isArray(definedFamilies) || definedFamilies.length !== 22
        || new Set(definedFamilies).size !== definedFamilies.length) {
        throw new Error('Live Art Bible must define exactly 22 unique families');
    }
    const families = [...definedFamilies].sort();
    if (!sameKeys(provenance, PROVENANCE_FIELDS) || provenance.version !== 1
        || provenance.catalogSha256 !== catalogSha256
        || provenance.definedFamiliesSha256 !== definedFamiliesHash(families)
        || !Array.isArray(provenance.batches)) {
        throw new Error('Family provenance top-level contract is invalid');
    }
    if (manifest.catalogSha256 !== catalogSha256
        || Object.keys(manifest?.art?.families || {}).sort().join('\0') !== families.join('\0')) {
        throw new Error('Equipment manifest family set is not bound to the live Art Bible');
    }

    const familySet = new Set(families);
    const batchIds = new Set();
    const coveredFamilies = new Set();
    const runtimePaths = new Set();
    const exportHashes = new Set();
    const artwork = {};
    for (const batch of provenance.batches) {
        if (!sameKeys(batch, RECORD_FIELDS)) throw new Error('Family provenance batch schema is invalid');
        const { batchId, familyKeys, sourceSheetSha256, exports } = batch;
        if (typeof batchId !== 'string' || !batchId || batchIds.has(batchId)
            || batch.catalogSha256 !== catalogSha256
            || batch.definedFamiliesSha256 !== provenance.definedFamiliesSha256
            || !Array.isArray(familyKeys)
            || familyKeys.length < 1
            || familyKeys.length > CELL_ORDER.length
            || familyKeys.join('\0') !== [...familyKeys].sort().join('\0')
            || new Set(familyKeys).size !== familyKeys.length
            || !Array.isArray(exports)
            || exports.length !== familyKeys.length) {
            throw new Error(`Family provenance batch contract is invalid: ${String(batchId)}`);
        }
        requireHash(sourceSheetSha256, `${batchId} source hash`);
        if (batch.replayKey !== replayKey(batchId, sourceSheetSha256, familyKeys)) {
            throw new Error(`Family provenance replay key is invalid: ${batchId}`);
        }
        const source = resolveChild(sourceDir, batch.sourceSheet, `${batchId} source`);
        const sourceBytes = await readFile(source);
        if (hash(sourceBytes) !== sourceSheetSha256) throw new Error(`Family source hash mismatch: ${batchId}`);

        for (const [index, entry] of exports.entries()) {
            const familyKey = familyKeys[index];
            if (!sameKeys(entry, EXPORT_FIELDS)
                || entry.cell !== CELL_ORDER[index]
                || entry.familyKey !== familyKey
                || !familySet.has(familyKey)
                || coveredFamilies.has(familyKey)) {
                throw new Error(`Family provenance export is invalid: ${familyKey}`);
            }
            const expectedPath = `/assets/equipment-family/items/${familyKey}.png`;
            if (entry.runtimePath !== expectedPath || runtimePaths.has(entry.runtimePath)) {
                throw new Error(`Family runtime path is invalid: ${familyKey}`);
            }
            requireHash(entry.exportSha256, `${familyKey} export hash`);
            if (exportHashes.has(entry.exportSha256)) {
                throw new Error(`Duplicate family export hash: ${familyKey}`);
            }
            const runtime = resolveChild(publicRoot, entry.runtimePath, `${familyKey} runtime`, { allowLeadingSlash: true });
            const runtimeBytes = await readFile(runtime);
            if (hash(runtimeBytes) !== entry.exportSha256) throw new Error(`Family runtime hash mismatch: ${familyKey}`);

            artwork[familyKey] = {
                runtimePath: entry.runtimePath,
                styleVersion: 2,
                batchId,
                sourcePath: relative(repoRoot, source).split(sep).join('/'),
                sourceSha256: sourceSheetSha256,
                exportSha256: entry.exportSha256,
            };
            coveredFamilies.add(familyKey);
            runtimePaths.add(entry.runtimePath);
            exportHashes.add(entry.exportSha256);
        }
        batchIds.add(batchId);
    }
    if (coveredFamilies.size !== families.length || families.some((familyKey) => !coveredFamilies.has(familyKey))) {
        throw new Error(`Family provenance coverage is incomplete: ${coveredFamilies.size}/${families.length}`);
    }
    validateGenerationReview({ manifest, provenance, batchIds });

    if (requireManifestArtwork) {
        for (const familyKey of families) {
            const actual = manifest.art.families[familyKey];
            const expected = artwork[familyKey];
            if (!sameKeys(actual, FAMILY_ART_FIELDS)
                || FAMILY_ART_FIELDS.some((field) => actual[field] !== expected[field])) {
                throw new Error(`${familyKey}:family artwork metadata mismatch`);
            }
        }
    }
    validateStyleV2ExportHashUniqueness(manifest, { familyOverrides: artwork });
    return artwork;
};
