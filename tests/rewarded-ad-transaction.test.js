import assert from 'node:assert/strict';
import test from 'node:test';

import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { createGameStorage } from '../src/platform/gameStorage.ts';
import { migrateData } from '../src/utils/dataMigration.ts';
import { startExpedition } from '../src/utils/expeditionLedger.ts';
import {
    isMeaningfulSafeReturn,
    normalizeReturnSupplyRewardLedger,
} from '../src/utils/returnSupplyReward.ts';

const summary = (overrides = {}) => ({
    id: 'expedition-1-1',
    returnReason: 'safe_return',
    battles: 1,
    explores: 0,
    ...overrides,
});

const stateWithSummary = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        lastExpeditionSummary: summary(),
        inv: [],
        ...overrides,
    },
});

const earn = (state, payload = { expeditionId: 'expedition-1-1' }) => gameReducer(state, {
    type: AT.RECORD_RETURN_SUPPLY_REWARD,
    payload,
});

const makeAsyncStorage = () => {
    const values = new Map();
    return {
        async getItem(key) { return values.get(key) ?? null; },
        async setItem(key, value) { values.set(key, value); },
        async removeItem(key) { values.delete(key); },
    };
};

test('return supply requires a meaningful safe expedition', () => {
    assert.equal(isMeaningfulSafeReturn(summary()), true);
    assert.equal(isMeaningfulSafeReturn(summary({ battles: 0, explores: 1 })), true);
    assert.equal(isMeaningfulSafeReturn(summary({ battles: 0, explores: 0 })), false);
    assert.equal(isMeaningfulSafeReturn(null), false);
});

