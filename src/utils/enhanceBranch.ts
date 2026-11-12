/**
 * 강화 갈래 판정 (2026-11 H6, 소유자 결정 "권고안대로" — 실행 스케치 EXECUTION_SKETCH_H6_2026-11.md §4).
 *
 * 강화가 `BALANCE.ENHANCE_BRANCH_LEVELS`(+3 · +6)에 닿을 때 그 장비 종류의 갈래 둘 중 하나를 고른다. 이 파일이
 * "이번 강화가 갈래 단계에 닿는가 · 고를 수 있는 갈래 · 장착 장비의 갈래 효과"를 소유하고 리듀서(`ENHANCE_ITEM`) ·
 * 강화 카드 · 능력치 계산(`calculateFullStats`) · 장비 상시 효과(`getEquipmentPassives`)가 같이 읽는다.
 *
 * 갈래는 순서대로다 — `enhanceBranches[i]`가 i번째 갈래 단계의 갈래다. 장의 선물(H3)의 무료 강화처럼 골드 강화가 아닌
 * 길로 단계를 건너뛰면 그 단계의 갈래는 "고르지 않은 갈래"로 남고, 다음 골드 강화가 지금 닿는 단계의 갈래와 함께
 * 고르게 한다(`getOwedEnhanceBranchLevels`). 실패한 강화는 갈래도 붙이지 않는다.
 *
 * 이 파일은 `equipmentUtils`를 가져오지 않는다 — `equipmentUtils → equipmentPassives → 이 파일`의 순환을 피한다.
 * 무기 · 방어구 값에 곱하는 일은 호출하는 쪽(`statsCalculator`)이 한다.
 */
import { BALANCE } from '../data/constants.js';
import {
    ENHANCE_BRANCHES,
    ENHANCE_BRANCH_IDS,
    type EnhanceBranchDef,
    type EnhanceBranchId,
    type EnhanceBranchKind,
} from '../data/enhanceBranches.js';
import type { EquipSlots, Item } from '../types/item.js';

export type { EnhanceBranchId, EnhanceBranchKind } from '../data/enhanceBranches.js';

const BRANCH_LEVELS: readonly number[] = BALANCE.ENHANCE_BRANCH_LEVELS;

export const isEnhanceBranchId = (value: unknown): value is EnhanceBranchId => (
    typeof value === 'string' && (ENHANCE_BRANCH_IDS as readonly string[]).includes(value)
);

export const getEnhanceBranchDef = (id: EnhanceBranchId): EnhanceBranchDef => ENHANCE_BRANCHES[id];

/** 장비의 갈래 종류 — 무기 · 방어구 · 보조 장비(방패 · 마력 보조 장비). 그 밖은 `null`. */
export const getEnhanceBranchKind = (item: Item | null | undefined): EnhanceBranchKind | null => {
    if (item?.type === 'weapon') return 'weapon';
    if (item?.type === 'armor') return 'armor';
    if (item?.type === 'shield') return 'offhand';
    return null;
};

/** 이 종류 · 단계에서 고를 수 있는 갈래(표 순서). 갈래 단계가 아니면 빈 배열. */
export const getEnhanceBranchOptions = (kind: EnhanceBranchKind | null, level: number): EnhanceBranchId[] => (
    kind ? ENHANCE_BRANCH_IDS.filter((id) => ENHANCE_BRANCHES[id].kind === kind && ENHANCE_BRANCHES[id].level === level) : []
);

/**
 * 장비가 고른 갈래(검증된 것만). i번째가 i번째 갈래 단계의 그 종류 갈래이고 강화 단계가 그 단계에 닿은 동안만 읽는다 —
 * 맞지 않는 첫 칸에서 멈춘다(이전 · 위조 값, 종류가 다른 갈래).
 */
export const getItemEnhanceBranches = (item: Item | null | undefined): EnhanceBranchId[] => {
    const raw = item?.enhanceBranches;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const kind = getEnhanceBranchKind(item);
    const level = item?.enhance || 0;
    const branches: EnhanceBranchId[] = [];
    for (let index = 0; index < raw.length && index < BRANCH_LEVELS.length; index += 1) {
        const id = raw[index];
        const stage = BRANCH_LEVELS[index];
        if (!isEnhanceBranchId(id) || level < stage) break;
        const def = ENHANCE_BRANCHES[id];
        if (def.kind !== kind || def.level !== stage) break;
        branches.push(id);
    }
    return branches;
};

