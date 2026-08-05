import type { Relic } from '../types/relic';

export type RelicVisualCategory =
    | 'attack'
    | 'survival'
    | 'energy'
    | 'exploration'
    | 'treasure'
    | 'cursed'
    | 'legendary';

const CATEGORY_BY_EFFECT: Record<string, RelicVisualCategory> = {
    abyss_atk_scale: 'cursed',
    abyss_crit_scale: 'cursed',
    abyss_floor_power: 'cursed',
    ancient_power: 'attack',
    armor_pen: 'attack',
    battle_start_atk: 'attack',
    battle_start_buff: 'attack',
    battle_start_heal: 'survival',
    boss_hunter: 'exploration',
    cd_minus: 'energy',
    chaos_buff: 'cursed',
    chaos_relic: 'cursed',
    combo_stack: 'attack',
    cooldown_reduce: 'energy',
    crit_block: 'survival',
    crit_dmg: 'attack',
    crit_mp_regen: 'energy',
    cursed_power: 'cursed',
    death_save: 'survival',
    devour_hp: 'survival',
    dot_mult: 'attack',
    double_strike: 'attack',
    drop_rate: 'treasure',
    dual_crit: 'attack',
    echo_atk: 'attack',
    elem_boost: 'attack',
    entropy_tick: 'cursed',
    event_chance: 'exploration',
    execute_atk: 'attack',
    execute_bonus: 'attack',
    exp_mult: 'exploration',
    first_turn_evade: 'survival',
    fortress: 'survival',
    free_skill: 'energy',
    genesis: 'legendary',
    glass_cannon: 'cursed',
    gold_mult: 'treasure',
    hp_drain_atk: 'cursed',
    kill_bonus: 'attack',
    kill_stack: 'attack',
    kill_stack_atk: 'attack',
    low_hp_atk: 'attack',
    low_hp_dmg: 'attack',
    mp_mult: 'energy',
    mp_regen_turn: 'energy',
    mp_restore_battle: 'energy',
    omega: 'legendary',
    on_hit_freeze: 'attack',
    on_kill_heal: 'survival',
    phoenix_revive: 'legendary',
    reflect: 'survival',
    reflect_crit: 'survival',
    regen: 'survival',
    skill_lifesteal: 'attack',
    skill_mult: 'attack',
    spell_stack: 'energy',
    status_resist: 'survival',
    stone_skin: 'survival',
    titan: 'legendary',
    triple_up: 'legendary',
    void_heart: 'cursed',
};

const VISUAL_BY_CATEGORY = {
    attack: {
        src: '/assets/relics/attack.png',
        color: '#ff9b9b',
        glow: 'rgba(244, 99, 110, 0.28)',
    },
    survival: {
        src: '/assets/relics/survival.png',
        color: '#97e7c0',
        glow: 'rgba(110, 231, 183, 0.24)',
    },
    energy: {
        src: '/assets/relics/energy.png',
        color: '#8edff4',
        glow: 'rgba(103, 232, 249, 0.24)',
    },
    exploration: {
        src: '/assets/relics/exploration.png',
        color: '#7dd4d8',
        glow: 'rgba(125, 212, 216, 0.24)',
    },
    treasure: {
        src: '/assets/relics/treasure.png',
        color: '#f2ce91',
        glow: 'rgba(242, 206, 145, 0.24)',
    },
    cursed: {
        src: '/assets/relics/cursed.png',
        color: '#c8a7f0',
        glow: 'rgba(168, 85, 247, 0.26)',
    },
    legendary: {
        src: '/assets/relics/legendary.png',
        color: '#f6e7b0',
        glow: 'rgba(250, 204, 21, 0.28)',
    },
} as const;

export const getRelicVisualCategory = (relic?: Relic | null, completesLegendary = false): RelicVisualCategory => {
    if (completesLegendary || relic?.rarity === 'legendary') return 'legendary';
    return CATEGORY_BY_EFFECT[String(relic?.effect || '')] || 'attack';
};

export const hasRelicVisualCategory = (effect?: string | null) => Boolean(effect && CATEGORY_BY_EFFECT[effect]);

export const getRelicVisual = (relic?: Relic | null, completesLegendary = false) => {
    const category = getRelicVisualCategory(relic, completesLegendary);
    return { category, ...VISUAL_BY_CATEGORY[category] };
};
