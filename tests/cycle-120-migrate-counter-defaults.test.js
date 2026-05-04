import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateData } from '../src/utils/gameUtils.js';

/**
 * cycle 120: migrateData stats counter 기본값 정리.
 *
 * 발견:
 * - cycle 84에서 discoveries 필드를 INITIAL_STATE에서 제거했으나, migrateData
 *   line 403에 `target.stats.discoveries = target.stats.discoveries || 0`이
 *   잔존 (dead code).
 * - cycle 74(escapes), 82(syntheses), 95(maxKillStreak), 102(discoveryChains)에서
 *   추가된 영구 카운터들은 migrateData에 default 처리 누락. 구버전 save에서
 *   이 필드가 undefined로 로드되면 reads는 `|| 0` 또는 `|| []`로 안전하지만,
 *   migrate 단계에서 정합성 보장이 약함 (cycle 119에서 ASCEND preserve 추가
 *   후엔 더 명확히 필요).
 *
 * 수정:
 * 1. dead `discoveries` migrate 라인 제거 (cycle 84 후속 cleanup).
 * 2. 신규 카운터 default 추가:
 *    - escapes (number) → 0
 *    - syntheses (number) → 0
 *    - maxKillStreak (number) → 0
 *    - discoveryChains (array) → []
 *
 * Firebase save에 잔존하는 stats.discoveries 필드는 무시됨 (forward-compatible).
 */

test('migrateData: 구버전 save (escapes/syntheses/maxKillStreak/discoveryChains 누락) → 0/[] 기본값', () => {
    const oldSave = {
        version: 5.0,
        player: {
            name: '구플레이어',
            stats: {
                kills: 100, deaths: 1, total_gold: 5000,
                bossKills: 2, rests: 5,
                // 명시적으로 escapes/syntheses/maxKillStreak/discoveryChains 누락
            },
            equip: {},
        },
    };
    const migrated = migrateData(oldSave);
    const stats = migrated.player.stats;
    assert.equal(stats.escapes, 0, 'escapes default 0');
    assert.equal(stats.syntheses, 0, 'syntheses default 0');
    assert.equal(stats.maxKillStreak, 0, 'maxKillStreak default 0');
    assert.deepEqual(stats.discoveryChains, [], 'discoveryChains default []');
});

test('migrateData: 기존 카운터 값 보존 (회귀 가드)', () => {
    const oldSave = {
        version: 5.0,
        player: {
            name: '플레이어',
            stats: {
                kills: 250, escapes: 12, syntheses: 30, maxKillStreak: 18,
                discoveryChains: ['fire_convergence'],
            },
            equip: {},
        },
    };
    const migrated = migrateData(oldSave);
    const stats = migrated.player.stats;
    assert.equal(stats.escapes, 12);
    assert.equal(stats.syntheses, 30);
    assert.equal(stats.maxKillStreak, 18);
    assert.deepEqual(stats.discoveryChains, ['fire_convergence']);
});

test('migrateData: dead "discoveries" migrate 라인 제거됨', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const source = await readFile(path.join(ROOT, 'src/utils/gameUtils.ts'), 'utf8');
    // cycle 84에서 INITIAL_STATE.discoveries를 제거한 후속 cleanup.
    assert.doesNotMatch(
        source,
        /target\.stats\.discoveries\s*=\s*target\.stats\.discoveries\s*\|\|\s*0/,
        'dead discoveries migrate line should be removed'
    );
});

test('migrateData: discoveryChains이 배열이 아닌 경우 → 빈 배열 fallback', () => {
    const oldSave = {
        version: 5.0,
        player: {
            name: '손상',
            stats: { kills: 10, discoveryChains: 'not-an-array' },
            equip: {},
        },
    };
    const migrated = migrateData(oldSave);
    assert.deepEqual(migrated.player.stats.discoveryChains, []);
});
