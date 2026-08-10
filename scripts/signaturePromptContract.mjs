import { createHash } from 'node:crypto';

export const SIGNATURE_CELL_ORDER = Object.freeze([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
]);

const CATALOG_FIELDS = Object.freeze([
    'name',
    'type',
    'tier',
    'elem',
    'familyKey',
    'runtimePath',
    'cohort',
]);
const SHA256 = /^[0-9a-f]{64}$/;

const compactHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const requireText = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is invalid`);
    return value;
};

const buildItemPrompt = (row, registry) => [
    `Signature item illustration for ${row.name}.`,
    `Live identity: type ${row.type}, family ${row.familyKey}, tier ${row.tier}, element ${row.elem || 'none'}.`,
    `Registry art direction: ${registry.artNote}.`,
    'Preserve that named silhouette and material construction; this must not read as a generic family recolor.',
    'One isolated equipment icon only, upper-left light, lower-right shadow, two-level dark outline, transparent background, no text, no frame, no full-canvas aura.',
    'Keep the complete silhouette readable at both 160px and 32px with transparent padding on every side.',
].join(' ');

const buildOverlayPrompt = (row, registry) => [
    `Signature wearable overlay for ${row.name}.`,
    `Live identity: type ${row.type}, family ${row.familyKey}, tier ${row.tier}, element ${row.elem || 'none'}.`,
    `Registry art direction: ${registry.artNote}.`,
    'Draw only the isolated wearable equipment layer that can be composited over the existing 72x72 character avatar; never draw a body, face, hands, base character, text, frame, or background.',
    'Preserve the same named silhouette, material, upper-left light, lower-right shadow, and two-level dark outline as the item illustration.',
    'Keep transparent padding on every side and avoid detached decorative particles that would float away from the equipped object.',
].join(' ');

export const buildSignaturePromptBatchFromRows = ({
    catalog,
    registry,
    catalogSha256,
    batchId,
    names,
}) => {
    if (!Array.isArray(catalog)) throw new Error('Signature catalog must be an array');
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
        throw new Error('Signature registry entries must be an object');
    }
    if (!SHA256.test(catalogSha256 || '')) throw new Error('Signature catalogSha256 is invalid');
    if (typeof batchId !== 'string' || !/^signature-mythic-[a-z0-9-]+$/.test(batchId)) {
        throw new Error('Signature batchId is invalid');
    }

    const identityNames = String(names || '').split(',').map((name) => name.trim()).filter(Boolean);
    if (identityNames.length < 1 || identityNames.length > SIGNATURE_CELL_ORDER.length
        || new Set(identityNames).size !== identityNames.length) {
        throw new Error('Signature batch requires one to six unique names');
    }

    const rowsByName = new Map(catalog.map((row) => [row?.name, row]));
    const families = new Set();
    const identities = identityNames.map((name, index) => {
        const row = rowsByName.get(name);
        if (!row || CATALOG_FIELDS.some((field) => !(field in row)) || row.cohort !== 'signature-mythic') {
            throw new Error(`Signature identity is outside the active catalog cohort: ${name}`);
        }
        const metadata = registry[name];
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
            throw new Error(`Signature identity is missing registry metadata: ${name}`);
        }
        const spriteKey = requireText(metadata.spriteKey, `${name} spriteKey`);
        const tone = requireText(metadata.tone, `${name} tone`);
        const category = requireText(metadata.category, `${name} category`);
        const artNote = requireText(metadata.artNote, `${name} artNote`);
        families.add(row.familyKey);
        return {
            cell: SIGNATURE_CELL_ORDER[index],
            ...Object.fromEntries(CATALOG_FIELDS.map((field) => [field, row[field]])),
            spriteKey,
            signatureTier: requireText(metadata.tier, `${name} signature tier`),
            tone,
            category,
            setGroup: typeof metadata.setGroup === 'string' ? metadata.setGroup : '',
            artNote,
            itemPrompt: buildItemPrompt(row, metadata),
            overlayPrompt: buildOverlayPrompt(row, metadata),
        };
    });
    if (families.size !== 1) throw new Error('Signature batch identities must share one illustration family');

    const unusedCells = SIGNATURE_CELL_ORDER.slice(identities.length);
    const shared = [
        'Aetheria Roguelike signature equipment source sheet.',
        `Create a transparent 2x3 grid with ${identities.length} isolated ${identities.length === 1 ? 'identity' : 'identities'} in fixed row-major order: ${SIGNATURE_CELL_ORDER.join(', ')}.`,
        'No labels, text, border, character body, shared pedestal, or object may touch or cross a cell boundary.',
        'Every used cell must contain transparent padding and every identity must differ by silhouette and construction, not color alone.',
        ...(unusedCells.length ? [`Leave unused trailing cells completely transparent: ${unusedCells.join(', ')}.`] : []),
    ];

    return {
        version: 1,
        batchId,
        catalogSha256,
        catalogRowsSha256: compactHash(catalog),
        cohort: 'signature-mythic',
        grid: { columns: 3, rows: 2, cellOrder: SIGNATURE_CELL_ORDER },
        identityNames,
        identities,
        itemPrompt: [
            ...shared,
            'Surface: item icon master. Use the full equipment silhouette with upper-left light and readable 160px/32px detail.',
            ...identities.map((identity) => `${identity.cell}: ${identity.itemPrompt}`),
        ].join('\n'),
        overlayPrompt: [
            ...shared,
            'Surface: wearable overlay master. Draw isolated wearable overlay layers for the existing 72x72 avatar and no character body.',
            ...identities.map((identity) => `${identity.cell}: ${identity.overlayPrompt}`),
        ].join('\n'),
    };
};
