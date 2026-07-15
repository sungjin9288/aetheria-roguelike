import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getAdventureGuidance, getQuestTracker } from '../src/utils/adventureGuide.js';
import { getQuestBoardRecommendations } from '../src/utils/questOperations.js';
import { createQuestActions } from '../src/hooks/gameActions/questActions.js';
import { MAPS } from '../src/data/maps.js';
import { MSG } from '../src/data/messages.js';
import { QUESTS } from '../src/data/quests.js';

const SYSTEM_QUEST_TARGETS = new Set([
    'Level', 'level', 'kills', 'explores', 'deaths', 'rests', 'crafts', 'synths',
    'bossKills', 'bountiesCompleted', 'discoveries', 'discoveryChains',
    'maxKillStreak', 'prestige', 'relicCount', 'abyssRecord', 'demonKingSlain',
    'escapes', 'signaturesDiscovered', 'signatureSetsCompleted', 'total_gold',
    'arcane', 'crusher', 'dual', 'fortress', 'lowHpWins',
]);

const getMapSpawnPool = (map) => new Set([
    ...(map.monsters || []),
    ...(map.bossMonsters || []),
    ...(typeof map.boss === 'string' ? [map.boss] : []),
]);

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

test('quest board does not offer static quests that already paid their reward', () => {
    const player = {
        job: '모험가',
        level: 1,
        loc: '시작의 마을',
        hp: 178,
        maxHp: 178,
        mp: 52,
        maxMp: 52,
        quests: [],
        relics: [],
        equip: { weapon: null, offhand: null },
        inv: [],
        stats: {
            claimedQuestIds: [80, 81],
            crafts: 0,
            bountiesCompleted: 0,
            visitedMaps: ['시작의 마을', '고요한 숲'],
        },
    };

    const board = getQuestBoardRecommendations(player);
    const visibleIds = [
        ...board.featured.map((entry) => entry.quest.id),
        ...board.backlog.map((entry) => entry.quest.id),
        ...board.locked.map((quest) => quest.id),
    ];

    assert.ok(!visibleIds.includes(80));
    assert.ok(!visibleIds.includes(81));
});

test('story missions unlock one chapter at a time even for a high-level player', () => {
    const player = {
        job: '모험가',
        level: 50,
        loc: '시작의 마을',
        hp: 500,
        maxHp: 500,
        mp: 200,
        maxMp: 200,
        quests: [],
        relics: [],
        equip: { weapon: null, offhand: null },
        inv: [],
        stats: {
            claimedQuestIds: [],
            crafts: 0,
            bountiesCompleted: 0,
            visitedMaps: ['시작의 마을'],
        },
    };

    const board = getQuestBoardRecommendations(player);
    const availableStoryIds = [...board.featured, ...board.backlog]
        .filter((entry) => entry.lane === 'story')
        .map((entry) => entry.quest.id);

    assert.deepEqual(availableStoryIds, [80]);
    assert.equal(board.featured[0].quest.id, 80);
    assert.ok(board.locked.some((quest) => quest.id === 81 && quest.lockLabel === '선행 이야기 필요'));
});

test('story mission data keeps the intended chapter sequence explicit', () => {
    const storySequence = [80, 81, 82, 84, 83, 85, 86, 87];
    const storyQuests = new Map(QUESTS.map((quest) => [quest.id, quest]));

    assert.equal(storyQuests.get(storySequence[0]).prerequisiteQuestId, undefined);
    for (let index = 1; index < storySequence.length; index += 1) {
        assert.equal(
            storyQuests.get(storySequence[index]).prerequisiteQuestId,
            storySequence[index - 1],
            `story quest ${storySequence[index]} should follow ${storySequence[index - 1]}`,
        );
    }
});

