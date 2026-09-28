import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { MSG } from '../src/data/messages.ts';
import { STRUCTURED_FALLBACK_TRANSACTIONS } from '../src/data/structuredFallbackEvents.ts';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.ts';
import { buildEventPackage, pickFallbackEvent } from '../src/utils/aiEventUtils.ts';
import { formatEventText, getEventChoicePreview } from '../src/utils/eventPresentation.ts';
import { buildBoundedEncounterEvent } from '../src/utils/boundedEncounterEvent.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { findItemByName, makeItem } from '../src/utils/gameUtils.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';
import EventPanel from '../src/components/EventPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 27 N1 — "이벤트 선택지를 눌렀는데 아무 일도 일어나지 않는다".
 *
 * D1: 구조화 폴백 트랜잭션 3종은 실제 파이프라인(explore → aiService 폴백 → pickFallbackEvent
 *     → RESOLVE_AI_EVENT → handleEventChoice → 리듀서)으로 들어오면 비용 선택지가 지급되지
 *     않았다 — 포장기가 선택지를 3개로 채웠고 검증기는 정본 2선택지와의 구조 동치를 요구했다.
 *     기존 테스트는 정본 이벤트만 먹였고 파이프라인 이벤트는 해소하지 않았다(공허참).
 * D9: 치를 수 없는 한정 조우 선택은 `applied: false`로 거부되는데 이유가 어디에도 없었다.
 *
 * 이벤트 화면(GS.EVENT)은 FOCUS_PANEL_STATES라 TerminalView가 마운트되지 않는다 — 로그만
 * 남기는 거부는 플레이어에게 보이지 않는다. 그래서 "보인다"는 로그가 아니라 **EventPanel이
 * 실제로 그리는 미리보기 문장**으로 단언한다.
 */

const LOCATION = '고요한 숲';
const PICK_SLOTS = 1000;
const clone = (value) => structuredClone(value);

// pickFallbackEvent의 두 롤: ① 구조화 풀 혼합(0 → 항상 섞임) ② 후보 인덱스.
const pickDraws = (slot) => [0, (slot + 0.5) / PICK_SLOTS];

const poolSlotFor = (transactionId) => {
    for (let slot = 0; slot < PICK_SLOTS; slot += 1) {
        const draws = pickDraws(slot);
        const event = pickFallbackEvent(LOCATION, [], { level: 10 }, () => draws.shift() ?? 0.5);
        if (event?.fallbackTransactionId === transactionId) return slot;
    }
    return null;
};

const POOL_SLOTS = new Map(STRUCTURED_FALLBACK_TRANSACTIONS.map((tx) => [tx.id, poolSlotFor(tx.id)]));

const potion = () => makeItem(findItemByName('하급 체력 물약'));

const explorer = (overrides = {}) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base,
        name: '시험자',
        loc: LOCATION,
        level: 10,
        hp: 200,
        mp: 50,
        gold: 5000,
        inv: [potion()],
        history: [],
        quests: [],
        titles: [],
        stats: {
            ...base.stats,
            explores: 1,
            exploreState: { ...base.stats.exploreState, sinceNarrativeEvent: 1 },
        },
        // 고요한 숲의 체인(lost_wizard)은 이미 끝났다 — 체인 트리거가 폴백 경로를 가리지 않게.
        eventChainProgress: { lost_wizard: 99 },
        // 원정 밖(undefined)이면 한정 조우 영수증이 없어 AI/폴백 경로로 간다.
        activeExpedition: undefined,
        ...overrides,
    };
};

