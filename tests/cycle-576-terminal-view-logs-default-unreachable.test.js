import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 576: TerminalView `logs = []` default unreachable
 *   (cycle 222-575 silent dead config 시리즈 315번째 — redundant default annotation
 *   청소 메가 시리즈 68번째).
 *
 * 발견 (1 default unreachable):
 * - src/components/TerminalView.tsx (line 93):
 *     const TerminalView = ({
 *         logs = [],
 *         gameState,
 *         onCommand,
 *         player,
 *         quickSlots,
 *         onQuickSlotUse,
 *     }: TerminalViewProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · MobileGameLayout.tsx:85 — <TerminalView logs={engine.logs} ... />
 *     · 다른 caller 0건.
 * - 결과: logs 항상 명시 전달. default [] 도달 불가.
 *
 * 패턴 (cycle 222-575 시리즈 315번째):
 * - cycle 502-575: default 청소 메가 시리즈 74사이클.
 * - cycle 576: components/ entry-level cleanup — cycle 572-575 4-cycle 시리즈
 *   에 이은 동일 lens.
 *
 * 수정 (src/components/TerminalView.tsx):
 * - signature에서 logs = [] → logs.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (MobileGameLayout) 동작 그대로.
 * - body logViewportRef / logExpanded / gameState 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 576: TerminalView signature에서 logs default 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const fnIdx = source.indexOf('const TerminalView = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/logs\s*=\s*\[\]/.test(sig),
        'TerminalView logs default [] 제거');
});

test('cycle 576: 정합성 가드 — MobileGameLayout callsite 보존', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    assert.ok(/<TerminalView[\s\S]*?logs=\{engine\.logs\}/.test(source),
        'MobileGameLayout <TerminalView logs={engine.logs} /> callsite 보존');
});

test('cycle 576: cycle 502-575 회귀 가드 — default 청소 시리즈 보존', async () => {
    const cp = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(!/const CombatPanel = \({[^}]+enemy\s*=\s*null/.test(cp),
        'cycle 575 CombatPanel enemy default 0건');

    const si = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(si),
        'cycle 574 SmartInventory quickSlots default 0건');
});
