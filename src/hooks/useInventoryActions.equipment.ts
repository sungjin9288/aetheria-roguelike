import { AT } from '../reducers/actionTypes';
import { getEquipmentIdentity } from '../utils/equipmentUtils';
import type { EquipSlots, Item, Player } from '../types/index.js';

const findEnhanceTarget = (player: Player, itemId: string) => {
    // 'equip:<slot>' 형식의 id만 fallbackSlot을 갖는다 — 슬롯 키는 EquipSlots의 3종.
    const fallbackSlot = itemId.startsWith('equip:') ? (itemId.split(':')[1] as keyof EquipSlots) : null;
    const equippedSlot = (['weapon', 'armor', 'offhand'] as const).find((slot) => (
        player.equip?.[slot]?.id === itemId
    ));
    const slot = fallbackSlot || equippedSlot || null;
    return (player.inv || []).find((entry: any) => entry.id === itemId)
        || (slot ? player.equip?.[slot] : null)
        || null;
};

/** UI는 선택 대상과 난수만 전달하고, 장착·소비·강화 결과는 reducer가 확정한다. */
export const createEquipmentActions = ({ player, dispatch }: any) => ({
    useItem: (item: Item) => {
        if (!item?.id) return;
        dispatch({
            type: AT.USE_INVENTORY_ITEM,
            payload: { itemId: item.id },
        });
    },

    enhanceItem: (itemId: string) => {
        const item = findEnhanceTarget(player, itemId);
        if (!item) return;
        dispatch({
            type: AT.ENHANCE_ITEM,
            payload: {
                itemId,
                expectedItemIdentity: getEquipmentIdentity(item),
                expectedLevel: item.enhance || 0,
                expectedGold: player.gold || 0,
                roll: Math.random(),
                relicRoll: Math.random(),
            },
        });
    },
});
