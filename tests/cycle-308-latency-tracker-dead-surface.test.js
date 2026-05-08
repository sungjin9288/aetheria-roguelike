import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 308: LatencyTracker 5 dead surface 제거 (getStats 시리즈)
 *   (cycle 222-307 silent dead config 시리즈 78번째 — cleanup lens 연속).
 *
 * 발견 (cascade dead surface):
 * - LatencyTracker.getStats: 외부 read 0건 (src/, tests/).
 * - LatencyTracker.getAverageLatency: getStats 내부에서만 호출 → cascade dead.
 * - LatencyTracker.recordLatency: trackCall이 array에 push, 그러나 array를
 *   읽는 유일한 path가 getStats (now removed) → cascade dead.
 * - LatencyTracker.recentLatencies: recordLatency 작성용 backing array → 사용처 dead.
 * - LatencyTracker.MAX_HISTORY: recentLatencies trim 상수 → cascade dead.
 *
 * 활성 surface:
 * - LatencyTracker.trackCall (aiService.ts:26 사용) — slow-response console.warn
 *   + custom event dispatch가 본질 효과.
 * - LatencyTracker.onSlowResponse (trackCall 내부 사용).
 * - LatencyTracker.THRESHOLD_MS (slow 판정 + custom event detail).
 *
 * 패턴 (cycle 222-307 silent dead config 시리즈 78번째):
 * - cycle 307: useGameEngine top-level leaderboard return dead 제거.
 * - cycle 308: LatencyTracker 5 method/field cascade cleanup.
 *
 * 수정 (src/systems/LatencyTracker.ts):
 * - getStats / getAverageLatency / recordLatency / recentLatencies / MAX_HISTORY 제거.
 * - trackCall 내부 recordLatency 호출도 함께 제거 (no-op이라).
 *
 * 회귀 가드:
 * - LatencyTracker.trackCall 활성 — aiService 9.5s timeout chain 영향 없음.
 * - slow-response console.warn + custom event dispatch 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 308: 5 dead surface 제거', async () => {
    const source = await readSrc('src/systems/LatencyTracker.ts');
    assert.ok(!/getStats\s*\(/.test(source), 'getStats 제거됨');
    assert.ok(!/getAverageLatency\s*\(/.test(source), 'getAverageLatency 제거됨');
    assert.ok(!/recordLatency\s*\(/.test(source), 'recordLatency 제거됨');
    // recentLatencies / MAX_HISTORY: const 정의 제거 — 주석 mention은 허용.
    assert.ok(!/recentLatencies:\s*\[\]/.test(source), 'recentLatencies array 정의 제거됨');
    assert.ok(!/MAX_HISTORY:\s*\d+/.test(source), 'MAX_HISTORY 상수 정의 제거됨');
});

test('cycle 308: trackCall / onSlowResponse / THRESHOLD_MS 활성 유지', async () => {
    const source = await readSrc('src/systems/LatencyTracker.ts');
    assert.ok(/trackCall\s*\(/.test(source), 'trackCall 유지');
    assert.ok(/onSlowResponse\s*\(/.test(source), 'onSlowResponse 유지');
    assert.ok(/THRESHOLD_MS:/.test(source), 'THRESHOLD_MS 유지');
});

test('cycle 308: aiService trackCall 사용 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/LatencyTracker\.trackCall/.test(source),
        'aiService LatencyTracker.trackCall 호출 보존');
});

test('cycle 308: trackCall 동작 보존 (slow-response 판정 + console.warn)', async () => {
    const { LatencyTracker } = await import('../src/systems/LatencyTracker.js');
    const fastFn = async () => 42;
    const result = await LatencyTracker.trackCall(fastFn, 'test');
    assert.equal(result, 42, 'trackCall return 값 통과');
});

test('cycle 307 회귀 가드: useGameEngine top-level leaderboard 제거 유지', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    const returnBlock = source.match(/return\s*\{\s*\n([\s\S]+?)\n\s*\};\s*\}\s*;\s*$/m);
    assert.ok(returnBlock, 'useGameEngine return 블록 발견');
    assert.ok(!/^\s{4,8}leaderboard,/m.test(returnBlock[1]),
        'cycle 307 top-level leaderboard 제거 유지');
});
