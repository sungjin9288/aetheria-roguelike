import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { MSG } from '../src/data/messages.ts';
import {
    STRUCTURED_FALLBACK_TRANSACTIONS,
    getStructuredFallbackTransaction,
} from '../src/data/structuredFallbackEvents.ts';
import { buildEventPackage, pickFallbackEvent } from '../src/utils/aiEventUtils.ts';
import { formatEventText, getEventChoicePreview } from '../src/utils/eventPresentation.ts';
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

// 2026-10 Wave 62 C18: 내기 거래는 훅이 굴린 승패 난수(`roll`)를 싣는다 — 기본값 0은 이기는 판이다(roll < winChance).
const resolve = (state, transactionId, choiceIndex = 0, roll = 0) => gameReducer(state, {
    type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
    payload: {
        transactionId,
        choiceIndex,
        ...(getStructuredFallbackTransaction(transactionId)?.chance ? { roll } : {}),
    },
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

    // Wave 62 C18: 내기의 승패 난수는 훅이 굴려 함께 넘긴다(리듀서는 난수를 부르지 않는다).
    assert.deepEqual(dispatches, [{
        type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
        payload: { transactionId, choiceIndex: 0, roll: 0.5 },
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
            winChance: entry.chance?.winChance ?? null,
        })),
        [
            {
                id: 'fallback:wounded-merchant:v1',
                choiceIndex: 0,
                cost: { type: 'hp-recovery-consumable', amount: 1 },
                grossGold: 200,
                netGold: 200,
                winChance: null,
            },
            {
                id: 'fallback:suspicious-merchant-wager:v1',
                choiceIndex: 0,
                cost: { type: 'gold', amount: 500 },
                grossGold: 1000,
                netGold: 500,
                winChance: 0.5,
            },
            {
                id: 'fallback:destiny-dice-wager:v1',
                choiceIndex: 0,
                cost: { type: 'gold', amount: 720 },
                grossGold: 1440,
                netGold: 720,
                winChance: 0.5,
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

        // Wave 62 C18: 지는 판 — 판돈만 나가고 지급 · 누적 골드는 없다. 결과 문구는 원장의 진 문구다.
        const lost = resolve(exact, wager.id, 0, 0.99);
        assert.equal(lost.player.gold, 0);
        assert.equal(lost.player.stats.total_gold, 31);
        assert.equal(lost.currentEvent, null);
        assert.equal(lost.gameState, GS.IDLE);
        assert.equal(lost.logs.at(-1).text, formatEventText(getStructuredFallbackTransaction(wager.id).chance.lossLog));
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
        // Wave 62 C18: 내기 거래는 승패 난수가 있어야 하고, 난수는 [0, 1)이어야 한다.
        { transactionId: id, choiceIndex: 0 },
        { transactionId: id, choiceIndex: 0, roll: 1 },
        { transactionId: id, choiceIndex: 0, roll: -0.1 },
        { transactionId: id, choiceIndex: 0, roll: Number.NaN },
    ];
    for (const payload of cases) {
        assert.equal(gameReducer(state, { type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION, payload }), state);
    }

    // Wave 27 N1: 정본이 아닌 이벤트는 지급하지 않되 무반응(동일 참조)이 아니다 — 훅이 실제로
    //   이 조합을 보낼 수 있으므로(변조·구 세이브의 패딩 3선택지) 이벤트 화면에 무효 제안을 보인다.
    const mutated = clone(state);
    mutated.currentEvent.outcomes[0].gold = 9999;
    const rejected = resolve(mutated, id);
    assert.equal(rejected.player.gold, mutated.player.gold);
    assert.equal(rejected.player.stats.total_gold, mutated.player.stats.total_gold);
    assert.equal(rejected.gameState, GS.EVENT);
    assert.equal(rejected.currentEvent?.fallbackTransactionId, id);
    assert.deepEqual(rejected.currentEvent.choiceFeedback, { choiceIndex: 0, text: MSG.EVENT_CHOICE_OFFER_INVALID });
    assert.equal(rejected.logs.at(-1).text, MSG.EVENT_CHOICE_OFFER_INVALID);
    assert.equal(resolve(rejected, id), rejected);

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
        if (!event?.fallbackTransactionId) continue;
        discovered.add(event.fallbackTransactionId);
        // Wave 27 N1: 뽑기만 하고 해소하지 않던 행이다(정본 2선택지만 해소해 파이프라인의
        //   3선택지 무반응을 놓쳤다). 뽑힌 그 이벤트를 그대로 리듀서에 넣어 지급까지 본다.
        const transaction = getStructuredFallbackTransaction(event.fallbackTransactionId);
        const opened = { ...stateFor(transaction.id, { gold: 5000, inv: [{ name: '하급 체력 물약', type: 'hp', val: 50 }] }), currentEvent: event };
        const settled = resolve(opened, transaction.id, transaction.choiceIndex);
        assert.equal(settled.currentEvent, null, `${transaction.id}: 파이프라인 이벤트가 정산된다`);
        const goldCost = transaction.cost.type === 'gold' ? transaction.cost.amount : 0;
        assert.equal(settled.player.gold, 5000 - goldCost + transaction.grossGold);
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
        // Wave 62 C18: 내기는 결과가 아니라 판돈 · 지급액 · 승률을 말한다.
        ['fallback:suspicious-merchant-wager:v1', '판돈 골드 500 · 이기면 골드 1000 · 승률 50% · 결과는 굴린 뒤에 드러남'],
        ['fallback:destiny-dice-wager:v1', '판돈 골드 720 · 이기면 골드 1440 · 승률 50% · 결과는 굴린 뒤에 드러남'],
    ];
    for (const [id, text] of expected) {
        const event = trustedEvent(id);
        assert.deepEqual(getEventChoicePreview(event, 0), { text, tone: 'danger' });
    }
});
