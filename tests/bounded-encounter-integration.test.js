import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { MSG } from '../src/data/messages.js';
import { getEventChoicePreview } from '../src/utils/eventPresentation.js';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { buildBoundedEncounterEvent } from '../src/utils/boundedEncounterEvent.js';
import {
    applyBoundedEncounterChoice,
    buildBoundedEncounterContext,
    selectBoundedEncounter,
} from '../src/utils/boundedEncounterSelector.js';

const clone = (value) => structuredClone(value);

const activePlayer = (overrides = {}) => ({
    ...clone(INITIAL_STATE.player),
    loc: '고요한 숲',
    hp: 80,
    mp: 20,
    stats: { ...clone(INITIAL_STATE.player.stats), explores: 1 },
    activeExpedition: { id: 'expedition-test-1', explores: 0 },
    ...overrides,
});

const boundedState = (overrides = {}) => {
    const player = activePlayer(overrides.player);
    const encounter = BOUNDED_ENCOUNTERS[0];
    return {
        ...clone(INITIAL_STATE),
        player,
        gameState: GS.EVENT,
        currentEvent: buildBoundedEncounterEvent(encounter, player.stats.explores),
        logs: Array.from({ length: 4 }, (_, index) => ({ id: `old-${index}`, type: 'info', text: '이전 로그' })),
        ...overrides,
    };
};

const resolve = (state, choiceId = 'lift-stone', extra = {}) => gameReducer(state, {
    type: AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE,
    payload: {
        encounterId: state.currentEvent?.boundedEncounterId,
        choiceId,
        expeditionId: state.player.activeExpedition?.id,
        occurrenceSequence: state.currentEvent?.boundedOccurrenceSequence,
        ...extra,
    },
});

const encounterById = (id) => BOUNDED_ENCOUNTERS.find((entry) => entry.id === id);

// 2026-09 Wave 27 N1: 플레이어가 고칠 수 있는 거부(자원 부족·가방 가득)는 동일 참조가 아니다 —
//   이벤트 화면에는 로그가 그려지지 않으므로 리듀서가 이유를 `currentEvent.choiceFeedback`에
//   싣고 미리보기가 그 문장을 그린다. 플레이어·이벤트 신원은 그대로이고 연타는 멱등이다.
const assertVisibleRejection = (state, choiceId, text) => {
    const choiceIndex = state.currentEvent.outcomes.findIndex((outcome) => outcome.choiceId === choiceId);
    const rejected = resolve(state, choiceId);
    assert.notStrictEqual(rejected, state);
    assert.strictEqual(rejected.player, state.player);
    assert.equal(rejected.gameState, GS.EVENT);
    assert.equal(rejected.currentEvent.boundedEncounterId, state.currentEvent.boundedEncounterId);
    assert.deepEqual(getEventChoicePreview(rejected.currentEvent, choiceIndex), { text, tone: 'danger' });
    assert.deepEqual({ type: rejected.logs.at(-1).type, text: rejected.logs.at(-1).text }, { type: 'error', text });
    assert.strictEqual(resolve(rejected, choiceId), rejected);
    return rejected;
};

const stateForEncounter = (encounter, overrides = {}) => {
    const player = activePlayer({ loc: encounter.region, ...overrides });
    return {
        ...clone(INITIAL_STATE),
        player,
        gameState: GS.EVENT,
        currentEvent: buildBoundedEncounterEvent(encounter, player.stats.explores),
    };
};

test('accepted general narrative roll selects a bounded encounter before AI generation', async () => {
    const dispatches = [];
    let committed = 0;
    const player = activePlayer({
        hp: 120,
        stats: {
            ...clone(INITIAL_STATE.player.stats),
            explores: 1,
            exploreState: { ...clone(INITIAL_STATE.player.stats.exploreState), sinceNarrativeEvent: 1 },
        },
        eventChainProgress: { lost_wizard: 99 },
    });
    const actions = createExploreActions({
        player,
        gameState: GS.IDLE,
        uid: 'test-user',
        dispatch: (action) => dispatches.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
        rng: (() => {
            const rolls = [0.99, 0.99, 0, 0];
            return () => rolls.shift() ?? 0.99;
        })(),
    }, {
        commitExploreOutcome: () => { committed += 1; },
    });

    await actions.explore();

    const eventAction = dispatches.find((action) => action.type === AT.SET_EVENT);
    assert.equal(eventAction.payload.isBoundedEncounter, true);
    assert.equal(eventAction.payload.boundedEncounterId, 'forest-old-pillars');
    assert.equal(eventAction.payload.boundedOccurrenceSequence, 2);
    assert.equal(committed, 1);
    assert.equal(dispatches.some((action) => action.type === AT.SET_AI_THINKING), false);
});

