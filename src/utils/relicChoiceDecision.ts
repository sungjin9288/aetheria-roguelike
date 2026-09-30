import { getRelicDisplayName } from './relicPresentation';
import { getRelicBuildFit } from './relicBuildFit';
import { MSG } from '../data/messages';
import type { Relic } from '../types/index.js';

/** `RelicChoicePanel.getRelicSynergyScore()`가 카드마다 계산하는 결과 중 이 파일이 읽는 필드만. */
interface RelicSynergyInfo {
    score?: number;
    legendaryHint?: string;
    /** 두 조각 조합 완성(Wave 47, relicSynergyHint). */
    completesPair?: string;
    nearLegendary?: string | null;
    /** 가진 조각이 없는 실제 조합의 첫 조각(Wave 49, relicSynergyHint). */
    startsCombo?: string;
}

/** `RelicChoicePanel`이 만드는 유물 3~4택 카드 1개. */
interface RelicChoiceCard {
    relic?: Relic;
    index: number;
    synergy?: RelicSynergyInfo;
}

interface RankedRelicChoiceCard extends RelicChoiceCard {
    score: number;
    reason: string;
    build: string;
}

interface RelicChoiceDecisionCell {
    label: string;
    value: string;
}

interface RelicChoiceDecision {
    tone: string;
    recommendedIndex: number;
    recommendedId: string | null;
    cells: RelicChoiceDecisionCell[];
}

const RARITY_SCORE: Record<string, number> = {
    common: 0,
    uncommon: 12,
    rare: 24,
    epic: 36,
    legendary: 52,
};

const EFFECT_BUILD_LABEL: Record<string, string> = {
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
    event_chance: '이벤트 탐색',
};

const getBuildLabel = (effect: string | undefined) => EFFECT_BUILD_LABEL[effect ?? ''] || '균형 성장';

const getReasonLabel = (relic: Relic | undefined, synergy: RelicSynergyInfo, buildFit: ReturnType<typeof getRelicBuildFit>) => {
    if (synergy?.legendaryHint) return '전설 조합 완성';
    if (synergy?.completesPair) return MSG.RELIC_REASON_PAIR_COMPLETE;
    if (synergy?.nearLegendary) return '전설 조합에 가까움';
    if (synergy?.startsCombo) return MSG.RELIC_REASON_COMBO_START;
    if ((synergy?.score || 0) > 0) return MSG.RELIC_REASON_EFFECT_PAIR;
    if (buildFit.rank >= 0 && buildFit.rank <= 1) return '현재 성장과 잘 맞음';
    if (buildFit.matched) return '현재 성장 보완';
    if (relic?.rarity === 'legendary') return '가장 높은 등급';
    if (relic?.rarity === 'epic') return '높은 등급';
    // Wave 4 O2: 빌드에 맞지 않는 후보까지 '현재 성장 보완'으로 부르면, 빌드 공명 추첨으로
    //   실제 맞는 유물이 올라왔을 때와 표기가 구분되지 않는다.
    return MSG.RELIC_REASON_NEW_DIRECTION;
};

const getTone = (relic: Relic | undefined, synergy: RelicSynergyInfo) => {
    if (synergy?.legendaryHint || relic?.rarity === 'legendary') return 'legendary';
    if (synergy?.completesPair) return 'synergy';
    if (synergy?.nearLegendary || synergy?.startsCombo) return 'potential';
    return 'steady';
};

/**
 * 실제 조합 층 점수 — 층끼리는 등급 · 빌드 적합 · 효과 짝을 다 더해도(최대 52 + 40 + 40) 뒤집히지 않는다.
 * 2026-09 Wave 48(소유자 결정 "조합 진행 우선"): 전설 조합 완성 > 두 조각 조합 완성 > 세 조각 조합 진행(2개째 — 제안 생성기의
 *   조합 보장 슬롯과 같은 기준) > 그 밖. 같은 층 안에서는 등급 · 빌드 적합 · 효과 짝이 가른다. 조합 진행이 +18뿐이던 동안
 *   추천을 따르는 플레이어는 첫 카드(보장 슬롯)만 고르는 플레이어보다 조합을 덜 모았다(원장 §47.4).
 * 2026-09 Wave 49(소유자 결정 "측정 후 조건부 반영"): 진행 아래 · 그 밖 위에 "조합 시작"(가진 조각이 없는 실제 조합의
 *   첫 조각) 층을 둔다 — 보장 슬롯이 없는 제안에서 추천이 등급을 고르던 몫이다(원장 §49).
 */
const SYNERGY_TIER_SCORE = Object.freeze({ legendaryComplete: 1000, pairComplete: 800, progress: 400, comboStart: 200 });

const getSynergyScore = (synergy: RelicSynergyInfo) => {
    if (synergy.legendaryHint) return SYNERGY_TIER_SCORE.legendaryComplete;
    if (synergy.completesPair) return SYNERGY_TIER_SCORE.pairComplete;
    const effectPairScore = synergy.score || 0;
    const tier = synergy.nearLegendary
        ? SYNERGY_TIER_SCORE.progress
        : synergy.startsCombo ? SYNERGY_TIER_SCORE.comboStart : 0;
    return tier + effectPairScore;
};

export const getRelicChoiceDecisionStrip = (cards: RelicChoiceCard[], buildId: string): RelicChoiceDecision => {
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

    const ranked: RankedRelicChoiceCard[] = cards.map((card) => {
        const relic = card.relic;
        const synergy = card.synergy || {};
        const rarityScore = RARITY_SCORE[relic?.rarity ?? ''] || 0;
        const synergyScore = getSynergyScore(synergy);
        const buildFit = getRelicBuildFit(buildId, relic?.effect);
        return {
            ...card,
            score: synergyScore + rarityScore + buildFit.score,
            reason: getReasonLabel(relic, synergy, buildFit),
            build: getBuildLabel(relic?.effect),
        };
    }).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.index || 0) - (b.index || 0);
    });

    const best = ranked[0];
    const bestRelic = best.relic;

    return {
        tone: getTone(bestRelic, best.synergy || {}),
        recommendedIndex: best.index,
        recommendedId: bestRelic?.id || null,
        cells: [
            { label: '추천', value: getRelicDisplayName(bestRelic?.name) || '추천 유물' },
            { label: '이유', value: best.reason },
            { label: '성장 방향', value: best.build },
        ],
    };
};
