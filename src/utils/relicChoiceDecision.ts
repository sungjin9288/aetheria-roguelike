const RARITY_SCORE: any = {
    common: 0,
    uncommon: 12,
    rare: 24,
    epic: 36,
    legendary: 52,
};

const EFFECT_BUILD_LABEL: any = {
    double_strike: '연타 화력',
    execute_bonus: '마무리 화력',
    combo_stack: '콤보 누적',
    ancient_power: '고대 화력',
    low_hp_atk: '저HP 압박',
    skill_lifesteal: '스킬 유지력',
    skill_mult: '스킬 피해',
    free_skill: '스킬 회전',
    mp_regen_turn: 'MP 회복',
    crit_mp_regen: '치명 MP',
    reflect: '반격 방어',
    fortress: '방어 축',
    stone_skin: '피해 완화',
    crit_block: '방어 반응',
    death_save: '생존 보험',
    void_heart: '생존 보험',
    battle_start_heal: '전투 회복',
    dot_mult: '지속 피해',
    armor_pen: '관통 피해',
    gold_mult: '골드 수급',
    drop_rate: '전리품 수급',
    exp_mult: '성장 가속',
    boss_hunter: '보스 사냥',
};

const getBuildLabel = (effect: any) => EFFECT_BUILD_LABEL[effect] || '범용 성장';

const getReasonLabel = (relic: any, synergy: any) => {
    if (synergy?.legendaryHint) return '전설 완성';
    if ((synergy?.score || 0) >= 80) return '강한 공명';
    if ((synergy?.score || 0) > 0) return '보유 유물 공명';
    if (synergy?.nearLegendary) return '전설 후보';
    if (relic?.rarity === 'legendary') return '전설 가치';
    if (relic?.rarity === 'epic') return '높은 희귀도';
    return '빌드 보강';
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
            { label: '추천', value: bestRelic.name || '추천 유물' },
            { label: '이유', value: best.reason },
            { label: '성장 방향', value: best.build },
        ],
    };
};
