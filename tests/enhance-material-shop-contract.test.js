import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import ShopPanel from '../src/components/ShopPanel.tsx';
import {
    ENHANCE_MATERIAL_SHOP_SOURCE,
    getEnhanceMaterialOffer,
    getEnhanceMaterialPrice,
} from '../src/utils/enhanceMaterialShop.ts';
import { getEnhanceMaterialCount } from '../src/utils/enhancementUtils.ts';
import { getShopBuyPrice } from '../src/utils/shopRotation.ts';
import { getInventoryCapacity } from '../src/utils/inventoryCapacity.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-11 E9 (소유자 결정 Q7 (a) "재료를 골드로 구매", 원장 §163 · §164): 마을 상점이 강화 재료를 판다.
 *   이번 여정에 k개를 샀으면 다음 하나는 기본값 + 오름폭 × k(상점 가격 규칙을 거친다). 화면과 리듀서가 같은 제안을 읽고,
 *   산 수는 런 범위라 사망 · 계승에서 0으로 돌아간다.
 */

const NAME = CONSTANTS.ENHANCE_MATERIAL_NAME;
const TOWN = CONSTANTS.START_LOCATION;
const HUNT = Object.keys(DB.MAPS).find((name) => DB.MAPS[name].type !== 'safe' && (DB.MAPS[name].monsters || []).length > 0);
const SAFE_LOCS = Object.keys(DB.MAPS).filter((name) => DB.MAPS[name].type === 'safe');

const shopState = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    gameState: GS.SHOP,
    player: makePlayerFixture({ loc: TOWN, gold: 50_000, inv: [], ...overrides }),
});
const buy = (state, itemName = NAME) => gameReducer(state, {
    type: AT.BUY_SHOP_ITEM,
    payload: {
        source: ENHANCE_MATERIAL_SHOP_SOURCE,
        itemName,
        expectedGold: state.player.gold,
        expectedInventorySize: (state.player.inv || []).length,
        relicRoll: 0.99,
    },
});

test('값은 이번 여정에 산 수만큼 오르고 상점 가격 규칙을 거친다 — 모든 안전지대', () => {
    for (const loc of SAFE_LOCS) {
        for (const bought of [0, 1, 4, 20]) {
            const expected = getShopBuyPrice(loc, BALANCE.ENHANCE_MATERIAL_BUY_BASE + BALANCE.ENHANCE_MATERIAL_BUY_STEP * bought);
            assert.equal(getEnhanceMaterialPrice({ loc, enhanceMaterialBought: bought }), expected, `${loc} · ${bought}`);
        }
    }
    assert.equal(getEnhanceMaterialPrice({ loc: TOWN }), getEnhanceMaterialPrice({ loc: TOWN, enhanceMaterialBought: 0 }), '없으면 0개');
    assert.equal(getEnhanceMaterialPrice({ loc: TOWN, enhanceMaterialBought: -3 }), getEnhanceMaterialPrice({ loc: TOWN, enhanceMaterialBought: 0 }));
    // 되팔아 남기지 못한다 — 판매가는 재료의 기본가 절반이다.
    assert.ok(getEnhanceMaterialOffer(makePlayerFixture({ loc: TOWN })).item.price < BALANCE.ENHANCE_MATERIAL_BUY_BASE);
});

test('구매는 골드를 내고 재료 하나를 가방에 넣고 산 수를 올린다 — 다음 하나는 오른 값이다', () => {
    let state = shopState();
    const first = getEnhanceMaterialPrice(state.player);
    state = buy(state);
    assert.equal(state.player.gold, 50_000 - first);
    assert.equal(getEnhanceMaterialCount(state.player.inv), 1);
    assert.equal(state.player.enhanceMaterialBought, 1);
    const second = getEnhanceMaterialPrice(state.player);
    assert.equal(second, getEnhanceMaterialPrice({ loc: TOWN, enhanceMaterialBought: 1 }));
    assert.ok(second > first);
    state = buy(state);
    assert.equal(state.player.gold, 50_000 - first - second);
    assert.equal(getEnhanceMaterialCount(state.player.inv), 2);
    assert.equal(state.player.enhanceMaterialBought, 2);
});

test('사지 못하는 경우 — 상점 밖 · 사냥 지역 · 다른 이름 · 골드 부족 · 가방 가득 · 낡은 기대값', () => {
    const notShop = { ...shopState(), gameState: GS.IDLE };
    assert.equal(buy(notShop), notShop, '상점 화면이 아니면 그대로');
    const hunt = shopState({ loc: HUNT });
    assert.equal(getEnhanceMaterialOffer(hunt.player), null);
    assert.equal(buy(hunt), hunt, '안전지대가 아니면 그대로');
    const wrongName = shopState();
    assert.equal(buy(wrongName, '하급 체력 물약'), wrongName, '재료 출처로 다른 물건은 사지 못한다');

    const poor = shopState({ gold: BALANCE.ENHANCE_MATERIAL_BUY_BASE - 1 });
    const afterPoor = buy(poor);
    assert.equal(afterPoor.player.gold, poor.player.gold);
    assert.equal(afterPoor.player.enhanceMaterialBought, undefined);
    assert.equal(getEnhanceMaterialCount(afterPoor.player.inv), 0);

    const filler = DB.ITEMS.materials.find((item) => item.name !== NAME);
    const base = shopState();
    const capacity = getInventoryCapacity(base.player);
    const full = shopState({ inv: Array.from({ length: capacity }, (_, index) => ({ ...filler, id: `fill-${index}` })) });
    const afterFull = buy(full);
    assert.equal(afterFull.player.gold, full.player.gold, '가방이 가득이면 사지 못한다');
    assert.equal(afterFull.player.inv.length, capacity);

    const stale = shopState();
    const staleAction = gameReducer(stale, {
        type: AT.BUY_SHOP_ITEM,
        payload: { source: ENHANCE_MATERIAL_SHOP_SOURCE, itemName: NAME, expectedGold: stale.player.gold + 1, expectedInventorySize: 0, relicRoll: 0.5 },
    });
    assert.equal(staleAction, stale, '본 골드와 다르면 그대로(빠른 연타)');
});

test('산 수는 런 범위다 — 사망 · 계승이 넘기지 않는다', () => {
    const player = makePlayerFixture({ enhanceMaterialBought: 7 });
    for (const kind of ['death', 'ascension']) {
        assert.equal('enhanceMaterialBought' in pickPermanentPlayerState(player, INITIAL_STATE.player, kind), false, kind);
    }
});

test('상점 화면은 리듀서가 받을 값을 그리고, 사냥 지역에서는 그리지 않는다', () => {
    const actions = { market: () => {}, clearEconomyReceipt: () => {}, economyReceipt: null };
    const player = makePlayerFixture({ loc: TOWN, gold: 99_999, enhanceMaterialBought: 3 });
    const html = renderStatic(createElement(ShopPanel, { player, shopItems: [], actions, stats: null }));
    assert.match(html, /data-testid="shop-enhance-material"/);
    const price = getEnhanceMaterialPrice(player);
    const shown = html.match(/data-testid="shop-enhance-material-price"[^>]*>([^<]*)</)?.[1] ?? '';
    assert.equal(Number(shown.replace(/[^0-9]/g, '')), price, `화면 값 ${shown}`);
    const huntHtml = renderStatic(createElement(ShopPanel, { player: { ...player, loc: HUNT }, shopItems: [], actions, stats: null }));
    assert.doesNotMatch(huntHtml, /data-testid="shop-enhance-material"/);
});
