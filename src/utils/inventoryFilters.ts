/**
 * 가방 분류 — 가방 화면(`SmartInventory`)의 분류 알약과, 그 분류로 가방을 열어 달라는 요청이 같은 id를 쓴다.
 * 2026-11 화면 점검: 결과 카드의 '회복 아이템 확인' · 원정 정리의 같은 단추가 가방을 '전체'로 열어,
 * 가방이 찬 후반에는 단추가 말한 물건을 다시 찾아야 했다. 추천이 분류를 싣고 단추가 그 분류로 연다.
 */
export const INVENTORY_FILTER_IDS = ['all', 'weapon', 'armor', 'shield', 'hp', 'material'] as const;

export type InventoryFilterId = typeof INVENTORY_FILTER_IDS[number];

/** 같은 분류를 다시 요청해도 가방이 다시 그 분류로 돌아가도록 요청마다 새 번호를 단다. */
export interface InventoryFilterRequest {
    filter: InventoryFilterId;
    nonce: number;
}

/** 회복 · 기력 · 상태이상 회복 · 강화 물약은 모두 '회복' 분류다. */
export const RECOVERY_INVENTORY_FILTER: InventoryFilterId = 'hp';
