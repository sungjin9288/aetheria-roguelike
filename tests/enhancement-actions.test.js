import test from 'node:test';
import assert from 'node:assert/strict';

import { createInventoryActions } from '../src/hooks/useInventoryActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { equipmentActionMap } from '../src/reducers/handlers/equipmentHandlers.js';

const makePlayer = () => ({
    gold: 500,
    inv: [{ id: 'mat-1', name: '강화 재료', type: 'mat' }],
    equip: {
        weapon: { id: 'weapon-1', name: '강철 롱소드', type: 'weapon', val: 25, enhance: 0 },
        armor: null,
        offhand: null,
    },
});

test('enhancement reducer applies canonical cost and level atomically only once', () => {
    const state = {
        player: makePlayer(),
        gameState: 'idle',
        logs: [],
        quickSlots: [null, null, null],
        syncStatus: 'synced',
    };
    const action = {
        type: AT.ENHANCE_ITEM,
        payload: {
            itemId: 'weapon-1',
            slot: 'weapon',
            expectedItemIdentity: 'weapon-1',
            expectedLevel: 0,
            expectedGold: 500,
            roll: 0,
            relicRoll: 0.5,
        },
    };

    const enhanced = equipmentActionMap.ENHANCE_ITEM(state, action);
    const replayed = equipmentActionMap.ENHANCE_ITEM(enhanced, action);

    assert.equal(enhanced.player.gold, 350);
    assert.equal(enhanced.player.inv.length, 0);
    assert.equal(enhanced.player.equip.weapon.enhance, 1);
    assert.equal(replayed, enhanced);
});

test('enhancement rapid input is collapsed by the reducer snapshot token', () => {
    const dispatched = [];
    const buildActions = (player) => createInventoryActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatched.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({}),
    });
    const player = makePlayer();

    buildActions(player).enhanceItem('weapon-1');
    buildActions(player).enhanceItem('weapon-1');

    assert.equal(dispatched.length, 2);
    assert.equal(dispatched[0].type, AT.ENHANCE_ITEM);
    assert.equal(dispatched[0].payload.expectedGold, dispatched[1].payload.expectedGold);

    const state = {
        player,
        gameState: 'idle',
        logs: [],
        quickSlots: [null, null, null],
        syncStatus: 'synced',
    };
    const first = equipmentActionMap.ENHANCE_ITEM(state, dispatched[0]);
    const replayed = equipmentActionMap.ENHANCE_ITEM(first, dispatched[1]);
    assert.equal(replayed, first);
});
