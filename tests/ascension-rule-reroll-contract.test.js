import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { ASCENSION_RULES } from '../src/data/ascensionRules.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { createAscensionActions } from '../src/hooks/gameActions/ascensionActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import {
    canRerollAscensionRuleOffer,
    getAscensionRuleOffer,
    getAscensionRulePaidRerolls,
    getAscensionRuleRerolls,
    resolveAscensionRuleChoice,
} from '../src/systems/ascensionRule.js';
import { carryEssenceLadderOnAscension } from '../src/systems/essenceLedger.js';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.js';
import { getAscensionRuleOfferView, getAscensionRuleRerollView } from '../src/utils/ascensionRuleView.js';
import { createSeededRandom, deriveSeed } from '../src/utils/seededRandom.js';
import ChallengeModifierPicker from '../src/components/ChallengeModifierPicker.tsx';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 95 (소유자 결정 "무료 한 번 + 영구 능력치 — 섞어서 로그라이크의 재미를"): 계승 화면의 회차 규칙 패 다시 뽑기.
 *
 * 첫 다시 뽑기는 무료이고 되돌릴 수 없다(리듀서가 횟수를 이 처치 영수증 · 다음 단계에 묶어 저장한다 — 리로드로 첫 패가 돌아오지 않는다).
 * 그 뒤 `ASCENSION_RULE_REROLL_PAID_MAX`번까지는 한 번마다 다음 여정으로 넘어가는 정수 사다리 단계의 `ASCENSION_RULE_REROLL_LADDER_COST`를
 * 내려놓는다(계승할 때 적용). 계승 정수는 회차마다 18만 ~ 30만씩 쌓이고 거울(14,570)이 1회차 약 15시간에 다 차서 정수 비용은
 * 사실상 공짜였다(원장 §100) — 그래서 대가는 영구 능력치다.
 */

const MAX_REROLLS = BALANCE.ASCENSION_RULE_REROLL_FREE + BALANCE.ASCENSION_RULE_REROLL_PAID_MAX;
const ALL_RULE_IDS = ASCENSION_RULES.map((rule) => rule.id);
const RECEIPTS = Array.from({ length: 60 }, (_, i) => `rk-${i}`);

// 2026-10 Wave 114: 사다리 600단계 — 넘어가는 몫(10% = 60)이 고정 상한(70) 아래라 Wave 95 대가가 비율 그대로 보인다.
const veteranAt = (rank, receipt, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '수집가', job: '전사', level: 50, hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    ...extra,
    meta: {
        ...structuredClone(INITIAL_STATE.player.meta),
        prestigeRank: rank, rank: 600, bonusAtk: 600, bonusHp: 3_000, bonusMp: 1_800,
        endgame: { lastEndgameReceiptKey: receipt },
        ...(extra.meta || {}),
    },
});
const screenState = (player, gameState = GS.ASCENSION) => ({ ...structuredClone(INITIAL_STATE), gameState, bootStage: 'ready', player });
const reroll = (state, expectedRerolls) => gameReducer(state, { type: AT.REROLL_ASCENSION_RULE_OFFER, payload: { expectedRerolls } });
const rerolledTimes = (player, times, gameState = GS.ASCENSION) => {
    let state = screenState(player, gameState);
    for (let k = 0; k < times; k += 1) state = reroll(state, k);
    return state;
};
const ids = (rules) => rules.map((rule) => rule.id);
const ascend = (state, payload = {}) => gameReducer(state, {
    type: AT.ASCEND,
    payload: {
        expectedPrestigeRank: state.player.meta.prestigeRank, sourceReceiptKey: state.player.meta.endgame.lastEndgameReceiptKey,
        seed: 1, challengeModifiers: [], ...payload,
    },
});

