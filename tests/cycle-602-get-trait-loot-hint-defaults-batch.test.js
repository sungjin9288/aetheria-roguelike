import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 602: getTraitLootHint 2 defaults batch unreachable
 *   (cycle 222-601 silent dead config 시리즈 338번째 — redundant default annotation
 *   청소 메가 시리즈 추가, runProfile.ts).
 *
 * 발견 (2 defaults batch):
 * - src/utils/runProfile.ts (line 342):
 *     export const getTraitLootHint = (items: any[] = [], traitProfile: any,
 *         player: Player | null = null) => {...};
 * - 호출 사이트 (3 callers):
 *     · combatVictory.ts:217 — getTraitLootHint(lootResult.items, traitProfile,
 *       updatedPlayer)
 *     · run-profile-utils.test.js:212 — getTraitLootHint(loot, trait, player)
 *     · cycle-354 test:64 — getTraitLootHint(loot, trait, player)
 * - 결과: items / player 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-601 시리즈 338번째):
 * - cycle 502-601: default 청소 메가 시리즈 100사이클.
 * - cycle 602: runProfile.ts 추가 cleanup, cycle 598 getTraitFeaturedItems
 *   동일 모듈 paired.
 *
 * 수정 (src/utils/runProfile.ts):
 * - items default [] 제거.
 * - player default null 제거.
 *
 * 회귀 가드:
 * - 3 callsite 동작 그대로.
 * - body getTraitFeaturedItems 호출 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 602: getTraitLootHint signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('export const getTraitLootHint');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/items:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'getTraitLootHint items default [] 제거');
    assert.ok(!/player:\s*Player \| null\s*=\s*null/.test(sig),
        'getTraitLootHint player default null 제거');
});

test('cycle 602: 정합성 가드 — 3 callsite 보존', async () => {
    const cv = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/getTraitLootHint\(lootResult\.items,\s*traitProfile,\s*updatedPlayer\)/.test(cv),
        'combatVictory getTraitLootHint callsite 보존');

    const test1 = await readSrc('tests/run-profile-utils.test.js');
    assert.ok(/getTraitLootHint\(loot,\s*trait,\s*player\)/.test(test1),
        'run-profile-utils test callsite 보존');
});

test('cycle 602: body getTraitFeaturedItems 호출 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/getTraitFeaturedItems\(items,\s*traitProfile,\s*player,\s*1\)/.test(source),
        'getTraitFeaturedItems(items, traitProfile, player, 1) 호출 보존');
});

test('cycle 602: cycle 502-601 회귀 가드 — default 청소 시리즈 보존', async () => {
    const su = await readSrc('src/utils/synthesisUtils.ts');
    assert.ok(!/performSynthesis = \(items: any, selectedOutput:\s*any\s*=\s*null/.test(su),
        'cycle 601 performSynthesis selectedOutput default 0건');

    const ep = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/getMapPacingProfile\s*=\s*\(mapData:\s*GameMap \| null \| undefined\s*=\s*\{\}\)/.test(ep),
        'cycle 599 getMapPacingProfile mapData default 0건');
});
