import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 518: getWeaponEquipScore `slot = 'main'` default unreachable
 *   (cycle 222-517 silent dead config 시리즈 263번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 16번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/equipmentUtils.ts (line 73):
 *     const getWeaponEquipScore = (weapon: any, slot: any = 'main') => (
 *         getWeaponAttackValue(weapon, slot) +
 *         Math.round(getWeaponCritBonus(weapon, slot) * 100)
 *     );
 * - 호출 사이트 (2 callsite, 모듈 내부 private — cycle 291 export downgrade):
 *     · equipmentUtils.ts:143 — getWeaponEquipScore(mainWeapon, 'main')
 *                              + getWeaponEquipScore(offhandWeapon, 'offhand').
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: slot 항상 명시 전달 ('main' / 'offhand'). default 'main' 도달 불가.
 *
 * 패턴 (cycle 222-517 시리즈 263번째):
 * - cycle 502-517: util default 청소 메가 시리즈.
 * - cycle 518: getWeaponEquipScore slot — 동일 lens. cycle 511에서 이미
 *   getWeaponAttackValue / getWeaponCritBonus의 slot defaults 제거함, 동일 모듈
 *   내 자매 헬퍼.
 *
 * 수정 (src/utils/equipmentUtils.ts):
 * - signature에서 slot: any = 'main' → slot: any.
 * - body의 getWeaponAttackValue(weapon, slot) + getWeaponCritBonus(weapon, slot)
 *   호출 보존.
 *
 * 회귀 가드:
 * - 2 internal callsite 동작 그대로.
 * - body slot 사용처(getWeaponAttackValue/getWeaponCritBonus 모두 cycle 511에서
 *   이미 default 제거됨) 보존.
 * - cycle 291 export downgrade 보존(export 제거된 private const 유지).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 518: getWeaponEquipScore signature에서 slot default 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    const fnIdx = source.indexOf('const getWeaponEquipScore');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/slot:\s*any\s*=\s*'main'/.test(sig), 'slot default main 제거');
    assert.ok(/\bslot\b/.test(sig), 'slot 파라미터 자체는 보존');
});

test('cycle 518: 정합성 가드 — 2 internal callsite 보존 (main / offhand 명시)', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/getWeaponEquipScore\(mainWeapon,\s*'main'\)/.test(source),
        'main slot callsite 보존');
    assert.ok(/getWeaponEquipScore\(offhandWeapon,\s*'offhand'\)/.test(source),
        'offhand slot callsite 보존');
});

test('cycle 518: body getWeaponAttackValue / getWeaponCritBonus slot 전달 보존', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/getWeaponAttackValue\(weapon,\s*slot\)/.test(source),
        'getWeaponAttackValue(weapon, slot) 보존');
    assert.ok(/getWeaponCritBonus\(weapon,\s*slot\)/.test(source),
        'getWeaponCritBonus(weapon, slot) 보존');
});

test('cycle 518: cycle 291 export downgrade 보존 (private const 유지)', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/export const getWeaponEquipScore/.test(source),
        'export 제거 (cycle 291 보존)');
    assert.ok(/const getWeaponEquipScore/.test(source),
        'private const 정의 유지');
});

test('cycle 518: cycle 502-517 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/getArmorBodyStyle[^=]*fallback:\s*any\s*=\s*'coat'/.test(ea),
        'cycle 517 getArmorBodyStyle fallback default 0건');

    const eu = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(!/getEnhanceRequirement[^=]*currentLevel:\s*any\s*=\s*0/.test(eu),
        'cycle 516 getEnhanceRequirement currentLevel default 0건');
});
