import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 278: stats.killStreakTier dead 필드 cleanup
 *   (cycle 222-277 silent dead config 시리즈 48번째 — cleanup lens 연속).
 *
 * 발견 (dead 단일 필드):
 * - src/utils/statsCalculator.ts line 414: killStreakTier 필드 export.
 * - src/ 전체 검색에서 production code consumer 0건. 정의 1건뿐.
 * - tests/stats-calculator.test.js만 field presence 검증 (실제 사용 X).
 * - killStreak (raw count) 필드는 active dispatched. tier index만 dead.
 *
 * 패턴 (cycle 222-277 silent dead config 시리즈 48번째):
 * - cycle 267: skillLabel 제거.
 * - cycle 268: secondary 제거.
 * - cycle 270: tactical 12 fields 제거.
 * - cycle 271: 4 dead exports 제거.
 * - cycle 277: totalPrestige 3 dead 필드 제거.
 * - cycle 278: killStreakTier 단일 dead 필드 제거 (cleanup lens 연속).
 *
 * 수정:
 * 1) src/utils/statsCalculator.ts: stats 반환 객체에서 killStreakTier 필드 제거.
 * 2) tests/stats-calculator.test.js: killStreakTier assertion 2건 제거 + 필드 presence 체크 갱신.
 *
 * 회귀 가드:
 * - killStreak (raw count) 필드 유지.
 * - computeKillStreakBonus / atkBonus / critBonus / tierIdx 내부 계산 동작 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 278: statsCalculator에서 killStreakTier 필드 제거', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(!/^\s*killStreakTier:/m.test(source),
        'killStreakTier 필드 정의 제거됨');
});

test('cycle 278: killStreak raw count 필드 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(/killStreak:\s*player\.killStreak/.test(source),
        'killStreak 필드 dispatch 유지');
});

test('cycle 278: computeKillStreakBonus 내부 계산 동작 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(/const computeKillStreakBonus/.test(source),
        'computeKillStreakBonus 함수 유지');
    assert.ok(/atkBonus/.test(source) && /critBonus/.test(source),
        'atkBonus / critBonus 계산 유지');
});