/** 실제 explore()를 돌려 폴백 트랜잭션 이벤트가 열린 상태를 만든다. */
const exploreInto = async (transactionId, playerOverrides = {}) => {
    const slot = POOL_SLOTS.get(transactionId);
    assert.notEqual(slot, null, `${transactionId}는 폴백 풀에서 뽑힐 수 있어야 한다`);
    let state = { ...clone(INITIAL_STATE), gameState: GS.IDLE, player: explorer(playerOverrides), logs: [] };
    const dispatch = (action) => { state = gameReducer(state, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { id: `explore-${state.logs.length}`, type, text } });
    // 모닥불(0.99) · 정찰(0.99) · 서사 이벤트(0) 뒤로 pickFallbackEvent의 두 롤이 이어진다.
    const draws = [0.99, 0.99, 0, ...pickDraws(slot)];
    await createExploreActions({
        player: state.player,
        gameState: state.gameState,
        uid: null,
        dispatch,
        addLog,
        addStoryLog: () => {},
        getFullStats: () => calculateFullStats(state.player),
        rng: () => draws.shift() ?? 0.5,
    }, makeSharedHelpers({ player: state.player, dispatch, addLog })).explore();
    assert.equal(state.gameState, GS.EVENT, 'explore()가 이벤트를 열어야 한다');
    assert.equal(state.currentEvent?.fallbackTransactionId, transactionId);
    return state;
};

/** EventPanel 버튼 → actions.handleEventChoice(idx) → 실제 리듀서. */
const press = (state, choiceIndex) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { id: `press-${current.logs.length}`, type, text } });
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch,
        addLog,
        getFullStats: () => calculateFullStats(state.player),
        rng: () => 0.5,
    }, makeSharedHelpers({ player: state.player, dispatch, addLog })).handleEventChoice(choiceIndex);
    return current;
};

const renderedPreview = (event, choiceIndex) => {
    const html = renderStatic(createElement(EventPanel, {
        currentEvent: event,
        actions: { handleEventChoice: () => {}, dismissEvent: () => {} },
        location: LOCATION,
    }));
    const marker = `data-testid="event-choice-preview-${choiceIndex}"`;
    const start = html.indexOf(marker);
    assert.ok(start >= 0, `선택 ${choiceIndex}의 미리보기가 그려져야 한다`);
    return html.slice(start, html.indexOf('</div>', start));
};

/**
 * 거부는 "같은 참조"가 아니라 보이는 결과여야 한다: 이벤트는 열린 채, 플레이어는 그대로,
 * 누른 선택지의 미리보기(EventPanel이 실제로 그리는 줄)가 거부 이유를 말하고 같은 문장이
 * 오류 로그로도 남는다. 같은 거부를 다시 누르면 그때는 동일 참조(멱등)다.
 */
const assertVisibleRejection = (before, after, choiceIndex, expectedText) => {
    assert.notEqual(after, before, `선택 ${choiceIndex}: 거부가 무반응(동일 참조)이면 안 된다`);
    assert.equal(after.gameState, GS.EVENT, '거부는 이벤트를 열어 둔다');
    assert.ok(after.currentEvent, '거부는 이벤트를 열어 둔다');
    assert.strictEqual(after.player, before.player, '거부는 플레이어를 건드리지 않는다');
    assert.deepEqual(getEventChoicePreview(after.currentEvent, choiceIndex), { text: expectedText, tone: 'danger' });
    assert.ok(renderedPreview(after.currentEvent, choiceIndex).includes(expectedText), 'EventPanel이 거부 이유를 그린다');
    assert.deepEqual(
        { type: after.logs.at(-1)?.type, text: after.logs.at(-1)?.text },
        { type: 'error', text: expectedText },
    );
    assert.strictEqual(press(after, choiceIndex), after, '같은 거부를 다시 누르면 멱등');
};

