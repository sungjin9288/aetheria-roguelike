import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 604: seedAvatarScenario `preset = 'paladin-plate'` default unreachable
 *   (cycle 222-603 silent dead config 시리즈 340번째 — redundant default annotation
 *   청소 메가 시리즈 추가, useGameTestApi.ts).
 *
 * 발견 (1 default unreachable):
 * - src/hooks/useGameTestApi.ts (line 319):
 *     seedAvatarScenario: (preset: any = 'paladin-plate') => {
 *         const scenario = avatarScenarioMap[preset];
 *         if (!scenario) return false;
 *         ...
 *     }
 * - 호출 사이트:
 *     · scripts/smoke-gameplay.mjs:305 — seedAvatarScenario?.(preset.id) — 1 arg
 *       명시 (preset.id from avatarPresets array iteration).
 *     · 다른 caller 0건 (src/, tests/ 모두).
 * - 결과: preset 항상 명시 전달. default 'paladin-plate' 도달 불가.
 *
 * 패턴 (cycle 222-603 시리즈 340번째):
 * - cycle 502-603: default 청소 메가 시리즈 102사이클.
 * - cycle 604: useGameTestApi.ts cleanup. cycle 593의 dead exposure pivot
 *   (window.advanceTime 제거)와 동일 모듈 추가 cleanup.
 *
 * 수정 (src/hooks/useGameTestApi.ts):
 * - preset = 'paladin-plate' → preset.
 * - body의 avatarScenarioMap[preset] / scenario null 가드 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (scripts/smoke-gameplay.mjs) 동작 그대로.
 * - body avatarScenarioMap lookup / scenario null 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 604: seedAvatarScenario signature에서 preset default 0건", async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/seedAvatarScenario:\s*\(preset:\s*any\s*=\s*'paladin-plate'\)/.test(source),
        "seedAvatarScenario preset default 'paladin-plate' 제거");
    assert.ok(/seedAvatarScenario:\s*\(preset:\s*any\)/.test(source),
        'seedAvatarScenario 파라미터 자체는 보존');
});

test('cycle 604: 정합성 가드 — scripts/smoke-gameplay callsite 보존', async () => {
    const source = await readSrc('scripts/smoke-gameplay.mjs');
    assert.ok(/window\.__AETHERIA_TEST_API__\?\.seedAvatarScenario\?\.\(value\)/.test(source),
        'smoke-gameplay seedAvatarScenario(preset.id) callsite 보존');
});

test('cycle 604: body avatarScenarioMap / scenario null 가드 보존', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(/const scenario = avatarScenarioMap\[preset\]/.test(source),
        'avatarScenarioMap[preset] lookup 보존');
    assert.ok(/if \(!scenario\) return false/.test(source),
        '!scenario null 가드 보존');
});

test('cycle 604: cycle 502-603 회귀 가드 — default 청소 시리즈 보존', async () => {
    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/summarizeHistory = \(history: any\[\]\s*=\s*\[\]/.test(aiu),
        'cycle 603 summarizeHistory history default 0건');

    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitLootHint = \(items: any\[\]\s*=\s*\[\]/.test(rp),
        'cycle 602 getTraitLootHint items default 0건');
});
