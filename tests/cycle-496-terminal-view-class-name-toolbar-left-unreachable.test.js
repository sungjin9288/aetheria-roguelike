import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 496: TerminalView `className` + `toolbarLeft` props unreachable batch 정리
 *   (cycle 222-495 silent dead config 시리즈 247번째 — unreachable code path
 *   batch cleanup, cycle 463/465/466/493/495 lens + cycle 484 패턴 회귀).
 *
 * 발견 (2 props unreachable):
 * - src/components/TerminalView.tsx (line 80-103):
 *     interface TerminalViewProps { ..., className?: string, toolbarLeft?: any }
 *     destructure: className = '', toolbarLeft = null
 *     body line 225: showToolbar = Boolean(toolbarLeft) || showExpandToggle
 *     body line 230: `... ${className}` (interpolation)
 *     body line 244: {toolbarLeft} (render)
 * - 호출 사이트:
 *     · MobileGameLayout.tsx:85 — <TerminalView ...> 호출 (className / toolbarLeft 0건).
 *     · 다른 파일 import 0건.
 * - 결과:
 *     · className 항상 '' → ${className} 보간은 빈 문자열만 추가.
 *     · toolbarLeft 항상 null → Boolean(toolbarLeft) 항상 false →
 *       showToolbar는 showExpandToggle만 의존. {toolbarLeft} 렌더 0건.
 *
 * 패턴 (cycle 222-495 시리즈 247번째):
 * - cycle 463/465/466: ClassIcon/MonsterIcon/SignatureBadge className.
 * - cycle 493: AetherMark className.
 * - cycle 495: StatusBar className.
 * - cycle 496: TerminalView className + toolbarLeft batch — 같은 lens.
 *
 * 수정 (src/components/TerminalView.tsx):
 * - interface에서 className?: string / toolbarLeft?: any 제거.
 * - destructure에서 className = '' / toolbarLeft = null 제거.
 * - body line 225: showToolbar = showExpandToggle.
 * - body line 230: ${className} 보간 제거 → 정적 baseline + ${bgClass}.
 * - body line 244: {toolbarLeft} 제거 + 빈 wrapping div는 보존 (showExpandToggle
 *   조건부 렌더 유지).
 *
 * 회귀 가드:
 * - 다른 props (logs/gameState/onCommand/autoFocusInput/player/quickSlots/
 *   onQuickSlotUse/showInput) 보존.
 * - showExpandToggle / 토글 버튼 렌더 보존.
 * - 1 callsite 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 496: TerminalView destructure에서 className / toolbarLeft 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const fnIdx = source.indexOf('const TerminalView = ({');
    const fnEnd = source.indexOf('}: TerminalViewProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bclassName\s*=\s*''/.test(block), 'destructure에 className default 0건');
    assert.ok(!/\btoolbarLeft\b/.test(block), 'destructure에 toolbarLeft 0건');
});

test('cycle 496: interface에서 className / toolbarLeft 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const ifaceIdx = source.indexOf('interface TerminalViewProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/className\?:/.test(block), 'interface에 className 0건');
    assert.ok(!/toolbarLeft\?:/.test(block), 'interface에 toolbarLeft 0건');
});

test('cycle 496: body ${className} 보간 + {toolbarLeft} 렌더 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
    assert.ok(!/\btoolbarLeft\b/.test(source), 'toolbarLeft 본체 참조 0건');
});

test('cycle 496: 정합성 가드 — MobileGameLayout <TerminalView> className/toolbarLeft 0건', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const idx = source.indexOf('<TerminalView');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/className=/.test(jsx), 'callsite className 전달 0건');
    assert.ok(!/toolbarLeft/.test(jsx), 'callsite toolbarLeft 전달 0건');
});

test('cycle 496: 핵심 props 보존', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const fnIdx = source.indexOf('const TerminalView = ({');
    const fnEnd = source.indexOf('}: TerminalViewProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/logs/.test(block), 'logs prop 보존');
    assert.ok(/gameState/.test(block), 'gameState prop 보존');
    assert.ok(/onCommand/.test(block), 'onCommand prop 보존');
    assert.ok(/autoFocusInput/.test(block), 'autoFocusInput prop 보존');
    assert.ok(/showInput/.test(block), 'showInput prop 보존');
    assert.ok(/quickSlots/.test(block), 'quickSlots prop 보존');
});