for (const tx of STRUCTURED_FALLBACK_TRANSACTIONS) {
    test(`[D1 파이프라인] ${tx.id}: explore()가 여는 이벤트는 원장의 정본 모양 그대로다`, async () => {
        const slot = POOL_SLOTS.get(tx.id);
        const draws = pickDraws(slot);
        const picked = pickFallbackEvent(LOCATION, [], { level: 10 }, () => draws.shift() ?? 0.5);
        assert.deepEqual(picked, {
            source: 'fallback',
            desc: tx.event.desc,
            choices: [...tx.event.choices],
            outcomes: tx.event.outcomes.map((outcome) => ({ ...outcome })),
            fallbackTransactionId: tx.id,
        });

        const opened = await exploreInto(tx.id);
        assert.equal(opened.currentEvent.source, 'fallback');
        assert.equal(opened.currentEvent.desc, tx.event.desc);
        assert.deepEqual(opened.currentEvent.choices, [...tx.event.choices]);
        assert.deepEqual(opened.currentEvent.outcomes, tx.event.outcomes.map((outcome) => ({ ...outcome })));
    });

    test(`[D1 비용 선택] ${tx.id}: 미리보기가 약속한 만큼 정산하고 이벤트를 닫는다`, async () => {
        const opened = await exploreInto(tx.id);
        assert.deepEqual(getEventChoicePreview(opened.currentEvent, tx.choiceIndex), { text: tx.preview, tone: 'danger' });
        assert.ok(tx.preview.includes(String(tx.grossGold)), '미리보기는 지급액을 말한다');

        const settled = press(opened, tx.choiceIndex);
        assert.notEqual(settled, opened, '비용 선택지가 동일 참조면 지급되지 않은 것이다');
        const goldCost = tx.cost.type === 'gold' ? tx.cost.amount : 0;
        assert.equal(settled.player.gold, opened.player.gold - goldCost + tx.grossGold);
        assert.equal(settled.player.stats.total_gold, opened.player.stats.total_gold + tx.netGold);
        if (tx.cost.type === 'hp-recovery-consumable') {
            assert.deepEqual(settled.player.inv, [], '회복 물약 1개를 소모한다');
        } else {
            assert.deepEqual(settled.player.inv, opened.player.inv);
        }
        assert.equal(settled.currentEvent, null);
        assert.equal(settled.gameState, GS.IDLE);
        assert.ok(settled.logs.some((log) => log.text === formatEventText(tx.event.outcomes[tx.choiceIndex].log)));
    });

    for (const wallet of [
        { label: '지불 가능', overrides: {} },
        { label: '지불 불가', overrides: { gold: 0, inv: [] } },
    ]) {
        test(`[D1 모든 선택지] ${tx.id} (${wallet.label}): 렌더되는 선택지는 전부 보이는 결과를 낸다`, async () => {
            const opened = await exploreInto(tx.id, wallet.overrides);
            const rendered = opened.currentEvent.choices.slice(0, 3);
            assert.ok(rendered.length >= 2);
            rendered.forEach((_choice, choiceIndex) => {
                const after = press(opened, choiceIndex);
                assert.notEqual(after, opened, `선택 ${choiceIndex}가 무반응이면 안 된다`);
                if (after.currentEvent === null) {
                    assert.equal(after.gameState, GS.IDLE);
                    assert.ok(after.logs.length > opened.logs.length, `선택 ${choiceIndex}는 결과 로그를 남긴다`);
                } else {
                    const expectedText = tx.cost.type === 'gold'
                        ? MSG.GOLD_INSUFFICIENT
                        : MSG.FALLBACK_HP_POTION_REQUIRED;
                    assert.equal(choiceIndex, tx.choiceIndex, '열린 채 남는 것은 비용 선택지의 비용 부족뿐이다');
                    assertVisibleRejection(opened, after, choiceIndex, expectedText);
                }
                if (choiceIndex !== tx.choiceIndex) {
                    assert.equal(after.player.gold, opened.player.gold, '골드를 움직이는 것은 트랜잭션뿐이다');
                }
            });
        });
    }

    test(`[D1 위조 방지] ${tx.id}: 정본이 아닌 이벤트는 트랜잭션 id를 실어도 정산되지 않는다`, () => {
        const canonical = () => ({ ...clone(tx.event), source: 'fallback', fallbackTransactionId: tx.id });
        const variants = {
            '지급액 변조': (event) => { event.outcomes[tx.choiceIndex].gold = 99999; },
            '결과 문구 변조': (event) => { event.outcomes[tx.choiceIndex].log = '공짜 금화 (+99999G)'; },
            '선택지 문구 변조': (event) => { event.choices[tx.choiceIndex] = '그냥 받는다'; },
            'Wave 27 이전 파이프라인 모양(패딩 3번째 선택지)': (event) => {
                event.choices.push('살펴본다');
                event.outcomes.push({ choiceIndex: 2, log: '균형 잡힌 판단으로 안정적인 성과를 거두었습니다.', gold: 30, exp: 20, hp: 0, mp: 0 });
            },
        };
        for (const [label, mutate] of Object.entries(variants)) {
            const event = canonical();
            mutate(event);
            const before = { ...clone(INITIAL_STATE), gameState: GS.EVENT, currentEvent: event, player: explorer(), logs: [] };
            const after = press(before, tx.choiceIndex);
            assert.equal(after.player.gold, before.player.gold, `${label}: 지급 없음`);
            assert.equal(after.player.stats.total_gold, before.player.stats.total_gold, `${label}: 누적 골드 불변`);
            assert.deepEqual(after.player.inv, before.player.inv, `${label}: 물약 소모 없음`);
            assert.equal(after.currentEvent?.fallbackTransactionId, tx.id, `${label}: 이벤트는 열린 채`);
            assertVisibleRejection(before, after, tx.choiceIndex, MSG.EVENT_CHOICE_OFFER_INVALID);
        }
    });

    test(`[D1 위조 방지] ${tx.id}: AI 출처 이벤트는 트랜잭션 id를 가질 수 없고, 강제로 붙여도 정산되지 않는다`, () => {
        const packaged = buildEventPackage(
            { ...clone(tx.event), source: 'fallback', fallbackTransactionId: tx.id },
            { source: 'ai', location: LOCATION, level: 10 },
        );
        assert.equal(packaged.source, 'ai');
        assert.equal(Object.hasOwn(packaged, 'fallbackTransactionId'), false);

        // 저장 변조로 id를 되살려도: 출처가 폴백이 아니면 도달 불가 경로라 동일 참조가 정답이다.
        const forged = {
            ...clone(INITIAL_STATE),
            gameState: GS.EVENT,
            currentEvent: { ...clone(tx.event), source: 'ai', fallbackTransactionId: tx.id },
            player: explorer(),
            logs: [],
        };
        assert.strictEqual(gameReducer(forged, {
            type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
            payload: { transactionId: tx.id, choiceIndex: tx.choiceIndex },
        }), forged);
    });

    test(`[D1 거부 뒤 재시도] ${tx.id}: 거부 안내가 붙은 이벤트도 비용을 갖추면 정산된다`, async () => {
        const opened = await exploreInto(tx.id, { gold: 0, inv: [] });
        const rejected = press(opened, tx.choiceIndex);
        assert.ok(rejected.currentEvent, '먼저 거부된다');
        const funded = { ...rejected, player: { ...rejected.player, gold: 5000, inv: [potion()] } };
        const settled = press(funded, tx.choiceIndex);
        assert.equal(settled.currentEvent, null, '거부 안내가 정본 판정을 오염시키지 않는다');
        assert.equal(settled.gameState, GS.IDLE);
        const goldCost = tx.cost.type === 'gold' ? tx.cost.amount : 0;
        assert.equal(settled.player.gold, 5000 - goldCost + tx.grossGold);
    });
}

