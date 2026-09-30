import { MSG } from '../data/messages';
import { RELIC_SYNERGIES, getActiveRelicSynergies } from '../data/relics';
import type { Relic } from '../types/index.js';

/**
 * 유물 선택 카드의 시너지 힌트 — RelicChoicePanel이 카드마다, 추천 줄(relicChoiceDecision)이 순위에 쓴다.
 *
 * 2026-09 Wave 47: 컴포넌트 안에 있던 판정을 옮겼다. 그때 판정은 세 조각 전설 조합의 완성만 이름으로 찾았고,
 *   실제 조합 20개 중 두 조각 조합 15개의 완성은 아래 효과 짝 표(SYNERGY_MAP)가 우연히 맞을 때만 보였다
 *   (15개 중 14개가 힌트 0). 조합 완성은 이제 엔진이 쓰는 `getActiveRelicSynergies`로 판정한다 —
 *   이 유물을 더했을 때 새로 켜지는 조합이 곧 완성이다.
 */

/**
 * 효과 짝 표 — 실제 조합 보너스가 아니라 함께 쓰면 서로를 살리는 효과 쌍이다("함께 쓰기 좋음" 힌트).
 * 실제 조합(`RELIC_SYNERGIES`) 완성은 이 표와 무관하게 위에서 먼저 판정한다.
 * Wave 48(소유자 결정): 짝 하나당 20점, 최대 40점 — 등급 · 빌드 적합과 같은 급이고 실제 조합 진행(추천 줄의 층 점수)보다 아래다.
 *   '강한/좋은 조합'으로 부르던 동안 이 짝이 실제 조합처럼 읽혔고 추천에서 조합 진행을 밀어냈다(원장 §47.4).
 */
const EFFECT_PAIR_SCORE_PER_MATCH = 20;
const EFFECT_PAIR_SCORE_CAP = 40;
const SYNERGY_MAP: Record<string, string[]> = {
    // 공격 콤보
    double_strike: ['execute_bonus', 'combo_stack', 'armor_pen', 'ancient_power'],
    execute_bonus: ['double_strike', 'low_hp_atk', 'combo_stack'],
    combo_stack: ['double_strike', 'execute_bonus', 'ancient_power'],
    ancient_power: ['double_strike', 'combo_stack', 'execute_bonus'],
    low_hp_atk: ['execute_bonus', 'death_save', 'void_heart'],
    // 기술과 마법 조합
    skill_lifesteal: ['skill_mult', 'free_skill', 'mp_regen_turn', 'crit_mp_regen'],
    skill_mult: ['skill_lifesteal', 'free_skill', 'mp_regen_turn'],
    free_skill: ['skill_mult', 'skill_lifesteal', 'mp_regen_turn', 'crit_mp_regen'],
    mp_regen_turn: ['skill_mult', 'skill_lifesteal', 'free_skill', 'crit_mp_regen'],
    crit_mp_regen: ['skill_mult', 'free_skill', 'mp_regen_turn', 'ancient_power'],
    // 방어/생존 콤보
    reflect: ['fortress', 'stone_skin', 'crit_block'],
    fortress: ['reflect', 'stone_skin', 'battle_start_heal'],
    death_save: ['void_heart', 'low_hp_atk', 'battle_start_heal'],
    void_heart: ['death_save', 'low_hp_atk'],
    // DoT 콤보
    dot_mult: ['armor_pen', 'execute_bonus'],
    // 탐색/범용
    gold_mult: ['drop_rate', 'boss_hunter'],
    drop_rate: ['gold_mult', 'boss_hunter', 'exp_mult'],
    boss_hunter: ['drop_rate', 'execute_bonus', 'double_strike'],
};

/** 카드마다 계산하는 시너지 판정 결과. */
export interface RelicSynergyResult {
    score: number;
    label: string | null;
    synergies: Array<string | undefined>;
    /** 세 조각 전설 조합을 이 유물이 완성한다 — 조합 이름. */
    legendaryHint?: string;
    /** 두 조각 조합을 이 유물이 완성한다 — 조합 이름(Wave 47). */
    completesPair?: string;
    /** 세 조각 전설 조합까지 이 유물을 더하면 1개 남는다 — 조합 이름. */
    nearLegendary?: string | null;
    /**
     * 아직 한 조각도 없는 실제 조합의 첫 조각이다 — 조합 이름(Wave 49). 완성 · 진행이 아닐 때만 채운다.
     * 여러 조합의 조각이면 데이터 순서의 첫 조합이다.
     */
    startsCombo?: string;
}

