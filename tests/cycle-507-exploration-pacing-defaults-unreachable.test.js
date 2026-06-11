import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 507: explorationPacing 2 함수 (getNarrativeEventChance + getQuietExplorationChance)
 *   defaults unreachable batch 정리
 *   (cycle 222-506 silent dead config 시리즈 257번째 — redundant default annotation
 *   util-level batch, util default 청소 메가 시리즈 6번째).
 *
 * 발견 (6 default unreachable):
 * - src/utils/explorationPacing.ts (line 87, 99):
 *     export const getNarrativeEventChance = (baseChance: any = 0, bonusMultiplier:
 *         any = 0, stats: any = {}, mapData: GameMap | null = null) => {...}
 *     export const getQuietExplorationChance = (stats: any = {},
 *         mapData: GameMap | null = null) => {...}
 * - 호출 사이트 (각 2 callsite):
 *     · getNarrativeEventChance:
 *       - explorationPacing.ts:133 (getDiscoveryOdds 내부) — 4 args.
 *       - exploreActions.ts:37 — 4 args.
 *     · getQuietExplorationChance:
 *       - explorationPacing.ts:132 (getDiscoveryOdds 내부) — 2 args.
 *       - exploreActions.ts:38 — 2 args.
 *     · 모든 callsite가 모든 파라미터를 명시 전달.
 *
 * 패턴 (cycle 222-506 시리즈 257번째):
 * - cycle 502-506: util default 청소 메가 시리즈 (incrementStat / consumeInventory /
 *   getDailyProtocolCompletions / grantGold / getEnhanceAvailability).
 * - cycle 507: explorationPacing 2 함수 6 defaults batch — 같은 lens.
 *
 * 수정 (src/utils/explorationPacing.ts):
 * - getNarrativeEventChance signature에서 4 default 제거.
 * - getQuietExplorationChance signature에서 2 default 제거.
 *
 * 회귀 가드:
 * - 4 callsite 동작 그대로.
 * - body 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 507: getNarrativeEventChance signature defaults 0건', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const fnIdx = source.indexOf('export const getNarrativeEventChance');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/baseChance:\s*any\s*=/.test(sig), 'baseChance default 제거');
    assert.ok(!/bonusMultiplier:\s*any\s*=/.test(sig), 'bonusMultiplier default 제거');
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig), 'stats default 제거');
    assert.ok(!/mapData:[^=]*=\s*null/.test(sig), 'mapData default 제거');
});

test('cycle 507: getQuietExplorationChance signature defaults 0건', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const fnIdx = source.indexOf('export const getQuietExplorationChance');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig), 'stats default 제거');
    assert.ok(!/mapData:[^=]*=\s*null/.test(sig), 'mapData default 제거');
});

test('cycle 507: 정합성 가드 — 모든 callsite 명시 전달', async () => {
    const exploreActions = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/getNarrativeEventChance\([^)]*,[^)]*,[^)]*,[^)]*\)/.test(exploreActions),
        'exploreActions getNarrativeEventChance 4 args 보존');
    assert.ok(/getQuietExplorationChance\([^)]*,[^)]*\)/.test(exploreActions),
        'exploreActions getQuietExplorationChance 2 args 보존');

    const pacing = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(/getNarrativeEventChance\(mapData\?\.eventChance \|\| 0, 0, player\?\.stats, mapData(?: \?\? null)?\)/.test(pacing),
        'getDiscoveryOdds 내부 getNarrativeEventChance 4 args 보존');
    assert.ok(/getQuietExplorationChance\(player\?\.stats, mapData(?: \?\? null)?\)/.test(pacing),
        'getDiscoveryOdds 내부 getQuietExplorationChance 2 args 보존');
});

test('cycle 507: body 동작 보존', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(/SPECIAL_EVENT_MAX_CHANCE/.test(source), 'BALANCE.SPECIAL_EVENT_MAX_CHANCE 보존');
    assert.ok(/QUIET_STREAK_NOTHING_REDUCTION/.test(source), 'QUIET_STREAK_NOTHING_REDUCTION 보존');
    assert.ok(/clamp\(/.test(source), 'clamp 호출 보존');
});

test('cycle 507: cycle 502-506 회귀 가드 — 이전 정리 보존', async () => {
    const eu = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(!/getEnhanceAvailability[^=]*gold:\s*number\s*=\s*0/.test(eu),
        'cycle 506 getEnhanceAvailability gold default 0건');
    const gu = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/grantGold[^=]*amount:\s*any\s*=\s*0/.test(gu),
        'cycle 505 grantGold amount default 0건');
});
