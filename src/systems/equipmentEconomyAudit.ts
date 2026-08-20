import {
    CANONICAL_EQUIPMENT,
    getEquipmentIdentityKey,
    resolveEquipmentBaseIdentity,
    validateCanonicalEquipmentCatalog,
} from '../utils/equipmentBaseIdentity.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import equipmentArtManifest from '../data/equipmentArtManifest.json' with { type: 'json' };
import { getShopCatalog } from '../utils/shopRotation.js';

// These are SHA-256 values over the stable JSON projections below. Hashing is
// deliberately performed only by the strict Node CLI via node:crypto.
export const EQUIPMENT_ECONOMY_PREDECESSOR_DIGEST = '25eac085e5b5f48f44632346fe8b767b50d36b8665166175b3b8fc2fcaf72119';
export const EQUIPMENT_ECONOMY_CANDIDATE_DIGEST = '6e3fb6effec3b88a95849a2cfbb74502f21accf777a24597129068625ec5af8f';
export const EQUIPMENT_ECONOMY_PRICE_REMOVED_INVARIANT = '9a4bfd472a7ad47c990a00fcf9d949f0c2bab11905d5eb9dd2800170bd2df644';

export const APPROVED_EQUIPMENT_PRICE_CORRECTIONS = Object.freeze([
    { type: 'weapon', name: '암흑 단검', predecessorPrice: 1000, candidatePrice: 4500 },
    { type: 'weapon', name: '빙결 지팡이', predecessorPrice: 1100, candidatePrice: 5200 },
    { type: 'weapon', name: '에테르 검', predecessorPrice: 1200, candidatePrice: 5500 },
    { type: 'weapon', name: '폭풍의 창', predecessorPrice: 1400, candidatePrice: 6000 },
    { type: 'weapon', name: '용암 대검', predecessorPrice: 1500, candidatePrice: 7000 },
    { type: 'weapon', name: '차원절단자', predecessorPrice: 2500, candidatePrice: 22000 },
    { type: 'weapon', name: '빙하의 지팡이', predecessorPrice: 2800, candidatePrice: 24000 },
    { type: 'weapon', name: '파멸의 검', predecessorPrice: 3000, candidatePrice: 24000 },
    { type: 'weapon', name: '성스러운 창', predecessorPrice: 3500, candidatePrice: 23500 },
    { type: 'weapon', name: '용의 화염', predecessorPrice: 4000, candidatePrice: 25500 },
    { type: 'armor', name: '암영 망토', predecessorPrice: 900, candidatePrice: 4000 },
    { type: 'armor', name: '상급 폭풍 로브', predecessorPrice: 1000, candidatePrice: 4500 },
    { type: 'armor', name: '빙화 경갑', predecessorPrice: 1100, candidatePrice: 4500 },
    { type: 'armor', name: '에테르 갑옷', predecessorPrice: 1200, candidatePrice: 4900 },
    { type: 'armor', name: '용암 판금갑', predecessorPrice: 1500, candidatePrice: 5400 },
    { type: 'armor', name: '공허의 전투 외투', predecessorPrice: 2000, candidatePrice: 12000 },
    { type: 'armor', name: '차원의 로브', predecessorPrice: 2500, candidatePrice: 13500 },
    { type: 'armor', name: '천상의 갑옷', predecessorPrice: 3000, candidatePrice: 14500 },
    { type: 'armor', name: '별빛 경갑', predecessorPrice: 3500, candidatePrice: 13500 },
    { type: 'armor', name: '용비늘 갑주', predecessorPrice: 4000, candidatePrice: 16500 },
] as const);

export const APPROVED_EQUIPMENT_SIDEGRADE_CORRECTIONS = Object.freeze([
    {
        type: 'armor',
        name: '레인저 외투',
        predecessor: { desc_stat: 'DEF+13' },
        candidate: { evasion: 0.03, desc_stat: 'DEF+13 / 회피+3%' },
    },
    {
        type: 'weapon',
        name: '독아 채찍',
        predecessor: { desc_stat: 'ATK+47(독)' },
        candidate: { crit: 0.09, desc_stat: 'ATK+47(독) / CRIT+9%' },
    },
    {
        type: 'weapon',
        name: '성운 지팡이',
        predecessor: { desc_stat: 'ATK+195(빛) / 2H' },
        candidate: { mpBonus: 20, desc_stat: 'ATK+195(빛) / MP+20 / 2H' },
    },
    {
        type: 'weapon',
        name: '폭풍 스태프',
        predecessor: { desc_stat: 'ATK+56(빛) / 2H' },
        candidate: { mpBonus: 10, desc_stat: 'ATK+56(빛) / MP+10 / 2H' },
    },
] as const);

