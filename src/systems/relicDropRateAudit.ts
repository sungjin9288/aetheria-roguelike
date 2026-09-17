import { RELICS } from '../data/relics.js';
import type { Relic } from '../types/relic.js';
import { migrateData } from '../utils/gameUtils.js';
import { getStrongestNumericRelicValue } from './CombatEngine.actions.js';
import { processLoot } from './CombatEngine.loot.js';

type DropRateCatalogRelic = {
    id: string;
    name: string;
    rarity: string;
    desc: string;
    effect: string;
    val: number | null;
};

type LootOrder = {
    relicIds: string[];
    multiplier: number;
    itemNames: string[];
    logTypes: string[];
    rngCalls: number;
};

export interface RelicDropRateReport {
    schemaVersion: 1;
    policy: {
        effect: 'drop_rate';
        resolution: 'strongest-finite-non-negative';
        multiplierFormula: '1 + strongest value';
    };
    catalog: {
        luckyCoin: DropRateCatalogRelic;
        fortuneRelic: DropRateCatalogRelic;
    };
    pathVectors: Array<{
        path: 'enriched' | 'legacy' | 'high-level-bonus';
        enemy: string;
        rolls: number[];
        expectedItemCount: number;
        expectedRngCalls: number;
        orders: LootOrder[];
    }>;
    malformedCases: Array<{
        label: string;
        error: string;
        rngCalls: number;
    }>;
    prestigeInvariant: {
        itemCount: number;
        logTypes: string[];
        rngCalls: number;
    };
    legacySnapshot: {
        preserved: boolean;
        relics: Array<{
            id: string;
            desc: string;
            val: number;
        }>;
    };
    reducerReplay: {
        contract: 'same action receipt returns the existing state object';
    };
    errors: string[];
}

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const EXPECTED_CATALOG: Record<string, DropRateCatalogRelic> = {
    lucky_coin: {
        id: 'lucky_coin',
        name: '행운의 동전',
        rarity: 'uncommon',
        desc: '아이템 획득 확률 50% 증가',
        effect: 'drop_rate',
        val: 0.5,
    },
    fortune_relic: {
        id: 'fortune_relic',
        name: '운명의 결정',
        rarity: 'rare',
        desc: '아이템 획득 확률 100% 증가 (행운의 동전 강화형)',
        effect: 'drop_rate',
        val: 1.0,
    },
};

const LEGACY_SNAPSHOTS: Array<{ id: string; desc: string; val: number }> = [
    {
        id: 'lucky_coin',
        desc: '아이템 획득 확률 50% 증가',
        val: 0.5,
    },
    {
        id: 'fortune_relic',
        desc: '아이템 획득 확률 100% 증가 (행운의 동전 강화형)',
        val: 1.0,
    },
];

const projectCatalogRelic = (relic: Relic | undefined): DropRateCatalogRelic => ({
    id: typeof relic?.id === 'string' ? relic.id : '',
    name: typeof relic?.name === 'string' ? relic.name : '',
    rarity: typeof relic?.rarity === 'string' ? relic.rarity : '',
    desc: typeof relic?.desc === 'string' ? relic.desc : '',
    effect: typeof relic?.effect === 'string' ? relic.effect : '',
    val: typeof relic?.val === 'number' && Number.isFinite(relic.val) ? relic.val : null,
});

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const sameLootOutcome = (left: LootOrder | undefined, right: LootOrder | undefined) => (
    left !== undefined
    && right !== undefined
    && left.multiplier === right.multiplier
    && left.rngCalls === right.rngCalls
    && sameJson(left.itemNames, right.itemNames)
    && sameJson(left.logTypes, right.logTypes)
);

