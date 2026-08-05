import assert from 'node:assert/strict';
import test from 'node:test';

import { BALANCE } from '../src/data/constants.js';
import { MIRROR_NODES } from '../src/data/mirror.js';
import { createInventoryActions } from '../src/hooks/useInventoryActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { premiumActionMap } from '../src/reducers/handlers/premiumHandlers.js';

const makePlayer = (overrides = {}) => ({
    name: '리베이아',
    premiumCurrency: 180,
    maxInv: 25,
    reviveTokens: 0,
    titles: [],
    stats: {
        synthProtects: 0,
        cosmeticTitles: [],
    },
    meta: {
        essence: 1000,
        mirror: {},
    },
    ...overrides,
});

const makeState = (player, overrides = {}) => ({
    player,
    logs: [],
    syncStatus: 'synced',
    ...overrides,
});

test('crystal exchange resolves canonical cost and result from the offer id', () => {
    const state = makeState(makePlayer({ premiumCurrency: 80 }));
    const action = {
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: {
            offerId: 'inv_expand',
            expectedCurrency: 80,
            cost: 0,
            nextMaxInv: 999,
        },
    };

    const purchased = premiumActionMap.PURCHASE_PREMIUM_OFFER(state, action);
    const replayed = premiumActionMap.PURCHASE_PREMIUM_OFFER(purchased, action);

    assert.equal(purchased.player.premiumCurrency, 80 - BALANCE.INV_EXPAND_COST);
    assert.equal(purchased.player.maxInv, 25 + BALANCE.INV_EXPAND_AMOUNT);
    assert.equal(purchased.logs.filter((log) => log.text.includes('가방을')).length, 1);
    assert.equal(replayed, purchased);
});

test('cosmetic title exchange ignores forged title values and grants the canonical title once', () => {
    const state = makeState(makePlayer());
    const action = {
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: {
            offerId: 'title_stargazer',
            expectedCurrency: 180,
            titleName: '위조 칭호',
            cost: 0,
        },
    };

    const purchased = premiumActionMap.PURCHASE_PREMIUM_OFFER(state, action);
    const replayed = premiumActionMap.PURCHASE_PREMIUM_OFFER(purchased, action);

    assert.equal(purchased.player.premiumCurrency, 80);
    assert.deepEqual(purchased.player.stats.cosmeticTitles, ['title_stargazer']);
    assert.deepEqual(purchased.player.titles, ['별을 보는 자']);
    assert.equal(replayed, purchased);
});

test('protection and revive offers use their canonical costs and current counters', () => {
    const protectionState = makeState(makePlayer({ premiumCurrency: 50 }));
    const protectedState = premiumActionMap.PURCHASE_PREMIUM_OFFER(protectionState, {
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: { offerId: 'synth_protect', expectedCurrency: 50 },
    });
    assert.equal(protectedState.player.premiumCurrency, 50 - BALANCE.SYNTHESIS_PROTECT_COST);
    assert.equal(protectedState.player.stats.synthProtects, 1);

    const reviveState = makeState(makePlayer({ premiumCurrency: 50, reviveTokens: 2 }));
    const revivedState = premiumActionMap.PURCHASE_PREMIUM_OFFER(reviveState, {
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: { offerId: 'revive', expectedCurrency: 50 },
    });
    assert.equal(revivedState.player.premiumCurrency, 50 - BALANCE.REVIVE_COST);
    assert.equal(revivedState.player.reviveTokens, 3);
});

test('insufficient or stale crystal exchange requests are exact no-ops', () => {
    const state = makeState(makePlayer({ premiumCurrency: 10 }));

    const insufficient = premiumActionMap.PURCHASE_PREMIUM_OFFER(state, {
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: { offerId: 'inv_expand', expectedCurrency: 10 },
    });
    const stale = premiumActionMap.PURCHASE_PREMIUM_OFFER(state, {
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: { offerId: 'revive', expectedCurrency: 50 },
    });

    assert.equal(insufficient, state);
    assert.equal(stale, state);
});

test('mirror investment replay cannot buy a second level from the same view snapshot', () => {
    const state = makeState(makePlayer());
    const action = {
        type: AT.PURCHASE_MIRROR_NODE,
        payload: {
            nodeId: 'start_gold',
            expectedEssence: 1000,
            expectedLevel: 0,
            cost: 0,
        },
    };
    const node = MIRROR_NODES.find((entry) => entry.id === 'start_gold');

    const purchased = premiumActionMap.PURCHASE_MIRROR_NODE(state, action);
    const replayed = premiumActionMap.PURCHASE_MIRROR_NODE(purchased, action);

    assert.equal(purchased.player.meta.essence, 1000 - node.costs[0]);
    assert.equal(purchased.player.meta.mirror.start_gold, 1);
    assert.equal(purchased.logs.filter((log) => log.text.includes('유산의 금고')).length, 1);
    assert.equal(replayed, purchased);
});

test('mirror investment can advance again after the player receives the updated state', () => {
    const state = makeState(makePlayer());
    const firstAction = {
        type: AT.PURCHASE_MIRROR_NODE,
        payload: { nodeId: 'start_gold', expectedEssence: 1000, expectedLevel: 0 },
    };
    const first = premiumActionMap.PURCHASE_MIRROR_NODE(state, firstAction);
    const second = premiumActionMap.PURCHASE_MIRROR_NODE(first, {
        type: AT.PURCHASE_MIRROR_NODE,
        payload: {
            nodeId: 'start_gold',
            expectedEssence: first.player.meta.essence,
            expectedLevel: 1,
        },
    });

    assert.equal(second.player.meta.mirror.start_gold, 2);
    assert.ok(second.player.meta.essence < first.player.meta.essence);
});

test('premium hooks send offer identity and stale tokens without values or optimistic logs', () => {
    const dispatched = [];
    const logs = [];
    const player = makePlayer();
    const actions = createInventoryActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatched.push(action),
        addLog: (...entry) => logs.push(entry),
        addStoryLog: () => {},
        getFullStats: () => ({}),
    });

    actions.expandInventory();
    actions.purchaseCosmeticTitle('title_stargazer', '위조 칭호', 0);
    actions.purchaseMirrorNode('start_gold');

    assert.deepEqual(dispatched.map((action) => action.type), [
        AT.PURCHASE_PREMIUM_OFFER,
        AT.PURCHASE_PREMIUM_OFFER,
        AT.PURCHASE_MIRROR_NODE,
    ]);
    assert.deepEqual(dispatched[0].payload, { offerId: 'inv_expand', expectedCurrency: 180 });
    assert.deepEqual(dispatched[1].payload, { offerId: 'title_stargazer', expectedCurrency: 180 });
    assert.deepEqual(dispatched[2].payload, {
        nodeId: 'start_gold',
        expectedEssence: 1000,
        expectedLevel: 0,
    });
    assert.equal(dispatched.some((action) => action.type === AT.SET_PLAYER), false);
    assert.deepEqual(logs, []);
});
