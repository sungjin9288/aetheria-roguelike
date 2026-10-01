import { BALANCE } from '../data/constants.js';
import {
    ALL_RESIST_ELEMENTS,
    EQUIPMENT_PASSIVES,
    type EquipmentPassive,
    type ResistElement,
} from '../data/equipmentPassives.js';
import { resolveEquipmentBaseIdentity } from './equipmentBaseIdentity.js';
import type { EquipSlots, Item } from '../types/item.js';
import type { Monster } from '../types/monster.js';

/**
 * 장비 한 개의 상시 효과(Wave 57). 표준 장비 정체성으로 찾으므로 접두어 장비 · 예전 인스턴스도 같은 효과다.
 * 장비가 아니거나 표에 없으면 `null`.
 */
export const getItemEquipmentPassive = (item: Item | null | undefined): EquipmentPassive | null => {
    const base = resolveEquipmentBaseIdentity(item);
    if (!base || (base.type !== 'armor' && base.type !== 'shield')) return null;
    return EQUIPMENT_PASSIVES[base.type][base.name] ?? null;
};

export interface EquipmentPassiveSummary {
    /** 막는 원소(정렬 · 중복 없음). 같은 원소를 막는 장비가 둘이어도 한 번이다. */
    resist: ResistElement[];
    /** 행동마다 회복하는 최대 생명 비율의 합. */
    regenPerTurn: number;
    /** 재생 로그에 쓰는 장비 이름(첫 재생 장비). */
    regenSource: string | null;
}

/** 장착한 방어구 · 보조 방패의 상시 효과를 모은다(무기는 상시 효과가 없다). */
export const getEquipmentPassives = (equip: EquipSlots | null | undefined): EquipmentPassiveSummary => {
    const resist = new Set<ResistElement>();
    let regenPerTurn = 0;
    let regenSource: string | null = null;
    for (const item of [equip?.armor, equip?.offhand] as Array<Item | null | undefined>) {
        const passive = getItemEquipmentPassive(item);
        if (!passive) continue;
        passive.resist?.forEach((element) => resist.add(element));
        if (passive.regenPerTurn && passive.regenPerTurn > 0) {
            regenPerTurn += passive.regenPerTurn;
            regenSource ??= item?.name ?? null;
        }
    }
    return {
        resist: ALL_RESIST_ELEMENTS.filter((element) => resist.has(element)),
        regenPerTurn,
        regenSource,
    };
};

/** 적 공격의 원소 — 적 자신의 원소(`resistance`)다(Wave 57 소유자 결정). `물리`이거나 없으면 원소 없는 공격. */
export const getEnemyAttackElement = (enemy: Pick<Monster, 'resistance'> | null | undefined): ResistElement | null => {
    const element = enemy?.resistance;
    return element && element !== '물리' ? element : null;
};

/** 이 원소의 공격에 곱하는 받는 피해 배율 — 막으면 `BALANCE.EQUIP_ELEMENT_RESIST_MULT`, 아니면 1. */
export const getEquipmentResistMult = (
    resist: readonly ResistElement[] | null | undefined,
    element: ResistElement | null,
): number => (element && resist?.includes(element) ? BALANCE.EQUIP_ELEMENT_RESIST_MULT : 1);
