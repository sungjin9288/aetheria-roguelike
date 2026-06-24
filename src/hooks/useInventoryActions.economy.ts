import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { makeItem, findItemByName, grantGold, registerCodex, registerLootToCodex, countNewCodexEntries } from '../utils/gameUtils';
import { incrementStat } from '../utils/playerStateUtils';
import { validateSynthesis, performSynthesis } from '../utils/synthesisUtils';
import { SEASON_XP } from '../data/seasonPass';
import { AT } from '../reducers/actionTypes';
import { MSG } from '../data/messages';
import { isSignatureItem } from '../data/signatureItems.js';
import type { Item } from '../types/index.js';

/**
 * createEconomyActions — 경제/제작 도메인 (상점 매매/제작/합성/일괄판매).
 *   골드·재료·코덱스·시즌XP 흐름을 공유. ctx로 deps + 공유 클로저를 받는다.
 */
export const createEconomyActions = (ctx: any) => {
    const { player, gameState, dispatch, addLog, emitUnlockedTitles, emitDailyProtocolLogs } = ctx;

    return ({

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
