import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { toArray, makeItem, findItemByName, checkTitles, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, getTitleLabel, isAchievementUnlocked, registerCodex, registerLootToCodex } from '../utils/gameUtils';
import { getEquipmentIdentity, getNextEquipmentState, isTwoHandWeapon } from '../utils/equipmentUtils';
import { validateSynthesis, performSynthesis } from '../utils/synthesisUtils';
import { SEASON_XP } from '../data/seasonPass';
import { getTraitProfile, getTraitQuestResonance } from '../utils/runProfileUtils';
import { AT } from '../reducers/actionTypes';
import { CombatEngine } from '../systems/CombatEngine';
import { MSG } from '../data/messages';
import { resolveInvasion } from '../utils/graveUtils';

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

            if (player.challengeModifiers?.includes('noPotion') && ['hp', 'mp', 'cure'].includes(inventoryItem.type)) {
                return addLog('warn', '금욕 챌린지: 소모 아이템을 사용할 수 없습니다.');
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
                if ((player.inv?.length || 0) >= (player.maxInv || BALANCE.INV_MAX_SIZE)) return addLog('error', '인벤토리가 가득 찼습니다.');
                if (
                    ['weapon', 'armor', 'shield'].includes(item.type)
                    && Array.isArray(item.jobs)
                    && !item.jobs.includes(player.job)
                ) {
                    return addLog('error', `${player.job}은(는) ${item.name}을(를) 장착할 수 없습니다.`);
                }

                let updatedPlayer = { ...player, gold: player.gold - item.price, inv: [...player.inv, makeItem(item)] };
                updatedPlayer = registerLootToCodex(updatedPlayer, [item]);
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

            let updatedPlayer = {
                ...player,
                gold: player.gold - recipe.gold,
                inv: [...newInv, craftedItem],
                stats: {
                    ...(player.stats || {}),
                    crafts: (player.stats?.crafts || 0) + 1,
                }
            };
            // 도감 등록: 레시피 + 결과 아이템
            updatedPlayer = registerCodex(updatedPlayer, 'recipes', recipe.id);
            updatedPlayer = registerLootToCodex(updatedPlayer, [craftedItem]);
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: recipe.gold } });
            dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.craft });
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

            if (qData.buildTag) {
                const currentStats = getFullStats();
                const traitProfile = getTraitProfile(updatedPlayer, {
                    ...currentStats,
                    maxHp: updatedPlayer.maxHp,
                    maxMp: updatedPlayer.maxMp,
                });
                const resonance = getTraitQuestResonance(qData, traitProfile);
                if (resonance.score >= 6 && qData.reward?.gold) {
                    const bonusGold = Math.max(100, Math.floor(qData.reward.gold * 0.15));
                    updatedPlayer = grantGold(updatedPlayer, bonusGold);
                    addLog('event', `[${traitProfile.title}] 공명 보상 +${bonusGold}G`);
                }
            }

            updatedPlayer = syncLevelQuests(updatedPlayer);
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.questComplete });
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

        synthesize: (itemIds, useProtect = false) => {
            const items = itemIds.map((id) => player.inv.find((entry) => entry.id === id)).filter(Boolean);
            const validation = validateSynthesis(items, player.gold);
            if (!validation.valid) {
                if (validation.reason === 'NO_GOLD') return addLog('error', MSG.SYNTHESIS_NOT_ENOUGH_GOLD);
                return addLog('error', MSG.SYNTHESIS_NOT_ENOUGH);
            }
            if (useProtect && player.premiumCurrency < BALANCE.SYNTHESIS_PROTECT_COST) {
                return addLog('error', `${BALANCE.PREMIUM_CURRENCY_NAME}이(가) 부족합니다.`);
            }

            const result = performSynthesis(items, null, useProtect);
            const usedIds = new Set(itemIds);
            let newInv = player.inv.filter((entry) => !usedIds.has(entry.id));

            // 실패 시 반환 아이템 복원
            for (const returned of result.returnedItems) {
                newInv.push(returned);
            }

            let updatedPlayer = {
                ...player,
                gold: player.gold - result.goldSpent,
                premiumCurrency: player.premiumCurrency - result.premiumSpent,
                inv: newInv,
                stats: {
                    ...(player.stats || {}),
                    syntheses: (player.stats?.syntheses || 0) + 1,
                },
            };

            if (result.success && result.outputItem) {
                const crafted = makeItem(result.outputItem);
                updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, crafted] };
                updatedPlayer = registerLootToCodex(updatedPlayer, [crafted]);
                addLog('success', MSG.SYNTHESIS_SUCCESS(result.outputItem.name));
            } else {
                if (useProtect) {
                    addLog('info', MSG.SYNTHESIS_PROTECTED);
                } else {
                    addLog('error', MSG.SYNTHESIS_FAIL);
                }
            }

            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            if (result.success) dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.synthesize });
            emitUnlockedTitles(updatedPlayer);
        },

        // 시나리오 2: 저가 재료 일괄 판매 (#autoSell)
        // ── 프리미엄 상점 구매 액션 ──────────────────────────────────────
        expandInventory: () => {
            const cost = BALANCE.INV_EXPAND_COST;
            if ((player.premiumCurrency || 0) < cost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            const newMax = (player.maxInv || 20) + BALANCE.INV_EXPAND_AMOUNT;
            dispatch({ type: AT.SET_PLAYER, payload: p => ({ ...p, premiumCurrency: p.premiumCurrency - cost, maxInv: newMax }) });
            addLog('system', MSG.PREMIUM_INV_EXPAND(newMax));
        },

        purchaseSynthProtect: () => {
            const cost = BALANCE.SYNTHESIS_PROTECT_COST;
            if ((player.premiumCurrency || 0) < cost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            dispatch({ type: AT.SET_PLAYER, payload: p => ({
                ...p,
                premiumCurrency: p.premiumCurrency - cost,
                stats: { ...(p.stats || {}), synthProtects: (p.stats?.synthProtects || 0) + 1 },
            }) });
            addLog('system', MSG.PREMIUM_PURCHASE('합성 보호권', cost));
        },

        purchaseRevive: () => {
            const cost = BALANCE.REVIVE_COST;
            if ((player.premiumCurrency || 0) < cost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            dispatch({ type: AT.SET_PLAYER, payload: p => ({ ...p, premiumCurrency: p.premiumCurrency - cost, reviveTokens: (p.reviveTokens || 0) + 1 }) });
            addLog('system', MSG.PREMIUM_PURCHASE('즉시 부활권', cost));
        },

        purchaseCosmeticTitle: (titleId, titleName, titleCost) => {
            if ((player.premiumCurrency || 0) < titleCost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            const owned = player.stats?.cosmeticTitles || [];
            if (owned.includes(titleId)) return addLog('info', '이미 보유 중인 칭호입니다.');
            dispatch({ type: AT.SET_PLAYER, payload: p => ({
                ...p,
                premiumCurrency: p.premiumCurrency - titleCost,
                stats: { ...(p.stats || {}), cosmeticTitles: [...owned, titleId] },
            }) });
            addLog('system', MSG.PREMIUM_PURCHASE(`칭호 [${titleName}]`, titleCost));
        },

        // ── 주간 미션 수령 ────────────────────────────────────────────────
        claimWeeklyMission: (missionId, reward) => {
            dispatch({ type: AT.CLAIM_WEEKLY_MISSION, payload: { missionId, reward } });
            addLog('success', MSG.WEEKLY_MISSION_CLAIM(reward.gold || 0, reward.premiumCurrency));
        },

        // ── 아이템 강화 ──────────────────────────────────────────────────
        enhanceItem: (itemId) => {
            const item = player.inv.find(i => i.id === itemId)
                || player.equip.weapon?.id === itemId && player.equip.weapon
                || player.equip.armor?.id === itemId && player.equip.armor
                || player.equip.offhand?.id === itemId && player.equip.offhand;
            if (!item) return addLog('error', '아이템을 찾을 수 없습니다.');
            if (!['weapon', 'armor', 'shield'].includes(item.type)) return addLog('warn', MSG.ENHANCE_NOT_EQUIP);
            const currentLevel = item.enhance || 0;
            if (currentLevel >= BALANCE.ENHANCE_MAX) return addLog('warn', MSG.ENHANCE_MAX_LEVEL);
            const cost = BALANCE.ENHANCE_COSTS[currentLevel];
            if (player.gold < cost) return addLog('warn', MSG.ENHANCE_NO_GOLD(cost));
            const rate = BALANCE.ENHANCE_RATES[currentLevel];
            const success = Math.random() < rate;
            const newGold = player.gold - cost;
            dispatch({ type: AT.SET_PLAYER, payload: p => ({ ...p, gold: newGold }) });
            dispatch({ type: AT.ENHANCE_ITEM, payload: { itemId, success } });
            if (success) {
                addLog('success', MSG.ENHANCE_SUCCESS(item.name, currentLevel + 1));
            } else {
                addLog('warn', MSG.ENHANCE_FAIL(item.name, currentLevel + 1));
            }
        },

        chooseSkillBranch: (skillName, choice) => {
            dispatch({ type: AT.CHOOSE_SKILL_BRANCH, payload: { skillName, choice } });
            addLog('system', `[${skillName}] 분기 ${choice} 선택 완료.`);
        },

        invadeGrave: (targetGrave) => {
            const today = new Date().toDateString();
            const lastDate = player.stats?.lastInvadeDate;
            const count = lastDate === today ? (player.stats?.dailyInvadeCount || 0) : 0;
            if (count >= CONSTANTS.DAILY_INVADE_LIMIT) {
                return addLog('warn', MSG.INVADE_LIMIT);
            }
            if (!targetGrave.items || targetGrave.items.length === 0) {
                return addLog('warn', MSG.INVADE_NO_ITEMS);
            }
            const playerAtk = getFullStats?.()?.atk || player.atk || 10;
            const { success, reward } = resolveInvasion(targetGrave, playerAtk);
            dispatch({ type: AT.INVADE_GRAVE, payload: { reward: reward || null, uid: targetGrave.uid } });
            if (success && reward) {
                addLog('success', MSG.INVADE_SUCCESS(targetGrave.playerName || '무명 용사', reward.name));
            } else {
                addLog('warn', MSG.INVADE_FAIL(targetGrave.playerName || '무명 용사'));
            }
        },

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
