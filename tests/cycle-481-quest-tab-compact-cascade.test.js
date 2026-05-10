import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 481: QuestTab `compact` prop cascade unreachable 정리
 *   (cycle 222-480 silent dead config 시리즈 233번째 — unreachable code path
 *   cascade cleanup, cycle 471-479 paired 10사이클).
 *
 * 발견 (1 prop + 1 state + 3 const + 33 ternary 가지 + multiple conditional UI 블록 dead):
 * - src/components/tabs/QuestTab.tsx:
 *     · interface compact?: boolean.
 *     · destructure compact = false.
 *     · useState(false) showAllQuests + setShowAllQuests.
 *     · visibleQuestEntries IIFE (compact && !showAllQuests 가지).
 *     · hiddenQuestCount const.
 *     · useQuestSummaryCards const.
 *     · 본체 33 ternary (mostly className compact ? 'tight' : 'loose').
 *     · `compact && !showAllQuests ? <summary-card> : <full-card>` Daily Protocol 분기.
 *     · {compact && (hidden... || showAll...)} 토글 헤더 블록.
 * - 호출 사이트:
 *     · Dashboard.tsx:176 — cycle 471이 compact prop 제거. caller 0건.
 * - 결과: compact 항상 undefined → cascade 전체 unreachable.
 *
 * cycle 471 → 472-479 (8사이클 cascade) → 480 milestone → 481 cascade 10사이클 paired.
 *
 * 수정 (src/components/tabs/QuestTab.tsx):
 * - interface compact 제거.
 * - destructure compact = false 제거.
 * - useState showAllQuests + setShowAllQuests 제거.
 * - visibleQuestEntries / hiddenQuestCount / useQuestSummaryCards 제거.
 * - 33 ternary 모두 false 가지로 inline.
 * - Daily Protocol summary-card 가지 제거 (false 가지 full-card만 유지).
 * - 토글 헤더 블록 제거.
 * - 본체에서 visibleQuestEntries → activeQuestEntries 직접 사용.
 *
 * 회귀 가드:
 * - player / actions / isInSafeZone prop 보존.
 * - 본체 quest list / Daily Protocol / Weekly Protocol / discovery chains 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 481: QuestTab destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    const fnIdx = source.indexOf('const QuestTab =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 481: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    const ifaceIdx = source.indexOf('interface QuestTabProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 481: cascade dead 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(!/showAllQuests/.test(source), 'showAllQuests 0건');
    assert.ok(!/hiddenQuestCount/.test(source), 'hiddenQuestCount 0건');
    assert.ok(!/useQuestSummaryCards/.test(source), 'useQuestSummaryCards 0건');
    assert.ok(!/visibleQuestEntries/.test(source), 'visibleQuestEntries 0건');
});

test('cycle 481: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 481: 정합성 가드 — Dashboard <QuestTab> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<QuestTab');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <QuestTab> compact 전달 0건');
});

test('cycle 481: player / actions / isInSafeZone / activeQuestEntries 보존', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(/activeQuestEntries/.test(source), 'activeQuestEntries 보존');
    assert.ok(/dpMissions/.test(source), 'dpMissions 보존');
    assert.ok(/weeklyMissions/.test(source), 'weeklyMissions 보존');
    const fnIdx = source.indexOf('const QuestTab =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
    assert.ok(/isInSafeZone/.test(sig), 'isInSafeZone prop 보존');
});
