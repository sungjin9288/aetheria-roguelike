import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 606: generateEvent 3 defaults batch unreachable
 *   (cycle 222-605 silent dead config 시리즈 342번째 — redundant default annotation
 *   청소 메가 시리즈 추가, services/aiService.ts).
 *
 * 발견 (3 defaults batch):
 * - src/services/aiService.ts (line 67):
 *     generateEvent: async (loc: any, history: any[] = [], uid = 'anonymous',
 *         context: any = {}) => {...}
 * - 호출 사이트 (1 caller):
 *     · exploreActions.ts:71 — AI_SERVICE.generateEvent(player.loc, player.history,
 *       uid, {...context}) — 4 args 명시.
 *     · 다른 caller 0건.
 * - 결과: history / uid / context 항상 명시 전달. 3 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-605 시리즈 342번째):
 * - cycle 502-605: default 청소 메가 시리즈 104사이클.
 * - cycle 606: services/aiService.ts cleanup. cycle 539 callProxy paired
 *   completion (동일 모듈 추가 cleanup).
 *
 * 수정 (src/services/aiService.ts):
 * - history default [] 제거.
 * - uid default 'anonymous' 제거.
 * - context default {} 제거.
 * - body의 isSmokeRuntime / pickFallbackEvent 호출 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (exploreActions) 동작 그대로.
 * - body TokenQuotaManager / pickFallbackEvent 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 606: generateEvent signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/services/aiService.ts');
    const fnIdx = source.indexOf('generateEvent: async');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'generateEvent history default [] 제거');
    assert.ok(!/uid\s*=\s*'anonymous'/.test(sig),
        "generateEvent uid default 'anonymous' 제거");
    assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
        'generateEvent context default {} 제거');
});

test('cycle 606: 정합성 가드 — exploreActions callsite 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/AI_SERVICE\.generateEvent\(player\.loc,\s*player\.history,\s*uid,/.test(source),
        'exploreActions AI_SERVICE.generateEvent 4-arg callsite 보존');
});

test('cycle 606: body isSmokeRuntime / pickFallbackEvent 보존', async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(/if \(isSmokeRuntime\(\)\)/.test(source), 'isSmokeRuntime 가드 보존');
    assert.ok(/return pickFallbackEvent\(loc,\s*history,\s*context\)/.test(source),
        'pickFallbackEvent(loc, history, context) 호출 보존');
});

test('cycle 606: cycle 502-605 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/seedEnhanceScenario:\s*\(\{ gold\s*=\s*500/.test(ut),
        'cycle 605 seedEnhanceScenario gold default 0건');

    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/summarizeHistory = \(history: any\[\]\s*=\s*\[\]/.test(aiu),
        'cycle 603 summarizeHistory history default 0건');
});
