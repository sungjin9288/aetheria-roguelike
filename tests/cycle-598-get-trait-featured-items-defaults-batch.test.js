import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 598: getTraitFeaturedItems 3 defaults batch unreachable
 *   (cycle 222-597 silent dead config 시리즈 335번째 — redundant default annotation
 *   청소 메가 시리즈 추가, runProfile.ts).
 *
 * 발견 (3 defaults batch):
 * - src/utils/runProfile.ts (line 325):
 *     export const getTraitFeaturedItems = (items: any[] = [], traitProfile: any,
 *         player: Player | null = null, limit: any = 3) => (...);
 * - 호출 사이트 (2 callers):
 *     · runProfile.ts:340 — getTraitFeaturedItems(items, traitProfile, player, 1)
 *     · run-profile-utils.test.js:213 — getTraitFeaturedItems(loot, trait, player, 2)
 * - 결과: items / player / limit 항상 명시 전달. 3 defaults 모두 도달 불가.
 *   body의 (items || []) defensive guard는 별개 보존.
 *
 * 패턴 (cycle 222-597 시리즈 335번째):
 * - cycle 502-597: default 청소 메가 시리즈 94사이클.
 * - cycle 598: runProfile.ts 추가 cleanup, single-cycle 3-default batch.
 *
 * 수정 (src/utils/runProfile.ts):
 * - 3 defaults 모두 제거.
 * - body의 (items || []) defensive guard 보존.
 *
 * 회귀 가드:
 * - 2 callsite (1 internal + 1 test) 동작 그대로.
 * - body filter / sort / map 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 598: getTraitFeaturedItems signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('export const getTraitFeaturedItems');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/items:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'getTraitFeaturedItems items default [] 제거');
    assert.ok(!/player:\s*Player \| null\s*=\s*null/.test(sig),
        'getTraitFeaturedItems player default null 제거');
    assert.ok(!/limit:\s*any\s*=\s*3/.test(sig),
        'getTraitFeaturedItems limit default 3 제거');
});

test('cycle 598: 정합성 가드 — 2 callsite 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/getTraitFeaturedItems\(items,\s*traitProfile,\s*player,\s*1\)/.test(source),
        'internal getTraitFeaturedItems(items, traitProfile, player, 1) 보존');

    const test1 = await readSrc('tests/run-profile-utils.test.js');
    assert.ok(/getTraitFeaturedItems\(loot,\s*trait,\s*player,\s*2\)/.test(test1),
        'test getTraitFeaturedItems(loot, trait, player, 2) 보존');
});

test('cycle 598: body (items || []) defensive guard + sort 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/\(items \|\| \[\]\)[\s\S]*?\.map/.test(source),
        '(items || []) defensive guard 보존');
    assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*player\)/.test(source),
        'getTraitItemResonance 호출 보존');
});

test('cycle 598: cycle 502-597 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rl = await readSrc('src/data/relics.ts');
    assert.ok(!/getActiveRelicSynergies = \(relics:\s*any\s*=\s*\[\]\)/.test(rl),
        'cycle 597 getActiveRelicSynergies relics default 0건');
    assert.ok(!/pickWeightedRelics = \(pool:\s*any,\s*count:\s*any\s*=\s*3\)/.test(rl),
        'cycle 597 pickWeightedRelics count default 0건');
});
