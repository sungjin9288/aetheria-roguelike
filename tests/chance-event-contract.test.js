import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.ts';
import {
    STRUCTURED_FALLBACK_HIDDEN_EVENTS,
    STRUCTURED_FALLBACK_TRANSACTIONS,
    didFallbackTransactionPay,
    findStructuredFallbackHiddenEvent,
    getShuffledSlotLayout,
} from '../src/data/structuredFallbackEvents.ts';
import { pickFallbackEvent } from '../src/utils/aiEventUtils.ts';
import { formatEventText, getEventChoicePreview } from '../src/utils/eventPresentation.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';
import EventPanel from '../src/components/EventPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 62 C18 (원장 §61.4 · 소유자 답 §61.6 "전부 설명대로 — 확률로, 미리보기에서 결과를 숨긴다").
 *
 * 운을 말하는 폴백 이벤트가 실제로는 확정 결과였다:
 *  - 내기 둘(수상한 상인 · 운명의 주사위)은 언제나 순증가 500 · 720이었고 미리보기가 그 결과를 말했다.
 *  - 카드 트릭은 "세 장 중 한 장"이라 하면서 정해진 두 자리가 300골드를 줬고, 크리스탈 퍼즐은 늘 오른쪽이 폭발했다.
 *  - 미리보기는 선택지마다 결과를 읽어 이기는 자리를 가리켰다("1 + 2 + … + 10" 퍼즐도 정답 칸에만 "보상 가능").
 *
 * 계약:
 *  ① 운 · 추측을 말하는 풀 이벤트는 전부 원장(`structuredFallbackEvents`)이 소유한다.
 *  ② 내기의 승률은 원장의 `winChance`이고, 기대 순증가는 0이다(맞내기). 판정 난수는 payload `roll`이다 — 리듀서는 결정론적이다.
 *  ③ 섞는 이벤트(카드 · 크리스탈)는 한 판에 이기는 자리가 칸 구성 그대로(카드는 정확히 한 장)이고, 어느 선택지든 칸마다 1/n이다.
 *  ④ 미리보기는 이기는 선택지를 가리키지 않는다 — 숨김 이벤트는 모든 선택지가 같은 문장, 내기는 결과가 아니라 승률을 말한다.
 *  ⑤ 답을 계산할 수 있는 퍼즐은 운이 아니다 — 정답은 언제나 맞고, 미리보기만 숨긴다.
 */

const LOCATION = '고요한 숲';
const clone = (value) => structuredClone(value);

/** 결정론적 난수(mulberry32) — 시드가 같으면 같은 수열이다. */
const seededRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));

const CHANCE_TRANSACTIONS = STRUCTURED_FALLBACK_TRANSACTIONS.filter((tx) => tx.chance);
const SHUFFLE_EVENTS = STRUCTURED_FALLBACK_HIDDEN_EVENTS.filter((entry) => entry.layout === 'shuffle');
const FIXED_EVENTS = STRUCTURED_FALLBACK_HIDDEN_EVENTS.filter((entry) => entry.layout === 'fixed');

// pickFallbackEvent의 두 롤: ① 구조화 풀 혼합(0 → 항상 섞임) ② 후보 인덱스.
const PICK_SLOTS = 1000;
const pickDraws = (slot) => [0, (slot + 0.5) / PICK_SLOTS];

/** 실제 생산자(pickFallbackEvent)가 이 desc의 이벤트를 내보내는 판을 찾아 그 이벤트를 돌려준다. */
const pickEventByDesc = (desc) => {
    for (let slot = 0; slot < PICK_SLOTS; slot += 1) {
        const draws = pickDraws(slot);
        const event = pickFallbackEvent(LOCATION, [], { level: 10 }, () => draws.shift() ?? 0.5);
        if (event?.desc === desc) return event;
    }
    return null;
};

const basePlayer = (overrides = {}) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base,
        name: '운 시험자',
        loc: LOCATION,
        level: 10,
        hp: 150,
        maxHp: 400,
        mp: 0,
        maxMp: 200,
        gold: 5000,
        inv: [],
        history: [],
        quests: [],
        titles: [],
        ...overrides,
        stats: { ...base.stats, ...(overrides.stats || {}) },
    };
};

