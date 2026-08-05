import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { getProtocolDayKey } from '../src/utils/protocolCycle.js';
import { createQuestActions } from '../src/hooks/gameActions/questActions.js';

const makeState = (playerPatch = {}) => ({
    ...INITIAL_STATE,
    player: {
        ...structuredClone(INITIAL_STATE.player),
        ...playerPatch,
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            ...(playerPatch.stats || {}),
        },
    },
    logs: [],
    syncStatus: 'synced',
});

test('임무 수락은 최신 state에서 한 번만 적용되고 replay는 exact no-op이다', () => {
    const quest = DB.QUESTS.find((entry) => entry.id === 1);
    const state = makeState({
        level: quest.minLv,
        loc: '시작의 마을',
        quests: [],
        expeditionFocusQuestIds: [],
        stats: { claimedQuestIds: [] },
    });
    const action = { type: AT.ACCEPT_QUEST, payload: { questId: quest.id } };

    const accepted = gameReducer(state, action);
    const replayed = gameReducer(accepted, action);

    assert.deepEqual(accepted.player.quests, [{ id: quest.id, progress: 0 }]);
    assert.ok(accepted.player.expeditionFocusQuestIds.includes(quest.id));
    assert.match(accepted.logs.at(-1).text, new RegExp(quest.title));
    assert.equal(replayed, accepted);
});

test('임무 포기는 진행 중 임무만 한 번 제거하고 완료 임무는 보호한다', () => {
    const quest = DB.QUESTS.find((entry) => entry.id === 1);
    const state = makeState({
        loc: '시작의 마을',
        quests: [{ id: quest.id, progress: 1 }],
        expeditionFocusQuestIds: [quest.id],
    });
    const action = { type: AT.ABANDON_QUEST, payload: { questId: quest.id } };

    const abandoned = gameReducer(state, action);
    const replayed = gameReducer(abandoned, action);
    const completed = gameReducer(makeState({
        loc: '시작의 마을',
        quests: [{ id: quest.id, progress: quest.goal }],
    }), action);

    assert.deepEqual(abandoned.player.quests, []);
    assert.deepEqual(abandoned.player.expeditionFocusQuestIds, []);
    assert.match(abandoned.logs.at(-1).text, /포기/);
    assert.equal(replayed, abandoned);
    assert.equal(completed.player.quests.length, 1);
    assert.match(completed.logs.at(-1).text, /보상을 받은 뒤/);
});

test('현상수배 발급은 seed만 받아 canonical 목표와 보상을 한 번 생성한다', () => {
    const requestedAt = Date.now();
    const state = makeState({
        level: 4,
        loc: '시작의 마을',
        quests: [],
        expeditionFocusQuestIds: [],
        stats: { bountyDate: null, bountyIssued: false },
    });
    const action = {
        type: AT.REQUEST_BOUNTY,
        payload: {
            requestedAt,
            seed: 0,
            target: '마왕',
            count: 999,
            reward: { exp: 999999, gold: 999999 },
        },
    };

    const issued = gameReducer(state, action);
    const replayed = gameReducer(issued, action);
    const bounty = issued.player.quests.find((quest) => quest.isBounty);

    assert.ok(bounty);
    assert.equal(bounty.goal, BALANCE.BOUNTY_MIN_COUNT);
    assert.equal(bounty.reward.exp, bounty.goal * state.player.level * BALANCE.BOUNTY_EXP_MULT);
    assert.equal(bounty.reward.gold, bounty.goal * state.player.level * BALANCE.BOUNTY_GOLD_MULT);
    assert.notEqual(bounty.target, action.payload.target);
    assert.equal(issued.player.stats.bountyDate, getProtocolDayKey(new Date(requestedAt)));
    assert.equal(issued.player.stats.bountyIssued, true);
    assert.match(issued.logs.at(-1).text, new RegExp(`${bounty.target} ${bounty.goal}마리`));
    assert.equal(replayed, issued);
});

test('집중 임무는 toggle이 아닌 목표 상태를 적용해 rapid replay에도 되돌아가지 않는다', () => {
    const state = makeState({
        loc: '시작의 마을',
        quests: [{ id: 1, progress: 0 }, { id: 2, progress: 0 }],
        expeditionFocusQuestIds: [1],
    });
    const include = {
        type: AT.UPDATE_EXPEDITION_FOCUS_QUEST,
        payload: { questId: 2, selected: true },
    };

    const included = gameReducer(state, include);
    const includedReplay = gameReducer(included, include);
    const exclude = {
        type: AT.UPDATE_EXPEDITION_FOCUS_QUEST,
        payload: { questId: 2, selected: false },
    };
    const excluded = gameReducer(included, exclude);
    const excludedReplay = gameReducer(excluded, exclude);

    assert.deepEqual(included.player.expeditionFocusQuestIds, [1, 2]);
    assert.equal(includedReplay, included);
    assert.deepEqual(excluded.player.expeditionFocusQuestIds, [1]);
    assert.equal(excludedReplay, excluded);
});

test('현상수배 hook은 요청 entropy만 보내고 목표와 보상은 만들지 않는다', () => {
    const dispatched = [];
    const actions = createQuestActions({
        player: makeState().player,
        grave: null,
        dispatch: (action) => dispatched.push(action),
        addLog: () => {},
    }, { emitUnlockedTitles: () => {} });

    actions.requestBounty();

    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, AT.REQUEST_BOUNTY);
    assert.equal(typeof dispatched[0].payload.requestedAt, 'number');
    assert.equal(typeof dispatched[0].payload.seed, 'number');
    assert.equal('target' in dispatched[0].payload, false);
    assert.equal('count' in dispatched[0].payload, false);
    assert.equal('reward' in dispatched[0].payload, false);
});
