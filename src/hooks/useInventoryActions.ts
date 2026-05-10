import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { toArray, makeItem, findItemByName, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, isAchievementUnlocked, registerCodex, registerLootToCodex, countNewCodexEntries, makeEmitTitles } from '../utils/gameUtils';
import { addItemByName } from '../utils/inventoryUtils';
import { incrementStat } from '../utils/playerStateUtils';
import { getEquipmentIdentity, getNextEquipmentState, isTwoHandWeapon } from '../utils/equipmentUtils';
import { consumeInventoryItemByName, getEnhanceAvailability } from '../utils/enhancementUtils';
import { validateSynthesis, performSynthesis } from '../utils/synthesisUtils';
import { SEASON_XP } from '../data/seasonPass';
import { getTraitProfile, getTraitQuestResonance } from '../utils/runProfileUtils';
import { AT } from '../reducers/actionTypes';
import { CombatEngine } from '../systems/CombatEngine';
import { MSG } from '../data/messages';
import { soundManager } from '../systems/SoundManager';
import { isSignatureItem } from '../data/signatureItems.js';
import { resolveInvasion } from '../utils/graveUtils';
import type { Item } from '../types/index.js';

/**
 * createInventoryActions — 아이템 사용, 장비, 마켓, 제작, 퀘스트 완료
 */
