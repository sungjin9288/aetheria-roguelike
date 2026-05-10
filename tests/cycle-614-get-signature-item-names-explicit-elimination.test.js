import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 614: getSignatureItemNames inv explicit default-elimination
 *   (cycle 222-613 silent dead config 시리즈 354번째 — explicit default-elimination
 *   pattern 6번째 적용).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/hooks/useLegendaryDropDetector.ts (line 24):
 *     const getSignatureItemNames = (inv: any = []) => {
 *         const names: any[] = [];
 *         for (const entry of inv) {...}  // undefined 시 crash 위험
 *         ...
 *     };
 * - 호출 사이트 (1 caller):
 *     · useLegendaryDropDetector.ts:56 — getSignatureItemNames(inv) — 1 arg.
 *       inv는 hook의 첫 param인데 caller (GameRoot)에서 engine.player?.inv
 *       전달 → undefined 가능. 기존 default `[]`가 protective.
 *
 * 패턴 (cycle 222-613 시리즈 354번째):
 * - cycle 502-613: default 청소 메가 시리즈 112사이클.
 * - cycle 614: explicit default-elimination 6번째 (cycle 608/609/611/612/613).
 *   caller에 `|| []` defensive guard 추가 후 default 제거.
 *
 * 수정:
 * - useLegendaryDropDetector.ts:56 — getSignatureItemNames(inv) →
 *   getSignatureItemNames(inv || []).
 * - useLegendaryDropDetector.ts:24 — inv default [] 제거.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로 (undefined 안전 처리는 || [] guard로
 *   이전).
 * - body for...of 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 614: getSignatureItemNames signature에서 inv default 0건', async () => {
    const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    const fnIdx = source.indexOf('const getSignatureItemNames');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/inv:\s*any\s*=\s*\[\]/.test(sig),
        'getSignatureItemNames inv default [] 제거');
});

test('cycle 614: 정합성 가드 — caller |[] guard 추가', async () => {
    const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    assert.ok(/getSignatureItemNames\(inv \|\| \[\]\)/.test(source),
        'getSignatureItemNames(inv || []) defensive guard 명시');
});

test('cycle 614: cycle 502-613 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitProfile = \(player: Player, stats:\s*any\s*=\s*\{\}\)/.test(rp),
        'cycle 613 getTraitProfile stats default 0건');

    const ng = await readSrc('src/utils/nameGenerator.ts');
    assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(ng),
        'cycle 611 createRandomMobileName rng default 0건');
});
