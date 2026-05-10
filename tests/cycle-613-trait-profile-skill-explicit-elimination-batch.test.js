import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 613: getTraitProfile + getTraitSkill stats explicit default-elimination
 *   batch (cycle 222-612 silent dead config 시리즈 353번째 — explicit
 *   default-elimination pattern 5번째 적용, 2 cleanup combo).
 *
 * 발견 (2 defaults reachable → unreachable conversion):
 * - src/utils/runProfile.ts (line 201, 242):
 *     · getTraitProfile (player, stats: any = {})
 *     · getTraitSkill (player, stats: any = {}) → getTraitProfile(player, stats).skill
 * - 호출 사이트:
 *     · getTraitProfile: DashboardMobileSummary:37 — getTraitProfile(player) — 1 arg.
 *     · getTraitSkill: gameUtils:23 — getTraitSkill(player) — 1 arg.
 *     · 다른 callers: 모두 2 args 명시.
 *
 * 패턴 (cycle 222-612 시리즈 353번째):
 * - cycle 502-612: default 청소 메가 시리즈 111사이클.
 * - cycle 613: explicit default-elimination 5번째 (cycle 608/609/611/612 lens 정착).
 *   single-cycle 2-default batch (paired functions).
 *
 * 수정:
 * - DashboardMobileSummary.tsx:37 — getTraitProfile(player) → getTraitProfile(player, {}).
 * - gameUtils.ts:23 — getTraitSkill(player) → getTraitSkill(player, {}).
 * - runProfile.ts:201/242 — stats defaults 모두 제거.
 *
 * 회귀 가드:
 * - 다수 callsite 동작 그대로.
 * - body 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 613: getTraitProfile signature에서 stats default 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('export const getTraitProfile');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
        'getTraitProfile stats default {} 제거');
});

test('cycle 613: getTraitSkill signature에서 stats default 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('export const getTraitSkill');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
        'getTraitSkill stats default {} 제거');
});

test('cycle 613: 정합성 가드 — caller {} 명시 추가', async () => {
    const dms = await readSrc('src/components/DashboardMobileSummary.tsx');
    assert.ok(/getTraitProfile\(player,\s*\{\}\)/.test(dms),
        'DashboardMobileSummary getTraitProfile(player, {}) 명시');

    const gu = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/getTraitSkill\(player,\s*\{\}\)/.test(gu),
        'gameUtils getTraitSkill(player, {}) 명시');
});

test('cycle 613: cycle 502-612 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getRunBuildProfile = \(player: Player, stats:\s*any\s*=\s*\{\}\)/.test(rp),
        'cycle 612 getRunBuildProfile stats default 0건');

    const ng = await readSrc('src/utils/nameGenerator.ts');
    assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(ng),
        'cycle 611 createRandomMobileName rng default 0건');
});
