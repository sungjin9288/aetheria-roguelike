import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compareCodePoints } from './artCatalog.mjs';

export const CELL_ORDER = Object.freeze([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
]);

const FAMILY_FORMS = Object.freeze({
    'armor-boots': 'one matched pair of sturdy travel boots, visible soles, reinforced toes, and ankle seams',
    'armor-cloak': 'a broad draped mantle with a shoulder clasp, open front, and long flowing split hem',
    'armor-coat': 'a fitted adventurer coat or tunic with collar, belt, sleeves, and practical split hem',
    'armor-leather': 'flexible torso armor with fitted leather panels, stitched seams, straps, and no rigid breastplate',
    'armor-plate': 'rigid steel breastplate with pauldrons, articulated metal panels, rivets, and hard reflective seams',
    'armor-robe': 'full-length cloth caster robe with wide sleeves, layered flowing hem, sash, and ceremonial trim',
    'headgear-cap': 'a compact fitted cloth cap with a short brim and readable crown seam',
    'headgear-circlet': 'an open metal forehead band with a centered jewel, exposed crown, and slender side arms',
    'headgear-helm': 'a protective metal dome with cheek guards, face opening, and modest crest',
    'headgear-hood': 'a deep cloth hood with a dark face opening, folded edge, and short shoulder drape',
    'headgear-mask': 'a face-covering plate with two eye openings, clear jaw edge, and fastening straps',
    'headgear-straw-hat': 'a woven straw hat with a very wide circular brim, low crown, and visible weave',
    'headgear-wizard-hat': 'a tall bent conical crown with a broad shaped brim, band, and restrained magical ornament',
    'offhand-book': 'a closed bound spellbook with rigid cover, visible spine, page block, and centered rune clasp',
    'offhand-shield': 'a protective kite shield with reinforced rim, central boss, grip mass, and readable metal-and-wood structure',
    'weapon-bow': 'a recurved bow with visible string, separated limb tips, wrapped grip, and balanced open silhouette',
    'weapon-dagger': 'a compact single-edged dagger with sharp point, small guard, wrapped grip, and pommel',
    'weapon-heavy': 'a weighty war hammer with broad metal head, reinforced haft, grip, and clear material mass',
    'weapon-lance': 'a long spear with narrow steel head, straight shaft, grip wrap, and balanced counterweight',
    'weapon-staff': 'a vertical mage staff with wooden shaft, open arcane head, suspended focus, and lower ferrule',
    'weapon-sword': 'a straight longsword with distinct blade, crossguard, wrapped grip, pommel, and central fuller',
    'weapon-whip': 'a single curved flexible leather lash with handle, guard ring, tapering body, and controlled tip',
});

const hash = (value) => createHash('sha256').update(value).digest('hex');
const familySetHash = (families) => hash(JSON.stringify(families));
const parseValues = (value) => value.split(',').map((entry) => entry.trim()).filter(Boolean);

const readManifest = async (path) => {
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error(`Equipment manifest must be a JSON object: ${path}`);
    }
    return manifest;
};

export const buildEquipmentFamilyPromptBatch = async ({ manifestPath, batchId, families }) => {
    const requested = parseValues(families);
    if (requested.length < 1 || requested.length > CELL_ORDER.length || new Set(requested).size !== requested.length) {
        throw new Error('Family exemplar prompt batches require one to six unique family keys');
    }

    const manifest = await readManifest(manifestPath);
    const definedFamilies = Object.keys(manifest?.art?.families || {}).sort(compareCodePoints);
    if (definedFamilies.length !== 22 || definedFamilies.some((familyKey) => !FAMILY_FORMS[familyKey])) {
        throw new Error('Equipment manifest must declare the exact 22 Art Bible families');
    }
    if (!/^[0-9a-f]{64}$/.test(manifest.catalogSha256 || '')) {
        throw new Error('Equipment manifest catalogSha256 is invalid');
    }

    const familyKeys = requested.map((familyKey) => {
        if (!definedFamilies.includes(familyKey)) throw new Error(`Unknown equipment family: ${familyKey}`);
        return familyKey;
    }).sort(compareCodePoints);
    const familyAssetRoot = manifest.art.familyAssetRoot;
    if (typeof familyAssetRoot !== 'string' || !familyAssetRoot.startsWith('/')) {
        throw new Error('Equipment manifest familyAssetRoot is invalid');
    }

    const identities = familyKeys.map((familyKey, index) => {
        const runtimePath = manifest.art.families[familyKey]?.runtimePath;
        const expectedPath = `${familyAssetRoot.replace(/\/+$/, '')}/${familyKey}.png`;
        if (runtimePath !== expectedPath) throw new Error(`Equipment family runtime path is invalid: ${familyKey}`);
        return {
            cell: CELL_ORDER[index],
            familyKey,
            runtimePath,
            prompt: `${familyKey} neutral Art Bible exemplar; exact form: ${FAMILY_FORMS[familyKey]}; honest material colors only, no elemental effect, no rarity frame.`,
        };
    });
    const unusedCells = CELL_ORDER.slice(identities.length);
    const prompt = [
        'Aetheria Roguelike neutral equipment-family pixel-art exemplar sheet.',
        `Create a transparent 2x3 grid with ${identities.length} isolated icon${identities.length === 1 ? '' : 's'}, no labels, no text, no border, and equal cell padding.`,
        `Use this fixed row-major cell order: ${CELL_ORDER.join(', ')}.`,
        'Use upper-left light, lower-right shadow, dark-plum two-level outline, at most three internal shades, hard pixel edges, and no gradient, blur, drop shadow, full-canvas glow, rarity frame, or invented item name.',
        'These are family-only Art Bible exemplars, not player equipment identities. Each silhouette must communicate its family at both 160px and 32px through form and material rather than color alone.',
        ...(unusedCells.length ? [`Leave all unused trailing cells completely transparent and empty: ${unusedCells.join(', ')}.`] : []),
        ...identities.map((identity) => `${identity.cell}: ${identity.prompt}`),
    ].join('\n');

    return {
        version: 1,
        batchId,
        catalogSha256: manifest.catalogSha256,
        definedFamiliesSha256: familySetHash(definedFamilies),
        grid: { columns: 3, rows: 2, cellOrder: CELL_ORDER },
        familyKeys,
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
        const option = {
            '--manifest': 'manifestPath',
            '--batch-id': 'batchId',
            '--families': 'families',
            '--output': 'outputPath',
        }[argument];
        const value = args[index + 1];
        if (!option || !value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
        options[option] = value;
        index += 1;
    }
    for (const option of ['manifestPath', 'batchId', 'families']) {
        if (!options[option]) throw new Error(`Missing required family prompt option: ${option}`);
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
        const batch = await buildEquipmentFamilyPromptBatch({
            manifestPath: resolve(options.manifestPath),
            batchId: options.batchId,
            families: options.families,
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
