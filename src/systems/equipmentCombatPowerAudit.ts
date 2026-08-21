import { BALANCE } from '../data/constants.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import { buildClassVitals } from '../hooks/gameActions/_shared.js';
import { calculateFullStats } from '../utils/statsCalculator.js';
import {
    CANONICAL_EQUIPMENT,
    getEquipmentIdentityKey,
    validateCanonicalEquipmentCatalog,
} from '../utils/equipmentBaseIdentity.js';

export const EQUIPMENT_COMBAT_POWER_AUDIT_POLICY_VERSION = 'equipment-combat-power-audit@2';
export const EQUIPMENT_COMBAT_POWER_FLOAT_TOLERANCE = 1e-9;

export type EquipmentCombatPowerAuditOptions = {
    rows?: readonly any[];
    artEntries?: Record<string, unknown>;
    signatures?: Record<string, any>;
    shopRows?: readonly any[];
};

const EQUIPMENT_TYPES = ['weapon', 'armor', 'shield'] as const;
const NUMERIC_COMBAT_DIMENSIONS = ['primaryStat', 'effectiveAtk', 'effectiveDef', 'effectiveHp', 'effectiveMp', 'effectiveCrit', 'effectiveEvasion'] as const;
const PRODUCTION_DELTA_DIMENSIONS = ['atk', 'def', 'maxHp', 'maxMp', 'crit', 'evasion'] as const;
const FLOATING_DELTA_DIMENSIONS = new Set<string>(['crit', 'evasion']);
const CLASSIFICATIONS = ['intentional', 'specialized-sidegrade', 'price-only-defect', 'combat-power-defect'] as const;
const KNOWN_ELEMENTS = new Set(CANONICAL_EQUIPMENT.map((row) => row.elem).filter((element): element is string => typeof element === 'string'));

export const stableCanonicalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(stableCanonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value)
            .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
            .map((key) => [key, stableCanonicalize(value[key])]),
    );
};

