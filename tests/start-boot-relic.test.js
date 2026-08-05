import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { BALANCE } from '../src/data/constants.js';
import { FIRST_STORY_QUEST_ID } from '../src/data/quests.js';
import { MSG } from '../src/data/messages.js';

const makeDeps = (player = { meta: {}, stats: {}, quests: [] }) => {
    const dispatches = [];
    const logs = [];
    const deps = {
        player,
        gameState: 'idle',
        dispatch: (a) => dispatches.push(a),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: 178, maxMp: 52 }),
    };
    return { deps, dispatches, logs };
};

const noopHooks = { emitUnlockedTitles: () => {} };

test('첫 플레이는 유물 선택 없이 첫 이야기와 출발 흐름을 먼저 보여 준다', () => {
    const { deps, dispatches, logs } = makeDeps();
    const actions = createCharacterActions(deps, noopHooks);
    actions.start('히어로', 'male', '모험가', []);

    const pending = dispatches.find((d) => d.type === AT.SET_PENDING_RELICS);
    const startedPlayer = dispatches.find((d) => d.type === AT.SET_PLAYER)?.payload;
    assert.equal(pending, undefined);
    assert.deepEqual(startedPlayer.quests, [
        { id: FIRST_STORY_QUEST_ID, progress: 0, startExploreCount: 0 },
    ]);
    assert.deepEqual(logs.slice(0, 2), [
        { type: 'system', text: MSG.START_JOURNEY('히어로') },
        { type: 'event', text: MSG.START_SKILL('강타') },
    ]);
    assert.ok(logs.every((log) => log.text !== MSG.START_BOOT_RELIC));
    assert.doesNotMatch(logs.map((log) => log.text).join(' '), /콜사인|초기 스킬|빌드/);
});

test('탐험 기록이 있는 재도전은 시작 유물 선택을 유지한다', () => {
    const { deps, dispatches, logs } = makeDeps({
        meta: {},
        stats: { explores: 1 },
        quests: [],
    });
    createCharacterActions(deps, noopHooks).start('히어로', 'male', '모험가', []);

    const pending = dispatches.find((dispatch) => dispatch.type === AT.SET_PENDING_RELICS);
    assert.ok(pending);
    assert.equal(pending.payload.length, BALANCE.START_BOOT_RELIC_CHOICES);
    assert.ok(logs.some((log) => log.text === MSG.START_BOOT_RELIC));
});

test('첫 스토리 임무는 이미 활성화했거나 완료한 새 여정에 중복 배정되지 않는다', () => {
    const activeQuest = { id: FIRST_STORY_QUEST_ID, progress: 0, startExploreCount: 2 };
    const activeRun = makeDeps({
        meta: {},
        stats: { exploresByLocation: { '고요한 숲': 2 } },
        quests: [activeQuest],
    });
    createCharacterActions(activeRun.deps, noopHooks).start('히어로', 'male', '모험가', []);
    assert.deepEqual(
        activeRun.dispatches.find((dispatch) => dispatch.type === AT.SET_PLAYER)?.payload.quests,
        [activeQuest],
    );

    const completedRun = makeDeps({
        meta: {},
        stats: { claimedQuestIds: [FIRST_STORY_QUEST_ID] },
        quests: [],
    });
    createCharacterActions(completedRun.deps, noopHooks).start('히어로', 'male', '모험가', []);
    assert.deepEqual(
        completedRun.dispatches.find((dispatch) => dispatch.type === AT.SET_PLAYER)?.payload.quests,
        [],
    );
});

test('B-1: 빈 이름이면 시작 자체가 미발동 (부트도 없음)', () => {
    const { deps, dispatches } = makeDeps();
    const actions = createCharacterActions(deps, noopHooks);
    actions.start('   ', 'male', '모험가', []);
    assert.equal(dispatches.length, 0, '빈 이름 → early return, dispatch 0건');
});

test('새 여정 준비는 이전 reset 안내를 플레이 기록에 남기지 않는다', () => {
    const { deps, dispatches, logs } = makeDeps();
    const actions = createCharacterActions(deps, noopHooks);

    actions.reset();

    assert.deepEqual(dispatches, [{ type: AT.RESET_GAME }]);
    assert.deepEqual(logs, []);
});
