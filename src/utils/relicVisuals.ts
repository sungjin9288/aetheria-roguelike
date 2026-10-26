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

/**
 * 계열마다 그림 하나와 색 토큰 하나 — 2026-10 에테르 유리(감사 VD-07): 색은 `--aether-*-rgb` 채널 토큰만 쓴다.
 *   전설 계열은 전설 등급 색(산호)이다 — 위험 · 생명 색(장미)과 섞이지 않는다.
 */
const TONE_BY_CATEGORY: Readonly<Record<RelicVisualCategory, string>> = Object.freeze({
    attack: '--aether-life-rgb',
    survival: '--aether-good-rgb',
    energy: '--aether-will-rgb',
    exploration: '--aether-ether-rgb',
    treasure: '--aether-gold-rgb',
    cursed: '--aether-exp-rgb',
    legendary: '--aether-rarity-legendary-rgb',
});

export interface RelicVisual {
    category: RelicVisualCategory;
    src: string;
    /** 색 채널(`R G B`)을 읽는 CSS 식 — `rgb(${tone} / a)`로 투명도를 붙인다. */
    tone: string;
    color: string;
    glow: string;
}

export const getRelicVisualCategory = (relic?: Relic | null, completesLegendary = false): RelicVisualCategory => {
    if (completesLegendary || relic?.rarity === 'legendary') return 'legendary';
    return CATEGORY_BY_EFFECT[String(relic?.effect || '')] || 'attack';
};

export const hasRelicVisualCategory = (effect?: string | null) => Boolean(effect && CATEGORY_BY_EFFECT[effect]);

export const getRelicVisual = (relic?: Relic | null, completesLegendary = false): RelicVisual => {
    const category = getRelicVisualCategory(relic, completesLegendary);
    const tone = `var(${TONE_BY_CATEGORY[category]})`;
    return {
        category,
        src: `/assets/relics/${category}.png`,
        tone,
        color: `rgb(${tone})`,
        glow: `rgb(${tone} / 0.3)`,
    };
};
