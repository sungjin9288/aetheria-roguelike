import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 575: CombatPanel 3 defaults batch unreachable
 *   (cycle 222-574 silent dead config 시리즈 314번째 — redundant default annotation
 *   청소 메가 시리즈 67번째). single-cycle 3-default batch.
 *
 * 발견 (3 defaults batch):
 * - src/components/tabs/CombatPanel.tsx (line 55):
 *     const CombatPanel = ({ player, actions, enemy = null, stats = {},
 *         isAiThinking, mobile = false }: CombatPanelProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · ControlPanel.tsx:119 — <CombatPanel ... 6 props 모두 명시 전달>
 *     · 다른 caller 0건.
 * - 결과: enemy / stats / mobile 항상 명시 전달. 3 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-574 시리즈 314번째):
 * - cycle 502-574: default 청소 메가 시리즈 73사이클.
 * - cycle 575: components/tabs/ — cycle 572/573/574 component-level cleanup
 *   시리즈 4번째 연속.
 *
 * 수정 (src/components/tabs/CombatPanel.tsx):
 * - signature에서 3 defaults 모두 제거.
 * - body의 enemy ? ... : null 분기 보존 (caller가 enemy 미전달 시 동작은
 *   별개 — caller 명시 전달 후에도 enemy 자체가 null일 수 있는 path 보존).
 *
 * 회귀 가드:
 * - 1 production callsite (ControlPanel) 동작 그대로.
 * - body enemy 분기 / getEnemyTacticalProfile / tacticalProfile 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 575: CombatPanel signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const fnIdx = source.indexOf('const CombatPanel = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/enemy\s*=\s*null/.test(sig),
        'CombatPanel enemy default null 제거');
    assert.ok(!/stats\s*=\s*\{\}/.test(sig),
        'CombatPanel stats default {} 제거');
    assert.ok(!/mobile\s*=\s*false/.test(sig),
        'CombatPanel mobile default false 제거');
});

test('cycle 575: 정합성 가드 — ControlPanel callsite 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/<CombatPanel[\s\S]*?enemy=\{enemy\}[\s\S]*?stats=\{stats\}[\s\S]*?mobile/.test(source),
        'ControlPanel <CombatPanel> 6-prop callsite 보존');
});

test('cycle 575: body enemy 분기 보존', async () => {
    // 리팩토링: tacticalProfile 계산은 combatView.ts(buildCombatView)로 이동 — enemy 분기 보존.
    const source = await readSrc('src/utils/combatView.ts');
    assert.ok(/const tacticalProfile = enemy \? getEnemyTacticalProfile\(enemy, stats\) : null/.test(source),
        'enemy ? getEnemyTacticalProfile : null 보존');
});

test('cycle 575: cycle 502-574 회귀 가드 — default 청소 시리즈 보존', async () => {
    const si = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(si),
        'cycle 574 SmartInventory quickSlots default 0건');

    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const ShopPanel = \({[^}]+stats\s*=\s*null/.test(sp),
        'cycle 573 ShopPanel stats default 0건');
});
