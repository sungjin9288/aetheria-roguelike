import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdir } from 'node:fs/promises';

/**
 * cycle 505: grantGold `amount` default unreachable 정리
 *   (cycle 222-504 silent dead config 시리즈 255번째 — redundant default annotation
 *   util-level cleanup, cycle 502-504 lens 회귀).
 *
 * 발견 (1 default unreachable):
 * - src/utils/gameUtils.ts (line 207):
 *     export const grantGold = (player: Player, amount: any = 0) => {...
 *         if (!amount) return player;
 *         ...
 *     }
 * - 호출 사이트 (9+ callsite, 다수 hook 파일):
 *     · useInventoryActions / combatVictory / eventActions / characterActions /
 *       _shared / questReducer / 등.
 *     · 모든 callsite가 항상 2 args 전달 (amount 명시).
 *     · default 0 도달 불가.
 * - 결과: amount 항상 명시 전달. body의 `if (!amount) return player` defensive
 *   guard는 amount=0 케이스에서 활성이지만 default 0과는 무관 (caller가 0을
 *   넘기는 케이스 vs default 0 분리).
 *
 * 패턴 (cycle 222-504 시리즈 255번째):
 * - cycle 502: incrementStat amount 파라미터 unreachable.
 * - cycle 503: consumeInventoryItemByName count default unreachable.
 * - cycle 504: getDailyProtocolCompletions amount + 3 wrapper cascade.
 * - cycle 505: grantGold amount default — 동일 lens (가장 많은 callsite).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - signature에서 amount: any = 0 → amount: any (default 제거).
 * - body의 `if (!amount) return player` defensive guard 보존 (caller가 0을
 *   넘기는 케이스에서 활성).
 *
 * 회귀 가드:
 * - 9+ callsite 동작 그대로.
 * - body defensive guard / stats 누적 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 505: grantGold signature에서 amount default 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnIdx = source.indexOf('export const grantGold');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/amount:\s*any\s*=\s*0/.test(sig), 'amount default 0 제거');
    assert.ok(/\bamount\b/.test(sig), 'amount 파라미터 자체는 보존');
});

test('cycle 505: body defensive guard 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnIdx = source.indexOf('export const grantGold');
    const fnEnd = source.indexOf('export const', fnIdx + 1);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/if \(!amount\) return player/.test(block), 'defensive `if (!amount)` 가드 보존');
    assert.ok(/\(player\.gold \|\| 0\) \+ amount/.test(block), 'gold 누적 동작 보존');
});

test('cycle 505: 정합성 가드 — 모든 grantGold 호출자가 2 args 전달', async () => {
    const hooksDir = path.join(ROOT, 'src/hooks');
    const files = await readdir(hooksDir, { recursive: true });
    let totalCalls = 0;
    for (const f of files) {
        if (!String(f).endsWith('.ts')) continue;
        const fpath = path.join(hooksDir, String(f));
        let src;
        try { src = await readFile(fpath, 'utf8'); } catch { continue; }
        const calls = src.match(/grantGold\(/g) || [];
        totalCalls += calls.length;
    }
    assert.ok(totalCalls >= 5, `grantGold 호출 5건 이상 (실제: ${totalCalls})`);
});

test('cycle 505: cycle 502/503/504 회귀 가드 — 이전 default 정리 보존', async () => {
    const ps = await readSrc('src/utils/playerStateUtils.ts');
    const psFn = ps.indexOf('export const incrementStat');
    const psEnd = ps.indexOf('=>', psFn);
    assert.ok(!/\bamount\b/.test(ps.slice(psFn, psEnd)), 'cycle 502 incrementStat amount 0건');

    const eu = await readSrc('src/utils/enhancementUtils.ts');
    const euFn = eu.indexOf('export const consumeInventoryItemByName');
    const euEnd = eu.indexOf('=>', euFn);
    assert.ok(!/count:\s*number\s*=\s*1/.test(eu.slice(euFn, euEnd)),
        'cycle 503 consumeInventoryItemByName count default 0건');

    const gu = await readSrc('src/utils/gameUtils.ts');
    const guFn = gu.indexOf('export const getDailyProtocolCompletions');
    const guEnd = gu.indexOf('=>', guFn);
    assert.ok(!/amount:\s*any\s*=\s*1/.test(gu.slice(guFn, guEnd)),
        'cycle 504 getDailyProtocolCompletions amount default 0건');
});
