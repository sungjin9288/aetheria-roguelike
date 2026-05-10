import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 525: hashString + classifyChoice 2 defaults batch unreachable
 *   (cycle 222-524 silent dead config 시리즈 269번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 22번째).
 *
 * 발견 (2 defaults batch, aiEventUtils.ts 같은 모듈):
 * - src/utils/aiEventUtils.ts:
 *     · line 48: const hashString = (value: any = '') => {...}
 *     · line 113: export const classifyChoice = (choiceText: any = '') => {...}
 * - 호출 사이트:
 *     · hashString:1 callsite (line 130 hashString(`${context.location || ''}
 *       |${desc}|${choice}|${choiceIndex}`)) — template literal로 string 보장.
 *     · classifyChoice:1 internal (line 131 classifyChoice(choice)) +
 *       4 test callsite (tests/ai-event-utils.test.js:19-22) — 모두 string
 *       명시.
 * - 결과: 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-524 시리즈 269번째):
 * - cycle 502-524: util default 청소 메가 시리즈 21사이클.
 * - cycle 525: aiEventUtils 같은 모듈 batch — cycle 522 toInt에 이은 동일
 *   파일 추가 cleanup.
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - hashString signature: value: any = '' → value: any.
 * - classifyChoice signature: choiceText: any = '' → choiceText: any.
 * - body의 value.length/charCodeAt + normalizeText(choiceText) 호출 보존.
 *
 * 회귀 가드:
 * - 5+ callsite 동작 그대로.
 * - body hash 계산 / RETREAT/RISKY/SAFE keyword 체크 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 525: hashString signature에서 value default '' 0건", async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('const hashString');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/value:\s*any\s*=\s*''/.test(sig), "hashString value default '' 제거");
    assert.ok(/\bvalue\b/.test(sig), 'value 파라미터 자체는 보존');
});

test("cycle 525: classifyChoice signature에서 choiceText default '' 0건", async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const classifyChoice');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/choiceText:\s*any\s*=\s*''/.test(sig),
        "classifyChoice choiceText default '' 제거");
    assert.ok(/\bchoiceText\b/.test(sig), 'choiceText 파라미터 자체는 보존');
});

test('cycle 525: 정합성 가드 — internal + test callsite 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/hashString\(`\$\{context\.location \|\| ''\}/.test(source),
        'hashString template literal callsite 보존');
    assert.ok(/classifyChoice\(choice\)/.test(source),
        'classifyChoice(choice) internal callsite 보존');

    const testSrc = await readSrc('tests/ai-event-utils.test.js');
    assert.ok(/classifyChoice\('조심히 접근한다'\)/.test(testSrc),
        'classifyChoice test callsite 보존');
});

test('cycle 525: body 동작 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/value\.charCodeAt\(i\)/.test(source),
        'hashString value.charCodeAt(i) 호출 보존');
    assert.ok(/normalizeText\(choiceText\)/.test(source),
        'classifyChoice normalizeText(choiceText) 호출 보존');
    assert.ok(/RETREAT_KEYWORDS\.some/.test(source), 'retreat keyword 분기 보존');
});

test('cycle 525: cycle 502-524 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const sr = await readSrc('src/utils/shopRotation.ts');
    assert.ok(!/const dateHash[^=]*salt:\s*any\s*=\s*0/.test(sr),
        'cycle 524 dateHash salt default 0건');

    const qo = await readSrc('src/utils/questOperations.ts');
    assert.ok(!/getQuestLevelGap[^=]*playerLevel:\s*any\s*=\s*1/.test(qo),
        'cycle 523 getQuestLevelGap playerLevel default 0건');
});
