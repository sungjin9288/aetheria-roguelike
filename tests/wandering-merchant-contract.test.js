import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { QUESTS } from '../src/data/quests.js';
import { RELICS } from '../src/data/relics.js';
import { getNextBagRecipe } from '../src/data/bagRecipes.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getSellPrice } from '../src/utils/equipmentUtils.js';
import { getEventChoicePreview } from '../src/utils/eventPresentation.js';
import { startExpedition } from '../src/utils/expeditionLedger.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { getShopMaxTier } from '../src/utils/shopRotation.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import {
    buildMerchantEvent,
    buildMerchantStock,
    getActiveMerchantVisit,
    getMerchantRoll,
    shouldMeetMerchant,
    startMerchantVisit,
} from '../src/utils/wanderingMerchant.js';
import ShopPanel from '../src/components/ShopPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 75 — 소유자 결정 "가방은 현행 유지, 대신 낮은 확률의 이벤트로 행상인을 만나는 걸로. 물품은 항상 바뀌지만 희귀한
 * 재료 아이템이나 장비를 가지고 있을 때도 있는 걸로. 물론 판매도 가능하게".
 *
 * 계약: ① 만남 · 재고는 탐험 난수도 `Math.random`도 쓰지 않는다 — 만나지 않는 탐험의 난수열은 기능 이전과 같다 ② 사냥 지역
 * 탐험의 약 1.2%, 안전지대는 0 ③ 재고는 만날 때마다 바뀌고(탐험 수 · 지역의 함수) 약 35%에 희귀 칸이 붙는다 ④ 실제 탐험 경로가
 * 만남 카드를 띄우고 보스 도전 카드 뒤에 선다 ⑤ 사고팔기는 리듀서가 이번 만남의 재고로 검증한다 — 판매가는 상점과 같다.
 */

const FIELD = '고요한 숲';
const DUNGEON = '용의 둥지';
const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');
const NOW = 1_700_000_000_000;

const playerAt = (loc, explores, extra = {}) => ({ ...structuredClone(INITIAL_STATE.player), loc, job: '전사', level: 30, stats: { explores }, ...extra });

/** 이 지역에서 행상인을 만나는(또는 만나지 않는) 탐험 수를 찾는다 — 판정은 탐험 수 · 지역의 함수다. */
const findExplores = (loc, meets, from = 0) => {
    for (let explores = from; explores < from + 100_000; explores += 1) {
        if (shouldMeetMerchant(playerAt(loc, explores), DB.MAPS[loc], loc) === meets) return explores;
    }
    throw new Error('not found');
};

const withoutMathRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random 호출'); };
    try { return fn(); } finally { Math.random = original; }
};

// ── 실제 탐험 경로 하네스(dimension-grave-event-contract와 같은 모양) ───────────────────────────────

const baseState = (loc, explores, playerExtra = {}) => {
    const player = startExpedition({
        ...structuredClone(INITIAL_STATE.player),
        name: '용사', job: '전사', level: 30, hp: 900, maxHp: 1_000, atk: 50, gold: 50_000, loc,
        relics: [structuredClone(HARMLESS_RELIC)],
        eventChainProgress: { ...ALL_CHAINS_DONE },
        stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: ['시작의 마을', loc], explores: 5 },
    }, loc, NOW, QUESTS);
    return {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        logs: [],
        gameState: GS.IDLE,
        player: { ...player, stats: { ...player.stats, explores, exploreState: { sinceNarrativeEvent: 3 } }, ...playerExtra },
    };
};

const counting = (value = 0.99) => {
    const rng = () => { rng.calls += 1; return value; };
    rng.calls = 0;
    return rng;
};

const harness = (state) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    return { get: () => current, dispatch, addLog };
};

const explore = async (state, rng) => {
    const h = harness(state);
    await createExploreActions({
        player: state.player, gameState: state.gameState, uid: 'me', dispatch: h.dispatch, addLog: h.addLog,
        addStoryLog: () => {}, getFullStats: () => calculateFullStats(h.get().player), rng,
    }, makeSharedHelpers({ player: state.player, dispatch: h.dispatch, addLog: h.addLog })).explore();
    return h.get();
};

