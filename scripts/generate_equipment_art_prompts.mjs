import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildArtCatalog, compareCodePoints } from './artCatalog.mjs';

export const CELL_ORDER = Object.freeze([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
]);

const FAMILY_LANGUAGE = Object.freeze({
    'weapon-sword': 'weapon-sword family: a distinct blade profile, guard, grip, and central ornament',
    'weapon-dagger': 'weapon-dagger family: a compact blade, asymmetric grip, and readable point',
    'weapon-heavy': 'weapon-heavy family: a weighty head or broad blade, reinforced handle, and material mass',
    'weapon-bow': 'weapon-bow family: a clear bow curve, string, limb tips, and grip',
    'weapon-staff': 'weapon-staff family: a vertical shaft, distinctive head, and central focus',
    'weapon-lance': 'weapon-lance family: a long shaft, readable spearhead, and balanced counterweight',
    'weapon-whip': 'weapon-whip family: a curved flexible lash, handle, and controlled tip',
    'offhand-shield': 'offhand-shield family: a protective outer contour, central boss, and rim material',
    'offhand-book': 'offhand-book family: a readable cover, binding, and central page or rune detail',
    'headgear-straw-hat': 'headgear-straw-hat family: a wide woven brim and crown',
    'headgear-cap': 'headgear-cap family: a compact cap silhouette and clear material break',
    'headgear-wizard-hat': 'headgear-wizard-hat family: a tall shaped brim and magical crown',
    'headgear-circlet': 'headgear-circlet family: an open metal band and centered jewel or crest',
    'headgear-helm': 'headgear-helm family: a protective dome, face opening, and crest',
    'headgear-hood': 'headgear-hood family: a deep cloth opening, folded edge, and drape',
    'headgear-mask': 'headgear-mask family: a face-covering plate, eye opening, and edge silhouette',
    'armor-coat': 'armor-coat family: a layered coat body, collar, and hem',
    'armor-leather': 'armor-leather family: fitted leather panels, straps, and flexible seams',
    'armor-robe': 'armor-robe family: a flowing cloth body, sleeves, and ceremonial trim',
    'armor-plate': 'armor-plate family: hard plate panels, shoulder mass, and metal seams',
    'armor-cloak': 'armor-cloak family: a broad draped outer contour, clasp, and flowing hem',
    'armor-boots': 'armor-boots family: paired boot silhouette, sole, and ankle material break',
});

const TIER_LANGUAGE = Object.freeze({
    0: 'plain training-grade construction with one honest material and an immediately readable purpose',
    1: 'worn wood, iron, or cloth with simple practical construction',
    2: 'orderly craftsmanship with two materials and a small functional ornament',
    3: 'regional craft character expressed through the form and material treatment',
    4: 'an elemental core and magical fabrication integrated into the structure',
    5: 'a memorable signature silhouette with legendary materials and ornament density',
    6: 'a mythic structure changed by aether, void, or dimensional technology',
});

const ELEMENT_LANGUAGE = Object.freeze({
    '': 'no elemental effect; preserve the material and silhouette without a background glow',
    '화염': 'dark-red metal, cracked surface, orange fissures, and small embers',
    '냉기': 'blue-white crystal, sharp edges, frost, and cold reflected light',
    '빛': 'ivory metal, gold engraving, sky-blue light points, and clean rays',
    '어둠': 'black material, inward-fading planes, purple inner light, and flowing haze',
    '대지': 'stone, brass, angular crystal, heavy fragments, and low sheen',
    '자연': 'wood, leather, living material, vines, and teal life light',
    '바람': 'thin curved lines, an open structure, and pale teal flow',
    '에테르': 'separated pieces, grid structure, and purple-teal spatial cracks',
});

const CATALOG_ROW_FIELDS = Object.freeze([
    'name',
    'type',
    'tier',
    'elem',
    'familyKey',
    'runtimePath',
    'cohort',
]);

const parseNames = (value) => value.split(',').map((name) => name.trim()).filter(Boolean);

const readCatalog = async (path) => {
    const catalog = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(catalog)) throw new Error(`Catalog must be a JSON array: ${path}`);
    return catalog;
};

const catalogRowsSha256 = (catalog) => {
    const rows = catalog.map((entry) => Object.fromEntries(
        CATALOG_ROW_FIELDS.map((field) => [field, entry?.[field]])
    ));
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
};

