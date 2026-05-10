import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 491: StatusMetric `compact` + `dense` props cascade unreachable 정리
 *   (cycle 222-490 silent dead config 시리즈 242번째 — unreachable code path
 *   cleanup lens, cycle 458-459 같은 파일 paired 변형 회귀).
 *
 * 발견 (2 props + chained ternary 가지 unreachable):
 * - src/components/StatusBar.tsx (line 27):
 *     const StatusMetric = ({ label, value, max, variant = 'hp',
 *         compact = false, dense = false }: any) => {
 *     body: `${dense ? X : compact ? Y : Z}` chained ternary 3건
 * - 호출 사이트 분석:
 *     · StatusBar.tsx:231-233 — 3 callsite 모두 `compact` shorthand (= true) 전달.
 *     · 0 callsite passes `dense`.
 *     · StatusMetric은 internal const, export 0건.
 * - 결과:
 *     · dense 항상 false → ternary first 가지 (X) 항상 unreachable.
 *     · compact 항상 true → ternary middle 가지 (Y) 항상 진입. last 가지 (Z) unreachable.
 *
 * 패턴 (cycle 222-490 시리즈 242번째):
 * - cycle 458 같은 파일에서 StatusMetric inline prop unreachable.
 * - cycle 459 EnemyStatus compact unreachable.
 * - cycle 491: 같은 컴포넌트의 잔존 cascade unreachable 추가 정리.
 *
 * 수정 (src/components/StatusBar.tsx):
 * - StatusMetric destructure에서 compact = false / dense = false 제거.
 * - body 3 chained ternary → compact 가지만 inline (Y).
 * - 3 callsite의 compact shorthand 제거 (prop 자체 제거되므로).
 *
 * 회귀 가드:
 * - label / value / max / variant prop 보존.
 * - 3 callsite 시각 출력 그대로 (compact 가지 = px-2 py-1.5 / text-[8px] / mt-1 h-1).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 491: StatusMetric destructure에서 compact / dense 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
    assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
});

test('cycle 491: StatusMetric 본체 compact / dense 참조 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const fnEnd = source.indexOf('const EnemyStatus =', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
    assert.ok(!/\bdense\b/.test(block), '본체 dense 참조 0건');
});

test('cycle 491: 정합성 가드 — 3 callsite compact 명시 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const matches = source.match(/<StatusMetric[^/]*\/>/g) || [];
    assert.equal(matches.length, 3, 'StatusMetric 호출 3건');
    matches.forEach((m, i) => {
        assert.ok(!/\bcompact\b/.test(m), `callsite ${i}에 compact 명시 0건`);
        assert.ok(!/\bdense\b/.test(m), `callsite ${i}에 dense 명시 0건`);
    });
});

test('cycle 491: compact 가지 className 정적 inline (px-2 py-1.5 / text-[8px] / mt-1 h-1)', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const fnEnd = source.indexOf('const EnemyStatus =', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/px-2 py-1\.5/.test(block), 'compact 가지 padding 보존');
    assert.ok(/text-\[8px\]/.test(block), 'compact 가지 font size 보존');
    assert.ok(/mt-1 h-1/.test(block), 'compact 가지 bar 크기 보존');
});

test('cycle 491: label / value / max / variant prop 보존', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\blabel\b/.test(sig), 'label 보존');
    assert.ok(/\bvalue\b/.test(sig), 'value 보존');
    assert.ok(/\bmax\b/.test(sig), 'max 보존');
    assert.ok(/variant/.test(sig), 'variant 보존');
});