type PriceCorrection = typeof APPROVED_EQUIPMENT_PRICE_CORRECTIONS[number];
type SidegradeCorrection = typeof APPROVED_EQUIPMENT_SIDEGRADE_CORRECTIONS[number];
type AuditOptions = {
    rows?: readonly any[];
    artEntries?: Record<string, unknown>;
    signatures?: Record<string, any>;
    shopRows?: readonly any[];
    identitySamples?: readonly any[];
};

const compareIdentity = (left: { type: string; name: string }, right: { type: string; name: string }) => {
    const leftKey = getEquipmentIdentityKey(left.type as any, left.name);
    const rightKey = getEquipmentIdentityKey(right.type as any, right.name);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

/** Stable UTF-16-key projection used as the CLI's hash preimage. */
export const stableCanonicalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(stableCanonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value)
            .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
            .map((key) => [key, stableCanonicalize(value[key])]),
    );
};

const sortRows = (rows: readonly any[]) => [...rows]
    .map(stableCanonicalize)
    .sort(compareIdentity);

const correctionByIdentity = new Map<string, PriceCorrection>(
    APPROVED_EQUIPMENT_PRICE_CORRECTIONS.map((row) => [getEquipmentIdentityKey(row.type, row.name), row]),
);
const sidegradeCorrectionByIdentity = new Map<string, SidegradeCorrection>(
    APPROVED_EQUIPMENT_SIDEGRADE_CORRECTIONS.map((row) => [getEquipmentIdentityKey(row.type, row.name), row]),
);
const SIDEGRADE_SECONDARY_FIELDS = ['crit', 'mp', 'mpBonus', 'hp', 'hpBonus', 'evasion'];

const finiteNumbers = (values: readonly unknown[]) => values
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

const summarizeNumbers = (values: readonly unknown[]) => {
    const valid = finiteNumbers(values).sort((left, right) => left - right);
    if (valid.length === 0) {
        return {
            count: 0,
            min: null,
            max: null,
            total: 0,
            average: null,
            median: null,
        };
    }
    const total = valid.reduce((sum, value) => sum + value, 0);
    const middle = Math.floor(valid.length / 2);
    const median = valid.length % 2 === 0
        ? (valid[middle - 1] + valid[middle]) / 2
        : valid[middle];
    return {
        count: valid.length,
        min: valid[0],
        max: valid[valid.length - 1],
        total,
        average: Number((total / valid.length).toFixed(6)),
        median,
    };
};

const getCohortStatistics = (rows: readonly any[]) => {
    const cohorts = new Map<string, any[]>();
    for (const row of rows) {
        const key = `${row.type}:T${row.tier}`;
        const cohort = cohorts.get(key) || [];
        cohort.push(row);
        cohorts.set(key, cohort);
    }
    return [...cohorts.entries()]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([cohort, cohortRows]) => {
            const ratios: number[] = [];
            let zeroDenominatorCount = 0;
            for (const row of cohortRows) {
                if (!Number.isFinite(row.val) || row.val === 0) {
                    zeroDenominatorCount += 1;
                } else if (Number.isFinite(row.price)) {
                    ratios.push(row.price / row.val);
                }
            }
            const price = summarizeNumbers(cohortRows.map((row) => row.price));
            const priceToPrimaryStat = summarizeNumbers(ratios);
            return {
                cohort,
                count: cohortRows.length,
                price: {
                    ...price,
                    invalidCount: cohortRows.length - price.count,
                },
                priceToPrimaryStat: {
                    denominator: 'primaryStat',
                    zeroDenominatorHandling: 'excluded',
                    zeroDenominatorCount,
                    ...priceToPrimaryStat,
                    invalidRatioCount: cohortRows.length - zeroDenominatorCount - priceToPrimaryStat.count,
                    corridor: {
                        lower: priceToPrimaryStat.min,
                        upper: priceToPrimaryStat.max,
                    },
                },
            };
        });
};

const getSecondaryStats = (row: any) => stableCanonicalize(
    Object.fromEntries(
        ['crit', 'mp', 'mpBonus', 'hp', 'hpBonus', 'evasion', 'elem', 'subtype', 'desc_stat']
            .filter((field) => row[field] !== undefined)
            .map((field) => [field, row[field]]),
    ),
);

const getShopIdentitySet = (shopRows: readonly any[]) => new Set(
    shopRows
        .filter((row) => row && typeof row.type === 'string' && typeof row.name === 'string')
        .map((row) => getEquipmentIdentityKey(row.type, row.name)),
);

