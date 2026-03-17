import test from 'node:test';
import assert from 'node:assert/strict';

import { getAdventureGuidance, getExplorationForecast, getMoveRecommendations, getQuestTracker } from '../src/utils/adventureGuide.js';

test('quest tracker prioritizes claimable rewards', () => {
    const player = {
        quests: [
            {
                id: 1,
                progress: 5,
                isBounty: false,
            }
        ],
    };

    const tracker = getQuestTracker(player);

    assert.equal(tracker.kind, 'claimable');
    assert.equal(tracker.progressLabel, '보상 대기');
});

test('adventure guidance recommends rest in town when hp is low', () => {
    const player = {
        hp: 58,
        maxHp: 150,
        mp: 22,
        maxMp: 50,
        gold: 200,
        job: '모험가',
        level: 3,
        inv: [],
        quests: [],
        stats: { exploreState: { sinceNarrativeEvent: 0, sinceDiscovery: 0, sinceRelic: 0, quietStreak: 0 } },
    };

    const guidance = getAdventureGuidance(player, { maxHp: 150, maxMp: 50 }, { type: 'safe' }, 'idle');

    assert.equal(guidance.primaryAction.kind, 'rest');
    assert.ok(guidance.detail.includes('휴식'));
});

test('exploration forecast marks boss zones clearly', () => {
    const player = {
        stats: {
            exploreState: {
                sinceNarrativeEvent: 6,
                sinceDiscovery: 3,
                sinceRelic: 4,
                quietStreak: 1,
            }
        }
    };

    const forecast = getExplorationForecast(player, {
        type: 'dungeon',
        level: 30,
        eventChance: 0.28,
        boss: true,
    });

    assert.equal(forecast.mood, '보스 전조');
    assert.ok(forecast.chips.some((chip) => chip.label === 'EVENT'));
    assert.ok(forecast.chips.some((chip) => chip.label === 'TEMPO'));
});

test('move recommendations prioritize safe exits when hp is low', () => {
    const player = {
        hp: 40,
        maxHp: 150,
        mp: 18,
        maxMp: 50,
        level: 6,
        loc: '잊혀진 폐허',
        inv: [],
        stats: {
            visitedMaps: ['시작의 마을', '고요한 숲', '잊혀진 폐허'],
            exploreState: { sinceNarrativeEvent: 2, sinceDiscovery: 2, sinceRelic: 2, quietStreak: 0 },
        },
    };

    const routes = getMoveRecommendations(player, { maxHp: 150, maxMp: 50 }, {
        exits: ['시작의 마을', '어둠의 동굴'],
    }, {
        '시작의 마을': { type: 'safe', level: 1, eventChance: 0 },
        '어둠의 동굴': { type: 'dungeon', level: 10, eventChance: 0.22 },
    });

    assert.equal(routes[0].name, '시작의 마을');
    assert.equal(routes[0].badge, '정비');
});

test('move recommendations favor level-fit unexplored routes when stable', () => {
    const player = {
        hp: 142,
        maxHp: 150,
        mp: 48,
        maxMp: 50,
        level: 8,
        loc: '잊혀진 폐허',
        inv: ['하급 체력 물약'],
        stats: {
            visitedMaps: ['시작의 마을', '고요한 숲', '잊혀진 폐허'],
            exploreState: { sinceNarrativeEvent: 4, sinceDiscovery: 4, sinceRelic: 2, quietStreak: 1 },
        },
    };

    const routes = getMoveRecommendations(player, { maxHp: 150, maxMp: 50 }, {
        exits: ['시작의 마을', '버려진 광산', '어둠의 동굴'],
    }, {
        '시작의 마을': { type: 'safe', level: 1, eventChance: 0 },
        '버려진 광산': { type: 'dungeon', level: 8, eventChance: 0.2 },
        '어둠의 동굴': { type: 'dungeon', level: 10, eventChance: 0.22 },
    });

    assert.equal(routes[0].name, '버려진 광산');
    assert.equal(routes[0].isRecommended, true);
    assert.equal(routes[0].badge, '개척');
});
