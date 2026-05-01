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

// cycle 63: signature_collect 퀘스트 진행도 — codex 항목 수로 근사.
test('quest progress syncs signature_collect from codex entries', () => {
    const player = {
        level: 50,
        stats: {
            codex: {
                weapons: { '낙뢰의 검': true, '심연검': true, '화염검': true },
                armors: { '용골 갑주': true },
                shields: { '수호 방패': true, '심해 방패': true },
            },
        },
        quests: [
            { id: 202, progress: 0 },
        ],
    };

    const result = syncQuestProgress(player);

    // 6개 codex 항목 → goal=15에 대해 progress=6
    assert.equal(result.updatedQuests.find((quest) => quest.id === 202)?.progress, 6);
});

test('quest progress signature_collect caps at goal', () => {
    const codex = { weapons: {}, armors: {}, shields: {} };
    // 20개 가짜 entry 생성
    for (let i = 0; i < 20; i++) codex.weapons[`전설 무기 ${i}`] = true;
    const player = {
        level: 50,
        stats: { codex },
        quests: [{ id: 202, progress: 0 }],
    };

    const result = syncQuestProgress(player);

    // 20 항목이지만 goal=15에서 cap
    assert.equal(result.updatedQuests.find((quest) => quest.id === 202)?.progress, 15);
});
