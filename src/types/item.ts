/**
 * Item domain types (cycle 58 phase 4 — 도메인 타입 통합).
 *
 * items.js의 weapons/armors/consumables/materials 슬롯에 들어가는 모든 모양을 망라.
 * 점진 적용 — 이 타입을 import하는 파일은 ts-nocheck 제거 가능.
 */

// cycle 284: ItemType type alias 제거 — import 0건. item.type은 string으로 직접 사용.

export interface ItemBase {
    id?: string;
    name?: string;
    type?: string;
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
    /** 무기 양손/한손 (1=한손, 2=양손). */
    hands?: number;
    /** 기본 ATK/DEF 값. */
    val?: number;
    /** 추가 MP. */
    mp?: number;
    /** 추가 크리티컬 확률. */
    crit?: number;
    /** 추가 HP. */
    hp?: number;
    /** 'focus' 등 세부 분류. */
    subtype?: string;
    /** 효과 종류 (consumable). */
    effect?: string;
    /** 버프 지속 턴. */
    turn?: number;
    /** 동적으로 추가 가능한 임의 필드 (런타임 확장 호환). */
    [key: string]: any;
}

// cycle 298: 4 type exports → private (외부 import 0건, 동일 파일 내 Item 유니온 구성용).
interface WeaponItem extends ItemBase {
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

interface ArmorItem extends ItemBase {
    type: 'armor';
    /** 기본 DEF. */
    val?: number;
    /** HP 보너스. */
    hp?: number;
}

interface ShieldItem extends ItemBase {
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

type EquipmentItem = WeaponItem | ArmorItem | ShieldItem;
export type Item = EquipmentItem | ConsumableItem | ItemBase;

/** 장비 슬롯 (player.equip). cycle 60: 임의 Item 할당 호환을 위해 완화. */
export interface EquipSlots {
    weapon?: ItemBase | null;
    armor?: ItemBase | null;
    offhand?: ItemBase | null;
    /** 동적으로 추가 가능한 슬롯 (런타임 확장 호환). */
    [key: string]: any;
}
