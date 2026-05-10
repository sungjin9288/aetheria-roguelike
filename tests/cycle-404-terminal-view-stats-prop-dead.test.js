import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 404: TerminalView `stats` interface dead prop 양쪽 정리
 *   (cycle 222-403 silent dead config 시리즈 166번째 — interface dead lens 4사이클 연속).
 *
 * 발견 (1 dead prop, 양쪽):
 * - src/components/TerminalView.tsx TerminalViewProps line 84:
 *   `stats?: any;`
 * - 본체 destructure: `{ logs, gameState, onCommand, autoFocusInput, player,
 *   quickSlots, onQuickSlotUse, showInput, className, toolbarLeft }` — `stats` 제외.
 * - 변수 read 0건 (파일 내 `stats` 식별자 1회만 — interface 정의 자체).
 * - 유일 consumer (src/components/app/MobileGameLayout.tsx:96): `stats={fullStats}`
 *   prop pass — silent dropped.
 *
 * 패턴 (cycle 222-403 시리즈 166번째 — 4사이클 연속):
 * - cycle 401: DashboardProps mobile interface dead 양쪽 정리.
 * - cycle 402: PostCombatCard + IntroScreen mobile dead batch.
 * - cycle 403: CraftingPanel + JobChangePanel mobileFocused dead batch.
 * - cycle 404: TerminalView stats interface dead 양쪽 정리.
 *   interface dead lens 4사이클 연속 — 다양한 prop 이름 (`mobile`,
 *   `mobileFocused`, `stats`)이 컴포넌트 6개 6개 발견.
 *
 * 수정:
 * 1) src/components/TerminalView.tsx TerminalViewProps에서 `stats?: any;` 제거.
 * 2) src/components/app/MobileGameLayout.tsx TerminalView JSX에서
 *    `stats={fullStats}` 라인 제거.
 *
 * 회귀 가드:
 * - TerminalView 활성 props (logs/gameState/onCommand/autoFocusInput/player/
 *   quickSlots/onQuickSlotUse/showInput/className/toolbarLeft) 동작 그대로.
 * - MobileGameLayout `fullStats` 변수 자체 보존 (Dashboard 등 다른 곳에서 사용).
 * - cycle 401/402/403 dead prop 정리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 404: TerminalViewProps에서 stats 0건', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const ifaceStart = source.indexOf('interface TerminalViewProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/^\s+stats\?:/m.test(ifaceBlock),
        'TerminalViewProps에서 stats 0건');
});

test('cycle 404: MobileGameLayout TerminalView JSX에서 stats prop 0건', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const tvStart = source.indexOf('<TerminalView');
    const tvEnd = source.indexOf('/>', tvStart);
    assert.ok(tvStart >= 0 && tvEnd > tvStart, 'TerminalView JSX 발견');
    const tvBlock = source.slice(tvStart, tvEnd);
    assert.ok(!/stats=\{fullStats\}/.test(tvBlock),
        'TerminalView JSX에서 stats prop 0건');
});

test('cycle 404: TerminalView 활성 props 보존 (cycle 496이 className / toolbarLeft cascade로 정리)', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    const ifaceStart = source.indexOf('interface TerminalViewProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    // cycle 496이 className / toolbarLeft cascade로 정리. 잔존 활성 필드만 가드.
    const activeFields = ['logs', 'gameState', 'onCommand', 'autoFocusInput', 'player',
        'quickSlots', 'onQuickSlotUse', 'showInput'];
    for (const field of activeFields) {
        const re = new RegExp(`${field}\\?:`);
        assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
    }
});

test('cycle 404: fullStats 변수 보존 (Dashboard / 기타 사용)', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    assert.ok(/fullStats/.test(source),
        'fullStats 변수 정의 보존');
    assert.ok(/stats=\{fullStats\}/.test(source),
        'fullStats prop pass는 다른 컴포넌트에 보존');
});

test('cycle 403 회귀 가드: CraftingPanel / JobChangePanel mobileFocused 0건', async () => {
    const cp = await readSrc('src/components/tabs/CraftingPanel.tsx');
    const ifaceStart1 = cp.indexOf('interface CraftingPanelProps');
    const ifaceEnd1 = cp.indexOf('}', ifaceStart1);
    assert.ok(!/mobileFocused\?:/.test(cp.slice(ifaceStart1, ifaceEnd1)),
        'cycle 403 CraftingPanel mobileFocused 0건 보존');

    const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
    const ifaceStart2 = jcp.indexOf('interface JobChangePanelProps');
    const ifaceEnd2 = jcp.indexOf('}', ifaceStart2);
    assert.ok(!/mobileFocused\?:/.test(jcp.slice(ifaceStart2, ifaceEnd2)),
        'cycle 403 JobChangePanel mobileFocused 0건 보존');
});
