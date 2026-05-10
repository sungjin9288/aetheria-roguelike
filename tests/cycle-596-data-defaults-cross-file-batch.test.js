import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 596: getCodexProgress + getChainEventForLoc 3 defaults cross-file batch
 *   unreachable (cycle 222-595 silent dead config 시리즈 333번째 — redundant
 *   default annotation 청소 메가 시리즈 추가, data/ 디렉토리 진입).
 *
 * 발견 (3 defaults batch, 2 files):
 * - src/data/codexRewards.ts (line 53):
 *     export const getCodexProgress = (codex: any = {}, claimed: any = []) => {...};
 * - src/data/eventChains.ts (line 648):
 *     export function getChainEventForLoc(loc: any, progress: any = {}) {...}
 * - 호출 사이트:
 *     · getCodexProgress: Codex:41 + cycle-286:46 (2 callers, 모두 명시).
 *     · getChainEventForLoc: exploreActions:41 (production) + 6+ test callers
 *       (forgotten_commander, water_apostle 등) — 모두 progress 명시.
 * - 결과: 3 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-595 시리즈 333번째):
 * - cycle 502-595: default 청소 메가 시리즈 92사이클.
 * - cycle 596: data/ 디렉토리 진입 — utils/ + components/ + hooks/ + systems/
 *   + reducers/ + services/ + data/ 7개 디렉토리 lens 확장.
 *
 * 수정:
 * - codexRewards.ts: codex / claimed defaults 모두 제거.
 * - eventChains.ts: progress default 제거.
 *
 * 회귀 가드:
 * - 모든 callsite 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 596: getCodexProgress signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/data/codexRewards.ts');
    const fnIdx = source.indexOf('export const getCodexProgress');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/codex:\s*any\s*=\s*\{\}/.test(sig),
        'getCodexProgress codex default {} 제거');
    assert.ok(!/claimed:\s*any\s*=\s*\[\]/.test(sig),
        'getCodexProgress claimed default [] 제거');
});

test('cycle 596: getChainEventForLoc signature에서 progress default 0건', async () => {
    const source = await readSrc('src/data/eventChains.ts');
    assert.ok(!/getChainEventForLoc\(loc:\s*any,\s*progress:\s*any\s*=\s*\{\}\)/.test(source),
        'getChainEventForLoc progress default {} 제거');
});

test('cycle 596: 정합성 가드 — production + test callsite 보존', async () => {
    const cd = await readSrc('src/components/Codex.tsx');
    assert.ok(/getCodexProgress\(codex,\s*claimed\)/.test(cd),
        'Codex getCodexProgress(codex, claimed) callsite 보존');

    const ea = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/getChainEventForLoc\(player\.loc,\s*player\.eventChainProgress\)/.test(ea),
        'exploreActions getChainEventForLoc(player.loc, ...) callsite 보존');

    const test1 = await readSrc('tests/forgotten-commander-chain.test.js');
    assert.ok(/getChainEventForLoc\('잊혀진 폐허',\s*\{\}\)/.test(test1),
        'test forgotten_commander callsite 보존');
});

test('cycle 596: cycle 502-595 회귀 가드 — default 청소 시리즈 보존', async () => {
    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(!/claimSeasonReward:\s*\(tier:\s*any,\s*rewardLabel:\s*string \| null\s*=\s*null\)/.test(inv),
        'cycle 595 claimSeasonReward rewardLabel default 0건');

    const env = await readSrc('src/vite-env.d.ts');
    assert.ok(!/advanceTime\?:\s*any/.test(env),
        'cycle 594 vite-env Window.advanceTime 0건');
});