test('location exploration missions declare exact destinations and surface them as routes', () => {
    const expectedLocations = new Map([
        [80, '고요한 숲'],
        [81, '잊혀진 폐허'],
        [152, '에테르 폐허'],
        [153, '공허의 회랑'],
    ]);
    for (const [questId, location] of expectedLocations) {
        assert.equal(QUESTS.find((quest) => quest.id === questId)?.location, location);
    }

    const player = {
        job: '모험가', level: 5, loc: '시작의 마을', hp: 200, maxHp: 200,
        mp: 80, maxMp: 80, quests: [], relics: [], inv: [],
        equip: { weapon: null, offhand: null },
        stats: { claimedQuestIds: [80], exploresByLocation: {}, visitedMaps: ['시작의 마을'] },
    };
    const board = getQuestBoardRecommendations(player);
    const ruinsStory = [...board.featured, ...board.backlog]
        .find((entry) => entry.quest.id === 81);

    assert.deepEqual(ruinsStory.targetMaps, ['잊혀진 폐허']);
    assert.equal(ruinsStory.brief.route, '잊혀진 폐허');
    assert.equal(ruinsStory.planSteps[2].value, '잊혀진 폐허 진입');
});

test('location quests match an existing map, its spawn pool, and its entry level', () => {
    for (const quest of QUESTS.filter((entry) => entry.location)) {
        const map = MAPS[quest.location];
        assert.ok(map, `quest ${quest.id} location '${quest.location}' should exist`);

        if (!SYSTEM_QUEST_TARGETS.has(quest.target)) {
            assert.ok(
                getMapSpawnPool(map).has(quest.target),
                `quest ${quest.id} target '${quest.target}' should spawn in '${quest.location}'`,
            );
        }

        if (Number.isFinite(map.level)) {
            assert.ok(
                quest.minLv >= map.level,
                `quest ${quest.id} minLv ${quest.minLv} should reach '${quest.location}' at Lv${map.level}`,
            );
        }
    }
});

test('monster quest copy names the actual target', () => {
    for (const quest of QUESTS.filter((entry) => !SYSTEM_QUEST_TARGETS.has(entry.target))) {
        assert.ok(
            `${quest.title} ${quest.desc}`.includes(quest.target),
            `quest ${quest.id} copy should name target '${quest.target}'`,
        );
    }
});

test('quest descriptions that name a map use the same destination', () => {
    for (const quest of QUESTS) {
        const namedMaps = Object.keys(MAPS).filter((mapName) => quest.desc.includes(mapName));
        for (const mapName of namedMaps) {
            assert.equal(
                quest.location,
                mapName,
                `quest ${quest.id} description and destination should agree`,
            );
        }
    }
});

test('quest acceptance records the current destination exploration count as its baseline', () => {
    let updatedPlayer;
    const player = {
        level: 5,
        loc: '시작의 마을',
        quests: [],
        stats: { claimedQuestIds: [80], exploresByLocation: { '잊혀진 폐허': 6 } },
    };
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: (action) => {
            updatedPlayer = typeof action.payload === 'function' ? action.payload(player) : action.payload;
        },
        addLog: () => {},
    }, { emitUnlockedTitles: () => {} });

    actions.acceptQuest(81);

    assert.deepEqual(updatedPlayer.quests, [{ id: 81, progress: 0, startExploreCount: 6 }]);
});

test('active location exploration guidance names the destination and remaining attempts', () => {
    const tracker = getQuestTracker({
        level: 5,
        loc: '고요한 숲',
        quests: [{ id: 81, progress: 4, startExploreCount: 0 }],
        stats: { exploresByLocation: { '잊혀진 폐허': 4 } },
    });

    assert.equal(tracker.routeLabel, '잊혀진 폐허');
    assert.equal(tracker.nextStep, '잊혀진 폐허에서 탐험 6회 진행');
});