const compareIdentity = (left: { type: string; name: string }, right: { type: string; name: string }) => {
    const leftKey = getEquipmentIdentityKey(left.type as any, left.name);
    const rightKey = getEquipmentIdentityKey(right.type as any, right.name);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

const median = (values: readonly number[]) => {
    const middle = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
};

const summarize = (values: readonly number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    if (sorted.length === 0) return { count: 0, min: null, median: null, max: null, q1: null, q3: null, corridor: { lower: null, upper: null } };
    const lower = sorted.slice(0, Math.ceil(sorted.length / 2));
    const upper = sorted.slice(Math.floor(sorted.length / 2));
    const q1 = median(lower);
    const q3 = median(upper);
    return {
        count: sorted.length,
        min: sorted[0],
        median: median(sorted),
        max: sorted[sorted.length - 1],
        q1,
        q3,
        corridor: { lower: q1, upper: q3 },
    };
};

const validationErrors = (options: EquipmentCombatPowerAuditOptions, rows: readonly any[]) => {
    const errors: string[] = [];
    try {
        validateCanonicalEquipmentCatalog({
            rows: options.rows,
            artEntries: options.artEntries,
            signatures: options.signatures,
            shopRows: options.shopRows,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(...message.replace(/^Invalid canonical equipment catalog:\s*/, '').split('; ').filter(Boolean));
    }
    for (const row of rows) {
        if (row?.elem !== undefined && (!KNOWN_ELEMENTS.has(row.elem) || typeof row.elem !== 'string')) {
            errors.push(`unknown element for ${String(row?.type)}\0${String(row?.name)}`);
        }
    }
    return [...new Set(errors)].sort();
};

const buildAuditPlayer = (job: string, tier: number, item: any = null) => {
    const level = BALANCE.TIER_REQ_LEVEL?.[tier];
    const vitals = buildClassVitals(level, job, { bonusHp: 0, bonusMp: 0, prestigeRank: 0 });
    const equip = { weapon: null, armor: null, offhand: null } as Record<string, any>;
    if (item) equip[item.type === 'shield' ? 'offhand' : item.type] = item;
    return {
        name: 'equipment-combat-power-audit',
        job,
        level,
        hp: vitals.maxHp,
        maxHp: vitals.maxHp,
        mp: vitals.maxMp,
        maxMp: vitals.maxMp,
        atk: 10,
        def: 5,
        equip,
        relics: [],
        stats: {},
        meta: { bonusHp: 0, bonusMp: 0, prestigeRank: 0 },
        skillChoices: {},
        titles: [],
        activeTitle: null,
    } as any;
};

const projectEligibleJob = (row: any, job: string) => {
    const baseline = calculateFullStats(buildAuditPlayer(job, row.tier)) as any;
    const equipped = calculateFullStats(buildAuditPlayer(job, row.tier, row)) as any;
    if (!baseline || !equipped) throw new Error(`unable to project ${row.type}\0${row.name} for ${job}`);
    return {
        job,
        atk: equipped.atk - baseline.atk,
        def: equipped.def - baseline.def,
        maxHp: equipped.maxHp - baseline.maxHp,
        maxMp: equipped.maxMp - baseline.maxMp,
        crit: equipped.critChance - baseline.critChance,
        // CombatEngine.enemyAI owns armor evasion as a literal passive chance.
        evasion: row.type === 'armor' ? (row.evasion ?? 0) : 0,
    };
};

const projectionSummary = (deltas: readonly any[], field: string) => summarize(deltas.map((delta) => delta[field]));

const rowDimensions = (row: any, deltas: readonly any[], signatures: Record<string, any>) => ({
    atk: {
        raw: row.type === 'weapon' ? row.val : 0,
        effective: projectionSummary(deltas, 'atk'),
    },
    def: {
        raw: row.type === 'weapon' ? 0 : row.val,
        effective: projectionSummary(deltas, 'def'),
    },
    hp: {
        raw: row.hpBonus ?? row.hp ?? 0,
        effective: projectionSummary(deltas, 'maxHp'),
    },
    mp: {
        raw: row.mpBonus ?? row.mp ?? 0,
        effective: projectionSummary(deltas, 'maxMp'),
    },
    crit: {
        raw: row.crit ?? 0,
        effective: projectionSummary(deltas, 'crit'),
    },
    evasion: {
        raw: row.evasion ?? 0,
        effective: projectionSummary(deltas, 'evasion'),
    },
    hands: row.type === 'weapon' ? (row.hands ?? 1) : null,
    element: row.elem ?? null,
    jobBreadth: row.jobs.length,
    jobs: [...row.jobs],
    signature: Boolean(signatures[row.name]),
    price: row.price,
});

const numericRowValues = (row: any): Record<string, number> => ({
    primaryStat: row.type === 'weapon' ? row.dimensions.atk.raw : row.dimensions.def.raw,
    effectiveAtk: row.dimensions.atk.effective.median,
    effectiveDef: row.dimensions.def.effective.median,
    effectiveHp: row.dimensions.hp.effective.median,
    effectiveMp: row.dimensions.mp.effective.median,
    effectiveCrit: row.dimensions.crit.effective.median,
    effectiveEvasion: row.dimensions.evasion.effective.median,
    price: row.dimensions.price,
    jobBreadth: row.dimensions.jobBreadth,
});

const getCohortPositions = (rows: readonly any[]) => {
    const groups = new Map<string, any[]>();
    for (const row of rows) {
        const cohort = `${row.type}:T${row.tier}`;
        const group = groups.get(cohort) || [];
        group.push(row);
        groups.set(cohort, group);
    }
    const positions = new Map<any, any>();
    const cohorts = [...groups.entries()]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([cohort, group]) => {
            const numeric: Record<string, any> = Object.fromEntries(
                [...NUMERIC_COMBAT_DIMENSIONS, 'price', 'jobBreadth'].map((dimension) => [
                    dimension,
                    summarize(group.map((row) => numericRowValues(row)[dimension])),
                ]),
            );
            const categorical = {
                hands: [...new Set(group.map((row) => row.dimensions.hands))].sort(),
                elements: [...new Set(group.map((row) => row.dimensions.element))].sort(),
                signatures: group.filter((row) => row.dimensions.signature).map((row) => row.name).sort(),
            };
            for (const row of group) {
                const values = numericRowValues(row);
                const outsideDimensions = NUMERIC_COMBAT_DIMENSIONS.filter((dimension) => {
                    const corridor: any = numeric[dimension].corridor;
                    return values[dimension] < corridor.lower || values[dimension] > corridor.upper;
                });
                const priceOutside = values.price < numeric.price.corridor.lower || values.price > numeric.price.corridor.upper;
                positions.set(row, {
                    cohort,
                    numeric,
                    categorical,
                    outsideDimensions,
                    priceOutside,
                });
            }
            return { cohort, count: group.length, numeric, categorical };
        });
    return { cohorts, groups, positions };
};

const compareProjectedValue = (dimension: string, candidateValue: number, dominatorValue: number) => {
    const difference = dominatorValue - candidateValue;
    if (FLOATING_DELTA_DIMENSIONS.has(dimension)) {
        if (Math.abs(difference) <= EQUIPMENT_COMBAT_POWER_FLOAT_TOLERANCE) return 'equal';
        return difference > 0 ? 'greater' : 'lower';
    }
    if (difference === 0) return 'equal';
    return difference > 0 ? 'greater' : 'lower';
};

const buildHardDominanceComparison = (candidate: any, dominator: any) => {
    if (candidate.type !== dominator.type || candidate.tier !== dominator.tier) return null;
    if (candidate.dimensions.signature) return null;
    if (dominator.dimensions.price > candidate.dimensions.price) return null;
    if (dominator.dimensions.hands !== null
        && candidate.dimensions.hands !== null
        && dominator.dimensions.hands > candidate.dimensions.hands) return null;
    if (dominator.dimensions.element !== candidate.dimensions.element) return null;

    const dominatorJobs = new Map(
        dominator.eligibleJobDeltas.map((delta: any) => [delta.job, delta]),
    );
    if (candidate.jobs.some((job: string) => !dominatorJobs.has(job))) return null;

    let hasStrictImprovement = false;
    const perJobComparisons = candidate.eligibleJobDeltas.map((candidateDelta: any) => {
        const dominatorDelta = dominatorJobs.get(candidateDelta.job) as any;
        const dimensions = Object.fromEntries(PRODUCTION_DELTA_DIMENSIONS.map((dimension) => {
            const relation = compareProjectedValue(
                dimension,
                candidateDelta[dimension],
                dominatorDelta[dimension],
            );
            if (relation === 'greater') hasStrictImprovement = true;
            return [dimension, {
                candidate: candidateDelta[dimension],
                dominator: dominatorDelta[dimension],
                relation,
            }];
        }));
        return { job: candidateDelta.job, dimensions };
    });
    if (perJobComparisons.some((comparison: any) => (
        PRODUCTION_DELTA_DIMENSIONS.some((dimension) => comparison.dimensions[dimension].relation === 'lower')
    ))) return null;
    if (!hasStrictImprovement) return null;

    return stableCanonicalize({
        candidate: { type: candidate.type, name: candidate.name },
        dominator: { type: dominator.type, name: dominator.name },
        cohort: `${candidate.type}:T${candidate.tier}`,
        perJobComparisons,
    });
};

const uniqueTradeoffReasons = (row: any, group: readonly any[]) => {
    const reasons: string[] = [];
    const count = (predicate: (candidate: any) => boolean) => group.filter(predicate).length;
    if (row.dimensions.element !== null && count((candidate) => candidate.dimensions.element === row.dimensions.element) === 1) {
        reasons.push(`unique-element:${row.dimensions.element}`);
    }
    if (row.dimensions.hands !== null && count((candidate) => candidate.dimensions.hands === row.dimensions.hands) === 1) {
        reasons.push(`unique-hands:${row.dimensions.hands}`);
    }
    for (const field of ['hp', 'mp', 'crit', 'evasion']) {
        if (row.dimensions[field].raw > 0 && count((candidate) => candidate.dimensions[field].raw === row.dimensions[field].raw) === 1) {
            reasons.push(`unique-${field}`);
        }
    }
    if (row.dimensions.jobs.some((job: string) => count((candidate) => candidate.dimensions.jobs.includes(job)) === 1)) {
        reasons.push('unique-job-route');
    }
    return reasons.sort();
};

const classify = (row: any, group: readonly any[], position: any) => {
    const dominancePairs = group
        .filter((candidate) => candidate !== row)
        .sort(compareIdentity)
        .map((candidate) => buildHardDominanceComparison(row, candidate))
        .filter(Boolean);
    const strictDominators = dominancePairs.map((pair: any) => pair.dominator);
    if (strictDominators.length > 0) {
        return {
            classification: 'combat-power-defect',
            classificationReasons: strictDominators.map((dominator: any) => `dominated-by:${dominator.type}\0${dominator.name}`),
            strictDominators,
            dominancePairs,
        };
    }

    if (position.priceOutside && position.outsideDimensions.length === 0) {
        return {
            classification: 'price-only-defect',
            classificationReasons: ['price-outside-iqr'],
            strictDominators,
            dominancePairs,
        };
    }

    const values = numericRowValues(row);
    const broadAccess = values.jobBreadth > position.numeric.jobBreadth.corridor.upper;
    const tradeoffReasons = uniqueTradeoffReasons(row, group)
        .filter((reason) => !(broadAccess && reason === 'unique-job-route'));
    if (position.outsideDimensions.length > 0 && tradeoffReasons.length > 0) {
        return {
            classification: 'specialized-sidegrade',
            classificationReasons: tradeoffReasons,
            strictDominators,
            dominancePairs,
        };
    }

    const primaryMedian = position.numeric.primaryStat.median;
    const rawTradeoff = values.primaryStat < primaryMedian;
    if (rawTradeoff && row.dimensions.signature) {
        return {
            classification: 'intentional',
            classificationReasons: ['declared-signature-raw-tradeoff'],
            strictDominators,
            dominancePairs,
        };
    }
    if (rawTradeoff && broadAccess) {
        return {
            classification: 'intentional',
            classificationReasons: ['broad-job-access-raw-tradeoff'],
            strictDominators,
            dominancePairs,
        };
    }
    return {
        classification: 'in-corridor',
        classificationReasons: [],
        strictDominators,
        dominancePairs,
    };
};

const countTypes = (rows: readonly any[]) => Object.fromEntries(
    [...EQUIPMENT_TYPES, 'total'].map((type) => [type, type === 'total' ? rows.length : rows.filter((row) => row.type === type).length]),
);

const countTiers = (rows: readonly any[]) => Object.fromEntries(
    EQUIPMENT_TYPES.map((type) => [type, Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((tier) => [tier, rows.filter((row) => row.type === type && row.tier === tier).length]),
    )]),
);

export const buildEquipmentCombatPowerReport = (options: EquipmentCombatPowerAuditOptions = {}) => {
    const suppliedRows = options.rows || CANONICAL_EQUIPMENT;
    const errors = validationErrors(options, suppliedRows);
    const catalog = {
        suppliedCount: suppliedRows.length,
        counts: countTypes(suppliedRows),
        tierCounts: countTiers(suppliedRows),
    };
    if (errors.length > 0) {
        return stableCanonicalize({
            schemaVersion: 2,
            policyVersion: EQUIPMENT_COMBAT_POWER_AUDIT_POLICY_VERSION,
            ok: false,
            catalog,
            errors,
            rows: [],
        });
    }

    const rows = [...validateCanonicalEquipmentCatalog({
        rows: options.rows,
        artEntries: options.artEntries,
        signatures: options.signatures,
        shopRows: options.shopRows,
    })].sort(compareIdentity);
    const signatures = options.signatures || SIGNATURE_ITEM_REGISTRY;
    const projectedRows = rows.map((source) => {
        const eligibleJobDeltas = source.jobs.map((job) => projectEligibleJob(source, job));
        return {
            type: source.type,
            name: source.name,
            tier: source.tier,
            source: stableCanonicalize(source),
            jobs: [...source.jobs],
            eligibleJobDeltas,
            dimensions: rowDimensions(source, eligibleJobDeltas, signatures),
        };
    });
    const positions = getCohortPositions(projectedRows);
    const classifiedRows = projectedRows.map((row) => {
        const position = positions.positions.get(row);
        const classification = classify(row, positions.groups.get(position.cohort) || [], position);
        return { ...row, cohortPosition: position, ...classification };
    }).sort(compareIdentity);
    const classificationCounts = Object.fromEntries(
        [...CLASSIFICATIONS, 'in-corridor'].map((classification) => [
            classification,
            classifiedRows.filter((row) => row.classification === classification).length,
        ]),
    );
    const outliers = classifiedRows.filter((row) => row.classification !== 'in-corridor');
    const combatPowerDefects = outliers.filter((row) => row.classification === 'combat-power-defect');
    const dominancePairs = classifiedRows.flatMap((row) => row.dominancePairs);
    const replanCohorts = [...new Set(combatPowerDefects.map((row) => row.cohortPosition.cohort))].sort();

    return stableCanonicalize({
        schemaVersion: 2,
        policyVersion: EQUIPMENT_COMBAT_POWER_AUDIT_POLICY_VERSION,
        hardDominancePolicy: {
            scope: 'exact-role-and-tier',
            candidateJobCoverage: 'required',
            candidateProtections: ['job-access', 'lower-hand-occupancy', 'element', 'effective-secondary-benefit', 'declared-signature-tradeoff'],
            dimensions: [...PRODUCTION_DELTA_DIMENSIONS],
            floatingDimensions: [...FLOATING_DELTA_DIMENSIONS].sort(),
            floatingTolerance: EQUIPMENT_COMBAT_POWER_FLOAT_TOLERANCE,
            integerLikeDimensions: PRODUCTION_DELTA_DIMENSIONS.filter((dimension) => !FLOATING_DELTA_DIMENSIONS.has(dimension)),
            excludedInputs: ['raw-val', 'cohort-median'],
            priceRule: 'dominator-price-no-higher',
            strictImprovement: 'at-least-one-candidate-job-dimension',
        },
        ok: true,
        catalog: {
            ...catalog,
            canonicalRows: rows.map((row) => stableCanonicalize(row)),
        },
        tierCheckpoints: BALANCE.TIER_REQ_LEVEL,
        cohorts: positions.cohorts,
        rows: classifiedRows,
        classificationCounts,
        outliers,
        combatPowerDefects,
        dominancePairs,
        requiresReplan: combatPowerDefects.length > 0,
        replanCohorts,
        errors: [],
    });
};

export type EquipmentCombatPowerReport = ReturnType<typeof buildEquipmentCombatPowerReport>;
