import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 597: getActiveRelicSynergies + pickWeightedRelics 2 defaults batch
 *   unreachable (cycle 222-596 silent dead config 시리즈 334번째 — redundant
 *   default annotation 청소 메가 시리즈 추가, data/relics.ts).
 *
 * 발견 (2 defaults batch):
 * - src/data/relics.ts (line 563, 568):
 *     · getActiveRelicSynergies (relics: any = [])
 *     · pickWeightedRelics (pool: any, count: any = 3)
 * - 호출 사이트:
 *     · getActiveRelicSynergies: statsCalculator:378 + CombatEngine:395/416/
 *       433/1553 (5 production) + cycle-394 test — 모두 명시.
 *     · pickWeightedRelics: exploreUtils:103 + eventActions:54 + exploreActions:118
 *       + combatBossHandlers:90 (4 production) + cycle-285 test — 모두 count
 *       명시 (1 또는 3).
 * - 결과: 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-596 시리즈 334번째):
 * - cycle 502-596: default 청소 메가 시리즈 93사이클.
 * - cycle 597: data/relics.ts 추가 cleanup, cycle 596 data/ 진입 연속.
 *
 * 수정 (src/data/relics.ts):
 * - getActiveRelicSynergies relics default [] 제거.
 * - pickWeightedRelics count default 3 제거.
 *
 * 회귀 가드:
 * - 다수 callsite 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 597: getActiveRelicSynergies signature에서 relics default 0건', async () => {
    const source = await readSrc('src/data/relics.ts');
    const fnIdx = source.indexOf('export const getActiveRelicSynergies');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/relics:\s*any\s*=\s*\[\]/.test(sig),
        'getActiveRelicSynergies relics default [] 제거');
});

test('cycle 597: pickWeightedRelics signature에서 count default 0건', async () => {
    const source = await readSrc('src/data/relics.ts');
    const fnIdx = source.indexOf('export const pickWeightedRelics');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/count:\s*any\s*=\s*3/.test(sig),
        'pickWeightedRelics count default 3 제거');
});

test('cycle 597: 정합성 가드 — 다수 callsite 보존', async () => {
    const sc = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(/getActiveRelicSynergies\(relics\)/.test(sc),
        'statsCalculator getActiveRelicSynergies 보존');

    const eu = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(/pickWeightedRelics\(available,\s*3\)/.test(eu),
        'exploreUtils pickWeightedRelics(available, 3) 보존');

    const ev = await readSrc('src/hooks/gameActions/eventActions.ts');
    assert.ok(/pickWeightedRelics\(updatedPlayer\.relics \|\| \[\],\s*1\)/.test(ev),
        'eventActions pickWeightedRelics(..., 1) 보존');
});

test('cycle 597: cycle 502-596 회귀 가드 — default 청소 시리즈 보존', async () => {
    const cd = await readSrc('src/data/codexRewards.ts');
    assert.ok(!/getCodexProgress[^=]*codex:\s*any\s*=\s*\{\}/.test(cd),
        'cycle 596 getCodexProgress codex default 0건');

    const ec = await readSrc('src/data/eventChains.ts');
    assert.ok(!/getChainEventForLoc\(loc:\s*any,\s*progress:\s*any\s*=\s*\{\}\)/.test(ec),
        'cycle 596 getChainEventForLoc progress default 0건');
});
