import { AT } from '../reducers/actionTypes';
import { getEquipmentIdentity } from '../utils/equipmentUtils';
import { resolveConsumableEffect } from '../systems/consumableEffect';
import type { Item } from '../types/index.js';

const findEnhanceTarget = (player: any, itemId: string) => {
    const fallbackSlot = itemId.startsWith('equip:') ? itemId.split(':')[1] : null;
    const equippedSlot = (['weapon', 'armor', 'offhand'] as const).find((slot) => (
        player.equip?.[slot]?.id === itemId
    ));
    const slot = fallbackSlot || equippedSlot || null;
    return (player.inv || []).find((entry: any) => entry.id === itemId)
        || (slot ? player.equip?.[slot] : null)
        || null;
};

/** UI는 선택 대상과 난수만 전달하고, 장착·소비·강화 결과는 reducer가 확정한다. */
export const createEquipmentActions = ({ player, dispatch, addLog }: any) => ({
    useItem: (item: Item) => {
        if (!item?.id) return;
        const inventoryItem = (player.inv || []).find((entry: any) => entry.id === item.id);
        if (inventoryItem && ['hp', 'mp', 'cure', 'buff'].includes(inventoryItem.type)) {
            const preview = resolveConsumableEffect({ player, item: inventoryItem });
            if (!preview.ok) {
                addLog?.('warn', preview.message);
                return;
            }
        }
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
