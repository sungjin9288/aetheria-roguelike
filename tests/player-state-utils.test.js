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
    // cycle 187: void_heart는 '런당 1회' spec — 안전 맵 이동으로 풀려선 안 됨.
    //   이 테스트의 voidHeartUsed/Armed=true 입력은 cycle 187 변경 후 보존됨.
    assert.deepEqual(cleared.combatFlags, {
        comboCount: 0,
        deathSaveUsed: false,
        voidHeartUsed: true,   // cycle 187: 보존
        voidHeartArmed: true,  // cycle 187: 보존
    });
    assert.equal(cleared.nextHitEvaded, false);
    // hasTemporaryAdventureState는 voidHeartUsed/Armed을 "임시 상태"로 간주하므로
    // cleared 후에도 true 반환 (런-와이드 플래그 보존).
    assert.equal(hasTemporaryAdventureState(cleared), true);
});
