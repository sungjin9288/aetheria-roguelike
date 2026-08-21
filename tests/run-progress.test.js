import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';
import { buildRunSummary, migrateData } from '../src/utils/gameUtils.js';
import {
    createCurrentRunProgress,
    getCurrentRunSnapshot,
    normalizeCurrentRunProgress,
    recordCurrentRunMaxKillStreak,
} from '../src/utils/runProgress.js';

test('current run snapshot separates this attempt from lifetime counters', () => {
    const baselineStats = {
        kills: 120,
        bossKills: 7,
        total_gold: 32000,
        escapes: 4,
        visitedMaps: ['시작의 마을', '고요한 숲'],
    };
    const currentRun = createCurrentRunProgress(baselineStats, { startedAt: 1000 });
    const snapshot = getCurrentRunSnapshot({
        ...baselineStats,
        kills: 131,
        bossKills: 8,
        total_gold: 33750,
        escapes: 6,
        visitedMaps: ['시작의 마을', '고요한 숲', '신성한 호수', '잊혀진 폐허'],
        currentRun: { ...currentRun, maxKillStreak: 6 },
    });

    assert.deepEqual(snapshot, {
        complete: true,
        kills: 11,
        bossKills: 1,
        totalGold: 1750,
        escapes: 2,
        discoveries: 2,
        maxKillStreak: 6,
    });
});

test('legacy saves begin a partial run baseline instead of reporting lifetime totals as one run', () => {
    const stats = {
        kills: 420,
        bossKills: 19,
        total_gold: 88000,
        escapes: 12,
        visitedMaps: ['시작의 마을', '고요한 숲', '신성한 호수'],
    };
    const currentRun = normalizeCurrentRunProgress(stats);
    const snapshot = getCurrentRunSnapshot({ ...stats, currentRun });

    assert.equal(currentRun.complete, false);
    assert.equal(snapshot.kills, 0);
    assert.equal(snapshot.bossKills, 0);
    assert.equal(snapshot.totalGold, 0);
    assert.equal(snapshot.escapes, 0);
    assert.equal(snapshot.discoveries, 0);
});

test('current run max streak updates independently from lifetime max streak', () => {
    const stats = {
        maxKillStreak: 24,
        currentRun: createCurrentRunProgress({}, { startedAt: 1000 }),
    };
    const updated = recordCurrentRunMaxKillStreak(stats, 5);

    assert.equal(updated.maxKillStreak, 24);
    assert.equal(updated.currentRun.maxKillStreak, 5);
});

test('buildRunSummary reports current run deltas and tracking completeness', () => {
    const baselineStats = {
        kills: 50,
        bossKills: 2,
        total_gold: 10000,
        escapes: 1,
        visitedMaps: ['시작의 마을'],
    };
    const player = {
        ...INITIAL_STATE.player,
        level: 8,
        stats: {
            ...INITIAL_STATE.player.stats,
            ...baselineStats,
            kills: 57,
            bossKills: 3,
            total_gold: 11200,
            escapes: 2,
            visitedMaps: ['시작의 마을', '고요한 숲'],
            currentRun: {
                ...createCurrentRunProgress(baselineStats, { startedAt: 1000 }),
                maxKillStreak: 4,
            },
        },
    };

    const summary = buildRunSummary(player, '고요한 숲');
    assert.equal(summary.kills, 7);
    assert.equal(summary.bossKills, 1);
    assert.equal(summary.totalGold, 1200);
    assert.equal(summary.escapes, 1);
    assert.equal(summary.discoveries, 1);
    assert.equal(summary.maxKillStreak, 4);
    assert.equal(summary.runTrackingComplete, true);
});

test('migrateData preserves an existing run baseline and marks a missing baseline partial', () => {
    const existing = createCurrentRunProgress({ kills: 10 }, { startedAt: 1000 });
    const migratedExisting = migrateData({
        version: 5,
        player: { equip: {}, stats: { kills: 14, currentRun: existing } },
    });
    assert.deepEqual(migratedExisting.player.stats.currentRun, existing);

    const migratedLegacy = migrateData({
        version: 5,
        player: { equip: {}, stats: { kills: 14, total_gold: 500 } },
    });
    assert.equal(migratedLegacy.player.stats.currentRun.complete, false);
    assert.equal(migratedLegacy.player.stats.currentRun.killsAtStart, 14);
    assert.equal(migratedLegacy.player.stats.currentRun.totalGoldAtStart, 500);
});

test('RESET_GAME keeps lifetime counters and starts a fresh complete run baseline', () => {
    const state = {
        ...INITIAL_STATE,
        gameState: 'ascension',
        player: {
            ...INITIAL_STATE.player,
            stats: {
                ...INITIAL_STATE.player.stats,
                kills: 88,
                bossKills: 5,
                total_gold: 22000,
                escapes: 3,
                visitedMaps: ['시작의 마을', '고요한 숲'],
            },
        },
    };
    const reset = gameReducer(state, { type: AT.RESET_GAME });

    assert.equal(reset.player.stats.kills, 88);
    assert.equal(reset.player.stats.currentRun.complete, true);
    assert.equal(reset.player.stats.currentRun.killsAtStart, 88);
    assert.equal(reset.player.stats.currentRun.bossKillsAtStart, 5);
    assert.equal(reset.player.stats.currentRun.totalGoldAtStart, 22000);
    assert.equal(reset.player.stats.currentRun.escapesAtStart, 3);
    assert.deepEqual(reset.player.stats.currentRun.visitedMapsAtStart, ['시작의 마을', '고요한 숲']);
    assert.equal(reset.player.stats.currentRun.maxKillStreak, 0);
});

test('ASCEND starts the next attempt from preserved lifetime counters', () => {
    const state = {
        ...INITIAL_STATE,
        gameState: 'ascension',
        player: {
            ...INITIAL_STATE.player,
            stats: {
                ...INITIAL_STATE.player.stats,
                kills: 210,
                bossKills: 14,
                total_gold: 76000,
                escapes: 8,
                visitedMaps: ['시작의 마을', '고요한 숲', '신성한 호수'],
            },
        },
    };
    const ascended = gameReducer(state, {
        type: AT.ASCEND,
        payload: { expectedPrestigeRank: 0, sourceReceiptKey: null },
    });

    assert.equal(ascended.player.stats.currentRun.complete, true);
    assert.equal(ascended.player.stats.currentRun.killsAtStart, 210);
    assert.equal(ascended.player.stats.currentRun.bossKillsAtStart, 14);
    assert.equal(ascended.player.stats.currentRun.totalGoldAtStart, 76000);
    assert.equal(ascended.player.stats.currentRun.escapesAtStart, 8);
    assert.deepEqual(ascended.player.stats.currentRun.visitedMapsAtStart, ['시작의 마을', '고요한 숲', '신성한 호수']);
    assert.equal(ascended.player.stats.currentRun.maxKillStreak, 0);
});
