import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateData } from '../src/utils/gameUtils.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 131: save → migrate → ASCEND 통합 흐름 회귀 가드.
 *
 * cycle 119(ASCEND preserve) + 120(migrate default) + 121(INITIAL_STATE 선언)을
 * 한 번에 검증하는 end-to-end 시나리오. 각 사이클의 unit test는 각자의 layer만
 * 검증했으나, 실제 사용 흐름은 save 로드 → 게임 진행 → 환생까지 연결된다.
 *
 * 시나리오 1 (Legacy save + 진행 + 환생):
 *   1. cycle 74 이전의 구버전 save (escapes/syntheses/maxKillStreak/discoveryChains
 *      누락) 로드
 *   2. migrateData가 기본값(0/[]) 부여
 *   3. 게임 진행 중 카운터 누적 (시뮬레이션: stats 업데이트)
 *   4. ASCEND
 *   5. 환생 후에도 누적된 카운터 보존
 *
 * 시나리오 2 (신규 플레이어):
 *   1. INITIAL_STATE에 모든 카운터 declared
 *   2. 진행 → ASCEND
 *   3. 카운터 보존
 */

test('legacy save → migrate → 진행 → ASCEND 후 카운터 보존', () => {
    // 1. cycle 74 이전 save (영구 카운터 모두 누락)
    const legacySave = {
        version: 5.0,
        player: {
            name: '레거시 플레이어',
            gender: 'male',
            level: 50,
            meta: { prestigeRank: 0 },
            titles: [],
            stats: {
                kills: 500, bossKills: 8, deaths: 2, total_gold: 80000,
                relicCount: 12, abyssFloor: 25, demonKingSlain: 0,
                bountiesCompleted: 15, crafts: 30,
                // 누락: escapes, syntheses, maxKillStreak, discoveryChains
            },
            equip: {},
        },
    };

    // 2. migrate (cycle 120 default)
    const migrated = migrateData(legacySave);
    assert.equal(migrated.player.stats.escapes, 0, 'cycle 120 migrate default');
    assert.equal(migrated.player.stats.syntheses, 0);
    assert.equal(migrated.player.stats.maxKillStreak, 0);
    assert.deepEqual(migrated.player.stats.discoveryChains, []);

    // 3. 게임 진행 시뮬레이션 — 카운터 누적
    const inProgressState = {
        ...INITIAL_STATE,
        player: {
            ...migrated.player,
            stats: {
                ...migrated.player.stats,
                escapes: 5,
                syntheses: 3,
                maxKillStreak: 18,
                discoveryChains: ['fire_convergence'],
            },
        },
    };

    // 4. ASCEND (cycle 119 preserve)
    const afterAscend = gameReducer(inProgressState, {
        type: AT.ASCEND,
        payload: {
            meta: { ...inProgressState.player.meta, prestigeRank: 1 },
            newTitle: 'reborn',
        },
    });

    // 5. 환생 후 누적된 카운터 보존
    assert.equal(afterAscend.player.stats.escapes, 5, '환생 후 escapes 보존');
    assert.equal(afterAscend.player.stats.syntheses, 3);
    assert.equal(afterAscend.player.stats.maxKillStreak, 18);
    assert.deepEqual(afterAscend.player.stats.discoveryChains, ['fire_convergence']);
    // 기존 보존 카운터도 정상
    assert.equal(afterAscend.player.stats.kills, 500);
    assert.equal(afterAscend.player.stats.demonKingSlain, 1, 'demonKingSlain 증분');
});

test('신규 플레이어: INITIAL_STATE → 진행 → ASCEND', () => {
    // INITIAL_STATE는 cycle 121에서 discoveryChains: [] 추가됨.
    const stats = INITIAL_STATE.player.stats || {};
    assert.equal(stats.escapes, 0, 'cycle 74 INITIAL_STATE');
    assert.equal(stats.syntheses, 0, 'cycle 82 INITIAL_STATE');
    assert.equal(stats.maxKillStreak, 0, 'cycle 95 INITIAL_STATE');
    assert.deepEqual(stats.discoveryChains, [], 'cycle 121 INITIAL_STATE');

    // 진행 후 ASCEND
    const inProgressState = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            level: 50,
            stats: {
                ...stats,
                kills: 100,
                escapes: 7,
                maxKillStreak: 22,
                discoveryChains: ['fire_convergence', 'frozen_truth'],
            },
        },
    };

    const afterAscend = gameReducer(inProgressState, {
        type: AT.ASCEND,
        payload: { meta: { prestigeRank: 1 }, newTitle: 'reborn' },
    });

    assert.equal(afterAscend.player.stats.escapes, 7);
    assert.equal(afterAscend.player.stats.maxKillStreak, 22);
    assert.deepEqual(afterAscend.player.stats.discoveryChains, ['fire_convergence', 'frozen_truth']);
});

test('연속 ASCEND: 두 번 환생해도 카운터 보존 (regression — preserve 자체 회귀 방지)', () => {
    let state = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            level: 50,
            stats: {
                ...INITIAL_STATE.player.stats,
                escapes: 10,
                maxKillStreak: 30,
                discoveryChains: ['fire_convergence'],
            },
        },
    };

    // 첫 번째 ASCEND
    state = gameReducer(state, {
        type: AT.ASCEND,
        payload: { meta: { prestigeRank: 1 }, newTitle: 'reborn' },
    });
    assert.equal(state.player.stats.escapes, 10);
    assert.equal(state.player.stats.maxKillStreak, 30);

    // 두 번째 ASCEND (변화 없이 바로 환생)
    state = gameReducer(state, {
        type: AT.ASCEND,
        payload: { meta: { prestigeRank: 2 }, newTitle: 'transcendent' },
    });
    assert.equal(state.player.stats.escapes, 10, '연속 환생 후에도 보존');
    assert.equal(state.player.stats.maxKillStreak, 30);
    assert.equal(state.player.stats.demonKingSlain, 2, '연속 환생마다 +1');
});
