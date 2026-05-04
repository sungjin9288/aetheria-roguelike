import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ACHIEVEMENTS } from '../src/data/quests.js';
import { TITLES } from '../src/data/titles.js';
import { checkTitles, isAchievementUnlocked } from '../src/utils/gameUtils.js';

/**
 * cycle 95: 최대 연속 처치(maxKillStreak) 누적 + 보상 통합.
 *
 * 배경:
 * - cycle 초기부터 killStreak 시스템이 4 tier(3/5/10/20)와 ATK/CRIT 보너스로
 *   잘 구현되어 있고 statsCalculator computeKillStreakBonus가 active.
 * - 그러나 killStreak는 비전투 30초 / 사망 / 도주 시 0으로 리셋되는 휘발성
 *   카운터. "이번 런에 30연속 달성"이 아무 데도 기록되지 않아 reflection /
 *   보상 surface가 비어있던 빈 자리.
 *
 * 추가:
 * - INITIAL_STATE.player.stats.maxKillStreak = 0
 * - combatVictory: 매 처치 후 stats.maxKillStreak = max(prev, newStreak)
 * - achievements 3종: ach_streak_5 / ach_streak_10 / ach_streak_20
 * - title 'berserker' (광전사): cond.type='maxKillStreak', val=20
 * - checkTitles에 type==='maxKillStreak' 핸들러
 */

const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);
const findTitle = (id) => TITLES.find((t) => t.id === id);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('INITIAL_STATE.player.stats.maxKillStreak 선언됨', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.match(source, /maxKillStreak:\s*0/);
});

test('combatVictory: stats.maxKillStreak 누적 코드 존재', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.match(
        source,
        /maxKillStreak:\s*Math\.max/,
        'should update maxKillStreak via Math.max in combatVictory'
    );
});

test('ach_streak_5/10/20 achievements 등록됨', () => {
    for (const id of ['ach_streak_5', 'ach_streak_10', 'ach_streak_20']) {
        const ach = findAch(id);
        assert.ok(ach, `${id} should exist`);
        assert.equal(ach.target, 'maxKillStreak');
    }
});

test('isAchievementUnlocked: maxKillStreak 20 → ach_streak_20 unlocked', () => {
    const player = { stats: { maxKillStreak: 20 } };
    assert.equal(isAchievementUnlocked(findAch('ach_streak_5'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_streak_10'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_streak_20'), player), true);
});

test('isAchievementUnlocked: maxKillStreak 9 → ach_streak_5만 unlocked', () => {
    const player = { stats: { maxKillStreak: 9 } };
    assert.equal(isAchievementUnlocked(findAch('ach_streak_5'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_streak_10'), player), false);
});

test('berserker(광전사) 칭호 등록됨 (maxKillStreak 20)', () => {
    const title = findTitle('berserker');
    assert.ok(title, 'berserker title should exist');
    assert.equal(title.name, '광전사');
    assert.equal(title.cond.type, 'maxKillStreak');
    assert.equal(title.cond.val, 20);
});

test('checkTitles: maxKillStreak 20 → berserker 활성', () => {
    const player = { titles: [], stats: { maxKillStreak: 20 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('berserker'));
});

test('checkTitles: maxKillStreak 19 → berserker 비활성', () => {
    const player = { titles: [], stats: { maxKillStreak: 19 } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('berserker'));
});