// Wave 94의 패(다시 뽑지 않은 패)를 그대로 다시 계산한다 — 다시 뽑기를 더해도 기본 패는 바뀌지 않아야 한다.
const wave94Offer = (receipt, nextRank, deck = ASCENSION_RULES) => {
    const rng = createSeededRandom(deriveSeed(0, 'ascension-rule-offer', receipt, nextRank));
    const cards = [...deck];
    for (let i = cards.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards.slice(0, BALANCE.ASCENSION_RULE_OFFER_COUNT).map((rule) => rule.id);
};

test('Wave 95: 대가 상수 — 무료 1번, 유료 2번, 유료 한 번마다 넘어가는 사다리의 절반', () => {
    assert.equal(BALANCE.ASCENSION_RULE_REROLL_FREE, 1);
    assert.equal(BALANCE.ASCENSION_RULE_REROLL_PAID_MAX, 2);
    assert.equal(BALANCE.ASCENSION_RULE_REROLL_LADDER_COST, 0.5);
});

test('Wave 95: 다시 뽑지 않은 패는 Wave 94의 패와 같다 — 기본 경로는 그대로다', () => {
    for (const receipt of RECEIPTS) {
        for (const rank of [1, 4, 9]) {
            assert.deepEqual(ids(getAscensionRuleOffer(veteranAt(rank - 1, receipt), rank)), wave94Offer(receipt, rank), `${receipt} · ${rank}`);
        }
        const conquered = ALL_RULE_IDS.slice(0, 2);
        const player = veteranAt(2, receipt, { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: conquered } });
        assert.deepEqual(ids(getAscensionRuleOffer(player, 3)), wave94Offer(receipt, 3, ASCENSION_RULES.filter((rule) => !conquered.includes(rule.id))));
    }
});

test('Wave 95: 다시 뽑기는 리듀서 전이다 — 화면이 본 횟수가 맞을 때만, 계승 · 진 엔딩 화면에서만, 처치 영수증이 있을 때만', () => {
    const player = veteranAt(0, 'rk-7');
    const first = ids(getAscensionRuleOffer(player, 1));
    const once = reroll(screenState(player), 0);
    assert.deepEqual(once.player.meta.ascensionRuleOffer, { receiptKey: 'rk-7', rank: 1, rerolls: 1 });
    assert.equal(once.syncStatus, 'syncing', '저장된다');
    const second = ids(getAscensionRuleOffer(once.player, 1));
    assert.notDeepEqual(second, first);
    assert.equal(reroll(once, 0), once, '같은 횟수를 다시 보내면(연타 · 늦은 요청) 무시한다');
    assert.equal(reroll(screenState(player, GS.IDLE), 0).player, player, '계승 화면 밖에서는 다시 뽑지 않는다');
    assert.equal(reroll(screenState(player, GS.TRUE_ENDING), 0).player.meta.ascensionRuleOffer.rerolls, 1, '진 엔딩 화면도 같은 계승이다');
    const noReceipt = veteranAt(0, null);
    assert.equal(reroll(screenState(noReceipt), 0).player, noReceipt, '처치 영수증이 없으면 패도 없다');
});

test('Wave 95: 횟수 상한(무료 + 유료)과 덱 크기 — 덱이 패보다 크지 않으면 다시 뽑을 수 없다', () => {
    const player = veteranAt(0, 'rk-3');
    const spent = rerolledTimes(player, MAX_REROLLS);
    assert.equal(getAscensionRuleRerolls(spent.player.meta, 1), MAX_REROLLS);
    assert.equal(canRerollAscensionRuleOffer(spent.player, 1), false);
    assert.equal(reroll(spent, MAX_REROLLS), spent, '다 쓰면 더 뽑지 않는다');
    const forged = { ...player, meta: { ...player.meta, ascensionRuleOffer: { receiptKey: 'rk-3', rank: 1, rerolls: 99 } } };
    assert.equal(getAscensionRuleRerolls(forged.meta, 1), MAX_REROLLS, '저장값이 상한을 넘어도 상한으로 읽는다');

    for (const unconquered of [3, 2, 1]) {
        const small = veteranAt(5, 'rk-3', { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: ALL_RULE_IDS.slice(0, 6 - unconquered) } });
        assert.equal(canRerollAscensionRuleOffer(small, 6), false, `남은 규칙 ${unconquered}개는 패가 곧 덱이다`);
        assert.equal(reroll(screenState(small), 0).player, small);
        assert.equal(getAscensionRuleRerollView(small, 6), null, '버튼을 그리지 않는다');
    }
    const four = veteranAt(5, 'rk-3', { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: ALL_RULE_IDS.slice(0, 2) } });
    assert.equal(canRerollAscensionRuleOffer(four, 6), true, '네 장이면 다시 뽑을 수 있다');
});

