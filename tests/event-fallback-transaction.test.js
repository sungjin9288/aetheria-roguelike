import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import {
    STRUCTURED_FALLBACK_TRANSACTIONS,
    getStructuredFallbackTransaction,
} from '../src/data/structuredFallbackEvents.ts';
import { buildEventPackage, pickFallbackEvent } from '../src/utils/aiEventUtils.ts';
import { getEventChoicePreview } from '../src/utils/eventPresentation.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';

const clone = (value) => structuredClone(value);

const trustedEvent = (transactionId) => {
    const transaction = getStructuredFallbackTransaction(transactionId);
    assert.ok(transaction);
    return {
        ...clone(transaction.event),
        source: 'fallback',
        fallbackTransactionId: transactionId,
    };
};

const stateFor = (transactionId, player = {}) => ({
    ...clone(INITIAL_STATE),
    gameState: GS.EVENT,
    currentEvent: trustedEvent(transactionId),
    player: {
        ...clone(INITIAL_STATE.player),
        history: [],
        quests: [],
        titles: [],
        ...player,
        stats: {
            ...clone(INITIAL_STATE.player.stats),
            ...(player.stats || {}),
        },
    },
    logs: [],
});

const resolve = (state, transactionId, choiceIndex = 0) => gameReducer(state, {
    type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
    payload: { transactionId, choiceIndex },
});

test('fallback hook delegates the trusted cost choice as one identity-only reducer action', () => {
    const transactionId = 'fallback:suspicious-merchant-wager:v1';
    const dispatches = [];
    const player = { ...clone(INITIAL_STATE.player), gold: 500, history: [] };
    const actions = createEventActions({
        player,
        currentEvent: trustedEvent(transactionId),
        dispatch: (action) => dispatches.push(action),
        addLog: () => assert.fail('hook must not pre-apply transaction logs'),
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
        rng: () => 0.5,
    }, {
        emitUnlockedTitles: () => assert.fail('hook must not pre-apply titles'),
    });

    actions.handleEventChoice(0);

    assert.deepEqual(dispatches, [{
        type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
        payload: { transactionId, choiceIndex: 0 },
    }]);
    assert.equal(player.gold, 500);
    assert.deepEqual(player.history, []);
});

test('structured fallback transaction registry is the exact frozen three-case authority', () => {
    assert.equal(Object.isFrozen(STRUCTURED_FALLBACK_TRANSACTIONS), true);
    assert.deepEqual(
        STRUCTURED_FALLBACK_TRANSACTIONS.map((entry) => ({
            id: entry.id,
            choiceIndex: entry.choiceIndex,
            cost: entry.cost,
            grossGold: entry.grossGold,
            netGold: entry.netGold,
        })),
        [
            {
                id: 'fallback:wounded-merchant:v1',
                choiceIndex: 0,
                cost: { type: 'hp-recovery-consumable', amount: 1 },
                grossGold: 200,
                netGold: 200,
            },
            {
                id: 'fallback:suspicious-merchant-wager:v1',
                choiceIndex: 0,
                cost: { type: 'gold', amount: 500 },
                grossGold: 1000,
                netGold: 500,
            },
            {
                id: 'fallback:destiny-dice-wager:v1',
                choiceIndex: 0,
                cost: { type: 'gold', amount: 720 },
                grossGold: 1440,
                netGold: 720,
            },
        ],
    );
});

test('wounded merchant requires and consumes the cheapest canonical HP recovery potion once', () => {
    const id = 'fallback:wounded-merchant:v1';
    const expensive = { id: 'expensive', name: '상급 체력 물약', type: 'hp', val: 300, price: 150 };
    const cheapest = { name: '하급 체력 물약', type: 'hp', val: 50, price: 30 };
    const middle = { id: 'middle', name: '중급 체력 물약', type: 'hp', val: 150, price: 80 };
    const initial = stateFor(id, {
        gold: 10,
        inv: [expensive, cheapest, middle],
        challengeModifiers: ['noPotion'],
        stats: { total_gold: 7 },
    });
    initial.quickSlots = [expensive, cheapest, middle];

    const settled = resolve(initial, id);

    assert.equal(settled.player.gold, 210);
    assert.equal(settled.player.stats.total_gold, 207);
    assert.deepEqual(settled.player.inv.map((item) => item.name), ['상급 체력 물약', '중급 체력 물약']);
    assert.deepEqual(settled.quickSlots, [expensive, null, middle]);
    assert.equal(settled.currentEvent, null);
    assert.equal(settled.gameState, GS.IDLE);
    assert.equal(settled.syncStatus, 'syncing');
    assert.equal(settled.player.history.length, 1);
    assert.equal(resolve(settled, id), settled);
});

