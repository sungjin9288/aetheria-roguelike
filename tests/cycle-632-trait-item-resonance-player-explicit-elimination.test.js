import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 632: getTraitItemResonance player null explicit default-elimination
 *   (cycle 222-631 silent dead config 시리즈 369번째 — explicit
 *   default-elimination pattern 22번째 적용, 변형 패턴 7번째).
 *
 * 발견 (default 이미 unreachable, signature 정리):
 * - src/utils/runProfile.ts:261:
 *     export const getTraitItemResonance = (item, traitProfile, player: Player | null = null) => {...}
 * - 호출 사이트 모두 명시 인자 전달:
 *     · runProfile.ts:340 (getProfileItemResonance 내부) — getTraitItemResonance(item, traitProfile, player).
 *     · ShopPanel.tsx:148 — getTraitItemResonance(item, traitProfile, { job: currentJob }).
 *     · SmartInventory.tsx:262 — getTraitItemResonance(item, traitProfile, player).
 * - default null 이미 도달 불가.
 *
 * 패턴 (cycle 222-631 시리즈 369번째):
 * - cycle 502-631: default 청소 메가 시리즈 126사이클.
 * - cycle 632: explicit default-elimination 22번째 (변형 패턴 7번째).
 *
 * 수정:
 * - runProfile.ts:261 — player default null 제거.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로 (이미 명시).
 * - body switch (traitId) score / label / summary 계산 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 632: getTraitItemResonance signature에서 player default null 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitItemResonance = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null\)/.test(source),
        'getTraitItemResonance player default null 제거');
    assert.ok(/getTraitItemResonance = \(item:[^)]+,\s*traitProfile:\s*any,\s*player:\s*Player\s*\|\s*null\)/.test(source),
        'getTraitItemResonance player 파라미터 보존 (default 없이)');
});

test('cycle 632: 3 callsite 명시 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*player\)/.test(rp),
        'runProfile internal callsite 명시 보존');
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*\{\s*job:\s*currentJob\s*\}\)/.test(sp),
        'ShopPanel callsite 명시 보존');
    const si = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*player\)/.test(si),
        'SmartInventory callsite 명시 보존');
});

test('cycle 632: body switch 처리 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fn = source.slice(source.indexOf('export const getTraitItemResonance'));
    assert.ok(/switch \(traitId\)/.test(fn),
        'switch (traitId) 분기 보존');
    assert.ok(/score:/.test(fn),
        'score 계산 보존');
});

test('cycle 632: cycle 502-631 회귀 가드 — default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
        'cycle 631 getEquippedWeapons equip default 0건');
    assert.ok(!/getWeaponMagicSkills = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
        'cycle 631 getWeaponMagicSkills equip default 0건');
});