test('Wave 95: 되돌릴 수 없다 — 저장을 다시 읽어도 · 미뤘다 다시 열어도 다시 뽑은 패이고, 다른 처치 · 다른 단계에는 쓰지 않는다', () => {
    const player = veteranAt(0, 'rk-11');
    const once = reroll(screenState(player), 0);
    const rerolledHand = ids(getAscensionRuleOffer(once.player, 1));
    const reloaded = JSON.parse(JSON.stringify(once.player));
    assert.deepEqual(ids(getAscensionRuleOffer(reloaded, 1)), rerolledHand, '세이브 왕복 뒤에도 다시 뽑은 패');

    const deferred = gameReducer(once, { type: AT.DEFER_ASCENSION });
    const reopened = gameReducer(deferred, { type: AT.REOPEN_ASCENSION });
    assert.equal(reopened.gameState, GS.ASCENSION);
    assert.deepEqual(ids(getAscensionRuleOffer(reopened.player, 1)), rerolledHand, '미뤘다 다시 열어도 다시 뽑은 패');

    const newKill = { ...once.player, meta: { ...once.player.meta, endgame: { lastEndgameReceiptKey: 'rk-12' } } };
    assert.equal(getAscensionRuleRerolls(newKill.meta, 1), 0, '새 처치에는 새 패');
    assert.deepEqual(ids(getAscensionRuleOffer(newKill, 1)), wave94Offer('rk-12', 1));
    assert.equal(getAscensionRuleRerolls(once.player.meta, 2), 0, '다른 단계의 기록은 쓰지 않는다');
});

test('Wave 95: 다시 뽑은 패는 덱 전체에서 다시 무작위다 — 직전 패와 같은 패는 없고, 원하는 카드는 보장되지 않는다', () => {
    // 원장 §100: 아직 보지 못한 카드를 먼저 채우던 구현에서는 무료 한 번이 "나머지 절반 보기"라 원하는 카드가 늘 나왔고
    //   유료 다시 뽑기는 720회 계승 중 한 번도 쓰이지 않았다(도박이 아니었다).
    let overlapping = 0;
    let targetMissed = 0;
    let targetHit = 0;
    for (const receipt of RECEIPTS) {
        for (const conqueredCount of [0, 1, 2]) {
            const player = veteranAt(0, receipt, { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: ALL_RULE_IDS.slice(0, conqueredCount) } });
            const deck = ALL_RULE_IDS.slice(conqueredCount);
            let state = screenState(player);
            let previous = ids(getAscensionRuleOffer(state.player, 1));
            const first = previous;
            const target = deck.find((id) => !first.includes(id));
            for (let k = 1; k <= MAX_REROLLS; k += 1) {
                state = reroll(state, k - 1);
                const hand = ids(getAscensionRuleOffer(state.player, 1));
                assert.equal(new Set(hand).size, BALANCE.ASCENSION_RULE_OFFER_COUNT);
                assert.ok(hand.every((id) => deck.includes(id)), '정복한 규칙은 나오지 않는다');
                assert.notDeepEqual([...hand].sort(), [...previous].sort(), `${receipt} · 덱 ${deck.length} · ${k}번째: 직전 패와 같은 패`);
                if (k === 1 && deck.length === 6) {
                    if (hand.some((id) => first.includes(id))) overlapping += 1;
                    if (hand.includes(target)) targetHit += 1; else targetMissed += 1;
                }
                previous = hand;
            }
        }
    }
    assert.ok(overlapping > 0, '여섯 장 덱의 첫 다시 뽑기도 처음 패와 겹칠 수 있다(나머지 절반이 정해져 있지 않다)');
    assert.ok(targetMissed > 0 && targetHit > 0, '처음 패에 없던 카드가 무료 한 번에 나오기도, 나오지 않기도 한다');
});

