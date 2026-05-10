import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 511: getWeaponAttackValue + getWeaponCritBonus 2 slot defaults batch
 *   (cycle 222-510 silent dead config 시리즈 260번째 — redundant default annotation
 *   util-level batch, util default 청소 메가 시리즈 9번째).
 *
 * 발견 (2 default unreachable):
 * - src/utils/equipmentUtils.ts (line 48, 63):
 *     export const getWeaponAttackValue = (weapon, slot: any = 'main') => {...}
 *     export const getWeaponCritBonus = (weapon, slot: any = 'main') => {...}
 * - 호출 사이트 (모두 같은 파일 내부):
 *     · getWeaponAttackValue: line 71 (slot), 109/110 ('main'/'offhand'), 259/262 ('main').
 *     · getWeaponCritBonus: line 71 (slot), 76 ('offhand'), 112 ('main'), 262 ('main').
 *     · 모든 callsite가 slot 명시 전달.
 *     · 다른 파일 import 0건 (export지만 외부 사용 0건).
 * - 결과: slot 항상 명시 전달. default 'main' 도달 불가.
 *
 * 패턴 (cycle 222-510 시리즈 260번째):
 * - cycle 502-509: util default 청소 메가 시리즈.
 * - cycle 511: equipmentUtils 2 함수 batch — 동일 lens.
 *
 * 수정 (src/utils/equipmentUtils.ts):
 * - 2 함수 모두 slot: any = 'main' → slot: any (default 제거).
 *
 * 회귀 가드:
 * - 모든 callsite 동작 그대로.
 * - body slot === 'offhand' 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 511: getWeaponAttackValue signature에서 slot default 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    const fnIdx = source.indexOf('export const getWeaponAttackValue');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/slot:\s*any\s*=\s*'main'/.test(sig), 'slot default 제거');
    assert.ok(/\bslot\b/.test(sig), 'slot 파라미터 자체는 보존');
});

test('cycle 511: getWeaponCritBonus signature에서 slot default 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    const fnIdx = source.indexOf('export const getWeaponCritBonus');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/slot:\s*any\s*=\s*'main'/.test(sig), 'slot default 제거');
    assert.ok(/\bslot\b/.test(sig), 'slot 파라미터 자체는 보존');
});

test('cycle 511: body slot 분기 보존', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/slot === 'offhand'/.test(source), "slot === 'offhand' 분기 보존");
    assert.ok(/OFFHAND_WEAPON_RATIO/.test(source), 'BALANCE.OFFHAND_WEAPON_RATIO 보존');
    assert.ok(/OFFHAND_ONE_HAND_CRIT_BONUS/.test(source), 'OFFHAND CRIT 보존');
});

test('cycle 511: 정합성 가드 — 모든 callsite slot 명시 전달', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    // getWeaponAttackValue 호출 (자체 정의 제외)
    const attackCalls = source.match(/getWeaponAttackValue\([^)]+\)/g) || [];
    attackCalls.forEach((call, i) => {
        // 호출에 콤마(2 args 이상) 있어야 함
        assert.ok(/,/.test(call), `getWeaponAttackValue callsite ${i}: slot 명시 (콤마 존재)`);
    });
    const critCalls = source.match(/getWeaponCritBonus\([^)]+\)/g) || [];
    critCalls.forEach((call, i) => {
        assert.ok(/,/.test(call), `getWeaponCritBonus callsite ${i}: slot 명시 (콤마 존재)`);
    });
});
