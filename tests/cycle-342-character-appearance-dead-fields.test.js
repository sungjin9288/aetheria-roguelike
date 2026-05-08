import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 342: deriveCharacterAppearance 6 dead 출력 필드 정리
 *   (cycle 222-341 silent dead config 시리즈 110번째 — cleanup lens 연속).
 *
 * 발견 (dead output fields):
 * - top-level: level / hairStyle 2 fields (read 0건).
 * - weapon/offhand/armor sub-objects: item / iconKey / hands / equipped 4 fields (read 0건).
 * - getItemIconAssetKey import → cascade dead.
 *
 * 활성 필드 보존:
 * - top: job / frameTone / armorStyle / loadoutStyle / accessoryStyle / palette.
 * - weapon: type (test) / visual / enhance / art.
 * - offhand: type (test) / visual / enhance / art.
 * - armor: visual / enhance / art.
 *
 * 패턴 (cycle 222-341 silent dead config 시리즈 110번째):
 * - cycle 341: getEquipmentArtProfile 3 dead 출력 (itemName/subtype/hands).
 * - cycle 342: deriveCharacterAppearance 6 dead 출력 + cascade import.
 *
 * 수정 (src/utils/characterAppearance.ts):
 * - top-level: level / hairStyle 제거.
 * - weapon: item / iconKey / hands 제거.
 * - offhand: item / iconKey 제거.
 * - armor: item / iconKey / equipped 제거.
 * - getItemIconAssetKey import 제거 (cascade dead).
 *
 * 회귀 가드:
 * - tests/character-appearance.test.js 통과 (appearance.weapon.type / .enhance,
 *   appearance.armorStyle / .accessoryStyle 등 사용).
 * - PixelCharacterAvatar / AvatarEquipmentOverlay 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 342: top-level dead 필드 0건', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const fn = source.slice(source.indexOf('export const deriveCharacterAppearance'));
    assert.ok(!/^\s+level: player/m.test(fn), 'level 출력 0건');
    assert.ok(!/^\s+hairStyle: baseStyle/m.test(fn), 'hairStyle 출력 0건');
});

test('cycle 342: weapon/offhand/armor dead 필드 0건', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const fn = source.slice(source.indexOf('export const deriveCharacterAppearance'));
    assert.ok(!/iconKey: getItemIconAssetKey/.test(fn), 'iconKey 출력 0건');
    assert.ok(!/hands: isTwoHandWeapon/.test(fn), 'hands 출력 0건');
    assert.ok(!/equipped: Boolean/.test(fn), 'equipped 출력 0건');
});

test('cycle 342: getItemIconAssetKey import cascade 제거', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    assert.ok(!/getItemIconAssetKey,/.test(source),
        'getItemIconAssetKey import 제거됨');
});

test('cycle 342: 활성 필드 보존 (회귀 가드)', async () => {
    const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.js');
    const player = {
        job: '검사',
        equip: { weapon: { name: '롱소드', type: 'weapon', hands: 1 } },
    };
    const appearance = deriveCharacterAppearance(player);
    assert.ok('job' in appearance, 'job 보존');
    assert.ok('frameTone' in appearance, 'frameTone 보존');
    assert.ok('armorStyle' in appearance, 'armorStyle 보존');
    assert.ok('weapon' in appearance, 'weapon 보존');
    assert.ok('type' in appearance.weapon, 'weapon.type 보존');
    assert.ok('art' in appearance.weapon, 'weapon.art 보존');
    assert.equal(appearance.weapon.iconKey, undefined, 'weapon.iconKey 0건');
    assert.equal(appearance.weapon.hands, undefined, 'weapon.hands 0건');
});

test('cycle 341 회귀 가드: getEquipmentArtProfile dead 필드 0건', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    const fn = source.slice(source.indexOf('export const getEquipmentArtProfile'));
    assert.ok(!/itemName: item\.name/.test(fn), 'cycle 341 itemName 0건 보존');
});
