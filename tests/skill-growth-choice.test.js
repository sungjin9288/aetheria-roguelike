import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryActions } from '../src/hooks/useInventoryActions.js';
import { multiplayerActionMap } from '../src/reducers/handlers/multiplayerHandlers.js';
import { AT } from '../src/reducers/actionTypes.js';

const makeActions = (player) => {
    const dispatched = [];
    const logs = [];
    const actions = createInventoryActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatched.push(action),
        addLog: (type, message) => logs.push({ type, message }),
        addStoryLog: () => {},
        getFullStats: () => ({}),
    });
    return { actions, dispatched, logs };
};

test('first skill growth choice is free and logs the player-facing branch name', () => {
    const player = { job: '모험가', skillChoices: {}, stats: {} };
    const { actions, dispatched, logs } = makeActions(player);

    actions.chooseSkillBranch('강타', 'B');

    assert.deepEqual(dispatched, [{
        type: AT.CHOOSE_SKILL_BRANCH,
        payload: { skillName: '강타', choice: 'B' },
    }]);
    assert.equal(logs[0].type, 'system');
    assert.match(logs[0].message, /강타 성장 선택: 기절 배시/);
    assert.doesNotMatch(logs[0].message, /분기 B/);
});

test('first skill growth choice cannot overwrite an existing choice', () => {
    const player = { job: '모험가', skillChoices: { '강타': 'A' }, stats: {} };
    const { actions, dispatched, logs } = makeActions(player);

    actions.chooseSkillBranch('강타', 'B');

    assert.equal(dispatched.length, 0);
    assert.equal(logs[0].type, 'warn');
    assert.match(logs[0].message, /첫 성장 선택은 끝났습니다/);
});

test('reducer preserves the first recorded skill growth choice', () => {
    const state = {
        player: { skillChoices: { '강타': 'A' } },
        syncStatus: 'synced',
    };

    const next = multiplayerActionMap.CHOOSE_SKILL_BRANCH(state, {
        type: AT.CHOOSE_SKILL_BRANCH,
        payload: { skillName: '강타', choice: 'B' },
    });

    assert.equal(next, state);
    assert.equal(next.player.skillChoices['강타'], 'A');
});
