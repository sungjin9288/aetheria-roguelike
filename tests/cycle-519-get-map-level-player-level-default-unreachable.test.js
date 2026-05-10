import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 519: getMapLevel `playerLevel = 1` default unreachable
 *   (cycle 222-518 silent dead config 시리즈 264번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 17번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/adventureGuide.ts (line 32):
 *     const getMapLevel = (map, playerLevel: any = 1) => (
 *         map?.level === 'infinite'
 *             ? Math.max((playerLevel || 1) + 8, 50)
 *             : (map?.minLv ?? (typeof map?.level === 'number' ? map.level : 1))
 *     );
 * - 호출 사이트 (1 callsite, 모듈 내부 private):
 *     · adventureGuide.ts:145 — getMapLevel(targetMap, playerLevel).
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: playerLevel 항상 명시 전달. default 1 도달 불가.
 *
 * 패턴 (cycle 222-518 시리즈 264번째):
 * - cycle 502-518: util default 청소 메가 시리즈.
 * - cycle 519: getMapLevel playerLevel — 동일 lens.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - signature에서 playerLevel: any = 1 → playerLevel: any.
 * - body의 (playerLevel || 1) nullish 가드 보존 (caller가 0/undefined 넘기는
 *   가능성 자체는 보존).
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body (playerLevel || 1) defensive 가드 + map?.minLv ?? fallback chain 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 519: getMapLevel signature에서 playerLevel default 0건', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const fnIdx = source.indexOf('const getMapLevel');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(sig), 'playerLevel default 1 제거');
    assert.ok(/\bplayerLevel\b/.test(sig), 'playerLevel 파라미터 자체는 보존');
});

test('cycle 519: 정합성 가드 — internal callsite 보존', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(/getMapLevel\(targetMap,\s*playerLevel\)/.test(source),
        'internal callsite (targetMap, playerLevel) 보존');
});

test('cycle 519: body (playerLevel || 1) defensive 가드 + map?.minLv 체인 보존', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(/\(playerLevel \|\| 1\) \+ 8/.test(source),
        '(playerLevel || 1) nullish defensive guard 보존');
    assert.ok(/map\?\.minLv\s*\?\?\s*\(typeof map\?\.level/.test(source),
        'map?.minLv ?? fallback chain 보존');
});

test('cycle 519: cycle 502-518 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getWeaponEquipScore[^=]*slot:\s*any\s*=\s*'main'/.test(eu),
        'cycle 518 getWeaponEquipScore slot default 0건');

    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/getArmorBodyStyle[^=]*fallback:\s*any\s*=\s*'coat'/.test(ea),
        'cycle 517 getArmorBodyStyle fallback default 0건');
});
