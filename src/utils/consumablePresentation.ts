import { MSG } from '../data/messages';
import { isFullRestoreElixir } from '../systems/consumableRules';
import type { Item, StatusId } from '../types/index.js';

const CURE_COMPACT: Record<string, string> = {
    poison: '해독',
    burn: '화상',
    freeze: '해빙',
    curse: '저주',
};

/** 정화 대상 라벨 — 상태 칩과 같은 `MSG.STATUS_LABELS`. 원시 효과 id("poison")를 그리지 않는다(Wave 61, 원장 §61.3). */
const getCureDetail = (effect: string | undefined) => {
    const label = effect ? MSG.STATUS_LABELS[effect as StatusId] : undefined;
    return label ? MSG.CONSUMABLE_CURE_STATUS(label) : MSG.CONSUMABLE_CURE_ANY;
};

/**
 * 강화 물약이 올리는 능력치 — 엔진(`consumableEffect.getBuff`)은 `all_up`에서 공격력 · 방어력 둘만 올린다.
 * "ALL"이라 쓰던 동안 영웅의 물약이 모든 능력치를 올리는 것처럼 읽혔다(Wave 61, 원장 §61.3).
 */
const getBuffTarget = (effect: string | undefined) => (
    effect === 'atk_up' ? 'ATK' : effect === 'def_up' ? 'DEF' : effect === 'all_up' ? 'ATK·DEF' : ''
);

export const getConsumableCompactLabel = (item: Item | null | undefined) => {
    if (item?.type === 'hp') return isFullRestoreElixir(item) ? 'HP∞' : `HP${item.val ?? ''}`;
    if (item?.type === 'mp') return `MP${item.val ?? ''}`;
    if (item?.type === 'cure') return CURE_COMPACT[item.effect ?? ''] || '치료';
    if (item?.type === 'buff') {
        const target = getBuffTarget(item.effect);
        if (target) return target;
    }
    return item?.name || '소모품';
};

export const getConsumableDescription = (item: Item | null | undefined, { includeTurnCost = false } = {}) => {
    let detail = '';
    if (item?.type === 'hp') detail = isFullRestoreElixir(item) ? MSG.CONSUMABLE_HP_FULL_RESTORE : `HP ${item.val ?? 0} 회복`;
    if (item?.type === 'mp') detail = `MP ${item.val ?? 0} 회복`;
    if (item?.type === 'cure') detail = getCureDetail(item.effect);
    if (item?.type === 'buff') {
        const target = getBuffTarget(item.effect);
        const percent = Number.isFinite(item.val) ? Math.round(((item.val ?? 0) - 1) * 100) : 0;
        detail = `${target ? `${target} ` : ''}+${percent}% · ${item.turn ?? 0}턴`;
    }
    return includeTurnCost && detail ? `${detail} · 전투 턴 1회 소모` : detail;
};

/**
 * 상점 비교 줄의 소모품 효과(생명 · 기력 어휘). 상점 컴포넌트가 직접 만들던 문구라 엘릭서를 "생명 9999 회복",
 * 정화를 "poison 해제"로 그렸다(Wave 61, 원장 §61.3).
 */
export const getConsumableEffectSummary = (item: Item | null | undefined) => {
    if (item?.type === 'hp') return isFullRestoreElixir(item) ? MSG.CONSUMABLE_HP_FULL_RESTORE : MSG.CONSUMABLE_HP_RESTORE(item.val || 0);
    if (item?.type === 'mp') return MSG.CONSUMABLE_MP_RESTORE(item.val || 0);
    if (item?.type === 'cure') return getCureDetail(item.effect);
    if (item?.type === 'buff') return MSG.CONSUMABLE_BUFF_TURNS(item.turn || 0);
    return '';
};
