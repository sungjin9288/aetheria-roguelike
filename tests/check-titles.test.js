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

// cycle 62 phase 3: retroactive 칭호 부여 시나리오 — 기존 save가 신규 칭호 조건을
// 이미 만족한 상태로 로드되는 경우를 모사. 단일 호출에 여러 칭호가 한 번에 풀려야 함.
test('checkTitles unlocks multiple new titles in a single call (retroactive load)', () => {
    const player = {
        titles: [], // 신규 칭호 미보유 상태
        stats: {
            explores: 600, // wanderer + pathfinder 동시 충족
            discoveries: 12, // cartographer
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('wanderer'));
    assert.ok(unlocked.includes('pathfinder'));
    assert.ok(unlocked.includes('cartographer'));
    assert.equal(unlocked.length >= 3, true, 'at least 3 new titles unlocked');
});

test('checkTitles partial retroactive (일부만 충족)', () => {
    const player = {
        titles: ['wanderer'], // 이미 wanderer는 보유
        stats: {
            explores: 600, // pathfinder 신규 부여
            discoveries: 5, // cartographer 미달
        },
    };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('pathfinder'), 'pathfinder unlocked');
    assert.ok(!unlocked.includes('wanderer'), 'wanderer 유지 (재해금 안 됨)');
    assert.ok(!unlocked.includes('cartographer'), 'cartographer 미달');
});
