import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 379: migrateData claimedAchievements normalization 1회 redundant 정리
 *   (cycle 222-378 silent dead config 시리즈 144번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive normalization):
 * - src/utils/gameUtils.ts migrateData에 1 array normalization:
 *   · target.stats.claimedAchievements = Array.isArray(...) ? ... : [];
 * - 모든 consumer가 이미 fallback / Array.isArray 체크 처리:
 *   · AchievementPanel: `player?.stats?.claimedAchievements || []` ✓
 *   · useInventoryActions:366: `player.stats?.claimedAchievements || []` ✓
 *   · progressionHandlers:70: `Array.isArray(prevStats.claimedAchievements) ? : []` ✓
 * - cycle 212/216 회귀 가드 테스트는 inject 값 기반 assertion (post-ASCEND 보존),
 *   migrate output 검증 안 함.
 * - claimedQuestIds는 cycle 260 회귀 가드 테스트가 migrateData output 명시 검증으로
 *   fallback 보존 필수 (시도 후 발견된 가드).
 *
 * 패턴 (cycle 222-378 silent dead config 시리즈 144번째):
 * - cycle 378: migrateData 8 sub-field fallback 일괄 redundant.
 * - cycle 379: claimedAchievements normalization 1 redundant (동일 lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - claimedAchievements normalization 1 라인 제거.
 *
 * 회귀 가드:
 * - 모든 consumer Array.isArray / fallback 처리 동작 그대로.
 * - cycle 212/216 inject-based ASCEND preserve test 통과.
 * - cycle 260 claimedQuestIds normalization 보존 (테스트 회귀 가드).
 * - target.stats.visitedMaps 정규화는 직후 `.includes()` / `.push()` 직접 호출에
 *   필요해 보존.
 * - target.stats.exploreState 정규화는 spread 패턴으로 객체 보장에 필요해 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 379: claimedAchievements normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.claimedAchievements = Array\.isArray/m.test(block),
        'target.stats.claimedAchievements normalization 0건');
});

test('cycle 379: claimedQuestIds normalization 보존 (cycle 260 회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(/target\.stats\.claimedQuestIds = Array\.isArray/.test(block),
        'cycle 260 claimedQuestIds normalization 보존');
});

test('cycle 379: visitedMaps / exploreState 정규화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/target\.stats\.visitedMaps = Array\.isArray/.test(source),
        'visitedMaps 정규화 보존 (직후 .includes/.push 직접 호출 의존)');
    assert.ok(/target\.stats\.exploreState = \{ \.\.\.DEFAULT_EXPLORE_STATE/.test(source),
        'exploreState 정규화 보존 (spread 패턴)');
});

test('cycle 379: migrateData 동작 보존 (inject 배열 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                claimedAchievements: ['ach_test_1'],
                claimedQuestIds: [42, 99],
            }
        }
    });
    assert.deepEqual(result.player.stats.claimedAchievements, ['ach_test_1'],
        'claimedAchievements inject 보존');
    assert.deepEqual(result.player.stats.claimedQuestIds, [42, 99],
        'claimedQuestIds inject 보존 (cycle 260 가드)');
});

test('cycle 378 회귀 가드: 8 sub-field fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const fields = ['prestigeRank', 'relicCount', 'crafts', 'buildWins',
                    'abyssFloor', 'abyssRecord', 'demonKingSlain', 'dailyProtocol'];
    for (const field of fields) {
        const re = new RegExp(`^\\s+target\\.(meta|stats)\\.${field}\\s*=`, 'm');
        assert.ok(!re.test(block), `cycle 378 ${field} fallback 0건 보존`);
    }
});
