import test from 'node:test';
import assert from 'node:assert/strict';

import { createInventoryActions } from '../src/hooks/useInventoryActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { rewardActionMap } from '../src/reducers/handlers/rewardHandlers.js';

const makePlayer = () => ({
    gold: 500,
    inv: [{ id: 'mat-1', name: '강화 재료', type: 'mat' }],
    equip: {
        weapon: { id: 'weapon-1', name: '강철 롱소드', type: 'weapon', val: 25, enhance: 0 },
        armor: null,
        offhand: null,
    },
});

test('enhancement reducer applies cost and level atomically only once', () => {
    const state = { player: makePlayer(), syncStatus: 'synced' };
    const action = {
        type: AT.ENHANCE_ITEM,
        payload: {
            itemId: 'weapon-1',
            slot: 'weapon',
            success: true,
            expectedLevel: 0,
            goldCost: 150,
            materialName: '강화 재료',
            materialCount: 1,
        },
    };

    const enhanced = rewardActionMap.ENHANCE_ITEM(state, action);
    const replayed = rewardActionMap.ENHANCE_ITEM(enhanced, action);

    assert.equal(enhanced.player.gold, 350);
    assert.equal(enhanced.player.inv.length, 0);
    assert.equal(enhanced.player.equip.weapon.enhance, 1);
    assert.equal(replayed, enhanced);
});

test('enhancement action lock survives action recreation during rapid input', () => {
    const dispatched = [];
    const lock = { until: 0 };
    const buildActions = (player) => createInventoryActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatched.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({}),
        enhanceAttemptLock: lock,
    });
    const player = makePlayer();

    buildActions(player).enhanceItem('weapon-1');
    buildActions(player).enhanceItem('weapon-1');

    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, AT.ENHANCE_ITEM);
});
