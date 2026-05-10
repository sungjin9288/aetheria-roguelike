import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 527: dedupeChoices + normalizeOutcomes 4 defaults batch unreachable
 *   (cycle 222-526 silent dead config 시리즈 271번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 24번째).
 *
 * 발견 (4 defaults batch, aiEventUtils.ts 같은 모듈 private helpers):
 * - src/utils/aiEventUtils.ts:
 *     · line 17: const dedupeChoices = (choices: any[] = []) => {...}
 *     · line 205: const normalizeOutcomes = (rawOutcomes: any[] = [],
 *           choices: any[] = [], context: any = {}) => {...}
 * - 호출 사이트 (모듈 내부 private):
 *     · dedupeChoices:1 callsite (line 251 dedupeChoices([...rawChoices,
 *       ...fallbackChoices]).slice(0, 3)) — 항상 spread 배열 명시 전달.
 *     · normalizeOutcomes:1 callsite (line 260 normalizeOutcomes(raw.outcomes,
 *       choices, { ...context, desc })) — 3 args 명시 전달. choices는 line 251
 *       에서 dedupeChoices() 결과(항상 배열). context는 spread object.
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: 4 default 모두 도달 불가.
 *
 * Note: rawOutcomes는 body에서 Array.isArray() 가드가 있어 undefined 안전.
 *
 * 패턴 (cycle 222-526 시리즈 271번째):
 * - cycle 502-526: util default 청소 메가 시리즈 23사이클.
 * - cycle 527: aiEventUtils 같은 모듈 batch — cycle 522/525에 이은 동일 모듈
 *   추가 cleanup. 한 사이클에 4 default 정리.
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - dedupeChoices signature: choices: any[] = [] → choices: any[].
 * - normalizeOutcomes signature:
 *     rawOutcomes: any[] = [] → rawOutcomes: any[]
 *     choices: any[] = [] → choices: any[]
 *     context: any = {} → context: any
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 2 internal callsite 동작 그대로.
 * - body Array.isArray / forEach / clamp / toInt / normalizeText 호출 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 527: dedupeChoices signature에서 choices default [] 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('const dedupeChoices');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/choices:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'dedupeChoices choices default [] 제거');
    assert.ok(/\bchoices\b/.test(sig), 'choices 파라미터 자체는 보존');
});

test('cycle 527: normalizeOutcomes signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('const normalizeOutcomes');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/rawOutcomes:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'rawOutcomes default [] 제거');
    assert.ok(!/choices:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'normalizeOutcomes choices default [] 제거');
    assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
        'normalizeOutcomes context default {} 제거');
});

test('cycle 527: 정합성 가드 — 2 internal callsite 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/dedupeChoices\(\[\.\.\.rawChoices,\s*\.\.\.fallbackChoices\]\)\.slice\(0,\s*3\)/.test(source),
        'dedupeChoices spread + slice callsite 보존');
    assert.ok(/normalizeOutcomes\(raw\.outcomes,\s*choices,\s*\{ \.\.\.context,\s*desc \}\)/.test(source),
        'normalizeOutcomes 3 args callsite 보존');
});

test('cycle 527: body Array.isArray + forEach 가드 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/if \(Array\.isArray\(rawOutcomes\)\)/.test(source),
        'Array.isArray(rawOutcomes) 가드 보존 (undefined 안전)');
    assert.ok(/choices\.filter\(\(choice: any\) =>/.test(source),
        'dedupeChoices filter 보존');
    assert.ok(/choices\.forEach\(\(choice: any, idx: any\)/.test(source),
        'normalizeOutcomes choices.forEach 보존');
});

test('cycle 527: cycle 502-526 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/const toPercent[^=]*value:\s*any\s*=\s*0/.test(rp),
        'cycle 526 toPercent value default 0건');

    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/const hashString[^=]*value:\s*any\s*=\s*''/.test(aiu),
        'cycle 525 hashString value default 0건');
});
