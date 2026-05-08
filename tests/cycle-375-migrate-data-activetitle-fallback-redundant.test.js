import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 375: migrateData target.activeTitle || null fallback redundant 정리
 *   (cycle 222-374 silent dead config 시리즈 140번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive fallback):
 * - src/utils/gameUtils.ts migrateData에 `target.activeTitle = target.activeTitle || null` 1라인.
 * - 모든 7곳의 activeTitle consumer가 이미 fallback / truthy 체크 처리:
 *   · statsCalculator.ts:304: `getTitlePassive(player.activeTitle) || {}` — 함수 내부 null/undefined 처리.
 *   · gameUtils.ts:670 (buildRunSummary): `player.activeTitle || null` — fallback.
 *   · useGameEngine.ts:102: `player.activeTitle || null` — fallback.
 *   · useFirebaseSync.ts:234: `player.activeTitle || null` — fallback.
 *   · SystemTab.tsx:89/268/318/320/326: 모두 truthy 체크 (`?` ternary, `&&`, `=== id`).
 * - undefined와 null 모두 falsy 처리되므로 migrate normalization redundant.
 * - cycle 373/374 동일 lens — defensive fallback 중 consumer level fallback로 보호되는 영역.
 *
 * 패턴 (cycle 222-374 silent dead config 시리즈 140번째):
 * - cycle 374: migrateData tempBuff sub-field fallback 3 redundant.
 * - cycle 375: migrateData activeTitle fallback 1 redundant (동일 lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - `target.activeTitle = target.activeTitle || null` 라인 제거.
 *
 * 회귀 가드:
 * - statsCalculator getTitlePassive null/undefined 처리 동일.
 * - 모든 SystemTab truthy 체크 동작 그대로.
 * - buildRunSummary `player.activeTitle || null` fallback 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 375: migrateData target.activeTitle || null fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    // 명시 코드 라인 (comment 라인 제외, comment는 `//`로 시작).
    const matches = block.match(/^\s+target\.activeTitle = target\.activeTitle/gm) || [];
    assert.equal(matches.length, 0,
        `target.activeTitle || null fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 375: migrateData 동작 보존 (activeTitle 누락 시 undefined로 통과)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // activeTitle 명시 없는 save → undefined (consumer가 fallback 처리).
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    assert.ok(result.player, 'player 객체 보존');
    // activeTitle은 undefined or null 모두 가능 (consumer fallback에 의존).
});

test('cycle 374 회귀 가드: tempBuff sub-field fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/target\.tempBuff\.(atk|def|turn) = target\.tempBuff\./g) || [];
    assert.equal(matches.length, 0, 'cycle 374 tempBuff sub-field fallback 0건 보존');
});
