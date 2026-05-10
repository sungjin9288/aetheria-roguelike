import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 611: createRandomMobileName rng explicit default-elimination
 *   (cycle 222-610 silent dead config 시리즈 351번째 — explicit default-elimination
 *   pattern 3번째 적용, cycle 608/609에 이은).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/utils/nameGenerator.ts (line 55):
 *     export const createRandomMobileName = (rng: any = Math.random) => {...};
 * - 호출 사이트:
 *     · IntroScreen:17 — useState(() => createRandomMobileName()) — 0 args.
 *     · IntroScreen:121 — applyName(createRandomMobileName(), true) — 0 args.
 *     · tests/name-generator: 4 callers 모두 deterministic rng 명시.
 * - 기존 상태: 2 production caller가 rng 미전달 → default Math.random 활성.
 *
 * 패턴 (cycle 222-610 시리즈 351번째):
 * - cycle 502-610: default 청소 메가 시리즈 109사이클.
 * - cycle 611: explicit default-elimination 3번째 (cycle 608/609 신규 lens
 *   3번째 적용).
 *
 * 수정:
 * - IntroScreen.tsx:17/121 — createRandomMobileName() → createRandomMobileName(Math.random).
 * - nameGenerator.ts:55 — rng default Math.random 제거.
 *
 * 회귀 가드:
 * - 2 production + 4 test callsite 동작 그대로.
 * - body의 rng() / pick / generateFromParts 호출 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 611: createRandomMobileName signature에서 rng default 0건', async () => {
    const source = await readSrc('src/utils/nameGenerator.ts');
    assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(source),
        'createRandomMobileName rng default Math.random 제거');
});

test('cycle 611: 정합성 가드 — IntroScreen 2 callsite Math.random 명시 추가', async () => {
    const source = await readSrc('src/components/IntroScreen.tsx');
    assert.ok(/createRandomMobileName\(Math\.random\)/.test(source),
        'IntroScreen createRandomMobileName(Math.random) 명시');
    const calls = (source.match(/createRandomMobileName\(Math\.random\)/g) || []).length;
    assert.equal(calls, 2, `IntroScreen 2 callsite Math.random 명시: ${calls}건`);
});

test('cycle 611: test callsite 보존 (deterministic rng)', async () => {
    const source = await readSrc('tests/name-generator.test.js');
    assert.ok(/createRandomMobileName\(\(\) => 0\)/.test(source),
        'name-generator test callsite (() => 0) 보존');
});

test('cycle 611: cycle 502-610 회귀 가드 — default 청소 시리즈 보존', async () => {
    const gu = await readSrc('src/utils/graveUtils.ts');
    assert.ok(!/buildGraveData = \(player: Player, random:\s*any\s*=\s*Math\.random/.test(gu),
        'cycle 609 buildGraveData random default 0건');

    const intro = await readSrc('src/components/IntroScreen.tsx');
    assert.ok(!/dismissKeyboard:\s*any\s*=\s*false/.test(intro),
        'cycle 608 applyName dismissKeyboard default 0건');
});
