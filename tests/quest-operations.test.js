import test from 'node:test';
import assert from 'node:assert/strict';

import { getAdventureGuidance } from '../src/utils/adventureGuide.js';
import { getQuestBoardRecommendations } from '../src/utils/questOperations.js';

test('quest board surfaces story and build operations for a fresh run', () => {
    const player = {
        job: '전사',
        level: 8,
        loc: '시작의 마을',
        hp: 180,
        maxHp: 180,
        mp: 32,
        maxMp: 32,
        quests: [],
        relics: [{ effect: 'execute_bonus' }],
        equip: {
            weapon: { type: 'weapon', name: '양손검', val: 22, hands: 2, elem: '물리' },
            offhand: null,
        },
        stats: {
            crafts: 0,
            bountiesCompleted: 0,
            visitedMaps: ['시작의 마을', '고요한 숲', '잊혀진 폐허'],
        },
    };

    const board = getQuestBoardRecommendations(player);
    const featuredIds = board.featured.map((entry) => entry.quest.id);
    const featuredLanes = board.featured.map((entry) => entry.lane);

    assert.equal(board.featured[0].lane, 'story');
    assert.ok(featuredLanes.includes('build'));
    assert.ok(featuredIds.includes(68));
    assert.ok(board.featured.some((entry) => entry.quest.title.includes('[스토리]')));
});

test('adventure guidance references the top recommended operation when no quest is active', () => {
    const player = {
        job: '모험가',
        level: 4,
        loc: '시작의 마을',
        hp: 140,
        maxHp: 140,
        mp: 40,
        maxMp: 40,
        quests: [],
        relics: [],
        equip: {
            weapon: { type: 'weapon', name: '낡은 검', val: 8, hands: 1, elem: '물리' },
            offhand: null,
        },
        inv: [],
        stats: {
            crafts: 0,
            bountiesCompleted: 0,
            visitedMaps: ['시작의 마을'],
            exploreState: { sinceNarrativeEvent: 0, sinceDiscovery: 0, sinceRelic: 0, quietStreak: 0 },
        },
    };

    const board = getQuestBoardRecommendations(player);
    const guidance = getAdventureGuidance(player, { maxHp: 140, maxMp: 40 }, { type: 'safe' }, 'idle');

    assert.equal(guidance.primaryAction.kind, 'open_quest_board');
    assert.ok(guidance.detail.includes(board.featured[0].quest.title));
});
