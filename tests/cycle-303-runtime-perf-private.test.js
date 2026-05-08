import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 303: 2 utils private downgrade — isE2ERuntime + measurePerf
 *   (cycle 222-302 silent dead config 시리즈 73번째 — cleanup lens 연속).
 *
 * 발견 (2 private downgrade, 모두 동일 파일 내부 1회만 사용):
 * - src/utils/runtimeMode.ts: isE2ERuntime — isMockRuntime 내부 1회 (line 28),
 *   외부 consumer 0건.
 * - src/utils/performanceMarks.ts: measurePerf — measurePerfOnce 내부 1회 (line 46),
 *   외부 consumer 0건.
 *
 * 패턴 (cycle 222-302 silent dead config 시리즈 73번째):
 * - cycle 302: ACTION_PRESENTATION dead + TYPE_COLORS re-export 제거.
 * - cycle 303: 2 internal helper private downgrade — export 표면 2개 축소.
 *
 * 수정:
 * - runtimeMode.ts: isE2ERuntime export 제거 (private const 유지).
 * - performanceMarks.ts: measurePerf export 제거 (private const 유지).
 *
 * 회귀 가드:
 * - isMockRuntime / measurePerfOnce active export 유지.
 * - isMockRuntime 동작 동일 (smoke OR e2e), measurePerfOnce 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 303: isE2ERuntime export 제거 (private)', async () => {
    const source = await readSrc('src/utils/runtimeMode.ts');
    assert.ok(!/export const isE2ERuntime\b/.test(source),
        'isE2ERuntime export 제거됨');
    assert.ok(/const isE2ERuntime\b/.test(source),
        'isE2ERuntime const 정의 유지 (private)');
});

test('cycle 303: measurePerf export 제거 (private)', async () => {
    const source = await readSrc('src/utils/performanceMarks.ts');
    assert.ok(!/export const measurePerf\b/.test(source),
        'measurePerf export 제거됨');
    assert.ok(/const measurePerf\b/.test(source),
        'measurePerf const 정의 유지 (private)');
});

test('cycle 303: isMockRuntime / measurePerfOnce active export 유지', async () => {
    const rmSrc = await readSrc('src/utils/runtimeMode.ts');
    const pmSrc = await readSrc('src/utils/performanceMarks.ts');
    assert.ok(/export const isMockRuntime\b/.test(rmSrc), 'isMockRuntime 유지');
    assert.ok(/export const measurePerfOnce\b/.test(pmSrc), 'measurePerfOnce 유지');
});

test('cycle 303: isMockRuntime 동작 보존 (회귀 가드 — isE2ERuntime 내부 사용)', async () => {
    const { isMockRuntime } = await import('../src/utils/runtimeMode.js');
    // 노드 환경(window 없음) → false 반환.
    const result = isMockRuntime();
    assert.equal(result, false, 'window 미정의 시 false');
});

test('cycle 302 회귀 가드: ACTION_PRESENTATION dead 유지', async () => {
    const source = await readSrc('src/components/controlPanelConfig.ts');
    assert.ok(!/export const ACTION_PRESENTATION\b/.test(source),
        'cycle 302 ACTION_PRESENTATION 제거 유지');
});
