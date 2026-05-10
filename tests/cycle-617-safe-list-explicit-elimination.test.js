import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 617: safeList fallback explicit default-elimination
 *   (cycle 222-616 silent dead config 시리즈 357번째 — explicit default-elimination
 *   pattern 9번째 적용).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/hooks/useGameTestApi.ts (line 130):
 *     const safeList = (items: any, fallback: any = '[item]') => (
 *         Array.isArray(items) ? items.map((item: any) => safeText(item, fallback)) : []
 *     );
 * - 호출 사이트:
 *     · safeList:204 — safeList(e.currentEvent.choices, '[choice]') — 2 args.
 *     · safeList:213 — safeList(e.postCombatResult.items) — 1 arg only.
 *     · safeList:217 — safeList(is.names) — 1 arg only.
 * - 기존 상태: 2 callers (213/217)가 fallback 미전달 → default '[item]' 활성.
 *
 * 패턴 (cycle 222-616 시리즈 357번째):
 * - cycle 502-616: default 청소 메가 시리즈 115사이클.
 * - cycle 617: explicit default-elimination 9번째 (cycle 608-616 lens 정착).
 *   useGameTestApi.ts 같은 모듈에서 cycle 615/616에 이은 3 cycle 연속.
 *
 * 수정:
 * - useGameTestApi.ts:213 — safeList(e.postCombatResult.items, '[item]') 명시.
 * - useGameTestApi.ts:217 — safeList(is.names, '[item]') 명시.
 * - useGameTestApi.ts:130 — fallback default '[item]' 제거.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로.
 * - body Array.isArray + map(safeText) 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 617: safeList signature에서 fallback default 0건', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    const fnIdx = source.indexOf('const safeList');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/fallback:\s*any\s*=\s*'\[item\]'/.test(sig),
        "safeList fallback default '[item]' 제거");
});

test("cycle 617: 정합성 가드 — 2 callsite '[item]' 명시 추가", async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(/safeList\(e\.postCombatResult\.items,\s*'\[item\]'\)/.test(source),
        "postCombatResult.items safeList '[item]' 명시");
    assert.ok(/safeList\(is\.names,\s*'\[item\]'\)/.test(source),
        "is.names safeList '[item]' 명시");
});

test("cycle 617: '[choice]' caller (currentEvent.choices) 보존", async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(/safeList\(e\.currentEvent\.choices,\s*'\[choice\]'\)/.test(source),
        "currentEvent.choices safeList('...', '[choice]') 보존");
});

test('cycle 617: cycle 502-616 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/safeText = \(value: any, fallback:\s*any\s*=\s*''\)/.test(ut),
        "cycle 616 safeText fallback default '' 0건");
    assert.ok(!/sanitizeValue = \(value: any, depth:\s*any\s*=\s*0\)/.test(ut),
        'cycle 615 sanitizeValue depth default 0건');
});