// ── D9: 한정 조우 ─────────────────────────────────────────────────────────────

const encounterById = (id) => BOUNDED_ENCOUNTERS.find((entry) => entry.id === id);

const boundedState = (encounterId, playerOverrides = {}) => {
    const encounter = encounterById(encounterId);
    const base = clone(INITIAL_STATE.player);
    const player = {
        ...base,
        loc: encounter.region,
        hp: 80,
        mp: 20,
        stats: { ...base.stats, explores: 1 },
        activeExpedition: { id: 'expedition-n1', explores: 0 },
        ...playerOverrides,
    };
    return {
        ...clone(INITIAL_STATE),
        player,
        gameState: GS.EVENT,
        currentEvent: buildBoundedEncounterEvent(encounter, player.stats.explores),
        logs: [],
    };
};

const choiceIndexOf = (encounterId, choiceId) => encounterById(encounterId).choices.findIndex((choice) => choice.id === choiceId);

test('[D9] 치를 수 없는 한정 조우 선택은 이벤트를 열어 둔 채 이유를 보여 준다', () => {
    const cases = [
        {
            label: '기력 부족',
            encounterId: 'forest-old-pillars',
            choiceId: 'read-runes',
            player: { mp: 4 },
            expected: () => MSG.EVENT_CHOICE_COST_UNPAYABLE(
                MSG.EVENT_CHOICE_RESOURCE_SHORT(MSG.EVENT_CHOICE_RESOURCE_LABELS.mp, 10, 4),
            ),
        },
        {
            // 생명 비용은 치른 뒤 1 이상 남아야 한다 — 8을 치르려면 9가 필요하다.
            label: '생명 부족(치명)',
            encounterId: 'forest-old-pillars',
            choiceId: 'lift-stone',
            player: { hp: 8 },
            expected: () => MSG.EVENT_CHOICE_COST_UNPAYABLE(
                MSG.EVENT_CHOICE_RESOURCE_SHORT(MSG.EVENT_CHOICE_RESOURCE_LABELS.hp, 9, 8),
            ),
        },
        {
            label: '가방 가득',
            encounterId: 'plain-supply-cart',
            choiceId: 'repair-cart',
            player: { maxInv: 1, inv: [potion()] },
            expected: () => MSG.EVENT_CHOICE_INVENTORY_FULL,
        },
    ];
    for (const entry of cases) {
        const before = boundedState(entry.encounterId, entry.player);
        const choiceIndex = choiceIndexOf(entry.encounterId, entry.choiceId);
        const after = press(before, choiceIndex);
        assert.notEqual(after, before, `${entry.label}: 무반응이면 안 된다`);
        assert.equal(after.currentEvent?.boundedEncounterId, entry.encounterId, `${entry.label}: 이벤트는 열린 채`);
        assertVisibleRejection(before, after, choiceIndex, entry.expected());
    }
});

