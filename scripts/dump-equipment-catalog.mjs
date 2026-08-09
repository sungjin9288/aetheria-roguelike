import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import signatureRegistry from '../src/data/signatureRegistry.json' with { type: 'json' };
import { ITEMS } from '../src/data/items.ts';
import { getItemIconAssetSrc } from '../src/utils/itemVisuals.ts';
import { buildArtCatalog, compareCodePoints } from './artCatalog.mjs';

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'shield']);

export const COHORT_BY_FAMILY = Object.freeze({
    'weapon-sword': 'weapon-core',
    'weapon-dagger': 'weapon-core',
    'weapon-heavy': 'weapon-core',
    'weapon-bow': 'weapon-ranged-magic',
    'weapon-staff': 'weapon-ranged-magic',
    'weapon-lance': 'weapon-ranged-magic',
    'weapon-whip': 'weapon-ranged-magic',
    'offhand-shield': 'offhand-headgear',
    'offhand-book': 'offhand-headgear',
});

const signatureNames = new Set(Object.keys(signatureRegistry.entries));

export const getEquipmentCohort = ({ name, familyKey }) => {
    if (signatureNames.has(name)) return 'signature-mythic';
    if (COHORT_BY_FAMILY[familyKey]) return COHORT_BY_FAMILY[familyKey];
    if (familyKey.startsWith('headgear-')) return 'offhand-headgear';
    if (familyKey.startsWith('armor-')) return 'armor';
    throw new Error(`Unknown equipment family cohort: ${familyKey}`);
};

const currentEquipmentByName = () => new Map(
    Object.values(ITEMS)
        .flat()
        .filter((item) => item && EQUIPMENT_TYPES.has(item.type))
        .map((item) => [item.name, item])
);

export const buildEquipmentCatalogRows = async () => {
    const catalog = await buildArtCatalog();
    const equipmentByName = currentEquipmentByName();
    return catalog.equipment.map((entry) => {
        const item = equipmentByName.get(entry.name);
        if (!item) throw new Error(`Current equipment item is missing from runtime catalog: ${entry.name}`);

        const familyKey = entry.family;
        const runtimePath = getItemIconAssetSrc(item);
        if (!runtimePath) throw new Error(`Current equipment item is missing a runtime path: ${entry.name}`);

        return {
            name: entry.name,
            type: entry.type,
            tier: entry.tier,
            elem: entry.elem,
            familyKey,
            runtimePath,
            cohort: getEquipmentCohort({ name: entry.name, familyKey }),
        };
    }).sort((left, right) => compareCodePoints(left.name, right.name));
};

const parseCli = (args) => {
    if (args.length === 1 && args[0] === '--stdout') return { stdout: true };
    if (args.length === 2 && args[0] === '--output' && args[1] && !args[1].startsWith('--')) {
        return { outputPath: resolve(args[1]) };
    }
    throw new Error('Usage: dump-equipment-catalog.mjs --output <path> | --stdout');
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
    try {
        const options = parseCli(process.argv.slice(2));
        const output = `${JSON.stringify(await buildEquipmentCatalogRows(), null, 2)}\n`;
        if (options.stdout) {
            process.stdout.write(output);
        } else {
            await mkdir(dirname(options.outputPath), { recursive: true });
            await writeFile(options.outputPath, output, 'utf8');
        }
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}
