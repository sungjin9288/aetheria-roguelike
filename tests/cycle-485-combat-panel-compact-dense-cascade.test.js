import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 485: CombatPanel `compact` + `dense` props cascade unreachable 정리
 *   (cycle 222-484 silent dead config 시리즈 237번째 — unreachable code path
 *   cascade cleanup, cycle 471-482 패턴 회귀 + cycle 457 paired completion).
 *
 * 발견 (2 props + 다수 분기 + compactMetaEntries cascade dead):
 * - src/components/tabs/CombatPanel.tsx:
 *     · interface compact?: boolean / dense?: boolean.
 *     · destructure compact = false, dense = false.
 *     · 본체 14 ternary — slice limit / className / Motion.div / consumable grid /
 *       button padding / text size 등.
 *     · compactMetaEntries const (dense 가지 전용).
 *     · `{dense ? <compactMetaEntries> : <full>}` ternary first 가지.
 *     · `{!dense && <description>}` 가드.
 * - 호출 사이트:
 *     · ControlPanel.tsx:165 — cycle 457이 compact={false} dense={false} 명시 attr
 *       제거. 이제 compact/dense 전달 0건. mobile shorthand만 전달.
 *     · 다른 파일 import 0건 (ControlPanel만 import).
 * - 결과: compact/dense 항상 false (default). mobile 항상 true → ternary first 가지
 *   (compact) unreachable. dense 가지 unreachable. compactMetaEntries cascade dead.
 *
 * 패턴 (cycle 222-484 시리즈 237번째):
 * - cycle 457: ControlPanel <CombatPanel> 명시 false 2건 제거.
 * - cycle 471-482: Dashboard 11 panel cascade.
 * - cycle 485: CombatPanel cascade — cycle 457 paired completion으로 destructure
 *   default + 본체 분기 cascade 정리.
 *
 * 수정 (src/components/tabs/CombatPanel.tsx):
 * - interface compact / dense 제거.
 * - destructure compact = false, dense = false 제거.
 * - line 82 slice limit: dense ? 3 : mobile || compact ? 4 : 6 → mobile ? 4 : 6.
 *   (mobile is the only flag remaining)
 * - className 외부 ternary 단순화 (compact 가지 제거 → mobile/static).
 * - {dense ? <compactMetaEntries> : <full>} → 직접 <full>.
 * - compactMetaEntries const 제거 (cascade dead).
 * - consumable grid: dense ? 'grid-cols-1' : mobile || compact ? 'grid-cols-2' :
 *   'grid-cols-3' → mobile ? 'grid-cols-2' : 'grid-cols-3'.
 * - button padding: dense ? ... : mobile ? ... : ... → mobile ? ... : ...
 * - text size: dense ? 'text-[10px]' : 'text-[11px]' → 정적 'text-[11px]'.
 * - {!dense && <desc>} → 직접 <desc> 렌더.
 *
 * 회귀 가드:
 * - player / actions / enemy / stats / isAiThinking / mobile prop 보존.
 * - 본체 combat / skill / consumable / boss / combo / telegraph 로직 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 485: CombatPanel destructure에서 compact / dense 0건', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const fnIdx = source.indexOf('const CombatPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
    assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
});

test('cycle 485: interface에서 compact / dense 0건', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const ifaceIdx = source.indexOf('interface CombatPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
    assert.ok(!/\bdense\b/.test(block), 'interface에 dense 0건');
});

test('cycle 485: 본체 compact / dense / compactMetaEntries 참조 0건', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
    assert.ok(!/\bdense\b/.test(source), 'dense 참조 0건');
    assert.ok(!/compactMetaEntries/.test(source), 'compactMetaEntries 0건');
});

test('cycle 485: 정합성 가드 — ControlPanel <CombatPanel> compact / dense 전달 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const idx = source.indexOf('<CombatPanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'ControlPanel <CombatPanel> compact 전달 0건');
    assert.ok(!/\bdense\b/.test(jsx), 'ControlPanel <CombatPanel> dense 전달 0건');
});

test('cycle 485: player / actions / enemy / stats / isAiThinking / mobile prop 보존', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const fnIdx = source.indexOf('const CombatPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
    assert.ok(/\benemy\b/.test(sig), 'enemy prop 보존');
    assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
    assert.ok(/isAiThinking/.test(sig), 'isAiThinking prop 보존');
    assert.ok(/\bmobile\b/.test(sig), 'mobile prop 보존');
});
