import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 631: getEquippedWeapons + getWeaponMagicSkills equip {} explicit
 *   default-elimination paired batch
 *   (cycle 222-630 silent dead config 시리즈 368번째 — explicit
 *   default-elimination pattern 21번째 적용 — 이중자릿수 정착 후 첫 사이클,
 *   paired batch 5번째).
 *
 * 발견 (2 defaults 이미 unreachable, signature 정리):
 * - src/utils/equipmentUtils.ts:218:
 *     export const getEquippedWeapons = (equip: EquipSlots = {}) => {...}
 * - src/utils/equipmentUtils.ts:247:
 *     export const getWeaponMagicSkills = (equip: EquipSlots = {}) => {...}
 * - 호출 사이트:
 *     · getEquippedWeapons:
 *       · equipmentUtils.ts:251 (getWeaponMagicSkills 내부) — 명시.
 *       · tests/equipment-utils.test.js:219 — 명시.
 *     · getWeaponMagicSkills:
 *       · gameUtils.ts:22 — getWeaponMagicSkills(player?.equip), 명시.
 *       · tests/cycle-256 (3 callers) — 모두 명시.
 * - 두 default {} 모두 이미 도달 불가.
 *
 * 패턴 (cycle 222-630 시리즈 368번째):
 * - cycle 502-630: default 청소 메가 시리즈 125사이클.
 * - cycle 631: explicit default-elimination 21번째 (이중자릿수 정착 후
 *   첫 사이클). paired batch 5번째 (cycle 613/624/626/629에 이은) +
 *   변형 패턴 (caller 모두 이미 명시 상태).
 *
 * 수정:
 * - equipmentUtils.ts:218 — getEquippedWeapons equip default {} 제거.
 * - equipmentUtils.ts:247 — getWeaponMagicSkills equip default {} 제거.
 *
 * 회귀 가드:
 * - production/test callsite 동작 그대로 (이미 명시).
 * - body weapon/offhand iteration / WEAPON_SKILL_BY_ELEM 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 631: getEquippedWeapons signature에서 equip default {} 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(source),
        'getEquippedWeapons equip default {} 제거');
    assert.ok(/getEquippedWeapons = \(equip:\s*EquipSlots\)/.test(source),
        'getEquippedWeapons equip 파라미터 보존 (default 없이)');
});

test('cycle 631: getWeaponMagicSkills signature에서 equip default {} 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getWeaponMagicSkills = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(source),
        'getWeaponMagicSkills equip default {} 제거');
    assert.ok(/getWeaponMagicSkills = \(equip:\s*EquipSlots\)/.test(source),
        'getWeaponMagicSkills equip 파라미터 보존 (default 없이)');
});

test('cycle 631: production callsite 명시 보존', async () => {
    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/getEquippedWeapons\(equip\)\.forEach/.test(eu),
        'equipmentUtils 내부 getEquippedWeapons(equip) 호출 보존');
    const gu = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/getWeaponMagicSkills\(player\?\.equip\s*\|\|\s*\{\}\)/.test(gu),
        'gameUtils getWeaponMagicSkills(player?.equip || {}) 호출 (caller-side conversion)');
});

test('cycle 631: body weapon iteration / WEAPON_SKILL_BY_ELEM 처리 보존', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/if \(isWeapon\(equip\.weapon\)\) list\.push/.test(source),
        'getEquippedWeapons weapon iteration 보존');
    assert.ok(/buildWeaponSkill\(entry\)/.test(source),
        'getWeaponMagicSkills buildWeaponSkill 호출 보존');
});

test('cycle 631: cycle 502-630 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.loot.ts');
    assert.ok(!/processLoot = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null/.test(ce),
        'cycle 629 processLoot player default 0건');
    const sh = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(!/commitExploreOutcome = \([^)]*transformPlayer:\s*any\s*=\s*null\)/.test(sh),
        "cycle 628 commitExploreOutcome transformPlayer default 0건");
});
