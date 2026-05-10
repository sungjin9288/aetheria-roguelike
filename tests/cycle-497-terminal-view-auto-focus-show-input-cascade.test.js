import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 497: TerminalView `autoFocusInput` + `showInput` props 항상 false →
 *   cascade unreachable 정리
 *   (cycle 222-496 silent dead config 시리즈 248번째 — unreachable code path
 *   cascade cleanup, cycle 471-489 cascade lens 회귀).
 *
 * 발견 (2 props + cascade dead):
 * - src/components/TerminalView.tsx:
 *     · interface autoFocusInput?: boolean / showInput?: boolean.
 *     · destructure autoFocusInput = true / showInput = true.
 *     · body: `if (showInput && e.key === '/') ...` keybind 핸들러.
 *     · body: showFooter = Boolean(showInput || (player && ...)).
 *     · body: footerInput = showInput ? <input...> : null.
 *     · body: autoFocus={autoFocusInput}.
 * - 호출 사이트:
 *     · MobileGameLayout.tsx:89 — autoFocusInput={false}.
 *     · MobileGameLayout.tsx:93 — showInput={false}.
 *     · 1 callsite always passes false. default true는 도달 불가.
 * - 결과:
 *     · showInput 항상 false → '/' keybind 핸들러 dead, footerInput 항상 null,
 *       showFooter는 showQuickSlots와 동일.
 *     · autoFocusInput 항상 false → autoFocus attr 제거 (false 동작 동일).
 *
 * 패턴 (cycle 222-496 시리즈 248번째):
 * - cycle 471-489 cascade lens — caller 항상 falsy로 prop 전달 → default
 *   unreachable + body conditional 가지 dead.
 *
 * 수정 (src/components/TerminalView.tsx):
 * - interface에서 autoFocusInput / showInput 제거.
 * - destructure에서 두 prop 제거.
 * - '/' keybind 핸들러 제거.
 * - useEffect deps에서 showInput 제거.
 * - showFooter / footerInput const 제거.
 * - JSX footer 단순화 → {showQuickSlots && <div><QuickSlot /></div>}.
 * - autoFocus attr 제거.
 *
 * 호출 사이트 (MobileGameLayout.tsx):
 * - autoFocusInput={false} / showInput={false} 두 명시 attr 제거.
 *
 * 회귀 가드:
 * - logs / gameState / onCommand / player / quickSlots / onQuickSlotUse 보존.
 * - 본체 로그 / 토글 / 퀵슬롯 렌더 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 497: TerminalView destructure에서 autoFocusInput / showInput 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const fnIdx = source.indexOf('const TerminalView = ({');
    const fnEnd = source.indexOf('}: TerminalViewProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/autoFocusInput/.test(block), 'destructure에 autoFocusInput 0건');
    assert.ok(!/showInput/.test(block), 'destructure에 showInput 0건');
});

test('cycle 497: interface에서 autoFocusInput / showInput 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const ifaceIdx = source.indexOf('interface TerminalViewProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/autoFocusInput/.test(block), 'interface에 autoFocusInput 0건');
    assert.ok(!/showInput/.test(block), 'interface에 showInput 0건');
});

test('cycle 497: 본체 autoFocusInput / showInput / footerInput / showFooter 참조 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    assert.ok(!/autoFocusInput/.test(source), 'autoFocusInput 참조 0건');
    assert.ok(!/showInput/.test(source), 'showInput 참조 0건');
    assert.ok(!/footerInput/.test(source), 'footerInput const 0건');
    assert.ok(!/showFooter/.test(source), 'showFooter const 0건');
    assert.ok(!/autoFocus=/.test(source), 'autoFocus attr 0건');
});

test('cycle 497: 정합성 가드 — MobileGameLayout 두 명시 attr 제거', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const idx = source.indexOf('<TerminalView');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/autoFocusInput=/.test(jsx), 'callsite autoFocusInput 0건');
    assert.ok(!/showInput=/.test(jsx), 'callsite showInput 0건');
});

test('cycle 497: 핵심 props / 본체 로직 보존', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    assert.ok(/showQuickSlots/.test(source), 'showQuickSlots 보존');
    assert.ok(/showExpandToggle/.test(source), 'showExpandToggle 보존');
    assert.ok(/displayLogs/.test(source), 'displayLogs 보존');
    assert.ok(/<QuickSlot/.test(source), 'QuickSlot 렌더 보존');
});
