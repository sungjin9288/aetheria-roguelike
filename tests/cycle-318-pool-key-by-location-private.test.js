import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 318: getPoolKeyByLocation export → private downgrade
 *   (cycle 222-317 silent dead config 시리즈 88번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/aiEventUtils.ts: getPoolKeyByLocation — aiEventUtils 내부 3회 사용
 *   (line 131 buildEventPackage / line 236 buildEventPackage / line 520 pickFallbackEvent),
 *   외부 호출 0건. 테스트 import는 cycle 292 active-list 가드에만 등장 (실제 호출 0건).
 *
 * 패턴 (cycle 222-317 silent dead config 시리즈 88번째):
 * - cycle 317: EMPTY_TEMP_BUFF private downgrade.
 * - cycle 318: getPoolKeyByLocation private downgrade.
 *
 * 수정:
 * - src/utils/aiEventUtils.ts: getPoolKeyByLocation export 제거 (private const 유지).
 * - tests/cycle-292-normalize-text-private.test.js: activeExports 리스트에서 제거.
 *
 * 회귀 가드:
 * - aiEventUtils active export 유지 (classifyChoice / buildEventPackage / pickFallbackEvent /
 *   summarizeHistory / getRecentEventSet).
 * - buildEventPackage / pickFallbackEvent 동작 보존 (내부 getPoolKeyByLocation 사용 chain).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 318: getPoolKeyByLocation export 제거 (private)', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const getPoolKeyByLocation\b/.test(source),
        'getPoolKeyByLocation export 제거됨');
    assert.ok(/const getPoolKeyByLocation\b/.test(source),
        'getPoolKeyByLocation const 정의 유지 (private)');
});

test('cycle 318: aiEventUtils active exports 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const activeExports = ['classifyChoice', 'buildEventPackage', 'pickFallbackEvent', 'summarizeHistory', 'getRecentEventSet'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 318: pickFallbackEvent 동작 보존 (회귀 가드 — getPoolKeyByLocation 내부 사용)', async () => {
    const { pickFallbackEvent } = await import('../src/utils/aiEventUtils.js');
    const event = pickFallbackEvent('숲', [], {});
    assert.ok(event, 'pickFallbackEvent 결과 반환');
    assert.ok(typeof event === 'object', 'event는 object');
});

test('cycle 317 회귀 가드: EMPTY_TEMP_BUFF private 유지', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    assert.ok(!/export const EMPTY_TEMP_BUFF\b/.test(source),
        'cycle 317 EMPTY_TEMP_BUFF private 유지');
});