test('the next story chapter unlocks only after its prerequisite reward was claimed', () => {
    const player = {
        job: '모험가', level: 50, loc: '시작의 마을', hp: 500, maxHp: 500,
        mp: 200, maxMp: 200, quests: [], relics: [], inv: [],
        equip: { weapon: null, offhand: null },
        stats: { claimedQuestIds: [80], crafts: 0, bountiesCompleted: 0, visitedMaps: ['시작의 마을'] },
    };

    const board = getQuestBoardRecommendations(player);
    const availableStoryIds = [...board.featured, ...board.backlog]
        .filter((entry) => entry.lane === 'story')
        .map((entry) => entry.quest.id);

    assert.deepEqual(availableStoryIds, [81]);
    assert.ok(board.locked.some((quest) => quest.id === 82 && quest.lockDetail.includes('폐허의 진실')));
});

test('beginner recommendations prefer a short hunt after the first story quest', () => {
    const player = {
        job: '모험가',
        level: 1,
        loc: '시작의 마을',
        hp: 178,
        maxHp: 178,
        mp: 52,
        maxMp: 52,
        quests: [],
        relics: [],
        equip: { weapon: null, offhand: null },
        inv: [],
        stats: {
            claimedQuestIds: [80],
            crafts: 0,
            bountiesCompleted: 0,
            visitedMaps: ['시작의 마을', '고요한 숲'],
        },
    };

    const board = getQuestBoardRecommendations(player);
    const spiderHunt = [...board.featured, ...board.backlog]
        .find((entry) => entry.quest.id === 110);

    assert.equal(board.featured[0].quest.id, 1);
    assert.equal(board.featured[0].quest.title, '슬라임 소탕');
    assert.equal(spiderHunt.lane, 'hunt');
    assert.equal(spiderHunt.meta.label, '토벌 임무');
    assert.equal(spiderHunt.brief.riskLabel, '안정');
});

test('a regular monster quest is not treated as a boss quest just because its map has a boss', () => {
    const player = {
        job: '모험가', level: 1, loc: '시작의 마을', hp: 178, maxHp: 178,
        mp: 52, maxMp: 52, quests: [], relics: [], inv: [],
        equip: { weapon: null, offhand: null },
        stats: { crafts: 0, bountiesCompleted: 0, visitedMaps: [] },
    };
    const maps = {
        '시험 숲': { level: 1, monsters: ['거미떼'], boss: '거미 여왕', bossMonsters: ['거미 여왕'] },
    };
    const catalog = [
        { id: 9001, title: '거미 소탕', target: '거미떼', goal: 3, minLv: 1, reward: { exp: 20, gold: 20 } },
        { id: 9002, title: '[보스] 거미 여왕', target: '거미 여왕', goal: 1, minLv: 1, reward: { exp: 40, gold: 40 } },
    ];

    const board = getQuestBoardRecommendations(player, maps, catalog);
    const entries = [...board.featured, ...board.backlog];

    assert.equal(entries.find((entry) => entry.quest.id === 9001).lane, 'hunt');
    assert.equal(entries.find((entry) => entry.quest.id === 9002).lane, 'boss');
});

test('quest action rejects direct re-accept of a completed static quest', () => {
    const logs = [];
    let dispatchCount = 0;
    const player = {
        level: 1,
        loc: '시작의 마을',
        quests: [],
        stats: { claimedQuestIds: [80] },
    };
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: () => { dispatchCount += 1; },
        addLog: (type, text) => logs.push({ type, text }),
    }, { emitUnlockedTitles: () => {} });

    actions.acceptQuest(80);

    assert.equal(dispatchCount, 0);
    assert.deepEqual(logs, [{ type: 'info', text: MSG.QUEST_ALREADY_COMPLETED }]);
});

test('quest action rejects direct acceptance of a locked story chapter', () => {
    const logs = [];
    let dispatchCount = 0;
    const player = {
        level: 50,
        loc: '시작의 마을',
        quests: [],
        stats: { claimedQuestIds: [] },
    };
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: () => { dispatchCount += 1; },
        addLog: (type, text) => logs.push({ type, text }),
    }, { emitUnlockedTitles: () => {} });

    actions.acceptQuest(87);

    assert.equal(dispatchCount, 0);
    assert.deepEqual(logs, [{ type: 'info', text: MSG.QUEST_PREREQUISITE_REQUIRED('[스토리] 에테르의 균열') }]);
});

