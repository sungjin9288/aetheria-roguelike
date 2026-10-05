import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { DB } from '../src/data/db.ts';
import { MAPS } from '../src/data/maps.ts';
import {
    getCanonicalShopOffer,
    getDailyDeals,
    getShopBuyPrice,
    getShopCatalog,
    getShopMaxTier,
    getShopPriceMult,
    getWeeklySpecial,
} from '../src/utils/shopRotation.ts';
import { getSellPrice } from '../src/utils/equipmentUtils.ts';
import { getExpeditionReturnAction, getRestCost } from '../src/utils/expeditionReturnFlow.ts';
import { getTownActionPresentation } from '../src/utils/townActionPresentation.ts';
import ShopPanel from '../src/components/ShopPanel.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-10 Wave 62 C20 (원장 §61.4 · 소유자 답 §61.6 "전부 설명대로 — 북부 요새 판매 등급 3 · 황금 왕국 가격 할증").
 *
 * - 북부 요새 설명은 "(Tier 3 상점)"인데 레벨 규칙이 5등급까지 팔았고 상점 화면도 "판매 등급 5"였다.
 * - 황금 왕국 설명은 "물가가 높지만"인데 가격 보정이 없었다(`shopBonus`는 판매 등급 +1이고 이미 6이었다).
 *
 * 규칙은 지역 데이터가 선언하고(`shopMaxTier` · `shopPriceMult`) 상점 규칙(`getShopMaxTier` · `getShopBuyPrice`) 하나를
 * 상점 화면과 구매 리듀서(`getCanonicalShopOffer` → `BUY_SHOP_ITEM`)가 같이 읽는다. 판매가는 바뀌지 않는다.
 */

const FORTRESS = '북부 요새';
const KINGDOM = '황금 왕국';
const clone = (value) => structuredClone(value);

const ALL_SHOP_ITEMS = [...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors];
const tierOf = (item) => item.tier || 1;
const byName = (name) => ALL_SHOP_ITEMS.find((item) => item.name === name);

/** 레벨 · 안전지대 · `shopBonus`만으로 정해지던 판매 등급(선언 상한 이전의 규칙). */
const derivedTier = (map) => {
    const level = typeof map.level === 'number' ? map.level : 1;
    const tier = level < 10 ? 1 : level < 20 ? 2 : level < 30 ? 3 : level < 40 ? 4 : level < 50 ? 5 : 6;
    return Math.min(6, tier + (map.type === 'safe' && level > 1 ? 1 : 0) + (map.shopBonus ? 1 : 0));
};

const SAFE_SHOPS = Object.entries(MAPS).filter(([, map]) => map.type === 'safe').map(([name]) => name);
const OTHER_SHOPS = SAFE_SHOPS.filter((name) => name !== FORTRESS && name !== KINGDOM);

/** 상점 회전(오늘의 할인 · 주간 특별)은 벽시계를 읽는다 — 날짜를 고정해 여러 날을 돈다. */
const withDate = (iso, fn) => {
    const RealDate = Date;
    const fixed = new RealDate(iso).getTime();
    class FixedDate extends RealDate {
        constructor(...args) {
            super(...(args.length > 0 ? args : [fixed]));
        }

        static now() {
            return fixed;
        }
    }
    globalThis.Date = FixedDate;
    try {
        return fn();
    } finally {
        globalThis.Date = RealDate;
    }
};

const ROTATION_DAYS = Array.from({ length: 120 }, (_, offset) => {
    const day = new Date(Date.UTC(2026, 0, 1 + offset, 12));
    return day.toISOString();
});
const LEVELS = [1, 12, 25, 40, 60];

const shopState = (loc, playerOverrides = {}) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...clone(INITIAL_STATE),
        gameState: GS.SHOP,
        player: {
            ...base,
            loc,
            level: 60,
            gold: 1_000_000,
            inv: [],
            ...playerOverrides,
            stats: { ...base.stats, ...(playerOverrides.stats || {}) },
        },
        logs: [],
    };
};

const buy = (state, source, itemName) => gameReducer(state, {
    type: AT.BUY_SHOP_ITEM,
    payload: {
        source,
        itemName,
        expectedGold: state.player.gold,
        expectedInventorySize: (state.player.inv || []).length,
        relicRoll: 0.5,
    },
});

