import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 489: EventPanel `mobileFocused` cascade unreachable 정리
 *   (cycle 222-488 silent dead config 시리즈 241번째 — unreachable code path
 *   cascade cleanup, cycle 486-488 cascade의 마지막 subchild paired completion).
 *
 * 발견 (1 prop + 1 unreachable 분기 26줄 + 1 dead const):
 * - src/components/EventPanel.tsx:
 *     · interface mobileFocused?: boolean.
 *     · destructure mobileFocused.
 *     · const overlayPanelClass (mobileFocused 비-truthy 가지 전용).
 *     · `if (mobileFocused) { return <mobile-focused JSX>; }` 분기.
 *     · `return <Motion.div ... fixed inset-0 z-30> ... overlayPanelClass ...`
 *       비-mobile-focused fallback 26줄 unreachable.
 * - 호출 사이트:
 *     · ControlPanel.tsx:192 — mobileFocused={mobileFocused} 전달.
 *     · ControlPanel은 cycle 486에서 mobileFocused 항상 truthy → forward도 truthy.
 *     · 다른 파일 import 0건.
 * - 결과: mobileFocused 항상 true → if 분기 항상 진입, fallback unreachable.
 *
 * 패턴 (cycle 222-488 시리즈 241번째):
 * - cycle 486 → 487 (QuestBoardPanel) → 488 (ShopPanel) → 489 (EventPanel) cascade
 *   4사이클로 ControlPanel 트리의 mobileFocused prop 일괄 정리 완료.
 *
 * 수정 (src/components/EventPanel.tsx):
 * - interface mobileFocused?: boolean 제거.
 * - destructure mobileFocused 제거.
 * - overlayPanelClass const 제거 (cascade dead).
 * - `if (mobileFocused) { return <mobile-focused>; }` → 직접 mobile-focused
 *   return으로 단순화 (function body 단일 return).
 * - 비-mobile-focused fallback 26줄 제거.
 *
 * 호출 사이트 (ControlPanel.tsx:192):
 * - mobileFocused 전달 자체 제거.
 *
 * 회귀 가드:
 * - currentEvent / actions prop 보존.
 * - 본체 panelBody / FocusPanelHeader / choices / dismiss 로직 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 489: EventPanel destructure에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    const fnIdx = source.indexOf('const EventPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/mobileFocused/.test(sig), 'destructure에 mobileFocused 0건');
});

test('cycle 489: interface에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    const ifaceIdx = source.indexOf('interface EventPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/mobileFocused/.test(block), 'interface에 mobileFocused 0건');
});

test('cycle 489: 본체 mobileFocused / overlayPanelClass 참조 0건', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    assert.ok(!/mobileFocused/.test(source), '본체 mobileFocused 참조 0건');
    assert.ok(!/overlayPanelClass/.test(source), 'overlayPanelClass 0건');
});

test('cycle 489: 정합성 가드 — ControlPanel <EventPanel> mobileFocused 전달 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const idx = source.indexOf('<EventPanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/mobileFocused/.test(jsx), 'ControlPanel <EventPanel> mobileFocused 전달 0건');
});

test('cycle 489: ControlPanel mobileFocused prop 완전 cascade 제거', async () => {
    // cycle 489 후 ControlPanel은 모든 subchild에 mobileFocused forward 0건이라
    // ControlPanel destructure + interface + MobileGameLayout 2 callsite의 prop도
    // cascade dead로 정리. cycle 486-489 4사이클 cascade 마무리.
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/mobileFocused/.test(source), 'ControlPanel mobileFocused 0건 (cascade 완료)');
    const layout = await readSrc('src/components/app/MobileGameLayout.tsx');
    const matches = layout.match(/<ControlPanel[\s\S]*?\/>/g) || [];
    matches.forEach((m, i) => {
        assert.ok(!/mobileFocused/.test(m), `MobileGameLayout callsite ${i}에 mobileFocused 0건`);
    });
});

test('cycle 489: currentEvent / actions / panelBody 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    assert.ok(/currentEvent/.test(source), 'currentEvent prop 보존');
    assert.ok(/actions/.test(source), 'actions prop 보존');
    assert.ok(/handleEventChoice/.test(source), 'handleEventChoice 호출 보존');
    assert.ok(/dismissEvent/.test(source), 'dismissEvent 호출 보존');
});
