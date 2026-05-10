import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 445: SIGNATURE_PITY 객체에서 STEP_MULT 출력 dead 정리
 *   (cycle 222-444 silent dead config 시리즈 203번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/443 패턴).
 *
 * 발견 (1 dead exposed property):
 * - src/utils/signaturePity.ts SIGNATURE_PITY:
 *     `Object.freeze({ THRESHOLD, STEP_MULT, CAP })`
 * - 호출 사이트 (consumer) 분석:
 *     · LegendaryCodex.tsx — `SIGNATURE_PITY.THRESHOLD` / `SIGNATURE_PITY.CAP` read.
 *     · production `SIGNATURE_PITY.STEP_MULT` read 0건.
 *     · tests/signature-pity.test.js만 STEP_MULT 어설션.
 * - 내부 사용:
 *     `PITY_STEP_MULT` private const는 getSignaturePityMultiplier 내부에서 사용.
 *     SIGNATURE_PITY 객체로의 노출은 dead.
 *
 * 패턴 (cycle 222-444 시리즈 203번째):
 * - cycle 333-356/443: 함수 출력 dead 필드 cleanup.
 * - cycle 445: SIGNATURE_PITY.STEP_MULT 노출 dead — 동일 lens 회귀 (export object).
 *
 * 수정 (src/utils/signaturePity.ts):
 * - SIGNATURE_PITY 객체에서 STEP_MULT 제거 → THRESHOLD / CAP 2 properties만 노출.
 * - 내부 PITY_STEP_MULT const는 getSignaturePityMultiplier 동작용으로 보존.
 * - tests/signature-pity.test.js의 STEP_MULT 어설션 갱신.
 *
 * 회귀 가드:
 * - getSignaturePityMultiplier 동작 그대로 (PITY_STEP_MULT 내부 사용).
 * - SIGNATURE_PITY.THRESHOLD / .CAP 활성 노출 보존.
 * - LegendaryCodex의 pity status 표시 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 445: SIGNATURE_PITY 객체에서 STEP_MULT 0건', async () => {
    const source = await readSrc('src/utils/signaturePity.ts');
    const objIdx = source.indexOf('export const SIGNATURE_PITY');
    const objEnd = source.indexOf('});', objIdx);
    const block = source.slice(objIdx, objEnd);
    assert.ok(!/STEP_MULT:/.test(block),
        'SIGNATURE_PITY 객체에 STEP_MULT 노출 0건');
});

test('cycle 445: SIGNATURE_PITY.THRESHOLD / .CAP 활성 노출 보존', async () => {
    const { SIGNATURE_PITY } = await import('../src/utils/signaturePity.ts');
    assert.equal(typeof SIGNATURE_PITY.THRESHOLD, 'number', 'THRESHOLD 노출 보존');
    assert.equal(typeof SIGNATURE_PITY.CAP, 'number', 'CAP 노출 보존');
    assert.equal(SIGNATURE_PITY.STEP_MULT, undefined, 'STEP_MULT 미노출');
});

test('cycle 445: getSignaturePityMultiplier 동작 보존 (PITY_STEP_MULT 내부 사용)', async () => {
    const { getSignaturePityMultiplier, SIGNATURE_PITY } = await import('../src/utils/signaturePity.ts');
    // pity < THRESHOLD → 1.0
    assert.equal(getSignaturePityMultiplier(SIGNATURE_PITY.THRESHOLD - 1), 1.0);
    // pity == THRESHOLD → 1 + 1 * STEP_MULT (0.15)
    const oneStep = getSignaturePityMultiplier(SIGNATURE_PITY.THRESHOLD);
    assert.ok(oneStep > 1.0 && oneStep < SIGNATURE_PITY.CAP,
        '1-step boost 적용 (STEP_MULT 내부 동작)');
});

test('cycle 445: 정합성 가드 — production STEP_MULT 읽기 0건', async () => {
    const { readdir } = await import('node:fs/promises');
    async function* walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) yield* walk(fp);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
        }
    }
    let reads = 0;
    for await (const fp of walk(path.join(ROOT, 'src'))) {
        const content = await readFile(fp, 'utf8').catch(() => '');
        if (/SIGNATURE_PITY\.STEP_MULT/.test(content)) reads += 1;
    }
    assert.equal(reads, 0, 'src/ 어디서도 SIGNATURE_PITY.STEP_MULT 0건');
});

test('cycle 444 회귀 가드: handleMenuAction reset 분기 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const fnIdx = source.indexOf('const handleMenuAction');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/actionId === 'reset'/.test(block),
        'cycle 444 reset 분기 0건 보존');
});
