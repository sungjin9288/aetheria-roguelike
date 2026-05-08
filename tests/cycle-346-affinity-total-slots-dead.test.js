import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 346: getJobOutfitAffinity totalSlots 출력 dead 정리
 *   (cycle 222-345 silent dead config 시리즈 114번째 — cleanup lens 연속).
 *
 * 발견 (dead output field):
 * - getJobOutfitAffinity 반환에 totalSlots 필드 (장착 슬롯 수 카운트).
 * - src/, tests/ 어디에서도 affinity.totalSlots / aff.totalSlots read 0건.
 *
 * 활성 필드: matchCount / bonus / label / tier / slots.
 *
 * 패턴 (cycle 222-345 silent dead config 시리즈 114번째):
 * - cycle 345: scoreTag desc 매개변수 + 출력 dead.
 * - cycle 346: getJobOutfitAffinity totalSlots 출력 dead.
 *
 * 수정 (src/utils/jobOutfitAffinity.ts):
 * - getJobOutfitAffinity 3 return 분기에서 totalSlots 필드 제거.
 * - OutfitAffinity interface에서도 totalSlots 필드 제거.
 *
 * 회귀 가드:
 * - matchCount / bonus / label / tier / slots 활성 필드 보존.
 * - EquipmentPanel은 aff.matchCount / aff.tier / aff.label / aff.bonus 사용 — 영향 없음.
 * - statsCalculator는 affinity.bonus 사용 — 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 346: getJobOutfitAffinity totalSlots 출력 0건', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    const fn = source.slice(source.indexOf('export const getJobOutfitAffinity'));
    assert.ok(!/totalSlots:/.test(fn),
        'totalSlots 출력 0건');
});

test('cycle 346: OutfitAffinity interface totalSlots 필드 제거', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    const block = source.match(/interface OutfitAffinity \{[\s\S]+?\n\}/);
    assert.ok(block, 'OutfitAffinity interface 발견');
    assert.ok(!/totalSlots:/.test(block[0]),
        'interface에서 totalSlots 필드 제거됨');
});

test('cycle 346: getJobOutfitAffinity 활성 필드 보존', async () => {
    const { getJobOutfitAffinity } = await import('../src/utils/jobOutfitAffinity.js');
    const player = { job: '검사', equip: {} };
    const affinity = getJobOutfitAffinity(player);
    assert.ok('matchCount' in affinity, 'matchCount 보존');
    assert.ok('bonus' in affinity, 'bonus 보존');
    assert.ok('tier' in affinity, 'tier 보존');
    assert.ok('slots' in affinity, 'slots 보존');
    assert.equal(affinity.totalSlots, undefined, 'totalSlots 0건');
});

test('cycle 345 회귀 가드: scoreTag desc 매개변수 0건 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/const scoreTag = \(id: any, name: any, score: any, reasons/.test(source),
        'cycle 345 scoreTag 4-arg 보존');
});
