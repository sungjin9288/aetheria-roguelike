import test from 'node:test';
import assert from 'node:assert/strict';

import { ACHIEVEMENTS } from '../src/data/quests.js';
import { isAchievementUnlocked } from '../src/utils/gameUtils.js';

// cycle 74: 도주 성공 카운터(stats.escapes)와 그 위에 쌓이는 achievements 3종.
//
// 기존 동작:
// - 도주 성공은 stats.recentBattles에만 push되어 50개 윈도우 밖으로 밀려나면 사라짐.
// - achievement / quest target으로 사용 불가.
//
// 이번 추가:
// - combatAttack의 escape success 분기에서 stats.escapes += 1
// - achievements 3종 (ach_escape_5 / 20 / 50)
// - INITIAL_STATE.player.stats.escapes = 0 default

const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);

test('ach_escape_5 / ach_escape_20 / ach_escape_50 achievements 등록됨', () => {
    const ids = ['ach_escape_5', 'ach_escape_20', 'ach_escape_50'];
    for (const id of ids) {
        const ach = findAch(id);
        assert.ok(ach, `${id} should exist`);
        assert.equal(ach.target, 'escapes');
        assert.ok(typeof ach.goal === 'number' && ach.goal > 0);
    }
});

test('escape achievement goal이 단조 증가 (5 < 20 < 50)', () => {
    const goals = ['ach_escape_5', 'ach_escape_20', 'ach_escape_50'].map((id) => findAch(id).goal);
    for (let i = 1; i < goals.length; i++) {
        assert.ok(goals[i] > goals[i - 1], 'goals should be monotonically increasing');
    }
});

test('isAchievementUnlocked: escapes 5 → ach_escape_5 unlocked', () => {
    const player = { stats: { escapes: 5 } };
    assert.equal(isAchievementUnlocked(findAch('ach_escape_5'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_escape_20'), player), false);
});

test('isAchievementUnlocked: escapes 50 → 3종 모두 unlocked', () => {
    const player = { stats: { escapes: 50 } };
    assert.equal(isAchievementUnlocked(findAch('ach_escape_5'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_escape_20'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_escape_50'), player), true);
});

test('isAchievementUnlocked: stats.escapes 누락 → 0 취급', () => {
    const player = { stats: {} };
    assert.equal(isAchievementUnlocked(findAch('ach_escape_5'), player), false);
});
