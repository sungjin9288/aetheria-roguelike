import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 616: safeText fallback explicit default-elimination
 *   (cycle 222-615 silent dead config 시리즈 356번째 — explicit default-elimination
 *   pattern 8번째 적용).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/hooks/useGameTestApi.ts (line 113):
 *     const safeText = (value: any, fallback: any = '') => {...};
 * - 호출 사이트:
 *     · safeText:131 — safeText(item, fallback) — 2 args (recursion).
 *     · safeText:147 — safeText(value, tag) — 2 args.
 *     · safeText:200/207/214 — safeText(e.currentEvent.desc/...) — 1 arg only.
 * - 기존 상태: 3 callers가 fallback 미전달 → default '' 활성.
 *
 * 패턴 (cycle 222-615 시리즈 356번째):
 * - cycle 502-615: default 청소 메가 시리즈 114사이클.
 * - cycle 616: explicit default-elimination 8번째 (cycle 608-615 lens 정착).
 *
 * 수정:
 * - useGameTestApi.ts:200 — safeText(e.currentEvent.desc) → safeText(..., '').
 * - useGameTestApi.ts:207 — safeText(e.postCombatResult.enemy) → safeText(..., '').
 * - useGameTestApi.ts:214 — safeText(is.title) → safeText(is.title, '').
 * - useGameTestApi.ts:113 — fallback default '' 제거.
 *
 * 회귀 가드:
 * - 5 internal callsite 동작 그대로.
 * - body 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 616: safeText signature에서 fallback default 0건', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    const fnIdx = source.indexOf('const safeText');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/fallback:\s*any\s*=\s*''/.test(sig),
        "safeText fallback default '' 제거");
});

test('cycle 616: 정합성 가드 — 3 callsite \'\' 명시 추가', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(/safeText\(e\.currentEvent\.desc,\s*''\)/.test(source),
        "currentEvent.desc safeText '' 명시");
    assert.ok(/safeText\(e\.postCombatResult\.enemy,\s*''\)/.test(source),
        "postCombatResult.enemy safeText '' 명시");
    assert.ok(/safeText\(is\.title,\s*''\)/.test(source),
        "is.title safeText '' 명시");
});

test('cycle 616: cycle 502-615 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/sanitizeValue = \(value: any, depth:\s*any\s*=\s*0\)/.test(ut),
        'cycle 615 sanitizeValue depth default 0건');

    const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    assert.ok(!/getSignatureItemNames = \(inv:\s*any\s*=\s*\[\]\)/.test(ld),
        'cycle 614 getSignatureItemNames inv default 0건');
});
