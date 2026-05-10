import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 482: SmartInventory `compact` prop cascade unreachable 정리
 *   (cycle 222-481 silent dead config 시리즈 234번째 — unreachable code path
 *   cascade cleanup, cycle 471 cascade의 11번째 / 마지막 panel paired completion).
 *
 * 발견 (1 prop + 1 state + 5 const + 33 ternary 가지 + multiple conditional UI 블록 dead):
 * - src/components/SmartInventory.tsx:
 *     · interface compact?: boolean.
 *     · destructure compact (last param).
 *     · useState(false) showAllItems + setShowAllItems.
 *     · MAX_COMPACT_ITEMS const.
 *     · visibleFiltered IIFE / hiddenItemCount.
 *     · useSummaryCards / useDenseCompactInventory const.
 *     · inventorySectionLabel const (showAllItems 의존 → cascade dead).
 *     · 본체 33 ternary (className compact ? 'tight' : 'loose').
 *     · {compact && (hiddenItemCount > 0 || showAllItems)} 토글 헤더 블록.
 * - 호출 사이트:
 *     · Dashboard.tsx:155 — cycle 471이 compact prop 제거. caller 0건.
 *     · 다른 파일 import 0건.
 * - 결과: compact 항상 undefined → cascade 전체 unreachable.
 *
 * cycle 471 → 472-479 → 481 → 482 cascade lens 11번째 / 마지막 panel.
 * Dashboard cascade가 481+482로 마무리되어 모든 compact prop dead 정리 완료.
 *
 * 수정 (src/components/SmartInventory.tsx):
 * - interface compact 제거.
 * - destructure compact 제거 (마지막 param이라 trailing comma 처리).
 * - useState showAllItems + setShowAllItems 제거.
 * - MAX_COMPACT_ITEMS / visibleFiltered / hiddenItemCount /
 *   useSummaryCards / useDenseCompactInventory / inventorySectionLabel 제거.
 * - 33 ternary 모두 false 가지로 inline.
 * - 토글 헤더 블록 제거.
 * - visibleFiltered → filtered 직접 사용.
 *
 * 회귀 가드:
 * - player / actions / quickSlots / onAssignQuickSlot / spotlight /
 *   onClearSpotlight prop 보존.
 * - 본체 inventory list / FILTERS / signature / 추천 장착 / 일괄 정리 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 482: SmartInventory destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    const fnIdx = source.indexOf('const SmartInventory =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 482: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    const ifaceIdx = source.indexOf('interface SmartInventoryProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 482: cascade dead 0건', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(!/showAllItems/.test(source), 'showAllItems 0건');
    assert.ok(!/hiddenItemCount/.test(source), 'hiddenItemCount 0건');
    assert.ok(!/useSummaryCards/.test(source), 'useSummaryCards 0건');
    assert.ok(!/useDenseCompactInventory/.test(source), 'useDenseCompactInventory 0건');
    assert.ok(!/visibleFiltered/.test(source), 'visibleFiltered 0건');
    assert.ok(!/MAX_COMPACT_ITEMS/.test(source), 'MAX_COMPACT_ITEMS 0건');
});

test('cycle 482: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 482: 정합성 가드 — Dashboard <SmartInventory> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<SmartInventory');
    // multi-line tag — 다음 `/>` 까지 잘라 검사
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <SmartInventory> compact 전달 0건');
});

test('cycle 482: player / actions / quickSlots / spotlight 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(/FILTERS/.test(source), 'FILTERS 보존');
    assert.ok(/QuickSlotAssigner/.test(source), 'QuickSlotAssigner 보존');
    const fnIdx = source.indexOf('const SmartInventory =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/quickSlots/.test(sig), 'quickSlots prop 보존');
    assert.ok(/spotlight/.test(sig), 'spotlight prop 보존');
});

test('cycle 482: cycle 471 cascade 완료 — Dashboard 11 panel 모두 cascade 정리됨', async () => {
    // cycle 471 → 472-479, 481-482로 11 panel 모두 cascade 완료.
    // Dashboard renderTabContent 내 callsite 어디에도 compact prop 전달 0건.
    const source = await readSrc('src/components/Dashboard.tsx');
    const renderIdx = source.indexOf('const renderTabContent =');
    const renderEnd = source.indexOf('const renderMobileArchiveRail =');
    const block = source.slice(renderIdx, renderEnd);
    assert.ok(!/compact=/.test(block), 'renderTabContent 내 compact prop 전달 0건 (cascade 완료)');
});
