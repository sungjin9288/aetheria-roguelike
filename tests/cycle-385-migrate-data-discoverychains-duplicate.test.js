import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 385: migrateData discoveryChains normalization 중복 1회 redundant 정리
 *   (cycle 222-384 silent dead config 시리즈 149번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant duplicate normalization):
 * - src/utils/gameUtils.ts migrateData에 동일한 discoveryChains 정규화가 2곳에 존재:
 *   · 라인 440 (cycle 120 영역): `target.stats.discoveryChains = Array.isArray(...) ? ... : []`
 *   · 라인 522 (v5.0 발견 체인 영역): 동일 코드 중복.
 * - 두 라인 모두 동일 함수 내 unconditional block — 첫 번째 라인이 이미 정규화 완료.
 *   두 번째 라인은 noop (`Array.isArray([]) ? [] : []`).
 * - cycle 120/131 회귀 가드 테스트는 첫 번째 라인의 정규화 결과만 검증 가능.
 *
 * 패턴 (cycle 222-384 silent dead config 시리즈 149번째):
 * - cycle 384: areaBossDefeated / deathSaveUsedCount 2 redundant.
 * - cycle 385: discoveryChains duplicate normalization 1 redundant
 *   (defensive fallback redundancy lens 변형 — duplicate detection).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 두 번째 (line 522) discoveryChains normalization 제거.
 *
 * 회귀 가드:
 * - 첫 번째 (line 440) discoveryChains normalization 보존 (cycle 120/131 회귀 가드).
 * - migrateData output `stats.discoveryChains === []` 동일 결과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 385: discoveryChains normalization 1회만 (중복 제거)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.discoveryChains = Array\.isArray/gm) || [];
    assert.equal(matches.length, 1,
        `discoveryChains normalization 1회만, 발견: ${matches.length}`);
});

test('cycle 385: migrateData 동작 보존 (cycle 120/131 회귀 가드)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // 1) 빈 stats → discoveryChains 빈 배열 default.
    const result1 = migrateData({
        player: { name: 'test', job: '모험가', stats: { kills: 0, total_gold: 0, deaths: 0 } }
    });
    assert.deepEqual(result1.player.stats.discoveryChains, [],
        '구버전 save → discoveryChains 빈 배열 default (cycle 120 회귀 가드)');
    // 2) inject 값 보존.
    const result2 = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: { kills: 0, total_gold: 0, deaths: 0, discoveryChains: ['fire_convergence'] }
        }
    });
    assert.deepEqual(result2.player.stats.discoveryChains, ['fire_convergence'],
        'discoveryChains inject 보존');
    // 3) 비배열 → 빈 배열로 정규화.
    const result3 = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: { kills: 0, total_gold: 0, deaths: 0, discoveryChains: 'invalid' }
        }
    });
    assert.deepEqual(result3.player.stats.discoveryChains, [],
        '비배열 → 빈 배열로 정규화 (cycle 120 회귀 가드)');
});

test('cycle 384 회귀 가드: areaBossDefeated / deathSaveUsedCount fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.areaBossDefeated = target\.stats\.areaBossDefeated/m.test(block),
        'cycle 384 areaBossDefeated fallback 0건 보존');
    assert.ok(!/^\s+target\.combatFlags\.deathSaveUsedCount = target\.combatFlags\.deathSaveUsedCount/m.test(block),
        'cycle 384 deathSaveUsedCount fallback 0건 보존');
});