const runLootOrder = ({
    enemy,
    relics,
    rolls,
    player = {},
}: {
    enemy: Record<string, unknown>;
    relics: readonly Relic[];
    rolls: readonly number[];
    player?: Record<string, unknown>;
}): LootOrder => {
    let rngCalls = 0;
    const rng = () => {
        const roll = rolls[Math.min(rngCalls, rolls.length - 1)];
        rngCalls += 1;
        return roll;
    };
    const result = processLoot(enemy as any, { ...player, relics } as any, 1, rng, () => 1);
    return {
        relicIds: relics.map((relic) => relic.id || ''),
        multiplier: 1 + getStrongestNumericRelicValue(relics, 'drop_rate'),
        itemNames: result.items.map((item: any) => item.name),
        logTypes: result.logs.map((log: any) => log.type),
        rngCalls,
    };
};

const captureFailClosedCase = ({
    label,
    relic,
    enemy,
}: {
    label: string;
    relic: Relic;
    enemy: Record<string, unknown>;
}) => {
    let rngCalls = 0;
    try {
        processLoot(enemy as any, { relics: [relic] } as any, 1, () => {
            rngCalls += 1;
            return 0;
        }, () => 1);
        return { label, error: 'NO_ERROR', rngCalls };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
        return { label, error: message.split(':')[0], rngCalls };
    }
};

