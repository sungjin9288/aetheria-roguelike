import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 618: getISOWeekNumber date explicit default-elimination
 *   (cycle 222-617 silent dead config 시리즈 358번째 — explicit default-elimination
 *   pattern 10번째 적용).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/utils/exploreUtils.ts (line 20):
 *     const getISOWeekNumber = (date = new Date()) => {...};
 * - 호출 사이트:
 *     · resetWeeklyProtocolIfNeeded:31 — getISOWeekNumber() — 0 args.
 * - 기존 상태: caller가 date 미전달 → default `new Date()` 활성.
 *
 * 패턴 (cycle 222-617 시리즈 358번째):
 * - cycle 502-617: default 청소 메가 시리즈 116사이클.
 * - cycle 618: explicit default-elimination 10번째 (cycle 608-617 lens 정착).
 *   double-digit milestone (10번째 적용).
 *
 * 수정:
 * - exploreUtils.ts:31 — getISOWeekNumber() → getISOWeekNumber(new Date()).
 * - exploreUtils.ts:20 — date default new Date() 제거.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body Date.UTC / setUTCDate / Math.ceil 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 618: getISOWeekNumber signature에서 date default 0건', async () => {
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(!/getISOWeekNumber = \(date = new Date\(\)\)/.test(source),
        'getISOWeekNumber date default new Date() 제거');
    assert.ok(/getISOWeekNumber = \(date\)/.test(source),
        'getISOWeekNumber date 파라미터 보존');
});

test('cycle 618: 정합성 가드 — caller new Date() 명시 추가', async () => {
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(/getISOWeekNumber\(new Date\(\)\)/.test(source),
        'resetWeeklyProtocolIfNeeded getISOWeekNumber(new Date()) 명시');
});

test('cycle 618: cycle 502-617 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/safeList = \(items: any, fallback:\s*any\s*=\s*'\[item\]'\)/.test(ut),
        "cycle 617 safeList fallback default '[item]' 0건");

    assert.ok(!/safeText = \(value: any, fallback:\s*any\s*=\s*''\)/.test(ut),
        "cycle 616 safeText fallback default '' 0건");
});
