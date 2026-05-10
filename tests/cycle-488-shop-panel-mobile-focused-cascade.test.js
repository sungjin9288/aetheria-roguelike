import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 488: ShopPanel `mobileFocused` cascade unreachable 정리
 *   (cycle 222-487 silent dead config 시리즈 240번째 — unreachable code path
 *   cascade cleanup, cycle 486-487 paired completion, ShopPanel 차례).
 *
 * 발견 (1 prop + 1 ternary 가지 unreachable + 1 dead helper):
 * - src/components/ShopPanel.tsx:
 *     · interface mobileFocused?: boolean.
 *     · destructure mobileFocused = false.
 *     · const getOverlayPanelClass helper (mobileFocused 비-truthy 가지 전용).
 *     · line 168: `mobileFocused ? <mobile-class> : <overlay-class>` —
 *       overlay-class branch unreachable.
 * - 호출 사이트:
 *     · ControlPanel.tsx:196 — mobileFocused={mobileFocused} 전달.
 *     · ControlPanel은 cycle 486 분석에서 mobileFocused 항상 truthy → forward도 truthy.
 *     · 다른 파일 import 0건.
 * - 결과: mobileFocused 항상 true → ternary 첫 가지만 진입 → getOverlayPanelClass
 *   dead.
 *
 * 패턴 (cycle 222-487 시리즈 240번째):
 * - cycle 486: ControlPanel mobileFocused cascade.
 * - cycle 487: QuestBoardPanel paired.
 * - cycle 488: ShopPanel paired (subchild cascade 3번째).
 *
 * 수정 (src/components/ShopPanel.tsx):
 * - interface mobileFocused?: boolean 제거.
 * - destructure mobileFocused = false 제거.
 * - getOverlayPanelClass helper 제거 (cascade dead).
 * - line 168 ternary → mobile-class 가지만 inline.
 *
 * 호출 사이트 (ControlPanel.tsx:196):
 * - mobileFocused 전달 자체 제거.
 *
 * 회귀 가드:
 * - player / actions / shopItems / setGameState / stats / onOpenArchiveConsole prop 보존.
 * - 본체 shop 로직 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 488: ShopPanel destructure에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const ShopPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/mobileFocused/.test(sig), 'destructure에 mobileFocused 0건');
});

test('cycle 488: interface에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const ifaceIdx = source.indexOf('interface ShopPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/mobileFocused/.test(block), 'interface에 mobileFocused 0건');
});

test('cycle 488: getOverlayPanelClass / mobileFocused 본체 참조 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/getOverlayPanelClass/.test(source), 'getOverlayPanelClass 0건');
    assert.ok(!/mobileFocused/.test(source), '본체 mobileFocused 참조 0건');
});

test('cycle 488: 정합성 가드 — ControlPanel <ShopPanel> mobileFocused 전달 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const idx = source.indexOf('<ShopPanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/mobileFocused/.test(jsx), 'ControlPanel <ShopPanel> mobileFocused 전달 0건');
});

test('cycle 488: 핵심 props 보존', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const ShopPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
    assert.ok(/shopItems/.test(sig), 'shopItems prop 보존');
    assert.ok(/setGameState/.test(sig), 'setGameState prop 보존');
    assert.ok(/onOpenArchiveConsole/.test(sig), 'onOpenArchiveConsole prop 보존');
});
