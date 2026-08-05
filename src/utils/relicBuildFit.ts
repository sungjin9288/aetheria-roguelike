import type { Relic } from '../types/index.js';

export const RELIC_EFFECTS_BY_BUILD: Readonly<Record<string, readonly string[]>> = Object.freeze({
    crusher:  ['double_strike', 'execute_bonus', 'ancient_power', 'combo_stack', 'low_hp_atk'],
    dual:     ['double_strike', 'combo_stack', 'execute_bonus', 'armor_pen', 'ancient_power'],
    fortress: ['fortress', 'reflect', 'stone_skin', 'battle_start_heal', 'crit_block'],
    arcane:   ['skill_mult', 'free_skill', 'mp_regen_turn', 'skill_lifesteal', 'crit_mp_regen'],
    explorer: ['drop_rate', 'gold_mult', 'event_chance', 'boss_hunter', 'exp_mult'],
    risk:     ['low_hp_atk', 'execute_bonus', 'ancient_power', 'death_save', 'double_strike'],
    status:   ['dot_mult', 'armor_pen', 'execute_bonus', 'skill_mult', 'ancient_power'],
    balanced: ['battle_start_heal', 'stone_skin', 'gold_mult', 'exp_mult', 'ancient_power'],
});

const BUILD_FIT_SCORES = Object.freeze([40, 32, 24, 16, 10]);

const getBuildEffects = (buildId: string) => (
    RELIC_EFFECTS_BY_BUILD[buildId] || RELIC_EFFECTS_BY_BUILD.balanced
);

export const getRelicBuildFit = (buildId: string, effect?: string) => {
    const rank = effect ? getBuildEffects(buildId).indexOf(effect) : -1;
    return {
        matched: rank >= 0,
        rank,
        score: rank >= 0 ? BUILD_FIT_SCORES[rank] || 0 : 0,
    };
};

export const getRecommendedRelicsForBuild = (
    relics: readonly Relic[],
    buildId: string,
    ownedEffects: readonly string[],
    limit: number,
) => {
    if (limit <= 0) return [];

    const owned = new Set(ownedEffects);
    const recommendations: Relic[] = [];

    for (const effect of getBuildEffects(buildId)) {
        if (owned.has(effect)) continue;
        const relic = relics.find((entry) => entry.effect === effect);
        if (!relic) continue;

        recommendations.push(relic);
        if (recommendations.length === limit) return recommendations;
    }

    return recommendations;
};
