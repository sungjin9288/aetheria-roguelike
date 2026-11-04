/**
 * enhanceMaterialShop.ts — 마을 상점의 강화 재료(2026-11 E9, 소유자 결정 Q7 (a) "재료를 골드로 구매", 원장 §163 · §164).
 *
 * 자연 플레이에서 골드는 회차 수입의 2 ~ 3%만 쓰였고, 유일한 큰 소비처인 강화를 막은 것은 골드가 아니라 강화 재료였다(§163).
 * 상점이 재료를 팔되 이번 여정에 산 수만큼 값이 오른다 — 강화는 장비에 붙어 사망 · 계승에서 사라지므로 영구 가치가 없다.
 * 화면(`ShopPanel`)과 구매 리듀서(`BUY_SHOP_ITEM` 출처 `material`)가 같은 제안을 읽는다.
 */
import { BALANCE, CONSTANTS } from '../data/constants';
import { DB } from '../data/db';
import { getShopBuyPrice } from './shopRotation';
import { getActiveMerchantVisit } from './wanderingMerchant';
import type { Item, Player } from '../types/index.js';

export const ENHANCE_MATERIAL_SHOP_SOURCE = 'material';

export const getEnhanceMaterialBoughtCount = (player: Pick<Player, 'enhanceMaterialBought'> | null | undefined): number => {
    const count = Math.floor(Number(player?.enhanceMaterialBought) || 0);
    return count > 0 ? count : 0;
};

/** 다음 하나의 값 — 이번 여정에 산 수만큼 오른다. */
export const getEnhanceMaterialPrice = (player: Pick<Player, 'enhanceMaterialBought' | 'loc'>): number => (
    getShopBuyPrice(
        player.loc || '',
        BALANCE.ENHANCE_MATERIAL_BUY_BASE + BALANCE.ENHANCE_MATERIAL_BUY_STEP * getEnhanceMaterialBoughtCount(player),
    )
);

/** 마을 상점(안전지대)에서만 판다 — 떠돌이 행상인과 만나는 동안은 행상인 진열만 보인다. */
export const getEnhanceMaterialOffer = (player: Player | null | undefined): { item: Item; price: number } | null => {
    if (!player || DB.MAPS[player.loc || '']?.type !== 'safe' || getActiveMerchantVisit(player)) return null;
    const item = (DB.ITEMS.materials || []).find((entry) => entry.name === CONSTANTS.ENHANCE_MATERIAL_NAME);
    return item ? { item, price: getEnhanceMaterialPrice(player) } : null;
};
