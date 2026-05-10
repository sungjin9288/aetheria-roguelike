import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 623: countLowHpWins threshold 0.2 explicit default-elimination
 *   (cycle 222-622 silent dead config 시리즈 361번째 — explicit
 *   default-elimination pattern 14번째 적용, cycle 619 변형 패턴 3번째).
 *
 * 발견 (default 이미 unreachable, signature 정리):
 * - src/systems/DifficultyManager.ts:149:
 *     export const countLowHpWins = (stats: any, threshold: any = 0.2) => {...}
 * - 호출 사이트 모두 명시 인자 전달:
 *     · questProgress.ts:44 — countLowHpWins(player.stats, questData.threshold || 0.2).
 *     · runProfile.ts:161 — countLowHpWins(player?.stats, 0.2).
 *     · runProfile.ts:212 — countLowHpWins(behaviorStats, 0.2).
 * - default 0.2 이미 도달 불가.
 *
 * 패턴 (cycle 222-622 시리즈 361번째):
 * - cycle 502-622: default 청소 메가 시리즈 118사이클.
 * - cycle 623: explicit default-elimination 14번째 (cycle 619/622에 이은
 *   변형 패턴 3번째 — caller 모두 이미 명시 상태).
 *
 * 수정:
 * - DifficultyManager.ts:149 — threshold default 0.2 제거.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로 (이미 명시).
 * - body recentBattles filter + lowHpWins fallback 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 623: countLowHpWins signature에서 threshold default 0.2 0건', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    assert.ok(!/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\s*=\s*0\.2\)/.test(source),
        'countLowHpWins threshold default 0.2 제거');
    assert.ok(/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\)/.test(source),
        'countLowHpWins threshold 파라미터 보존 (default 없이)');
});

test('cycle 623: 3 callsite threshold 명시 보존', async () => {
    const qp = await readSrc('src/utils/questProgress.ts');
    assert.ok(/countLowHpWins\(player\.stats,\s*questData\.threshold\s*\|\|\s*0\.2\)/.test(qp),
        "questProgress callsite 'questData.threshold || 0.2' 보존");

    const rp = await readSrc('src/utils/runProfile.ts');
    const matches = (rp.match(/countLowHpWins\([^,]+,\s*0\.2\)/g) || []).length;
    assert.equal(matches, 2, 'runProfile callsite 0.2 명시 2건 보존');
});

test('cycle 623: countLowHpWins body recentBattles filter 보존', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    assert.ok(/battle\.hpRatio\s*<=\s*threshold/.test(source),
        'recentBattles filter threshold 비교 보존');
    assert.ok(/return stats\?\.lowHpWins \|\| 0/.test(source),
        'fallback lowHpWins 처리 보존');
});

test('cycle 623: cycle 502-622 회귀 가드 — default 청소 시리즈 보존', async () => {
    const lt = await readSrc('src/systems/LatencyTracker.ts');
    assert.ok(!/async trackCall\([^)]*callType:\s*any\s*=\s*'ai'\)/.test(lt),
        "cycle 622 trackCall callType default 0건");
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const signedDelta = \([^)]*suffix:\s*any\s*=\s*''\)/.test(sp),
        "cycle 621 signedDelta suffix default 0건");
});