/** EventPanel 버튼 → 실제 handleEventChoice → 실제 리듀서. 로그는 훅이 남긴 것과 리듀서가 남긴 것을 함께 모은다. */
const press = (state, choiceIndex, rng) => {
    let current = state;
    const logs = [];
    const dispatch = (action) => { current = gameReducer(current, action); };
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch,
        addLog: (type, text) => logs.push({ type, text }),
        getFullStats: () => calculateFullStats(state.player),
        rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return { state: current, logs: [...logs, ...current.logs.slice(state.logs.length)] };
};

const openState = (event, playerOverrides = {}) => ({
    ...clone(INITIAL_STATE),
    gameState: GS.EVENT,
    currentEvent: clone(event),
    player: basePlayer(playerOverrides),
    logs: [],
});

const renderedPreviews = (event) => {
    const html = renderStatic(createElement(EventPanel, {
        currentEvent: event,
        actions: { handleEventChoice: () => {}, dismissEvent: () => {} },
        location: LOCATION,
    }));
    return event.choices.map((_choice, choiceIndex) => {
        const marker = `data-testid="event-choice-preview-${choiceIndex}"`;
        const start = html.indexOf(marker);
        assert.ok(start >= 0, `선택 ${choiceIndex}의 미리보기가 그려져야 한다`);
        return html.slice(html.indexOf('>', start) + 1, html.indexOf('</div>', start)).replace(/<[^>]+>/g, '');
    });
};

/** 이번 판의 결과 줄(훅이 남긴 사건 로그). */
const resultTextOf = (logs) => {
    const texts = logs.filter((log) => log.type === 'event').map((log) => log.text);
    assert.equal(texts.length, 1, `결과 줄은 하나다: ${texts.join(' / ')}`);
    return texts[0];
};

// ── ① 소유 ───────────────────────────────────────────────────────────────

// 운 · 추측을 말하는 문구 — 판돈을 걸거나("걸면" · "걸어보") 섞인 것 중 하나를 고르는 사건.
const CHANCE_DESC = /주사위|카드|내기|걸면|걸어보|중 하나에|중 한 장|노름/;

test('① 운 · 추측을 말하는 폴백 풀 이벤트는 전부 원장이 소유한다(내기 거래 또는 숨김 이벤트)', () => {
    const pool = Object.values(FALLBACK_EVENT_POOL).flat();
    const chanceFramed = pool.filter((entry) => CHANCE_DESC.test(entry.desc));
    assert.ok(chanceFramed.length >= 4, '카드 · 크리스탈 · 두 내기가 표본에 있다');
    for (const entry of chanceFramed) {
        const tx = STRUCTURED_FALLBACK_TRANSACTIONS.find((candidate) => candidate.id === entry.fallbackTransactionId);
        const hidden = findStructuredFallbackHiddenEvent({ ...entry, source: 'fallback' });
        assert.ok(tx?.chance || hidden, `${entry.desc}: 운을 말하는 사건은 확률을 원장에 선언해야 한다`);
    }
    // 원장의 운 · 추측 이벤트는 모두 풀에 정확히 한 번 들어 있고, 실제 생산자가 내보낸다.
    for (const desc of [...CHANCE_TRANSACTIONS.map((tx) => tx.event.desc), ...STRUCTURED_FALLBACK_HIDDEN_EVENTS.map((e) => e.event.desc)]) {
        assert.equal(pool.filter((entry) => entry.desc === desc).length, 1, desc);
        assert.ok(pickEventByDesc(desc), `${desc}: pickFallbackEvent가 내보낼 수 있다`);
    }
    assert.deepEqual(CHANCE_TRANSACTIONS.map((tx) => tx.id).sort(), [
        'fallback:destiny-dice-wager:v1',
        'fallback:suspicious-merchant-wager:v1',
    ]);
    assert.deepEqual(STRUCTURED_FALLBACK_HIDDEN_EVENTS.map((entry) => [entry.id, entry.layout]), [
        ['fallback:three-card-trick:v1', 'shuffle'],
        ['fallback:resonance-crystals:v1', 'shuffle'],
        ['fallback:treasure-chest-cipher:v1', 'fixed'],
    ]);
});

// ── ② 내기 ───────────────────────────────────────────────────────────────

