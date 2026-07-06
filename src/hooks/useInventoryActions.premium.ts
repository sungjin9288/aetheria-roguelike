import { BALANCE } from '../data/constants';
import { AT } from '../reducers/actionTypes';
import { MSG } from '../data/messages';
import { getMirrorNode } from '../data/mirror';

/**
 * createPremiumActions — 프리미엄 상점 도메인 (인벤 확장 / 합성보호권·부활권·코스메틱 칭호 구매).
 *   모두 premiumCurrency 차감 + 함수형 SET_PLAYER payload. ctx로 deps를 받는다.
 */
export const createPremiumActions = (ctx: any) => {
    const { player, dispatch, addLog } = ctx;

    return ({

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

        // 2026-07 — 에테르 거울: 에센스 소비 영구 업그레이드 노드 구매. 레벨/비용/캡 판정은
        //   purchaseMirrorNode(순수 함수, mirrorUpgrades.ts) → reducer(PURCHASE_MIRROR_NODE)가
        //   전담 — 여기서는 dispatch + 사용자 피드백 로그만 담당.
        purchaseMirrorNode: (nodeId: any) => {
            const node = getMirrorNode(nodeId);
            if (!node) return;
            const currentLevel = player.meta?.mirror?.[nodeId] || 0;
            if (currentLevel >= node.maxLevel) return addLog('info', MSG.MIRROR_MAX_LEVEL(node.name));
            const cost = node.costs[currentLevel];
            if ((player.meta?.essence || 0) < cost) return addLog('warn', MSG.MIRROR_ESSENCE_INSUFFICIENT(cost));
            dispatch({ type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId } });
            addLog('system', MSG.MIRROR_PURCHASE(node.name, currentLevel + 1, cost));
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
    });
};
