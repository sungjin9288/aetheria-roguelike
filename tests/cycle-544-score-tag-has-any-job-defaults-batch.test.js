import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 544: scoreTag + hasAnyJob 2 defaults batch unreachable
 *   (cycle 222-543 silent dead config 시리즈 286번째 — redundant default annotation
 *   청소 메가 시리즈 39번째). runProfile.ts 같은 모듈 batch.
 *
 * 발견 (2 defaults batch, runProfile.ts 같은 모듈 private helpers):
 * - src/utils/runProfile.ts (line 18, 33):
 *     · scoreTag (id, name, score, reasons: any[] = [])
 *     · hasAnyJob (item, jobs: any[] = [])
 * - 호출 사이트 (모두 모듈 내부 private):
 *     · scoreTag:8 callsite (line 61/71/82/95/106/117/126/136) — 모두 reasons
 *       명시 전달.
 *     · hasAnyJob:8 callsite (line 253/260/267/274/279/...) — 모두 jobs
 *       명시 전달 (배열 리터럴).
 *     · 다른 caller 0건 (private 모듈 helper).
 * - 결과: 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-543 시리즈 286번째):
 * - cycle 502-543: default 청소 메가 시리즈 42사이클.
 * - cycle 544: runProfile.ts 같은 모듈 batch — cycle 526 toPercent에 이은
 *   동일 모듈 추가 cleanup.
 *
 * 수정 (src/utils/runProfile.ts):
 * - scoreTag signature: reasons: any[] = [] → reasons: any[].
 * - hasAnyJob signature: jobs: any[] = [] → jobs: any[].
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 16 internal callsite 동작 그대로.
 * - body Array.isArray / .some / .includes 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 544: scoreTag signature에서 reasons default [] 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('const scoreTag');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/reasons:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'scoreTag reasons default [] 제거');
});

test('cycle 544: hasAnyJob signature에서 jobs default [] 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('const hasAnyJob');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/jobs:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'hasAnyJob jobs default [] 제거');
});

test('cycle 544: 정합성 가드 — 16 internal callsite 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const scoreTagCalls = (source.match(/scoreTag\(/g) || []).length;
    assert.equal(scoreTagCalls, 8, `scoreTag callsite 8건 보존: ${scoreTagCalls}건`);
    const hasAnyJobCalls = (source.match(/hasAnyJob\(/g) || []).length;
    assert.equal(hasAnyJobCalls, 8, `hasAnyJob callsite 8건 보존: ${hasAnyJobCalls}건`);
});

test('cycle 544: body 동작 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/Array\.isArray\(item\?\.jobs\) && jobs\.some\(/.test(source),
        'hasAnyJob Array.isArray + .some 보존');
    assert.ok(/const scoreTag = \(id: any, name: any, score: any, reasons: any\[\]\) => \(\{\s*\n\s*id,\s*\n\s*name,\s*\n\s*score,\s*\n\s*reasons,\s*\n\s*\}\)/.test(source),
        'scoreTag return shape 보존');
});

test('cycle 544: cycle 502-543 회귀 가드 — default 청소 시리즈 보존', async () => {
    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(!/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\s*=\s*false\)/.test(inv),
        'cycle 543 synthesize useProtect default 0건');

    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const signedDelta\s*=\s*\(value:\s*any\s*=\s*0/.test(sp),
        'cycle 542 signedDelta value default 0건');
});
