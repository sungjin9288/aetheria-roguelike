import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 574: SmartInventory 3 defaults batch unreachable
 *   (cycle 222-573 silent dead config 시리즈 313번째 — redundant default annotation
 *   청소 메가 시리즈 66번째). single-cycle 3-default batch.
 *
 * 발견 (3 defaults batch):
 * - src/components/SmartInventory.tsx (line 73):
 *     const SmartInventory = ({ player, actions, quickSlots = [null, null, null],
 *         onAssignQuickSlot, spotlight = null, onClearSpotlight = null }: ...) => {...};
 * - 호출 사이트 (1 caller):
 *     · Dashboard.tsx:162 — <SmartInventory player actions quickSlots
 *       onAssignQuickSlot spotlight onClearSpotlight /> — 6 props 모두 명시.
 *     · 다른 caller 0건.
 * - 결과: quickSlots / spotlight / onClearSpotlight 항상 명시 전달. 3 defaults
 *   모두 도달 불가.
 *
 * Note: cycle 452의 cycle 주석에 "future-proof 보존" 언급 있으나 실제 caller
 * audit 결과 모두 명시 전달이라 unreachable. cycle 574에서 cleanup.
 *
 * 패턴 (cycle 222-573 시리즈 313번째):
 * - cycle 502-573: default 청소 메가 시리즈 72사이클.
 * - cycle 574: components/ entry-level cleanup — cycle 572/573 패턴 연속.
 *
 * 수정 (src/components/SmartInventory.tsx):
 * - signature에서 3 defaults 모두 제거.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (Dashboard) 동작 그대로.
 * - body spotlight?.names || [] defensive guard 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 574: SmartInventory signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    const fnIdx = source.indexOf('const SmartInventory = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(sig),
        'SmartInventory quickSlots default 제거');
    assert.ok(!/spotlight\s*=\s*null/.test(sig),
        'SmartInventory spotlight default null 제거');
    assert.ok(!/onClearSpotlight\s*=\s*null/.test(sig),
        'SmartInventory onClearSpotlight default null 제거');
});

test('cycle 574: 정합성 가드 — Dashboard callsite 보존', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    assert.ok(/<SmartInventory[\s\S]*?quickSlots=\{quickSlots\}[\s\S]*?spotlight=\{inventorySpotlight\}[\s\S]*?onClearSpotlight=\{onClearInventorySpotlight\}/.test(source),
        'Dashboard <SmartInventory> 6-prop callsite 보존');
});

test('cycle 574: body spotlight 처리 보존', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(/spotlight\?\.names \|\| \[\]/.test(source),
        'spotlight?.names || [] defensive guard 보존');
});

test('cycle 574: cycle 502-573 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const ShopPanel = \({[^}]+stats\s*=\s*null/.test(sp),
        'cycle 573 ShopPanel stats default 0건');

    const dash = await readSrc('src/components/Dashboard.tsx');
    assert.ok(!/mobileSection\s*=\s*'full'/.test(dash),
        'cycle 572 Dashboard mobileSection default 0건');
});
