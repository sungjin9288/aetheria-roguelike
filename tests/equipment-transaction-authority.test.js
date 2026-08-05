import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { createInventoryActions } from '../src/hooks/useInventoryActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { equipmentActionMap } from '../src/reducers/handlers/equipmentHandlers.js';

const makePlayer = (overrides = {}) => ({
    name: '리베이아',
    job: '모험가',
    level: 10,
    hp: 50,
    maxHp: 100,
    mp: 30,
    maxMp: 50,
    gold: 500,
    inv: [],
    equip: {
        weapon: { id: 'starter-weapon', name: '시작의 검', type: 'weapon', val: 5, enhance: 0 },
        armor: { id: 'starter-armor', name: '여행자 틜닉', type: 'armor', val: 3, enhance: 0 },
        offhand: null,
    },
    status: [],
    tempBuff: { atk: 0, def: 0, turn: 0, name: null },
    stats: {},
    titles: [],
    ...overrides,
});

const makeState = (player, overrides = {}) => ({
    player,
    gameState: 'idle',
    logs: [],
    quickSlots: [null, null, null],
    syncStatus: 'synced',
    ...overrides,
});

test('sequential equipment choices commit against the latest inventory', () => {
    const firstArmor = { id: 'armor-a', name: '정찰병의 갑옷', type: 'armor', val: 12 };
    const secondArmor = { id: 'armor-b', name: '수호자의 갑옷', type: 'armor', val: 18 };
    const state = makeState(makePlayer({ inv: [firstArmor, secondArmor] }));

    const afterFirst = equipmentActionMap.USE_INVENTORY_ITEM(state, {
        type: AT.USE_INVENTORY_ITEM,
        payload: { itemId: firstArmor.id },
    });
    const afterSecond = equipmentActionMap.USE_INVENTORY_ITEM(afterFirst, {
        type: AT.USE_INVENTORY_ITEM,
        payload: { itemId: secondArmor.id },
    });

    assert.equal(afterSecond.player.equip.armor.id, secondArmor.id);
    assert.deepEqual(
        afterSecond.player.inv.map((item) => item.id).sort(),
        ['armor-a', 'starter-armor'],
    );
    assert.equal(afterSecond.logs.filter((log) => log.text.endsWith('장착.')).length, 2);
});

test('a replayed consumable action is an exact no-op after the item is consumed', () => {
    const potion = { id: 'potion-1', name: '회복 물약', type: 'hp', val: 30 };
    const state = makeState(makePlayer({ hp: 25, inv: [potion] }), {
        quickSlots: [potion, null, null],
    });
    const action = { type: AT.USE_INVENTORY_ITEM, payload: { itemId: potion.id } };

    const consumed = equipmentActionMap.USE_INVENTORY_ITEM(state, action);
    const replayed = equipmentActionMap.USE_INVENTORY_ITEM(consumed, action);

    assert.equal(consumed.player.inv.length, 0);
    assert.ok(consumed.player.hp > 25);
    assert.equal(consumed.quickSlots[0], null);
    assert.equal(replayed, consumed);
});

test('a two-hand swap is rejected when returned equipment would overflow the bag', () => {
    const twoHand = { id: 'greatsword', name: '거인의 대검', type: 'weapon', hands: 2, val: 30 };
    const filler = { id: 'filler', name: '돌조각', type: 'mat' };
    const player = makePlayer({
        maxInv: 2,
        inv: [twoHand, filler],
        equip: {
            weapon: { id: 'main', name: '주손검', type: 'weapon', hands: 1, val: 12 },
            offhand: { id: 'offhand', name: '보조검', type: 'weapon', hands: 1, val: 8 },
            armor: null,
        },
    });
    const state = makeState(player);

    const rejected = equipmentActionMap.USE_INVENTORY_ITEM(state, {
        type: AT.USE_INVENTORY_ITEM,
        payload: { itemId: twoHand.id },
    });

    assert.equal(rejected.player, state.player);
    assert.match(rejected.logs.at(-1).text, /가방이 가득/);
});

