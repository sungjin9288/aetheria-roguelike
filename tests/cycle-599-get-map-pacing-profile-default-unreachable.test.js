import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 599: getMapPacingProfile `mapData = {}` default unreachable
 *   (cycle 222-598 silent dead config 시리즈 336번째 — redundant default annotation
 *   청소 메가 시리즈 추가). cycle 600 milestone 직전 마지막 cleanup.
 *
 * 발견 (1 default unreachable):
 * - src/utils/explorationPacing.ts (line 30):
 *     export const getMapPacingProfile = (mapData: GameMap | null | undefined = {}) => {
 *         if (!mapData || mapData.type === 'safe') {...}
 *         ...
 *     };
 * - 호출 사이트:
 *     · explorationPacing.ts:94/107/118 (3 internal callers)
 *     · exploreActions.ts:36 (1 production caller)
 *     · 모두 mapData 명시 전달.
 * - 결과: mapData 항상 명시 전달. default {} 도달 불가. body의 `if (!mapData
 *   || mapData.type === 'safe')` guard가 undefined/null 안전 처리.
 *
 * 패턴 (cycle 222-598 시리즈 336번째):
 * - cycle 502-598: default 청소 메가 시리즈 95사이클.
 * - cycle 599: cycle 600 milestone 직전 마지막 cleanup.
 *
 * 수정 (src/utils/explorationPacing.ts):
 * - signature에서 mapData: GameMap | null | undefined = {} →
 *   mapData: GameMap | null | undefined.
 * - body의 !mapData guard 보존.
 *
 * 회귀 가드:
 * - 4 callsite 동작 그대로.
 * - body safe map / pacing profile 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 599: getMapPacingProfile signature에서 mapData default 0건', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const fnIdx = source.indexOf('export const getMapPacingProfile');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/mapData:\s*GameMap \| null \| undefined\s*=\s*\{\}/.test(sig),
        'getMapPacingProfile mapData default {} 제거');
    assert.ok(/\bmapData\b/.test(sig), 'mapData 파라미터 자체는 보존');
});

test('cycle 599: 정합성 가드 — 4 callsite 보존', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const internalCalls = (source.match(/getMapPacingProfile\(mapData\)/g) || []).length;
    assert.equal(internalCalls, 3, `internal getMapPacingProfile callsite 3건 보존: ${internalCalls}건`);

    const ea = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/getMapPacingProfile\(mapData\)/.test(ea),
        'exploreActions getMapPacingProfile callsite 보존');
});

test('cycle 599: body !mapData guard 보존 (undefined 안전)', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(/if \(!mapData \|\| mapData\.type === 'safe'\)/.test(source),
        '!mapData || mapData.type === safe guard 보존');
});

test('cycle 599: cycle 502-598 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitFeaturedItems = \(items:\s*any\[\]\s*=\s*\[\]/.test(rp),
        'cycle 598 getTraitFeaturedItems items default 0건');

    const rl = await readSrc('src/data/relics.ts');
    assert.ok(!/pickWeightedRelics = \(pool:\s*any,\s*count:\s*any\s*=\s*3\)/.test(rl),
        'cycle 597 pickWeightedRelics count default 0건');
});
