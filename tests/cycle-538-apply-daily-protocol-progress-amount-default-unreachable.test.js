import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 538: applyDailyProtocolProgress `amount = 1` default unreachable
 *   (cycle 222-537 silent dead config 시리즈 281번째 — redundant default annotation
 *   util/component/hook/system/reducer default 청소 메가 시리즈 34번째).
 *   reducers/ 진입.
 *
 * 발견 (1 default unreachable):
 * - src/reducers/handlers/helpers.ts (line 18):
 *     export const applyDailyProtocolProgress = (player: Player, type: any,
 *         amount: any = 1) => {
 *         const dp = (player.stats as any)?.dailyProtocol;
 *         if (!dp) return player;
 *         ...
 *     };
 * - 호출 사이트:
 *     · 1 production caller: protocolHandlers.ts:20 — applyDailyProtocolProgress
 *       (state.player, dpType, amount) — 3 args 명시.
 *     · 6 test caller: tests/cycle-232-relic-shards-conversion.test.js — 모두
 *       3 args 명시 ('goldSpend' / 'kills', 1).
 *     · 다른 caller 0건.
 * - 결과: amount 항상 명시 전달. default 1 도달 불가.
 *
 * 패턴 (cycle 222-537 시리즈 281번째):
 * - cycle 502-537: util/component/hook/system default 청소 메가 시리즈 34사이클.
 * - cycle 538: reducers/ 진입 — utils/ + components/ + hooks/ + systems/ 외
 *   reducers/까지 lens 확장.
 *
 * 수정 (src/reducers/handlers/helpers.ts):
 * - signature에서 amount: any = 1 → amount: any.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 7 callsite (1 production + 6 test) 동작 그대로.
 * - body dp 가드 / essenceGain / newShards / itemRewards 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 538: applyDailyProtocolProgress signature에서 amount default 0건', async () => {
    const source = await readSrc('src/reducers/handlers/helpers.ts');
    const fnIdx = source.indexOf('export const applyDailyProtocolProgress');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/amount:\s*any\s*=\s*1/.test(sig),
        'applyDailyProtocolProgress amount default 1 제거');
    assert.ok(/\bamount\b/.test(sig), 'amount 파라미터 자체는 보존');
});

test('cycle 538: 정합성 가드 — production + test callsite 보존', async () => {
    const ph = await readSrc('src/reducers/handlers/protocolHandlers.ts');
    assert.ok(/applyDailyProtocolProgress\(state\.player,\s*dpType,\s*amount\)/.test(ph),
        'protocolHandlers callsite 보존');

    const tt = await readSrc('tests/cycle-232-relic-shards-conversion.test.js');
    const calls = (tt.match(/applyDailyProtocolProgress\(/g) || []).length;
    assert.ok(calls >= 6, `test callsite 6건 이상 보존: ${calls}건`);
});

test('cycle 538: body 동작 보존', async () => {
    const source = await readSrc('src/reducers/handlers/helpers.ts');
    assert.ok(/const dp = \(player\.stats as any\)\?\.dailyProtocol/.test(source),
        'dp 추출 보존');
    assert.ok(/if \(!dp\) return player/.test(source),
        'dp 가드 early return 보존');
    assert.ok(/let newShards = dp\.relicShards \|\| 0/.test(source),
        'newShards 초기화 보존');
});

test('cycle 538: cycle 502-537 회귀 가드 — util/component/hook/system default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/calculateDamage\(stats: any, options:\s*any\s*=\s*\{\}\)/.test(ce),
        'cycle 537 calculateDamage options default 0건');
    assert.ok(!/applyExpGain\(player: Player, expGained:\s*any\s*=\s*0\)/.test(ce),
        'cycle 536 applyExpGain expGained default 0건');
});
