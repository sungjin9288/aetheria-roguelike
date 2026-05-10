import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 475: StatsPanel `compact` prop cascade unreachable 정리
 *   (cycle 222-474 silent dead config 시리즈 228번째 — unreachable code path
 *   cascade cleanup, cycle 471/472/473/474 paired 5사이클).
 *
 * 발견 (1 prop + 1 state + 3 const + 8 ternary 가지 + 1 toggle UI 블록 dead):
 * - src/components/StatsPanel.tsx:
 *     · interface line 11: compact?: boolean.
 *     · destructure line 43: ({ player, stats, compact }).
 *     · line 44: useState(false) showAllStats + setShowAllStats.
 *     · line 104: visibleStatEntries (compact && !showAllStats 가지).
 *     · line 105: hasExpandableSections (compact && ...).
 *     · line 106: topKillPreview (compact && !showAllStats 가지에만 진입).
 *     · line 109: className ${compact ? X : Y}.
 *     · line 114: {hasExpandableSections && <toggle button>}.
 *     · line 125: container className compact ternary.
 *     · line 151: passiveParts.slice(... compact && !showAllStats ? 2 : full).
 *     · line 155/286/312: {(!compact || showAllStats) && <sections>}.
 *     · line 280: {compact && !showAllStats && topKillPreview && <preview>}.
 * - 호출 사이트:
 *     · Dashboard.tsx:208 — cycle 471이 compact prop 제거. caller 0건.
 *     · 다른 파일 import 0건.
 * - 결과: compact 항상 undefined → cascade 전체 unreachable.
 *
 * 패턴 (cycle 222-474 시리즈 228번째):
 * - cycle 471 → 472 → 473 → 474 → 475 cascade 5사이클 paired.
 *
 * 수정 (src/components/StatsPanel.tsx):
 * - interface compact 제거.
 * - destructure compact 제거.
 * - useState showAllStats + setShowAllStats 제거.
 * - visibleStatEntries → statEntries 직접 사용.
 * - hasExpandableSections / topKillPreview 제거.
 * - 토글 버튼 JSX 제거.
 * - className compact ternary 정적화.
 * - (!compact || showAllStats) 가드 → 항상 true이므로 직접 sections 렌더.
 * - {compact && !showAllStats && topKillPreview && ...} 블록 제거.
 *
 * 회귀 가드:
 * - player / stats prop 보존.
 * - 본체 stats / passive / topKills / meta 섹션 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 475: StatsPanel destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const fnIdx = source.indexOf('const StatsPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 475: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const ifaceIdx = source.indexOf('interface StatsPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 475: cascade dead 0건 (showAllStats / hasExpandableSections / topKillPreview)', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.ok(!/showAllStats/.test(source), 'showAllStats 0건');
    assert.ok(!/hasExpandableSections/.test(source), 'hasExpandableSections 0건');
    assert.ok(!/topKillPreview/.test(source), 'topKillPreview 0건');
});

test('cycle 475: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 475: 정합성 가드 — Dashboard <StatsPanel> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<StatsPanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <StatsPanel> compact 전달 0건');
});

test('cycle 475: player / stats / topKills / passive 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const fnIdx = source.indexOf('const StatsPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
    assert.ok(/topKills/.test(source), 'topKills 로직 보존');
    assert.ok(/statEntries/.test(source), 'statEntries 로직 보존');
});
