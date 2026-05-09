import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 415: getWeeklySpecial `isWeeklySpecial` 출력 dead 마커 정리
 *   (cycle 222-414 silent dead config 시리즈 176번째 — function output dead lens 회귀).
 *
 * 발견 (1 dead 출력 필드):
 * - src/utils/shopRotation.ts getWeeklySpecial return:
 *   `{ ...item, originalPrice, price, isWeeklySpecial: true }` (line 105-110).
 * - 외부 read 분석:
 *   · originalPrice: ShopPanel.tsx:265 read (line-through 가격 표시).
 *   · price/...item: 표준 사용.
 *   · **isWeeklySpecial: src/, tests/ 어디에서도 read 0건**.
 * - cycle 355는 isDailyDeal 마커를 회귀 가드로 보존했지만 isWeeklySpecial은 누락 —
 *   원래부터 read 0건이라 silent dead 마커.
 *
 * 패턴 (cycle 222-414 시리즈 176번째):
 * - cycle 270/278/279/333/336/352/353/354/389/409: 함수 출력 dead 필드 정리.
 * - cycle 415: getWeeklySpecial isWeeklySpecial 출력 dead 마커 — 동일 lens 회귀.
 *
 * 수정 (src/utils/shopRotation.ts):
 * - getWeeklySpecial return에서 `isWeeklySpecial: true` 라인 제거.
 *
 * 회귀 가드:
 * - originalPrice / price / item spread 동작 그대로.
 * - getDailyDeals isDailyDeal 마커 보존 (cycle 355 회귀 가드).
 * - ShopPanel weeklySpecial.originalPrice line-through 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 415: getWeeklySpecial return에서 isWeeklySpecial 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fnStart = source.indexOf('export const getWeeklySpecial');
    // getWeeklySpecial은 마지막 함수 — 파일 끝까지 검사.
    const fnBlock = source.slice(fnStart);
    assert.ok(!/isWeeklySpecial:\s*true/.test(fnBlock),
        'getWeeklySpecial return에서 isWeeklySpecial 0건');
});

test('cycle 415: getDailyDeals isDailyDeal 마커 보존 (cycle 355 회귀)', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fnStart = source.indexOf('export const getDailyDeals');
    const fnEnd = source.indexOf('export const getWeeklySpecial', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(/isDailyDeal:\s*true/.test(fnBlock),
        'getDailyDeals isDailyDeal 마커 보존');
});

test('cycle 415: getWeeklySpecial 동작 보존 (originalPrice / price)', async () => {
    const { getWeeklySpecial } = await import('../src/utils/shopRotation.js');
    const result = getWeeklySpecial(20);
    if (result === null) return; // 데이터 없는 경우는 회귀 가드 면제
    assert.ok(typeof result.originalPrice === 'number', 'originalPrice 보존');
    assert.ok(typeof result.price === 'number', 'price 보존');
    assert.equal(result.price, Math.floor(result.originalPrice * 0.85),
        '15% 할인 적용 동작 보존');
    assert.equal(result.isWeeklySpecial, undefined, 'isWeeklySpecial 마커 미설정');
});

test('cycle 414 회귀 가드: ICON_PATHS sword 0건', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const blockStart = source.indexOf('const ICON_PATHS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+sword:/m.test(block),
        'cycle 414 ICON_PATHS.sword 0건 보존');
});
