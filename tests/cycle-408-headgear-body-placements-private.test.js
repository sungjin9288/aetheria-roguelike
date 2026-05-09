import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 408: HEADGEAR_PLACEMENTS + BODY_PLACEMENTS export → private downgrade batch
 *   (cycle 222-407 silent dead config 시리즈 170번째 — private downgrade lens 회귀).
 *
 * 발견 (2 export → private 후보):
 * - src/utils/anchorPoints.ts HEADGEAR_PLACEMENTS / BODY_PLACEMENTS:
 *   · 둘 다 내부 1회만 사용 (getHeadgearPlacement / getBodyPlacement lookup용).
 *   · 외부 consumer 0건 (src/, tests/ 모두).
 * - cycle 312에서 WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS 동일 lens로 private downgrade.
 *   HEADGEAR / BODY 누락분 paired completion.
 *
 * 패턴 (cycle 222-407 시리즈 170번째):
 * - cycle 295/298/312/316/317/369/391: export → private downgrade lens.
 * - cycle 408: HEADGEAR_PLACEMENTS / BODY_PLACEMENTS private downgrade —
 *   동일 lens 회귀 (cycle 312 paired completion).
 *
 * 수정 (src/utils/anchorPoints.ts):
 * - `export const HEADGEAR_PLACEMENTS` → `const HEADGEAR_PLACEMENTS`.
 * - `export const BODY_PLACEMENTS` → `const BODY_PLACEMENTS`.
 *
 * 회귀 가드:
 * - getHeadgearPlacement / getBodyPlacement active export 유지.
 * - placementToTransform / placementLayer / getArmorPlacement 동작 그대로.
 * - AVATAR_ANCHORS / BACK_LAYER_*_STYLES export 보존.
 * - cycle 312 WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 408: HEADGEAR_PLACEMENTS export 제거 (private)', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(!/export const HEADGEAR_PLACEMENTS\b/.test(source),
        'HEADGEAR_PLACEMENTS export 제거됨');
    assert.ok(/const HEADGEAR_PLACEMENTS\b/.test(source),
        'HEADGEAR_PLACEMENTS const 정의 유지 (private)');
});

test('cycle 408: BODY_PLACEMENTS export 제거 (private)', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(!/export const BODY_PLACEMENTS\b/.test(source),
        'BODY_PLACEMENTS export 제거됨');
    assert.ok(/const BODY_PLACEMENTS\b/.test(source),
        'BODY_PLACEMENTS const 정의 유지 (private)');
});

test('cycle 408: anchorPoints 활성 export 유지', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    const activeExports = ['AVATAR_ANCHORS', 'BACK_LAYER_ARMOR_STYLES',
        'BACK_LAYER_HEADGEAR_STYLES', 'BACK_LAYER_OFFHAND_STYLES',
        'getWeaponPlacement', 'getOffhandPlacement',
        'getHeadgearPlacement', 'getBodyPlacement', 'getArmorPlacement',
        'placementToTransform', 'placementLayer'];
    for (const name of activeExports) {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    }
});

test('cycle 408: getHeadgearPlacement / getBodyPlacement 동작 보존', async () => {
    const { getHeadgearPlacement, getBodyPlacement } = await import('../src/utils/anchorPoints.js');
    const helm = getHeadgearPlacement('helm');
    assert.ok(helm, 'getHeadgearPlacement(helm) 반환');
    assert.ok(helm.transform, 'helm.transform 보존');

    const robe = getBodyPlacement('robe');
    assert.ok(robe, 'getBodyPlacement(robe) 반환');
    assert.ok(robe.transform, 'robe.transform 보존');

    assert.equal(getHeadgearPlacement(null), null, 'null 입력 → null');
    assert.equal(getBodyPlacement('none'), null, 'none 입력 → null');
});

test('cycle 312 회귀 가드: WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private 보존', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(!/export const WEAPON_PLACEMENTS\b/.test(source),
        'cycle 312 WEAPON_PLACEMENTS private 유지');
    assert.ok(!/export const OFFHAND_PLACEMENTS\b/.test(source),
        'cycle 312 OFFHAND_PLACEMENTS private 유지');
});

test('cycle 407 회귀 가드: formatRewardParts essence/relicShard 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const formatRewardParts');
    const fnEnd = source.indexOf('};', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(!/reward\.essence/.test(fnBlock),
        'cycle 407 reward.essence 0건 보존');
    assert.ok(!/reward\.relicShard/.test(fnBlock),
        'cycle 407 reward.relicShard 0건 보존');
});
