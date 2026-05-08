import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 291: updateStats / getWeaponEquipScore export → private downgrade
 *   (cycle 222-290 silent dead config 시리즈 61번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/playerStateUtils.ts: updateStats — 외부 0건, incrementStat 내부 1회만 사용.
 * - src/utils/equipmentUtils.ts: getWeaponEquipScore — 외부 0건,
 *   getEquipmentProfile 내부 1회만 사용.
 *
 * 패턴 (cycle 222-290 silent dead config 시리즈 61번째):
 * - cycle 290: applyItemPrefix dead 매개변수 정리.
 * - cycle 291: 2개 util private downgrade — export 표면 축소.
 *
 * 수정:
 * - playerStateUtils.ts: `export const updateStats` → `const updateStats` (private).
 * - equipmentUtils.ts: `export const getWeaponEquipScore` → `const getWeaponEquipScore`.
 *
 * 회귀 가드:
 * - incrementStat / getEquipmentProfile active export 유지.
 * - 내부 호출 동작 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 291: updateStats export 제거 (private)', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    assert.ok(!/export const updateStats/.test(source),
        'updateStats export 제거됨');
    assert.ok(/const updateStats/.test(source),
        'updateStats const 정의 유지 (private)');
});

test('cycle 291: getWeaponEquipScore export 제거 (private)', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/export const getWeaponEquipScore/.test(source),
        'getWeaponEquipScore export 제거됨');
    assert.ok(/const getWeaponEquipScore/.test(source),
        'getWeaponEquipScore const 정의 유지 (private)');
});

test('cycle 291: incrementStat / getEquipmentProfile active export 유지', async () => {
    const psSrc = await readSrc('src/utils/playerStateUtils.ts');
    const eqSrc = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/export const incrementStat/.test(psSrc), 'incrementStat 유지');
    assert.ok(/export const getEquipmentProfile/.test(eqSrc), 'getEquipmentProfile 유지');
});

test('cycle 291: incrementStat 동작 보존 (회귀 가드)', async () => {
    const { incrementStat } = await import('../src/utils/playerStateUtils.js');
    const player = { stats: { kills: 5 } };
    const next = incrementStat(player, 'kills', 3);
    assert.equal(next.stats.kills, 8, 'kills 5+3=8');
    assert.notEqual(next, player, '새 객체 반환 (immutable)');
});

test('cycle 290 회귀 가드: applyItemPrefix options 0건 유지', async () => {
    const source = await readSrc('src/utils/itemPrefixUtils.ts');
    assert.ok(!/options\.chance|options\.force/.test(source),
        'cycle 290 cleanup 유지');
});