const makeCellPrompt = (entry) => {
    const tier = Number(entry.tier);
    const family = FAMILY_LANGUAGE[entry.familyKey];
    const tierLanguage = TIER_LANGUAGE[tier];
    const elementLanguage = ELEMENT_LANGUAGE[entry.elem || ''];
    if (!family || !tierLanguage || !elementLanguage) {
        throw new Error(`Art Bible language is missing for ${entry.name}`);
    }
    return `${entry.name}; family ${entry.familyKey}: ${family}; Tier T${tier}: ${tierLanguage}; element ${entry.elem || 'none'}: ${elementLanguage}.`;
};

export const buildEquipmentPromptBatch = async ({ catalogPath, batchId, names }) => {
    const requestedNames = parseNames(names);
    if (
        requestedNames.length < 1
        || requestedNames.length > CELL_ORDER.length
        || new Set(requestedNames).size !== requestedNames.length
    ) {
        throw new Error('Equipment prompt batches require one to six unique catalog identities');
    }

    const catalog = await readCatalog(catalogPath);
    const authoritativeCatalog = await buildArtCatalog();
    const byName = new Map(catalog.map((entry) => [entry?.name, entry]));
    const selected = requestedNames.map((name) => {
        const entry = byName.get(name);
        if (!entry) throw new Error(`Catalog identity is missing from prompt batch: ${name}`);
        return entry;
    }).sort((left, right) => compareCodePoints(left.name, right.name));
    const cohort = selected[0].cohort;
    if (!cohort || selected.some((entry) => entry.cohort !== cohort)) {
        throw new Error('Equipment prompt batch identities must share one cohort');
    }

    const identities = selected.map((entry, index) => ({
        cell: CELL_ORDER[index],
        name: entry.name,
        type: entry.type,
        tier: entry.tier,
        elem: entry.elem || '',
        familyKey: entry.familyKey,
        runtimePath: entry.runtimePath,
        cohort: entry.cohort,
        prompt: makeCellPrompt(entry),
    }));
    const identityNames = identities.map((entry) => entry.name);
    const unusedCells = CELL_ORDER.slice(identities.length);
    const grid = { columns: 3, rows: 2, cellOrder: CELL_ORDER };
    const iconCount = identities.length === CELL_ORDER.length ? 'six' : String(identities.length);
    const prompt = [
        'Aetheria Roguelike equipment pixel-art source sheet.',
        `Create a transparent 2x3 grid with ${iconCount} isolated icon${identities.length === 1 ? '' : 's'}, no labels, no text, no border, and equal cell padding.`,
        `Use this fixed row-major cell order: ${CELL_ORDER.join(', ')}.`,
        'Use upper-left light, lower-right shadow, two-level dark outline, transparent background, and no full-canvas glow.',
        'Keep every silhouette readable at 32px as well as 160px, with no part crossing or touching its cell boundary.',
        'Within the same family, every pair must differ in at least two of blade or body shape, handle, central ornament, and material; color alone never counts.',
        ...(unusedCells.length
            ? [`Leave all unused trailing cells completely transparent and empty: ${unusedCells.join(', ')}.`]
            : []),
        ...identities.map((entry) => `${entry.cell}: ${entry.prompt}`),
    ].join('\n');

    return {
        version: 1,
        batchId,
        catalogSha256: authoritativeCatalog.catalogSha256,
        catalogRowsSha256: catalogRowsSha256(catalog),
        cohort,
        grid,
        identityNames,
        identities,
        prompt,
    };
};

const parseCli = (args) => {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--stdout') {
            options.stdout = true;
            continue;
        }
        const optionName = {
            '--catalog': 'catalogPath',
            '--batch-id': 'batchId',
            '--names': 'names',
            '--output': 'outputPath',
        }[argument];
        const value = args[index + 1];
        if (!optionName || !value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
        options[optionName] = value;
        index += 1;
    }
    for (const optionName of ['catalogPath', 'batchId', 'names']) {
        if (!options[optionName]) throw new Error(`Missing required option: --${optionName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
    }
    if (Boolean(options.stdout) === Boolean(options.outputPath)) {
        throw new Error('Choose exactly one output mode: --output <path> or --stdout');
    }
    return options;
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
    try {
        const options = parseCli(process.argv.slice(2));
        const batch = await buildEquipmentPromptBatch({
            catalogPath: resolve(options.catalogPath),
            batchId: options.batchId,
            names: options.names,
        });
        const output = `${JSON.stringify(batch, null, 2)}\n`;
        if (options.stdout) {
            process.stdout.write(output);
        } else {
            const outputPath = resolve(options.outputPath);
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, output, 'utf8');
        }
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}
