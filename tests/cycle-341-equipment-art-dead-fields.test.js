import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 341: getEquipmentArtProfile 3 dead 출력 필드 정리 (itemName / subtype / hands)
 *   (cycle 222-340 silent dead config 시리즈 109번째 — cleanup lens 연속).
 *
 * 발견 (3 dead output fields):
 * - getEquipmentArtProfile 출력에서 itemName / subtype / hands 3 필드.
 * - src/, tests/ 어디에서도 read 0건.
 *
 * 활성 필드 (보존):
 * - slot / key (avatarEquipmentPreview, test).
 * - toneKey / palette (test).
 * - headgearStyle / bodyStyle / isHeadgearOnly (avatar / preview / test).
 * - style (avatar / preview / test).
 *
 * 패턴 (cycle 222-340 silent dead config 시리즈 109번째):
 * - cycle 339: getSynthesisGroups rarity + getItemRarity cascade.
 * - cycle 341: getEquipmentArtProfile 3 dead 출력 필드.
 *
 * 수정 (src/utils/equipmentArt.ts):
 * - armor / shield / weapon 분기에서 itemName / subtype / hands 필드 제거.
 *
 * 회귀 가드:
 * - slot / key / toneKey / palette / headgearStyle / bodyStyle / isHeadgearOnly /
 *   style 필드 보존.
 * - tests/equipment-art.test.js 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 341: getEquipmentArtProfile itemName / subtype / hands 0건', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    const fn = source.slice(source.indexOf('export const getEquipmentArtProfile'));
    assert.ok(!/itemName: item\.name/.test(fn), 'itemName 출력 0건');
    assert.ok(!/subtype: isFocusOffhand/.test(fn), 'subtype 출력 0건');
    assert.ok(!/hands: Number\(item\.hands\)/.test(fn), 'hands 출력 0건');
});

test('cycle 341: getEquipmentArtProfile 활성 필드 보존', async () => {
    const { getEquipmentArtProfile } = await import('../src/utils/equipmentArt.js');
    const armor = getEquipmentArtProfile({ name: '여행자 튜닉', type: 'armor' }, 'armor', 'tunic');
    assert.equal(armor.slot, 'armor', 'slot 보존');
    assert.ok('headgearStyle' in armor, 'headgearStyle 보존');
    assert.ok('bodyStyle' in armor, 'bodyStyle 보존');
    assert.ok('toneKey' in armor, 'toneKey 보존');
    assert.equal(armor.itemName, undefined, 'itemName 제거');
});

test('cycle 341: weapon/shield style 보존', async () => {
    const { getEquipmentArtProfile } = await import('../src/utils/equipmentArt.js');
    const weapon = getEquipmentArtProfile({ name: '녹슨 단검', type: 'weapon', hands: 1 }, 'weapon');
    assert.ok('style' in weapon, 'weapon style 보존');
    assert.equal(weapon.hands, undefined, 'weapon hands 제거');
    const shield = getEquipmentArtProfile({ name: '목재 방패', type: 'shield' }, 'offhand');
    assert.ok('style' in shield, 'shield style 보존');
    assert.equal(shield.subtype, undefined, 'shield subtype 제거');
});

test('cycle 340 회귀 가드: CHANGELOG batch 보존', async () => {
    const source = await readSrc('CHANGELOG.md');
    assert.ok(/Cycle 340 🎯/.test(source),
        'cycle 340 batch entry 보존');
});
