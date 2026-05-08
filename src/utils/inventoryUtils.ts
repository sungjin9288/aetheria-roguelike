import { makeItem, findItemByName } from './gameUtils';
import type { Item, Player } from "../types/index.js";

/**
 * inventoryUtils — 인벤토리 조작 공통 유틸리티
 * 모든 함수는 새 플레이어 객체를 반환하며 원본을 변경하지 않습니다.
 */

/**
 * 아이템 정의를 인벤토리에 추가합니다.
 * @param {Object} player
 * @param {Object} itemDef - DB 아이템 정의 객체
 * @returns {Object} 새 player 객체
 *
 * cycle 316: export 제거 — addItemByName 내부 1회 사용만, 외부 consumer 0건.
 */
const addItemToInventory = (player: Player, itemDef: Item) => ({
    ...player,
    inv: [...(player.inv || []), makeItem(itemDef)],
});

/**
 * 이름으로 아이템을 찾아 인벤토리에 추가합니다.
 * 아이템을 찾지 못하면 player를 그대로 반환합니다.
 * @param {Object} player
 * @param {string} itemName
 * @returns {Object} 새 player 객체
 */
export const addItemByName = (player: Player, itemName: string) => {
    const itemDef = findItemByName(itemName);
    if (!itemDef) return player;
    return addItemToInventory(player, itemDef);
};