test('Wave 95: 계승은 다시 뽑은 패에서 고르고, 무료는 대가가 없으며 유료 한 번마다 넘어가는 사다리가 절반씩 줄고, 기록은 지운다', () => {
    const player = veteranAt(0, 'rk-21');
    const base = getAscensionOutcome(player.meta);
    assert.equal(base.ladder.rankKept, 60);
    for (let times = 0; times <= MAX_REROLLS; times += 1) {
        const state = rerolledTimes(player, times);
        const hand = getAscensionRuleOffer(state.player, 1);
        const paid = Math.max(0, times - BALANCE.ASCENSION_RULE_REROLL_FREE);
        assert.equal(getAscensionRulePaidRerolls(state.player.meta, 1), paid);
        const keep = Math.max(0, 1 - paid * BALANCE.ASCENSION_RULE_REROLL_LADDER_COST);
        const expectedKept = Math.floor(600 * BALANCE.ESSENCE_LADDER_ASCEND_CARRY * keep);
        const outcome = getAscensionOutcome(state.player.meta);
        assert.equal(outcome.ladder.rankKept, expectedKept, `${times}번`);
        assert.equal(outcome.ladder.rerollPaid, paid);
        assert.equal(outcome.ladder.carryPercent, Math.round(BALANCE.ESSENCE_LADDER_ASCEND_CARRY * keep * 100));
        assert.equal(outcome.meta.bonusAtk, base.meta.bonusAtk - (60 - expectedKept) * BALANCE.ESSENCE_RANK_ATK, '내려놓은 단계만큼 영구 공격력');
        assert.equal(outcome.meta.bonusHp, base.meta.bonusHp - (60 - expectedKept) * BALANCE.ESSENCE_RANK_HP);
        assert.equal(outcome.meta.essence, base.meta.essence, '계승 정수는 그대로');

        const card = hand[hand.length - 1];
        const next = ascend(state, { ruleId: card.id });
        assert.equal(next.player.meta.prestigeRank, 1);
        assert.deepEqual(next.player.meta.ascensionRule, { rank: 1, ruleId: card.id }, '다시 뽑은 패의 카드');
        assert.equal(next.player.meta.rank, expectedKept);
        assert.equal(next.player.meta.bonusAtk, outcome.meta.bonusAtk);
        assert.ok(!('ascensionRuleOffer' in next.player.meta), '다시 뽑기 기록은 계승에서 쓰고 지운다');
        assert.equal(getAscensionOutcome(next.player.meta).ladder.rerollPaid, 0, '다음 계승에는 대가가 남지 않는다');
    }
    // 처음 패의 카드는 다시 뽑은 뒤에는 고를 수 없다 — 패 밖이면 지금 패의 가장 가벼운 카드다.
    const once = rerolledTimes(player, 1);
    const firstHand = getAscensionRuleOffer(player, 1);
    const nowHand = getAscensionRuleOffer(once.player, 1);
    const gone = firstHand.find((rule) => !nowHand.some((card) => card.id === rule.id));
    assert.equal(ascend(once, { ruleId: gone.id }).player.meta.ascensionRule.ruleId, resolveAscensionRuleChoice(nowHand, undefined).id);
});

test('Wave 95: 사다리 이월 함수 — 비율 1은 이전과 같고 범위 밖 비율은 잘린다', () => {
    const meta = { rank: 937, bonusAtk: 1_000, bonusHp: 5_000, bonusMp: 3_000, essence: 12 };
    assert.deepEqual(carryEssenceLadderOnAscension(meta, 1), carryEssenceLadderOnAscension(meta));
    assert.equal(carryEssenceLadderOnAscension(meta, 2).rankKept, carryEssenceLadderOnAscension(meta).rankKept);
    assert.equal(carryEssenceLadderOnAscension(meta, -1).rankKept, 0);
    assert.equal(carryEssenceLadderOnAscension(meta, Number.NaN).rankKept, carryEssenceLadderOnAscension(meta).rankKept);
});