export const createInventoryActions = ({ player, gameState, dispatch, addLog, addStoryLog, getFullStats }: any) => {
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);

    // cycle 504: amount default 1 제거 — 호출자 5건 모두 amount 명시 전달.
    const emitDailyProtocolLogs = (type: any, amount: any) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission: any) => {
            addLog('system', `📋 일일 프로토콜 완료: ${formatDailyProtocolReward(mission.reward)}`);
        });
    };

    const syncLevelQuests = (updatedPlayer: any) => {
        const questResult = CombatEngine.updateQuestProgress(updatedPlayer, '');
        return { ...updatedPlayer, quests: questResult.updatedQuests };
    };

    return ({

        useItem: (item: Item) => {
            const inventoryItem = player.inv.find((entry: any) => entry.id === item.id);
            if (!inventoryItem) return addLog('error', MSG.INV_ITEM_NOT_FOUND);

            if (['weapon', 'armor', 'shield'].includes(inventoryItem.type)) {
                const reqLevel = inventoryItem.reqLevel ?? (BALANCE.TIER_REQ_LEVEL?.[inventoryItem.tier] ?? 1);
                if ((player.level || 1) < reqLevel) {
                    return addLog('error', MSG.EQUIP_LEVEL_REQUIRED(inventoryItem.name, reqLevel));
                }
                if (Array.isArray(inventoryItem.jobs) && !inventoryItem.jobs.includes(player.job)) {
                    return addLog('error', MSG.EQUIP_JOB_RESTRICT(player.job, inventoryItem.name));
                }

                const filteredInv = player.inv.filter((entry: any) => entry.id !== inventoryItem.id);
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
                        .map((equippedItem: any) => getEquipmentIdentity(equippedItem))
                );

                const itemsToReturn = [currentEquip.weapon, currentEquip.offhand, currentEquip.armor]
                    .filter((equippedItem: any) => {
                        if (!equippedItem) return false;
                        const equippedKey = getEquipmentIdentity(equippedItem);
                        if (equippedKey === inventoryItemKey) return false;
                        if (preservedKeys.has(equippedKey)) return false;
                        if (equippedItem.id && equippedItem.id === inventoryItem.id) return false;
                        if (equippedItem.name === '맨손' || equippedItem.name === '천옷') return false;
                        return true;
                    })
                    .map((equippedItem: any) => equippedItem.id ? equippedItem : makeItem(equippedItem));

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

                dispatch({ type: AT.SET_PLAYER, payload: { ...player, inv: newInv, equip: nextEquip } });
                addLog('success', MSG.EQUIP_DONE(inventoryItem.name));
                return;
            }

            if (player.challengeModifiers?.includes('noPotion') && ['hp', 'mp', 'cure'].includes(inventoryItem.type)) {
                return addLog('warn', MSG.CHALLENGE_NO_CONSUMABLE);
            }

            if (inventoryItem.type === 'hp') {
                const stats = getFullStats();
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        hp: Math.min(stats.maxHp, player.hp + (inventoryItem.val || 0)),
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용.`);
                return;
            }

            if (inventoryItem.type === 'mp') {
                const stats = getFullStats();
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        mp: Math.min(stats.maxMp, player.mp + (inventoryItem.val || 0)),
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용.`);
                return;
            }

            if (inventoryItem.type === 'cure') {
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        status: toArray(player.status).filter((status: any) => status !== inventoryItem.effect),
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', `${inventoryItem.name} 사용: 상태이상 해제`);
                return;
            }

            if (inventoryItem.type === 'buff') {
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        ...player,
                        tempBuff: {
                            atk: inventoryItem.effect === 'atk_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                            def: inventoryItem.effect === 'def_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                            turn: inventoryItem.turn || 3,
                            name: inventoryItem.name
                        },
                        inv: player.inv.filter((entry: any) => entry.id !== inventoryItem.id)
                    }
                });
                addLog('success', MSG.ITEM_USE_BUFF(inventoryItem.name));
            }
        },

        market: (type: any, item: Item) => {
            if (gameState !== 'shop') return;
            if (type === 'buy') {
                const itemPrice = item.price ?? 0;
                if (player.gold < itemPrice) return addLog('error', MSG.GOLD_INSUFFICIENT);
                if ((player.inv?.length || 0) >= (player.maxInv || BALANCE.INV_MAX_SIZE)) return addLog('error', MSG.INV_FULL);
                if (
                    ['weapon', 'armor', 'shield'].includes(item.type as string)
                    && Array.isArray(item.jobs)
                    && !item.jobs.includes(player.job)
                ) {
                    return addLog('error', MSG.EQUIP_JOB_RESTRICT(player.job, item.name));
                }

                // cycle 196: codex 등록 전후 비교로 신규 발견 수 → SEASON_XP.codexDiscover (cycle 193 패턴 확장).
                const codexBefore = countNewCodexEntries(player);
                let updatedPlayer = { ...player, gold: player.gold - itemPrice, inv: [...player.inv, makeItem(item)] };
                updatedPlayer = registerLootToCodex(updatedPlayer, [item]);
                const newCodexCount = countNewCodexEntries(updatedPlayer) - codexBefore;
                dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
                if (newCodexCount > 0) {
                    dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.codexDiscover * newCodexCount });
                }
                dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: itemPrice } });
                emitDailyProtocolLogs('goldSpend', itemPrice);
                addLog('success', MSG.SHOP_BUY_DONE(item.name));
            } else if (type === 'sell') {
                // 전설 각인 아이템은 우발적 판매 방지 — 드롭률이 낮고 세트 효과 기반이라
                // 잘못 판매하면 복구가 어려워 유저 경험에 큰 피해.
                if (isSignatureItem(item)) {
                    return addLog('warning', MSG.SIGNATURE_SELL_BLOCKED(item.name));
                }
                const sellPrice = Math.floor((item.price ?? 0) * 0.5);
                const newInv = player.inv.filter((entry: any) => entry.id !== item.id);
                if (newInv.length < player.inv.length) {
                    const updatedPlayer = { ...grantGold(player, sellPrice), inv: newInv };
                    dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
                    emitUnlockedTitles(updatedPlayer);
                    addLog('success', MSG.SHOP_SELL_DONE(item.name, sellPrice));
                }
            }
        },

        craft: (recipeId: any) => {
            const recipe = DB.ITEMS.recipes?.find((entry: any) => entry.id === recipeId);
            if (!recipe) return;
            if (player.gold < recipe.gold) return addLog('error', MSG.GOLD_INSUFFICIENT);

            for (const input of recipe.inputs) {
                const count = player.inv.filter((entry: any) => entry.name === input.name).length;
                if (count < input.qty) return addLog('error', MSG.CRAFT_MAT_INSUFFICIENT(input.name));
            }

            let newInv = [...player.inv];
            for (const input of recipe.inputs) {
                let removed = 0;
                newInv = newInv.filter((invItem: any) => {
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

            // cycle 196: codex 신규 등록 수 추적 — SEASON_XP.codexDiscover dispatch (cycle 193 패턴).
            const codexBefore = countNewCodexEntries(player);
            let updatedPlayer = incrementStat({
                ...player,
                gold: player.gold - recipe.gold,
                inv: [...newInv, craftedItem],
            }, 'crafts');
            // 도감 등록: 레시피 + 결과 아이템
            updatedPlayer = registerCodex(updatedPlayer, 'recipes', recipe.id);
            updatedPlayer = registerLootToCodex(updatedPlayer, [craftedItem]);
            const newCodexCount = countNewCodexEntries(updatedPlayer) - codexBefore;
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            if (newCodexCount > 0) {
                dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.codexDiscover * newCodexCount });
            }
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: recipe.gold } });
            dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.craft });
            emitDailyProtocolLogs('goldSpend', recipe.gold);
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.CRAFT_DONE(recipe.name));
        },

        completeQuest: (qId: any) => {
            const pQuest = player.quests.find((quest: any) => quest.id === qId);
            if (!pQuest) return;

            const qData = pQuest.isBounty ? pQuest : DB.QUESTS.find((quest: any) => quest.id === qId);
            if (!qData) return;
            if (pQuest.progress < qData.goal) return addLog('error', MSG.QUEST_NOT_COMPLETE);

            let updatedPlayer = {
                ...player,
                quests: player.quests.filter((quest: any) => quest.id !== qId)
            };

            // cycle 260: stats.claimedQuestIds 영구 ledger 추적 — checkTitles questReward
            //   fallback이 저장 손실 / 마이그레이션 등 복구 케이스에서 칭호 복원 가능. cycle
            //   199 prestigeRank / cycle 201 seasonTier paired pattern. bounty는 별도 카운터(
            //   bountiesCompleted)로 추적되므로 일반 quest만 push.
            if (!pQuest.isBounty) {
                const prevClaimedQuestIds = (updatedPlayer.stats as any)?.claimedQuestIds;
                const nextClaimedQuestIds = Array.isArray(prevClaimedQuestIds) ? prevClaimedQuestIds : [];
                if (!nextClaimedQuestIds.includes(qId)) {
                    updatedPlayer = {
                        ...updatedPlayer,
                        stats: {
                            ...updatedPlayer.stats,
                            claimedQuestIds: [...nextClaimedQuestIds, qId],
                        } as any,
                    };
                }
            }

            if (qData.reward?.gold) updatedPlayer = grantGold(updatedPlayer, qData.reward.gold);
            if (qData.reward?.exp) {
                const expResult = CombatEngine.applyExpGain(updatedPlayer, qData.reward.exp);
                updatedPlayer = expResult.updatedPlayer;
                expResult.logs.forEach((log: any) => addLog(log.type, log.text));
                if (expResult.visualEffect) dispatch({ type: AT.SET_VISUAL_EFFECT, payload: expResult.visualEffect });
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

            // cycle 209: quest reward.title이 dead grant이던 회귀 fix — cycle 192가 TITLES 등록만
            //   하고 grant 경로는 미수리. claimQuestReward에서 reward.title이 있으면 player.titles에
            //   push하고 emitUnlockedTitles로 visual lookup 통합. Set으로 dedup (이미 보유 시 skip).
            //   영향 quest: 152(에테르 탐험가) / 153(공허의 방랑자) / 154(종말의 정복자) /
            //   201(지도 제작자) / 202(전설의 기록자).
            if (qData.reward?.title) {
                const titleToken = qData.reward.title;
                if (!(updatedPlayer.titles || []).includes(titleToken)) {
                    updatedPlayer = {
                        ...updatedPlayer,
                        titles: [...new Set([...(updatedPlayer.titles || []), titleToken])],
                        activeTitle: updatedPlayer.activeTitle || titleToken,
                    };
                    addLog('success', `🏆 칭호 획득: [${titleToken}]`);
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
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.questComplete });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.QUEST_DONE(qData.title));
            // cycle 122: 퀘스트 완료 sensory cue — E major arpeggio. cycle 117/118 사운드
            // 시리즈 패턴. 보상 / 칭호 해금이 동반되는 의미 있는 모먼트의 audio reflection.
            soundManager.play('quest_complete');
            // cycle 272: aiService 'questComplete' 스토리 템플릿 dispatch — cycle 122 sound와 paired
            //   narrative cue. 8 스토리 템플릿 중 levelUp/bossPhase2/questComplete/ruinRecap 4종 dead였던
            //   회귀 fix (questComplete 먼저). AI narrative blurb 또는 fallback 텍스트 표시.
            if (typeof addStoryLog === 'function') {
                addStoryLog('questComplete', { questTitle: qData.title });
            }
        },

        claimAchievement: (achId: any) => {
            const achData = DB.ACHIEVEMENTS.find((achievement: any) => achievement.id === achId);
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
            // cycle 215: premiumCurrency 보상이 silently drop되던 회귀 fix — 5 영구 업적
            //   (ach_abyss_200 / ach_abyss_300 / ach_sig_20 / ach_sig_set_all / ach_chain_all)이
            //   합계 300 💎를 절대 받을 수 없던 dead reward. cycle 209 quest reward.title 누락 패턴 동일 lens.
            if (achData.reward?.premiumCurrency) {
                const gain = Number(achData.reward.premiumCurrency) || 0;
                if (gain > 0) {
                    updatedPlayer = {
                        ...updatedPlayer,
                        premiumCurrency: (updatedPlayer.premiumCurrency || 0) + gain,
                    };
                    addLog('success', `💎 +${gain} 에테르 크리스탈 획득`);
                }
            }

            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.ACH_DONE(achData.title));
            // cycle 123: 업적 청구 sensory cue — cycle 122 quest_complete 사운드 재사용.
            // 퀘스트 완료와 업적 청구는 같은 결의 "달성/회수" 모먼트라 동일 음악적
            // 정체성(E major) 부여.
            soundManager.play('quest_complete');
        },

        // cycle 543: useProtect default false 제거 — 1 callsite (CraftingPanel
        //   :52) actions.synthesize(selectedIds, useProtect) 명시 전달이라
        //   default 도달 불가. 청소 메가 시리즈 38번째 (cycle 502-542).
        synthesize: (itemIds: any, useProtect: any) => {
            const items = itemIds.map((id: any) => player.inv.find((entry: any) => entry.id === id)).filter(Boolean);
            const validation = validateSynthesis(items, player.gold);
            if (!validation.valid) {
                if (validation.reason === 'SIGNATURE_INPUT') {
                    return addLog('warning', MSG.SIGNATURE_SYNTH_BLOCKED(validation.signatureName || ''));
                }
                if (validation.reason === 'NO_GOLD') return addLog('error', MSG.SYNTHESIS_NOT_ENOUGH_GOLD);
                return addLog('error', MSG.SYNTHESIS_NOT_ENOUGH);
            }
            // cycle 186: useProtect 시 synthProtects 토큰 우선 소비 — 없으면 premiumCurrency 차감.
            //   기존엔 token 무시하고 premium 차감만 했음 → purchaseSynthProtect 구매가 dead purchase.
            const ownedTokens = (player as any).stats?.synthProtects || 0;
            const useToken = useProtect && ownedTokens > 0;
            if (useProtect && !useToken && player.premiumCurrency < BALANCE.SYNTHESIS_PROTECT_COST) {
                return addLog('error', MSG.PREMIUM_INSUFFICIENT(BALANCE.PREMIUM_CURRENCY_NAME));
            }

            const result = performSynthesis(items, null, useProtect);
            const usedIds = new Set(itemIds);
            const newInv = [
                ...player.inv.filter((entry: any) => !usedIds.has(entry.id)),
                ...result.returnedItems,
            ];

            // 토큰 사용 시 premium currency는 차감 안 함, synthProtects 1 차감.
            const finalPremiumSpent = useToken ? 0 : result.premiumSpent;
            const protectStatsDelta = useToken ? { synthProtects: ownedTokens - 1 } : {};
            let updatedPlayer = incrementStat({
                ...player,
                gold: player.gold - result.goldSpent,
                premiumCurrency: player.premiumCurrency - finalPremiumSpent,
                inv: newInv,
                stats: { ...(player.stats || {}), ...protectStatsDelta },
            }, 'syntheses');

            // cycle 196: synth 신규 codex 추적 — registerLootToCodex 호출 전후 비교.
            const synthCodexBefore = countNewCodexEntries(updatedPlayer);
            if (result.success && result.outputItem) {
                const crafted = makeItem(result.outputItem);
                updatedPlayer = { ...updatedPlayer, inv: [...(updatedPlayer.inv || []), crafted] };
                updatedPlayer = registerLootToCodex(updatedPlayer, [crafted]);
                addLog('success', MSG.SYNTHESIS_SUCCESS(result.outputItem.name));
            } else {
                if (useProtect) {
                    addLog('info', MSG.SYNTHESIS_PROTECTED);
                } else {
                    addLog('error', MSG.SYNTHESIS_FAIL);
                }
            }
            const synthNewCodex = countNewCodexEntries(updatedPlayer) - synthCodexBefore;

            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            if (synthNewCodex > 0) {
                dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.codexDiscover * synthNewCodex });
            }
            if (result.success) dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.synthesize });
            emitUnlockedTitles(updatedPlayer);
        },

        // 시나리오 2: 저가 재료 일괄 판매 (#autoSell)
        // ── 프리미엄 상점 구매 액션 ──────────────────────────────────────
        expandInventory: () => {
            const cost = BALANCE.INV_EXPAND_COST;
            if ((player.premiumCurrency || 0) < cost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            const newMax = (player.maxInv || 20) + BALANCE.INV_EXPAND_AMOUNT;
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, premiumCurrency: p.premiumCurrency - cost, maxInv: newMax }) });
            addLog('system', MSG.PREMIUM_INV_EXPAND(newMax));
        },

        purchaseSynthProtect: () => {
            const cost = BALANCE.SYNTHESIS_PROTECT_COST;
            if ((player.premiumCurrency || 0) < cost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({
                ...p,
                premiumCurrency: p.premiumCurrency - cost,
                stats: { ...(p.stats || {}), synthProtects: (p.stats?.synthProtects || 0) + 1 },
            }) });
            addLog('system', MSG.PREMIUM_PURCHASE('합성 보호권', cost));
        },

        purchaseRevive: () => {
            const cost = BALANCE.REVIVE_COST;
            if ((player.premiumCurrency || 0) < cost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, premiumCurrency: p.premiumCurrency - cost, reviveTokens: (p.reviveTokens || 0) + 1 }) });
            addLog('system', MSG.PREMIUM_PURCHASE('즉시 부활권', cost));
        },

        purchaseCosmeticTitle: (titleId: any, titleName: any, titleCost: any) => {
            if ((player.premiumCurrency || 0) < titleCost) return addLog('warn', MSG.PREMIUM_NOT_ENOUGH);
            const owned = player.stats?.cosmeticTitles || [];
            if (owned.includes(titleId)) return addLog('info', MSG.TITLE_ALREADY_OWNED);
            // cycle 185: 구매한 cosmetic title을 player.titles에도 추가 — SystemTab에서 활성화 가능.
            //   기존엔 stats.cosmeticTitles만 저장돼 UI invisible이던 회귀. titleName은 TITLES.id와
            //   일치 (cycle 185에서 4 cosmetic 정식 등록).
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => {
                const ownedTitles = Array.isArray(p.titles) ? p.titles : [];
                const nextTitles = ownedTitles.includes(titleName) ? ownedTitles : [...ownedTitles, titleName];
                return {
                    ...p,
                    premiumCurrency: p.premiumCurrency - titleCost,
                    titles: nextTitles,
                    stats: { ...(p.stats || {}), cosmeticTitles: [...owned, titleId] },
                };
            } });
            addLog('system', MSG.PREMIUM_PURCHASE(`칭호 [${titleName}]`, titleCost));
        },

        // ── 주간 미션 수령 ────────────────────────────────────────────────
        claimWeeklyMission: (missionId: any, reward: any) => {
            dispatch({ type: AT.CLAIM_WEEKLY_MISSION, payload: { missionId, reward } });
            addLog('success', MSG.WEEKLY_MISSION_CLAIM(reward.gold || 0, reward.premiumCurrency));
            // cycle 261: claim 액션 sensory cue paired completion (cycle 122-123 패턴).
            //   "달성/회수" 모먼트 audio reflection — quest/achievement 사운드 재사용.
            soundManager.play('quest_complete');
        },

        // ── 시즌 패스 보상 수령 ──────────────────────────────────────────
        // cycle 261: SeasonPassPanel claimReward가 dispatch만 있고 addLog/sound 0건이던 UX
        //   dead path fix. quest/achievement/weekly와 동일 sensory cue.
        claimSeasonReward: (tier: any, rewardLabel: string | null = null) => {
            dispatch({ type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
            const label = rewardLabel ? `${rewardLabel}` : `티어 ${tier}`;
            addLog('success', `시즌 패스 보상 수령: ${label}`);
            soundManager.play('quest_complete');
        },

        // ── 아이템 강화 ──────────────────────────────────────────────────
        enhanceItem: (itemId: any) => {
            const equipSlot = typeof itemId === 'string' && itemId.startsWith('equip:')
                ? itemId.split(':')[1]
                : null;
            const item = player.inv.find((i: any) => i.id === itemId)
                || (equipSlot ? player.equip?.[equipSlot] : null)
                || player.equip.weapon?.id === itemId && player.equip.weapon
                || player.equip.armor?.id === itemId && player.equip.armor
                || player.equip.offhand?.id === itemId && player.equip.offhand;
            if (!item) return addLog('error', MSG.ITEM_NOT_FOUND);
            const availability = getEnhanceAvailability(item, player.gold, player.inv);
            if (availability.missing === 'invalid') return addLog('warn', MSG.ENHANCE_NOT_EQUIP);
            if (availability.missing === 'max') return addLog('warn', MSG.ENHANCE_MAX_LEVEL);

            const requirement = availability.requirement;
            const nextLevel = (item.enhance || 0) + 1;
            if (!requirement) return addLog('warn', MSG.ENHANCE_NOT_EQUIP);

            if (availability.missing === 'gold') return addLog('warn', MSG.ENHANCE_NO_GOLD(requirement.gold));
            if (availability.missing === 'material') {
                return addLog('warn', MSG.ENHANCE_NO_MATERIAL(requirement.materialName, requirement.materials));
            }

            const { nextInventory, removed } = consumeInventoryItemByName(player.inv, requirement.materialName, requirement.materials);
            if (removed < requirement.materials) {
                return addLog('warn', MSG.ENHANCE_NO_MATERIAL(requirement.materialName, requirement.materials));
            }
            const rate = BALANCE.ENHANCE_RATES[item.enhance || 0];
            const success = Math.random() < rate;
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: any) => ({
                    ...p,
                    gold: p.gold - requirement.gold,
                    inv: nextInventory,
                })
            });
            dispatch({ type: AT.ENHANCE_ITEM, payload: { itemId, slot: equipSlot, success } });
            if (success) {
                addLog('success', MSG.ENHANCE_SUCCESS(item.name, nextLevel));
            } else {
                addLog('warn', MSG.ENHANCE_FAIL(item.name, nextLevel));
            }
        },

        chooseSkillBranch: (skillName: any, choice: any) => {
            dispatch({ type: AT.CHOOSE_SKILL_BRANCH, payload: { skillName, choice } });
            addLog('system', MSG.SKILL_BRANCH_CHOSEN(skillName, choice));
        },

        invadeGrave: (targetGrave: any) => {
            const today = new Date().toDateString();
            const lastDate = player.stats?.lastInvadeDate;
            const count = lastDate === today ? (player.stats?.dailyInvadeCount || 0) : 0;
            // cycle 137: DAILY_INVADE_LIMIT(=5)이 BALANCE 객체에 있으나 기존엔 CONSTANTS의
            // 동일명 키(undefined)를 참조 → count >= undefined가 항상 false라 일일 5회
            // 침략 제한이 절대 작동 안 했음 (무제한 침략) 잠복 버그 수정.
            if (count >= BALANCE.DAILY_INVADE_LIMIT) {
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
                (item: any) => item.type === 'mat' && (item.price || 0) <= SELL_PRICE_THRESHOLD
            );
            if (sellTargets.length === 0) {
                addLog('info', MSG.BULK_SELL_EMPTY);
                return;
            }
            const sellIds = new Set(sellTargets.map((item: any) => item.id));
            const totalGold = sellTargets.reduce((acc: any, item: any) => acc + Math.floor((item.price || 0) * 0.5), 0);
            const newInv = player.inv.filter((item: any) => !sellIds.has(item.id));
            const updatedPlayer = grantGold({ ...player, inv: newInv }, totalGold);
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.BULK_SELL_DONE(sellTargets.length, totalGold));
        },
    });
};
