import type { Relic } from '../types/relic.js';

type RelicSynergy = {
    label?: unknown;
    requires?: unknown;
};

export type RelicBalanceCategory =
    | 'baseline-stat'
    | 'conditional-combat'
    | 'resource-economy'
    | 'failure-rule'
    | 'combat-scaling'
    | 'run-scaling'
    | 'exploration-pacing'
    | 'abyss-only';

export interface RelicBalanceReport {
    schemaVersion: 1;
    catalog: {
        relicCount: number;
        uniqueIdCount: number;
        uniqueNameCount: number;
        effectCount: number;
        synergyCount: number;
        rarityCounts: Record<string, number>;
    };
    effects: Array<{
        effect: string;
        category: RelicBalanceCategory;
        relicIds: string[];
        runtimeOwners: string[];
    }>;
    synergies: Array<{
        label: string;
        requiredRelicNames: string[];
    }>;
    errors: string[];
}

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

export const RELIC_RUNTIME_OWNER_PATHS = Object.freeze([
    'src/systems/CombatEngine.relics.ts',
    'src/systems/CombatEngine.actions.ts',
    'src/systems/CombatEngine.enemyAI.ts',
    'src/systems/CombatEngine.loot.ts',
    'src/systems/CombatEngine.outcome.ts',
    'src/systems/CombatEngine.ts',
    'src/utils/gameUtils.ts',
    'src/utils/hpDrainAtkRelic.ts',
    'src/utils/statsCalculator.ts',
    'src/utils/exploreUtils.ts',
    'src/hooks/gameActions/exploreActions.ts',
] as const);

const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary'] as const);

const EFFECT_CATEGORIES: ReadonlyArray<{
    category: RelicBalanceCategory;
    effects: readonly string[];
}> = Object.freeze([
    {
        category: 'abyss-only',
        effects: ['abyss_atk_scale', 'abyss_crit_scale', 'abyss_floor_power'],
    },
    {
        category: 'baseline-stat',
        effects: [
            'glass_cannon', 'ancient_power', 'stone_skin', 'fortress', 'mp_mult',
            'skill_mult', 'armor_pen', 'omega', 'crit_dmg', 'battle_start_atk',
            'dual_crit', 'triple_up', 'titan', 'elem_boost', 'reflect_crit', 'genesis',
        ],
    },
    {
        category: 'combat-scaling',
        effects: ['combo_stack', 'spell_stack', 'kill_stack_atk', 'entropy_tick'],
    },
    {
        category: 'conditional-combat',
        effects: [
            'on_kill_heal', 'low_hp_atk', 'execute_bonus', 'double_strike',
            'skill_lifesteal', 'crit_mp_regen', 'crit_block', 'reflect',
            'battle_start_heal', 'free_skill', 'mp_regen_turn', 'cursed_power',
            'dot_mult', 'chaos_buff', 'cd_minus', 'execute_atk', 'low_hp_dmg',
            'echo_atk', 'status_resist', 'mp_restore_battle', 'regen', 'on_hit_freeze',
            'first_turn_evade', 'battle_start_buff', 'hp_drain_atk', 'cooldown_reduce',
        ],
    },
    {
        category: 'exploration-pacing',
        effects: ['event_chance', 'boss_hunter', 'chaos_relic'],
    },
    {
        category: 'failure-rule',
        effects: ['death_save', 'void_heart', 'phoenix_revive'],
    },
    {
        category: 'resource-economy',
        effects: ['gold_mult', 'exp_mult', 'drop_rate', 'kill_bonus'],
    },
    {
        category: 'run-scaling',
        effects: ['kill_stack', 'devour_hp'],
    },
]);

const EFFECT_POLICY = new Map(EFFECT_CATEGORIES.flatMap(({ category, effects }) => (
    effects.map((effect) => [effect, category] as const)
)));

const isIdentity = (value: unknown): value is string => (
    typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value)
);

const findRuntimeOwnerPaths = (
    runtimeSources: Readonly<Record<string, string>>,
    effect: string,
): string[] => {
    const tokens = [`'${effect}'`, `"${effect}"`];
    return RELIC_RUNTIME_OWNER_PATHS.filter((sourcePath) => {
        const source = runtimeSources[sourcePath];
        return typeof source === 'string' && tokens.some((token) => source.includes(token));
    }).sort(compareText);
};