test('bounded event shape exposes canonical trade-offs but not settlement fields', () => {
    const encounter = BOUNDED_ENCOUNTERS.find((entry) => entry.id === 'plain-supply-cart');
    const event = buildBoundedEncounterEvent(encounter, 7);
    assert.deepEqual(event.choices, ['수레를 고쳐 보급을 챙긴다', '수레를 빠르게 뒤진다']);
    assert.deepEqual(event.outcomes, [
        { choiceIndex: 0, choiceId: 'repair-cart', tradeoff: '안정적으로 골드 40과 하급 체력 물약 1개를 얻습니다.', tone: 'reward' },
        { choiceIndex: 1, choiceId: 'search-cart', tradeoff: '생명 8을 감수하고 골드 80을 즉시 가져갑니다.', tone: 'danger' },
    ]);
    assert.equal(Object.hasOwn(event.outcomes[0], 'gold'), false);
});

test('real signature codex and class journey boss history unlock independent production encounters', () => {
    const signaturePlayer = activePlayer({
        stats: {
            ...activePlayer().stats,
            codex: {
                ...activePlayer().stats.codex,
                weapons: { ...activePlayer().stats.codex.weapons, '성검 에테르니아': true },
            },
        },
        classJourney: {
            version: 1,
            sequence: 1,
            byJob: { 전사: { bossNames: [] } },
        },
    });
    const signatureContext = buildBoundedEncounterContext(signaturePlayer, '고요한 숲');
    assert.ok(signatureContext?.signatureNames.includes('성검 에테르니아'));
    assert.equal(
        selectBoundedEncounter(
            BOUNDED_ENCOUNTERS,
            signatureContext,
            { expeditionId: 'expedition-signature', occurrenceSequence: 1 },
            () => 0,
        )?.id,
        'forest-engraved-echo',
    );

    const bossPlayer = activePlayer({
        loc: '서쪽 평원',
        classJourney: {
            version: 1,
            sequence: 1,
            byJob: { 전사: { bossNames: ['고대 호수의 수호신'] } },
        },
    });
    const bossContext = buildBoundedEncounterContext(bossPlayer, '서쪽 평원');
    assert.ok(bossContext?.bossNames.includes('고대 호수의 수호신'));
    assert.equal(
        selectBoundedEncounter(
            BOUNDED_ENCOUNTERS,
            bossContext,
            { expeditionId: 'expedition-boss', occurrenceSequence: 1 },
            () => 0,
        )?.id,
        'plain-guardian-waterway',
    );
});

test('empty or ineligible pack falls through without an extra selection RNG draw', () => {
    let draws = 0;
    const context = {
        region: '고요한 숲',
        jobLineage: ['모험가'],
        hp: 120,
        maxHp: 150,
        signatureNames: [],
        bossNames: [],
        receiptKeys: [],
    };
    assert.equal(selectBoundedEncounter([], context, { expeditionId: 'expedition-test-1', occurrenceSequence: 1 }, () => {
        draws += 1;
        return 0;
    }), null);
    assert.equal(draws, 0);

    const allReceipts = BOUNDED_ENCOUNTERS
        .filter((entry) => entry.region === '고요한 숲')
        .map((entry) => `expedition-test-1:${entry.id}:1`);
    assert.equal(selectBoundedEncounter(
        BOUNDED_ENCOUNTERS,
        { ...context, receiptKeys: allReceipts },
        { expeditionId: 'expedition-test-1', occurrenceSequence: 1 },
        () => {
            draws += 1;
            return 0;
        },
    ), null);
    assert.equal(draws, 0);
});

