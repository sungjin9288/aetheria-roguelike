import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 388: migrateData killStreak normalization redundant 정리
 *   (cycle 222-387 silent dead config 시리즈 152번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive normalization):
 * - src/utils/gameUtils.ts migrateData에 3-line if 블록:
 *   `if (typeof target.killStreak !== 'number') { target.killStreak = 0; }`
 * - 모든 consumer가 이미 fallback 처리:
 *   · statsCalculator:378: `computeKillStreakBonus(player.killStreak || 0)` ✓
 *   · statsCalculator:413: `killStreak: player.killStreak || 0` ✓
 *   · StatusBar:159: `(player.killStreak || 0) >= 3` ✓
 *   · StatusBar:160: `{player.killStreak}` (gated by 159 truthy)
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 *
 * 패턴 (cycle 222-387 silent dead config 시리즈 152번째):
 * - cycle 387: skillChoices / challengeModifiers 2 redundant.
 * - cycle 388: killStreak `if (typeof !== number)` 3-line block redundant.
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 3-line if 블록 제거.
 *
 * 회귀 가드:
 * - 모든 consumer `player.killStreak || 0` fallback 동작 그대로.
 * - 비숫자 값(string 등) 코너케이스: `string || 0` = string (truthy), 이후
 *   비교 (`>= 3`)에서 NaN → false 반환으로 안전 (crash 없음).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 388: migrateData killStreak normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/typeof target\.killStreak !== 'number'/.test(block),
        'migrateData killStreak normalization 0건');
});

test('cycle 388: migrateData 동작 보존 (inject 값 / 누락 케이스)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // inject 값 보존.
    const result1 = migrateData({
        player: { name: 'test', job: '모험가', killStreak: 5 }
    });
    assert.equal(result1.player.killStreak, 5, 'killStreak inject 값 보존');
    // 누락 → undefined (consumer fallback `|| 0` 처리).
    const result2 = migrateData({
        player: { name: 'test', job: '모험가' }
    });
    // killStreak이 undefined여도 게임 정상 동작 (consumer level fallback).
    assert.ok(result2.player, 'player 객체 보존');
});

test('cycle 387 회귀 가드: skillChoices / challengeModifiers 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.skillChoices = target\.skillChoices/m.test(block),
        'cycle 387 skillChoices normalization 0건 보존');
    assert.ok(!/^\s+target\.challengeModifiers = Array\.isArray/m.test(block),
        'cycle 387 challengeModifiers normalization 0건 보존');
});