const renderShop = (loc, playerOverrides = {}, shopItems = ALL_SHOP_ITEMS) => renderStatic(createElement(ShopPanel, {
    player: makePlayerFixture({ loc, level: 60, gold: 1_000_000, inv: [], ...playerOverrides }),
    actions: { market: () => {}, economyReceipt: null, clearEconomyReceipt: () => {} },
    shopItems,
    setGameState: () => {},
    stats: null,
    onOpenArchiveConsole: () => {},
}));

const formatGold = (value) => `${Number(value || 0).toLocaleString()} 골드`;

// ── 북부 요새: 판매 등급 3 ──────────────────────────────────────────────────

test('북부 요새: 판매 등급 3은 지역 데이터가 선언하고, 설명 · 상점 규칙 · 상점 화면이 같은 값이다', () => {
    assert.equal(MAPS[FORTRESS].shopMaxTier, 3);
    assert.equal(derivedTier(MAPS[FORTRESS]), 5, '레벨 규칙만으로는 5등급이었다');
    assert.equal(getShopMaxTier(FORTRESS), 3);
    assert.ok(MAPS[FORTRESS].desc.includes(`판매 등급 ${getShopMaxTier(FORTRESS)}`), MAPS[FORTRESS].desc);
    const html = renderShop(FORTRESS);
    assert.ok(html.includes('판매 등급 3'), '상점 머리말이 판매 등급 3을 말한다');
    assert.ok(!html.includes('판매 등급 5'));
});

test('북부 요새: 재고 · 오늘의 할인 · 주간 특별 상품이 어느 날에도 3등급을 넘지 않는다', () => {
    const catalog = getShopCatalog(FORTRESS);
    assert.ok(catalog.length > 0);
    assert.ok(catalog.every((item) => tierOf(item) <= 3), '재고');
    assert.ok(catalog.some((item) => tierOf(item) === 3), '3등급까지는 판다');
    let weeklySeen = 0;
    for (const iso of ROTATION_DAYS) {
        withDate(iso, () => {
            for (const level of LEVELS) {
                const deals = getDailyDeals(level, FORTRESS).items;
                assert.equal(deals.length, 3, `${iso} Lv${level}: 할인 상품 3개`);
                for (const deal of deals) assert.ok(tierOf(deal) <= 3, `${iso} Lv${level}: ${deal.name} T${tierOf(deal)}`);
                const special = getWeeklySpecial(level, FORTRESS);
                if (special) {
                    weeklySeen += 1;
                    assert.ok(tierOf(special) <= 3, `${iso} Lv${level}: 주간 ${special.name} T${tierOf(special)}`);
                }
                // 구매 리듀서가 확인하는 제안도 같은 규칙이다 — 화면에 없는 상위 등급 할인은 살 수 없다.
                const unrestricted = getDailyDeals(level, '').items.filter((item) => tierOf(item) > 3);
                for (const item of unrestricted) {
                    assert.equal(getCanonicalShopOffer('daily', item.name, level, FORTRESS), null, `${iso}: ${item.name}`);
                }
            }
        });
    }
    assert.ok(weeklySeen > 0, '주간 특별 상품은 3등급으로라도 나온다');
});

test('북부 요새: 리듀서는 4등급 이상 재고 구매를 거부하고 3등급은 판다 (실제 BUY_SHOP_ITEM)', () => {
    const consumer = (item) => ({ job: Array.isArray(item.jobs) ? item.jobs[0] : '모험가' });
    const above = ALL_SHOP_ITEMS.find((item) => tierOf(item) === 4);
    const allowed = ALL_SHOP_ITEMS.find((item) => tierOf(item) === 3);
    const blockedState = shopState(FORTRESS, consumer(above));
    assert.strictEqual(buy(blockedState, 'stock', above.name), blockedState, '4등급은 이 상점의 제안이 아니다');
    const okState = shopState(FORTRESS, consumer(allowed));
    const bought = buy(okState, 'stock', allowed.name);
    assert.equal(bought.player.inv.length, 1);
    assert.equal(bought.player.gold, okState.player.gold - (allowed.price || 0), '북부 요새는 기본가');
});

// ── 황금 왕국: 가격 할증 ─────────────────────────────────────────────────────