test('missing HP recovery potion keeps the event open and dedupes the requirement error', () => {
    const id = 'fallback:wounded-merchant:v1';
    const initial = stateFor(id, {
        gold: 10,
        inv: [{ id: 'mana', name: '하급 마나 물약', type: 'mp', val: 30 }],
    });

    const rejected = resolve(initial, id);
    assert.notEqual(rejected, initial);
    assert.equal(rejected.player.gold, 10);
    assert.deepEqual(rejected.player.inv, initial.player.inv);
    assert.equal(rejected.currentEvent?.fallbackTransactionId, id);
    assert.equal(rejected.gameState, GS.EVENT);
    assert.match(rejected.logs.at(-1).text, /체력 회복 물약/);
    assert.equal(resolve(rejected, id), rejected);
});

for (const wager of [
    { id: 'fallback:suspicious-merchant-wager:v1', cost: 500, gross: 1000, net: 500 },
    { id: 'fallback:destiny-dice-wager:v1', cost: 720, gross: 1440, net: 720 },
]) {
    test(`${wager.id} rejects below cost and settles exact boundary with net-only stats`, () => {
        for (const startingGold of [0, wager.cost - 1]) {
            const below = stateFor(wager.id, { gold: startingGold, stats: { total_gold: 31 } });
            const rejected = resolve(below, wager.id);
            assert.equal(rejected.player.gold, startingGold);
            assert.equal(rejected.currentEvent?.fallbackTransactionId, wager.id);
            assert.equal(rejected.gameState, GS.EVENT);
            assert.match(rejected.logs.at(-1).text, /골드가 부족/);
            assert.equal(resolve(rejected, wager.id), rejected);
        }

        const exact = stateFor(wager.id, { gold: wager.cost, stats: { total_gold: 31 } });
        const settled = resolve(exact, wager.id);
        assert.equal(settled.player.gold, wager.gross);
        assert.equal(settled.player.stats.total_gold, 31 + wager.net);
        assert.equal(settled.currentEvent, null);
        assert.equal(settled.gameState, GS.IDLE);
        assert.equal(resolve(settled, wager.id), settled);
    });
}

test('fallback transaction payload and canonical event identity fail closed on stale or forged actions', () => {
    const id = 'fallback:suspicious-merchant-wager:v1';
    const state = stateFor(id, { gold: 500 });
    const cases = [
        { transactionId: id },
        { transactionId: id, choiceIndex: 0, extra: true },
        { transactionId: 'fallback:unknown:v1', choiceIndex: 0 },
        { transactionId: id, choiceIndex: 1 },
    ];
    for (const payload of cases) {
        assert.equal(gameReducer(state, { type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION, payload }), state);
    }

    const mutated = clone(state);
    mutated.currentEvent.outcomes[0].gold = 9999;
    assert.equal(resolve(mutated, id), mutated);

    const aiSpoof = clone(state);
    aiSpoof.currentEvent.source = 'ai';
    assert.equal(resolve(aiSpoof, id), aiSpoof);
});

test('untrusted event packages cannot own source or reserved fallback transaction fields', () => {
    const packaged = buildEventPackage({
        source: 'fallback',
        fallbackTransactionId: 'fallback:suspicious-merchant-wager:v1',
        cost: { type: 'gold', amount: 1 },
        grossGold: 999999,
        netGold: 999999,
        desc: '외부 이벤트',
        choices: ['받아들인다', '거절한다'],
        outcomes: [{ choiceIndex: 0, gold: 999999, log: '외부 보상' }],
    }, { source: 'ai', location: '고요한 숲', level: 1 });

    assert.equal(packaged.source, 'ai');
    assert.equal('fallbackTransactionId' in packaged, false);
    assert.equal('cost' in packaged, false);
    assert.equal('grossGold' in packaged, false);
    assert.equal('netGold' in packaged, false);
});

test('only locally selected canonical fallback events receive trusted transaction identity', () => {
    const discovered = new Set();
    for (let index = 0; index < 1000; index += 1) {
        const draws = [0, (index + 0.5) / 1000];
        const event = pickFallbackEvent('고요한 숲', [], { level: 1 }, () => draws.shift() ?? 0.5);
        if (event?.fallbackTransactionId) discovered.add(event.fallbackTransactionId);
    }
    assert.deepEqual([...discovered].sort(), STRUCTURED_FALLBACK_TRANSACTIONS.map((entry) => entry.id).sort());
});

test('malformed current gold or tracked total is rejected before resource mutation', () => {
    const id = 'fallback:suspicious-merchant-wager:v1';
    for (const player of [
        { gold: Number.NaN },
        { gold: 500, stats: { total_gold: '31' } },
    ]) {
        const state = stateFor(id, player);
        assert.equal(resolve(state, id), state);
    }
});

test('costed fallback previews state the actual resource, gross payout, and net gain', () => {
    const expected = [
        ['fallback:wounded-merchant:v1', '보유한 회복 물약 중 가장 값싼 것 1개 소모 · 골드 200 획득'],
        ['fallback:suspicious-merchant-wager:v1', '골드 500 소모 · 1000 획득 · 순증가 500'],
        ['fallback:destiny-dice-wager:v1', '골드 720 소모 · 1440 획득 · 순증가 720'],
    ];
    for (const [id, text] of expected) {
        const event = trustedEvent(id);
        assert.deepEqual(getEventChoicePreview(event, 0), { text, tone: 'danger' });
    }
});
