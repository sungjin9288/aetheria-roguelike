import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { SEASON_XP } from '../src/data/seasonPass.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getCurrentDailyProtocol } from '../src/utils/protocolCycle.js';
import { getDailyDeals } from '../src/utils/shopRotation.js';

const makeState = (gameState, playerOverrides = {}, stateOverrides = {}) => {
    const base = structuredClone(INITIAL_STATE);
    return {
        ...base,
        ...stateOverrides,
        gameState,
        player: {
            ...base.player,
            ...playerOverrides,
            stats: {
                ...base.player.stats,
                ...(playerOverrides.stats || {}),
            },
        },
    };
};

const makeInventoryItem = (template, id) => ({ ...template, id });

test('shop purchase resolves the canonical offer and ignores a replay from the same render', () => {
    const item = DB.ITEMS.weapons.find((entry) => entry.tier === 1 && (entry.price || 0) > 0);
    assert.ok(item?.name);

    const gold = (item.price || 0) + 1_000;
    const dailyProtocol = getCurrentDailyProtocol(INITIAL_STATE.player, new Date());
    const state = makeState(GS.SHOP, {
        gold,
        inv: [],
        stats: { dailyProtocol },
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
    });
    const action = {
        type: AT.BUY_SHOP_ITEM,
        payload: {
            source: 'stock',
            itemName: item.name,
            expectedGold: gold,
            expectedInventorySize: 0,
            price: 0,
            relicRoll: 0,
        },
    };

    const purchased = gameReducer(state, action);
    const replayed = gameReducer(purchased, action);

    assert.equal(purchased.player.gold, gold - item.price);
    assert.equal(purchased.player.inv.length, 1);
    assert.equal(purchased.player.inv[0].name, item.name);
    assert.notEqual(purchased.player.inv[0].id, item.id);
    assert.equal(purchased.player.seasonPass.xp, SEASON_XP.codexDiscover);
    assert.equal(
        purchased.player.stats.dailyProtocol.missions.find((mission) => mission.type === 'goldSpend').progress,
        item.price,
    );
    assert.equal(purchased.logs.filter((log) => log.text.includes('구매 완료')).length, 1);
    assert.equal(replayed, purchased);
    assert.equal(gameReducer(purchased, { type: AT.SET_GAME_STATE, payload: GS.IDLE }).economyReceipt, null);
});

test('daily deal charges its canonical discount but stores the item at its base value', () => {
    const deal = getDailyDeals(1).items[0];
    assert.ok(deal?.name && deal.originalPrice > deal.price);
    const state = makeState(GS.SHOP, {
        job: Array.isArray(deal.jobs) ? deal.jobs[0] : '모험가',
        level: 1,
        gold: 5_000,
        inv: [],
    });

    const purchased = gameReducer(state, {
        type: AT.BUY_SHOP_ITEM,
        payload: {
            source: 'daily',
            itemName: deal.name,
            expectedGold: 5_000,
            expectedInventorySize: 0,
            relicRoll: 0,
        },
    });

    assert.equal(purchased.player.gold, 5_000 - deal.price);
    assert.equal(purchased.player.inv[0].name, deal.name);
    assert.equal(purchased.player.inv[0].price, deal.originalPrice);
    assert.equal('originalPrice' in purchased.player.inv[0], false);
});

test('sequential sales commit against the latest inventory without resurrecting prior items', () => {
    const template = DB.ITEMS.materials.find((entry) => (entry.price || 0) > 0);
    assert.ok(template?.name);
    const first = makeInventoryItem(template, 'sell-first');
    const second = makeInventoryItem(template, 'sell-second');
    const state = makeState(GS.SHOP, {
        gold: 100,
        inv: [first, second],
    }, {
        quickSlots: [first, second, null],
    });

    const soldFirst = gameReducer(state, {
        type: AT.SELL_INVENTORY_ITEM,
        payload: { itemId: first.id },
    });
    const soldSecond = gameReducer(soldFirst, {
        type: AT.SELL_INVENTORY_ITEM,
        payload: { itemId: second.id },
    });
    const replayed = gameReducer(soldSecond, {
        type: AT.SELL_INVENTORY_ITEM,
        payload: { itemId: first.id },
    });
    const sellPrice = Math.floor((template.price || 0) * 0.5);

    assert.deepEqual(soldSecond.player.inv, []);
    assert.equal(soldSecond.player.gold, 100 + sellPrice * 2);
    assert.equal(soldSecond.player.stats.total_gold, sellPrice * 2);
    assert.deepEqual(soldSecond.quickSlots, [null, null, null]);
    assert.equal(soldSecond.logs.filter((log) => log.text.includes('판매')).length, 2);
    assert.equal(replayed, soldSecond);
});