test('황금 왕국: 구매 가격 배율은 지역 데이터가 선언한다 — 설명이 "물가가 높지만"이라 말하는 곳만 1보다 크다', () => {
    const mult = MAPS[KINGDOM].shopPriceMult;
    assert.equal(mult, 1.3);
    assert.equal(getShopPriceMult(KINGDOM), mult);
    assert.ok(MAPS[KINGDOM].desc.includes('물가가 높지만'));
    for (const item of getShopCatalog(KINGDOM)) {
        assert.equal(getShopBuyPrice(KINGDOM, item.price || 0), Math.round((item.price || 0) * mult), item.name);
    }
    for (const [name, map] of Object.entries(MAPS)) {
        if (getShopPriceMult(name) !== 1) assert.match(map.desc || '', /물가/, `${name}: 할증은 설명이 말한 곳에만`);
    }
    assert.ok(renderShop(KINGDOM).includes('물가 130%'), '상점 머리말이 물가를 말한다');
    assert.ok(!renderShop('허공의 섬').includes('물가'), '할증 없는 상점은 물가를 말하지 않는다');
});

test('황금 왕국: 재고 구매가 = 기본가 × 1.3 — 화면이 그리는 값과 리듀서가 빼는 골드가 같고, 산 물건은 기본가로 저장된다', () => {
    const items = ['하급 체력 물약', '상급 체력 물약'].map(byName).filter(Boolean);
    const equipment = ALL_SHOP_ITEMS.find((item) => item.type === 'weapon' && tierOf(item) === 6 && (item.price || 0) > 0);
    for (const item of [...items, equipment]) {
        const expected = Math.round((item.price || 0) * 1.3);
        assert.notEqual(expected, item.price, `${item.name}: 할증이 값에 드러난다`);
        const job = Array.isArray(item.jobs) ? item.jobs[0] : '모험가';

        const html = renderShop(KINGDOM, { job }, [item]);
        const priceCell = html.match(/data-testid="shop-buy-price"[^>]*>([^<]*)</);
        assert.ok(priceCell, `${item.name}: 가격 칸이 그려진다`);
        assert.equal(priceCell[1], formatGold(expected), `${item.name}: 화면 가격`);

        const state = shopState(KINGDOM, { job });
        const bought = buy(state, 'stock', item.name);
        assert.equal(bought.player.gold, state.player.gold - expected, `${item.name}: 리듀서 차감`);
        assert.equal(bought.player.inv[0].price, item.price, `${item.name}: 산 물건은 기본가`);
        assert.equal(getSellPrice(bought.player.inv[0]), getSellPrice(item), `${item.name}: 판매가 불변`);
    }
});

test('황금 왕국: 오늘의 할인 · 주간 특별 상품도 할증을 거친다 — 화면 가격 = 리듀서 차감, 정가(취소선)는 할증된 정가', () => {
    for (const iso of ROTATION_DAYS.slice(0, 14)) {
        withDate(iso, () => {
            const level = 40;
            const deals = getDailyDeals(level, KINGDOM).items;
            const plain = getDailyDeals(level, '').items;
            assert.deepEqual(deals.map((item) => item.name), plain.map((item) => item.name), '같은 날 같은 상품(가격만 다르다)');
            for (const deal of deals) {
                const base = byName(deal.name).price || 0;
                assert.equal(deal.price, getShopBuyPrice(KINGDOM, Math.floor(base * 0.9)));
                assert.equal(deal.originalPrice, Math.round(base * 1.3));
                const job = Array.isArray(deal.jobs) ? deal.jobs[0] : '모험가';
                const state = shopState(KINGDOM, { job, level });
                const bought = buy(state, 'daily', deal.name);
                assert.equal(bought.player.gold, state.player.gold - deal.price, `${iso} ${deal.name}`);
                assert.equal(bought.player.inv[0].price, base, '산 물건은 기본가');
                assert.ok(!('originalPrice' in bought.player.inv[0]));
            }
            const html = renderShop(KINGDOM, { level });
            for (const deal of deals) assert.ok(html.includes(formatGold(deal.price)), `${deal.name}: 할인가가 그려진다`);

            const special = getWeeklySpecial(level, KINGDOM);
            if (special) {
                const base = byName(special.name).price || 0;
                assert.equal(special.price, getShopBuyPrice(KINGDOM, Math.floor(base * 0.85)));
                const job = Array.isArray(special.jobs) ? special.jobs[0] : '모험가';
                const state = shopState(KINGDOM, { job, level });
                const bought = buy(state, 'weekly', special.name);
                assert.equal(bought.player.gold, state.player.gold - special.price);
                assert.equal(bought.player.inv[0].price, base);
                assert.ok(html.includes(formatGold(special.price)));
            }
        });
    }
});