test('enhancement resolves canonical cost, material, and success from entropy', () => {
    const material = { id: 'mat-1', name: CONSTANTS.ENHANCE_MATERIAL_NAME, type: 'mat' };
    const state = makeState(makePlayer({ inv: [material] }));
    const action = {
        type: AT.ENHANCE_ITEM,
        payload: {
            itemId: 'starter-weapon',
            slot: 'weapon',
            expectedItemIdentity: 'starter-weapon',
            expectedLevel: 0,
            expectedGold: 500,
            roll: 0,
            relicRoll: 0.5,
            success: false,
            goldCost: 0,
            materialName: '위조 재료',
            materialCount: 0,
        },
    };

    const enhanced = equipmentActionMap.ENHANCE_ITEM(state, action);
    const replayed = equipmentActionMap.ENHANCE_ITEM(enhanced, action);

    assert.equal(enhanced.player.gold, 500 - BALANCE.ENHANCE_COSTS[0]);
    assert.equal(enhanced.player.inv.length, 0);
    assert.equal(enhanced.player.equip.weapon.enhance, 1);
    assert.match(enhanced.logs.at(-1).text, /\uac15\ud654 \uc131\uacf5/);
    assert.equal(replayed, enhanced);
});

test('a failed enhancement replay cannot consume a second payment', () => {
    const materials = [1, 2].map((index) => ({
        id: `mat-${index}`,
        name: CONSTANTS.ENHANCE_MATERIAL_NAME,
        type: 'mat',
    }));
    const state = makeState(makePlayer({ inv: materials }));
    const action = {
        type: AT.ENHANCE_ITEM,
        payload: {
            itemId: 'starter-weapon',
            slot: 'weapon',
            expectedItemIdentity: 'starter-weapon',
            expectedLevel: 0,
            expectedGold: 500,
            roll: 0.999999,
            relicRoll: 0.5,
        },
    };

    const failed = equipmentActionMap.ENHANCE_ITEM(state, action);
    const replayed = equipmentActionMap.ENHANCE_ITEM(failed, action);

    assert.equal(failed.player.gold, 500 - BALANCE.ENHANCE_COSTS[0]);
    assert.equal(failed.player.inv.length, 1);
    assert.equal(failed.player.equip.weapon.enhance, 0);
    assert.equal(failed.logs.filter((log) => /\uac15\ud654 \uc2e4\ud328/.test(log.text)).length, 1);
    assert.equal(replayed, failed);
});

test('enhancement derives its slot from the current target instead of payload', () => {
    const inventoryWeapon = { id: 'inventory-weapon', name: '보관 중인 검', type: 'weapon', val: 20, enhance: 0 };
    const material = { id: 'mat-1', name: CONSTANTS.ENHANCE_MATERIAL_NAME, type: 'mat' };
    const state = makeState(makePlayer({ inv: [inventoryWeapon, material] }));

    const enhanced = equipmentActionMap.ENHANCE_ITEM(state, {
        type: AT.ENHANCE_ITEM,
        payload: {
            itemId: inventoryWeapon.id,
            slot: 'weapon',
            expectedItemIdentity: inventoryWeapon.id,
            expectedLevel: 0,
            expectedGold: 500,
            roll: 0,
            relicRoll: 0.5,
        },
    });

    assert.equal(enhanced.player.inv.find((item) => item.id === inventoryWeapon.id).enhance, 1);
    assert.equal(enhanced.player.equip.weapon.enhance, 0);
});

test('equipment hooks send identity and entropy without replacing player snapshots', () => {
    const dispatched = [];
    const armor = { id: 'armor-1', name: '수련의 갑옷', type: 'armor', val: 10 };
    const player = makePlayer({
        inv: [
            armor,
            { id: 'mat-1', name: CONSTANTS.ENHANCE_MATERIAL_NAME, type: 'mat' },
        ],
    });
    const actions = createInventoryActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatched.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({}),
    });

    actions.useItem(armor);
    actions.enhanceItem('starter-weapon');

    assert.deepEqual(dispatched.map((action) => action.type), [
        AT.USE_INVENTORY_ITEM,
        AT.ENHANCE_ITEM,
    ]);
    assert.deepEqual(dispatched[0].payload, { itemId: armor.id });
    assert.equal(dispatched[1].payload.itemId, 'starter-weapon');
    assert.equal(dispatched[1].payload.expectedGold, 500);
    assert.equal(typeof dispatched[1].payload.roll, 'number');
    assert.equal('slot' in dispatched[1].payload, false);
    assert.equal('success' in dispatched[1].payload, false);
    assert.equal('goldCost' in dispatched[1].payload, false);
    assert.equal(dispatched.some((action) => action.type === AT.SET_PLAYER), false);
});