test('② 내기의 승률은 원장의 winChance이고 기대 순증가는 0이다(맞내기 — 판돈과 같은 금액을 걸고 이기면 두 배)', () => {
    for (const tx of CHANCE_TRANSACTIONS) {
        assert.equal(tx.cost.type, 'gold');
        assert.ok(tx.chance.winChance > 0 && tx.chance.winChance < 1, `${tx.id}: 이길 수도 질 수도 있다`);
        assert.equal(tx.chance.winChance * tx.grossGold - tx.cost.amount, 0, `${tx.id}: 기대 순증가 0`);
        // 판정: roll < winChance면 이긴다 — [0, 1) 격자에서 이기는 비율이 정확히 winChance다.
        const N = 10_000;
        let wins = 0;
        for (let i = 0; i < N; i += 1) if (didFallbackTransactionPay(tx, (i + 0.5) / N)) wins += 1;
        assert.ok(Math.abs(wins / N - tx.chance.winChance) <= 1 / N, `${tx.id}: ${wins}/${N}`);
        assert.equal(didFallbackTransactionPay(tx, undefined), false, '난수가 없으면 지급하지 않는다');
    }
    const wounded = STRUCTURED_FALLBACK_TRANSACTIONS.find((tx) => !tx.chance);
    assert.equal(didFallbackTransactionPay(wounded, undefined), true, '내기가 아닌 거래는 언제나 지급한다');
});

for (const tx of CHANCE_TRANSACTIONS) {
    test(`② ${tx.id}: 실제 파이프라인(훅 → 리듀서)에서 승률이 선언과 맞고, 지면 판돈만 잃는다`, () => {
        const event = pickEventByDesc(tx.event.desc);
        assert.equal(event?.fallbackTransactionId, tx.id);
        const rng = seededRandom(0xC18 + tx.cost.amount);
        const RUNS = 2000;
        let wins = 0;
        for (let run = 0; run < RUNS; run += 1) {
            const opened = openState(event, { stats: { total_gold: 40 } });
            const { state } = press(opened, tx.choiceIndex, rng);
            assert.equal(state.currentEvent, null);
            assert.equal(state.gameState, GS.IDLE);
            const won = state.player.gold === opened.player.gold - tx.cost.amount + tx.grossGold;
            const lost = state.player.gold === opened.player.gold - tx.cost.amount;
            assert.ok(won !== lost, `판 ${run}: 이기거나 지거나 둘 중 하나다 (${state.player.gold})`);
            assert.equal(state.player.stats.total_gold, 40 + (won ? tx.netGold : 0));
            const expectedLog = formatEventText(won ? tx.event.outcomes[tx.choiceIndex].log : tx.chance.lossLog);
            assert.equal(state.logs.at(-1).text, expectedLog);
            if (won) wins += 1;
        }
        // 이항 표준편차 √(p(1-p)/N) ≈ 0.011 — 시드가 고정이라 흔들리지 않고, 4σ 안을 요구한다.
        assert.ok(Math.abs(wins / RUNS - tx.chance.winChance) < 0.045, `${tx.id}: ${wins}/${RUNS}`);
        assert.ok(wins > 0 && wins < RUNS, '이기는 판과 지는 판이 모두 나온다');
    });

    test(`② ${tx.id}: 리듀서는 결정론적이다 — 같은 상태 · 같은 roll은 같은 결과, Math.random을 부르지 않는다`, () => {
        const event = pickEventByDesc(tx.event.desc);
        const original = Math.random;
        Math.random = () => { throw new Error('reducer must not call Math.random'); };
        try {
            for (const [roll, paid] of [[0, true], [tx.chance.winChance - 1e-9, true], [tx.chance.winChance, false], [0.999, false]]) {
                const opened = openState(event, { gold: 1000 });
                const action = { type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION, payload: { transactionId: tx.id, choiceIndex: tx.choiceIndex, roll } };
                const first = gameReducer(opened, action);
                const second = gameReducer(clone(opened), action);
                assert.deepEqual(second.player, first.player, `roll ${roll}: 같은 결과`);
                assert.equal(first.player.gold, 1000 - tx.cost.amount + (paid ? tx.grossGold : 0), `roll ${roll}`);
                assert.equal(didFallbackTransactionPay(tx, roll), paid);
            }
        } finally {
            Math.random = original;
        }
    });

    test(`② ${tx.id}: 훅은 rng로 굴린 roll을 payload에 싣고, 리듀서는 roll 없는 내기 · roll 있는 비내기를 거부한다`, () => {
        const event = pickEventByDesc(tx.event.desc);
        const dispatched = [];
        createEventActions({
            player: basePlayer(),
            currentEvent: event,
            dispatch: (action) => dispatched.push(action),
            addLog: () => {},
            getFullStats: () => ({ maxHp: 400, maxMp: 200 }),
            rng: () => 0.37,
        }, { emitUnlockedTitles: () => {} }).handleEventChoice(tx.choiceIndex);
        assert.deepEqual(dispatched, [{
            type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
            payload: { transactionId: tx.id, choiceIndex: tx.choiceIndex, roll: 0.37 },
        }]);

        const opened = openState(event);
        const missingRoll = { type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION, payload: { transactionId: tx.id, choiceIndex: tx.choiceIndex } };
        assert.strictEqual(gameReducer(opened, missingRoll), opened);

        const wounded = STRUCTURED_FALLBACK_TRANSACTIONS.find((candidate) => !candidate.chance);
        const woundedState = openState(pickEventByDesc(wounded.event.desc));
        const strayRoll = { type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION, payload: { transactionId: wounded.id, choiceIndex: wounded.choiceIndex, roll: 0.1 } };
        assert.strictEqual(gameReducer(woundedState, strayRoll), woundedState);
    });
}