test('황금 왕국: 판매가는 그대로다 — 같은 물건을 다른 상점에서 파는 값과 같다 (실제 SELL_INVENTORY_ITEM)', () => {
    const item = { ...byName('상급 체력 물약'), id: 'sell-me' };
    const sellAt = (loc) => {
        const state = { ...shopState(loc, { gold: 0, inv: [item] }) };
        return gameReducer(state, { type: AT.SELL_INVENTORY_ITEM, payload: { itemId: 'sell-me' } }).player.gold;
    };
    assert.equal(sellAt(KINGDOM), getSellPrice(item));
    assert.equal(sellAt(KINGDOM), sellAt('허공의 섬'));
});

// ── 다른 상점은 그대로 ─────────────────────────────────────────────────────

test('다른 상점은 그대로다 — 판매 등급 · 구매가 · 할인 · 주간 특별 상품이 선언 이전 규칙과 같다', () => {
    assert.ok(OTHER_SHOPS.length >= 3, OTHER_SHOPS.join(', '));
    for (const loc of [...OTHER_SHOPS, KINGDOM]) {
        assert.equal(getShopMaxTier(loc), derivedTier(MAPS[loc]), `${loc}: 판매 등급`);
    }
    for (const loc of OTHER_SHOPS) {
        assert.equal(getShopPriceMult(loc), 1, loc);
        for (const item of getShopCatalog(loc)) {
            assert.equal(getShopBuyPrice(loc, item.price || 0), item.price || 0, `${loc}: ${item.name}`);
            assert.equal(getCanonicalShopOffer('stock', item.name, 60, loc)?.price, item.price || 0);
        }
        for (const iso of ROTATION_DAYS.slice(0, 30)) {
            withDate(iso, () => {
                for (const level of LEVELS) {
                    assert.deepEqual(getDailyDeals(level, loc), getDailyDeals(level, ''), `${loc} ${iso} Lv${level}`);
                    assert.deepEqual(getWeeklySpecial(level, loc), getWeeklySpecial(level, ''), `${loc} ${iso} Lv${level}`);
                }
            });
        }
    }
    const state = shopState('허공의 섬');
    const potion = byName('하급 체력 물약');
    assert.equal(buy(state, 'stock', potion.name).player.gold, state.player.gold - potion.price);
});

test('황금 왕국: 보급 안내(귀환 행동 · 마을 상점 상태)도 할증된 가격으로 살 수 있는지 판단한다', () => {
    const supplies = DB.ITEMS.consumables.filter((item) => ['hp', 'mp', 'cure'].includes(item.type) && item.price > 0);
    const cheapest = Math.min(...supplies.map((item) => item.price));
    const playerAt = (loc) => ({
        ...clone(INITIAL_STATE.player), name: '보급 확인', loc, level: 30, hp: 10, maxHp: 1000, mp: 10, maxMp: 300,
        gold: cheapest, inv: [], quests: [],
    });
    const summary = { destination: KINGDOM, lastLocation: KINGDOM, returnLocation: KINGDOM, maxHpAtReturn: 1000, newItems: [] };
    const town = (player) => getTownActionPresentation({
        player, mapData: MAPS[player.loc], stats: { maxHp: player.maxHp, maxMp: player.maxMp },
        guidance: { primaryAction: null }, preparation: null, hasGrave: false,
        classes: DB.CLASSES, recipes: DB.ITEMS.recipes || [], consumables: DB.ITEMS.consumables,
    });

    // 기본가로는 가장 싼 보급품을 살 수 있지만 × 1.3으로는 어느 것도 살 수 없는 골드 — 휴식은 그보다 비싸다.
    assert.ok(getShopBuyPrice(KINGDOM, cheapest) > cheapest);
    const kingdom = playerAt(KINGDOM);
    assert.ok(getRestCost(kingdom) > kingdom.gold, '휴식을 살 수 없는 골드');
    assert.notEqual(getExpeditionReturnAction(kingdom, summary).kind, 'open_shop', '황금 왕국에서 살 수 없는 물약을 권한다');
    assert.equal(town(kingdom).facilityStatus.market, '이용 가능');

    // 대조군: 같은 골드가 기본가 마을에서는 보급을 권한다.
    const plain = playerAt(FORTRESS);
    assert.equal(getShopPriceMult(FORTRESS), 1);
    assert.equal(getExpeditionReturnAction(plain, { ...summary, returnLocation: FORTRESS }).kind, 'open_shop');
    assert.equal(town(plain).facilityStatus.market, '보급 권장');
});
