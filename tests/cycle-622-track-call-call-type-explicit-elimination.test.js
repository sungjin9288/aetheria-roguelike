import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 622: LatencyTracker.trackCall callType 'ai' explicit default-elimination
 *   (cycle 222-621 silent dead config 시리즈 360번째 — explicit
 *   default-elimination pattern 13번째 적용, cycle 619 변형 패턴 2번째).
 *
 * 발견 (default 이미 unreachable, signature 정리):
 * - src/systems/LatencyTracker.ts:11:
 *     async trackCall(asyncFn: any, callType: any = 'ai') {...}
 * - 호출 사이트 모두 명시 인자 전달:
 *     · aiService.ts:41 — LatencyTracker.trackCall(async () => {...}, trackLabel) (cycle 539 callProxy 변경 후).
 *     · cycle 308 fixture: trackCall(fastFn, 'test').
 * - default 'ai' 이미 도달 불가.
 *
 * 패턴 (cycle 222-621 시리즈 360번째):
 * - cycle 502-621: default 청소 메가 시리즈 117사이클.
 * - cycle 622: explicit default-elimination 13번째 (cycle 619 변형 패턴
 *   2번째 — caller 모두 이미 명시 상태에서 signature default 정리).
 *
 * 수정:
 * - LatencyTracker.ts:11 — callType default 'ai' 제거.
 *
 * 회귀 가드:
 * - aiService callsite trackLabel 인자 보존 (cycle 539).
 * - body slow-response console.warn + onSlowResponse 처리 보존.
 * - cycle 308 trackCall fixture (callType 'test') 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 622: trackCall signature에서 callType default 'ai' 0건", async () => {
    const source = await readSrc('src/systems/LatencyTracker.ts');
    assert.ok(!/async trackCall\([^)]*callType:\s*any\s*=\s*'ai'\)/.test(source),
        "trackCall callType default 'ai' 제거");
    assert.ok(/async trackCall\(asyncFn: any, callType: any\)/.test(source),
        'trackCall callType 파라미터 보존 (default 없이)');
});

test("cycle 622: aiService callsite trackLabel 인자 보존 (cycle 539)", async () => {
    const source = await readSrc('src/services/aiService.ts');
    // multi-line trackCall: ends with `}, trackLabel);` after body closes
    assert.ok(/LatencyTracker\.trackCall\(async \(\) => \{[\s\S]*?\},\s*trackLabel\)/.test(source),
        "aiService trackCall callsite trackLabel 명시 보존");
});

test('cycle 622: trackCall body slow-response 처리 보존', async () => {
    const source = await readSrc('src/systems/LatencyTracker.ts');
    assert.ok(/console\.warn\(`⚠️ Slow \$\{callType\} response/.test(source),
        'slow-response console.warn 보존');
    assert.ok(/this\.onSlowResponse\(callType,\s*latency\)/.test(source),
        'onSlowResponse(callType, latency) 보존');
});

test('cycle 622: cycle 502-621 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const signedDelta = \([^)]*suffix:\s*any\s*=\s*''\)/.test(sp),
        "cycle 621 signedDelta suffix default 0건");
    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/const getToneKey = \(item:[^)]+slot:\s*any\s*=\s*'weapon'\)/.test(ea),
        "cycle 619 getToneKey slot default 0건");
});
