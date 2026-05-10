import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 542: signedDelta `value = 0` partial default unreachable
 *   (cycle 222-541 silent dead config 시리즈 284번째 — redundant default annotation
 *   청소 메가 시리즈 37번째). partial cleanup — 같은 함수에서 unreachable
 *   default만 제거, reachable default는 보존.
 *
 * 발견 (1 default unreachable, 1 default reachable 보존):
 * - src/components/ShopPanel.tsx (line 36):
 *     const signedDelta = (value: any = 0, suffix: any = '') =>
 *         `${value >= 0 ? '+' : ''}${value}${suffix}`;
 * - 호출 사이트 (3 internal callsite, 모두 1 arg만 전달):
 *     · ShopPanel.tsx:63 — signedDelta(atkDelta)
 *     · ShopPanel.tsx:64 — signedDelta(defDelta)
 *     · ShopPanel.tsx:66 — signedDelta(mpDelta)
 *     · 다른 caller 0건 (private 모듈 helper).
 * - 결과:
 *     · value 항상 명시 전달 → default 0 도달 불가.
 *     · suffix 0개 caller가 명시 전달 → default '' REACHABLE 보존 필수.
 *
 * 패턴 (cycle 222-541 시리즈 284번째):
 * - cycle 502-541: default 청소 메가 시리즈 40사이클.
 * - cycle 542: partial cleanup pattern — 같은 함수의 일부 default만 unreachable
 *   인 경우. cycle 537 outer-vs-inner 분리 패턴과 다름 (이건 같은 layer
 *   parameter 간의 partial 정리). cycle 526 toPercent와 다른 점은 모든 default
 *   unreachable이 아닌 partial인 점.
 *
 * 수정 (src/components/ShopPanel.tsx):
 * - signature에서 value: any = 0 → value: any.
 * - signature에서 suffix: any = '' 보존 (3 callsite 모두 reachable).
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로.
 * - body template literal 보존.
 * - suffix default 보존 (reachable).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 542: signedDelta signature에서 value default 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const signedDelta');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/value:\s*any\s*=\s*0/.test(sig),
        'signedDelta value default 0 제거');
});

test('cycle 542: suffix default 보존 (reachable)', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const signedDelta');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/suffix:\s*any\s*=\s*''/.test(sig),
        "signedDelta suffix default '' 보존 (3 callsite 모두 1 arg 전달이라 reachable)");
});

test('cycle 542: 정합성 가드 — 3 internal callsite 보존', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/signedDelta\(atkDelta\)/.test(source), 'ATK callsite 보존');
    assert.ok(/signedDelta\(defDelta\)/.test(source), 'DEF callsite 보존');
    assert.ok(/signedDelta\(mpDelta\)/.test(source), 'MP callsite 보존');
});

test('cycle 542: body template literal 보존', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/`\$\{value >= 0 \? '\+' : ''\}\$\{value\}\$\{suffix\}`/.test(source),
        'template literal `${sign}${value}${suffix}` 보존');
});

test('cycle 542: cycle 502-541 회귀 가드 — default 청소 시리즈 보존', async () => {
    const qt = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(!/getQuestProgressText[^=]*progress:\s*any\s*=\s*0/.test(qt),
        'cycle 541 QuestTab getQuestProgressText progress default 0건');

    const ai = await readSrc('src/services/aiService.ts');
    assert.ok(!/const callProxy[^=]*trackLabel:\s*any\s*=\s*'ai-call'/.test(ai),
        'cycle 539 callProxy trackLabel default 0건');
});
