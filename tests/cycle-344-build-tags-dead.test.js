import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 344: buildRunSummary buildTags 출력 dead 정리
 *   (cycle 222-343 silent dead config 시리즈 112번째 — cleanup lens 연속).
 *
 * 발견 (dead output field):
 * - buildRunSummary 반환에 `buildTags: buildProfile.tags.map(...).slice(0, 4)` 필드.
 * - RunSummaryCard / runShareText / outcomeAnalysis 어디에서도 summary.buildTags read 0건.
 * - useGameEngine.ts의 buildProfile.tags (AI snapshot용)는 별개 — cycle 268 active dispatch.
 *
 * 패턴 (cycle 222-343 silent dead config 시리즈 112번째):
 * - cycle 343: applyDynamicDifficulty 3 dead diff metadata.
 * - cycle 344: buildRunSummary buildTags 출력 dead.
 *
 * 수정:
 * - src/utils/gameUtils.ts: buildRunSummary return에서 buildTags 필드 제거.
 * - tests/cycle-268-buildprofile-secondary-dead.test.js: 가드를 useGameEngine.ts만
 *   체크하도록 갱신 (cycle 344 cleanup 반영).
 *
 * 회귀 가드:
 * - buildRunSummary 다른 필드 (level / job / kills / bossKills / relicsFound /
 *   activeTitle / loc / prestigeRank / totalGold / primaryBuild / difficultyLabel /
 *   recentWinRate / signaturesAcquired / signatureNames 등) 보존.
 * - useGameEngine.ts buildProfile.tags AI snapshot dispatch 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 344: buildRunSummary buildTags 출력 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fn = source.slice(source.indexOf('export const buildRunSummary'));
    assert.ok(!/buildTags:\s*buildProfile/.test(fn),
        'buildTags 출력 필드 제거됨');
});

test('cycle 344: useGameEngine.ts buildProfile.tags AI snapshot dispatch 보존', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(/buildProfile\.tags/.test(source),
        'AI snapshot buildProfile.tags 보존');
});

test('cycle 344: buildRunSummary 다른 활성 필드 보존', async () => {
    const { buildRunSummary } = await import('../src/utils/gameUtils.js');
    const player = {
        level: 5, job: '검사', stats: { kills: 10 }, relics: [], inv: [], equip: {},
        meta: { prestigeRank: 0 },
    };
    const summary = buildRunSummary(player, '시작의 마을');
    assert.equal(summary.level, 5, 'level 보존');
    assert.equal(summary.job, '검사', 'job 보존');
    assert.equal(summary.kills, 10, 'kills 보존');
    assert.equal(summary.buildTags, undefined, 'buildTags 출력 0건');
});

test('cycle 343 회귀 가드: applyDynamicDifficulty 3 dead diff metadata 정리 보존', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    const fn = source.slice(source.indexOf('export const applyDynamicDifficulty'));
    assert.ok(!/_diffLabel:/.test(fn),
        'cycle 343 _diffLabel 0건 보존');
});