test('[D9] 치를 수 있는 선택은 그대로 정산되고, 앞선 거부 안내가 정산을 막지 않는다', () => {
    const payable = boundedState('forest-old-pillars', { mp: 20 });
    const settled = press(payable, choiceIndexOf('forest-old-pillars', 'read-runes'));
    assert.equal(settled.gameState, GS.IDLE);
    assert.equal(settled.currentEvent, null);
    assert.equal(settled.player.mp, 10);
    assert.deepEqual(settled.player.tempBuff, { name: '돌기둥의 가호', def: 0.2, turn: 3 });
    assert.equal(settled.logs.at(-1).text, encounterById('forest-old-pillars').choices[0].outcome.result);

    const lowMp = boundedState('forest-old-pillars', { mp: 4 });
    const rejected = press(lowMp, choiceIndexOf('forest-old-pillars', 'read-runes'));
    assert.ok(rejected.currentEvent?.isBoundedEncounter, '먼저 거부된다');
    const lifted = press(rejected, choiceIndexOf('forest-old-pillars', 'lift-stone'));
    assert.equal(lifted.gameState, GS.IDLE, '거부 안내가 정본 판정을 오염시키지 않는다');
    assert.equal(lifted.player.gold, lowMp.player.gold + 60);
    assert.equal(lifted.player.hp, 72);
});