/** `nextLevel`로 강화할 때 골라야 하는 갈래 단계 — 그 단계 이하인데 아직 고르지 않은 갈래 단계(순서대로). */
export const getOwedEnhanceBranchLevels = (item: Item | null | undefined, nextLevel: number): number[] => {
    if (!getEnhanceBranchKind(item)) return [];
    const chosen = getItemEnhanceBranches(item).length;
    return BRANCH_LEVELS.slice(chosen).filter((stage) => stage <= nextLevel);
};

/**
 * 강화 요청의 갈래 선택을 검증한다 — 골라야 하는 단계마다 그 단계의 갈래 하나, 순서대로. 맞으면 고른 갈래 배열,
 * 아니면 `null`(골라야 할 갈래가 없는데 보낸 선택도 `null`이다).
 */
export const resolveEnhanceBranchChoices = (
    item: Item | null | undefined,
    nextLevel: number,
    choices: unknown,
): EnhanceBranchId[] | null => {
    const owed = getOwedEnhanceBranchLevels(item, nextLevel);
    const list = choices == null ? [] : choices;
    if (!Array.isArray(list) || list.length !== owed.length) return null;
    const kind = getEnhanceBranchKind(item);
    const resolved: EnhanceBranchId[] = [];
    for (let index = 0; index < owed.length; index += 1) {
        const id = list[index];
        if (!isEnhanceBranchId(id) || !getEnhanceBranchOptions(kind, owed[index]).includes(id)) return null;
        resolved.push(id);
    }
    return resolved;
};

/** 성공한 강화 뒤의 장비 — 단계와 고른 갈래를 함께 올린다(갈래가 없으면 단계만). */
export const withEnhanceResult = (item: Item, nextLevel: number, choices: readonly EnhanceBranchId[]): Item => (
    choices.length === 0
        ? { ...item, enhance: nextLevel }
        : { ...item, enhance: nextLevel, enhanceBranches: [...getItemEnhanceBranches(item), ...choices] }
);

/** 장착 장비 갈래의 비율 합 — 값에 곱하는 일은 호출하는 쪽이 한다. */
export interface EquipEnhanceBranchRatios {
    /** 주 무기 공격력 값에 곱하는 비율. */
    weaponAtkPct: number;
    /** 보조 손 무기 공격력 값에 곱하는 비율. */
    offhandAtkPct: number;
    /** 방어구 방어력 값에 곱하는 비율. */
    armorDefPct: number;
    crit: number;
    hpPct: number;
    mpPct: number;
    regen: number;
    /** 재생 기록에 쓰는 장비 이름(첫 재생 갈래 장비). */
    regenSource: string | null;
}

const EMPTY_RATIOS: EquipEnhanceBranchRatios = Object.freeze({
    weaponAtkPct: 0,
    offhandAtkPct: 0,
    armorDefPct: 0,
    crit: 0,
    hpPct: 0,
    mpPct: 0,
    regen: 0,
    regenSource: null,
});

export const getEquipEnhanceBranchRatios = (equip: EquipSlots | null | undefined): EquipEnhanceBranchRatios => {
    const slots = [['weapon', equip?.weapon], ['armor', equip?.armor], ['offhand', equip?.offhand]] as const;
    return slots.reduce<EquipEnhanceBranchRatios>((acc, [slot, item]) => (
        getItemEnhanceBranches(item).reduce<EquipEnhanceBranchRatios>((sum, id) => {
            const { stat, value } = ENHANCE_BRANCHES[id];
            if (stat === 'atkPct') {
                return slot === 'offhand'
                    ? { ...sum, offhandAtkPct: sum.offhandAtkPct + value }
                    : { ...sum, weaponAtkPct: sum.weaponAtkPct + value };
            }
            if (stat === 'defPct') return { ...sum, armorDefPct: sum.armorDefPct + value };
            if (stat === 'crit') return { ...sum, crit: sum.crit + value };
            if (stat === 'hpPct') return { ...sum, hpPct: sum.hpPct + value };
            if (stat === 'mpPct') return { ...sum, mpPct: sum.mpPct + value };
            return { ...sum, regen: sum.regen + value, regenSource: sum.regenSource ?? item?.name ?? null };
        }, acc)
    ), EMPTY_RATIOS);
};
