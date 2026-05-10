import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 609: buildGraveData random/now explicit default-elimination
 *   (cycle 222-608 silent dead config 시리즈 345번째 — explicit default-elimination
 *   pattern 2번째 적용 후, cycle 608 신규 lens 회귀).
 *
 * 발견 (2 defaults reachable → unreachable conversion):
 * - src/utils/graveUtils.ts (line 19):
 *     export const buildGraveData = (player: Player, random: any = Math.random,
 *         now: any = Date.now) => {...};
 * - 호출 사이트:
 *     · src/systems/CombatEngine.ts:1640 — buildGraveData(player) — 1 arg only.
 *       random/now defaults 활성.
 *     · tests/cycle-246/grave-recovery — 6 callers 모두 3 args (deterministic
 *       fakes for test) 명시.
 * - 기존 상태: production caller가 random/now 미전달 → defaults Math.random/
 *   Date.now 활성. defaults reachable이었음.
 *
 * 패턴 (cycle 222-608 시리즈 345번째):
 * - cycle 502-608: default 청소 메가 시리즈 107사이클.
 * - cycle 609: explicit default-elimination 2번째 (cycle 608 신규 lens 회귀).
 *   production caller에 명시 args 추가하여 defaults unreachable로 conversion.
 *
 * 수정:
 * - CombatEngine.ts:1640: buildGraveData(player) → buildGraveData(player,
 *   Math.random, Date.now). production caller에 명시 args 추가.
 * - graveUtils.ts:19: random/now defaults 제거.
 *
 * 회귀 가드:
 * - 1 production + 6 test callsite 동작 그대로 (모두 3 args 명시 후).
 * - body의 random()/now() 호출 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 609: buildGraveData signature에서 random/now defaults 0건', async () => {
    const source = await readSrc('src/utils/graveUtils.ts');
    const fnIdx = source.indexOf('export const buildGraveData');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/random:\s*any\s*=\s*Math\.random/.test(sig),
        'buildGraveData random default Math.random 제거');
    assert.ok(!/now:\s*any\s*=\s*Date\.now/.test(sig),
        'buildGraveData now default Date.now 제거');
});

test('cycle 609: 정합성 가드 — production callsite Math.random/Date.now 명시 추가', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/buildGraveData\(player,\s*Math\.random,\s*Date\.now\)/.test(source),
        'CombatEngine buildGraveData(player, Math.random, Date.now) 명시');
});

test('cycle 609: test callsite 보존 (deterministic fakes)', async () => {
    const test1 = await readSrc('tests/cycle-246-map-grave-drop-bonus.test.js');
    assert.ok(/buildGraveData\(player,\s*\(\) => 0\.5,\s*\(\) => 1000\)/.test(test1),
        'cycle-246 test callsite 보존');

    const test2 = await readSrc('tests/grave-recovery.test.js');
    assert.ok(/buildGraveData\(player,\s*\(\) => 0\.9,\s*\(\) => 12345\)/.test(test2),
        'grave-recovery test callsite 보존');
});

test('cycle 609: cycle 502-608 회귀 가드 — default 청소 시리즈 보존', async () => {
    const intro = await readSrc('src/components/IntroScreen.tsx');
    assert.ok(!/dismissKeyboard:\s*any\s*=\s*false/.test(intro),
        'cycle 608 applyName dismissKeyboard default 0건');

    const mp = await readSrc('src/utils/mapProgress.ts');
    assert.ok(!/uniqueList = \(values:\s*any\s*=\s*\[\]\)/.test(mp),
        'cycle 607 uniqueList values default 0건');
});