test('earned reward atomically grants exactly one canonical potion and replay is exact no-op', () => {
    const initial = stateWithSummary();
    const earned = earn(initial, {
        expeditionId: 'expedition-1-1',
        unitType: 'legendary_weapon',
        unitAmount: 999,
    });
    assert.equal(earned.player.inv.length, 1);
    assert.deepEqual(earned.player.inv[0], {
        name: '하급 체력 물약',
        val: 50,
        type: 'hp',
        price: 30,
        desc: 'HP 50 회복',
        desc_stat: 'HP+50',
        id: 'return-supply:expedition-1-1',
    });
    assert.equal(earned.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
    assert.equal(earned.logs.filter((log) => log.id === 'return-supply:expedition-1-1').length, 1);
    assert.strictEqual(earn(earned), earned);
});

test('mismatched, missing, or meaningless summaries reject the reward', () => {
    const initial = stateWithSummary();
    assert.strictEqual(earn(initial, { expeditionId: 'forged' }), initial);
    const noSummary = stateWithSummary({ lastExpeditionSummary: null });
    assert.strictEqual(earn(noSummary), noSummary);
    const empty = stateWithSummary({ lastExpeditionSummary: summary({ battles: 0, explores: 0 }) });
    assert.strictEqual(earn(empty), empty);
});

test('full inventory persists pending receipt and the next accepted slot-opening action delivers once', () => {
    const fullInventory = Array.from({ length: 20 }, (_, index) => ({
        name: `item-${index}`,
        type: 'mat',
        id: `item-${index}`,
    }));
    const pending = earn(stateWithSummary({ inv: fullInventory }));
    assert.equal(pending.player.inv.length, 20);
    assert.equal(pending.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'pending');
    const synced = gameReducer(pending, { type: AT.SET_SYNC_STATUS, payload: 'synced' });
    assert.equal(synced.syncStatus, 'synced');
    assert.strictEqual(synced.player, pending.player);

    const delivered = gameReducer(pending, {
        type: AT.SET_PLAYER,
        payload: { inv: pending.player.inv.slice(1) },
    });
    assert.equal(delivered.player.inv.length, 20);
    assert.equal(delivered.player.inv.at(-1).id, 'return-supply:expedition-1-1');
    assert.equal(delivered.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
    assert.equal(delivered.logs.filter((log) => log.id === 'return-supply:expedition-1-1').length, 1);
});

test('multiple pending receipts deliver in deterministic order without crossing inventory capacity', () => {
    const initial = stateWithSummary({
        maxInv: 2,
        returnSupplyRewards: {
            version: 1,
            receipts: {
                'expedition-z': { status: 'pending' },
                'expedition-a': { status: 'pending' },
                'expedition-m': { status: 'pending' },
            },
        },
    });
    const delivered = gameReducer(initial, { type: AT.SET_PLAYER, payload: { gold: 1 } });
    assert.deepEqual(delivered.player.inv.map((item) => item.id), [
        'return-supply:expedition-a',
        'return-supply:expedition-m',
    ]);
    assert.equal(delivered.player.returnSupplyRewards.receipts['expedition-a'].status, 'delivered');
    assert.equal(delivered.player.returnSupplyRewards.receipts['expedition-m'].status, 'delivered');
    assert.equal(delivered.player.returnSupplyRewards.receipts['expedition-z'].status, 'pending');
});

test('pending receipt with its deterministic item heals to delivered without duplication', () => {
    const player = stateWithSummary({
        inv: [{ name: '하급 체력 물약', type: 'hp', id: 'return-supply:expedition-1-1' }],
        returnSupplyRewards: { version: 1, receipts: { 'expedition-1-1': { status: 'pending' } } },
    });
    const healed = gameReducer(player, { type: AT.SET_PLAYER, payload: { gold: 1 } });
    assert.equal(healed.player.inv.length, 1);
    assert.equal(healed.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
});

test('save migration preserves delivered receipts and safely normalizes corrupt ledgers', () => {
    const delivered = earn(stateWithSummary());
    const migrated = migrateData({ version: 5, player: delivered.player });
    assert.equal(migrated.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
    const loaded = gameReducer(stateWithSummary(), { type: AT.LOAD_DATA, payload: migrated });
    assert.equal(loaded.player.inv.filter((item) => item.id === 'return-supply:expedition-1-1').length, 1);
    assert.deepEqual(normalizeReturnSupplyRewardLedger({
        version: 99,
        receipts: {
            valid: { status: 'pending' },
            broken: { status: 'forged' },
            ' ': { status: 'delivered' },
        },
    }), { version: 1, receipts: { valid: { status: 'pending' } } });
});

test('persisted full-bag receipt survives restart and delivers once after space opens', async () => {
    const fullInventory = Array.from({ length: 20 }, (_, index) => ({
        name: `item-${index}`,
        type: 'mat',
        id: `item-${index}`,
    }));
    const pending = earn(stateWithSummary({ inv: fullInventory }));
    const backend = makeAsyncStorage();
    const storage = createGameStorage({ backend, now: () => 4_000, saveVersion: 5 });

    await storage.save({ version: 5, player: pending.player, gameState: pending.gameState });
    const record = await storage.load();
    assert.ok(record);
    const restored = gameReducer(structuredClone(INITIAL_STATE), {
        type: AT.LOAD_DATA,
        payload: migrateData(record.payload),
    });
    assert.equal(restored.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'pending');
    assert.equal(restored.player.inv.length, 20);

    const delivered = gameReducer(restored, {
        type: AT.SET_PLAYER,
        payload: { inv: restored.player.inv.slice(1) },
    });
    assert.equal(delivered.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
    assert.equal(delivered.player.inv.filter((item) => item.id === 'return-supply:expedition-1-1').length, 1);

    const replayed = gameReducer(delivered, { type: AT.SET_PLAYER, payload: { gold: 1 } });
    assert.equal(replayed.player.inv.filter((item) => item.id === 'return-supply:expedition-1-1').length, 1);
});

test('expedition IDs remain unique when starts reuse the same timestamp', () => {
    const first = startExpedition({ ...INITIAL_STATE.player, activeExpedition: null }, '고요한 숲', 1_000, []);
    const second = startExpedition({ ...first, activeExpedition: null }, '고요한 숲', 1_000, []);
    assert.equal(first.activeExpedition.id, 'expedition-1000-1');
    assert.equal(second.activeExpedition.id, 'expedition-1000-2');
    assert.notEqual(first.activeExpedition.id, second.activeExpedition.id);
});

test('reset and ascension preserve reward receipts and monotonic expedition sequence', () => {
    const pendingState = stateWithSummary({
        expeditionSequence: 42,
        inv: Array.from({ length: 20 }, (_, index) => ({ id: `full-${index}`, type: 'mat' })),
    });
    const pending = earn(pendingState);

    const reset = gameReducer(pending, { type: AT.RESET_GAME });
    assert.equal(reset.player.expeditionSequence, 42);
    assert.equal(reset.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
    assert.equal(reset.player.inv.filter((item) => item.id === 'return-supply:expedition-1-1').length, 1);

    const ascended = gameReducer(pending, {
        type: AT.ASCEND,
        payload: { meta: pending.player.meta, newTitle: '테스트 칭호' },
    });
    assert.equal(ascended.player.expeditionSequence, 42);
    assert.equal(ascended.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
    assert.equal(ascended.player.inv.filter((item) => item.id === 'return-supply:expedition-1-1').length, 1);

    const resetDelivered = gameReducer(reset, { type: AT.RESET_GAME });
    assert.equal(resetDelivered.player.returnSupplyRewards.receipts['expedition-1-1'].status, 'delivered');
    assert.equal(resetDelivered.player.inv.some((item) => item.id === 'return-supply:expedition-1-1'), false);
});
