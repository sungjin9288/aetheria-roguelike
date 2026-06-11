import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 633: getNextEquipmentState equip {} explicit default-elimination
 *   (cycle 222-632 silent dead config 시리즈 370번째 — explicit
 *   default-elimination pattern 23번째 적용, 변형 패턴 8번째).
 *
 * 발견 (default 이미 unreachable, signature 정리):
 * - src/utils/equipmentUtils.ts:161:
 *     export const getNextEquipmentState = (equip: EquipSlots = {}, item: Item | null | undefined) => {...}
 * - 호출 사이트 모두 명시 인자 전달:
 *     · ShopPanel.tsx:59 — getNextEquipmentState(equip, item).
 *     · SmartInventory.tsx:109 — getNextEquipmentState(player.equip, item).
 *     · _helpers.ts:41 — getNextEquipmentState(equip, item).
 *     · useInventoryActions.ts:62 — getNextEquipmentState(currentEquip, inventoryItem).
 *     · tests/equipment-utils.test.js — 모두 {} 또는 명시 객체 전달.
 * - default {} 이미 도달 불가.
 *
 * 패턴 (cycle 222-632 시리즈 370번째):
 * - cycle 502-632: default 청소 메가 시리즈 127사이클.
 * - cycle 633: explicit default-elimination 23번째 (변형 패턴 8번째).
 *
 * 수정:
 * - equipmentUtils.ts:161 — equip default {} 제거.
 *
 * 회귀 가드:
 * - 4 production callsite 동작 그대로 (이미 명시).
 * - body weapon/offhand/armor swap logic 보존.
 * - cycle 631 paired batch 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 633: getNextEquipmentState signature에서 equip default {} 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getNextEquipmentState = \(equip:\s*EquipSlots\s*=\s*\{\},/.test(source),
        'getNextEquipmentState equip default {} 제거');
    assert.ok(/getNextEquipmentState = \(equip:\s*EquipSlots,\s*item:/.test(source),
        'getNextEquipmentState equip 파라미터 보존 (default 없이)');
});

test('cycle 633: 4 production callsite 명시 보존', async () => {
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/getNextEquipmentState\(equip,\s*item\)/.test(sp),
        'ShopPanel callsite 보존');
    const si = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(/getNextEquipmentState\(player\.equip(?: \|\| \{\})?,\s*item\)/.test(si),
        'SmartInventory callsite 보존');
    const ch = await readSrc('src/hooks/combatActions/_helpers.ts');
    assert.ok(/getNextEquipmentState\(equip,\s*item\)/.test(ch),
        '_helpers callsite 보존');
    const ui = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/getNextEquipmentState\(currentEquip,\s*inventoryItem\)/.test(ui),
        'useInventoryActions callsite 보존');
});

test('cycle 633: cycle 502-632 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitItemResonance = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null\)/.test(rp),
        'cycle 632 getTraitItemResonance player default 0건');
    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
        'cycle 631 getEquippedWeapons equip default 0건');
});
