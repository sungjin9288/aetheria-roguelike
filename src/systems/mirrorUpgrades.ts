import { BALANCE } from '../data/constants';
import { MIRROR_ENDLESS_NODES, MIRROR_NODES, MIRROR_EFFECT_VALUES, getMirrorNode, type MirrorEndlessStat, type MirrorNodeDef } from '../data/mirror';

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
    /** 2026-09 D1 — 원정마다 골드 없이 쓸 수 있는 정찰 횟수 (scout_charges 노드). */
    freeScoutCharges: number;
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
    const scoutChargesLv = getLevel(mirror, 'scout_charges');

    return {
        startGoldBonus: startGoldLv * MIRROR_EFFECT_VALUES.START_GOLD_PER_LEVEL,
        startBootChoiceBonus: startBootLv,
        campfireChanceBonus: campfireLv * MIRROR_EFFECT_VALUES.CAMPFIRE_BONUS_PER_LEVEL,
        relicPityBonus: relicPityLv * MIRROR_EFFECT_VALUES.RELIC_PITY_BONUS_PER_LEVEL,
        restCostMult: Math.max(0, 1 - restDiscountLv * MIRROR_EFFECT_VALUES.REST_DISCOUNT_PER_LEVEL),
        reviveEnabled: reviveLv > 0,
        // 2026-09: revive 2단계 — 부활 회복량이 단계에 비례(1단계 30% / 2단계 60%).
        //   기존 의미(치명상 1회 방어)는 그대로, 회복 비율만 확장한다.
        reviveHpRatio: Math.min(1, Math.max(1, reviveLv) * MIRROR_EFFECT_VALUES.REVIVE_HP_RATIO),
        essenceFlowMult: 1 + essenceFlowLv * MIRROR_EFFECT_VALUES.ESSENCE_FLOW_BONUS_PER_LEVEL,
        freeScoutCharges: scoutChargesLv * MIRROR_EFFECT_VALUES.FREE_SCOUT_PER_LEVEL,
    };
};

/** 2026-10 Wave 96: 거울 8노드를 모두 채웠는가 — 끝없는 단계는 그 뒤에 열린다. */
export const isMirrorTreeComplete = (mirror: MirrorLevels | undefined | null): boolean => (
    MIRROR_NODES.every((node) => getLevel(mirror, node.id) >= node.maxLevel)
);

/**
 * 이 노드의 `level` → `level + 1` 비용 — 끝없는 단계는 `MIRROR_ENDLESS_BASE_COST + STEP × level`로 오르다가
 * `MIRROR_ENDLESS_COST_CAP`에서 멈춘다(Wave 97 — 회차 수입이 거의 일정해서, 계속 오르면 회차마다 사는 단계가 줄어든다).
 */
export const getMirrorNodeCost = (node: MirrorNodeDef, level: number): number => {
    const lv = Math.max(0, Math.floor(Number(level) || 0));
    if (node.endless) {
        return Math.min(BALANCE.MIRROR_ENDLESS_COST_CAP, BALANCE.MIRROR_ENDLESS_BASE_COST + BALANCE.MIRROR_ENDLESS_COST_STEP * lv);
    }
    return node.costs[lv] ?? 0;
};

/** 끝없는 단계 한 번에 오르는 영구 능력치. */
export const getMirrorEndlessStatGain = (stat: MirrorEndlessStat): number => (
    stat === 'atk' ? BALANCE.MIRROR_ENDLESS_ATK_PER_LEVEL
        : stat === 'hp' ? BALANCE.MIRROR_ENDLESS_HP_PER_LEVEL
            : BALANCE.MIRROR_ENDLESS_MP_PER_LEVEL
);

/** 끝없는 단계 `levels`번에 든 정수 총액 — 상한 전은 등차, 상한부터는 같은 값이라 합은 닫힌 식이다. */
const getEndlessSpent = (levels: number): number => {
    const { MIRROR_ENDLESS_BASE_COST: base, MIRROR_ENDLESS_COST_STEP: step, MIRROR_ENDLESS_COST_CAP: cap } = BALANCE;
    const rising = Math.min(levels, Math.max(0, Math.ceil((cap - base) / step)));
    return rising * base + (step * rising * (rising - 1)) / 2 + (levels - rising) * cap;
};

export interface MirrorEndlessAffordance {
    /** 거울 8노드를 모두 채워 끝없는 단계가 열렸는가 — 아니면 나머지 값은 0 · null이다. */
    unlocked: boolean;
    /** 이 정수로 살 수 있는 끝없는 단계 수 — 매번 가장 싼 단계를 사는 순서(가장 많이 사는 순서)다. */
    steps: number;
    /** 지금 레벨에서 가장 싼 다음 단계의 비용. */
    nextCost: number | null;
    /** 한 단계도 못 살 때 다음 단계까지 모자란 정수(살 수 있으면 0). */
    shortfall: number;
}

/**
 * 2026-10 Wave 98: 정수 `essence`로 끝없는 단계를 몇 번 살 수 있는가 — 계승 화면 안내가 읽는다(표시만, 구매는 `purchaseMirrorNode`).
 * 노드마다 비용이 단계에 따라 줄지 않으므로 매번 가장 싼 단계를 사면 가장 많이 산다. 상한에 닿은 뒤는 모든 단계가 같은 값이라
 * 닫힌 식으로 센다 — 정수가 아무리 커도 반복은 상한까지의 단계 수(노드당 20) 안이다.
 */