export const canonicalizeRelicBalanceReport = (
    report: RelicBalanceReport,
): RelicBalanceReport => ({
    schemaVersion: 1,
    catalog: {
        relicCount: report.catalog.relicCount,
        uniqueIdCount: report.catalog.uniqueIdCount,
        uniqueNameCount: report.catalog.uniqueNameCount,
        effectCount: report.catalog.effectCount,
        synergyCount: report.catalog.synergyCount,
        rarityCounts: Object.fromEntries(RARITIES.map((rarity) => [
            rarity,
            report.catalog.rarityCounts[rarity] ?? 0,
        ])),
    },
    effects: report.effects.map((row) => ({
        effect: row.effect,
        category: row.category,
        relicIds: [...new Set(row.relicIds)].sort(compareText),
        runtimeOwners: [...new Set(row.runtimeOwners)].sort(compareText),
    })).sort((left, right) => compareText(left.effect, right.effect)),
    synergies: report.synergies.map((row) => ({
        label: row.label,
        requiredRelicNames: [...row.requiredRelicNames].sort(compareText),
    })).sort((left, right) => compareText(left.label, right.label)),
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildRelicBalanceReport = ({
    relics,
    synergies,
    runtimeSources,
}: {
    relics: readonly Relic[];
    synergies: readonly RelicSynergy[];
    runtimeSources: Readonly<Record<string, string>>;
}): RelicBalanceReport => {
    const errors = new Set<string>();
    const ids = new Set<string>();
    const names = new Set<string>();
    const rarityCounts: Record<string, number> = Object.fromEntries(
        RARITIES.map((rarity) => [rarity, 0]),
    );
    const effectRelicIds = new Map<string, string[]>();

    relics.forEach((relic, index) => {
        const errorId = typeof relic.id === 'string' ? relic.id : String(index);
        if (!isIdentity(relic.id)) {
            errors.add(`RELIC_ID_INVALID:${errorId}`);
        } else {
            if (ids.has(relic.id)) errors.add(`RELIC_ID_DUPLICATE:${relic.id}`);
            ids.add(relic.id);
        }

        if (typeof relic.name === 'string') {
            if (names.has(relic.name)) errors.add(`RELIC_NAME_DUPLICATE:${relic.name}`);
            names.add(relic.name);
        }

        if (!RARITIES.some((rarity) => rarity === relic.rarity)) {
            errors.add(`RELIC_RARITY_INVALID:${errorId}`);
        } else {
            rarityCounts[String(relic.rarity)] += 1;
        }

        if (!isIdentity(relic.effect)) {
            errors.add(`RELIC_EFFECT_INVALID:${errorId}`);
        } else {
            const relicIds = effectRelicIds.get(relic.effect) ?? [];
            if (isIdentity(relic.id)) relicIds.push(relic.id);
            effectRelicIds.set(relic.effect, relicIds);
        }
    });

    if (relics.length !== 67) errors.add('RELIC_COUNT_MISMATCH');

    const effectRows: RelicBalanceReport['effects'] = [];
    [...effectRelicIds.entries()].sort(([left], [right]) => compareText(left, right))
        .forEach(([effect, relicIds]) => {
            const category = EFFECT_POLICY.get(effect);
            if (!category) {
                errors.add(`RELIC_EFFECT_POLICY_MISSING:${effect}`);
            }
            const runtimeOwners = findRuntimeOwnerPaths(runtimeSources, effect);
            if (runtimeOwners.length === 0) {
                errors.add(`RELIC_RUNTIME_OWNER_MISSING:${effect}`);
            }
            if (category) effectRows.push({ effect, category, relicIds, runtimeOwners });
        });

    const synergyRows = synergies.map((synergy, index) => {
        const label = typeof synergy.label === 'string' ? synergy.label : `#${index}`;
        const requiredRelicNames = Array.isArray(synergy.requires)
            ? synergy.requires.filter((name): name is string => typeof name === 'string')
            : [];
        if (!Array.isArray(synergy.requires) || requiredRelicNames.length !== synergy.requires.length) {
            errors.add(`SYNERGY_REFERENCE_INVALID:${label}:<invalid>`);
        }
        requiredRelicNames.forEach((name) => {
            if (!names.has(name)) errors.add(`SYNERGY_REFERENCE_INVALID:${label}:${name}`);
        });
        return { label, requiredRelicNames };
    });

    return canonicalizeRelicBalanceReport({
        schemaVersion: 1,
        catalog: {
            relicCount: relics.length,
            uniqueIdCount: ids.size,
            uniqueNameCount: names.size,
            effectCount: effectRelicIds.size,
            synergyCount: synergies.length,
            rarityCounts,
        },
        effects: effectRows,
        synergies: synergyRows,
        errors: [...errors],
    });
};
