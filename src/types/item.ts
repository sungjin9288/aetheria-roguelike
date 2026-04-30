/**
 * Item domain types (cycle 58 phase 4 — 도메인 타입 통합).
 *
 * items.js의 weapons/armors/consumables/materials 슬롯에 들어가는 모든 모양을 망라.
 * 점진 적용 — 이 타입을 import하는 파일은 ts-nocheck 제거 가능.
 */

export type ItemType = 'weapon' | 'armor' | 'shield' | 'consumable' | 'material' | 'recipe';

export interface ItemBase {
    id?: string;
    name: string;
    type: ItemType;
    desc?: string;
    desc_stat?: string;
    tier?: number;
    price?: number;
    /** items.js의 jobs 배열 — 직업 호환 (세트 효과 매칭). */
    jobs?: string[];
    /** 강화 단계. */
    enhance?: number;
    /** 속성 (화염/냉기/빛 등). */
    elem?: string;
    /** 시그니처 식별자 (선택). */
    signature?: string;
}

export interface WeaponItem extends ItemBase {
    type: 'weapon';
    /** 1=한손, 2=양손. */
    hands?: 1 | 2;
    /** 기본 ATK. */
    val?: number;
    /** 추가 크리티컬 확률 (0~1). */
    crit?: number;
    /** 추가 MP. */
    mp?: number;
}

export interface ArmorItem extends ItemBase {
    type: 'armor';
    /** 기본 DEF. */
    val?: number;
    /** HP 보너스. */
    hp?: number;
}

export interface ShieldItem extends ItemBase {
    type: 'shield';
    val?: number;
    mp?: number;
    crit?: number;
    /** 'focus' (마도서) 등 세부 분류. */
    subtype?: string;
}

export interface ConsumableItem extends ItemBase {
    type: 'consumable';
    /** 효과 강도 (예: 회복량). */
    val?: number;
    /** 효과 종류 — heal_hp / heal_mp / cure 등. */
    effect?: string;
}

export type EquipmentItem = WeaponItem | ArmorItem | ShieldItem;
export type Item = EquipmentItem | ConsumableItem | ItemBase;

/** 장비 슬롯 (player.equip). */
export interface EquipSlots {
    weapon?: WeaponItem | null;
    armor?: ArmorItem | null;
    offhand?: WeaponItem | ShieldItem | null;
}