test('quest action abandons an incomplete mission from the town board', () => {
    const logs = [];
    let updatedPlayer;
    const player = {
        level: 2,
        loc: '시작의 마을',
        quests: [{ id: 110, progress: 2 }],
        stats: { claimedQuestIds: [80] },
    };
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: (action) => {
            updatedPlayer = typeof action.payload === 'function' ? action.payload(player) : action.payload;
        },
        addLog: (type, text) => logs.push({ type, text }),
    }, { emitUnlockedTitles: () => {} });

    actions.abandonQuest(110);

    assert.deepEqual(updatedPlayer.quests, []);
    assert.deepEqual(logs, [{ type: 'event', text: MSG.QUEST_ABANDONED('거미떼 퇴치') }]);
});

test('quest action protects a completed mission reward from abandonment', () => {
    const logs = [];
    let dispatchCount = 0;
    const player = {
        level: 1,
        loc: '시작의 마을',
        quests: [{ id: 1, progress: 3 }],
        stats: {},
    };
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: () => { dispatchCount += 1; },
        addLog: (type, text) => logs.push({ type, text }),
    }, { emitUnlockedTitles: () => {} });

    actions.abandonQuest(1);

    assert.equal(dispatchCount, 0);
    assert.deepEqual(logs, [{ type: 'info', text: MSG.QUEST_ABANDON_REWARD_PENDING }]);
});

test('quest action rejects abandonment outside a safe zone', () => {
    const logs = [];
    let dispatchCount = 0;
    const player = {
        level: 2,
        loc: '고요한 숲',
        quests: [{ id: 110, progress: 2 }],
        stats: {},
    };
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: () => { dispatchCount += 1; },
        addLog: (type, text) => logs.push({ type, text }),
    }, { emitUnlockedTitles: () => {} });

    actions.abandonQuest(110);

    assert.equal(dispatchCount, 0);
    assert.deepEqual(logs, [{ type: 'error', text: MSG.QUEST_ABANDON_TOWN_ONLY }]);
});

test('abandoning a bounty preserves its daily issuance limit', () => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = [];
    let updatedPlayer;
    const player = {
        level: 2,
        loc: '시작의 마을',
        quests: [{
            id: 'bounty_test',
            title: '[현상수배] 슬라임 토벌',
            target: '슬라임',
            goal: 5,
            progress: 1,
            isBounty: true,
            reward: { exp: 20, gold: 20 },
        }],
        stats: { bountyDate: today, bountyIssued: true },
    };
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: (action) => {
            updatedPlayer = typeof action.payload === 'function' ? action.payload(player) : action.payload;
        },
        addLog: (type, text) => logs.push({ type, text }),
    }, { emitUnlockedTitles: () => {} });

    actions.abandonQuest('bounty_test');

    assert.deepEqual(updatedPlayer.quests, []);
    assert.equal(updatedPlayer.stats.bountyDate, today);
    assert.equal(updatedPlayer.stats.bountyIssued, true);
    assert.deepEqual(logs, [{ type: 'event', text: MSG.BOUNTY_ABANDONED }]);
});

