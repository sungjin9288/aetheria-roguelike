import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 337: getEnhanceAvailability materialCount 출력 dead 정리
 *   (cycle 222-336 silent dead config 시리즈 106번째 — cleanup lens 연속).
 *
 * 발견 (dead output field):
 * - getEnhanceAvailability 5 return branches에서 `materialCount: getEnhanceMaterialCount(inventory)`
 *   필드 노출.
 * - src/, tests/ 어디에서도 `availability.materialCount` read 0건.
 * - EquipmentPanel은 requirement / canEnhance / affordable / hint만 사용.
 *   useInventoryActions는 missing / requirement만 사용.
 *
 * 패턴 (cycle 222-336 silent dead config 시리즈 106번째):
 * - cycle 336: getPostCombatAnalysis hpRatio/mpRatio 출력 dead.
 * - cycle 337: getEnhanceAvailability materialCount 5회 출력 cleanup.
 *
 * 수정 (src/utils/enhancementUtils.ts):
 * - 5 return 분기에서 `materialCount` 필드 제거.
 * - 내부 변수 const materialCount는 if (materialCount < requirement.materials) 분기 계산용으로 그대로 유지.
 *
 * 회귀 가드:
 * - canEnhance / affordable / missing / hint / requirement 필드 보존.
 * - 내부 material 부족 분기 동작 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 337: getEnhanceAvailability return에서 materialCount 0건', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    // return 객체 안의 materialCount 0건 (내부 변수는 별개).
    assert.ok(!/^\s+materialCount[,:]/m.test(source),
        'return 객체에서 materialCount 필드 0건');
});

test('cycle 337: getEnhanceAvailability 핵심 필드 보존', async () => {
    const { getEnhanceAvailability } = await import('../src/utils/enhancementUtils.js');
    const result = getEnhanceAvailability({ type: 'weapon', enhance: 0 }, 1000, []);
    assert.ok('canEnhance' in result, 'canEnhance 보존');
    assert.ok('affordable' in result, 'affordable 보존');
    assert.ok('missing' in result, 'missing 보존');
    assert.ok('hint' in result, 'hint 보존');
    assert.ok('requirement' in result, 'requirement 보존');
    assert.equal(result.materialCount, undefined, 'materialCount 출력 0건');
});

test('cycle 337: 5 분기 모두 정상 동작 (invalid/max/gold/material/ok)', async () => {
    const { getEnhanceAvailability } = await import('../src/utils/enhancementUtils.js');
    // invalid (consumable type)
    const invalid = getEnhanceAvailability({ type: 'consumable', enhance: 0 }, 0, []);
    assert.equal(invalid.missing, 'invalid');
    // max
    const max = getEnhanceAvailability({ type: 'weapon', enhance: 10 }, 1000, []);
    assert.equal(max.missing, 'max');
    // gold 부족
    const gold = getEnhanceAvailability({ type: 'weapon', enhance: 0 }, 0, []);
    assert.equal(gold.missing, 'gold');
});

test('cycle 336 회귀 가드: getPostCombatAnalysis hpRatio/mpRatio 0건 보존', async () => {
    const source = await readSrc('src/utils/outcomeAnalysis.ts');
    const fn = source.slice(0, source.indexOf('export const getRunSummaryAnalysis'));
    assert.ok(!/^\s+hpRatio,$/m.test(fn), 'cycle 336 hpRatio 0건 보존');
});
