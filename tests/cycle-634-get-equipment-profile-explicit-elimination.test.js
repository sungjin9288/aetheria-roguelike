import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 634: getEquipmentProfile equip {} explicit default-elimination
 *   (cycle 222-633 silent dead config 시리즈 371번째 — explicit
 *   default-elimination pattern 24번째 적용, 변형 패턴 9번째).
 *
 * 발견 (default 이미 unreachable, signature 정리):
 * - src/utils/equipmentUtils.ts:104:
 *     export const getEquipmentProfile = (equip: EquipSlots = {}) => {...}
 * - 호출 사이트 모두 명시 인자 전달 (8 production + 다수 test):
 *     · statsCalculator.ts:289 — getEquipmentProfile(player.equip).
 *     · EquipmentPanel.tsx:42 — getEquipmentProfile(player?.equip).
 *     · SmartInventory.tsx:108/110 — getEquipmentProfile(player.equip / nextEquip).
 *     · ShopPanel.tsx:58/60 — getEquipmentProfile(equip / nextEquip).
 *     · _helpers.ts:32/42 — getEquipmentProfile(equip / nextEquip).
 *     · cycle-224/225/534/equipment-utils tests — 모두 명시.
 * - default {} 이미 도달 불가 (전 테스트 모두 명시 객체 전달).
 *
 * 패턴 (cycle 222-633 시리즈 371번째):
 * - cycle 502-633: default 청소 메가 시리즈 128사이클.
 * - cycle 634: explicit default-elimination 24번째 (변형 패턴 9번째).
 *
 * 수정:
 * - equipmentUtils.ts:104 — equip default {} 제거.
 *
 * 회귀 가드:
 * - 8 production callsite 동작 그대로 (이미 명시).
 * - body weapon stat 합산 / shieldDef / mpBonus / hpBonus 처리 보존.
 * - cycle 631 paired batch (getEquippedWeapons / getWeaponMagicSkills) 보존.
 * - cycle 633 getNextEquipmentState 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 634: getEquipmentProfile signature에서 equip default {} 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getEquipmentProfile = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(source),
        'getEquipmentProfile equip default {} 제거');
    assert.ok(/getEquipmentProfile = \(equip:\s*EquipSlots\)/.test(source),
        'getEquipmentProfile equip 파라미터 보존 (default 없이)');
});

test('cycle 634: production callsite 명시 보존', async () => {
    const sc = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(/getEquipmentProfile\(player\.equip(?: \|\| \{\})?\)/.test(sc),
        'statsCalculator callsite 보존');
    const ep = await readSrc('src/components/EquipmentPanel.tsx');
    assert.ok(/getEquipmentProfile\(player\?\.equip(?: \|\| \{\})?\)/.test(ep),
        'EquipmentPanel callsite 보존');
});

test('cycle 634: cycle 502-633 회귀 가드 — default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getNextEquipmentState = \(equip:\s*EquipSlots\s*=\s*\{\}/.test(eu),
        'cycle 633 getNextEquipmentState equip default 0건');
    assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
        'cycle 631 getEquippedWeapons equip default 0건');
});
