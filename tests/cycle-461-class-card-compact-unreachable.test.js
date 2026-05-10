import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 461: ClassCard `compact` prop + `if (compact)` 분기 unreachable 정리
 *   (cycle 222-460 silent dead config 시리즈 216번째 — unreachable code path
 *   cleanup lens, cycle 458/459 패턴 회귀).
 *
 * 발견 (1 prop + 9줄 분기 unreachable):
 * - src/components/ClassCard.tsx (line 30):
 *     const ClassCard = ({ jobName, onSelect, disabled = false, compact = false }: any) => {
 *         ...
 *         if (compact) {
 *             return <compact-render>;   // line 37-45
 *         }
 *         return <default-render>;        // line 47+
 *     }
 * - 호출 사이트 분석 (전체 src/):
 *     · JobChangePanel.tsx:51 — 1 callsite: <ClassCard jobName onSelect disabled />
 *       (player prop도 전달하나 destructure 미포함 — 별 사이클 target).
 *     · 다른 파일 import 0건.
 *     · compact 전달 caller 0건 → 항상 false.
 * - 결과: compact 항상 false → if (compact) 본체 9줄 unreachable.
 *
 * 패턴 (cycle 222-460 시리즈 216번째):
 * - cycle 458: StatusMetric inline prop unreachable.
 * - cycle 459: EnemyStatus compact prop unreachable.
 * - cycle 461: ClassCard compact prop unreachable — 동일 lens 회귀.
 *
 * 수정 (src/components/ClassCard.tsx):
 * - destructure에서 compact = false 제거.
 * - if (compact) {...} 블록 9줄 제거.
 * - default render만 보존.
 *
 * 회귀 가드:
 * - jobName / onSelect / disabled prop 보존.
 * - default render 동작 그대로.
 * - 1 callsite (compact 전달 0) 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 461: ClassCard destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/ClassCard.tsx');
    const fnIdx = source.indexOf('const ClassCard =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 461: if (compact) 분기 0건', async () => {
    const source = await readSrc('src/components/ClassCard.tsx');
    const fnIdx = source.indexOf('const ClassCard =');
    const fnEnd = source.indexOf('export default', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/if\s*\(\s*compact\s*\)/.test(block), 'if (compact) 분기 제거');
    assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
});

test('cycle 461: 정합성 가드 — JobChangePanel callsite compact 전달 0건', async () => {
    const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
    const idx = source.indexOf('<ClassCard');
    const jsxEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, jsxEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'callsite에 compact 전달 0건');
});

test('cycle 461: jobName / onSelect / disabled prop 보존', async () => {
    const source = await readSrc('src/components/ClassCard.tsx');
    const fnIdx = source.indexOf('const ClassCard =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/jobName/.test(sig), 'jobName 보존');
    assert.ok(/onSelect/.test(sig), 'onSelect 보존');
    assert.ok(/disabled/.test(sig), 'disabled 보존');
});
