import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { toArray, makeItem, findItemByName, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, isAchievementUnlocked, registerCodex, registerLootToCodex, makeEmitTitles } from '../utils/gameUtils';
import { addItemByName } from '../utils/inventoryUtils';
import { incrementStat } from '../utils/playerStateUtils';
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
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);

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
            if (!inventoryItem) return addLog('error', MSG.INV_ITEM_NOT_FOUND);

            if (['weapon', 'armor', 'shield'].includes(inventoryItem.type)) {
                const reqLevel = inventoryItem.reqLevel ?? (BALANCE.TIER_REQ_LEVEL?.[inventoryItem.tier] ?? 1);
                if ((player.level || 1) < reqLevel) {
                    return addLog('error', MSG.EQUIP_LEVEL_REQUIRED(inventoryItem.name, reqLevel));
                }
                if (Array.isArray(inventoryItem.jobs) && !inventoryItem.jobs.includes(player.job)) {
                    return addLog('error', MSG.EQUIP_JOB_RESTRICT(player.job, inventoryItem.name));
                }

                const filteredInv = player.inv.filter((entry) => entry.id !== inventoryItem.id);
                const currentEquip = { ...player.equip };
                const inventoryItemKey = getEquipmentIdentity(inventoryItem);

                if (inventoryItem.type === 'shield' && isTwoHandWeapon(currentEquip.weapon)) {
                    addLog('error', MSG.EQUIP_TWO_HAND_SHIELD_BLOCK);
                    return;
                }

                const nextEquip = getNextEquipmentState(currentEquip, inventoryItem);
                const preservedKeys = new Set(
                    [nextEquip.weapon, nextEquip.offhand, nextEquip.armor]
                        .filter(Boolean)
                        .map((equippedItem) => getEquipmentIdentity(equippedItem))
                );

                const itemsToReturn = [currentEquip.weapon, currentEquip.offhand, currentEquip.armor]
                    .filter((equippedItem) => {
                        if (!equippedItem) return false;
                        const equippedKey = getEquipmentIdentity(equippedItem);
                        if (equippedKey === inventoryItemKey) return false;
                        if (preservedKeys.has(equippedKey)) return false;
                        if (equippedItem.id && equippedItem.id === inventoryItem.id) return false;
                        if (equippedItem.name === '맨손' || equippedItem.name === '천옷') return false;
                        return true;
                    })
                    .map((equippedItem) => equippedItem.id ? equippedItem : makeItem(equippedItem));

                const newInv = [...filteredInv, ...itemsToReturn];

                if (inventoryItem.type === 'weapon') {
                    if (isTwoHandWeapon(inventoryItem) && currentEquip.offhand) {
                        addLog('info', MSG.EQUIP_TWO_HAND_OFFHAND_RELEASE);
                    } else if (!isTwoHandWeapon(inventoryItem) && isTwoHandWeapon(currentEquip.weapon)) {
                        addLog('info', MSG.EQUIP_TWO_HAND_TO_ONE_HAND);
                    } else if (getEquipmentIdentity(nextEquip.offhand) === inventoryItemKey) {
                        addLog('info', MSG.EQUIP_OFFHAND_SET);
                    } else if (
                        getEquipmentIdentity(nextEquip.weapon) === inventoryItemKey &&
                        getEquipmentIdentity(nextEquip.offhand) === getEquipmentIdentity(currentEquip.weapon) &&
                        getEquipmentIdentity(currentEquip.weapon) !== inventoryItemKey
                    ) {
                        addLog('info', MSG.EQUIP_MAIN_SHIFT);
                    } else if (getEquipmentIdentity(nextEquip.weapon) === inventoryItemKey) {
                        addLog('info', MSG.EQUIP_MAIN_REPLACE);
                    }
                } else if (inventoryItem.type === 'shield' && currentEquip.offhand) {
                    addLog('info', MSG.EQUIP_OFFHAND_REPLACE);
                }

                dispatch({ type: 'SET_PLAYER', payload: { ...player, inv: newInv, equip: nextEquip } });
                addLog('success', MSG.EQUIP_DONE(inventoryItem.name));
                return;
            }

            if (player.challengeModifiers?.includes('noPotion') && ['hp', 'mp', 'cure'].includes(inventoryItem.type)) {
                return addLog('warn', MSG.CHALLENGE_NO_CONSUMABLE);
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
                addLog('success', MSG.ITEM_USE_BUFF(inventoryItem.name));
            }
        },

        market: (type, item) => {
            if (gameState !== 'shop') return;
            if (type === 'buy') {
                if (player.gold < item.price) return addLog('error', MSG.GOLD_INSUFFICIENT);
                if ((player.inv?.length || 0) >= (player.maxInv || BALANCE.INV_MAX_SIZE)) return addLog('error', MSG.INV_FULL);
                if (
                    ['weapon', 'armor', 'shield'].includes(item.type)
                    && Array.isArray(item.jobs)
                    && !item.jobs.includes(player.job)
                ) {
                    return addLog('error', MSG.EQUIP_JOB_RESTRICT(player.job, item.name));
                }

                let updatedPlayer = { ...player, gold: player.gold - item.price, inv: [...player.inv, makeItem(item)] };
                updatedPlayer = registerLootToCodex(updatedPlayer, [item]);
                dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
                dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: item.price } });
                emitDailyProtocolLogs('goldSpend', item.price);
                addLog('success', MSG.SHOP_BUY_DONE(item.name));
            } else if (type === 'sell') {
                const sellPrice = Math.floor(item.price * 0.5);
                const newInv = player.inv.filter((entry) => entry.id !== item.id);
                if (newInv.length < player.inv.length) {
                    const updatedPlayer = { ...grantGold(player, sellPrice), inv: newInv };
                    dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
                    emitUnlockedTitles(updatedPlayer);
                    addLog('success', MSG.SHOP_SELL_DONE(item.name, sellPrice));
                }
            }
        },

        craft: (recipeId) => {
            const recipe = DB.ITEMS.recipes?.find((entry) => entry.id === recipeId);
            if (!recipe) return;
            if (player.gold < recipe.gold) return addLog('error', MSG.GOLD_INSUFFICIENT);

            for (const input of recipe.inputs) {
                const count = player.inv.filter((entry) => entry.name === input.name).length;
                if (count < input.qty) return addLog('error', MSG.CRAFT_MAT_INSUFFICIENT(input.name));
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

            let updatedPlayer = incrementStat({
                ...player,
                gold: player.gold - recipe.gold,
                inv: [...newInv, craftedItem],
            }, 'crafts');
            // 도감 등록: 레시피 + 결과 아이템
            updatedPlayer = registerCodex(updatedPlayer, 'recipes', recipe.id);
            updatedPlayer = registerLootToCodex(updatedPlayer, [craftedItem]);
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: recipe.gold } });
            dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.craft });
            emitDailyProtocolLogs('goldSpend', recipe.gold);
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.CRAFT_DONE(recipe.name));
        },

        completeQuest: (qId) => {
            const pQuest = player.quests.find((quest) => quest.id === qId);
            if (!pQuest) return;

            const qData = pQuest.isBounty ? pQuest : DB.QUESTS.find((quest) => quest.id === qId);
            if (!qData) return;
            if (pQuest.progress < qData.goal) return addLog('error', MSG.QUEST_NOT_COMPLETE);

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
                updatedPlayer = incrementStat(updatedPlayer, 'bountiesCompleted');
            }

            if (qData.reward?.item) {
                const prevInvLen = updatedPlayer.inv.length;
                updatedPlayer = addItemByName(updatedPlayer, qData.reward.item);
                if (updatedPlayer.inv.length > prevInvLen) {
                    addLog('success', MSG.QUEST_REWARD_ITEM(qData.reward.item));
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
                    addLog('event', MSG.QUEST_TRAIT_BONUS(traitProfile.title, bonusGold));
                }
            }

            updatedPlayer = syncLevelQuests(updatedPlayer);
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.questComplete });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.QUEST_DONE(qData.title));
        },

        claimAchievement: (achId) => {
            const achData = DB.ACHIEVEMENTS.find((achievement) => achievement.id === achId);
            if (!achData) return;
            if (!isAchievementUnlocked(achData, player)) return addLog('error', MSG.ACH_NOT_UNLOCKED);

            const claimed = player.stats?.claimedAchievements || [];
            if (claimed.includes(achId)) return addLog('info', MSG.ACH_ALREADY_CLAIMED);

            let updatedPlayer = {
                ...player,
                stats: {
                    ...player.stats,
                    claimedAchievements: [...claimed, achId]
                }
            };

            if (achData.reward.gold) updatedPlayer = grantGold(updatedPlayer, achData.reward.gold);
            if (achData.reward.item) {
                const prevInvLen = updatedPlayer.inv.length;
                updatedPlayer = addItemByName(updatedPlayer, achData.reward.item);
                if (updatedPlayer.inv.length > prevInvLen) {
                    addLog('success', MSG.ACH_REWARD_ITEM(achData.reward.item));
                }
            }

            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.ACH_DONE(achData.title));
        },

        synthesize: (itemIds, useProtect = false) => {
            const items = itemIds.map((id) => player.inv.find((entry) => entry.id === id)).filter(Boolean);
            const validation = validateSynthesis(items, player.gold);
            if (!validation.valid) {
                if (validation.reason === 'NO_GOLD') return addLog('error', MSG.SYNTHESIS_NOT_ENOUGH_GOLD);
                return addLog('error', MSG.SYNTHESIS_NOT_ENOUGH);
            }
            if (useProtect && player.premiumCurrency < BALANCE.SYNTHESIS_PROTECT_COST) {
                return addLog('error', MSG.PREMIUM_INSUFFICIENT(BALANCE.PREMIUM_CURRENCY_NAME));
            }

            const result = performSynthesis(items, null, useProtect);
            const usedIds = new Set(itemIds);
            const newInv = [
                ...player.inv.filter((entry) => !usedIds.has(entry.id)),
                ...result.returnedItems,
            ];

            let updatedPlayer = incrementStat({
                ...player,
                gold: player.gold - result.goldSpent,
                premiumCurrency: player.premiumCurrency - result.premiumSpent,
                inv: newInv,
            }, 'syntheses');

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
            if (owned.includes(titleId)) return addLog('info', MSG.TITLE_ALREADY_OWNED);
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
            if (!item) return addLog('error', MSG.ITEM_NOT_FOUND);
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
            addLog('system', MSG.SKILL_BRANCH_CHOSEN(skillName, choice));
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
                addLog('info', MSG.BULK_SELL_EMPTY);
                return;
            }
            const sellIds = new Set(sellTargets.map((item) => item.id));
            const totalGold = sellTargets.reduce((acc, item) => acc + Math.floor((item.price || 0) * 0.5), 0);
            const newInv = player.inv.filter((item) => !sellIds.has(item.id));
            const updatedPlayer = grantGold({ ...player, inv: newInv }, totalGold);
            dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.BULK_SELL_DONE(sellTargets.length, totalGold));
        },
    });
};