test('new bounded choices settle their canonical rewards atomically and replay is a no-op', () => {
    const engraved = encounterById('forest-engraved-echo');
    const aligned = applyBoundedEncounterChoice(
        { hp: 100, maxHp: 120, mp: 30, maxMp: 60, gold: 10, inv: [] },
        engraved,
        'align-engraving',
        { expeditionId: 'expedition-signature', occurrenceSequence: 1 },
    );
    assert.equal(aligned.applied, true);
    assert.equal(aligned.player.mp, 20);
    assert.deepEqual(aligned.player.tempBuff, { name: '각인의 공명', atk: 0.10, def: 0.10, turn: 3 });

    const gathered = applyBoundedEncounterChoice(
        { hp: 100, maxHp: 120, mp: 30, maxMp: 60, gold: 10, inv: [] },
        engraved,
        'gather-engraving-shards',
        { expeditionId: 'expedition-signature', occurrenceSequence: 1 },
    );
    assert.equal(gathered.applied, true);
    assert.equal(gathered.player.hp, 92);
    assert.equal(gathered.player.inv.at(-1).name, '강화 재료');

    const waterway = encounterById('plain-guardian-waterway');
    const awakened = applyBoundedEncounterChoice(
        { hp: 80, maxHp: 120, mp: 30, maxMp: 60, gold: 10, inv: [] },
        waterway,
        'awaken-water-memory',
        { expeditionId: 'expedition-boss', occurrenceSequence: 1 },
    );
    assert.equal(awakened.applied, true);
    assert.equal(awakened.player.hp, 98);
    assert.equal(awakened.player.mp, 20);

    const cleared = applyBoundedEncounterChoice(
        { hp: 80, maxHp: 120, mp: 30, maxMp: 60, gold: 10, inv: [] },
        waterway,
        'clear-channel-silt',
        { expeditionId: 'expedition-boss', occurrenceSequence: 1 },
    );
    assert.equal(cleared.applied, true);
    assert.equal(cleared.player.hp, 72);
    assert.equal(cleared.player.gold, 80);

    const replay = applyBoundedEncounterChoice(
        aligned.player,
        engraved,
        'align-engraving',
        { expeditionId: 'expedition-signature', occurrenceSequence: 1 },
    );
    assert.equal(replay.applied, false);
    assert.equal(replay.reason, 'already_applied');
});

test('new bounded reducer routes preserve stale, forged, tampered, resource, and inventory failure contracts', () => {
    const engraved = encounterById('forest-engraved-echo');
    const state = stateForEncounter(engraved, {
        mp: 40,
        stats: {
            ...activePlayer().stats,
            codex: {
                ...activePlayer().stats.codex,
                weapons: { ...activePlayer().stats.codex.weapons, '성검 에테르니아': true },
            },
        },
    });
    assert.strictEqual(resolve(state, 'align-engraving', { encounterId: 'plain-guardian-waterway' }), state);
    assert.strictEqual(resolve(state, 'align-engraving', { expeditionId: 'forged-expedition' }), state);
    assert.strictEqual(resolve(state, 'align-engraving', { occurrenceSequence: 99 }), state);
    const tampered = {
        ...state,
        currentEvent: {
            ...state.currentEvent,
            outcomes: [state.currentEvent.outcomes[1], state.currentEvent.outcomes[0]],
        },
    };
    assert.strictEqual(resolve(tampered, 'align-engraving'), tampered);
    const lowMp = stateForEncounter(engraved, { mp: 0 });
    assertVisibleRejection(lowMp, 'align-engraving', MSG.EVENT_CHOICE_COST_UNPAYABLE(
        MSG.EVENT_CHOICE_RESOURCE_SHORT(MSG.EVENT_CHOICE_RESOURCE_LABELS.mp, 10, 0),
    ));

    const full = stateForEncounter(engraved, {
        maxInv: 1,
        inv: [{ id: 'only', name: '하급 체력 물약' }],
    });
    assertVisibleRejection(full, 'gather-engraving-shards', MSG.EVENT_CHOICE_INVENTORY_FULL);
});

