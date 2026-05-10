import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 605: seedEnhanceScenario 4 defaults batch unreachable
 *   (cycle 222-604 silent dead config 시리즈 341번째 — redundant default annotation
 *   청소 메가 시리즈 추가, single-cycle 4-default batch).
 *
 * 발견 (4 defaults batch):
 * - src/hooks/useGameTestApi.ts (line 287):
 *     seedEnhanceScenario: ({ gold = 500, materialCount = 0, weaponEnhance = 0 }: any = {}) => {...}
 * - 호출 사이트:
 *     · scripts/smoke-gameplay.mjs:275 — seedEnhanceScenario?.({gold:100,
 *       materialCount:0, weaponEnhance:0})
 *     · scripts/smoke-gameplay.mjs:279 — seedEnhanceScenario?.({gold:500,
 *       materialCount:0, weaponEnhance:0})
 *     · scripts/smoke-gameplay.mjs:283 — seedEnhanceScenario?.({gold:500,
 *       materialCount:1, weaponEnhance:0})
 *     · 다른 caller 0건 (src/, tests/ 모두).
 * - 결과: 3 callers 모두 완전 object 명시 (3 inner fields 모두 전달)이라 outer
 *   `: any = {}` + inner 3 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-604 시리즈 341번째):
 * - cycle 502-604: default 청소 메가 시리즈 103사이클.
 * - cycle 605: useGameTestApi.ts cleanup. cycle 561 buildProceduralOutcome
 *   동일 패턴 (outer + inner destructure defaults 동시 정리).
 *
 * 수정 (src/hooks/useGameTestApi.ts):
 * - signature: ({ gold = 500, materialCount = 0, weaponEnhance = 0 }: any = {})
 *              → ({ gold, materialCount, weaponEnhance }: any).
 * - body의 materialCount / weaponEnhance / gold 사용처 보존.
 *
 * 회귀 가드:
 * - 3 production callsite (smoke-gameplay) 동작 그대로.
 * - body preservedInventory / seededMaterials 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 605: seedEnhanceScenario signature에서 4 defaults 0건', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    const fnIdx = source.indexOf('seedEnhanceScenario:');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/gold\s*=\s*500/.test(sig),
        'seedEnhanceScenario gold default 500 제거');
    assert.ok(!/materialCount\s*=\s*0/.test(sig),
        'seedEnhanceScenario materialCount default 0 제거');
    assert.ok(!/weaponEnhance\s*=\s*0/.test(sig),
        'seedEnhanceScenario weaponEnhance default 0 제거');
    assert.ok(!/\}:\s*any\s*=\s*\{\}/.test(sig),
        'seedEnhanceScenario outer default {} 제거');
});

test('cycle 605: 정합성 가드 — scripts/smoke-gameplay 3 callsite 보존', async () => {
    const source = await readSrc('scripts/smoke-gameplay.mjs');
    const calls = source.match(/seedEnhanceScenario\?\.\(\{[^}]+\}\)/g) || [];
    assert.equal(calls.length, 3, `smoke-gameplay seedEnhanceScenario 3 callsite 보존: ${calls.length}건`);
});

test('cycle 605: body preservedInventory / seededMaterials 처리 보존', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(/const preservedInventory = \(er\.player\.inv \|\| \[\]\)\.filter/.test(source),
        'preservedInventory filter 보존');
    assert.ok(/Array\.from\(\{ length: materialCount \}/.test(source),
        'seededMaterials Array.from(materialCount) 보존');
});

test('cycle 605: cycle 502-604 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/seedAvatarScenario:\s*\(preset:\s*any\s*=\s*'paladin-plate'\)/.test(ut),
        "cycle 604 seedAvatarScenario preset default 0건");

    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/summarizeHistory = \(history: any\[\]\s*=\s*\[\]/.test(aiu),
        'cycle 603 summarizeHistory history default 0건');
});
