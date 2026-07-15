import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getAdventureGuidance } from '../src/utils/adventureGuide.js';
import { getQuestBoardRecommendations } from '../src/utils/questOperations.js';
import { createQuestActions } from '../src/hooks/gameActions/questActions.js';
import { MSG } from '../src/data/messages.js';

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
});