test('quest board featured operations include a town prep run plan', () => {
    const player = {
        job: '전사',
        level: 8,
        loc: '시작의 마을',
        hp: 70,
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
    const planSteps = board.featured[0].planSteps;

    assert.deepEqual(planSteps.map((step) => step.label), ['수락', '정비', '목표']);
    assert.equal(planSteps[0].value, '게시판에서 임무 수락');
    assert.equal(planSteps[1].value, '휴식으로 회복 우선');
    assert.match(planSteps[2].value, /(진입|달성|추적|확장|가동)/);
    assert.equal(board.featured[0].brief.label, '임무 안내');
    assert.equal(board.featured[0].brief.riskLabel, '정비 필요');
    assert.match(board.featured[0].brief.extraction, /휴식/);
    assert.ok(board.featured[0].brief.tags.some((tag) => tag.label === '귀환'));
});

test('accepted quest entries retain operation brief metadata', () => {
    const player = {
        job: '전사',
        level: 8,
        loc: '시작의 마을',
        hp: 180,
        maxHp: 180,
        mp: 32,
        maxMp: 32,
        quests: [{ id: 68, progress: 0 }],
        relics: [{ effect: 'execute_bonus' }],
        equip: {
            weapon: { type: 'weapon', name: '양손검', val: 22, hands: 2, elem: '물리' },
            offhand: null,
        },
        inv: [],
        stats: {
            crafts: 0,
            bountiesCompleted: 0,
            visitedMaps: ['시작의 마을', '고요한 숲', '잊혀진 폐허'],
        },
    };

    const board = getQuestBoardRecommendations(player);
    const active = board.activeEntries[0];

    assert.ok(active.brief.route);
    assert.ok(active.brief.payoff);
    assert.match(active.brief.extraction, /(귀환|회수|점검|출발)/);
    assert.deepEqual(active.planSteps.map((step) => step.label), ['수락', '정비', '목표']);
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

test('town quest shortcut opens the quest board focus panel, not only the progress tab', async () => {
    const source = await readFile(new URL('../src/components/ControlPanel.tsx', import.meta.url), 'utf8');

    assert.match(source, /testId:\s*'control-quests'/);
    assert.match(source, /actions\.setGameState\(GS\.QUEST_BOARD\)/);
    assert.doesNotMatch(source, /handleTabSelect\('quest'\)/);
});

test('safe-zone control grid exposes quest board and rest actions for guidance targets', async () => {
    const source = await readFile(new URL('../src/components/ControlPanel.tsx', import.meta.url), 'utf8');

    assert.match(source, /key:\s*'quests'/);
    assert.match(source, /testId:\s*'control-quests'/);
    assert.match(source, /actions\.setGameState\(GS\.QUEST_BOARD\)/);
    assert.match(source, /key:\s*'rest'/);
    assert.match(source, /testId:\s*'control-rest'/);
});

test('control panel renders active mission tracker from accepted quests', async () => {
    const source = await readFile(new URL('../src/components/ControlPanel.tsx', import.meta.url), 'utf8');

    assert.match(source, /getQuestTracker/);
    assert.match(source, /data-testid="control-mission-tracker"/);
    assert.match(source, /tracker\.nextStep/);
    assert.match(source, /tracker\.routeLabel/);
    assert.match(source, /tracker\.returnLabel/);
    assert.doesNotMatch(source, /tracker\.chips/);
    assert.match(source, /tracker\.progressPercent/);
    assert.match(source, /data-testid="control-claim-quest-reward"/);
    assert.match(source, /actions\.completeQuest\(questTracker\.questId\)/);
    assert.match(source, /canClaimReward=\{isSafeZone\}/);
});

test('claimable mission tracker exposes a real town-only reward action', async () => {
    const source = await readFile(new URL('../src/components/ControlPanel.tsx', import.meta.url), 'utf8');

    assert.match(source, /tracker\.kind === 'claimable'/);
    assert.match(source, /disabled=\{!canClaimReward \|\| !onClaimReward\}/);
    assert.match(source, /\{canClaimReward \? '보상 받기' : '마을에서 수령'\}/);
});

test('quest board renders mission brief rows for featured and active operations', async () => {
    const source = await readFile(new URL('../src/components/tabs/QuestBoardPanel.tsx', import.meta.url), 'utf8');

    assert.match(source, /OperationBriefRows/);
    assert.match(source, /brief\.extraction/);
    assert.match(source, /brief\.payoff/);
    assert.match(source, /quest\.lockLabel/);
    assert.match(source, /quest\.lockDetail/);
});
