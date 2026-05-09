import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 355: getDailyDeals discount 출력 dead 정리
 *   (cycle 222-354 silent dead config 시리즈 122번째 — cleanup lens 연속).
 *
 * 발견 (1 dead output field):
 * - getDailyDeals 반환 객체의 discount 필드 (= 0.1 hardcoded).
 * - ShopPanel은 `dailyDeals.items`만 read. discount 외부 read 0건.
 * - 일일 할인율은 함수 내부에서 `Math.floor(item.price * 0.9)`로 이미 적용 완료.
 *   결과 가격이 새 price 필드로 노출되므로 discount 별도 노출은 redundant.
 *
 * 패턴 (cycle 222-354 silent dead config 시리즈 122번째):
 * - cycle 354: getTraitLootHint score/label/traitName 3 출력 dead.
 * - cycle 355: getDailyDeals discount 1 출력 dead.
 *
 * 수정 (src/utils/shopRotation.ts):
 * - getDailyDeals return에서 discount 필드 제거 — items 배열만 노출.
 * - JSDoc @returns 시그니처도 단순화.
 *
 * 회귀 가드:
 * - dailyDeals.items 보존 (ShopPanel 사용).
 * - 내부 0.9 multiplier 적용 그대로 (item.price = floor(originalPrice * 0.9)).
 * - originalPrice / isDailyDeal 마커 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 355: getDailyDeals return에 discount 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fn = source.slice(source.indexOf('export const getDailyDeals'), source.indexOf('export const getWeeklySpecial'));
    assert.ok(!/discount:/.test(fn),
        'getDailyDeals return에서 discount 필드 0건');
});

test('cycle 355: getDailyDeals 동작 보존 (items 배열 + 0.9 가격)', async () => {
    const { getDailyDeals } = await import('../src/utils/shopRotation.js');
    const result = getDailyDeals(5);
    assert.ok(Array.isArray(result.items), 'items 배열 노출');
    assert.equal(result.discount, undefined, 'discount 필드 0건');
    if (result.items.length > 0) {
        const first = result.items[0];
        assert.ok(typeof first.price === 'number', 'price 보존');
        assert.ok(typeof first.originalPrice === 'number', 'originalPrice 보존');
        // cycle 436: isDailyDeal 마커 제거 — circular guard였음. cycle-436 test가 대체.
        assert.equal(first.price, Math.floor(first.originalPrice * 0.9),
            '0.9 할인 multiplier 그대로 적용');
    }
});

test('cycle 354 회귀 가드: getTraitLootHint score/label/traitName 0건 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fn = source.slice(source.indexOf('export const getTraitLootHint'), source.indexOf('export const getTraitQuestResonance'));
    assert.ok(!/^\s+score:\s/m.test(fn),
        'cycle 354 score 0건 보존');
    assert.ok(!/^\s+label:\s/m.test(fn),
        'cycle 354 label 0건 보존');
    assert.ok(!/traitName:/.test(fn),
        'cycle 354 traitName 0건 보존');
});
