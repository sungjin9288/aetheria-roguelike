import test from 'node:test';
import assert from 'node:assert/strict';

import { syncQuestProgress } from '../src/utils/questProgress.js';

test('quest progress syncs build-guiding and discovery quests from player stats', () => {
    const player = {
        level: 12,
        stats: {
            explores: 8,
            crafts: 1,
            lowHpWins: 0,
            bountiesCompleted: 0,
            discoveries: 5,
            buildWins: {
                crusher: 3,
                arcane: 1,
            },
        },
        quests: [
            { id: 68, progress: 0 },
            { id: 72, progress: 0 },
        ],
    };

    const result = syncQuestProgress(player);

    assert.equal(result.updatedQuests.find((quest) => quest.id === 68)?.progress, 3);
    assert.equal(result.updatedQuests.find((quest) => quest.id === 72)?.progress, 5);
});

test('quest progress derives low-hp survival counts from recent battle history thresholds', () => {
    const player = {
        level: 30,
        stats: {
            recentBattles: [
                { result: 'win', hpRatio: 0.18 },
                { result: 'win', hpRatio: 0.09 },
                { result: 'win', hpRatio: 0.52 },
                { result: 'death', hpRatio: 0 },
            ],
        },
        quests: [
            { id: 62, progress: 0 },
            { id: 63, progress: 0 },
        ],
    };

    const result = syncQuestProgress(player);

    assert.equal(result.updatedQuests.find((quest) => quest.id === 62)?.progress, 2);
    assert.equal(result.updatedQuests.find((quest) => quest.id === 63)?.progress, 1);
});
