import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 343: applyDynamicDifficulty diffLabel return + _diffLabel/_diffScore mStats 3 dead 필드 정리
 *   (cycle 222-342 silent dead config 시리즈 111번째 — cleanup lens 연속).
 *
 * 발견 (3 dead output fields):
 * - applyDynamicDifficulty 반환에 `diffLabel` 필드 — exploreActions caller는 `{ mStats }`만
 *   destructure, diffLabel read 0건.
 * - scaled mStats에 `_diffLabel: diff.label` + `_diffScore: Math.round(score * 100)` 2 필드 —
 *   mStats._diffLabel/Score read 0건. enemy 객체로 spread될 가능성도 enemy._diff* read 0건.
 *
 * 패턴 (cycle 222-342 silent dead config 시리즈 111번째):
 * - cycle 342: deriveCharacterAppearance 6 dead 출력 + cascade.
 * - cycle 343: applyDynamicDifficulty 3 dead diff metadata 정리.
 *
 * 수정 (src/systems/DifficultyManager.ts):
 * - return { mStats: scaled } (diffLabel 제거).
 * - scaled에서 _diffLabel / _diffScore 필드 제거.
 *
 * 회귀 가드:
 * - hp / maxHp / atk / exp / gold 5 활성 필드 보존.
 * - GM 안내 로그 (LABEL_VISIBLE 분기) 동일.
 * - calcPerformanceScore / getDifficultyMults / addLog dispatch 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 343: applyDynamicDifficulty 반환에서 diffLabel 0건', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    const fn = source.slice(source.indexOf('export const applyDynamicDifficulty'));
    assert.ok(!/return \{\s*mStats:\s*scaled,\s*diffLabel/.test(fn),
        'diffLabel return 0건');
});

test('cycle 343: scaled에서 _diffLabel / _diffScore 0건', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    const fn = source.slice(source.indexOf('export const applyDynamicDifficulty'));
    assert.ok(!/_diffLabel:/.test(fn), '_diffLabel 0건');
    assert.ok(!/_diffScore:/.test(fn), '_diffScore 0건');
});

test('cycle 343: applyDynamicDifficulty 동작 보존 (5 활성 필드)', async () => {
    const { applyDynamicDifficulty } = await import('../src/systems/DifficultyManager.js');
    const mStats = { hp: 100, maxHp: 100, atk: 20, exp: 50, gold: 30 };
    const player = { stats: { recentBattles: [] } };
    const result = applyDynamicDifficulty(mStats, player, () => {});
    assert.ok(result.mStats, 'mStats 반환');
    assert.equal(typeof result.mStats.hp, 'number', 'hp 보존');
    assert.equal(typeof result.mStats.maxHp, 'number', 'maxHp 보존');
    assert.equal(typeof result.mStats.atk, 'number', 'atk 보존');
    assert.equal(typeof result.mStats.exp, 'number', 'exp 보존');
    assert.equal(typeof result.mStats.gold, 'number', 'gold 보존');
    assert.equal(result.mStats._diffLabel, undefined, '_diffLabel 0건');
    assert.equal(result.mStats._diffScore, undefined, '_diffScore 0건');
    assert.equal(result.diffLabel, undefined, 'diffLabel 0건');
});

test('cycle 342 회귀 가드: deriveCharacterAppearance dead 필드 정리 보존', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const fn = source.slice(source.indexOf('export const deriveCharacterAppearance'));
    assert.ok(!/iconKey: getItemIconAssetKey/.test(fn),
        'cycle 342 iconKey 0건 보존');
});
