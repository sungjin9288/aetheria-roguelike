import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 494: QuickSlot `dense` + QuickSlotAssigner `compact` props cascade
 *   unreachable batch 정리
 *   (cycle 222-493 silent dead config 시리즈 245번째 — unreachable code path
 *   같은 파일 2 internal const paired, cycle 458-459 / 491-492 패턴 회귀).
 *
 * 발견 (2 props + 다수 ternary 가지 unreachable):
 * - src/components/QuickSlot.tsx:
 *     · QuickSlot (line 22): destructure `dense = false`. 1 callsite (TerminalView)
 *       전달 0건 → 항상 false. 본체 9 ternary 모두 false 가지 선택.
 *     · QuickSlotAssigner (line 69): destructure `compact = false`. 1 callsite
 *       (SmartInventory, cycle 482 cleanup으로 compact 전달 제거) → 항상 false.
 *       본체 5 ternary 모두 false 가지 선택.
 *
 * 패턴 (cycle 222-493 시리즈 245번째):
 * - cycle 458-459 / 491-492: StatusBar 같은 파일 2 internal const paired.
 * - cycle 484: MobileGameLayout 2 internal helper props batch.
 * - cycle 494: QuickSlot 같은 파일 2 internal const paired — 동일 lens.
 *
 * 수정 (src/components/QuickSlot.tsx):
 * - QuickSlot destructure에서 dense = false 제거.
 * - QuickSlot 본체 9 ternary 모두 false 가지로 inline.
 * - QuickSlotAssigner destructure에서 compact = false 제거.
 * - QuickSlotAssigner 본체 5 ternary 모두 false 가지로 inline.
 *
 * 회귀 가드:
 * - QuickSlot: slots / onUse / gameState prop 보존.
 * - QuickSlotAssigner: item / slotCount / onAssign / currentSlots prop 보존.
 * - 양쪽 callsite 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 494: QuickSlot destructure에서 dense 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const fnIdx = source.indexOf('const QuickSlot =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
});

test('cycle 494: QuickSlot 본체 dense 참조 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const fnIdx = source.indexOf('const QuickSlot =');
    const fnEnd = source.indexOf('export const QuickSlotAssigner', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bdense\b/.test(block), '본체 dense 참조 0건');
});

test('cycle 494: QuickSlot interface에서 dense 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const ifaceIdx = source.indexOf('interface QuickSlotProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bdense\b/.test(block), 'interface에 dense 0건');
});

test('cycle 494: QuickSlotAssigner destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const fnIdx = source.indexOf('export const QuickSlotAssigner');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 494: QuickSlotAssigner 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const fnIdx = source.indexOf('export const QuickSlotAssigner');
    const block = source.slice(fnIdx);
    assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
});

test('cycle 494: 핵심 props 보존', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    // QuickSlot
    const qsIdx = source.indexOf('const QuickSlot =');
    const qsEnd = source.indexOf('=>', qsIdx);
    const qsSig = source.slice(qsIdx, qsEnd);
    assert.ok(/slots/.test(qsSig), 'QuickSlot slots 보존');
    assert.ok(/onUse/.test(qsSig), 'QuickSlot onUse 보존');
    assert.ok(/gameState/.test(qsSig), 'QuickSlot gameState 보존');
    // QuickSlotAssigner
    const qaIdx = source.indexOf('export const QuickSlotAssigner');
    const qaEnd = source.indexOf('=>', qaIdx);
    const qaSig = source.slice(qaIdx, qaEnd);
    assert.ok(/\bitem\b/.test(qaSig), 'QuickSlotAssigner item 보존');
    assert.ok(/slotCount/.test(qaSig), 'QuickSlotAssigner slotCount 보존');
    assert.ok(/onAssign/.test(qaSig), 'QuickSlotAssigner onAssign 보존');
    assert.ok(/currentSlots/.test(qaSig), 'QuickSlotAssigner currentSlots 보존');
});
