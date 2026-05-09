import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 436: getDailyDeals isDailyDeal 마커 출력 dead 정리
 *   (cycle 222-435 silent dead config 시리즈 195번째 — function output dead field
 *   cleanup lens 회귀, cycle 415 paired completion).
 *
 * 발견 (1 dead output marker):
 * - src/utils/shopRotation.ts getDailyDeals:
 *     items에 `isDailyDeal: true` 마커 부여.
 * - 호출 사이트 production 분석:
 *     · ShopPanel.tsx — `dailyDeals.items`만 read (isDailyDeal 미참조).
 *     · 다른 production read 0건.
 *   → isDailyDeal 마커는 production에서 dead.
 * - 정합성 분석:
 *     · cycle 355는 isDailyDeal을 회귀 가드로 보존했으나, 그 회귀 가드 자체가
 *       유일한 read (circular guard).
 *     · cycle 415 isWeeklySpecial 마커 정리 시점에서도 paired completion 누락.
 *
 * 패턴 (cycle 222-435 시리즈 195번째):
 * - cycle 415: getWeeklySpecial isWeeklySpecial 마커 제거.
 * - cycle 436: getDailyDeals isDailyDeal 마커 제거 — paired completion (두
 *   shop rotation 마커 모두 정리).
 *
 * 수정 (src/utils/shopRotation.ts):
 * - getDailyDeals items에서 `isDailyDeal: true` 라인 제거.
 * - cycle 355 test의 `isDailyDeal 마커 보존` 어설션 제거.
 * - cycle 415 test의 cycle 355 회귀 가드 부분 갱신.
 *
 * 회귀 가드:
 * - originalPrice / price 그대로 (ShopPanel line-through 표시).
 * - 0.9 할인 multiplier 적용 그대로.
 * - getDailyDeals.items 배열 노출 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 436: getDailyDeals 본체에서 isDailyDeal 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fnIdx = source.indexOf('export const getDailyDeals');
    const fnEnd = source.indexOf('export const getWeeklySpecial');
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/isDailyDeal/.test(block), 'getDailyDeals 본체 isDailyDeal 0건');
});

test('cycle 436: getDailyDeals 활성 필드 (originalPrice / price) 보존', async () => {
    const { getDailyDeals } = await import('../src/utils/shopRotation.ts');
    const result = getDailyDeals(5);
    assert.ok(Array.isArray(result.items), 'items 배열 노출');
    if (result.items.length > 0) {
        const first = result.items[0];
        assert.equal(typeof first.price, 'number', 'price 보존');
        assert.equal(typeof first.originalPrice, 'number', 'originalPrice 보존');
        assert.equal(first.price, Math.floor(first.originalPrice * 0.9),
            '0.9 할인 multiplier 그대로 적용');
        assert.equal(first.isDailyDeal, undefined, 'isDailyDeal 마커 제거');
    }
});

test('cycle 436: 정합성 가드 — production isDailyDeal read 0건', async () => {
    const { readdir } = await import('node:fs/promises');
    async function* walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) yield* walk(fp);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
        }
    }
    let reads = 0;
    for await (const fp of walk(path.join(ROOT, 'src'))) {
        const content = await readFile(fp, 'utf8').catch(() => '');
        if (/isDailyDeal/.test(content)) reads += 1;
    }
    assert.equal(reads, 0, 'production에 isDailyDeal 0건 (정합성)');
});

test('cycle 415 회귀 가드: getWeeklySpecial 마커 할당 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fnIdx = source.indexOf('export const getWeeklySpecial');
    const block = source.slice(fnIdx);
    // 마커 할당 (isWeeklySpecial: true) 0건 — 주석 멘션은 무관
    assert.ok(!/isWeeklySpecial: true/.test(block), 'cycle 415 마커 할당 0건 보존');
});

test('cycle 435 회귀 가드: makeBattleRecord ts 0건', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    const fnIdx = source.indexOf('export const makeBattleRecord');
    const fnEnd = source.indexOf('});', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/ts: Date\.now/.test(block), 'cycle 435 ts: Date.now() 0건 보존');
});
