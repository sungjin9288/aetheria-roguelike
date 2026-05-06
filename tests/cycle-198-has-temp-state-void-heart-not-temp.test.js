import test from 'node:test';
import assert from 'node:assert/strict';

import { hasTemporaryAdventureState, clearTemporaryAdventureState } from '../src/utils/playerStateUtils.js';

/**
 * cycle 198: hasTemporaryAdventureState가 voidHeart 플래그를 'temporary'로 간주 안 함 (cycle 187 follow-up).
 *
 * 발견 (cycle 187 follow-up — 무한 재호출 회귀):
 * - cycle 187이 clearTemporaryAdventureState에서 voidHeartUsed/Armed를 보존하도록 변경.
 *   '런당 1회' spec과 정합.
 * - 그러나 hasTemporaryAdventureState는 여전히 이 두 플래그를 'temporary'로 카운트.
 * - 결과: 안전 맵 이동마다 'shouldClearTemporaryState' true → clear 호출 → voidHeart는
 *   여전히 true → 다음 이동에서도 또 true → 무한 재호출. 동작은 idempotent라 큰 문제는
 *   없지만 불필요한 re-dispatch + 일관성 위반.
 *
 * 수정 (src/utils/playerStateUtils.ts):
 * - hasTemporaryAdventureState에서 voidHeartUsed / voidHeartArmed 검사 제거.
 * - clear가 preserve하는 플래그는 has도 'temporary'로 안 봄 — 일관성.
 *
 * 기존 cycle 187 테스트(player-state-utils.test.js): cleared 후 hasTemporaryAdventureState가
 *   true를 expected로 가정했으나 cycle 198 후엔 false가 expected. 동시 업데이트.
 */

test('cycle 198: voidHeartUsed=true만 있으면 hasTemporaryAdventureState false', () => {
    const player = {
        tempBuff: { atk: 0, def: 0, turn: 0, name: null },
        status: [],
        combatFlags: { voidHeartUsed: true, voidHeartArmed: false },
        nextHitEvaded: false,
    };
    assert.equal(hasTemporaryAdventureState(player), false);
});

test('cycle 198: voidHeartArmed=true만 있으면 hasTemporaryAdventureState false', () => {
    const player = {
        tempBuff: { atk: 0, def: 0, turn: 0, name: null },
        status: [],
        combatFlags: { voidHeartUsed: false, voidHeartArmed: true },
        nextHitEvaded: false,
    };
    assert.equal(hasTemporaryAdventureState(player), false);
});

test('cycle 198: clear → has가 false (무한 재호출 방지)', () => {
    const player = {
        tempBuff: { atk: 0.3, def: 0, turn: 2, name: '버프' },
        status: ['burn'],
        combatFlags: { voidHeartUsed: true, voidHeartArmed: true, comboCount: 5 },
        nextHitEvaded: true,
    };
    assert.equal(hasTemporaryAdventureState(player), true, '초기 상태는 temporary');
    const cleared = clearTemporaryAdventureState(player);
    assert.equal(hasTemporaryAdventureState(cleared), false,
        '안전 맵 이동 후엔 voidHeart preserve되어도 has는 false (재호출 방지)');
});

test('cycle 198: 다른 temporary 플래그(comboCount/deathSaveUsed/status)는 여전히 catch', () => {
    const cases = [
        { combatFlags: { comboCount: 3 } },
        { combatFlags: { deathSaveUsed: true } },
        { status: ['burn'] },
        { tempBuff: { atk: 0.3, turn: 2, name: 'x' } },
        { nextHitEvaded: true },
    ];
    for (const c of cases) {
        const p = { tempBuff: {}, status: [], combatFlags: {}, ...c };
        assert.equal(hasTemporaryAdventureState(p), true,
            `expected true for ${JSON.stringify(c)}`);
    }
});
