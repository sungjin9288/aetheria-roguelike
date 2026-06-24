import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 378: migrateData stats/meta sub-field fallback 8회 redundant 일괄 정리
 *   (cycle 222-377 silent dead config 시리즈 143번째 — cleanup lens 연속).
 *
 * 발견 (8 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 8 sub-field fallback lines:
 *   · target.meta.prestigeRank = target.meta.prestigeRank || 0;
 *   · target.stats.relicCount = target.stats.relicCount || 0;
 *   · target.stats.crafts = target.stats.crafts || 0;
 *   · target.stats.buildWins = ... ? : {};
 *   · target.stats.abyssFloor = target.stats.abyssFloor || 0;
 *   · target.stats.abyssRecord = target.stats.abyssRecord || 0;
 *   · target.stats.demonKingSlain = target.stats.demonKingSlain || 0;
 *   · target.stats.dailyProtocol = target.stats.dailyProtocol || null;
 * - 모든 8 필드 consumer가 이미 fallback / optional chain 처리:
 *   · prestigeRank: 5곳 모두 `|| 0` / `?? 0` fallback.
 *   · relicCount/crafts/abyssFloor: 5곳 fallback + ascensionActions 직접 read는
 *     checkTitles `|| 0` fallback으로 안전.
 *   · abyssRecord/demonKingSlain: 5곳 모두 fallback.
 *   · buildWins: optional chain 안전 (`?.buildWins?.[target] || 0`).
 *   · dailyProtocol: `?.missions` optional chain 안전.
 * - cycle 120/131 회귀 가드 테스트는 escapes/syntheses/maxKillStreak/discoveryChains
 *   4 필드만 migrate output 검증, 본 batch 8 필드는 inject-based 또는 미assert.
 *
 * 패턴 (cycle 222-377 silent dead config 시리즈 143번째):
 * - cycle 377: migrateData stats.rests / bountiesCompleted 2 redundant.
 * - cycle 378: migrateData 8 sub-field fallback 일괄 정리 (가장 큰 batch).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 8 redundant fallback lines 일괄 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback 동작 그대로.
 * - cycle 120/131 (escapes/syntheses/maxKillStreak/discoveryChains) fallback 보존.
 * - cycle 119 inject-based ASCEND preserve test 통과.
 * - 기타 stats.kills/total_gold/deaths/bossKills/killRegistry 객체 자체 init 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 378: 8 redundant fallback lines 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const fields = ['prestigeRank', 'relicCount', 'crafts', 'buildWins',
                    'abyssFloor', 'abyssRecord', 'demonKingSlain', 'dailyProtocol'];
    for (const field of fields) {
        const re = new RegExp(`^\\s+target\\.(meta|stats)\\.${field}\\s*=`, 'm');
        assert.ok(!re.test(block), `${field} fallback 0건`);
    }
});

test('cycle 378: 보존 fallback 검증 (escapes/syntheses/maxKillStreak/discoveryChains)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    // cycle 120/131 회귀 가드 — 이 4 필드는 migrate fallback 보존 필수.
    const guardedFields = ['escapes', 'syntheses', 'maxKillStreak', 'discoveryChains'];
    for (const field of guardedFields) {
        const re = new RegExp(`target\\.stats\\.${field}\\s*=`, 'm');
        assert.ok(re.test(block), `${field} fallback 보존 (cycle 120/131 가드)`);
    }
});

test('cycle 378: migrateData 동작 보존 (inject 값 → 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            meta: { prestigeRank: 3 },
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                relicCount: 5, crafts: 8, abyssFloor: 30, abyssRecord: 50,
                demonKingSlain: 2,
            }
        }
    });
    assert.equal(result.player.meta.prestigeRank, 3, 'prestigeRank inject 값 보존');
    assert.equal(result.player.stats.relicCount, 5, 'relicCount inject 값 보존');
    assert.equal(result.player.stats.crafts, 8, 'crafts inject 값 보존');
    assert.equal(result.player.stats.abyssFloor, 30, 'abyssFloor inject 값 보존');
    assert.equal(result.player.stats.abyssRecord, 50, 'abyssRecord inject 값 보존');
    assert.equal(result.player.stats.demonKingSlain, 2, 'demonKingSlain inject 값 보존');
});

test('cycle 377 회귀 가드: rests / bountiesCompleted unconditional fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const restsMatches = block.match(/^\s+target\.stats\.rests = target\.stats\.rests \|\| 0/gm) || [];
    assert.equal(restsMatches.length, 1, 'cycle 377 unconditional rests 0건 (legacy v3.1만 1)');
    const bountiesMatches = block.match(/^\s+target\.stats\.bountiesCompleted = target\.stats\.bountiesCompleted/gm) || [];
    assert.equal(bountiesMatches.length, 0, 'cycle 377 bountiesCompleted 0건 보존');
});
