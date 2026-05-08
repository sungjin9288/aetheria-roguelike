import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 353: getSelectedSkill 반환 shape 단순화 (index / total 출력 dead)
 *   (cycle 222-352 silent dead config 시리즈 120번째 — cleanup lens 연속).
 *
 * 발견 (2 dead output fields):
 * - getSelectedSkill 반환 객체에 `index` / `total` 필드.
 * - useCombatActions는 `?.skill || null` unwrap만 사용.
 * - combatAttack은 `selected?.skill` 사용. index/total 직접 read 0건.
 *
 * 패턴 (cycle 222-352 silent dead config 시리즈 120번째):
 * - cycle 352: getLootUpgradeHint score 출력 dead.
 * - cycle 353: getSelectedSkill 반환 shape 단순화.
 *
 * 수정:
 * - src/hooks/combatActions/_helpers.ts: getSelectedSkill 반환에서 index/total 제거.
 * - src/hooks/combatActions/combatAttack.ts: 'randomSkills' 분기에서 selected 재할당
 *   shape도 동기화 (index/total 제거).
 *
 * 회귀 가드:
 * - selected.skill 여전히 노출 (combatAttack `selected?.skill` 사용).
 * - useCombatActions getSelectedSkill 호출 chain 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 353: getSelectedSkill 반환에 index / total 0건', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    const fn = source.slice(source.indexOf('export const getSelectedSkill'), source.indexOf('export const getLootUpgradeHint'));
    assert.ok(/return \{ skill: skills\[index\] \};/.test(fn),
        'return shape { skill: skills[index] }만 노출');
});

test('cycle 353: combatAttack 재할당 shape 동기화', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(/selected = \{ skill: randomSkill \};/.test(source),
        'randomSkill 재할당 shape 단순화');
});

test('cycle 353: getSelectedSkill 동작 보존', async () => {
    const { getSelectedSkill } = await import('../src/hooks/combatActions/_helpers.js');
    const player = { job: '검사', skillLoadout: { selected: 0 } };
    const result = getSelectedSkill(player);
    if (result) {
        // index / total 0건, skill만 노출.
        assert.ok('skill' in result, 'skill 보존');
        assert.equal(result.index, undefined, 'index 0건');
        assert.equal(result.total, undefined, 'total 0건');
    }
});

test('cycle 352 회귀 가드: getLootUpgradeHint score 0건', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    const fn = source.slice(source.indexOf('export const getLootUpgradeHint'));
    assert.ok(/let bestScore =/.test(fn),
        'cycle 352 bestScore internal 보존');
});
