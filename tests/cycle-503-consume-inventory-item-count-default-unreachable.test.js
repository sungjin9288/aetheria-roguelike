import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 503: consumeInventoryItemByName `count` default unreachable 정리
 *   (cycle 222-502 silent dead config 시리즈 253번째 — redundant default annotation
 *   util-level cleanup, cycle 502 lens 회귀).
 *
 * 발견 (1 default unreachable):
 * - src/utils/enhancementUtils.ts (line 18):
 *     export const consumeInventoryItemByName = (inventory = [], itemName,
 *         count: number = 1) => {...}
 * - 호출 사이트:
 *     · useInventoryActions.ts:559 — consumeInventoryItemByName(player.inv,
 *       requirement.materialName, requirement.materials).
 *     · 1 callsite, 항상 3 args 전달 (count 명시).
 *     · 다른 파일 import 0건.
 * - 결과: count 항상 명시 전달 → default 1 도달 불가.
 *
 * 패턴 (cycle 222-502 시리즈 253번째):
 * - cycle 502: incrementStat amount 파라미터 unreachable.
 * - cycle 503: consumeInventoryItemByName count default unreachable — 동일 lens.
 *
 * 수정 (src/utils/enhancementUtils.ts):
 * - signature에서 count: number = 1 → count: number (default 제거).
 * - body 동작 그대로 (count는 호출자가 명시 전달).
 *
 * 회귀 가드:
 * - inventory / itemName / count 전달받기.
 * - body filter / removed 카운트 / nextInventory 반환 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 503: consumeInventoryItemByName signature에서 count default 0건', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    const fnIdx = source.indexOf('export const consumeInventoryItemByName');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/count:\s*number\s*=\s*1/.test(sig), 'count default 1 제거');
    assert.ok(/\bcount\b/.test(sig), 'count 파라미터 자체는 보존');
});

test('cycle 503: 정합성 가드 — useInventoryActions callsite 3 args', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    const matches = source.match(/consumeInventoryItemByName\(/g) || [];
    assert.equal(matches.length, 1, 'consumeInventoryItemByName 호출 1건');
    // 3 args 호출 (player.inv, requirement.materialName, requirement.materials)
    assert.ok(/consumeInventoryItemByName\([^)]*?,[^)]*?,[^)]*?\)/.test(source),
        '3 args 호출 보존');
});

test('cycle 503: body 동작 보존 (filter / removed / nextInventory)', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(/let removed = 0/.test(source), 'removed 카운터 보존');
    assert.ok(/nextInventory =/.test(source), 'nextInventory 변수 보존');
    assert.ok(/removed < count/.test(source), 'count 비교 보존');
    assert.ok(/return \{ nextInventory, removed \}/.test(source), '반환 구조 보존');
});

test('cycle 503: cycle 502 회귀 가드 — incrementStat amount 0건', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    const fnIdx = source.indexOf('export const incrementStat');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bamount\b/.test(sig), 'cycle 502 amount 제거 보존');
});
