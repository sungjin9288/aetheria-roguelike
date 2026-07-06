import { MIRROR_NODES, MIRROR_EFFECT_VALUES, getMirrorNode } from '../data/mirror';

/**
 * getMirrorEffects — 에테르 거울(에센스 소비 영구 업그레이드 트리) 노드 레벨→효과의
 * 단일 진실 원천. getPrestigeUnlocks(rank) 패턴을 모방 — 순수 함수, meta.mirror만 받아
 * 효과 객체를 반환한다. 모든 소비처(characterActions/exploreActions/explorationPacing/
 * characterActions.rest/CombatEngine.relics/에센스 획득처)가 이 함수만 참조한다.
 */
export interface MirrorEffects {
    startGoldBonus: number;
    startBootChoiceBonus: number;
    campfireChanceBonus: number;
    relicPityBonus: number;
    restCostMult: number;
    reviveEnabled: boolean;
    reviveHpRatio: number;
    essenceFlowMult: number;
}

export type MirrorLevels = Record<string, number>;

const getLevel = (mirror: MirrorLevels | undefined | null, nodeId: string): number => {
    const node = getMirrorNode(nodeId);
    const raw = Math.max(0, Math.floor(Number(mirror?.[nodeId]) || 0));
    return node ? Math.min(raw, node.maxLevel) : 0;
};

export const getMirrorEffects = (meta: { mirror?: MirrorLevels } | undefined | null): MirrorEffects => {
    // 방어적 기본값 — 구세이브(meta.mirror 없음)에서도 전부 무효과로 안전하게 동작.
    const mirror = meta?.mirror || {};

    const startGoldLv = getLevel(mirror, 'start_gold');
    const startBootLv = getLevel(mirror, 'start_boot_extra');
    const campfireLv = getLevel(mirror, 'campfire_rate');
    const relicPityLv = getLevel(mirror, 'relic_pity');
    const restDiscountLv = getLevel(mirror, 'rest_discount');
    const reviveLv = getLevel(mirror, 'revive');
    const essenceFlowLv = getLevel(mirror, 'essence_flow');

    return {
        startGoldBonus: startGoldLv * MIRROR_EFFECT_VALUES.START_GOLD_PER_LEVEL,
        startBootChoiceBonus: startBootLv,
        campfireChanceBonus: campfireLv * MIRROR_EFFECT_VALUES.CAMPFIRE_BONUS_PER_LEVEL,
        relicPityBonus: relicPityLv * MIRROR_EFFECT_VALUES.RELIC_PITY_BONUS_PER_LEVEL,
        restCostMult: Math.max(0, 1 - restDiscountLv * MIRROR_EFFECT_VALUES.REST_DISCOUNT_PER_LEVEL),
        reviveEnabled: reviveLv > 0,
        reviveHpRatio: MIRROR_EFFECT_VALUES.REVIVE_HP_RATIO,
        essenceFlowMult: 1 + essenceFlowLv * MIRROR_EFFECT_VALUES.ESSENCE_FLOW_BONUS_PER_LEVEL,
    };
};

export interface MirrorPurchaseResult {
    mirror: MirrorLevels;
    success: boolean;
    cost: number;
    newLevel: number;
}

/**
 * purchaseMirrorNode — 노드 1레벨 구매 시도. 순수 함수 — 새 mirror 객체를 반환
 * (immutable). 에센스 부족 / 최대레벨 도달 시 success:false + 원본 mirror 그대로 반환
 * (no-op). 에센스 차감은 호출자(reducer)가 essence 필드에 대해 별도로 수행한다 —
 * 이 함수는 mirror 레벨 계산만 담당(단일 책임).
 */
export const purchaseMirrorNode = (
    mirror: MirrorLevels | undefined | null,
    nodeId: string,
    essence: number,
): MirrorPurchaseResult => {
    const current = mirror || {};
    const node = getMirrorNode(nodeId);
    const currentLevel = getLevel(current, nodeId);

    if (!node || currentLevel >= node.maxLevel) {
        return { mirror: current, success: false, cost: 0, newLevel: currentLevel };
    }

    const cost = node.costs[currentLevel];
    if ((essence || 0) < cost) {
        return { mirror: current, success: false, cost, newLevel: currentLevel };
    }

    const newLevel = currentLevel + 1;
    return {
        mirror: { ...current, [nodeId]: newLevel },
        success: true,
        cost,
        newLevel,
    };
};

export { MIRROR_NODES };
