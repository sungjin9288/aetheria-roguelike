import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { MAX_RELICS_PER_RUN } from '../src/data/relics.js';

const COST_CASES = [
    { chainId: 'last_hero', step: 0, choiceIndex: 0, cost: 300 },
    { chainId: 'shadow_guild', step: 1, choiceIndex: 0, cost: 2000 },
];

const clone = (value) => structuredClone(value);

const canonicalStep = ({ chainId, step }) => {
    const chain = EVENT_CHAINS.find((candidate) => candidate.id === chainId);
    return chain.steps.find((candidate) => candidate.step === step);
};

const buildState = (costCase, gold, overrides = {}) => {
    const stepData = canonicalStep(costCase);
    return {
        ...clone(INITIAL_STATE),
        player: {
            ...clone(INITIAL_STATE.player),
            gold,
            stats: { ...clone(INITIAL_STATE.player.stats), total_gold: 91 },
            eventChainProgress: { [costCase.chainId]: costCase.step },
        },
        gameState: GS.EVENT,
        currentEvent: {
            ...clone(stepData.event),
            _chainId: costCase.chainId,
            _chainStep: costCase.step,
        },
        logs: [{ id: 'before', type: 'info', text: '이전 로그' }],
        syncStatus: 'synced',
        ...overrides,
    };
};

const payloadFor = ({ chainId, step, choiceIndex }) => ({ chainId, step, choiceIndex });

const resolve = (state, payload) => gameReducer(state, {
    type: AT.RESOLVE_CHAIN_GOLD_CHOICE,
    payload,
});

test('canonical negative-gold chain choice census is exactly the two literal costs', () => {
    const actual = EVENT_CHAINS.flatMap((chain) => chain.steps.flatMap((stepData) => (
        stepData.event.outcomes.flatMap((outcome, choiceIndex) => (
            outcome?.reward?.type === 'gold' && outcome.reward.amount < 0
                ? [{ chainId: chain.id, step: stepData.step, choiceIndex, cost: -outcome.reward.amount }]
                : []
        ))
    )));
    assert.deepEqual(actual, COST_CASES);
});

test('shadow guild market names the exact rare relic included in its atomic purchase', () => {
    const costCase = COST_CASES[1];
    const outcome = canonicalStep(costCase).event.outcomes[costCase.choiceIndex];
    assert.equal(outcome.reward.relicId, 'merchant_seal');
    assert.match(canonicalStep(costCase).event.desc, /상인의 인장/);
    assert.match(outcome.log, /상인의 인장/);
});

