import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 405: Codex `compact` interface dead prop 양쪽 정리
 *   (cycle 222-404 silent dead config 시리즈 167번째 — interface dead lens 5사이클 연속).
 *
 * 발견 (1 dead prop, 양쪽):
 * - src/components/Codex.tsx CodexProps line 22:
 *   `compact?: boolean;`
 * - 본체 destructure: `{ player, dispatch }` — compact 제외.
 * - 변수 read 0건 (파일 내 `compact` 식별자 1회만 — interface 정의 자체).
 * - 유일 consumer (Dashboard.tsx:217): `compact={desktopArchiveCompact}` prop pass —
 *   silent dropped.
 *
 * 비교: AchievementPanel / SkillTreePreview / QuestTab / StatsPanel /
 *   BuildAdvicePanel / EquipmentPanel / GravePanel / MapNavigator는 모두
 *   compact destructure + 본체 사용 (활성). Codex만 dead.
 *
 * 패턴 (cycle 222-404 시리즈 167번째 — 5사이클 연속):
 * - cycle 401: DashboardProps mobile interface dead.
 * - cycle 402: PostCombatCard + IntroScreen mobile dead batch.
 * - cycle 403: CraftingPanel + JobChangePanel mobileFocused dead batch.
 * - cycle 404: TerminalView stats interface dead.
 * - cycle 405: Codex compact interface dead.
 *   interface dead lens 5사이클 연속 — 다양한 prop 이름 (`mobile`,
 *   `mobileFocused`, `stats`, `compact`)이 컴포넌트 7개째 발견.
 *
 * 수정:
 * 1) src/components/Codex.tsx CodexProps에서 `compact?: boolean;` 제거.
 * 2) src/components/Dashboard.tsx Codex JSX에서 `compact={desktopArchiveCompact}` 제거.
 *
 * 회귀 가드:
 * - Codex 활성 props (player/dispatch) 동작 그대로.
 * - 다른 패널들의 compact prop 정합성 보존.
 * - cycle 401-404 dead prop 정리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 405: CodexProps에서 compact 0건', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    const ifaceStart = source.indexOf('interface CodexProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/compact\?:/.test(ifaceBlock),
        'CodexProps에서 compact 0건');
});

test('cycle 405: Dashboard Codex JSX에서 compact prop 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    // <Codex ... /> 영역 추출
    const codexStart = source.indexOf('<Codex');
    const codexEnd = source.indexOf('/>', codexStart);
    assert.ok(codexStart >= 0 && codexEnd > codexStart, 'Codex JSX 발견');
    const codexBlock = source.slice(codexStart, codexEnd);
    assert.ok(!/compact=\{desktopArchiveCompact\}/.test(codexBlock),
        'Codex JSX에서 compact prop 0건');
});

test('cycle 405: CodexProps 활성 필드 보존', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    const ifaceStart = source.indexOf('interface CodexProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(/player\?:/.test(ifaceBlock), 'player 필드 보존');
    assert.ok(/dispatch:/.test(ifaceBlock), 'dispatch 필드 보존');
});

test('cycle 405: 활성 패널 compact 보존 (회귀 가드)', async () => {
    // cycle 472-475가 MapNavigator/AchievementPanel/EquipmentPanel/StatsPanel의
    // compact prop cascade 정리. 4 panel 제외.
    for (const f of ['src/components/GravePanel.tsx']) {
        const source = await readSrc(f);
        assert.ok(/\bcompact\b/.test(source),
            `${f} compact prop 사용 보존`);
    }
});

test('cycle 404 회귀 가드: TerminalView stats 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const ifaceStart = source.indexOf('interface TerminalViewProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/^\s+stats\?:/m.test(ifaceBlock),
        'cycle 404 stats 0건 보존');
});
