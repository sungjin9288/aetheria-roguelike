import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 487: QuestBoardPanel `mobileFocused` cascade unreachable 정리
 *   (cycle 222-486 silent dead config 시리즈 239번째 — unreachable code path
 *   cascade cleanup, cycle 486 paired completion).
 *
 * 발견 (1 prop + 2 ternary 가지 unreachable, 1 ternary 두 가지 동일):
 * - src/components/tabs/QuestBoardPanel.tsx:
 *     · interface mobileFocused?: boolean.
 *     · destructure mobileFocused = false.
 *     · line 81: `mobileFocused ? <mobile-class> : <non-mobile-class>` —
 *       non-mobile branch unreachable.
 *     · line 90: `bleedClassName={mobileFocused ? '-mx-4 px-4' : '-mx-4 px-4'}` —
 *       두 가지 IDENTICAL → ternary 자체가 dead.
 * - 호출 사이트:
 *     · ControlPanel.tsx:204 — mobileFocused={mobileFocused} 전달.
 *     · ControlPanel은 MobileGameLayout (cycle 486 분석)에서 항상 mobileFocused
 *       =true 받으므로 forward도 항상 true.
 *     · 다른 파일 import 0건.
 * - 결과: mobileFocused 항상 true → ternary 첫 가지만 진입.
 *
 * 패턴 (cycle 222-486 시리즈 239번째):
 * - cycle 486: ControlPanel mobileFocused cascade.
 * - cycle 487: QuestBoardPanel — paired completion (subchild cascade).
 *
 * 수정 (src/components/tabs/QuestBoardPanel.tsx):
 * - interface mobileFocused 제거.
 * - destructure mobileFocused = false 제거.
 * - line 81 ternary → mobile-class 가지만 inline.
 * - line 90 identical-branches ternary → 정적 '-mx-4 px-4'.
 *
 * 호출 사이트 (ControlPanel.tsx:204):
 * - mobileFocused 전달 자체 제거.
 *
 * 회귀 가드:
 * - player / actions / setGameState / onOpenArchiveConsole prop 보존.
 * - 본체 quest list / bounty / Mission Terminal UI 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 487: QuestBoardPanel destructure에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const fnIdx = source.indexOf('const QuestBoardPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/mobileFocused/.test(sig), 'destructure에 mobileFocused 0건');
});

test('cycle 487: interface에서 mobileFocused 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const ifaceIdx = source.indexOf('interface QuestBoardPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/mobileFocused/.test(block), 'interface에 mobileFocused 0건');
});

test('cycle 487: 본체에서 mobileFocused 참조 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(!/mobileFocused/.test(source), 'mobileFocused 참조 0건');
});

test('cycle 487: 정합성 가드 — ControlPanel <QuestBoardPanel> mobileFocused 전달 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const idx = source.indexOf('<QuestBoardPanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/mobileFocused/.test(jsx), 'ControlPanel <QuestBoardPanel> mobileFocused 전달 0건');
});

test('cycle 487: player / actions / setGameState / onOpenArchiveConsole prop 보존', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const fnIdx = source.indexOf('const QuestBoardPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
    assert.ok(/setGameState/.test(sig), 'setGameState prop 보존');
    assert.ok(/onOpenArchiveConsole/.test(sig), 'onOpenArchiveConsole prop 보존');
});
