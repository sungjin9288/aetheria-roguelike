import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 296: getSynthesisOutputs export → private downgrade
 *   (cycle 222-295 silent dead config 시리즈 66번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/synthesisUtils.ts: getSynthesisOutputs — validateSynthesis (line 76),
 *   performSynthesis (line 104) 내부 2회 사용, 외부 consumer 0건 (test 0건).
 *
 * 패턴 (cycle 222-295 silent dead config 시리즈 66번째):
 * - cycle 295: jobOutfitAffinity 4 type exports private downgrade.
 * - cycle 296: getSynthesisOutputs private downgrade — export 표면 1개 축소.
 *
 * 수정 (src/utils/synthesisUtils.ts):
 * - `export const getSynthesisOutputs` → `const getSynthesisOutputs` (private).
 *
 * 회귀 가드:
 * - validateSynthesis / performSynthesis / isSynthesizable / getSynthesisGroups
 *   active export 유지.
 * - 내부 호출 chain 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 296: getSynthesisOutputs export 제거 (private)', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    assert.ok(!/export const getSynthesisOutputs/.test(source),
        'getSynthesisOutputs export 제거됨');
    assert.ok(/const getSynthesisOutputs/.test(source),
        'getSynthesisOutputs const 정의 유지 (private)');
});

test('cycle 296: synthesisUtils active exports 유지', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    const activeExports = ['isSynthesizable', 'validateSynthesis', 'performSynthesis', 'getSynthesisGroups'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 296: validateSynthesis 동작 보존 (회귀 가드 — getSynthesisOutputs 내부 사용)', async () => {
    const { validateSynthesis } = await import('../src/utils/synthesisUtils.js');
    // 인자 부족 → invalid 반환.
    const result = validateSynthesis([], 0);
    assert.equal(result.valid, false, 'empty inputs → invalid');
    assert.equal(result.reason, 'NOT_ENOUGH', 'reason NOT_ENOUGH');
});

test('cycle 295 회귀 가드: jobOutfitAffinity 4 type private 유지', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    assert.ok(!/export type AffinityTier\b/.test(source),
        'cycle 295 AffinityTier private 유지');
    assert.ok(!/export interface OutfitAffinity\b/.test(source),
        'cycle 295 OutfitAffinity private 유지');
});
