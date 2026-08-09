import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CLASSES } from '../src/data/classes.ts';
import { ITEMS } from '../src/data/items.ts';
import { getEquipmentIllustrationFamilyKey } from '../src/utils/itemVisuals.ts';

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'shield']);
const FAMILY_ITEMS_DIRECTORY = new URL('../public/assets/equipment-family/items/', import.meta.url);

const byName = (left, right) => left.name.localeCompare(right.name, 'ko');
const byValue = (left, right) => left.localeCompare(right, 'ko');

const assertUniqueNames = (entries, label) => {
    const names = new Set();
    for (const entry of entries) {
        if (!entry.name) throw new Error(`${label} entry is missing a name`);
        if (names.has(entry.name)) throw new Error(`Duplicate ${label} name: ${entry.name}`);
        names.add(entry.name);
    }
};

const defaultDefinedFamilies = () => readdirSync(FAMILY_ITEMS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => entry.name.slice(0, -'.png'.length))
    .sort(byValue);

const normalizeClasses = (classes) => {
    if (Array.isArray(classes)) {
        return classes.map((entry) => ({ name: entry?.name, tier: entry?.tier }));
    }
    return Object.entries(classes || {}).map(([name, value]) => ({ name, tier: value?.tier }));
};

const normalizeEquipment = (items) => (Array.isArray(items) ? items : Object.values(items || {}).flat())
    .filter((item) => item && EQUIPMENT_TYPES.has(item.type));

export const buildArtCatalog = async ({
    classes = CLASSES,
    items = ITEMS,
    getFamilyKey = getEquipmentIllustrationFamilyKey,
    definedFamilies = defaultDefinedFamilies(),
} = {}) => {
    const normalizedClasses = normalizeClasses(classes);
    assertUniqueNames(normalizedClasses, 'class');

    const sourceEquipment = normalizeEquipment(items);
    assertUniqueNames(sourceEquipment, 'equipment');

    const equipment = sourceEquipment.map((item) => {
        const family = getFamilyKey(item);
        if (!family) throw new Error(`Equipment item is missing an illustration family: ${item.name}`);
        return {
            name: item.name,
            type: item.type,
            tier: item.tier || 0,
            elem: item.elem || '',
            family,
        };
    }).sort(byName);

    const classesForIdentity = normalizedClasses.sort(byName);
    const defined = [...definedFamilies].sort(byValue);
    if (new Set(defined).size !== defined.length) throw new Error('Duplicate defined illustration family');

    const identity = { classes: classesForIdentity, equipment };
    const catalogSha256 = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    const usedFamilies = [...new Set(equipment.map((item) => item.family))].sort(byValue);
    const elements = [...new Set(equipment.map((item) => item.elem).filter(Boolean))].sort(byValue);
    const equipmentByType = Object.fromEntries(
        ['weapon', 'armor', 'shield'].map((type) => [type, equipment.filter((item) => item.type === type).length])
    );

    return {
        classes: classesForIdentity,
        equipment,
        equipmentByType,
        definedFamilies: defined,
        usedFamilies,
        elements,
        catalogSha256,
    };
};

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === new URL(process.argv[1], 'file:').pathname;

if (isCli) {
    const catalog = await buildArtCatalog();
    if (process.argv.includes('--stdout')) {
        process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
    }
}