test('Wave 95: 화면 — 무료 · 유료(넘어가는 사다리 지금 → 다음) · 소진 문구, 유료 문구는 계승이 실제로 적용할 값이다', () => {
    const player = veteranAt(0, 'rk-31');
    const views = [];
    for (let times = 0; times <= MAX_REROLLS; times += 1) {
        const state = rerolledTimes(player, times);
        const view = getAscensionRuleRerollView(state.player, 1);
        views.push(view);
        assert.equal(view.rerolls, times);
        assert.equal(view.countLabel, MSG.ASCENSION_RULE_REROLL_COUNT(times, MAX_REROLLS));
        if (times === MAX_REROLLS) {
            assert.equal(view.available, false);
            assert.equal(view.label, MSG.ASCENSION_RULE_REROLL_SPENT);
        } else if (times < BALANCE.ASCENSION_RULE_REROLL_FREE) {
            assert.equal(view.free, true);
            assert.equal(view.label, MSG.ASCENSION_RULE_REROLL_FREE);
        } else {
            const after = getAscensionOutcome(reroll(state, times).player.meta).ladder.rankKept;
            assert.equal(view.label, MSG.ASCENSION_RULE_REROLL_PAID(getAscensionOutcome(state.player.meta).ladder.rankKept, after));
        }
    }
    assert.deepEqual(views.map((view) => view.label), [
        MSG.ASCENSION_RULE_REROLL_FREE, MSG.ASCENSION_RULE_REROLL_PAID(60, 30), MSG.ASCENSION_RULE_REROLL_PAID(30, 0), MSG.ASCENSION_RULE_REROLL_SPENT,
    ]);

    const offer = getAscensionRuleOfferView(player, 1);
    const render = (reroll) => renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: offer.cards[0], ruleOffer: offer.cards, onSelectRule: () => {},
        ruleReroll: reroll, onRerollRule: () => {},
    }));
    const free = render(views[0]);
    const button = free.match(/<button[^>]*data-testid="probe-rule-reroll"[^>]*>/)[0];
    assert.doesNotMatch(button, /\sdisabled=""/);
    assert.ok(free.includes(MSG.ASCENSION_RULE_REROLL_FREE) && free.includes(views[0].countLabel));
    assert.match(render(views[MAX_REROLLS]).match(/<button[^>]*data-testid="probe-rule-reroll"[^>]*>/)[0], /\sdisabled=""/);
    assert.ok(!render(null).includes('probe-rule-reroll'), '다시 뽑을 수 없으면 버튼이 없다');
});

test('Wave 95: 계승 화면 — 유료 다시 뽑기를 했으면 줄어든 영구 성장과 대가 줄을 보인다, 하지 않았으면 없다', () => {
    const player = veteranAt(0, 'rk-41');
    const plain = renderStatic(createElement(AscensionScreen, { player }));
    assert.ok(plain.includes('ascension-rule-reroll'), '다시 뽑기 버튼이 있다');
    assert.ok(!plain.includes('ascension-ladder-reroll-cost'));
    assert.ok(plain.includes(MSG.ASCEND_LADDER_CARRY(600, 60, 10, BALANCE.ESSENCE_LADDER_ASCEND_CARRY_MAX_RANKS)));
    const paid = rerolledTimes(player, 2).player;
    const html = renderStatic(createElement(AscensionScreen, { player: paid }));
    assert.ok(html.includes(MSG.ASCEND_LADDER_REROLL_COST(1)));
    assert.ok(html.includes(MSG.ASCEND_LADDER_CARRY(600, 30, 5, BALANCE.ESSENCE_LADDER_ASCEND_CARRY_MAX_RANKS)));
    assert.ok(html.includes(`+${getAscensionOutcome(paid.meta).meta.bonusAtk}`), '영구 성장 칸은 대가를 반영한 값');
});

test('Wave 95: 액션 — 화면이 본 횟수를 그대로 보낸다', () => {
    const sent = [];
    const actions = createAscensionActions({ player: veteranAt(0, 'rk-1'), gameState: GS.ASCENSION, dispatch: (action) => sent.push(action), addLog: () => {} });
    actions.rerollAscensionRuleOffer(1);
    assert.deepEqual(sent, [{ type: AT.REROLL_ASCENSION_RULE_OFFER, payload: { expectedRerolls: 1 } }]);
});
