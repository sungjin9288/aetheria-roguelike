import type { Item, ItemType } from '../types/index.js';

/**
 * 가방 아이템 "사용"의 수락 규칙과 엘릭서 판정 — 한 곳에서 정하고 모두가 읽는다.
 *
 * - 엔진(`consumableEffect.resolveConsumableEffect`)은 소모품 종류와 엘릭서 완전 회복을 이 판정으로 정한다.
 * - 리듀서(`USE_INVENTORY_ITEM`)는 `isInventoryUseAccepted`로 받고, 장비면 장착 · 아니면 소모품 경로로 보낸다.
 * - 표시(인벤토리 "사용" 버튼 · 소모품 문구 · 접두어 문구)도 같은 판정을 읽는다 — 재료 · 열쇠에 눌러도 아무 일 없는
 *   "사용" 버튼이 있었고(리듀서가 조용히 거부), 접두어 엘릭서는 "생명 +10006"처럼 수치로 그려졌다(2026-10 Wave 62).
 *
 * `statsCalculator → equipmentUtils` 순환을 피하려고 의존이 없는 잎 모듈로 둔다(equipmentUtils도 이 판정을 읽는다).
 */

const ELIXIR_NAME = '엘릭서';

const CONSUMABLE_ITEM_TYPES: ReadonlySet<ItemType> = new Set<ItemType>(['hp', 'mp', 'cure', 'buff']);
const EQUIPMENT_USE_TYPES: ReadonlySet<ItemType> = new Set<ItemType>(['weapon', 'armor', 'shield']);

type ItemLike = Pick<Item, 'type' | 'name' | 'prefixed' | 'prefixName'> | null | undefined;

/** 소모품 경로(`resolveConsumableEffect`)가 종류로 받는 아이템 — 생명 · 기력 · 정화 · 강화. */
export const isConsumableItem = (item: ItemLike): boolean => (
    typeof item?.type === 'string' && CONSUMABLE_ITEM_TYPES.has(item.type)
);

/** 장착 경로로 가는 아이템 — 무기 · 방어구 · 방패. */
export const isEquipmentUseItem = (item: ItemLike): boolean => (
    typeof item?.type === 'string' && EQUIPMENT_USE_TYPES.has(item.type)
);

/**
 * `USE_INVENTORY_ITEM`이 받는 아이템 종류 — 장착 또는 소모. 재료(`mat`) · 열쇠(`key`)는 받지 않는다.
 * 인벤토리의 "사용"/"장착" 버튼은 이 판정이 참일 때만 그린다.
 */
export const isInventoryUseAccepted = (item: ItemLike): boolean => (
    isEquipmentUseItem(item) || isConsumableItem(item)
);

/**
 * 엘릭서는 `val`과 무관하게 실효 최대 생명까지 회복한다(엔진 Wave 58). 접두어가 붙은 사본("신성한 엘릭서")도 같다 —
 * 이름 그대로만 보던 동안 그 사본은 val(9999 + 접두어)만큼만 회복해 최대 생명이 그보다 큰 후반에는 완전 회복이 아니었다.
 */
export const isFullRestoreElixir = (item: ItemLike): boolean => {
    if (item?.type !== 'hp' || typeof item.name !== 'string') return false;
    if (item.name === ELIXIR_NAME) return true;
    return item.prefixed === true && typeof item.prefixName === 'string' && item.name === `${item.prefixName} ${ELIXIR_NAME}`;
};