const choose = (state, choiceIndex) => {
    const h = harness(state);
    createEventActions({
        player: state.player, currentEvent: state.currentEvent, dispatch: h.dispatch, addLog: h.addLog,
        addStoryLog: () => {}, getFullStats: () => calculateFullStats(h.get().player), rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return h.get();
};

const buy = (state, itemName, source = 'merchant') => gameReducer(state, {
    type: AT.BUY_SHOP_ITEM,
    payload: { source, itemName, expectedGold: state.player.gold, expectedInventorySize: (state.player.inv || []).length, relicRoll: 0.99 },
});

// ── ① 난수 ──────────────────────────────────────────────────────────────────────

test('[난수] 만남 판정 · 재고는 난수 원천을 받지 않고 Math.random도 부르지 않는다', () => {
    assert.equal(shouldMeetMerchant.length, 3);
    withoutMathRandom(() => {
        for (let explores = 0; explores < 300; explores += 1) {
            shouldMeetMerchant(playerAt(DUNGEON, explores), DB.MAPS[DUNGEON], DUNGEON);
            buildMerchantStock(playerAt(DUNGEON, explores), DUNGEON);
        }
    });
});

test('[난수] 행상인을 만나지 않는 탐험은 탐험 수와 무관하게 같은 난수를 같은 만큼 쓰고 같은 상태가 된다', async () => {
    const a = findExplores(FIELD, false, 100);
    const b = findExplores(FIELD, false, a + 1);
    const rngA = counting();
    const rngB = counting();
    const afterA = await explore(baseState(FIELD, a), rngA);
    const afterB = await explore(baseState(FIELD, b), rngB);
    assert.ok(rngA.calls > 0);
    assert.equal(rngA.calls, rngB.calls, '만남 판정이 난수를 쓰지 않는다');
    assert.equal(afterA.gameState, afterB.gameState);
    assert.equal(afterA.player.merchantVisit, undefined);
    // 탐험 난수가 아무리 낮아도 만남을 정하지 않는다 — 판정이 탐험 난수를 읽으면 여기서 행상인이 나온다.
    //   (첫 추첨은 던전의 모닥불 판정이라 높게 두어 넘긴다.)
    for (const roll of [0, 0.001, 0.005, 0.011]) {
        let draws = 0;
        const low = await explore(baseState(FIELD, a), () => (draws++ === 0 ? 0.99 : roll));
        assert.equal(low.player.merchantVisit, undefined, `roll ${roll}`);
        assert.notEqual(low.currentEvent?.isWanderingMerchant, true, `roll ${roll}`);
    }
});

// ── ② 빈도 ──────────────────────────────────────────────────────────────────────

test('[빈도] 사냥 지역 탐험의 약 1.2%에서 만나고, 안전지대 · 사냥감 없는 지역에서는 만나지 않는다', () => {
    for (const loc of [FIELD, DUNGEON, '지하 미궁']) {
        let hits = 0;
        for (let explores = 0; explores < 20_000; explores += 1) {
            if (shouldMeetMerchant(playerAt(loc, explores), DB.MAPS[loc], loc)) hits += 1;
        }
        const rate = hits / 20_000;
        assert.ok(Math.abs(rate - BALANCE.WANDERING_MERCHANT_CHANCE) < 0.003, `${loc}: ${rate}`);
    }
    for (const [loc, map] of Object.entries(DB.MAPS).filter(([, entry]) => entry.type === 'safe' || !(entry.monsters || []).length)) {
        for (let explores = 0; explores < 2_000; explores += 1) {
            assert.equal(shouldMeetMerchant(playerAt(loc, explores), map, loc), false, loc);
        }
    }
    assert.ok(getMerchantRoll(playerAt(FIELD, 1), FIELD) >= 0 && getMerchantRoll(playerAt(FIELD, 1), FIELD) < 1);
});

// ── ③ 재고 ──────────────────────────────────────────────────────────────────────

test('[재고] 만날 때마다 바뀌고, 같은 자리에서는 같다 — 소모품 둘 · 쓸 데 있는 재료 · 이 등급 장비, 약 35%에 희귀 한 칸', () => {
    const stockAt = (explores, loc = DUNGEON, job = '전사') => buildMerchantStock(playerAt(loc, explores, { job }), loc);
    assert.deepEqual(stockAt(42), stockAt(42), '재굴림 불가 — 같은 탐험 수 · 지역이면 같은 재고');
    let changed = 0;
    let rare = 0;
    const tier = getShopMaxTier(DUNGEON);
    const usefulMaterials = new Set([
        ...DB.ITEMS.recipes.filter((recipe) => {
            const output = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((item) => item.name === recipe.name);
            return output && (output.tier || 1) <= tier;
        }).flatMap((recipe) => recipe.inputs.map((input) => input.name)),
        ...(getNextBagRecipe(undefined)?.inputs || []).map((input) => input.name),
    ]);
    for (let explores = 0; explores < 1_000; explores += 1) {
        const stock = stockAt(explores);
        if (JSON.stringify(stock) !== JSON.stringify(stockAt(explores + 1))) changed += 1;
        assert.ok(stock.length === 4 || stock.length === 5, `칸 수 ${stock.length}`);
        assert.equal(new Set(stock.map((slot) => slot.name)).size, stock.length, '같은 물건 두 칸 없음');
        const items = stock.map((slot) => ({ slot, item: [...DB.ITEMS.consumables, ...DB.ITEMS.materials, ...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((entry) => entry.name === slot.name) }));
        for (const { slot, item } of items) {
            assert.ok(item, slot.name);
            assert.equal(slot.sold, false);
            const isGear = ['weapon', 'armor', 'shield'].includes(item.type);
            if (isGear) {
                assert.ok(!Array.isArray(item.jobs) || item.jobs.length === 0 || item.jobs.includes('전사'), `${slot.name}: 이 직업이 쓸 수 있다`);
                assert.equal(item.tier || 1, slot.rare ? tier + 1 : tier, `${slot.name}: 등급`);
            }
            if (!slot.rare) {
                assert.equal(slot.price, Math.ceil(item.price * BALANCE.WANDERING_MERCHANT_PRICE_MULT), `${slot.name}: 떠돌이 할증`);
                if (item.type === 'mat') assert.ok(usefulMaterials.has(item.name), `${slot.name}: 쓸 데 있는 재료`);
            } else if (isGear) {
                assert.equal(slot.price, Math.ceil(item.price * BALANCE.WANDERING_MERCHANT_RARE_PRICE_MULT));
            } else {
                assert.equal(item.name, '강화 재료');
                assert.equal(slot.price, Math.max(item.price * BALANCE.WANDERING_MERCHANT_RARE_PRICE_MULT, DB.MAPS[DUNGEON].level * BALANCE.WANDERING_MERCHANT_RARE_MATERIAL_PRICE_PER_LEVEL));
            }
        }
        if (stock.some((slot) => slot.rare)) rare += 1;
    }
    assert.ok(changed >= 950, `연속한 만남의 재고가 다르다: ${changed}/1000`);
    assert.ok(Math.abs(rare / 1_000 - BALANCE.WANDERING_MERCHANT_RARE_CHANCE) < 0.05, `희귀 비율 ${rare / 1_000}`);
    // 레벨 1 숲에서는 비싼 소모품을 팔지 않는다.
    for (let explores = 0; explores < 300; explores += 1) {
        for (const slot of buildMerchantStock(playerAt(FIELD, explores, { level: 1 }), FIELD)) {
            const item = DB.ITEMS.consumables.find((entry) => entry.name === slot.name);
            if (item) assert.ok(item.price <= BALANCE.WANDERING_MERCHANT_CONSUMABLE_PRICE_FLOOR, `${slot.name} ${item.price}`);
        }
    }
});

// ── ④ 실제 탐험 경로 ──────────────────────────────────────────────────────────────

test('[탐험] 행상인을 만나는 탐험은 만남 카드를 띄우고 이번 만남의 재고를 싣는다', async () => {
    const explores = findExplores(FIELD, true, 100);
    const after = await explore(baseState(FIELD, explores), counting());
    assert.equal(after.gameState, GS.EVENT);
    assert.equal(after.currentEvent?.isWanderingMerchant, true);
    assert.deepEqual(after.player.merchantVisit, { loc: FIELD, stock: buildMerchantStock(baseState(FIELD, explores).player, FIELD) });
    assert.equal(after.currentEvent.merchantStock.count, after.player.merchantVisit.stock.length);
});

test('[우선순위] 구역 보스 도전 카드가 만남보다 먼저다', async () => {
    const loc = '기계 폐도';
    const explores = findExplores(loc, true, 100);
    const state = baseState(loc, explores);
    const full = { ...state, player: { ...state.player, stats: { ...state.player.stats, bossGauge: { [loc]: 1 } } } };
    const after = await explore(full, counting());
    assert.equal(after.currentEvent?.isBossGaugeChallenge, true);
    assert.equal(after.player.merchantVisit, undefined);
});

// ── ⑤ 사고팔기 ───────────────────────────────────────────────────────────────────

const meet = (loc = DUNGEON, explores = findExplores(DUNGEON, true, 100), extra = {}) => {
    const state = baseState(loc, explores, extra);
    const stock = buildMerchantStock(state.player, loc);
    return {
        ...state,
        gameState: GS.EVENT,
        currentEvent: buildMerchantEvent(stock),
        player: startMerchantVisit(state.player, loc, stock),
    };
};

test('[사고팔기] 살펴보기 → 행상인 상점, 산 칸은 다시 살 수 없고, 판매가는 마을 상점과 같으며, 떠나면 끝난다', () => {
    let state = choose(meet(), 0);
    assert.equal(state.gameState, GS.SHOP);
    assert.equal(state.currentEvent, null);
    const slot = state.player.merchantVisit.stock.find((entry) => !['weapon', 'armor', 'shield'].includes(DB.ITEMS.weapons.concat(DB.ITEMS.armors).find((i) => i.name === entry.name)?.type));
    const goldBefore = state.player.gold;
    state = buy(state, slot.name);
    assert.equal(state.player.gold, goldBefore - slot.price);
    assert.ok(state.player.inv.some((item) => item.name === slot.name));
    assert.equal(state.player.merchantVisit.stock.find((entry) => entry.name === slot.name).sold, true);
    const again = buy(state, slot.name);
    assert.equal(again.player.gold, state.player.gold, '산 칸은 다시 살 수 없다');
    assert.ok(again.logs.some((log) => log.text === MSG.MERCHANT_BUY_UNAVAILABLE));
    assert.equal(buy(state, '없는 물건').player.gold, state.player.gold);
    // 판매 — 마을 상점과 같은 판매가.
    const sold = state.player.inv.find((item) => item.name === slot.name);
    const afterSell = gameReducer(state, { type: AT.SELL_INVENTORY_ITEM, payload: { itemId: sold.id } });
    assert.equal(afterSell.player.gold, state.player.gold + getSellPrice(sold));
    // 떠나기.
    const left = gameReducer(afterSell, { type: AT.LEAVE_MERCHANT });
    assert.equal(left.gameState, GS.IDLE);
    assert.equal(left.player.merchantVisit, undefined);
    const rest = afterSell.player.merchantVisit.stock.find((entry) => !entry.sold);
    assert.equal(buy({ ...left, gameState: GS.SHOP }, rest.name).player.gold, left.player.gold, '떠난 뒤에는 살 수 없다');
});

test('[범위] 지나치면 만남이 끝나고, 다른 지역에서는 행상인 재고로 살 수 없으며, 카드 없이 상점을 열 수 없다', () => {
    const passed = choose(meet(), 1);
    assert.equal(passed.gameState, GS.IDLE);
    assert.equal(passed.player.merchantVisit, undefined);
    const met = meet();
    const elsewhere = { ...met, gameState: GS.SHOP, currentEvent: null, player: { ...met.player, loc: '시작의 마을' } };
    assert.equal(getActiveMerchantVisit(elsewhere.player), null);
    assert.equal(buy(elsewhere, met.player.merchantVisit.stock[0].name).player.gold, elsewhere.player.gold);
    const noCard = { ...met, gameState: GS.IDLE, currentEvent: null };
    assert.equal(gameReducer(noCard, { type: AT.OPEN_MERCHANT_SHOP }), noCard);
    // 마을 상점의 구매(출처 'stock')는 그대로다.
    const town = { ...baseState('시작의 마을', 0), gameState: GS.SHOP };
    const potion = DB.ITEMS.consumables[0];
    assert.equal(buy(town, potion.name, 'stock').player.gold, town.player.gold - potion.price);
});

test('[나가는 길] 뒤로가기 · 기록 열기 · 카드 닫기로 나가도 행상인이 떠난다 — 상점 · 카드로 가는 전이는 만남을 남긴다', () => {
    const inShop = choose(meet(), 0);
    // 뒤로가기(close-focus-panel) · 기록 열기(openArchive)는 SET_GAME_STATE(idle)이다.
    const back = gameReducer(inShop, { type: AT.SET_GAME_STATE, payload: GS.IDLE });
    assert.equal(back.player.merchantVisit, undefined);
    assert.equal(back.logs.at(-1).text, MSG.MERCHANT_LEAVE_LOG);
    // 카드 닫기(dismissEvent)는 SET_EVENT(null) → SET_GAME_STATE(idle)이다.
    const card = meet();
    const dismissed = gameReducer(gameReducer(card, { type: AT.SET_EVENT, payload: null }), { type: AT.SET_GAME_STATE, payload: GS.IDLE });
    assert.equal(dismissed.player.merchantVisit, undefined);
    assert.equal(dismissed.logs.at(-1).text, MSG.MERCHANT_LEAVE_LOG);
    // 상점 · 카드로 가는 전이는 만남을 지우지 않는다(탐험이 만남을 실은 뒤 카드로 넘어간다).
    assert.deepEqual(gameReducer(inShop, { type: AT.SET_GAME_STATE, payload: GS.SHOP }).player.merchantVisit, inShop.player.merchantVisit);
    assert.deepEqual(gameReducer(card, { type: AT.SET_GAME_STATE, payload: GS.EVENT }).player.merchantVisit, card.player.merchantVisit);
    // 행상인 상점 머리글에는 기록(가방) 열기 단추가 없다 — 누르면 행상인이 떠나기 때문이다.
    const render = (state) => renderStatic(createElement(ShopPanel, {
        player: state.player,
        actions: { market: () => {}, leaveMerchant: () => {}, economyReceipt: null, clearEconomyReceipt: () => {} },
        shopItems: [], setGameState: () => {}, stats: calculateFullStats(state.player), onOpenArchiveConsole: () => {},
    }));
    assert.equal(render(inShop).includes('data-testid="shop-open-archive"'), false);
    const town = { ...baseState('시작의 마을', 0), gameState: GS.SHOP };
    assert.ok(render(town).includes('data-testid="shop-open-archive"'));
});

test('[영구 아님] 만남은 사망 · 계승을 넘지 않는다', () => {
    const permanent = pickPermanentPlayerState(meet().player, structuredClone(INITIAL_STATE.player));
    assert.equal(permanent.merchantVisit, undefined);
});

// ── 화면 ───────────────────────────────────────────────────────────────────────

test('[화면] 만남 카드 미리보기와 행상인 상점 — 이번 만남의 재고 · 희귀 표시, 할인 상품 없음', () => {
    const state = meet();
    const stock = state.player.merchantVisit.stock;
    const rareCount = stock.filter((slot) => slot.rare).length;
    assert.equal(getEventChoicePreview(state.currentEvent, 0).text, MSG.MERCHANT_PREVIEW_BROWSE(stock.length, rareCount));
    assert.equal(getEventChoicePreview(state.currentEvent, 1).text, MSG.MERCHANT_PREVIEW_PASS);
    const html = renderStatic(createElement(ShopPanel, {
        player: state.player,
        actions: { market: () => {}, leaveMerchant: () => {}, economyReceipt: null, clearEconomyReceipt: () => {} },
        shopItems: [],
        setGameState: () => {},
        stats: calculateFullStats(state.player),
        onOpenArchiveConsole: () => {},
    }));
    assert.ok(html.includes('data-testid="merchant-shelf"'));
    assert.equal((html.match(/data-testid="merchant-offer"/g) || []).length, stock.length);
    assert.ok(html.includes(MSG.MERCHANT_TITLE));
    assert.equal(html.includes('오늘의 할인'), false);
    if (rareCount) assert.ok(html.includes(MSG.MERCHANT_RARE_BADGE));
});
