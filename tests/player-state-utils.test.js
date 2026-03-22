import test from 'node:test';
import assert from 'node:assert/strict';

import { clearTemporaryAdventureState, hasTemporaryAdventureState } from '../src/utils/playerStateUtils.js';

test('temporary adventure state is detected when buffs or statuses exist', () => {
    assert.equal(hasTemporaryAdventureState({
        tempBuff: { atk: 0.3, def: 0, turn: 2, name: '분노의 물약' },
        status: [],
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
        nextHitEvaded: false,
    }), true);

    assert.equal(hasTemporaryAdventureState({
        tempBuff: { atk: 0, def: 0, turn: 0, name: null },
        status: ['poison'],
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
        nextHitEvaded: false,
    }), true);
});

test('temporary adventure state is cleared on town return helper', () => {
    const cleared = clearTemporaryAdventureState({
        tempBuff: { atk: 0.3, def: 0.2, turn: 3, name: '영웅의 물약' },
        status: ['poison', 'burn'],
        combatFlags: { comboCount: 2, deathSaveUsed: true, voidHeartUsed: true, voidHeartArmed: true },
        nextHitEvaded: true,
    });

    assert.deepEqual(cleared.tempBuff, { atk: 0, def: 0, turn: 0, name: null });
    assert.deepEqual(cleared.status, []);
    assert.deepEqual(cleared.combatFlags, {
        comboCount: 0,
        deathSaveUsed: false,
        voidHeartUsed: false,
        voidHeartArmed: false,
    });
    assert.equal(cleared.nextHitEvaded, false);
    assert.equal(hasTemporaryAdventureState(cleared), false);
});
