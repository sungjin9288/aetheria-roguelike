import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 539: callProxy `trackLabel = 'ai-call'` + `timeoutMs = 9500` defaults
 *   batch unreachable (cycle 222-538 silent dead config 시리즈 282번째 —
 *   redundant default annotation util/component/hook/system/reducer/service
 *   default 청소 메가 시리즈 35번째). services/ 진입.
 *
 * 발견 (2 defaults batch):
 * - src/services/aiService.ts (line 15):
 *     const callProxy = async (body: any, trackLabel: any = 'ai-call',
 *         timeoutMs: any = 9500) => {...};
 * - 호출 사이트 (2 internal callsite, 모듈 내부 private):
 *     · aiService.ts:80-93 — callProxy(body, 'ai-event', 9500)
 *     · aiService.ts:133-145 — callProxy(body, 'ai-story', 9500)
 *     · 다른 caller 0건 (private 모듈 helper).
 * - 결과: trackLabel / timeoutMs 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-538 시리즈 282번째):
 * - cycle 502-538: util/component/hook/system/reducer default 청소 메가 시리즈
 *   35사이클.
 * - cycle 539: services/ 진입 — utils/ + components/ + hooks/ + systems/ +
 *   reducers/ 외 services/까지 lens 확장.
 *
 * 수정 (src/services/aiService.ts):
 * - signature에서 trackLabel: any = 'ai-call' → trackLabel: any.
 * - signature에서 timeoutMs: any = 9500 → timeoutMs: any.
 * - body의 setTimeout(..., timeoutMs) / LatencyTracker.trackCall 보존.
 *
 * 회귀 가드:
 * - 2 internal callsite 동작 그대로.
 * - body fetch / timeout / Bearer auth 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 539: callProxy signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/services/aiService.ts');
    const fnIdx = source.indexOf('const callProxy');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/trackLabel:\s*any\s*=\s*'ai-call'/.test(sig),
        "callProxy trackLabel default 'ai-call' 제거");
    assert.ok(!/timeoutMs:\s*any\s*=\s*9500/.test(sig),
        'callProxy timeoutMs default 9500 제거');
});

test('cycle 539: 정합성 가드 — 2 internal callsite 보존', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/'ai-event',\s*\n\s*9500/.test(source),
        "callProxy(body, 'ai-event', 9500) callsite 보존");
    assert.ok(/'ai-story',\s*\n\s*9500/.test(source),
        "callProxy(body, 'ai-story', 9500) callsite 보존");
});

test('cycle 539: body setTimeout / LatencyTracker.trackCall 처리 보존', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/setTimeout\(\(\) => controller\.abort\(\),\s*timeoutMs\)/.test(source),
        'setTimeout(controller.abort, timeoutMs) 보존');
    assert.ok(/LatencyTracker\.trackCall\(/.test(source),
        'LatencyTracker.trackCall 호출 보존');
});

test('cycle 539: cycle 502-538 회귀 가드 — util/component/hook/system/reducer default 청소 시리즈 보존', async () => {
    const helpers = await readSrc('src/reducers/handlers/helpers.ts');
    assert.ok(!/applyDailyProtocolProgress[^=]*amount:\s*any\s*=\s*1/.test(helpers),
        'cycle 538 applyDailyProtocolProgress amount default 0건');

    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/calculateDamage\(stats: any, options:\s*any\s*=\s*\{\}\)/.test(ce),
        'cycle 537 calculateDamage options default 0건');
});
