import { DB } from '../data/db';
import { toArray, makeItem, findItemByName } from '../utils/gameUtils';

/**
 * createInventoryActions — 아이템 사용, 장비, 마켓, 제작, 퀘스트 완료
 */
export const createInventoryActions = ({ player, gameState, dispatch, addLog }) => ({

    useItem: (item) => {
        if (['weapon', 'armor', 'shield'].includes(item.type)) {
            let newInv = player.inv.filter((i) => i.id !== item.id);
            const currentEquip = { ...player.equip };

            if (item.type === 'armor') {
                if (currentEquip.armor && currentEquip.armor.name !== '천옷') newInv.push(currentEquip.armor);
                currentEquip.armor = item;
            } else if (item.type === 'weapon') {
                if (currentEquip.weapon && currentEquip.weapon.name !== '맨손') newInv.push(currentEquip.weapon);
                if (item.hands === 2 && currentEquip.offhand) {
                    newInv.push(currentEquip.offhand);
                    currentEquip.offhand = null;
                    addLog('info', '양손 무기 장착으로 보조 장비를 해제했습니다.');
                }
                currentEquip.weapon = item;
            } else if (item.type === 'shield') {
                if (currentEquip.offhand) newInv.push(currentEquip.offhand);
                if (currentEquip.weapon?.hands === 2) {
                    newInv.push(currentEquip.weapon);
                    currentEquip.weapon = DB.ITEMS.weapons[0];
                    addLog('info', '방패 장착으로 양손 무기를 해제했습니다.');
                }
                currentEquip.offhand = item;
            }

            dispatch({ type: 'SET_PLAYER', payload: { ...player, inv: newInv, equip: currentEquip } });
            addLog('success', `${item.name} 장착.`);
            return;
        }

        const removeOne = () => player.inv.filter((i) => i.id !== item.id);
        if (item.type === 'hp') {
            dispatch({
                type: 'SET_PLAYER',
                payload: (p) => ({ ...p, hp: Math.min(p.maxHp, p.hp + (item.val || 0)), inv: removeOne() })
            });
            addLog('success', `${item.name} 사용.`);
            return;
        }
        if (item.type === 'mp') {
            dispatch({
                type: 'SET_PLAYER',
                payload: (p) => ({ ...p, mp: Math.min(p.maxMp, p.mp + (item.val || 0)), inv: removeOne() })
            });
            addLog('success', `${item.name} 사용.`);
            return;
        }
        if (item.type === 'cure') {
            dispatch({
                type: 'SET_PLAYER',
                payload: (p) => ({
                    ...p,
                    status: toArray(p.status).filter((s) => s !== item.effect),
                    inv: removeOne()
                })
            });
            addLog('success', `${item.name} 사용: 상태이상 해제`);
            return;
        }
        if (item.type === 'buff') {
            dispatch({
                type: 'SET_PLAYER',
                payload: (p) => ({
                    ...p,
                    tempBuff: {
                        atk: item.effect === 'atk_up' || item.effect === 'all_up' ? (item.val || 1.3) - 1 : 0,
                        def: item.effect === 'def_up' || item.effect === 'all_up' ? (item.val || 1.3) - 1 : 0,
                        turn: item.turn || 3,
                        name: item.name
                    },
                    inv: removeOne()
                })
            });
            addLog('success', `${item.name} 사용: 버프 활성화`);
        }
    },

    market: (type, item) => {
        if (gameState !== 'shop') return;
        if (type === 'buy') {
            if (player.gold >= item.price) {
                dispatch({
                    type: 'SET_PLAYER',
                    payload: (p) => ({ ...p, gold: p.gold - item.price, inv: [...p.inv, makeItem(item)] })
                });
                addLog('success', `${item.name} 구매 완료.`);
            } else {
                addLog('error', '골드가 부족합니다.');
            }
        } else if (type === 'sell') {
            const sellPrice = Math.floor(item.price * 0.5);
            const idx = player.inv.findIndex((i) => i.id === item.id);
            if (idx > -1) {
                const newInv = [...player.inv];
                newInv.splice(idx, 1);
                dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, gold: p.gold + sellPrice, inv: newInv }) });
                addLog('success', `${item.name} 판매 완료 (+${sellPrice}G)`);
            }
        }
    },

    craft: (recipeId) => {
        const recipe = DB.ITEMS.recipes?.find((r) => r.id === recipeId);
        if (!recipe) return;
        if (player.gold < recipe.gold) return addLog('error', '골드가 부족합니다.');

        for (const input of recipe.inputs) {
            const count = player.inv.filter((i) => i.name === input.name).length;
            if (count < input.qty) return addLog('error', `재료 부족: ${input.name}`);
        }

        let newInv = [...player.inv];
        for (const input of recipe.inputs) {
            let removed = 0;
            newInv = newInv.filter((invItem) => {
                if (invItem.name === input.name && removed < input.qty) {
                    removed += 1;
                    return false;
                }
                return true;
            });
        }

        const craftedTemplate = findItemByName(recipe.name);
        const craftedItem = craftedTemplate
            ? makeItem(craftedTemplate)
            : makeItem({ name: recipe.name, type: 'mat', price: 0, desc: 'Crafted item', desc_stat: 'CRAFTED' });

        dispatch({
            type: 'SET_PLAYER',
            payload: (p) => ({ ...p, gold: p.gold - recipe.gold, inv: [...newInv, craftedItem] })
        });
        addLog('success', `${recipe.name} 제작 완료`);
    },

    completeQuest: (qId) => {
        const qData = DB.QUESTS.find((q) => q.id === qId);
        if (!qData) return;

        const pQuest = player.quests.find((q) => q.id === qId);
        if (!pQuest || pQuest.progress < qData.goal) return addLog('error', '아직 완료 조건을 만족하지 못했습니다.');

        const updates = {
            gold: player.gold + (qData.reward.gold || 0),
            exp: player.exp + (qData.reward.exp || 0),
            quests: player.quests.filter((q) => q.id !== qId)
        };

        if (qData.reward.item) {
            const itemData = findItemByName(qData.reward.item);
            if (itemData) {
                updates.inv = [...player.inv, makeItem(itemData)];
                addLog('success', `보상 아이템: ${itemData.name}`);
            }
        }

        dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, ...updates }) });
        addLog('success', `퀘스트 완료: ${qData.title}`);
    },

    claimAchievement: (achId) => {
        const achData = DB.ACHIEVEMENTS.find((a) => a.id === achId);
        if (!achData) return;

        const claimed = player.stats?.claimedAchievements || [];
        if (claimed.includes(achId)) return addLog('info', '이미 수령한 업적입니다.');

        const updates = {
            stats: {
                ...player.stats,
                claimedAchievements: [...claimed, achId]
            }
        };
        if (achData.reward.gold) updates.gold = player.gold + achData.reward.gold;
        if (achData.reward.item) {
            const itemData = findItemByName(achData.reward.item);
            if (itemData) {
                updates.inv = [...player.inv, makeItem(itemData)];
                addLog('success', `업적 보상 아이템: ${itemData.name}`);
            }
        }

        dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, ...updates }) });
        addLog('success', `업적 달성: ${achData.title}`);
    }
});
