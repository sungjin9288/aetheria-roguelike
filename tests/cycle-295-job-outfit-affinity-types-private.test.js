import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 295: jobOutfitAffinity.ts 4 type exports → private downgrade
 *   (cycle 222-294 silent dead config 시리즈 65번째 — cleanup lens 연속).
 *
 * 발견 (4 type/interface private downgrade, 모두 동일 파일 내부 사용만):
 * - AffinityTier (line 16): 외부 0건, buildAffinityLabel param + tier 변수 사용.
 * - AffinityBonus (line 18): 외부 0건, FULL/PARTIAL_2/PARTIAL_1_BONUS const + bonus 변수 사용.
 * - OutfitAffinity (line 25): 외부 0건, getJobOutfitAffinity 반환 타입 + empty 변수 사용.
 * - ItemLike (line 34): 외부 0건, ItemsDb / SetCatalog / matchesJob / byTier 사용.
 *
 * 패턴 (cycle 222-294 silent dead config 시리즈 65번째):
 * - cycle 294: itemVisuals 3 exports private downgrade.
 * - cycle 295: jobOutfitAffinity 4 type exports private downgrade.
 *
 * 수정 (src/utils/jobOutfitAffinity.ts):
 * - 4 type/interface export 제거 (private 유지).
 * - 동일 파일 내부 사용 모두 그대로.
 *
 * 회귀 가드:
 * - getJobOutfitAffinity / getJobSetCatalog active export 유지.
 * - getJobOutfitAffinity 동작 동일 (반환 shape 보존).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 295: 4 type exports 제거 (private)', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    assert.ok(!/export type AffinityTier\b/.test(source), 'AffinityTier export 제거');
    assert.ok(!/export interface AffinityBonus\b/.test(source), 'AffinityBonus export 제거');
    assert.ok(!/export interface OutfitAffinity\b/.test(source), 'OutfitAffinity export 제거');
    assert.ok(!/export interface ItemLike\b/.test(source), 'ItemLike export 제거');
});

test('cycle 295: 4 type 정의 자체는 유지 (private)', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    assert.ok(/type AffinityTier\b/.test(source), 'AffinityTier 정의 유지');
    assert.ok(/interface AffinityBonus\b/.test(source), 'AffinityBonus 정의 유지');
    assert.ok(/interface OutfitAffinity\b/.test(source), 'OutfitAffinity 정의 유지');
    assert.ok(/interface ItemLike\b/.test(source), 'ItemLike 정의 유지');
});

test('cycle 295: getJobOutfitAffinity / getJobSetCatalog active export 유지', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    assert.ok(/export const getJobOutfitAffinity\b/.test(source), 'getJobOutfitAffinity 유지');
    assert.ok(/export const getJobSetCatalog\b/.test(source), 'getJobSetCatalog 유지');
});

test('cycle 295: getJobOutfitAffinity 동작 보존 (회귀 가드)', async () => {
    const { getJobOutfitAffinity } = await import('../src/utils/jobOutfitAffinity.js');
    const player = { job: '검사', equip: {} };
    const result = getJobOutfitAffinity(player);
    assert.equal(typeof result.matchCount, 'number', 'matchCount 숫자');
    assert.equal(typeof result.tier, 'string', 'tier 문자열');
});

test('cycle 294 회귀 가드: itemVisuals 3 private 유지', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    assert.ok(!/export const getMaterialVisualKey/.test(source),
        'cycle 294 getMaterialVisualKey private 유지');
    assert.ok(!/export const IMAGEGEN_ITEM_PNG_KEYS/.test(source),
        'cycle 294 IMAGEGEN_ITEM_PNG_KEYS private 유지');
});
