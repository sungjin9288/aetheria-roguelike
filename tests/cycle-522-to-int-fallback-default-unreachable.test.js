import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 522: toInt `fallback = 0` default unreachable
 *   (cycle 222-521 silent dead config 시리즈 266번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 19번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/aiEventUtils.ts (line 5):
 *     const toInt = (value: any, fallback: any = 0) =>
 *         (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback);
 * - 호출 사이트 (8 callsite, 모듈 내부 private):
 *     · line 129: toInt(..., 1)
 *     · line 130: toInt(..., 120)
 *     · line 131: toInt(..., 60)
 *     · line 202: toInt(outcome.choiceIndex, idx)
 *     · line 208-211: toInt(outcome.X, 0) × 4 (gold/exp/hp/mp)
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: fallback 항상 명시 전달. default 0 도달 불가.
 *
 * 패턴 (cycle 222-521 시리즈 266번째):
 * - cycle 502-521: util default 청소 메가 시리즈 18사이클.
 * - cycle 522: toInt fallback — 동일 lens. cycle 521과 동일하게 같은 모듈에서
 *   정수형 helper 정리.
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - signature에서 fallback: any = 0 → fallback: any.
 * - body의 ternary (Number.isFinite(...) ? Math.trunc(...) : fallback) 보존.
 *
 * 회귀 가드:
 * - 8 internal callsite 동작 그대로.
 * - body Number.isFinite/Math.trunc 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 522: toInt signature에서 fallback default 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('const toInt');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/fallback:\s*any\s*=\s*0/.test(sig), 'toInt fallback default 0 제거');
    assert.ok(/\bfallback\b/.test(sig), 'fallback 파라미터 자체는 보존');
});

test('cycle 522: 정합성 가드 — 8 internal callsite 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const calls = (source.match(/toInt\(/g) || []).length;
    // 정의 1 (const toInt = (...))는 paren 미사용, 사용처만 8회 매칭
    assert.equal(calls, 8, `toInt 호출 8건 보존: ${calls}건`);
});

test('cycle 522: body ternary 처리 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/Number\.isFinite\(Number\(value\)\)\s*\?\s*Math\.trunc\(Number\(value\)\)\s*:\s*fallback/.test(source),
        'Number.isFinite/Math.trunc/fallback ternary 보존');
});

test('cycle 522: cycle 502-521 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/const hashText[^=]*value:\s*any\s*=\s*''/.test(ea),
        'cycle 521 hashText value default 0건');
    assert.ok(!/const mixHex[^=]*ratio:\s*any\s*=\s*0\.5/.test(ea),
        'cycle 521 mixHex ratio default 0건');

    const ag = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/getMapLevel[^=]*playerLevel:\s*any\s*=\s*1/.test(ag),
        'cycle 519 getMapLevel playerLevel default 0건');
});
