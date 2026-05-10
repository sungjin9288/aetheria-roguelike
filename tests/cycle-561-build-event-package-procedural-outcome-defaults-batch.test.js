import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 561: buildEventPackage + buildProceduralOutcome 3 defaults batch
 *   unreachable (cycle 222-560 silent dead config 시리즈 301번째 — redundant
 *   default annotation 청소 메가 시리즈 54번째). aiEventUtils.ts 같은 모듈
 *   batch.
 *
 * 발견 (3 defaults batch):
 * - src/utils/aiEventUtils.ts (line 138, 247):
 *     · buildProceduralOutcome ({ desc, choice, choiceIndex, context = {} }: any = {})
 *       — 외부 default + 내부 context default 둘 다.
 *     · buildEventPackage (payload: any, context: any = {})
 * - 호출 사이트:
 *     · buildProceduralOutcome: 1 internal (line 236) — 완전 object 명시
 *       전달, 외부 + 내부 default 모두 도달 불가.
 *     · buildEventPackage: 3 callers (line 548 internal, aiService:100,
 *       ai-event-utils.test.js:26) 모두 2 args 명시.
 * - 결과: 3 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-560 시리즈 301번째):
 * - cycle 502-560: default 청소 메가 시리즈 59사이클.
 * - cycle 561: aiEventUtils.ts 같은 모듈 추가 batch — cycle 522/525/527에
 *   이은 cleanup, 4번째 동일 모듈 cleanup.
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - buildProceduralOutcome signature: { desc, choice, choiceIndex, context }: any.
 * - buildEventPackage signature: context: any = {} → context: any.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 4 callsite 동작 그대로.
 * - body normalizeText / dedupeChoices / getPoolKeyByLocation 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 561: buildEventPackage signature에서 context default 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const buildEventPackage');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
        'buildEventPackage context default {} 제거');
});

test('cycle 561: buildProceduralOutcome signature에서 outer + inner defaults 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('const buildProceduralOutcome');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\}\s*:\s*any\s*=\s*\{\}/.test(sig),
        'buildProceduralOutcome outer default {} 제거');
    assert.ok(!/context\s*=\s*\{\}/.test(sig),
        'buildProceduralOutcome inner context default {} 제거');
});

test('cycle 561: 정합성 가드 — 4 callsite 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/buildProceduralOutcome\(\{\s*\n\s*desc:/.test(source),
        'buildProceduralOutcome internal callsite (object literal) 보존');
    const calls = (source.match(/buildEventPackage\(/g) || []).length;
    assert.equal(calls, 1, `buildEventPackage 사용처 1건 보존 (내부 line 548): ${calls}건`);
    assert.ok(/export const buildEventPackage = \(payload/.test(source),
        'buildEventPackage 정의 보존');

    const ai = await readSrc('src/services/aiService.ts');
    assert.ok(/buildEventPackage\(result\.data, \{ \.\.\.context, location: loc, source: 'ai' \}\)/.test(ai),
        'aiService buildEventPackage callsite 보존');
});

test('cycle 561: cycle 502-560 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/export const getEnemyTacticalProfile[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
        'cycle 559 getEnemyTacticalProfile stats default 0건');

    const oa = await readSrc('src/utils/outcomeAnalysis.ts');
    assert.ok(!/getRunSummaryAnalysis[^=]*summary:\s*any\s*=\s*\{\}/.test(oa),
        'cycle 557 getRunSummaryAnalysis summary default 0건');
});
