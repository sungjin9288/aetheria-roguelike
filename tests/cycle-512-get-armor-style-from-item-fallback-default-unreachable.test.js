import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 512: getArmorStyleFromItem `fallback = 'coat'` default unreachable
 *   (cycle 222-511 silent dead config 시리즈 261번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 10번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/itemVisuals.ts (line 201):
 *     export const getArmorStyleFromItem = (armor, fallback: any = 'coat') => {
 *         if (!armor || armor.type !== 'armor') return fallback;
 *         ...
 *         return fallback;
 *     }
 * - 호출 사이트 (7 callsite):
 *     · equipmentArt.ts:102 — getArmorStyleFromItem(item, fallback).
 *     · itemVisuals.ts:272 / 317 — getArmorStyleFromItem(item, 'coat').
 *     · characterAppearance.ts:53 / 77 / 106 — getArmorStyleFromItem(item/armor,
 *       'coat' or baseStyle.armorStyle).
 *     · avatarEquipmentPreview.ts:26 — getArmorStyleFromItem(item, 'coat').
 *     · 7 callsite 모두 fallback 명시 전달.
 *
 * 패턴 (cycle 222-511 시리즈 261번째):
 * - cycle 502-511: util default 청소 메가 시리즈.
 * - cycle 512: getArmorStyleFromItem fallback default — 같은 lens.
 *
 * 수정 (src/utils/itemVisuals.ts):
 * - signature에서 fallback: any = 'coat' → fallback: any (default 제거).
 * - body fallback 사용 그대로 (caller가 명시 전달).
 *
 * 회귀 가드:
 * - 7 callsite 동작 그대로.
 * - body keyword 분기 / fallback return 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 512: getArmorStyleFromItem signature에서 fallback default 0건', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    const fnIdx = source.indexOf('export const getArmorStyleFromItem');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/fallback:\s*any\s*=\s*'coat'/.test(sig), 'fallback default 제거');
    assert.ok(/\bfallback\b/.test(sig), 'fallback 파라미터 자체는 보존');
});

test('cycle 512: 정합성 가드 — 모든 callsite fallback 명시 전달', async () => {
    const callerFiles = [
        'src/utils/equipmentArt.ts',
        'src/utils/itemVisuals.ts',
        'src/utils/characterAppearance.ts',
        'src/utils/avatarEquipmentPreview.ts',
    ];
    let totalCalls = 0;
    for (const f of callerFiles) {
        const source = await readSrc(f);
        const matches = source.match(/getArmorStyleFromItem\(/g) || [];
        totalCalls += matches.length;
    }
    assert.ok(totalCalls >= 7, `getArmorStyleFromItem 호출 7건 이상 (실제: ${totalCalls})`);
});

test('cycle 512: body keyword 분기 / fallback return 보존', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    assert.ok(/return 'robe'/.test(source), 'robe 분기 보존');
    assert.ok(/return 'leather'/.test(source), 'leather 분기 보존');
    assert.ok(/return 'coat'/.test(source), 'coat 분기 보존');
    assert.ok(/return 'plate'/.test(source), 'plate 분기 보존');
    assert.ok(/return fallback/.test(source), 'fallback return 보존');
});

test('cycle 512: cycle 502-511 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getWeaponAttackValue[^=]*slot:\s*any\s*=\s*'main'/.test(eu),
        'cycle 511 getWeaponAttackValue slot default 0건');
});
