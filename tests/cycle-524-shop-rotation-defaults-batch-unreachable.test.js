import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 524: shopRotation 3 defaults batch unreachable
 *   (cycle 222-523 silent dead config 시리즈 268번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 21번째).
 *
 * 발견 (3 defaults batch, shopRotation.ts 같은 모듈):
 * - src/utils/shopRotation.ts:
 *     · line 11: const dateHash = (dateStr, salt: any = 0) => {...}
 *     · line 61: export const getDailyDeals = (playerLevel: any = 1) => {...}
 *     · line 92: export const getWeeklySpecial = (playerLevel: any = 1) => {...}
 * - 호출 사이트:
 *     · dateHash:2 callsite (line 63: dateHash(today, 42), line 94:
 *       dateHash(weekKey, 777)) — 모두 salt 명시.
 *     · getDailyDeals:1 callsite (ShopPanel.tsx:161 getDailyDeals(player.level
 *       || 1)) — playerLevel 명시 + || 1 number 보장.
 *     · getWeeklySpecial:1 callsite (ShopPanel.tsx:162 getWeeklySpecial
 *       (player.level || 1)) — 동일.
 * - 결과: 3 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-523 시리즈 268번째):
 * - cycle 502-523: util default 청소 메가 시리즈 20사이클.
 * - cycle 524: shopRotation 3 defaults — 동일 lens. cycle 504/507/521에 이은
 *   single-cycle 3-default batch.
 *
 * 수정 (src/utils/shopRotation.ts):
 * - dateHash signature: salt: any = 0 → salt: any.
 * - getDailyDeals signature: playerLevel: any = 1 → playerLevel: any.
 * - getWeeklySpecial signature: playerLevel: any = 1 → playerLevel: any.
 * - body의 hash 계산 / playerLevel 비교 분기 모두 보존.
 *
 * 회귀 가드:
 * - 4 callsite (2 internal dateHash + 2 ShopPanel) 동작 그대로.
 * - body Math.abs / playerLevel < N ternary 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 524: dateHash signature에서 salt default 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fnIdx = source.indexOf('const dateHash');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/salt:\s*any\s*=\s*0/.test(sig), 'dateHash salt default 0 제거');
    assert.ok(/\bsalt\b/.test(sig), 'salt 파라미터 자체는 보존');
});

test('cycle 524: getDailyDeals + getWeeklySpecial signature에서 playerLevel default 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const dailyIdx = source.indexOf('export const getDailyDeals');
    const dailyEnd = source.indexOf('=>', dailyIdx);
    const dailySig = source.slice(dailyIdx, dailyEnd);
    assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(dailySig),
        'getDailyDeals playerLevel default 1 제거');

    const weeklyIdx = source.indexOf('export const getWeeklySpecial');
    const weeklyEnd = source.indexOf('=>', weeklyIdx);
    const weeklySig = source.slice(weeklyIdx, weeklyEnd);
    assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(weeklySig),
        'getWeeklySpecial playerLevel default 1 제거');
});

test('cycle 524: 정합성 가드 — 4 callsite 보존', async () => {
    const shop = await readSrc('src/utils/shopRotation.ts');
    assert.ok(/dateHash\(today,\s*42\)/.test(shop), 'dateHash(today, 42) 보존');
    assert.ok(/dateHash\(weekKey,\s*777\)/.test(shop), 'dateHash(weekKey, 777) 보존');

    const panel = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/getDailyDeals\(player\.level \|\| 1\)/.test(panel),
        'getDailyDeals(player.level || 1) callsite 보존');
    assert.ok(/getWeeklySpecial\(player\.level \|\| 1\)/.test(panel),
        'getWeeklySpecial(player.level || 1) callsite 보존');
});

test('cycle 524: body 분기 보존', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    assert.ok(/playerLevel < 10 \? 2 : playerLevel < 20 \? 3/.test(source),
        'getDailyDeals tier ternary 보존');
    assert.ok(/playerLevel < 15 \? 3 : playerLevel < 30 \? 4/.test(source),
        'getWeeklySpecial tier ternary 보존');
    assert.ok(/return Math\.abs\(hash\)/.test(source), 'dateHash Math.abs(hash) 보존');
});

test('cycle 524: cycle 502-523 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const qo = await readSrc('src/utils/questOperations.ts');
    assert.ok(!/getQuestLevelGap[^=]*playerLevel:\s*any\s*=\s*1/.test(qo),
        'cycle 523 getQuestLevelGap playerLevel default 0건');

    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/const toInt[^=]*fallback:\s*any\s*=\s*0/.test(aiu),
        'cycle 522 toInt fallback default 0건');
});
