import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { buildBoundedEncounterEvent } from '../src/utils/boundedEncounterEvent.js';
import { selectBoundedEncounter } from '../src/utils/boundedEncounterSelector.js';

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
    const event = buildBoundedEncounterEvent(BOUNDED_ENCOUNTERS[2], 7);
    assert.deepEqual(event.choices, ['수레를 고쳐 보급을 챙긴다', '수레를 빠르게 뒤진다']);
    assert.deepEqual(event.outcomes, [
        { choiceIndex: 0, choiceId: 'repair-cart', tradeoff: '안정적으로 골드 40과 하급 체력 물약 1개를 얻습니다.', tone: 'reward' },
        { choiceIndex: 1, choiceId: 'search-cart', tradeoff: '생명 8을 감수하고 골드 80을 즉시 가져갑니다.', tone: 'danger' },
    ]);
    assert.equal(Object.hasOwn(event.outcomes[0], 'gold'), false);
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
    assert.strictEqual(resolve(lowMp, 'read-runes'), lowMp);
    assert.equal(lowMp.currentEvent.isBoundedEncounter, true);

    const fullInventory = boundedState({
        player: activePlayer({ maxInv: 1, inv: [{ id: 'only', name: '하급 체력 물약' }] }),
    });
    const plain = {
        ...fullInventory,
        currentEvent: buildBoundedEncounterEvent(BOUNDED_ENCOUNTERS[2], 1),
    };
    assert.strictEqual(resolve(plain, 'repair-cart'), plain);
    assert.equal(plain.player.gold, fullInventory.player.gold);
});
