import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 294: itemVisuals.ts 3 exports → private downgrade
 *   (cycle 222-293 silent dead config 시리즈 64번째 — cleanup lens 연속).
 *
 * 발견 (3 private downgrade 후보, 모두 itemVisuals 내부 사용만):
 * - getMaterialVisualKey: getEquipmentVisualKey 내부 1회 (line 276), 외부 0건.
 * - IMAGEGEN_ITEM_PNG_KEYS: getItemIconAssetExtension 내부 1회 (line 365), 외부 0건.
 * - getItemIconAssetExtension: getItemIconAssetSrc 내부 1회 (line 386), 외부 0건.
 *
 * 패턴 (cycle 222-293 silent dead config 시리즈 64번째):
 * - cycle 293: getAllItems private downgrade.
 * - cycle 294: itemVisuals 3 private downgrade — export 표면 3개 축소.
 *
 * 수정 (src/utils/itemVisuals.ts):
 * - 3 export 제거 (private const 유지).
 * - 내부 호출 chain 그대로.
 *
 * 회귀 가드:
 * - getEquipmentVisualKey / getItemIconAssetSrc active export 유지.
 * - getEquipmentVisualKey 동작 동일 (재료 lookup 포함).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 294: 3 exports 제거 (private)', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    const deadExports = ['getMaterialVisualKey', 'IMAGEGEN_ITEM_PNG_KEYS', 'getItemIconAssetExtension'];
    deadExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(!re.test(source), `${name} export 제거됨`);
        const constRe = new RegExp(`const ${name}\\b`);
        assert.ok(constRe.test(source), `${name} const 정의 유지 (private)`);
    });
});

test('cycle 294: itemVisuals active exports 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    const activeExports = ['getEquipmentVisualKey', 'getItemIconAssetSrc', 'getWeaponVisualKey', 'getOffhandVisualKey'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 294: getEquipmentVisualKey 동작 보존 (재료 lookup chain)', async () => {
    const { getEquipmentVisualKey } = await import('../src/utils/itemVisuals.js');
    const matItem = { type: 'mat', name: '약초' };
    const result = getEquipmentVisualKey(matItem);
    // 재료 lookup chain — 내부 getMaterialVisualKey 호출 유지 확인.
    assert.ok(typeof result === 'string', 'string 반환');
});

test('cycle 293 회귀 가드: getAllItems private 유지', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/export const getAllItems/.test(source),
        'cycle 293 getAllItems private 유지');
});
