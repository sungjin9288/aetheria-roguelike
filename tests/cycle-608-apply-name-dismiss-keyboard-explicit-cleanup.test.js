import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 608: applyName `dismissKeyboard = false` default cleanup with explicit
 *   caller batch (cycle 222-607 silent dead config 시리즈 344번째 — explicit
 *   default-elimination pattern).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/components/IntroScreen.tsx (line 31):
 *     const applyName = (nextName: any, dismissKeyboard: any = false) => {...};
 * - 호출 사이트:
 *     · IntroScreen:109 — onChange={(e) => applyName(e.target.value)} — 1 arg.
 *     · IntroScreen:118 — onClick={() => applyName(createRandomMobileName(),
 *       true)} — 2 args.
 * - 기존 상태: line 109 caller가 dismissKeyboard 미전달 → default false 활성.
 *   default reachable이었음.
 *
 * 패턴 (cycle 222-607 시리즈 344번째):
 * - cycle 502-607: default 청소 메가 시리즈 106사이클.
 * - cycle 608: explicit default-elimination — caller 명시 false 추가하여 default
 *   unreachable 전환. partial cleanup이 아닌 active conversion. 신규 lens.
 *
 * 수정 (src/components/IntroScreen.tsx):
 * - line 109: applyName(e.target.value) → applyName(e.target.value, false).
 * - line 31: dismissKeyboard: any = false → dismissKeyboard: any.
 * - body의 dismissKeyboard ? input.blur() : null 분기 보존.
 *
 * 회귀 가드:
 * - 2 callsite 동작 그대로 (false / true 명시).
 * - body input.blur() 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 608: applyName signature에서 dismissKeyboard default 0건', async () => {
    const source = await readSrc('src/components/IntroScreen.tsx');
    const fnIdx = source.indexOf('const applyName');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/dismissKeyboard:\s*any\s*=\s*false/.test(sig),
        'applyName dismissKeyboard default false 제거');
});

test('cycle 608: 정합성 가드 — 2 callsite 명시 (false/true)', async () => {
    const source = await readSrc('src/components/IntroScreen.tsx');
    assert.ok(/applyName\(e\.target\.value,\s*false\)/.test(source),
        'onChange callsite false 명시 추가');
    assert.ok(/applyName\(createRandomMobileName\(\),\s*true\)/.test(source),
        'onClick reroll callsite true 명시 보존');
});

test('cycle 608: cycle 502-607 회귀 가드 — default 청소 시리즈 보존', async () => {
    const mp = await readSrc('src/utils/mapProgress.ts');
    assert.ok(!/uniqueList = \(values:\s*any\s*=\s*\[\]\)/.test(mp),
        'cycle 607 uniqueList values default 0건');

    const ai = await readSrc('src/services/aiService.ts');
    assert.ok(!/generateEvent: async \(loc: any, history: any\[\]\s*=\s*\[\]/.test(ai),
        'cycle 606 generateEvent history default 0건');
});