for (const costCase of COST_CASES) {
    test(`${costCase.chainId} hook delegates its ${costCase.cost} gold choice as one identity-only action`, () => {
        const state = buildState(costCase, costCase.cost);
        const dispatches = [];
        const logs = [];

        createEventActions({
            player: state.player,
            currentEvent: state.currentEvent,
            dispatch: (action) => dispatches.push(action),
            addLog: (type, text) => logs.push({ type, text }),
            getFullStats: () => ({ maxHp: state.player.maxHp, maxMp: state.player.maxMp }),
        }, { emitUnlockedTitles: () => {} }).handleEventChoice(costCase.choiceIndex);

        assert.deepEqual(dispatches, [{
            type: AT.RESOLVE_CHAIN_GOLD_CHOICE,
            payload: payloadFor(costCase),
        }]);
        assert.deepEqual(logs, []);
    });

    test(`${costCase.chainId} cannot create negative gold or false progress through the hook`, () => {
        let state = buildState(costCase, costCase.cost - 1);
        createEventActions({
            player: state.player,
            currentEvent: state.currentEvent,
            dispatch: (action) => { state = gameReducer(state, action); },
            addLog: () => {},
            getFullStats: () => ({ maxHp: state.player.maxHp, maxMp: state.player.maxMp }),
        }, { emitUnlockedTitles: () => {} }).handleEventChoice(costCase.choiceIndex);

        assert.equal(state.player.gold, costCase.cost - 1);
        assert.equal(state.player.eventChainProgress[costCase.chainId], costCase.step);
        assert.equal(state.gameState, GS.EVENT);
        assert.notEqual(state.currentEvent, null);
    });

    test(`${costCase.chainId} insufficient funds keep the story open and dedupe deterministic feedback`, () => {
        const state = buildState(costCase, costCase.cost - 1);
        const rejected = resolve(state, payloadFor(costCase));

        assert.equal(rejected.player.gold, costCase.cost - 1);
        assert.equal(rejected.player.eventChainProgress[costCase.chainId], costCase.step);
        assert.strictEqual(rejected.currentEvent, state.currentEvent);
        assert.equal(rejected.gameState, GS.EVENT);
        assert.deepEqual(rejected.logs.slice(0, -1), state.logs);
        assert.deepEqual(rejected.logs.at(-1), {
            id: `chain-gold-insufficient:${costCase.chainId}:${costCase.step}:${costCase.choiceIndex}`,
            type: 'error',
            text: '골드가 부족합니다.',
        });
        assert.strictEqual(resolve(rejected, payloadFor(costCase)), rejected);
    });

    for (const [startingGold, expectedGold] of [
        [costCase.cost, 0],
        [costCase.chainId === 'last_hero' ? 301 : 2500, costCase.chainId === 'last_hero' ? 1 : 500],
    ]) {
        test(`${costCase.chainId} settles ${startingGold} gold from canonical current state`, () => {
            const state = buildState(costCase, startingGold);
            const outcome = canonicalStep(costCase).event.outcomes[costCase.choiceIndex];
            const settled = resolve(state, payloadFor(costCase));

            assert.equal(settled.player.gold, expectedGold);
            assert.equal(settled.player.stats.total_gold, state.player.stats.total_gold);
            assert.equal(settled.player.eventChainProgress[costCase.chainId], costCase.step + 1);
            assert.deepEqual(settled.logs.slice(0, -1), state.logs);
            assert.deepEqual(settled.logs.at(-1), {
                id: `chain-gold:${costCase.chainId}:${costCase.step}:${costCase.choiceIndex}`,
                type: 'event',
                text: outcome.log,
            });
            assert.equal(settled.currentEvent, null);
            assert.equal(settled.gameState, GS.IDLE);
            assert.equal(settled.syncStatus, 'syncing');
            assert.strictEqual(resolve(settled, payloadFor(costCase)), settled);
        });
    }
}

test('payload must contain exactly the three validated identity keys', () => {
    const costCase = COST_CASES[0];
    const state = buildState(costCase, costCase.cost);
    const malformed = [
        undefined,
        null,
        [],
        {},
        { chainId: '', step: 0, choiceIndex: 0 },
        { chainId: '   ', step: 0, choiceIndex: 0 },
        { chainId: costCase.chainId, step: -1, choiceIndex: 0 },
        { chainId: costCase.chainId, step: 0.5, choiceIndex: 0 },
        { chainId: costCase.chainId, step: 0, choiceIndex: -1 },
        { chainId: costCase.chainId, step: 0, choiceIndex: Number.MAX_SAFE_INTEGER + 1 },
        { ...payloadFor(costCase), cost: costCase.cost },
        { ...payloadFor(costCase), log: '위조 로그' },
    ];

    for (const payload of malformed) assert.strictEqual(resolve(state, payload), state);
});

test('stale, forged, and non-cost identities are exact state-object no-ops', () => {
    const costCase = COST_CASES[0];
    const state = buildState(costCase, costCase.cost);
    assert.strictEqual(resolve(state, { ...payloadFor(costCase), chainId: 'shadow_guild' }), state);
    assert.strictEqual(resolve(state, { ...payloadFor(costCase), step: 1 }), state);
    assert.strictEqual(resolve(state, { ...payloadFor(costCase), choiceIndex: 1 }), state);
    const idle = { ...state, gameState: GS.IDLE };
    assert.strictEqual(resolve(idle, payloadFor(costCase)), idle);

    const staleProgress = {
        ...state,
        player: {
            ...state.player,
            eventChainProgress: { [costCase.chainId]: costCase.step + 1 },
        },
    };
    assert.strictEqual(resolve(staleProgress, payloadFor(costCase)), staleProgress);
});

