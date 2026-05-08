import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 312: anchorPoints WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS export → private
 *   (cycle 222-311 silent dead config 시리즈 82번째 — cleanup lens 연속).
 *
 * 발견 (2 private downgrade, 모두 동일 파일 내부 사용만):
 * - WEAPON_PLACEMENTS (line 70): getWeaponPlacement (line 187) +
 *   DEFAULT_WEAPON_PLACEMENT (line 103) 내부 2회 사용, 외부 0건.
 * - OFFHAND_PLACEMENTS (line 108): getOffhandPlacement (line 189) 내부 1회 사용,
 *   외부 0건.
 *
 * 패턴 (cycle 222-311 silent dead config 시리즈 82번째):
 * - cycle 311: adventureGuideActions.ts cascade orphan 제거.
 * - cycle 312: anchorPoints 2 placement 객체 private downgrade.
 *
 * 수정 (src/utils/anchorPoints.ts):
 * - WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS export 제거 (private const 유지).
 *
 * 회귀 가드:
 * - getWeaponPlacement / getOffhandPlacement active export 유지.
 * - AVATAR_ANCHORS / BACK_LAYER_*_STYLES active export 유지.
 * - 내부 호출 chain 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 312: WEAPON_PLACEMENTS export 제거 (private)', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(!/export const WEAPON_PLACEMENTS\b/.test(source),
        'WEAPON_PLACEMENTS export 제거됨');
    assert.ok(/const WEAPON_PLACEMENTS\b/.test(source),
        'WEAPON_PLACEMENTS const 정의 유지 (private)');
});

test('cycle 312: OFFHAND_PLACEMENTS export 제거 (private)', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(!/export const OFFHAND_PLACEMENTS\b/.test(source),
        'OFFHAND_PLACEMENTS export 제거됨');
    assert.ok(/const OFFHAND_PLACEMENTS\b/.test(source),
        'OFFHAND_PLACEMENTS const 정의 유지 (private)');
});

test('cycle 312: getWeaponPlacement / getOffhandPlacement active export 유지', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(/export const getWeaponPlacement\b/.test(source),
        'getWeaponPlacement export 유지');
    assert.ok(/export const getOffhandPlacement\b/.test(source),
        'getOffhandPlacement export 유지');
});

test('cycle 312: getWeaponPlacement / getOffhandPlacement 동작 보존 (회귀 가드)', async () => {
    const { getWeaponPlacement, getOffhandPlacement } = await import('../src/utils/anchorPoints.js');
    // 미정의 style → DEFAULT placement 반환.
    const result = getWeaponPlacement('___unknown___');
    assert.ok(result, 'unknown style → DEFAULT_WEAPON_PLACEMENT 반환');
    const result2 = getOffhandPlacement('___unknown___');
    assert.ok(result2, 'unknown style → DEFAULT_OFFHAND_PLACEMENT 반환');
});

test('cycle 311 회귀 가드: adventureGuideActions.ts 제거 유지', async () => {
    const { access } = await import('node:fs/promises');
    let exists = true;
    try {
        await access(path.join(ROOT, 'src/utils/adventureGuideActions.ts'));
    } catch {
        exists = false;
    }
    assert.equal(exists, false, 'cycle 311 adventureGuideActions 제거 유지');
});