const rowReport = (row: any, shopIdentities: Set<string>, artEntries: Record<string, unknown>, signatures: Record<string, any>) => {
    const resolution = resolveEquipmentBaseIdentity({ type: row.type, name: row.name });
    const signature = signatures[row.name];
    return {
        type: row.type,
        name: row.name,
        tier: row.tier,
        price: row.price,
        primaryStat: {
            label: row.type === 'weapon' ? 'atk' : 'def',
            value: row.val,
        },
        secondaryStats: getSecondaryStats(row),
        hands: row.type === 'weapon' ? (row.hands ?? 1) : null,
        jobBreadth: Array.isArray(row.jobs) ? row.jobs.length : 0,
        jobs: Array.isArray(row.jobs) ? [...row.jobs] : [],
        signature: {
            isSignature: Boolean(signature),
            spriteKey: signature?.spriteKey || null,
        },
        shopReachability: shopIdentities.has(getEquipmentIdentityKey(row.type, row.name)),
        artworkRoute: typeof artEntries[row.name] === 'string' ? artEntries[row.name] : null,
        canonicalIdentityResolution: resolution
            ? { type: resolution.type, name: resolution.name, result: 'resolved' }
            : { result: 'unresolved' },
    };
};

const findDiscontinuities = (rows: readonly any[]) => {
    const byCohort = new Map<string, any[]>();
    for (const row of rows) {
        if (row.tier !== 4 && row.tier !== 5) continue;
        const key = `${row.type}:T${row.tier}`;
        const cohort = byCohort.get(key) || [];
        cohort.push(row);
        byCohort.set(key, cohort);
    }
    const discontinuities: Array<any> = [];
    for (const [cohort, cohortRows] of byCohort) {
        const priceStats = summarizeNumbers(cohortRows.map((row) => row.price));
        const threshold = priceStats.median === null ? null : priceStats.median * 0.35;
        if (threshold === null) continue;
        for (const row of cohortRows) {
            if (typeof row.price === 'number' && row.price < threshold) {
                discontinuities.push({
                    type: row.type,
                    name: row.name,
                    tier: row.tier,
                    cohort,
                    price: row.price,
                    cohortMedian: priceStats.median,
                    threshold,
                    classification: 'price_scale_discontinuity',
                });
            }
        }
    }
    return discontinuities.sort(compareIdentity);
};

const collectValidationErrors = (options: AuditOptions) => {
    try {
        validateCanonicalEquipmentCatalog({
            rows: options.rows,
            artEntries: options.artEntries,
            signatures: options.signatures,
            shopRows: options.shopRows,
        });
        return [] as string[];
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return message
            .replace(/^Invalid canonical equipment catalog:\s*/, '')
            .split('; ')
            .filter(Boolean);
    }
};