// ── ③ 섞는 이벤트 ───────────────────────────────────────────────────────────

test('③ 칸 배치: 난수 하나가 n!개 배치 중 하나를 고르고, 모든 배치가 같은 너비를 갖는다', () => {
    for (const n of [1, 2, 3, 4]) {
        const total = factorial(n);
        const seen = new Set();
        for (let k = 0; k < total; k += 1) {
            const layout = getShuffledSlotLayout(n, (k + 0.5) / total);
            assert.deepEqual([...layout].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), '순열이다');
            seen.add(layout.join(','));
        }
        assert.equal(seen.size, total, `n=${n}: 배치 ${total}개가 모두 나온다`);
    }
    assert.deepEqual(getShuffledSlotLayout(3, 0), [0, 1, 2], '배치 0은 칸 i = 선택지 i');
    assert.deepEqual(getShuffledSlotLayout(3, Number.NaN), [0, 1, 2], '잘못된 난수는 배치 0');
    assert.deepEqual(getShuffledSlotLayout(3, 0.9999999), [2, 1, 0]);
});

for (const entry of SHUFFLE_EVENTS) {
    test(`③ ${entry.id}: 한 판에 이기는 자리 수는 칸 구성 그대로이고, 어느 선택지든 칸마다 1/n이다 (실제 훅)`, () => {
        const event = pickEventByDesc(entry.event.desc);
        assert.ok(event, '실제 생산자가 이 이벤트를 내보낸다');
        const n = entry.event.outcomes.length;
        assert.equal(event.choices.length, n);
        const total = factorial(n);
        const perChoiceSlot = Array.from({ length: n }, () => Array(n).fill(0));
        for (let k = 0; k < total; k += 1) {
            const roll = (k + 0.5) / total;
            const slotsThisDeal = [];
            const layout = getShuffledSlotLayout(n, roll);
            for (let choiceIndex = 0; choiceIndex < n; choiceIndex += 1) {
                const opened = openState(event);
                const { state, logs } = press(opened, choiceIndex, () => roll);
                const slot = layout[choiceIndex];
                const expected = entry.event.outcomes[slot];
                // 결과 = 이번 판 배치에서 그 자리의 칸(문장 · 골드 · 경험 · 생명 · 기력이 모두 그 칸의 것).
                assert.equal(resultTextOf(logs), formatEventText(expected.log), `roll ${roll} · 선택 ${choiceIndex}`);
                assert.equal(state.player.gold - opened.player.gold, expected.gold);
                if (expected.hp < 0) assert.equal(state.player.hp, opened.player.hp + expected.hp);
                if (expected.mp > 0) assert.equal(state.player.mp, opened.player.mp + expected.mp);
                perChoiceSlot[choiceIndex][slot] += 1;
                slotsThisDeal.push(slot);
            }
            // 한 판(같은 roll)에서 선택지들이 받는 칸은 칸 전체의 재배치다 — 카드라면 골드 칸은 정확히 한 자리.
            assert.deepEqual([...slotsThisDeal].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
        }
        for (let choiceIndex = 0; choiceIndex < n; choiceIndex += 1) {
            for (let slot = 0; slot < n; slot += 1) {
                assert.equal(perChoiceSlot[choiceIndex][slot], total / n, `선택 ${choiceIndex} · 칸 ${slot}: 1/${n}`);
            }
        }
    });
}

test('③ 카드 트릭: "세 장 중 한 장" — 판마다 골드 카드는 정확히 한 장이고, 시드 난수 3,000판의 적중률은 1/3이다', () => {
    const entry = SHUFFLE_EVENTS.find((candidate) => candidate.id === 'fallback:three-card-trick:v1');
    const goldSlots = entry.event.outcomes.filter((slot) => slot.gold > 0);
    assert.equal(goldSlots.length, 1, '골드 칸은 하나');
    const prize = goldSlots[0].gold;
    const event = pickEventByDesc(entry.event.desc);
    const rng = seededRandom(0x3CA2D);
    const RUNS = 3000;
    const winsByChoice = [0, 0, 0];
    const runsByChoice = [0, 0, 0];
    for (let run = 0; run < RUNS; run += 1) {
        const choiceIndex = run % 3;
        const opened = openState(event);
        const { state } = press(opened, choiceIndex, rng);
        const gain = state.player.gold - opened.player.gold;
        assert.ok(gain === 0 || gain === prize, `골드 변화는 0 또는 ${prize}: ${gain}`);
        runsByChoice[choiceIndex] += 1;
        if (gain === prize) winsByChoice[choiceIndex] += 1;
    }
    for (let choiceIndex = 0; choiceIndex < 3; choiceIndex += 1) {
        const rate = winsByChoice[choiceIndex] / runsByChoice[choiceIndex];
        // 1,000판의 이항 표준편차 ≈ 0.015 — 4σ 안.
        assert.ok(Math.abs(rate - 1 / 3) < 0.06, `카드 ${choiceIndex + 1}: ${winsByChoice[choiceIndex]}/${runsByChoice[choiceIndex]}`);
    }
});

test('③ 이전 세이브의 고정 배치(두 자리가 300골드)도 원장의 섞은 배치로 정산된다', () => {
    const entry = SHUFFLE_EVENTS.find((candidate) => candidate.id === 'fallback:three-card-trick:v1');
    const legacy = {
        ...clone(pickEventByDesc(entry.event.desc)),
        outcomes: [
            { choiceIndex: 0, gold: 300, exp: 0, hp: 0, mp: 0, log: '맞췄다! (+300G)' },
            { choiceIndex: 1, gold: 300, exp: 0, hp: 0, mp: 0, log: '맞췄다! (+300G)' },
            { choiceIndex: 2, gold: 0, exp: 0, hp: 0, mp: 0, log: '빈 카드다. 노름꾼이 쓴웃음을 짓는다.' },
        ],
    };
    // 이 판의 배치에서 골드 칸(0)이 셋째 자리에 있으면 첫째 · 둘째 카드는 빈 카드다.
    const roll = [...Array(6).keys()].map((k) => (k + 0.5) / 6).find((r) => getShuffledSlotLayout(3, r)[2] === 0);
    for (const choiceIndex of [0, 1]) {
        const opened = openState(legacy);
        const { state } = press(opened, choiceIndex, () => roll);
        assert.equal(state.player.gold, opened.player.gold, `옛 배치의 카드 ${choiceIndex + 1}이 확정 지급되지 않는다`);
    }
    assert.equal(press(openState(legacy), 2, () => roll).state.player.gold, 5000 + 300);
});

// ── ④ 미리보기 ───────────────────────────────────────────────────────────

test('④ 숨김 이벤트의 미리보기는 모든 선택지가 같은 문장이다 — 어느 선택지가 이기는지 가리키지 않는다 (실제 생산자 · EventPanel)', () => {
    for (const entry of STRUCTURED_FALLBACK_HIDDEN_EVENTS) {
        const event = pickEventByDesc(entry.event.desc);
        assert.ok(event, entry.id);
        const previews = event.choices.map((_choice, choiceIndex) => getEventChoicePreview(event, choiceIndex));
        for (const preview of previews) assert.deepEqual(preview, { text: entry.preview, tone: entry.tone }, entry.id);
        const rendered = renderedPreviews(event);
        assert.equal(new Set(rendered).size, 1, `${entry.id}: 그려지는 미리보기 줄이 모두 같다`);
        assert.ok(rendered[0].includes(entry.preview), rendered[0]);
        // 어떤 칸의 결과 문장도 미리보기에 나오지 않는다.
        for (const slot of entry.event.outcomes) assert.ok(!entry.preview.includes(formatEventText(slot.log)), slot.log);
    }
});

test('④ 숨김 이벤트의 미리보기는 걸린 것을 말한다 — 카드의 상금과 "한 장", 크리스탈의 폭발 위험, 퍼즐의 보상', () => {
    const byId = Object.fromEntries(STRUCTURED_FALLBACK_HIDDEN_EVENTS.map((entry) => [entry.id, entry.preview]));
    assert.match(byId['fallback:three-card-trick:v1'], /골드 300/);
    assert.match(byId['fallback:three-card-trick:v1'], /세 장 중 한 장/);
    assert.match(byId['fallback:resonance-crystals:v1'], /생명 손실 위험/);
    assert.match(byId['fallback:treasure-chest-cipher:v1'], /정답이면/);
});

test('④ 내기의 미리보기는 판돈 · 지급액 · 승률을 말하고 결과 문장을 말하지 않는다', () => {
    for (const tx of CHANCE_TRANSACTIONS) {
        const event = pickEventByDesc(tx.event.desc);
        const preview = getEventChoicePreview(event, tx.choiceIndex);
        assert.equal(preview.text, tx.preview);
        assert.ok(preview.text.includes(String(tx.cost.amount)), '판돈');
        assert.ok(preview.text.includes(String(tx.grossGold)), '이겼을 때 지급액');
        assert.ok(preview.text.includes(`${Math.round(tx.chance.winChance * 100)}%`), '승률');
        assert.ok(!preview.text.includes('순증가'), '확정 순증가를 말하지 않는다');
        assert.ok(!preview.text.includes(formatEventText(tx.event.outcomes[tx.choiceIndex].log)));
        assert.ok(renderedPreviews(event)[tx.choiceIndex].includes(tx.preview));
    }
});

test('④ AI 출처 이벤트는 같은 desc를 실어도 숨김 이벤트가 되지 않는다(출처는 호출자 권한)', () => {
    const entry = STRUCTURED_FALLBACK_HIDDEN_EVENTS[0];
    assert.equal(findStructuredFallbackHiddenEvent({ ...clone(entry.event), source: 'ai' }), null);
    assert.equal(findStructuredFallbackHiddenEvent({ ...clone(entry.event), source: 'fallback', choices: ['a', 'b', 'c'] }), null);
    assert.ok(findStructuredFallbackHiddenEvent({ ...clone(entry.event), source: 'fallback' }));
});

// ── ⑤ 풀 수 있는 퍼즐 ───────────────────────────────────────────────────────

for (const entry of FIXED_EVENTS) {
    test(`⑤ ${entry.id}: 답은 운이 아니다 — 정답은 어떤 난수에서도 보상을 주고 오답은 주지 않는다`, () => {
        const event = pickEventByDesc(entry.event.desc);
        assert.deepEqual(event.choices, ['45', '50', '55'], '숫자 선택지가 그대로 보인다(E14)');
        const html = renderStatic(createElement(EventPanel, {
            currentEvent: event,
            actions: { handleEventChoice: () => {}, dismissEvent: () => {} },
            location: LOCATION,
        }));
        for (const answer of ['45', '50', '55']) assert.ok(html.includes(answer), `선택지 '${answer}'가 그려진다`);

        const answerIndex = event.choices.indexOf(String([...Array(10).keys()].reduce((sum, i) => sum + i + 1, 0)));
        assert.equal(answerIndex, 2);
        for (const roll of [0, 0.25, 0.5, 0.99]) {
            event.choices.forEach((_choice, choiceIndex) => {
                const opened = openState(event);
                const { state } = press(opened, choiceIndex, () => roll);
                const gained = state.player.gold - opened.player.gold;
                if (choiceIndex === answerIndex) {
                    assert.equal(gained, entry.event.outcomes[answerIndex].gold, `roll ${roll}: 정답은 보상`);
                    assert.ok(state.player.inv.some((item) => item.name === entry.event.outcomes[answerIndex].item));
                } else {
                    assert.equal(gained, 0, `roll ${roll}: 오답 ${event.choices[choiceIndex]}은 보상 없음`);
                }
            });
        }
    });
}
