import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 557: getPostCombatAnalysis + getRunSummaryAnalysis 2 defaults batch
 *   unreachable (cycle 222-556 silent dead config 시리즈 298번째 — redundant
 *   default annotation 청소 메가 시리즈 51번째). outcomeAnalysis.ts 같은
 *   모듈 batch.
 *
 * 발견 (2 defaults batch):
 * - src/utils/outcomeAnalysis.ts (line 6, 68):
 *     · getPostCombatAnalysis (result: any = {})
 *     · getRunSummaryAnalysis (summary: any = {})
 * - 호출 사이트:
 *     · getPostCombatAnalysis: 1 production (PostCombatCard:59) + N test
 *       (outcome-analysis.test.js, cycle-336) — 모두 명시.
 *     · getRunSummaryAnalysis: 1 production (RunSummaryCard:25) + N test
 *       (cycle-87, cycle-97) — 모두 summary 명시.
 * - 결과: 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-556 시리즈 298번째):
 * - cycle 502-556: default 청소 메가 시리즈 55사이클.
 * - cycle 557: outcomeAnalysis.ts 같은 모듈 batch.
 *
 * 수정 (src/utils/outcomeAnalysis.ts):
 * - getPostCombatAnalysis signature: result: any = {} → result: any.
 * - getRunSummaryAnalysis signature: summary: any = {} → summary: any.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 다수 callsite 동작 그대로.
 * - body clampRatio / headline / advice 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 557: 2 defaults 0건', async () => {
    const source = await readSrc('src/utils/outcomeAnalysis.ts');
    const postSig = source.slice(source.indexOf('export const getPostCombatAnalysis'),
                                   source.indexOf('=>', source.indexOf('export const getPostCombatAnalysis')));
    assert.ok(!/result:\s*any\s*=\s*\{\}/.test(postSig),
        'getPostCombatAnalysis result default {} 제거');

    const runSig = source.slice(source.indexOf('export const getRunSummaryAnalysis'),
                                  source.indexOf('=>', source.indexOf('export const getRunSummaryAnalysis')));
    assert.ok(!/summary:\s*any\s*=\s*\{\}/.test(runSig),
        'getRunSummaryAnalysis summary default {} 제거');
});

test('cycle 557: 정합성 가드 — production callsite 보존', async () => {
    const pcc = await readSrc('src/components/PostCombatCard.tsx');
    assert.ok(/getPostCombatAnalysis\(result\)/.test(pcc),
        'PostCombatCard getPostCombatAnalysis 보존');

    const rsc = await readSrc('src/components/RunSummaryCard.tsx');
    assert.ok(/getRunSummaryAnalysis\(s\)/.test(rsc),
        'RunSummaryCard getRunSummaryAnalysis 보존');

    const test1 = await readSrc('tests/cycle-87-run-analysis-escape-discovery.test.js');
    assert.ok(/getRunSummaryAnalysis\(summary\)/.test(test1),
        'test cycle-87 getRunSummaryAnalysis 보존');
});

test('cycle 557: body clampRatio + headline 분기 보존', async () => {
    const source = await readSrc('src/utils/outcomeAnalysis.ts');
    assert.ok(/const hpRatio = clampRatio\(result\.playerHp, result\.playerMaxHp\)/.test(source),
        'clampRatio hpRatio 보존');
    assert.ok(/summary\.bossKills > 0/.test(source), 'bossKills 분기 보존');
});

test('cycle 557: cycle 502-556 회귀 가드 — default 청소 시리즈 보존', async () => {
    const gu = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/formatDailyProtocolReward[^=]*reward:\s*any\s*=\s*\{\}/.test(gu),
        'cycle 556 formatDailyProtocolReward reward default 0건');
    assert.ok(!/formatRewardParts[^=]*reward:\s*any\s*=\s*\{\}/.test(gu),
        'cycle 556 formatRewardParts reward default 0건');
});
