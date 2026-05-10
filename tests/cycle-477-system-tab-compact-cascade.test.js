import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 477: SystemTab `compact` prop cascade unreachable 정리
 *   (cycle 222-476 silent dead config 시리즈 230번째 — unreachable code path
 *   cascade cleanup, cycle 471-476 paired 7사이클).
 *
 * 발견 (1 prop + 1 state + 1 const + 8 ternary 가지 + 2 conditional UI 블록 dead):
 * - src/components/tabs/SystemTab.tsx:
 *     · interface line 24: compact?: boolean.
 *     · destructure line 27: compact = false.
 *     · line 30: useState(false) showAllSystem + setShowAllSystem.
 *     · line 195: showSystemSummary = compact && !showAllSystem (항상 false).
 *     · 본체 8 ternary: className compact gating.
 *     · line 199-210: {compact && <header + 토글 button>} 블록.
 *     · line 250: {!showSystemSummary && <pre>} → 항상 진입.
 *     · line 257-294: {showSystemSummary ? <summary> : <full>} ternary 첫 가지.
 * - 호출 사이트:
 *     · Dashboard.tsx:236 — cycle 471이 compact prop 제거. caller 0건.
 * - 결과: compact 항상 undefined → cascade 전체 unreachable.
 *
 * cycle 471 → 472 → 473 → 474 → 475 → 476 → 477 cascade 7사이클 paired.
 *
 * 수정 (src/components/tabs/SystemTab.tsx):
 * - interface compact 제거.
 * - destructure compact = false 제거.
 * - useState showAllSystem + setShowAllSystem 제거.
 * - showSystemSummary const 제거.
 * - 8 className ternary 정적 (false 가지).
 * - 토글 버튼 헤더 블록 제거.
 * - {!showSystemSummary && <pre>} → 직접 <pre> 렌더.
 * - {showSystemSummary ? <summary> : <full>} → 직접 <full> 렌더.
 *
 * 회귀 가드:
 * - player / actions / stats / runtime prop 보존.
 * - 본체 QA readout / relics / titles / daily / hall 섹션 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 477: SystemTab destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/tabs/SystemTab.tsx');
    const fnIdx = source.indexOf('const SystemTab =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 477: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/tabs/SystemTab.tsx');
    const ifaceIdx = source.indexOf('interface SystemTabProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 477: cascade dead 0건 (showAllSystem / showSystemSummary)', async () => {
    const source = await readSrc('src/components/tabs/SystemTab.tsx');
    assert.ok(!/showAllSystem/.test(source), 'showAllSystem 0건');
    assert.ok(!/showSystemSummary/.test(source), 'showSystemSummary 0건');
});

test('cycle 477: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/tabs/SystemTab.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 477: 정합성 가드 — Dashboard <SystemTab> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<SystemTab');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <SystemTab> compact 전달 0건');
});

test('cycle 477: player / actions / stats / runtime / qaReadout / leaderboard 보존', async () => {
    const source = await readSrc('src/components/tabs/SystemTab.tsx');
    assert.ok(/qaReadout/.test(source), 'qaReadout 보존');
    assert.ok(/leaderboard/.test(source), 'leaderboard 보존');
    const fnIdx = source.indexOf('const SystemTab =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
    assert.ok(/\bruntime\b/.test(sig), 'runtime prop 보존');
});
