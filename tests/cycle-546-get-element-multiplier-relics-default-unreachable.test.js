import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 546: getElementMultiplier `relics = []` default unreachable
 *   (cycle 222-545 silent dead config 시리즈 288번째 — redundant default annotation
 *   청소 메가 시리즈 41번째).
 *
 * 발견 (1 default unreachable):
 * - src/systems/CombatEngine.ts (line 28):
 *     getElementMultiplier(elem: any, enemy: Monster, relics: any[] = []) {
 *         ...
 *         const boostRelic = (relics || []).find((r: any) => r.effect === 'elem_boost');
 *         ...
 *     }
 * - 호출 사이트 (2 internal + N test):
 *     · CombatEngine.ts:480 — this.getElementMultiplier(stats.elem, enemy, relics)
 *     · CombatEngine.ts:745 — this.getElementMultiplier(skillElem, enemy, relics)
 *     · tests: cycle-252/253/254/255 etc. 모두 [] 명시.
 * - 결과: relics 항상 명시 전달. default 도달 불가.
 *   body의 (relics || []) defensive guard는 별개 보존 (caller가 null 넘기는
 *   path 활성).
 *
 * 패턴 (cycle 222-545 시리즈 288번째):
 * - cycle 502-545: default 청소 메가 시리즈 44사이클.
 * - cycle 546: systems/CombatEngine method default — cycle 537과 동일 layer.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 relics: any[] = [] → relics: any[].
 * - body의 (relics || []).find / boost 처리 보존.
 *
 * 회귀 가드:
 * - 2 internal callsite + N test callsite 동작 그대로.
 * - body weakness/resistance 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 546: getElementMultiplier signature에서 relics default 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('getElementMultiplier(elem');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/relics:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'getElementMultiplier relics default [] 제거');
    assert.ok(/\brelics\b/.test(sig), 'relics 파라미터 자체는 보존');
});

test('cycle 546: 정합성 가드 — 2 internal callsite + test 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const calls = (source.match(/this\.getElementMultiplier\(/g) || []).length;
    assert.equal(calls, 2, `internal callsite 2건 보존: ${calls}건`);

    const test1 = await readSrc('tests/cycle-254-monster-resistance-water-typo.test.js');
    assert.ok(/CombatEngine\.getElementMultiplier\('냉기',\s*enemy,\s*\[\]\)/.test(test1),
        'test callsite (cycle 254) 보존');
});

test('cycle 546: body defensive guard + weakness 분기 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/\(relics \|\| \[\]\)\.find\(\(r: any\) => r\.effect === 'elem_boost'\)/.test(source),
        '(relics || []).find defensive guard 보존');
    assert.ok(/if \(enemy\?\.weakness && enemy\.weakness === elem\)/.test(source),
        'weakness 분기 보존');
});

test('cycle 546: cycle 502-545 회귀 가드 — default 청소 시리즈 보존', async () => {
    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const pickFallbackEvent[^=]*history:\s*any\[\]\s*=\s*\[\]/.test(aiu),
        'cycle 545 pickFallbackEvent history default 0건');

    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/const scoreTag[^=]*reasons:\s*any\[\]\s*=\s*\[\]/.test(rp),
        'cycle 544 scoreTag reasons default 0건');
});