export const getMirrorEndlessAffordance = (
    mirror: MirrorLevels | undefined | null,
    essence: number,
): MirrorEndlessAffordance => {
    if (!isMirrorTreeComplete(mirror)) return { unlocked: false, steps: 0, nextCost: null, shortfall: 0 };
    const cap = BALANCE.MIRROR_ENDLESS_COST_CAP;
    const levels = MIRROR_ENDLESS_NODES.map((node) => getLevel(mirror, node.id));
    const costOf = (index: number) => getMirrorNodeCost(MIRROR_ENDLESS_NODES[index], levels[index]);
    const cheapest = () => levels.reduce((best, _lv, index) => (costOf(index) < costOf(best) ? index : best), 0);
    const nextCost = costOf(cheapest());
    const budget = Math.max(0, Math.floor(Number(essence) || 0));
    let remaining = budget;
    let steps = 0;
    for (;;) {
        const index = cheapest();
        const cost = costOf(index);
        if (cost >= cap) {
            steps += Math.floor(remaining / cap);
            break;
        }
        if (cost > remaining) break;
        remaining -= cost;
        levels[index] += 1;
        steps += 1;
    }
    return { unlocked: true, steps, nextCost, shortfall: steps > 0 ? 0 : nextCost - budget };
};

export interface MirrorEndlessCycle {
    /** 이번 회차에 새긴 끝없는 단계 수(세 능력치 합). */
    steps: number;
    /** 능력치별 단계 수. */
    levels: Record<MirrorEndlessStat, number>;
    /** 능력치별로 오른 영구 능력치(단계 수 × 단계당 양). */
    gains: Record<MirrorEndlessStat, number>;
}

type MirrorEndlessCycleMeta = {
    prestigeRank?: number;
    mirrorEndlessCycle?: { rank: number; atk: number; hp: number; mp: number };
} | null | undefined;

const ENDLESS_STATS: readonly MirrorEndlessStat[] = ['atk', 'hp', 'mp'];
const getCurrentRank = (meta: MirrorEndlessCycleMeta): number => Math.max(0, Math.floor(Number(meta?.prestigeRank) || 0));

/**
 * 2026-10 Wave 99: 이번 회차(지금 계승 단계)에 새긴 끝없는 거울 — 기록의 단계가 지금 단계와 다르면(계승 뒤 · 이전 세이브) 0이다.
 * 기록은 영구 meta라 사망 재시작을 넘어 회차 내내 쌓인다.
 */
export const getMirrorEndlessCycle = (meta: MirrorEndlessCycleMeta): MirrorEndlessCycle => {
    const record = meta?.mirrorEndlessCycle;
    const current = record && record.rank === getCurrentRank(meta) ? record : null;
    const levels = Object.fromEntries(ENDLESS_STATS.map((stat) => [stat, Math.max(0, Math.floor(Number(current?.[stat]) || 0))])) as Record<MirrorEndlessStat, number>;
    const gains = Object.fromEntries(ENDLESS_STATS.map((stat) => [stat, levels[stat] * getMirrorEndlessStatGain(stat)])) as Record<MirrorEndlessStat, number>;
    return { steps: levels.atk + levels.hp + levels.mp, levels, gains };
};

/** 끝없는 단계 하나를 산 뒤의 회차 기록 — 지금 단계로 키를 맞추고, 단계가 바뀌었으면 0부터 센다. */
export const recordMirrorEndlessCycle = (
    meta: MirrorEndlessCycleMeta,
    stat: MirrorEndlessStat,
): { rank: number; atk: number; hp: number; mp: number } => {
    const { levels } = getMirrorEndlessCycle(meta);
    return { rank: getCurrentRank(meta), ...levels, [stat]: levels[stat] + 1 };
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
    // 2026-10 Wave 96: 끝없는 단계는 거울 8노드를 모두 채운 뒤에만 산다.
    if (node.endless && !isMirrorTreeComplete(current)) {
        return { mirror: current, success: false, cost: 0, newLevel: currentLevel };
    }

    const cost = getMirrorNodeCost(node, currentLevel);
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

/**
 * getSpentMirrorEssence — 거울 레벨 이력으로부터 "이미 지출한 계승 정수" 총액을 역산.
 * 구매는 항상 Lv0→1→2… 순서이므로 노드별 costs 앞에서부터 레벨 수만큼 더하면 정확하다.
 * dataMigration의 essenceLifetime 백필(v5.1)과 거울 UI의 투자 총액 표시가 함께 쓴다.
 */
export const getSpentMirrorEssence = (mirror: MirrorLevels | undefined | null): number => (
    MIRROR_NODES.reduce((total, node) => {
        const level = getLevel(mirror, node.id);
        return total + node.costs.slice(0, level).reduce((sum, cost) => sum + cost, 0);
    }, 0)
    // 2026-10 Wave 96: 끝없는 단계에 쓴 정수도 지출이다(누적 정수 역산이 쓴다).
    + MIRROR_ENDLESS_NODES.reduce((total, node) => total + getEndlessSpent(getLevel(mirror, node.id)), 0)
);

export { MIRROR_NODES };
