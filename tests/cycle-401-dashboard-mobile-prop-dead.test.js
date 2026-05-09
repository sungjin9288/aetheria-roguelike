import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 401: Dashboard `mobile` prop dead (interface + parent pass) 정리
 *   (cycle 222-400 silent dead config 시리즈 163번째 — interface dead lens 회귀).
 *
 * 발견 (1 dead prop, 양쪽):
 * - src/components/Dashboard.tsx DashboardProps line 42:
 *   `mobile?: boolean;`
 * - Dashboard 본체 destructure 라인은 13개 props (player/grave/sideTab/setSideTab/
 *   actions/stats/mobileSection/quickSlots/runtime/inventorySpotlight/
 *   onClearInventorySpotlight/consoleExpanded/onReturnToLog) — `mobile` 제외.
 * - 파일 내 `mobile` 변수 사용 0건 (mobile-test-id / mobileSection / mobileLabel /
 *   mobileFocused 등은 별개 식별자).
 * - 유일 consumer (src/components/app/MobileGameLayout.tsx:69)는 `<Dashboard mobile {...}/>`
 *   로 prop pass — Dashboard가 destructure 안 하므로 silent dropped.
 *
 * 패턴 (cycle 222-400 시리즈 163번째):
 * - cycle 399: QuickSlotProps onAssign/onUnassign interface dead.
 * - cycle 401: DashboardProps mobile interface dead (양쪽 정리 — interface +
 *   parent pass site).
 *
 * 수정:
 * 1) src/components/Dashboard.tsx DashboardProps에서 `mobile?: boolean;` 제거.
 * 2) src/components/app/MobileGameLayout.tsx Dashboard JSX에서 `mobile` 라인 제거.
 *
 * 회귀 가드:
 * - mobileSection / mobileLabel / mobileFocused / mobile-test-id 모두 별개 식별자로 보존.
 * - DashboardMobileSummary 내부 분기 (mobileSection === 'log' / 'console' 등) 보존.
 * - MobileGameLayout나 GameRoot의 Dashboard prop pass 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 401: DashboardProps에서 mobile 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const ifaceStart = source.indexOf('interface DashboardProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
        'DashboardProps에서 mobile 0건');
});

test('cycle 401: MobileGameLayout Dashboard JSX에서 mobile prop 0건', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const dashStart = source.indexOf('<Dashboard');
    const dashEnd = source.indexOf('/>', dashStart);
    const block = source.slice(dashStart, dashEnd);
    assert.ok(!/^\s+mobile\s*$/m.test(block),
        'Dashboard JSX에서 mobile prop 0건');
});

test('cycle 401: DashboardProps 활성 필드 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const ifaceStart = source.indexOf('interface DashboardProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    const activeFields = ['player', 'grave', 'sideTab', 'setSideTab', 'actions',
        'stats', 'mobileSection', 'quickSlots', 'runtime', 'inventorySpotlight',
        'onClearInventorySpotlight', 'consoleExpanded', 'onReturnToLog'];
    for (const field of activeFields) {
        const re = new RegExp(`${field}[?:]`);
        assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
    }
});

test('cycle 401: mobileSection / DashboardMobileSummary 동작 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    assert.ok(/mobileSection/.test(source),
        'mobileSection 별개 식별자 보존');
    assert.ok(/DashboardMobileSummary/.test(source),
        'DashboardMobileSummary import / 사용 보존');
});

test('cycle 400 회귀 가드: cycle 399 QuickSlotProps onAssign 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const ifaceStart = source.indexOf('interface QuickSlotProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/onAssign\?:/.test(ifaceBlock),
        'cycle 399 onAssign 0건 보존');
});