test('crafting consumes identified materials and commits progression in one transition', () => {
    const recipe = DB.ITEMS.recipes.find((entry) => entry.id === 'r5');
    const material = DB.ITEMS.materials.find((entry) => entry.name === recipe.inputs[0].name);
    assert.ok(recipe && material);
    const inputs = Array.from(
        { length: recipe.inputs[0].qty },
        (_, index) => makeInventoryItem(material, `craft-${index}`),
    );
    const dailyProtocol = getCurrentDailyProtocol(INITIAL_STATE.player, new Date());
    const state = makeState(GS.CRAFTING, {
        gold: 500,
        inv: inputs,
        stats: { dailyProtocol },
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
    }, {
        quickSlots: [inputs[0], null, null],
    });
    const action = {
        type: AT.CRAFT_RECIPE,
        payload: {
            recipeId: recipe.id,
            inputIds: inputs.map((item) => item.id),
            relicRoll: 0,
        },
    };

    const crafted = gameReducer(state, action);
    const replayed = gameReducer(crafted, action);

    assert.equal(crafted.player.gold, 500 - recipe.gold);
    assert.deepEqual(crafted.player.inv.map((item) => item.name), [recipe.name]);
    assert.equal(crafted.player.stats.crafts, 1);
    assert.ok(crafted.player.stats.codex.recipes[recipe.id]);
    assert.equal(crafted.player.seasonPass.xp, SEASON_XP.craft + SEASON_XP.codexDiscover);
    assert.equal(
        crafted.player.stats.dailyProtocol.missions.find((mission) => mission.type === 'goldSpend').progress,
        recipe.gold,
    );
    assert.deepEqual(crafted.quickSlots, [null, null, null]);
    assert.equal(crafted.logs.filter((log) => log.text.includes('제작 완료')).length, 1);
    assert.equal(replayed, crafted);
});

test('synthesis uses supplied entropy once and commits the result atomically', () => {
    const template = DB.ITEMS.weapons.find((entry) => entry.tier === 1);
    assert.ok(template);
    const inputs = ['synth-a', 'synth-b', 'synth-c'].map((id) => makeInventoryItem(template, id));
    const state = makeState(GS.CRAFTING, {
        gold: 100_000,
        inv: inputs,
        stats: { syntheses: 0 },
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
    }, {
        quickSlots: [inputs[0], null, null],
    });
    const action = {
        type: AT.SYNTHESIZE_ITEMS,
        payload: {
            itemIds: inputs.map((item) => item.id),
            useProtect: false,
            successRoll: 0,
            outputRoll: 0,
        },
    };

    const synthesized = gameReducer(state, action);
    const replayed = gameReducer(synthesized, action);

    assert.equal(synthesized.player.inv.length, 1);
    assert.equal(synthesized.player.inv[0].tier, 2);
    assert.equal(synthesized.player.stats.syntheses, 1);
    assert.equal(synthesized.player.seasonPass.xp, SEASON_XP.synthesize + SEASON_XP.codexDiscover);
    assert.deepEqual(synthesized.quickSlots, [null, null, null]);
    assert.equal(synthesized.logs.filter((log) => log.text.includes('합성 성공')).length, 1);
    assert.equal(replayed, synthesized);
});

test('bulk material sale has one authoritative outcome and replay is a no-op', () => {
    const template = DB.ITEMS.materials.find((entry) => (entry.price || 0) > 0 && entry.price <= 30);
    assert.ok(template);
    const targets = ['bulk-a', 'bulk-b'].map((id) => makeInventoryItem(template, id));
    const state = makeState(GS.IDLE, {
        gold: 0,
        inv: targets,
    });

    const sold = gameReducer(state, { type: AT.AUTO_SELL_MATERIALS });
    const replayed = gameReducer(sold, { type: AT.AUTO_SELL_MATERIALS });

    assert.deepEqual(sold.player.inv, []);
    assert.equal(sold.player.gold, Math.floor(template.price * 0.5) * targets.length);
    assert.equal(sold.logs.filter((log) => log.text.includes('판매')).length, 1);
    assert.equal(replayed, sold);
});

test('economy hooks dispatch identities and entropy instead of replacing player snapshots', async () => {
    const { readFile } = await import('node:fs/promises');
    const economySource = await readFile(
        new URL('../src/hooks/useInventoryActions.economy.ts', import.meta.url),
        'utf8',
    );

    assert.ok(economySource.includes('AT.BUY_SHOP_ITEM'));
    assert.ok(economySource.includes('AT.SELL_INVENTORY_ITEM'));
    assert.ok(economySource.includes('AT.CRAFT_RECIPE'));
    assert.ok(economySource.includes('AT.SYNTHESIZE_ITEMS'));
    assert.ok(economySource.includes('AT.AUTO_SELL_MATERIALS'));
    assert.ok(!economySource.includes('AT.SET_PLAYER'));
    assert.ok(!economySource.includes('AT.ADD_SEASON_XP'));
    assert.ok(!economySource.includes('AT.UPDATE_DAILY_PROTOCOL'));
});