export const buildEquipmentEconomyReport = (options: AuditOptions = {}) => {
    const suppliedRows = options.rows || CANONICAL_EQUIPMENT;
    const artEntries = options.artEntries || (equipmentArtManifest as any).entries || {};
    const signatures = options.signatures || SIGNATURE_ITEM_REGISTRY;
    const shopRows = options.shopRows || getShopCatalog('황금 왕국');
    const errors = collectValidationErrors(options);
    const candidateCanonicalRows = sortRows(suppliedRows);
    const predecessorCanonicalRows = candidateCanonicalRows.map((row) => {
        const sidegrade = sidegradeCorrectionByIdentity.get(getEquipmentIdentityKey(row.type, row.name));
        const correction = correctionByIdentity.get(getEquipmentIdentityKey(row.type, row.name));
        const predecessor = sidegrade
            ? (() => {
                const restored = { ...row };
                for (const field of Object.keys(sidegrade.candidate)) delete restored[field];
                return { ...restored, ...sidegrade.predecessor };
            })()
            : row;
        return correction ? stableCanonicalize({ ...predecessor, price: correction.predecessorPrice }) : predecessor;
    });
    const shopIdentities = getShopIdentitySet(shopRows);
    const rows = candidateCanonicalRows.map((row) => rowReport(row, shopIdentities, artEntries, signatures));

    const priceCorrections: PriceCorrection[] = [];
    const sidegradeCorrections: SidegradeCorrection[] = [];
    const declaredKeys = new Set(correctionByIdentity.keys());
    for (const correction of APPROVED_EQUIPMENT_SIDEGRADE_CORRECTIONS) {
        const candidate = candidateCanonicalRows.find((row) => (
            getEquipmentIdentityKey(row.type, row.name) === getEquipmentIdentityKey(correction.type, correction.name)
        ));
        if (!candidate) {
            errors.push(`missing declared sidegrade correction ${correction.type}:${correction.name}`);
            continue;
        }
        const candidateProjection = correction.candidate as Record<string, unknown>;
        const expectedCandidateFields = Object.keys(candidateProjection).sort();
        const candidateMatches = expectedCandidateFields.every((field) => (
            Object.hasOwn(candidate, field) && candidate[field] === candidateProjection[field]
        ));
        if (!candidateMatches) errors.push(`sidegrade candidate mismatch for ${correction.type}\0${correction.name}`);
        const expectedSecondaryFields = expectedCandidateFields.filter((field) => field !== 'desc_stat').sort();
        const actualSecondaryFields = SIDEGRADE_SECONDARY_FIELDS.filter((field) => candidate[field] !== undefined).sort();
        if (JSON.stringify(actualSecondaryFields) !== JSON.stringify(expectedSecondaryFields)) {
            errors.push(`unexpected sidegrade secondary fields for ${correction.type}\0${correction.name}`);
        }
        sidegradeCorrections.push(correction);
    }
    for (const correction of APPROVED_EQUIPMENT_PRICE_CORRECTIONS) {
        const candidate = candidateCanonicalRows.find((row) => (
            getEquipmentIdentityKey(row.type, row.name) === getEquipmentIdentityKey(correction.type, correction.name)
        ));
        if (!candidate) {
            errors.push(`missing declared price correction ${correction.type}:${correction.name}`);
            continue;
        }
        if (candidate.price !== correction.candidatePrice) {
            errors.push(`declared price correction mismatch for ${correction.type}:${correction.name}`);
        }
        priceCorrections.push(correction);
    }

    for (const row of candidateCanonicalRows) {
        const identity = getEquipmentIdentityKey(row.type, row.name);
        if (!resolveEquipmentBaseIdentity({ type: row.type, name: row.name })) {
            errors.push(`unresolved canonical identity ${row.type}:${row.name}`);
        }
        if (declaredKeys.has(identity)) continue;
        const predecessor = predecessorCanonicalRows.find((entry) => (
            getEquipmentIdentityKey(entry.type, entry.name) === identity
        ));
        if (predecessor && predecessor.price !== row.price) {
            errors.push(`undeclared price correction for ${row.type}:${row.name}`);
        }
    }

    const identityResolutions = (options.identitySamples || []).map((item) => {
        const resolved = resolveEquipmentBaseIdentity(item);
        const result = {
            type: item?.type ?? null,
            name: item?.name ?? null,
            baseItemName: item?.baseItemName ?? null,
            result: resolved ? 'resolved' : 'unresolved',
            canonical: resolved ? { type: resolved.type, name: resolved.name } : null,
        };
        if (!resolved) errors.push(`unresolved canonical identity sample ${String(result.type)}:${String(result.name)}`);
        return result;
    });

    const predecessorDiscontinuities = findDiscontinuities(predecessorCanonicalRows);
    const candidateDiscontinuities = findDiscontinuities(candidateCanonicalRows);
    const predecessorKeys = new Set(
        predecessorDiscontinuities.map((row) => getEquipmentIdentityKey(row.type, row.name)),
    );
    const missingDiscontinuities = [...declaredKeys]
        .filter((identity) => !predecessorKeys.has(identity))
        .sort();
    const undeclaredDiscontinuities = predecessorDiscontinuities
        .filter((row) => !declaredKeys.has(getEquipmentIdentityKey(row.type, row.name)));

    for (const identity of missingDiscontinuities) errors.push(`missing price-scale discontinuity ${identity}`);
    for (const row of undeclaredDiscontinuities) errors.push(`undeclared price-scale discontinuity ${row.type}:${row.name}`);
    for (const row of candidateDiscontinuities) errors.push(`candidate price-scale discontinuity ${row.type}:${row.name}`);
    if (priceCorrections.length !== 20) errors.push(`expected 20 price corrections, received ${priceCorrections.length}`);
    if (sidegradeCorrections.length !== 4) errors.push(`expected 4 sidegrade corrections, received ${sidegradeCorrections.length}`);

    return stableCanonicalize({
        schemaVersion: 2,
        sort: 'UTF-16 code-unit type\\0name',
        catalog: {
            count: candidateCanonicalRows.length,
            cohorts: {
                weapon: candidateCanonicalRows.filter((row) => row.type === 'weapon').length,
                armor: candidateCanonicalRows.filter((row) => row.type === 'armor').length,
                shield: candidateCanonicalRows.filter((row) => row.type === 'shield').length,
            },
        },
        rows,
        cohortStatistics: getCohortStatistics(candidateCanonicalRows),
        predecessorCanonicalRows,
        candidateCanonicalRows,
        priceCorrections: [...priceCorrections].sort(compareIdentity),
        sidegradeCorrections: [...sidegradeCorrections].sort(compareIdentity),
        predecessorDiscontinuities,
        candidateDiscontinuities,
        identityResolutions,
        errors: [...new Set(errors)].sort(),
    });
};
