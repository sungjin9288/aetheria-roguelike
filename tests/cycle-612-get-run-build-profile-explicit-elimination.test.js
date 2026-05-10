import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 612: getRunBuildProfile stats explicit default-elimination
 *   (cycle 222-611 silent dead config 시리즈 352번째 — explicit default-elimination
 *   pattern 4번째 적용).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/utils/runProfile.ts (line 47):
 *     export const getRunBuildProfile = (player: Player, stats: any = {}) => {...};
 * - 호출 사이트:
 *     · BuildAdvicePanel:56 — getRunBuildProfile(player || {}) — 1 arg.
 *     · cycle-345 test:65 — getRunBuildProfile(player) — 1 arg.
 *     · 5 다른 callers (statsCalculator/gameUtils/useGameEngine/exploreActions/
 *       combatVictory): 2 args 명시.
 * - 기존 상태: 2 caller (BuildAdvicePanel + cycle-345)가 stats 미전달 →
 *   default {} 활성.
 *
 * 패턴 (cycle 222-611 시리즈 352번째):
 * - cycle 502-611: default 청소 메가 시리즈 110사이클.
 * - cycle 612: explicit default-elimination 4번째 (cycle 608/609/611에 이은).
 *
 * 수정:
 * - BuildAdvicePanel.tsx:56 — getRunBuildProfile(player || {}) → getRunBuildProfile(player || {}, {}).
 * - cycle-345 test:65 — getRunBuildProfile(player) → getRunBuildProfile(player, {}).
 * - runProfile.ts:47 — stats default {} 제거.
 *
 * 회귀 가드:
 * - 7 callsite 동작 그대로.
 * - body 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 612: getRunBuildProfile signature에서 stats default 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('export const getRunBuildProfile');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
        'getRunBuildProfile stats default {} 제거');
});

test('cycle 612: 정합성 가드 — caller 명시 {} 추가 (BuildAdvicePanel + cycle-345)', async () => {
    const bap = await readSrc('src/components/BuildAdvicePanel.tsx');
    assert.ok(/getRunBuildProfile\(player \|\| \{\},\s*\{\}\)/.test(bap),
        'BuildAdvicePanel getRunBuildProfile(player || {}, {}) 명시');

    const test1 = await readSrc('tests/cycle-345-score-tag-desc-dead.test.js');
    assert.ok(/getRunBuildProfile\(player,\s*\{\}\)/.test(test1),
        'cycle-345 test getRunBuildProfile(player, {}) 명시');
});

test('cycle 612: cycle 502-611 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ng = await readSrc('src/utils/nameGenerator.ts');
    assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(ng),
        'cycle 611 createRandomMobileName rng default 0건');

    const gu = await readSrc('src/utils/graveUtils.ts');
    assert.ok(!/buildGraveData = \(player: Player, random:\s*any\s*=\s*Math\.random/.test(gu),
        'cycle 609 buildGraveData random default 0건');
});
