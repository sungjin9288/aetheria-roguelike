import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 479: SkillTreePreview `compact` prop cascade unreachable 정리
 *   (cycle 222-478 silent dead config 시리즈 232번째 — unreachable code path
 *   cascade cleanup, cycle 471-478 paired 9사이클).
 *
 * 발견 (1 prop + 1 state + 3 const + 14 ternary 가지 + 1 toggle UI 블록 dead):
 * - src/components/SkillTreePreview.tsx:
 *     · interface line 18: compact?: boolean.
 *     · destructure line 118: compact = false.
 *     · line 119: useState(false) showAllSkills + setShowAllSkills.
 *     · line 134: visibleCurrentSkills (compact && !showAllSkills 가지).
 *     · line 139: hiddenSkillCount (compact 토글 버튼 조건용).
 *     · line 140: showSkillSummary (compact && !showAllSkills 항상 false).
 *     · 본체 className compact ternary 다수.
 *     · {compact && <toggle>} 블록.
 *     · `!showSkillSummary && ...` / `showSkillSummary ? ... : ...` 가드.
 *     · SkillCard에 compact={compact} 전달 (line 194/331).
 *
 * 또한 SkillCard (내부 컴포넌트, line 48):
 *     · destructure에 compact = false default.
 *     · 본체 1 ternary (line 53): summary ? X : compact ? Y : Z.
 *     · 부모로부터 undefined 전달이라 compact 가지 0건.
 *
 * - 호출 사이트:
 *     · Dashboard.tsx:188 — cycle 471이 compact prop 제거. caller 0건.
 *     · 다른 파일 import 0건.
 * - 결과: compact 항상 undefined → cascade 전체 unreachable.
 *
 * cycle 471 → 472 → 473 → 474 → 475 → 476 → 477 → 478 → 479 cascade 9사이클 paired.
 *
 * 수정 (src/components/SkillTreePreview.tsx):
 * - interface compact 제거.
 * - SkillTreePreview destructure compact 제거.
 * - SkillCard destructure compact 제거 (internal helper).
 * - useState showAllSkills + setShowAllSkills 제거.
 * - visibleCurrentSkills → allCurrentSkills 직접.
 * - hiddenSkillCount / showSkillSummary 제거.
 * - 토글 버튼 JSX 블록 제거.
 * - className compact ternary 정적 (false 가지).
 * - SkillCard line 53 chained ternary `summary ? A : compact ? B : C` →
 *   `summary ? A : C`.
 * - {compact && ...} 제거 / {!compact && ...} 직접 렌더.
 * - showSkillSummary ternary → 직접 false 가지 렌더.
 * - SkillCard 호출에서 compact prop 전달 제거 (line 194/331).
 *
 * 회귀 가드:
 * - player / actions prop 보존.
 * - 본체 skills / branches / classTree / 스킬 분기 교체 로직 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 479: SkillTreePreview destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    const fnIdx = source.indexOf('const SkillTreePreview =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 479: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    const ifaceIdx = source.indexOf('interface SkillTreePreviewProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 479: SkillCard 내부 컴포넌트 compact 0건', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    const fnIdx = source.indexOf('const SkillCard =');
    const fnEnd = source.indexOf('const SkillTreePreview =', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(block), 'SkillCard 본체 compact 0건');
});

test('cycle 479: cascade dead 0건 (showAllSkills/hidden/summary)', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(!/showAllSkills/.test(source), 'showAllSkills 0건');
    assert.ok(!/hiddenSkillCount/.test(source), 'hiddenSkillCount 0건');
    assert.ok(!/showSkillSummary/.test(source), 'showSkillSummary 0건');
    assert.ok(!/visibleCurrentSkills/.test(source), 'visibleCurrentSkills 0건');
});

test('cycle 479: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 479: 정합성 가드 — Dashboard <SkillTreePreview> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<SkillTreePreview');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <SkillTreePreview> compact 전달 0건');
});

test('cycle 479: player / actions / classTree / 스킬 분기 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(/getJobSkills/.test(source), 'getJobSkills 보존');
    assert.ok(/skillBranches/.test(source), 'skillBranches 보존');
    assert.ok(/swapSkillChoice/.test(source), 'swapSkillChoice 보존');
});
