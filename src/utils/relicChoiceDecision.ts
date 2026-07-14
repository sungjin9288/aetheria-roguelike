import { getRelicDisplayName } from './relicPresentation';

const RARITY_SCORE: any = {
    common: 0,
    uncommon: 12,
    rare: 24,
    epic: 36,
    legendary: 52,
};

const EFFECT_BUILD_LABEL: any = {
    double_strike: '연속 공격',
    execute_bonus: '마무리 공격',
    combo_stack: '연속 공격 강화',
    ancient_power: '공격력 강화',
    low_hp_atk: '위기 공격',
    skill_lifesteal: '기술 생존력',
    skill_mult: '기술 공격',
    free_skill: '기력 절약',
    mp_regen_turn: '기력 회복',
    crit_mp_regen: '치명타와 기력 회복',
    reflect: '반격과 방어',
    fortress: '방어력 강화',
    stone_skin: '피해 감소',
    crit_block: '치명타 방어',
    death_save: '생존 기회',
    void_heart: '생존 기회',
    battle_start_heal: '전투 회복',
    dot_mult: '지속 피해',
    armor_pen: '방어력 관통',
    gold_mult: '골드 획득',
    drop_rate: '전리품 획득',
    exp_mult: '빠른 성장',
    boss_hunter: '보스 사냥',
};

const getBuildLabel = (effect: any) => EFFECT_BUILD_LABEL[effect] || '균형 성장';

const getReasonLabel = (relic: any, synergy: any) => {
    if (synergy?.legendaryHint) return '전설 조합 완성';
    if ((synergy?.score || 0) >= 80) return '현재 유물과 잘 맞음';
    if ((synergy?.score || 0) > 0) return '현재 유물과 이어짐';
    if (synergy?.nearLegendary) return '전설 조합에 가까움';
    if (relic?.rarity === 'legendary') return '가장 높은 등급';
    if (relic?.rarity === 'epic') return '높은 등급';
    return '현재 성장 보완';
};

const getTone = (relic: any, synergy: any) => {
    if (synergy?.legendaryHint || relic?.rarity === 'legendary') return 'legendary';
    if ((synergy?.score || 0) > 0) return 'synergy';
    if (synergy?.nearLegendary) return 'potential';
    return 'steady';
};

export const getRelicChoiceDecisionStrip = (cards: any[]) => {
    if (!Array.isArray(cards) || cards.length === 0) {
        return {
            tone: 'steady',
            recommendedIndex: -1,
            recommendedId: null,
            cells: [
                { label: '추천', value: '선택 대기' },
                { label: '이유', value: '후보 없음' },
                { label: '성장 방향', value: '정비' },
            ],
        };
    }

    const ranked = cards.map((card: any) => {
        const relic = card.relic || {};
        const synergy = card.synergy || {};
        const rarityScore = RARITY_SCORE[relic.rarity] || 0;
        const synergyScore = synergy.legendaryHint ? 160 : (synergy.score || 0);
        const nearLegendaryScore = synergy.nearLegendary ? 18 : 0;
        return {
            ...card,
            score: synergyScore + nearLegendaryScore + rarityScore,
            reason: getReasonLabel(relic, synergy),
            build: getBuildLabel(relic.effect),
        };
    }).sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.index || 0) - (b.index || 0);
    });

    const best = ranked[0];
    const bestRelic = best.relic || {};

    return {
        tone: getTone(bestRelic, best.synergy || {}),
        recommendedIndex: best.index,
        recommendedId: bestRelic.id || null,
        cells: [
            { label: '추천', value: getRelicDisplayName(bestRelic.name) || '추천 유물' },
            { label: '이유', value: best.reason },
            { label: '성장 방향', value: best.build },
        ],
    };
};