test('bounded hook dispatches only the reducer settlement action', () => {
    const dispatches = [];
    const player = activePlayer();
    const currentEvent = buildBoundedEncounterEvent(BOUNDED_ENCOUNTERS[0], player.stats.explores);
    createEventActions({
        player,
        currentEvent,
        dispatch: (action) => dispatches.push(action),
        addLog: () => {},
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(1);
    assert.deepEqual(dispatches, [{
        type: AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE,
        payload: {
            encounterId: 'forest-old-pillars',
            choiceId: 'lift-stone',
            expeditionId: 'expedition-test-1',
            occurrenceSequence: 1,
        },
    }]);
});

test('matching reducer payload applies one reward and receipt, then replay is a no-op', () => {
    const state = boundedState();
    const settled = resolve(state);
    assert.equal(settled.gameState, GS.IDLE);
    assert.equal(settled.currentEvent, null);
    assert.equal(settled.player.gold, state.player.gold + 60);
    assert.equal(settled.player.stats.total_gold, state.player.stats.total_gold + 60);
    assert.equal(settled.player.eventChainProgress.boundedEncounterReceipts['expedition-test-1:forest-old-pillars:1'].choiceId, 'lift-stone');
    assert.equal(settled.syncStatus, 'syncing');
    assert.equal(settled.logs.at(-1).text, '돌 아래 숨겨진 골드 60을 찾아냈습니다.');
    assert.strictEqual(resolve(settled), settled);
});

test('stale, forged, and mismatched bounded payloads return the exact state object', () => {
    const state = boundedState();
    assert.strictEqual(resolve(state, 'lift-stone', { expeditionId: 'forged-expedition' }), state);
    assert.strictEqual(resolve(state, 'lift-stone', { occurrenceSequence: 99 }), state);
    assert.strictEqual(resolve(state, 'lift-stone', { encounterId: 'plain-supply-cart' }), state);
    assert.strictEqual(resolve(state, 'forged-choice'), state);

    const tampered = {
        ...state,
        currentEvent: {
            ...state.currentEvent,
            outcomes: [state.currentEvent.outcomes[1], state.currentEvent.outcomes[0]],
        },
    };
    assert.strictEqual(resolve(tampered, 'lift-stone'), tampered);
});

test('canonical persisted outcomes remain valid when object key order changes', () => {
    const state = boundedState();
    const reordered = {
        ...state,
        currentEvent: {
            ...state.currentEvent,
            outcomes: state.currentEvent.outcomes.map((outcome) => ({
                tone: outcome.tone,
                tradeoff: outcome.tradeoff,
                choiceId: outcome.choiceId,
                choiceIndex: outcome.choiceIndex,
            })),
        },
    };
    const settled = resolve(reordered, 'lift-stone');
    assert.equal(settled.gameState, GS.IDLE);
    assert.equal(settled.player.gold, state.player.gold + 60);
});

test('insufficient resources and full inventory keep the event visible without player mutation', () => {
    const lowMp = boundedState({ player: activePlayer({ mp: 0 }) });
    assertVisibleRejection(lowMp, 'read-runes', MSG.EVENT_CHOICE_COST_UNPAYABLE(
        MSG.EVENT_CHOICE_RESOURCE_SHORT(MSG.EVENT_CHOICE_RESOURCE_LABELS.mp, 10, 0),
    ));

    // Wave 27 N1: 이 행은 `BOUNDED_ENCOUNTERS[2]`(조우가 추가되며 forest-engraved-echo로 밀렸다)에
    //   'repair-cart'를 눌러 `invalid_choice`로 거부되고 있었다 — 가방 가득을 검사하지 않는 공허참.
    //   'repair-cart'의 주인인 plain-supply-cart로 고정한다.
    const fullInventory = boundedState({
        player: activePlayer({ maxInv: 1, inv: [{ id: 'only', name: '하급 체력 물약' }] }),
    });
    const plain = {
        ...fullInventory,
        currentEvent: buildBoundedEncounterEvent(encounterById('plain-supply-cart'), 1),
    };
    const rejected = assertVisibleRejection(plain, 'repair-cart', MSG.EVENT_CHOICE_INVENTORY_FULL);
    assert.equal(rejected.player.gold, fullInventory.player.gold);
});
