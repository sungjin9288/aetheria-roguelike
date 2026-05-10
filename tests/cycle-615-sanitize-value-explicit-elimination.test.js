import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 615: sanitizeValue depth explicit default-elimination
 *   (cycle 222-614 silent dead config 시리즈 355번째 — explicit default-elimination
 *   pattern 7번째 적용).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/hooks/useGameTestApi.ts (line 133):
 *     const sanitizeValue = (value: any, depth: any = 0): any => {...};
 * - 호출 사이트:
 *     · sanitizeValue:138 — sanitizeValue(entry, depth + 1) — 2 args.
 *     · sanitizeValue:152 — sanitizeValue(value[key], depth + 1) — 2 args.
 *     · render_game_to_text:164 — sanitizeValue({...}) — 1 arg only (top-level).
 * - 기존 상태: line 164 (top-level) caller가 depth 미전달 → default 0 활성.
 *
 * 패턴 (cycle 222-614 시리즈 355번째):
 * - cycle 502-614: default 청소 메가 시리즈 113사이클.
 * - cycle 615: explicit default-elimination 7번째 (cycle 608-614 lens 정착).
 *
 * 수정:
 * - useGameTestApi.ts:164 — sanitizeValue({...}) → sanitizeValue({...}, 0).
 * - useGameTestApi.ts:133 — depth default 0 제거.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로.
 * - body recursion (depth + 1) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 615: sanitizeValue signature에서 depth default 0건', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    const fnIdx = source.indexOf('const sanitizeValue');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/depth:\s*any\s*=\s*0/.test(sig),
        'sanitizeValue depth default 0 제거');
});

test('cycle 615: 정합성 가드 — top-level caller 0 명시 추가', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    // top-level call sanitizeValue({...}, 0) 명시 (cycle 615 추가)
    assert.ok(/JSON\.stringify\(sanitizeValue\(\{[\s\S]+?\},\s*0\)\)/.test(source),
        'render_game_to_text sanitizeValue(...,0) 명시 전달');
});

test('cycle 615: body recursion (depth + 1) 보존', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(/sanitizeValue\(entry,\s*depth \+ 1\)/.test(source),
        'recursion sanitizeValue(entry, depth + 1) 보존');
    assert.ok(/sanitizeValue\(value\[key\],\s*depth \+ 1\)/.test(source),
        'recursion sanitizeValue(value[key], depth + 1) 보존');
});

test('cycle 615: cycle 502-614 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    assert.ok(!/getSignatureItemNames = \(inv:\s*any\s*=\s*\[\]\)/.test(ld),
        'cycle 614 getSignatureItemNames inv default 0건');

    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitProfile = \(player: Player, stats:\s*any\s*=\s*\{\}\)/.test(rp),
        'cycle 613 getTraitProfile stats default 0건');
});
