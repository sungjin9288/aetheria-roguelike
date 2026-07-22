import assert from 'node:assert/strict';
import test from 'node:test';

import { DB } from '../src/data/db.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { migrateData } from '../src/utils/gameUtils.js';
import { startExpedition } from '../src/utils/expeditionLedger.js';
import {
    getDefaultExpeditionFocusQuestIds,
    getFocusedExpeditionQuestEntries,
    getPreparedExpeditionFocusQuestIds,
    MAX_EXPEDITION_FOCUS_QUESTS,
} from '../src/utils/expeditionMissionFocus.js';
import { selectEncounterMonster } from '../src/utils/exploreUtils.js';
import { createQuestActions } from '../src/hooks/gameActions/questActions.js';

const makePlayer = (overrides = {}) => ({
    ...INITIAL_STATE.player,
    loc: '시작의 마을',
    level: 5,
    hp: 180,
    maxHp: 180,
    quests: [
        { id: 1, progress: 2 },
        { id: 80, progress: 0 },
        { id: 2, progress: 5 },
        { id: 3, progress: 1 },
    ],
    ...overrides,
});

test('기본 원정 편성은 보상 대기, 스토리, 목적지와 진행률 순으로 최대 3개를 고른다', () => {
    const selected = getDefaultExpeditionFocusQuestIds(makePlayer(), '고요한 숲');

    assert.deepEqual(selected, [2, 80, 1]);
    assert.equal(selected.length, MAX_EXPEDITION_FOCUS_QUESTS);
});

test('명시적으로 고른 원정 임무는 자동 우선순위보다 앞서고 선택 순서를 유지한다', () => {
    const player = makePlayer({ expeditionFocusQuestIds: [3, 1] });

    assert.deepEqual(getPreparedExpeditionFocusQuestIds(player), [3, 1]);
    assert.deepEqual(getFocusedExpeditionQuestEntries(player).map((entry) => entry.id), [3, 1]);
});

test('reducer는 유효한 1~3개 편성만 받고 4개, 중복, 없는 임무는 거부한다', () => {
    const state = { ...INITIAL_STATE, player: makePlayer({ expeditionFocusQuestIds: [80] }) };
    const valid = gameReducer(state, { type: AT.SET_EXPEDITION_FOCUS, payload: [80, 1, 3] });
    const overLimit = gameReducer(valid, { type: AT.SET_EXPEDITION_FOCUS, payload: [80, 1, 2, 3] });
    const duplicate = gameReducer(valid, { type: AT.SET_EXPEDITION_FOCUS, payload: [80, 80] });
    const unknown = gameReducer(valid, { type: AT.SET_EXPEDITION_FOCUS, payload: [99999] });

    assert.deepEqual(valid.player.expeditionFocusQuestIds, [80, 1, 3]);
    assert.equal(overLimit, valid);
    assert.equal(duplicate, valid);
    assert.equal(unknown, valid);
});

test('quest action은 마을에서도 4번째 원정 임무 선택을 dispatch하지 않는다', () => {
    const dispatches = [];
    const logs = [];
    const player = makePlayer({ expeditionFocusQuestIds: [80, 1, 2] });
    const actions = createQuestActions({
        player,
        grave: null,
        dispatch: (action) => dispatches.push(action),
        addLog: (type, text) => logs.push({ type, text }),
    }, { emitUnlockedTitles: () => {} });

    actions.toggleExpeditionFocusQuest(3);

    assert.equal(dispatches.length, 0);
    assert.match(logs[0].text, /최대 3개/);
});

test('출정 시 편성이 snapshot으로 고정되어 이후 마을 draft 변경과 분리된다', () => {
    const started = startExpedition(
        makePlayer({ expeditionFocusQuestIds: [80, 1] }),
        '고요한 숲',
        1_000,
        DB.QUESTS,
    );
    const changedDraft = { ...started, expeditionFocusQuestIds: [2, 3] };

    assert.deepEqual(started.activeExpedition.focusQuestIds, [80, 1]);
    assert.deepEqual(getFocusedExpeditionQuestEntries(changedDraft).map((entry) => entry.id), [80, 1]);
});

test('구세이브 migration은 활성 임무를 삭제하지 않고 draft와 원정 snapshot을 최대 3개로 보강한다', () => {
    const started = startExpedition(makePlayer(), '고요한 숲', 1_000, DB.QUESTS);
    const { focusQuestIds: _removed, ...legacySnapshot } = started.activeExpedition;
    const migrated = migrateData({
        version: 5,
        player: {
            ...started,
            equip: {},
            expeditionFocusQuestIds: undefined,
            activeExpedition: legacySnapshot,
        },
    }).player;

    assert.equal(migrated.quests.length, 4);
    assert.equal(migrated.expeditionFocusQuestIds.length, 3);
    assert.equal(migrated.activeExpedition.focusQuestIds.length, 3);
});

test('조우 보정은 같은 지역의 활성 임무 중 이번 원정에 고른 목표만 사용한다', () => {
    const mapData = { level: 1, monsters: ['슬라임', '거미떼'] };
    const player = {
        loc: '고요한 숲',
        quests: [
            { id: 1, progress: 0 },
            { id: 'bounty_spider', title: '[현상수배] 거미떼', target: '거미떼', goal: 4, progress: 0, isBounty: true },
        ],
        expeditionFocusQuestIds: ['bounty_spider'],
    };
    const rolls = [0.1, 0];

    assert.equal(selectEncounterMonster(mapData.monsters, mapData, player, () => rolls.shift()), '거미떼');
});
