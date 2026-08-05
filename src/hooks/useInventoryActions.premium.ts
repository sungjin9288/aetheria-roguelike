import { AT } from '../reducers/actionTypes';

const purchaseOffer = (player: any, dispatch: any, offerId: string) => {
    dispatch({
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: {
            offerId,
            expectedCurrency: Math.max(0, Number(player.premiumCurrency) || 0),
        },
    });
};

/** UI는 선택 대상과 현재 snapshot만 전달하고, 비용과 지급 결과는 reducer가 확정한다. */
export const createPremiumActions = ({ player, dispatch }: any) => ({
    expandInventory: () => purchaseOffer(player, dispatch, 'inv_expand'),
    purchaseSynthProtect: () => purchaseOffer(player, dispatch, 'synth_protect'),
    purchaseRevive: () => purchaseOffer(player, dispatch, 'revive'),
    purchaseCosmeticTitle: (titleId: string) => purchaseOffer(player, dispatch, titleId),
    purchaseMirrorNode: (nodeId: string) => dispatch({
        type: AT.PURCHASE_MIRROR_NODE,
        payload: {
            nodeId,
            expectedEssence: Math.max(0, Number(player.meta?.essence) || 0),
            expectedLevel: Math.max(0, Number(player.meta?.mirror?.[nodeId]) || 0),
        },
    }),
});
