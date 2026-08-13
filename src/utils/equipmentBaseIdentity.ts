import equipmentArtManifest from '../data/equipmentArtManifest.json' with { type: 'json' };
import { CLASSES } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import { getShopCatalog } from './shopRotation.js';
import type { Item } from '../types/item.js';

export const EQUIPMENT_TYPES = ['weapon', 'armor', 'shield'] as const;
export type EquipmentType = typeof EQUIPMENT_TYPES[number];

type CanonicalEquipment = Item & {
    name: string;
    type: EquipmentType;
    tier: number;
    price: number;
    val: number;
    jobs: string[];
};

type EquipmentCatalogOptions = {
    rows?: readonly Item[];
    artEntries?: Record<string, unknown>;
    signatures?: Record<string, any>;
    shopRows?: readonly Item[];
};

const isEquipmentType = (type: unknown): type is EquipmentType => (
    typeof type === 'string' && (EQUIPMENT_TYPES as readonly string[]).includes(type)
);

export const isEquipmentItem = (item: any): item is CanonicalEquipment => isEquipmentType(item?.type);

export const getEquipmentIdentityKey = (type: EquipmentType, name: string) => `${type}\0${name}`;

const compareEquipmentIdentity = (left: CanonicalEquipment, right: CanonicalEquipment) => {
    const leftKey = getEquipmentIdentityKey(left.type, left.name);
    const rightKey = getEquipmentIdentityKey(right.type, right.name);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

const getSourceRows = (): Item[] => [
    ...(ITEMS.weapons || []),
    ...(ITEMS.armors || []),
];

const CANONICAL_JOB_NAMES = new Set(Object.keys(CLASSES));

const getSignatureType = (spriteKey: unknown): EquipmentType | null => {
    if (typeof spriteKey !== 'string') return null;
    if (spriteKey.startsWith('signature-weapon-')) return 'weapon';
    if (spriteKey.startsWith('signature-armor-')) return 'armor';
    if (spriteKey.startsWith('signature-shield-')) return 'shield';
    return null;
};

const failClosed = (errors: string[]): never => {
    throw new Error(`Invalid canonical equipment catalog: ${errors.join('; ')}`);
};

/**
 * Static equipment data is an authority boundary: a broken catalog must not be
 * silently accepted by item creation, migration, shop, or audit paths.
 */
export const validateCanonicalEquipmentCatalog = (
    options: EquipmentCatalogOptions = {},
): CanonicalEquipment[] => {
    const rows = [...(options.rows || getSourceRows())] as any[];
    const artEntries = options.artEntries || (equipmentArtManifest as any).entries;
    const signatures = options.signatures || SIGNATURE_ITEM_REGISTRY;
    const errors: string[] = [];

    if (rows.length !== 229) errors.push(`expected 229 equipment rows, received ${rows.length}`);

    const identities = new Set<string>();
    const names = new Set<string>();
    const counts: Record<EquipmentType, number> = { weapon: 0, armor: 0, shield: 0 };
    for (const row of rows) {
        if (!isEquipmentType(row?.type)) {
            errors.push(`invalid equipment type for ${String(row?.name)}`);
            continue;
        }
        if (typeof row.name !== 'string' || row.name.length === 0) {
            errors.push(`invalid equipment name for ${String(row?.type)}`);
            continue;
        }
        const type = row.type as EquipmentType;
        const identity = getEquipmentIdentityKey(type, row.name);
        if (identities.has(identity)) errors.push(`duplicate equipment identity ${identity}`);
        identities.add(identity);
        if (names.has(row.name)) errors.push(`duplicate equipment art identity ${row.name}`);
        names.add(row.name);
        counts[type] += 1;

        if (!Number.isSafeInteger(row.tier) || row.tier < 1 || row.tier > 6) {
            errors.push(`invalid tier for ${identity}`);
        }
        if (!Number.isSafeInteger(row.price) || row.price <= 0) {
            errors.push(`invalid price for ${identity}`);
        }
        if (!Number.isFinite(row.val) || row.val <= 0) {
            errors.push(`invalid stat for ${identity}`);
        }
        if ((type === 'weapon' && row.hands !== undefined && row.hands !== 1 && row.hands !== 2)
            || (type !== 'weapon' && row.hands !== undefined)) {
            errors.push(`invalid hands for ${identity}`);
        }
        for (const field of ['crit', 'mp', 'mpBonus', 'hp', 'hpBonus', 'evasion']) {
            if (row[field] !== undefined && !Number.isFinite(row[field])) {
                errors.push(`invalid ${field} for ${identity}`);
            }
        }
        if (!Array.isArray(row.jobs) || row.jobs.length === 0
            || row.jobs.some((job: any) => typeof job !== 'string' || job.length === 0)
            || new Set(row.jobs).size !== row.jobs.length) {
            errors.push(`invalid job route for ${identity}`);
        } else {
            for (const job of row.jobs) {
                if (!CANONICAL_JOB_NAMES.has(job)) {
                    errors.push(`unknown canonical job ${job} for ${identity}`);
                }
            }
        }
    }

    if (counts.weapon !== 117 || counts.armor !== 91 || counts.shield !== 21) {
        errors.push(`invalid equipment cohorts weapon=${counts.weapon} armor=${counts.armor} shield=${counts.shield}`);
    }

    if (!artEntries || typeof artEntries !== 'object' || Array.isArray(artEntries)) {
        errors.push('invalid equipment art routes');
    } else {
        const routes = artEntries as Record<string, unknown>;
        if (Object.keys(routes).length !== rows.length) errors.push('invalid equipment art route count');
        for (const row of rows) {
            if (!row?.name) continue;
            const route = routes[row.name];
            if (typeof route !== 'string' || route.length === 0) {
                errors.push(`invalid art route for ${row.name}`);
            }
        }
        for (const routeName of Object.keys(routes)) {
            if (!names.has(routeName)) errors.push(`orphan art route for ${routeName}`);
        }
    }

    if (!signatures || typeof signatures !== 'object' || Array.isArray(signatures)) {
        errors.push('invalid equipment signature registry');
    } else {
        const routes = (artEntries || {}) as Record<string, unknown>;
        for (const [name, signature] of Object.entries(signatures)) {
            const row = rows.find((item) => item.name === name);
            const signatureType = getSignatureType((signature as any)?.spriteKey);
            if (!row || !signatureType || row.type !== signatureType
                || routes[name] !== (signature as any).spriteKey) {
                errors.push(`invalid signature route for ${name}`);
            }
        }
        for (const row of rows) {
            const route = routes[row.name];
            if (typeof route === 'string' && route.startsWith('signature-')
                && (signatures as Record<string, any>)[row.name]?.spriteKey !== route) {
                errors.push(`missing signature metadata for ${row.name}`);
            }
        }
    }

    const shopRows = options.shopRows || getShopCatalog('황금 왕국');
    const shopIdentities = new Set(
        shopRows
            .filter((row: any) => isEquipmentType(row?.type))
            .map((row: any) => getEquipmentIdentityKey(row.type, row.name)),
    );
    for (const row of rows) {
        if (!isEquipmentType(row?.type) || typeof row?.name !== 'string') continue;
        if (!shopIdentities.has(getEquipmentIdentityKey(row.type, row.name))) {
            errors.push(`invalid shop route for ${row.type}:${row.name}`);
        }
    }

    if (errors.length > 0) failClosed(errors);
    return rows.sort(compareEquipmentIdentity) as CanonicalEquipment[];
};

export const CANONICAL_EQUIPMENT = Object.freeze(
    validateCanonicalEquipmentCatalog().map((row) => Object.freeze({ ...row })),
) as readonly CanonicalEquipment[];

const EQUIPMENT_BY_IDENTITY = new Map(
    CANONICAL_EQUIPMENT.map((item) => [getEquipmentIdentityKey(item.type, item.name), item]),
);
const PREFIX_BY_NAME = new Map(
    (ITEMS.prefixes || []).map((prefix: any) => [prefix.name, prefix]),
);

const getCompatiblePrefix = (item: any) => {
    if (!isEquipmentItem(item) || item?.prefixed !== true || typeof item?.prefixName !== 'string') return null;
    const prefix = PREFIX_BY_NAME.get(item.prefixName);
    const prefixTargetType = item.type === 'shield' ? 'armor' : item.type;
    if (!prefix || (prefix.type !== 'all' && prefix.type !== prefixTargetType)) return null;
    if (!Number.isFinite(prefix.price) || prefix.price <= 0) return null;
    return prefix;
};

export const resolveEquipmentBaseIdentity = (item: any): CanonicalEquipment | null => {
    if (!isEquipmentItem(item)) return null;
    if (item?.prefixed !== undefined && typeof item.prefixed !== 'boolean') return null;
    if (item?.prefixName !== undefined && item?.prefixed !== true) return null;
    const prefix = getCompatiblePrefix(item);
    if (item?.prefixed === true && !prefix) return null;

    if (Object.prototype.hasOwnProperty.call(item, 'baseItemName')) {
        if (typeof item.baseItemName !== 'string' || typeof item.name !== 'string') return null;
        const base = EQUIPMENT_BY_IDENTITY.get(getEquipmentIdentityKey(item.type, item.baseItemName));
        if (!base) return null;
        const expectedName = prefix ? `${prefix.name} ${base.name}` : base.name;
        return item.name === expectedName ? base : null;
    }

    if (typeof item.name !== 'string') return null;
    const exact = EQUIPMENT_BY_IDENTITY.get(getEquipmentIdentityKey(item.type, item.name));
    if (exact) return exact;

    if (!prefix) return null;
    const expectedPrefix = `${prefix.name} `;
    if (!item.name.startsWith(expectedPrefix)) return null;
    const baseName = item.name.slice(expectedPrefix.length);
    const base = EQUIPMENT_BY_IDENTITY.get(getEquipmentIdentityKey(item.type, baseName));
    return base && item.name === `${prefix.name} ${base.name}` ? base : null;
};

/** Add the optional identity tag only when an exact canonical equipment base exists. */
export const withCanonicalEquipmentBaseIdentity = <T>(item: T): T => {
    const base = resolveEquipmentBaseIdentity(item);
    if (!base || (item as any)?.baseItemName === base.name) return item;
    return { ...(item as any), baseItemName: base.name } as T;
};

export const getCanonicalEquipmentPrice = (item: any): number | null => {
    const base = resolveEquipmentBaseIdentity(item);
    if (!base) return null;
    if (item?.prefixed !== true) return base.price;
    const prefix = getCompatiblePrefix(item);
    return prefix ? Math.floor(base.price * prefix.price) : null;
};

/**
 * Price-only migration: known equipment gets its corrected canonical price and
 * persisted base identity; anything unresolved is returned byte-for-byte intact.
 */
export const migrateEquipmentInstancePrice = <T>(item: T): T => {
    const base = resolveEquipmentBaseIdentity(item);
    const price = getCanonicalEquipmentPrice(item);
    if (!base || price === null) return item;
    if ((item as any).baseItemName === base.name && (item as any).price === price) return item;
    return { ...(item as any), baseItemName: base.name, price } as T;
};

export const migrateEquipmentPrice = migrateEquipmentInstancePrice;
