import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 473: AchievementPanel `compact` prop + 6 cascade dead
 *   (cycle 222-472 silent dead config 시리즈 226번째 — unreachable code path
 *   cascade cleanup, cycle 471/472 paired completion).
 *
 * 발견 (1 prop + 1 state + 1 useMemo + 2 const + 1 toggle UI + 1 summary 블록 dead):
 * - src/components/AchievementPanel.tsx:
 *     · interface AchievementPanelProps line 12: `compact?: boolean;`
 *     · line 57: const AchievementPanel = ({ player, actions, compact }) => {...}
 *     · line 58: const [showAllAchievements, setShowAllAchievements] = useState(false);
 *     · line 78-87: summaryAchievements useMemo (compact path 전용 계산).
 *     · line 88: hiddenAchievementCount (compact 토글 버튼 조건용).
 *     · line 89: showSummaryView = compact && !showAllAchievements (항상 false).
 *     · line 97/98: ${compact ? X : Y} className ternary 2건.
 *     · line 111-120: {compact && ...} 토글 버튼 블록.
 *     · line 133-180: {showSummaryView ? <summary> : ...} ternary first 가지 (요약 카드).
 * - 호출 사이트:
 *     · Dashboard.tsx:182 — cycle 471이 compact prop 제거. caller 0건.
 * - 결과: compact 항상 undefined → cascade 전체 unreachable.
 *
 * 패턴 (cycle 222-472 시리즈 226번째):
 * - cycle 471: Dashboard 10 callsite compact 일괄 제거.
 * - cycle 472: MapNavigator compact + showAllMaps cascade 정리.
 * - cycle 473: AchievementPanel compact + showAllAchievements cascade 정리.
 *   cycle 472와 동일 lens, 다른 panel 적용.
 *
 * 수정 (src/components/AchievementPanel.tsx):
 * - interface에서 compact?: boolean 제거.
 * - destructure에서 compact 제거.
 * - useState showAllAchievements + setShowAllAchievements 제거.
 * - summaryAchievements useMemo 제거.
 * - hiddenAchievementCount / showSummaryView 제거.
 * - className compact ternary 2건 → 정적 (false 가지).
 * - 토글 버튼 JSX 블록 제거.
 * - {showSummaryView ? <summary> : <unlocked>} → 직접 <unlocked> 렌더.
 * - useState import 제거 (다른 useState 0건이면).
 *
 * 회귀 가드:
 * - player / actions prop / unlocked / locked / claimableCount 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 473: AchievementPanel destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const fnIdx = source.indexOf('const AchievementPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 473: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const ifaceIdx = source.indexOf('interface AchievementPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 473: cascade dead 0건 (showAll/summary/hidden/showSummaryView)', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.ok(!/showAllAchievements/.test(source), 'showAllAchievements 0건');
    assert.ok(!/summaryAchievements/.test(source), 'summaryAchievements 0건');
    assert.ok(!/hiddenAchievementCount/.test(source), 'hiddenAchievementCount 0건');
    assert.ok(!/showSummaryView/.test(source), 'showSummaryView 0건');
});

test('cycle 473: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 473: 정합성 가드 — Dashboard <AchievementPanel> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<AchievementPanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <AchievementPanel> compact 전달 0건');
});

test('cycle 473: player / actions / unlocked / locked 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.ok(/player\b/.test(source), 'player prop 보존');
    assert.ok(/actions\?\.claimAchievement/.test(source), 'claimAchievement 로직 보존');
    assert.ok(/const unlocked =/.test(source), 'unlocked 계산 보존');
    assert.ok(/const locked =/.test(source), 'locked 계산 보존');
});