test('canonical event comparison ignores object key order but rejects semantic mutation', () => {
    const costCase = COST_CASES[1];
    const state = buildState(costCase, costCase.cost);
    const reordered = {
        ...state,
        currentEvent: {
            _chainStep: costCase.step,
            outcomes: state.currentEvent.outcomes.map((outcome) => ({
                reward: outcome.reward && Object.fromEntries(Object.entries(outcome.reward).reverse()),
                log: outcome.log,
                type: outcome.type,
            })),
            desc: state.currentEvent.desc,
            choices: [...state.currentEvent.choices],
            title: state.currentEvent.title,
            _chainId: costCase.chainId,
        },
    };
    assert.equal(resolve(reordered, payloadFor(costCase)).player.gold, 0);

    for (const currentEvent of [
        { ...state.currentEvent, choices: ['위조 선택', ...state.currentEvent.choices.slice(1)] },
        {
            ...state.currentEvent,
            outcomes: state.currentEvent.outcomes.map((outcome, index) => (
                index === costCase.choiceIndex
                    ? { ...outcome, reward: { type: 'gold', amount: -1 } }
                    : outcome
            )),
        },
        {
            ...state.currentEvent,
            outcomes: state.currentEvent.outcomes.map((outcome, index) => (
                index === costCase.choiceIndex ? { ...outcome, log: '위조 로그' } : outcome
            )),
        },
        { ...state.currentEvent, forged: true },
    ]) {
        const forged = { ...state, currentEvent };
        assert.strictEqual(resolve(forged, payloadFor(costCase)), forged);
    }
});

test('shadow guild market grants the promised relic once at the exact gold boundary', () => {
    const costCase = COST_CASES[1];
    const state = buildState(costCase, costCase.cost);
    const settled = resolve(state, payloadFor(costCase));

    assert.equal(settled.player.gold, 0);
    assert.deepEqual(settled.player.relics.map((relic) => relic.id), ['merchant_seal']);
    assert.equal(settled.player.stats.relicCount, 1);
    assert.strictEqual(resolve(settled, payloadFor(costCase)), settled);
});

test('shadow guild market keeps the event open when the relic is owned or slots are full', () => {
    const costCase = COST_CASES[1];
    const merchantSeal = { id: 'merchant_seal', name: '상인의 인장' };
    const owned = buildState(costCase, costCase.cost, {
        player: {
            ...buildState(costCase, costCase.cost).player,
            relics: [merchantSeal],
        },
    });
    const ownedRejected = resolve(owned, payloadFor(costCase));
    assert.equal(ownedRejected.player.gold, costCase.cost);
    assert.strictEqual(ownedRejected.currentEvent, owned.currentEvent);
    assert.match(ownedRejected.logs.at(-1).text, /이미 보유/);
    assert.strictEqual(resolve(ownedRejected, payloadFor(costCase)), ownedRejected);

    const full = buildState(costCase, costCase.cost, {
        player: {
            ...buildState(costCase, costCase.cost).player,
            relics: Array.from({ length: MAX_RELICS_PER_RUN }, (_unused, index) => ({
                id: `owned-${index}`,
                name: `보유 유물 ${index}`,
            })),
        },
    });
    const fullRejected = resolve(full, payloadFor(costCase));
    assert.equal(fullRejected.player.gold, costCase.cost);
    assert.strictEqual(fullRejected.currentEvent, full.currentEvent);
    assert.match(fullRejected.logs.at(-1).text, /유물 슬롯/);
    assert.strictEqual(resolve(fullRejected, payloadFor(costCase)), fullRejected);
});
