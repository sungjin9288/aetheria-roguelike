import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { toArray, makeItem, findItemByName, checkTitles, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, getTitleLabel, isAchievementUnlocked } from '../utils/gameUtils';
import { getEquipmentIdentity, getNextEquipmentState, isTwoHandWeapon } from '../utils/equipmentUtils';
import { AT } from '../reducers/actionTypes';
import { CombatEngine } from '../systems/CombatEngine';

/**
 * createInventoryActions — 아이템 사용, 장비, 마켓, 제작, 퀘스트 완료
 */
export const createInventoryActions = ({ player, gameState, dispatch, addLog, getFullStats }) => {
    const emitUnlockedTitles = (updatedPlayer) => {
        const newTitles = checkTitles(updatedPlayer);
        if (newTitles.length > 0) {
            dispatch({ type: AT.UNLOCK_TITLES, payload: newTitles });
            newTitles.forEach((id) => addLog('system', `🏆 칭호 획득: [${getTitleLabel(id)}]`));
        }
    };

    const emitDailyProtocolLogs = (type, amount = 1) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission) => {
            addLog('system', `📋 일일 프로토콜 완료: ${formatDailyProtocolReward(mission.reward)}`);
        });
    };

    const syncLevelQuests = (updatedPlayer) => {
        const questResult = CombatEngine.updateQuestProgress(updatedPlayer, '');
        return { ...updatedPlayer, quests: questResult.updatedQuests };
    };

    return ({

        useItem: (item) => {
            const inventoryItem = player.inv.find((entry) => entry.id === item.id);
            if (!inventoryItem) return addLog('error', '인벤토리에 없는 아이템입니다.');

            if (['weapon', 'armor', 'shield'].includes(inventoryItem.type)) {
                if (Array.isArray(inventoryItem.jobs) && !inventoryItem.jobs.includes(player.job)) {
                    return addLog('error', `${player.job}은(는) ${inventoryItem.name}을 장착할 수 없습니다.`);
                }

                let newInv = player.inv.filter((entry) => entry.id !== inventoryItem.id);
                const currentEquip = { ...player.equip };
                const inventoryItemKey = getEquipmentIdentity(inventoryItem);
                const pushBackToInventory = (equippedItem) => {
                    if (!equippedItem) return;
                    if (equippedItem.id && equippedItem.id === inventoryItem.id) return;
                    if (equippedItem.name === '맨손' || equippedItem.name === '천옷') return;
                    newInv.push(equippedItem.id ? equippedItem : makeItem(equippedItem));
                };

                if (inventoryItem.type === 'shield' && isTwoHandWeapon(currentEquip.weapon)) {
                    addLog('error', '양손 무기 사용 중에는 방패를 장착할 수 없습니다.');
                    return;
                }

                const nextEquip = getNextEquipmentState(currentEquip, inventoryItem);
                const preservedKeys = new Set(
                    [nextEquip.weapon, nextEquip.offhand, nextEquip.armor]
                        .filter(Boolean)
                        .map((equippedItem) => getEquipmentIdentity(equippedItem))
                );

                [currentEquip.weapon, currentEquip.offhand, currentEquip.armor].forEach((equippedItem) => {
                    const equippedKey = getEquipmentIdentity(equippedItem);
                    if (!equippedItem || equippedKey === inventoryItemKey) return;
                    if (!preservedKeys.has(equippedKey)) pushBackToInventory(equippedItem);
                });

                if (inventoryItem.type === 'weapon') {
                    if (isTwoHandWeapon(inventoryItem) && currentEquip.offhand) {
                        addLog('info', '양손 무기로 전환되어 보조 손 장비가 해제되었습니다.');
                    } else if (!isTwoHandWeapon(inventoryItem) && isTwoHandWeapon(currentEquip.weapon)) {
                        addLog('info', '양손 무기를 해제하고 한손 무기 체계로 전환했습니다.');
                    } else if (getEquipmentIdentity(nextEquip.offhand) === inventoryItemKey) {
                        addLog('info', '보조 손에 한손 무기를 장착했습니다.');
                    } else if (
                        getEquipmentIdentity(nextEquip.weapon) === inventoryItemKey &&
                        getEquipmentIdentity(nextEquip.offhand) === getEquipmentIdentity(currentEquip.weapon) &&
                        getEquipmentIdentity(currentEquip.weapon) !== inventoryItemKey
                    ) {
                        addLog('info', '새 무기를 주손에 장착하고 기존 무기를 보조손으로 이동했습니다.');
                    } else if (getEquipmentIdentity(nextEquip.weapon) === inventoryItemKey) {
                        addLog('info', '주손 무기를 교체했습니다.');
                    }
                } else if (inventoryItem.type === 'shield' && currentEquip.offhand) {
                    addLog('info', '보조 손 장비를 교체했습니다.');
                }

                dispatch({ type: 'SET_PLAYER', payload: { ...player, inv: newInv, equip: nextEquip } });
                addLog('success', `${inventoryItem.name} 장착.`);
                return;
            }

            if (inventoryItem.type === 'hp') {
                const stats = getFullStats();
                dispatch({
                    type: 'SET_PLAYER',
                    payload: {
                        ...player,
                        hp: Math.min(stats.maxHp, player.hp + (inventoryItem.val || 0)),
                        inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용.`);
                return;
            }

            if (inventoryItem.type === 'mp') {
                const stats = getFullStats();
                dispatch({
                    type: 'SET_PLAYER',
                    payload: {
                        ...player,
                        mp: Math.min(stats.maxMp, player.mp + (inventoryItem.val || 0)),
                        inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용.`);
                return;
            }

            if (inventoryItem.type === 'cure') {
                dispatch({
                    type: 'SET_PLAYER',
                    payload: {
                        ...player,
                        status: toArray(player.status).filter((status) => status !== inventoryItem.effect),
                        inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용: 상태이상 해제`);
                return;
            }

            if (inventoryItem.type === 'buff') {
                dispatch({
                    type: 'SET_PLAYER',
                    payload: {
                        ...player,
                        tempBuff: {
                            atk: inventoryItem.effect === 'atk_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                            def: inventoryItem.effect === 'def_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                            turn: inventoryItem.turn || 3,
                            name: inventoryItem.name
                        },
                        inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용: 버프 활성화`);
            }
        },

        market: (type, item) => {
            if (gameState !== 'shop') return;
            if (type === 'buy') {
                if (player.gold < item.price) return addLog('error', '골드가 부족합니다.');
                if ((player.inv?.length || 0) >= BALANCE.INV_MAX_SIZE) return addLog('error', '인벤토리가 가득 찼습니다.');
                if (
                    ['weapon', 'armor', 'shield'].includes(item.type)
                    && Array.isArray(item.jobs)
                    && !item.jobs.includes(player.job)
                ) {
                    return addLog('error', `${player.job}은(는) ${item.name}을(를) 장착할 수 없습니다.`);
                }

                const updatedPlayer = { ...player, gold: player.gold - item.price, inv: [...player.inv, makeItem(item)] };
                dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
                dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: item.price } });
                emitDailyProtocolLogs('goldSpend', item.price);
                addLog('success', `${item.name} 구매 완료.`);
            } else if (type === 'sell') {
                const sellPrice = Math.floor(item.price * 0.5);
                const idx = player.inv.findIndex((entry) => entry.id === item.id);
                if (idx > -1) {
                    const newInv = [...player.inv];
                    newInv.splice(idx, 1);
                    const updatedPlayer = { ...grantGold(player, sellPrice), inv: newInv };
                    dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
                    emitUnlockedTitles(updatedPlayer);
                    addLog('success', `${item.name} 판매 완료 (+${sellPrice}G)`);
                }
            }
        },

        craft: (recipeId) => {
            const recipe = DB.ITEMS.recipes?.find((entry) => entry.id === recipeId);
            if (!recipe) return;
            if (player.gold < recipe.gold) return addLog('error', '골드가 부족합니다.');

            for (const input of recipe.inputs) {
                const count = player.inv.filter((entry) => entry.name === input.name).length;
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

            const updatedPlayer = {
                ...player,
                gold: player.gold - recipe.gold,
                inv: [...newInv, craftedItem],
                stats: {
                    ...(player.stats || {}),
                    crafts: (player.stats?.crafts || 0) + 1,
                }
            };
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: recipe.gold } });
            emitDailyProtocolLogs('goldSpend', recipe.gold);
            emitUnlockedTitles(updatedPlayer);
            addLog('success', `${recipe.name} 제작 완료`);
        },

        completeQuest: (qId) => {
            const pQuest = player.quests.find((quest) => quest.id === qId);
            if (!pQuest) return;

            const qData = pQuest.isBounty ? pQuest : DB.QUESTS.find((quest) => quest.id === qId);
            if (!qData) return;
            if (pQuest.progress < qData.goal) return addLog('error', '아직 완료 조건을 만족하지 못했습니다.');

            let updatedPlayer = {
                ...player,
                quests: player.quests.filter((quest) => quest.id !== qId)
            };

            if (qData.reward?.gold) updatedPlayer = grantGold(updatedPlayer, qData.reward.gold);
            if (qData.reward?.exp) {
                const expResult = CombatEngine.applyExpGain(updatedPlayer, qData.reward.exp);
                updatedPlayer = expResult.updatedPlayer;
                expResult.logs.forEach((log) => addLog(log.type, log.text));
                if (expResult.visualEffect) dispatch({ type: 'SET_VISUAL_EFFECT', payload: expResult.visualEffect });
            }

            if (pQuest.isBounty) {
                updatedPlayer = {
                    ...updatedPlayer,
                    stats: {
                        ...(updatedPlayer.stats || {}),
                        bountiesCompleted: (updatedPlayer.stats?.bountiesCompleted || 0) + 1
                    }
                };
            }

            if (qData.reward?.item) {
                const itemData = findItemByName(qData.reward.item);
                if (itemData) {
                    updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, makeItem(itemData)] };
                    addLog('success', `보상 아이템: ${itemData.name}`);
                }
            }

            updatedPlayer = syncLevelQuests(updatedPlayer);
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', `퀘스트 완료: ${qData.title}`);
        },

        claimAchievement: (achId) => {
            const achData = DB.ACHIEVEMENTS.find((achievement) => achievement.id === achId);
            if (!achData) return;
            if (!isAchievementUnlocked(achData, player)) return addLog('error', '아직 달성하지 못한 업적입니다.');

            const claimed = player.stats?.claimedAchievements || [];
            if (claimed.includes(achId)) return addLog('info', '이미 수령한 업적입니다.');

            let updatedPlayer = {
                ...player,
                stats: {
                    ...player.stats,
                    claimedAchievements: [...claimed, achId]
                }
            };

            if (achData.reward.gold) updatedPlayer = grantGold(updatedPlayer, achData.reward.gold);
            if (achData.reward.item) {
                const itemData = findItemByName(achData.reward.item);
                if (itemData) {
                    updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, makeItem(itemData)] };
                    addLog('success', `업적 보상 아이템: ${itemData.name}`);
                }
            }

            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', `업적 달성: ${achData.title}`);
        },

        // 시나리오 2: 저가 재료 일괄 판매 (#autoSell)
        // 단가 30G 이하 재료(mat) 타입 아이템을 모두 50% 가격에 일괄 판매
        autoSell: () => {
            const SELL_PRICE_THRESHOLD = 30;
            const sellTargets = player.inv.filter(
                (item) => item.type === 'mat' && (item.price || 0) <= SELL_PRICE_THRESHOLD
            );
            if (sellTargets.length === 0) {
                addLog('info', '판매할 저가 재료가 없습니다.');
                return;
            }
            const sellIds = new Set(sellTargets.map((item) => item.id));
            const totalGold = sellTargets.reduce((acc, item) => acc + Math.floor((item.price || 0) * 0.5), 0);
            const newInv = player.inv.filter((item) => !sellIds.has(item.id));
            const updatedPlayer = grantGold({ ...player, inv: newInv }, totalGold);
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', `재료 ${sellTargets.length}개 일괄 판매 (+${totalGold}G)`);
        },
    });
};
