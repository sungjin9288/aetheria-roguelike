import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 526: toPercent `value = 0` default unreachable
 *   (cycle 222-525 silent dead config 시리즈 270번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 23번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/runProfile.ts (line 27):
 *     const toPercent = (value: any = 0) => `${Math.round(value * 100)}%`;
 * - 호출 사이트 (3 internal callsite, 모듈 내부 private):
 *     · runProfile.ts:229 — toPercent((bonus.atkMult || 1) - 1)
 *     · runProfile.ts:230 — toPercent((bonus.defMult || 1) - 1)
 *     · runProfile.ts:231 — toPercent(bonus.critBonus || 0)
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: value 항상 명시 전달 (각 caller가 `|| 1` 또는 `|| 0` fallback으로
 *   number 보장). default 0 도달 불가.
 *
 * 패턴 (cycle 222-525 시리즈 270번째):
 * - cycle 502-525: util default 청소 메가 시리즈 22사이클.
 * - cycle 526: toPercent value — 동일 lens. private + numeric helper.
 *
 * 회귀 정보 (cycle 526 첫 시도 revert):
 * - 첫 시도는 questProgress.ts findQuestDefinition questCatalog default 제거
 *   (cycle 508 cascade)였으나, 16개 test callsite (cycle 99/94/83 + quest-progress)
 *   가 syncQuestProgress(player) 1 arg로 호출하면 questCatalog가 undefined로
 *   propagate, findQuestDefinition default가 그 path 활성이라 revert.
 *   교훈: "all production callers pass arg" ≠ "all callers pass arg".
 *   test caller까지 포함된 audit 필요.
 *
 * 수정 (src/utils/runProfile.ts):
 * - signature에서 value: any = 0 → value: any.
 * - body의 Math.round(value * 100) 보존.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로.
 * - body Math.round/template literal 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 526: toPercent signature에서 value default 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('const toPercent');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/value:\s*any\s*=\s*0/.test(sig), 'toPercent value default 0 제거');
    assert.ok(/\bvalue\b/.test(sig), 'value 파라미터 자체는 보존');
});

test('cycle 526: 정합성 가드 — 3 internal callsite 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/toPercent\(\(bonus\.atkMult \|\| 1\) - 1\)/.test(source),
        'ATK callsite 보존');
    assert.ok(/toPercent\(\(bonus\.defMult \|\| 1\) - 1\)/.test(source),
        'DEF callsite 보존');
    assert.ok(/toPercent\(bonus\.critBonus \|\| 0\)/.test(source),
        'CRIT callsite 보존');
});

test('cycle 526: body Math.round/template 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/Math\.round\(value \* 100\)/.test(source),
        'Math.round(value * 100) 보존');
});

test('cycle 526: cycle 502-525 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/const hashString[^=]*value:\s*any\s*=\s*''/.test(aiu),
        'cycle 525 hashString value default 0건');

    const sr = await readSrc('src/utils/shopRotation.ts');
    assert.ok(!/const dateHash[^=]*salt:\s*any\s*=\s*0/.test(sr),
        'cycle 524 dateHash salt default 0건');
});
