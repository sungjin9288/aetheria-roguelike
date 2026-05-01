import test from 'node:test';
import assert from 'node:assert/strict';

import { checkTitles } from '../src/utils/gameUtils.js';

// cycle 61: 신규 칭호 (wanderer / pathfinder / cartographer / legend_seeker /
// legend_chronicler) cond.type 핸들러가 정상 동작함을 회귀 가드.

test('checkTitles unlocks wanderer at explores >= 100', () => {
    const player = { titles: [], stats: { explores: 100 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('wanderer'), 'wanderer should be unlocked');
});

test('checkTitles unlocks pathfinder at explores >= 500', () => {
    const player = { titles: [], stats: { explores: 500 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('pathfinder'), 'pathfinder should be unlocked');
    assert.ok(unlocked.includes('wanderer'), 'wanderer also unlocked at 500');
});

test('checkTitles does not unlock wanderer below threshold', () => {
    const player = { titles: [], stats: { explores: 50 } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('wanderer'), 'wanderer locked at 50 explores');
});

test('checkTitles unlocks cartographer at discoveries >= 10', () => {
    const player = { titles: [], stats: { discoveries: 10 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('cartographer'), 'cartographer unlocked');
});

test('checkTitles unlocks legend_seeker via codex signature count', () => {
    const player = {
        titles: [],
        stats: {
            codex: {
                weapons: { '낙뢰의 검': true, '심연검': true },
                armors: { '용골 갑주': true },
                shields: { '수호 방패': true, '심해의 방패': true },
            },
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('legend_seeker'), 'legend_seeker unlocked at 5 codex entries');
});

test('checkTitles does not re-unlock owned titles', () => {
    const player = {
        titles: ['wanderer'],
        stats: { explores: 200 },
    };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('wanderer'), 'wanderer not re-unlocked');
});
