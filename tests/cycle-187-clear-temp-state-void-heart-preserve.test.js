import test from 'node:test';
import assert from 'node:assert/strict';

import { clearTemporaryAdventureState } from '../src/utils/playerStateUtils.js';

/**
 * cycle 187: clearTemporaryAdventureState가 voidHeart run-wide 플래그 보존 (death save 회귀 fix).
 *
 * 발견:
 * - clearTemporaryAdventureState (안전 맵 이동 시 호출)는 combatFlags를 OLD
 *   DEFAULT_COMBAT_FLAGS (voidHeartUsed: false / voidHeartArmed: false)로 reset.
 * - 결과: 플레이어가 void_heart로 한 번 부활 후 안전 맵으로 돌아가면 voidHeartUsed
 *   = false로 풀려 death save가 다시 가용 — '런당 1회' spec 위반.
 * - cycle 158 applyBattleStartRelics는 voidHeart 보존(전투 시작 시) — 두 함수 사이
 *   인consistency.
 *
 * 수정:
 * - clearTemporaryAdventureState combatFlags reset 시 voidHeartUsed/Armed를 명시
 *   적으로 player의 기존 값 보존.
 * - applyBattleStartRelics와 동일 패턴.
 */

test('cycle 187: voidHeartUsed=true로 안전 맵 이동 시 보존됨', () => {
    const player = {
        hp: 100, maxHp: 100,
        tempBuff: { atk: 0.5, turn: 3, name: 'temp_buff' },
        status: ['burn'],
        combatFlags: { voidHeartUsed: true, voidHeartArmed: true, comboCount: 5 },
        nextHitEvaded: true,
    };
    const cleared = clearTemporaryAdventureState(player);

    // void_heart 플래그 보존.
    assert.equal(cleared.combatFlags.voidHeartUsed, true);
    assert.equal(cleared.combatFlags.voidHeartArmed, true);
    // 그 외 일시 상태는 정상 reset.
    assert.equal(cleared.tempBuff.turn, 0);
    assert.deepEqual(cleared.status, []);
    assert.equal(cleared.combatFlags.comboCount, 0);
    assert.equal(cleared.combatFlags.deathSaveUsed, false);
    assert.equal(cleared.nextHitEvaded, false);
});

test('cycle 187: voidHeartUsed=false 케이스도 보존 (회귀 가드)', () => {
    const player = {
        hp: 100, maxHp: 100,
        tempBuff: {},
        status: [],
        combatFlags: { voidHeartUsed: false, voidHeartArmed: false },
        nextHitEvaded: false,
    };
    const cleared = clearTemporaryAdventureState(player);
    assert.equal(cleared.combatFlags.voidHeartUsed, false);
    assert.equal(cleared.combatFlags.voidHeartArmed, false);
});

test('cycle 187: combatFlags 미존재 시 기본값 false (회귀 가드)', () => {
    const player = {
        hp: 100, maxHp: 100,
        tempBuff: {},
        status: [],
        // combatFlags 누락
        nextHitEvaded: false,
    };
    const cleared = clearTemporaryAdventureState(player);
    assert.equal(cleared.combatFlags.voidHeartUsed, false);
    assert.equal(cleared.combatFlags.voidHeartArmed, false);
});
