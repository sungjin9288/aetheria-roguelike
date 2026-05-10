import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 545: pickFallbackEvent `history = []` + `context = {}` defaults batch
 *   unreachable + getQuestReason `targetMaps = []` default unreachable
 *   (cycle 222-544 silent dead config 시리즈 287번째 — redundant default annotation
 *   청소 메가 시리즈 40번째). cross-file 3 defaults batch.
 *
 * 발견 (3 defaults batch, 2 files):
 * - src/utils/aiEventUtils.ts (line 526):
 *     export const pickFallbackEvent = (loc: string, history: any[] = [],
 *         context: any = {}) => {...};
 * - src/utils/questOperations.ts (line 92):
 *     const getQuestReason = (quest: any, lane: any, resonance: any,
 *         targetMaps: any[] = []) => {...};
 * - 호출 사이트:
 *     · pickFallbackEvent: 3 production caller (aiService.ts:69/74/108) +
 *       5 test caller — 모두 3 args 명시.
 *     · getQuestReason: 1 internal caller (questOperations.ts:153) — 4 args
 *       명시.
 *     · 모든 default 도달 불가.
 *
 * 패턴 (cycle 222-544 시리즈 287번째):
 * - cycle 502-544: default 청소 메가 시리즈 43사이클.
 * - cycle 545: cross-file 3-default batch — utils/ 두 모듈 동시.
 *
 * 수정:
 * - aiEventUtils.ts pickFallbackEvent: history / context defaults 모두 제거.
 * - questOperations.ts getQuestReason: targetMaps default 제거.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 9 callsite 동작 그대로.
 * - body lane / resonance ternary + getPoolKeyByLocation 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 545: pickFallbackEvent signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const pickFallbackEvent');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'pickFallbackEvent history default [] 제거');
    assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
        'pickFallbackEvent context default {} 제거');
});

test('cycle 545: getQuestReason signature에서 targetMaps default 0건', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    const fnIdx = source.indexOf('const getQuestReason');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/targetMaps:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'getQuestReason targetMaps default [] 제거');
});

test('cycle 545: 정합성 가드 — pickFallbackEvent + getQuestReason callsite 보존', async () => {
    const ai = await readSrc('src/services/aiService.ts');
    const calls = (ai.match(/pickFallbackEvent\(loc,\s*history,\s*context\)/g) || []).length;
    assert.ok(calls >= 2, `aiService pickFallbackEvent callsite 보존: ${calls}건`);

    const qo = await readSrc('src/utils/questOperations.ts');
    assert.ok(/getQuestReason\(quest,\s*lane,\s*resonance,\s*targetMaps\)/.test(qo),
        'getQuestReason callsite 보존');
});

test('cycle 545: body 동작 보존', async () => {
    const aeu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/getPoolKeyByLocation\(loc\)/.test(aeu),
        'getPoolKeyByLocation 호출 보존');

    const qo = await readSrc('src/utils/questOperations.ts');
    assert.ok(/if \(lane === 'story'\)/.test(qo), 'story lane 분기 보존');
    assert.ok(/if \(lane === 'build' && resonance\.summary\)/.test(qo),
        'build lane 분기 보존');
});

test('cycle 545: cycle 502-544 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/const scoreTag[^=]*reasons:\s*any\[\]\s*=\s*\[\]/.test(rp),
        'cycle 544 scoreTag reasons default 0건');
    assert.ok(!/const hasAnyJob[^=]*jobs:\s*any\[\]\s*=\s*\[\]/.test(rp),
        'cycle 544 hasAnyJob jobs default 0건');

    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(!/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\s*=\s*false\)/.test(inv),
        'cycle 543 synthesize useProtect default 0건');
});