export const canonicalizeRelicDropRateReport = (
    report: RelicDropRateReport,
): RelicDropRateReport => ({
    schemaVersion: 1,
    policy: { ...report.policy },
    catalog: {
        luckyCoin: { ...report.catalog.luckyCoin },
        fortuneRelic: { ...report.catalog.fortuneRelic },
    },
    pathVectors: report.pathVectors.map((vector) => ({
        path: vector.path,
        enemy: vector.enemy,
        rolls: [...vector.rolls],
        expectedItemCount: vector.expectedItemCount,
        expectedRngCalls: vector.expectedRngCalls,
        orders: vector.orders.map((order) => ({
            relicIds: [...order.relicIds],
            multiplier: order.multiplier,
            itemNames: [...order.itemNames],
            logTypes: [...order.logTypes],
            rngCalls: order.rngCalls,
        })),
    })),
    malformedCases: report.malformedCases.map((entry) => ({ ...entry })),
    prestigeInvariant: {
        itemCount: report.prestigeInvariant.itemCount,
        logTypes: [...report.prestigeInvariant.logTypes],
        rngCalls: report.prestigeInvariant.rngCalls,
    },
    legacySnapshot: {
        preserved: report.legacySnapshot.preserved,
        relics: report.legacySnapshot.relics.map((relic) => ({ ...relic })),
    },
    reducerReplay: { ...report.reducerReplay },
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildRelicDropRateReport = ({
    relics = RELICS,
}: {
    relics?: readonly Relic[];
} = {}): RelicDropRateReport => {
    const errors = new Set<string>();
    const family = relics.filter((relic) => relic.effect === 'drop_rate');
    const luckyCoin = family.find((relic) => relic.id === 'lucky_coin');
    const fortuneRelic = family.find((relic) => relic.id === 'fortune_relic');
    const catalog = {
        luckyCoin: projectCatalogRelic(luckyCoin),
        fortuneRelic: projectCatalogRelic(fortuneRelic),
    };

    if (family.length !== 2
        || !sameJson(catalog.luckyCoin, EXPECTED_CATALOG.lucky_coin)
        || !sameJson(catalog.fortuneRelic, EXPECTED_CATALOG.fortune_relic)) {
        errors.add('DROP_RATE_CATALOG_MISMATCH');
    }

    const orders = luckyCoin && fortuneRelic
        ? [[luckyCoin, fortuneRelic], [fortuneRelic, luckyCoin]]
        : [];
    const vectorInputs = [
        {
            path: 'enriched' as const,
            enemy: { name: '슬라임', dropMod: 1 },
            rolls: [0.9],
            expectedItemCount: 3,
            expectedRngCalls: 9,
        },
        {
            path: 'legacy' as const,
            enemy: { name: '물의 정령', dropMod: 1 },
            rolls: [0.7],
            expectedItemCount: 2,
            expectedRngCalls: 6,
        },
        {
            path: 'high-level-bonus' as const,
            enemy: { name: '__drop_rate_high_level_bonus__', dropMod: 1, exp: 160 },
            rolls: [0.1, 0.99],
            expectedItemCount: 1,
            expectedRngCalls: 4,
        },
    ];
    const pathVectors = vectorInputs.map((input) => ({
        ...input,
        enemy: String(input.enemy.name),
        orders: orders.map((order) => runLootOrder({ ...input, relics: order })),
    }));

    for (const vector of pathVectors) {
        if (vector.orders.length !== 2
            || !vector.orders.every((order) => order.multiplier === 2
                && order.itemNames.length === vector.expectedItemCount
                && order.rngCalls === vector.expectedRngCalls)
            || !sameLootOutcome(vector.orders[0], vector.orders[1])) {
            errors.add(`DROP_RATE_PATH_VECTOR_MISMATCH:${vector.path}`);
        }
    }

    const malformedValues: Array<[string, unknown]> = [
        ['missing', undefined],
        ['string', '1.0'],
        ['nan', Number.NaN],
        ['infinity', Number.POSITIVE_INFINITY],
        ['negative', -0.01],
    ];
    const malformedCases = malformedValues.map(([label, val]) => captureFailClosedCase({
        label,
        relic: { id: `invalid-${label}`, effect: 'drop_rate', val },
        enemy: { name: '슬라임', isBoss: true, dropMod: 1, exp: 160, meta: { prestigeRank: 3 } },
    }));
    malformedCases.push(captureFailClosedCase({
        label: 'unsafe-chance-arithmetic',
        relic: { id: 'invalid-overflow', effect: 'drop_rate', val: Number.MAX_VALUE },
        enemy: { name: '물의 정령', dropMod: 3 },
    }));
    for (const entry of malformedCases) {
        const expectedError = entry.label === 'unsafe-chance-arithmetic'
            ? 'INVALID_LOOT_DROP_CHANCE'
            : 'INVALID_RELIC_EFFECT_VALUE';
        if (entry.error !== expectedError || entry.rngCalls !== 0) {
            errors.add(`DROP_RATE_FAIL_CLOSED_MISMATCH:${entry.label}`);
        }
    }

    const prestigeOrder = fortuneRelic
        ? runLootOrder({
            enemy: { name: '__drop_rate_prestige__', isBoss: true, dropMod: 1, exp: 160 },
            relics: [fortuneRelic],
            rolls: [0.99],
            player: { meta: { prestigeRank: 3 } },
        })
        : { itemNames: [], logTypes: [], rngCalls: 0 };
    const prestigeInvariant = {
        itemCount: prestigeOrder.itemNames.length,
        logTypes: prestigeOrder.logTypes,
        rngCalls: prestigeOrder.rngCalls,
    };
    if (prestigeInvariant.itemCount !== 1
        || !sameJson(prestigeInvariant.logTypes, ['event'])
        || prestigeInvariant.rngCalls !== 4) {
        errors.add('DROP_RATE_PRESTIGE_INVARIANT_MISMATCH');
    }

    const legacyRelics = LEGACY_SNAPSHOTS.map((snapshot) => ({
        ...snapshot,
        name: snapshot.id,
        effect: 'drop_rate',
    }));
    const migrated = migrateData({ version: 6, player: { name: 'legacy', relics: legacyRelics } });
    const migratedRelics = Array.isArray(migrated.player?.relics) ? migrated.player.relics : [];
    const legacySnapshot = {
        preserved: sameJson(migratedRelics, legacyRelics),
        relics: LEGACY_SNAPSHOTS.map((snapshot) => ({ ...snapshot })),
    };
    if (!legacySnapshot.preserved) errors.add('DROP_RATE_LEGACY_SNAPSHOT_MISMATCH');

    return canonicalizeRelicDropRateReport({
        schemaVersion: 1,
        policy: {
            effect: 'drop_rate',
            resolution: 'strongest-finite-non-negative',
            multiplierFormula: '1 + strongest value',
        },
        catalog,
        pathVectors,
        malformedCases,
        prestigeInvariant,
        legacySnapshot,
        reducerReplay: {
            contract: 'same action receipt returns the existing state object',
        },
        errors: [...errors],
    });
};
