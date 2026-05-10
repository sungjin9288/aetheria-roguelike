import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 513: getEquipmentArtProfile `slotHint = null` default unreachable
 *   (cycle 222-512 silent dead config 시리즈 262번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 11번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/equipmentArt.ts (line 129):
 *     export const getEquipmentArtProfile = (item, slotHint: any = null,
 *         fallbackArmorStyle: any = 'coat') => {...
 *         slot: slotHint || 'none',
 *         toneKey: slotHint === 'armor' ? 'cloth' : 'steel',
 *         ...
 *     }
 * - 호출 사이트 (4 callsite):
 *     · characterAppearance.ts:66 — getEquipmentArtProfile(weapon, 'weapon').
 *     · characterAppearance.ts:67 — getEquipmentArtProfile(offhand, 'offhand').
 *     · characterAppearance.ts:68 — getEquipmentArtProfile(armor, 'armor',
 *       baseStyle.armorStyle).
 *     · avatarEquipmentPreview.ts:309 — getEquipmentArtProfile(item,
 *       item.type === 'shield' ? 'offhand' : item.type).
 *     · 4 callsite 모두 slotHint 명시 전달.
 *     · fallbackArmorStyle은 1/4만 명시 (3/4 default 'coat' 활성) → 보존.
 *
 * 패턴 (cycle 222-512 시리즈 262번째):
 * - cycle 502-512: util default 청소 메가 시리즈.
 * - cycle 513: getEquipmentArtProfile slotHint default — 동일 lens.
 *
 * 수정 (src/utils/equipmentArt.ts):
 * - signature에서 slotHint: any = null → slotHint: any (default 제거).
 * - fallbackArmorStyle default는 활성이라 보존.
 * - body slotHint || 'none' / slotHint === 'armor' 분기 보존.
 *
 * 회귀 가드:
 * - 4 callsite 동작 그대로.
 * - body slotHint / fallbackArmorStyle 사용 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 513: getEquipmentArtProfile signature에서 slotHint default 0건', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    const fnIdx = source.indexOf('export const getEquipmentArtProfile');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/slotHint:\s*any\s*=\s*null/.test(sig), 'slotHint default 제거');
    assert.ok(/\bslotHint\b/.test(sig), 'slotHint 파라미터 자체는 보존');
});

test('cycle 513: fallbackArmorStyle default 보존 (3/4 caller가 default 활용)', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    const fnIdx = source.indexOf('export const getEquipmentArtProfile');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/fallbackArmorStyle:\s*any\s*=\s*'coat'/.test(sig),
        "fallbackArmorStyle default 'coat' 보존");
});

test('cycle 513: 정합성 가드 — 4 callsite 모두 slotHint 명시 전달', async () => {
    const ca = await readSrc('src/utils/characterAppearance.ts');
    const caCalls = ca.match(/getEquipmentArtProfile\(/g) || [];
    assert.ok(caCalls.length >= 3, `characterAppearance 호출 3건 이상 (실제: ${caCalls.length})`);

    const aep = await readSrc('src/utils/avatarEquipmentPreview.ts');
    const aepCalls = aep.match(/getEquipmentArtProfile\(/g) || [];
    assert.ok(aepCalls.length >= 1, `avatarEquipmentPreview 호출 1건 이상 (실제: ${aepCalls.length})`);
});

test('cycle 513: body slotHint 사용 보존', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(/slot: slotHint \|\| 'none'/.test(source), "slot: slotHint || 'none' 보존");
    assert.ok(/slotHint === 'armor'/.test(source), "slotHint === 'armor' 분기 보존");
});

test('cycle 513: cycle 502-512 회귀 가드', async () => {
    const itemVisuals = await readSrc('src/utils/itemVisuals.ts');
    assert.ok(!/getArmorStyleFromItem[^=]*fallback:\s*any\s*=\s*'coat'/.test(itemVisuals),
        'cycle 512 getArmorStyleFromItem fallback default 0건');
});
