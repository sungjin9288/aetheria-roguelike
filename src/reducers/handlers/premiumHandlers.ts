import { BALANCE } from '../../data/constants';
import { getMirrorNode } from '../../data/mirror';
import { MSG } from '../../data/messages';
import { PREMIUM_SHOP } from '../../data/premiumShop';
import { purchaseMirrorNode } from '../../systems/mirrorUpgrades';
import type { GameAction, GameState } from '../gameReducer';
import { appendRewardLogs } from './rewardLog';

const completePremiumTransaction = (
    state: GameState,
    player: any,
    text: string,
): GameState => ({
    ...state,
    player,
    logs: appendRewardLogs(state.logs || [], [{ type: 'system', text }]),
    syncStatus: 'syncing',
});

const hasExpectedCurrency = (state: GameState, action: GameAction) => {
    const current = Math.max(0, Number(state.player.premiumCurrency) || 0);
    return Number(action.payload?.expectedCurrency) === current;
};

const purchasePreparationOffer = (
    state: GameState,
    offerId: string,
): GameState => {
    const player: any = state.player;
    const currentCurrency = Math.max(0, Number(player.premiumCurrency) || 0);

    if (offerId === PREMIUM_SHOP.invExpand.id) {
        const cost = PREMIUM_SHOP.invExpand.cost;
        if (currentCurrency < cost) return state;
        const maxInv = (Number(player.maxInv) || 20) + BALANCE.INV_EXPAND_AMOUNT;
        return completePremiumTransaction(state, {
            ...player,
            premiumCurrency: currentCurrency - cost,
            maxInv,
        }, MSG.PREMIUM_INV_EXPAND(maxInv));
    }

    if (offerId === PREMIUM_SHOP.synthProtect.id) {
        const cost = PREMIUM_SHOP.synthProtect.cost;
        if (currentCurrency < cost) return state;
        return completePremiumTransaction(state, {
            ...player,
            premiumCurrency: currentCurrency - cost,
            stats: {
                ...(player.stats || {}),
                synthProtects: (Number(player.stats?.synthProtects) || 0) + 1,
            },
        }, MSG.PREMIUM_PURCHASE('합성 보호석', cost));
    }

    if (offerId === PREMIUM_SHOP.revive.id) {
        const cost = PREMIUM_SHOP.revive.cost;
        if (currentCurrency < cost) return state;
        return completePremiumTransaction(state, {
            ...player,
            premiumCurrency: currentCurrency - cost,
            reviveTokens: (Number(player.reviveTokens) || 0) + 1,
        }, MSG.PREMIUM_PURCHASE('에테르 부활석', cost));
    }

    return state;
};

const purchaseCosmeticTitle = (
    state: GameState,
    offerId: string,
): GameState => {
    const title = PREMIUM_SHOP.cosmeticTitles.find((entry: any) => entry.id === offerId);
    if (!title) return state;

    const player: any = state.player;
    const currentCurrency = Math.max(0, Number(player.premiumCurrency) || 0);
    const cosmeticTitles = Array.isArray(player.stats?.cosmeticTitles)
        ? player.stats.cosmeticTitles
        : [];
    if (cosmeticTitles.includes(title.id) || currentCurrency < title.cost) return state;

    const titles = Array.isArray(player.titles) ? player.titles : [];
    return completePremiumTransaction(state, {
        ...player,
        premiumCurrency: currentCurrency - title.cost,
        titles: titles.includes(title.name) ? titles : [...titles, title.name],
        stats: {
            ...(player.stats || {}),
            cosmeticTitles: [...cosmeticTitles, title.id],
        },
    }, MSG.PREMIUM_PURCHASE(`칭호 [${title.name}]`, title.cost));
};

const purchasePremiumOffer = (state: GameState, action: GameAction): GameState => {
    const offerId = typeof action.payload?.offerId === 'string' ? action.payload.offerId : '';
    if (!offerId || !hasExpectedCurrency(state, action)) return state;

    const preparationOfferIds = [
        PREMIUM_SHOP.invExpand.id,
        PREMIUM_SHOP.synthProtect.id,
        PREMIUM_SHOP.revive.id,
    ];
    if (preparationOfferIds.includes(offerId)) {
        return purchasePreparationOffer(state, offerId);
    }
    return purchaseCosmeticTitle(state, offerId);
};

const purchaseMirrorUpgrade = (state: GameState, action: GameAction): GameState => {
    const nodeId = typeof action.payload?.nodeId === 'string' ? action.payload.nodeId : '';
    const node = getMirrorNode(nodeId);
    if (!node) return state;

    const player: any = state.player;
    const meta = player.meta || {};
    const essence = Math.max(0, Number(meta.essence) || 0);
    const mirror = meta.mirror || {};
    const currentLevel = Math.max(0, Number(mirror[nodeId]) || 0);
    if (
        Number(action.payload?.expectedEssence) !== essence
        || Number(action.payload?.expectedLevel) !== currentLevel
    ) return state;

    const result = purchaseMirrorNode(mirror, nodeId, essence);
    if (!result.success) return state;

    return completePremiumTransaction(state, {
        ...player,
        meta: {
            ...meta,
            essence: essence - result.cost,
            mirror: result.mirror,
        },
    }, MSG.MIRROR_PURCHASE(node.name, result.newLevel, result.cost));
};

export const premiumActionMap = {
    PURCHASE_PREMIUM_OFFER: purchasePremiumOffer,
    PURCHASE_MIRROR_NODE: purchaseMirrorUpgrade,
};
