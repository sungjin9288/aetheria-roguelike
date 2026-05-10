import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 572: Dashboard 6 defaults partial batch unreachable
 *   (cycle 222-571 silent dead config 시리즈 311번째 — redundant default annotation
 *   청소 메가 시리즈 64번째). 가장 큰 single-cycle multi-default batch + partial
 *   cleanup 동시.
 *
 * 발견 (6 defaults unreachable, 1 default reachable 보존):
 * - src/components/Dashboard.tsx (line 81):
 *     const Dashboard = ({ player, grave, sideTab, setSideTab, actions, stats,
 *         mobileSection = 'full', quickSlots = [null, null, null],
 *         runtime = null, inventorySpotlight = null,
 *         onClearInventorySpotlight = null, consoleExpanded = false,
 *         onReturnToLog = null }: DashboardProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · MobileGameLayout.tsx:63-83 — <Dashboard ... 11+ props 전달>
 *       명시: mobileSection="console" / consoleExpanded / onReturnToLog /
 *       quickSlots / inventorySpotlight / runtime
 *       미전달: onClearInventorySpotlight
 * - 결과:
 *     · 6 defaults 도달 불가: mobileSection / quickSlots / runtime /
 *       inventorySpotlight / consoleExpanded / onReturnToLog
 *     · 1 default REACHABLE 보존: onClearInventorySpotlight (caller 미전달)
 *
 * 패턴 (cycle 222-571 시리즈 311번째):
 * - cycle 502-571: default 청소 메가 시리즈 70사이클.
 * - cycle 572: 가장 큰 single-cycle batch (6 default), partial cleanup
 *   pattern (cycle 542/553/558/569 재적용 5번째).
 *
 * 수정 (src/components/Dashboard.tsx):
 * - 6 defaults 모두 제거.
 * - onClearInventorySpotlight = null 보존.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (MobileGameLayout) 동작 그대로.
 * - body mobileSection / consoleExpanded / quickSlots / runtime 사용처 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 572: Dashboard signature에서 6 defaults 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const fnIdx = source.indexOf('const Dashboard = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/mobileSection\s*=\s*'full'/.test(sig),
        "Dashboard mobileSection default 'full' 제거");
    assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(sig),
        'Dashboard quickSlots default [null,null,null] 제거');
    assert.ok(!/runtime\s*=\s*null/.test(sig),
        'Dashboard runtime default null 제거');
    assert.ok(!/inventorySpotlight\s*=\s*null/.test(sig),
        'Dashboard inventorySpotlight default null 제거');
    assert.ok(!/consoleExpanded\s*=\s*false/.test(sig),
        'Dashboard consoleExpanded default false 제거');
    assert.ok(!/onReturnToLog\s*=\s*null/.test(sig),
        'Dashboard onReturnToLog default null 제거');
});

test('cycle 572: onClearInventorySpotlight default 보존 (reachable)', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const fnIdx = source.indexOf('const Dashboard = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/onClearInventorySpotlight\s*=\s*null/.test(sig),
        'Dashboard onClearInventorySpotlight default null 보존 (MobileGameLayout 미전달이라 reachable)');
});

test('cycle 572: 정합성 가드 — MobileGameLayout callsite 보존', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    assert.ok(/<Dashboard\s*\n\s*mobileSection="console"/.test(source),
        'MobileGameLayout mobileSection="console" 보존');
    assert.ok(/consoleExpanded/.test(source), 'consoleExpanded prop 보존');
    assert.ok(/onReturnToLog=\{/.test(source), 'onReturnToLog prop 보존');
});

test('cycle 572: cycle 502-571 회귀 가드 — default 청소 시리즈 보존', async () => {
    const mi = await readSrc('src/components/icons/MonsterIcon.tsx');
    assert.ok(!/const MonsterIcon = \({ name, discovered\s*=\s*false/.test(mi),
        'cycle 571 MonsterIcon discovered default 0건');

    const sti = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    assert.ok(!/const SkillTypeIcon = \({ type, size\s*=\s*14/.test(sti),
        'cycle 569 SkillTypeIcon size default 0건');
});
