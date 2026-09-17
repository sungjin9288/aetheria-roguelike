/**
 * Item domain types (cycle 58 phase 4 — 도메인 타입 통합).
 *
 * items.ts의 weapons/armors/consumables/materials 슬롯에 들어가는 모든 모양을 망라.
 *
 * 2026-09 Wave 3 L stage 1: `[key: string]: any` 인덱스 시그니처 5개 제거
 * (+ ItemDatabase의 카테고리 인덱스 시그니처도 7개 고정 카테고리로 대체).
 * 데이터 실측 필드(`mpBonus`/`hpBonus`/`evasion`)를 선언하고 `type`은 9종 유니온으로
 * 좁혔다. 계약은 `tests/data-shape-types.test.js`가 런타임으로 검증한다.
 */

/**
 * items.ts에 실제로 존재하는 `type` 값 전체 (9종).
 * weapons/armors는 장비, hp/mp/cure/buff는 소비 아이템, mat/key는 소재·열쇠.
 * 2026-09 L stage 1: 인덱스 시그니처 제거와 함께 리터럴 유니온으로 복원.
 */
export type ItemType =
    | 'weapon'
    | 'armor'
    | 'shield'
    | 'hp'
    | 'mp'
    | 'cure'
    | 'buff'
    | 'mat'
    | 'key';

// cycle 369: export 제거 — 외부 import 0건 (src/utils, src/components, src/hooks,
//   src/systems 모두). 동일 파일 Item 유니온 / EquipSlots 필드 타입 구성용 private.
interface ItemBase {
    id?: string;
    name?: string;
    type?: ItemType;
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
    /** 무기/방어구의 추가 MP (items.ts 실측 — `mp`와 별개 필드). */
    mpBonus?: number;
    /** 방어구의 추가 HP (items.ts 실측 — `hp`와 별개 필드). */
    hpBonus?: number;
    /** 방어구의 회피율 보너스. */
    evasion?: number;
    /**
     * 명시적 등급. ITEMS 데이터 어디에도 없고 `useGameTestApi`(QA 시드)만 설정한다.
     * `getItemRarity`(utils/gameUtils.ts:71)가 tier 매핑보다 우선 읽으므로 optional로 유지.
     */
    rarity?: string;
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
    type: 'hp' | 'mp' | 'cure' | 'buff';
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
}

/** 세트 효과 정의 (items.js의 sets 카테고리). */
export interface ItemSetDef {
    prefix?: string;
    setBonus?: Record<string, number>;
    desc?: string;
}

/** 제작 레시피 정의 (items.js의 recipes 카테고리). */
export interface ItemRecipeDef {
    id?: string;
    name?: string;
    inputs?: Array<{ name?: string; qty?: number }>;
    gold?: number;
}

/** 접두사 정의 (items.js의 prefixes 카테고리 — 랜덤 강화 접두사). */
export interface ItemPrefixDef {
    name?: string;
    type?: string;
    stat?: string;
    val?: number;
    elem?: string;
    price?: number;
}

/**
 * items.js 최상위 export 구조 — 카테고리별 배열 딕셔너리.
 * 2026-07 타입화: `ITEMS: any` → 실제 데이터 구조(weapons/armors/.../recipes)를
 * 반영한 최소 인터페이스. DB.ITEMS 소비처(36개 파일)는 대부분
 * `Object.values(DB.ITEMS)` 또는 `DB.ITEMS.weapons` 형태로 접근.
 */
export interface ItemDatabase {
    weapons: Item[];
    armors: Item[];
    consumables: Item[];
    materials: Item[];
    prefixes: ItemPrefixDef[];
    sets: ItemSetDef[];
    recipes: ItemRecipeDef[];
}