/** 이 유물을 더하면 새로 켜지는 실제 조합 — 엔진과 같은 판정(`getActiveRelicSynergies`). */
export const getNewlyActivatedSynergies = (newRelic: Relic, ownedRelics: Relic[]) => {
    const before = new Set(getActiveRelicSynergies(ownedRelics).map((syn) => syn.label));
    return getActiveRelicSynergies([...ownedRelics, newRelic]).filter((syn) => !before.has(syn.label));
};

const ownedPieces = (requires: string[], ownedRelics: Relic[]) => ownedRelics
    .filter((relic) => requires.includes(relic.name ?? ''))
    .map((relic) => relic.name);

export const getRelicSynergyScore = (newRelic: Relic, ownedRelics: Relic[]): RelicSynergyResult => {
    const ownedEffects = ownedRelics.map((r) => r.effect);
    const ownedNames = new Set(ownedRelics.map((r) => r.name));
    const newRelicName = newRelic.name ?? '';

    const newlyActive = getNewlyActivatedSynergies(newRelic, ownedRelics);
    // 세 조각 전설 조합 완성 — 기존 표기 그대로(점수 120, 전설 조합 배지).
    const legendarySyn = newlyActive.find((syn) => syn.requires.length === 3);
    const pairSyn = newlyActive.find((syn) => syn.requires.length === 2);
    if (legendarySyn) {
        return {
            score: 120,
            label: MSG.RELIC_SYNERGY_LEGENDARY_COMPLETE,
            synergies: ownedPieces(legendarySyn.requires, ownedRelics),
            legendaryHint: legendarySyn.label,
            ...(pairSyn ? { completesPair: pairSyn.label } : {}),
        };
    }
    if (pairSyn) {
        return {
            score: 110,
            label: MSG.RELIC_PAIR_COMPLETE_BADGE,
            synergies: ownedPieces(pairSyn.requires, ownedRelics),
            completesPair: pairSyn.label,
        };
    }

    // 3피스 시너지 1개 남음 힌트 — 신규 유물이 첫 번째 피스인 경우(기존 판정 그대로)
    const nearLegendarySyn = RELIC_SYNERGIES.find((syn) =>
        syn.requires.length === 3 &&
        syn.requires.includes(newRelicName) &&
        syn.requires.filter((name) => ownedNames.has(name)).length === 1
    );

    // 2026-09 Wave 49(소유자 결정 "측정 후 조건부 반영"): 가진 조각이 하나도 없는 실제 조합의 첫 조각.
    //   진행(nearLegendary)이 있으면 그쪽이 높은 층이라 채우지 않는다.
    const startSyn = nearLegendarySyn ? undefined : RELIC_SYNERGIES.find((syn) =>
        syn.requires.includes(newRelicName) &&
        !syn.requires.some((name) => ownedNames.has(name))
    );
    const startsCombo = startSyn ? { startsCombo: startSyn.label } : {};

    if (!ownedRelics.length) return nearLegendarySyn
        ? { score: 0, label: null, synergies: [], nearLegendary: nearLegendarySyn.label }
        : { score: 0, label: null, synergies: [], ...startsCombo };

    const synergyEffects = SYNERGY_MAP[newRelic.effect] || [];
    const matches = ownedEffects.filter((e) => synergyEffects.includes(e));
    ownedEffects.forEach((e) => {
        if ((SYNERGY_MAP[e] || []).includes(newRelic.effect) && !matches.includes(e)) matches.push(e);
    });

    if (!matches.length) return nearLegendarySyn
        ? { score: 0, label: null, synergies: [], nearLegendary: nearLegendarySyn.label }
        : { score: 0, label: null, synergies: [], ...startsCombo };

    const score = Math.min(EFFECT_PAIR_SCORE_CAP, matches.length * EFFECT_PAIR_SCORE_PER_MATCH);
    const label = MSG.RELIC_EFFECT_PAIR_LABEL;
    const synergyNames = ownedRelics.filter((r) => matches.includes(r.effect)).map((r) => r.name);
    return { score, label, synergies: synergyNames, nearLegendary: nearLegendarySyn?.label || null, ...startsCombo };
};
