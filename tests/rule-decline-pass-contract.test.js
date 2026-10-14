import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_ASCENSION_RULES, ASCENSION_RULES, STACKED_ASCENSION_RULES } from '../src/data/ascensionRules.js';
import { BALANCE } from '../src/data/constants.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import {
    canRerollAscensionRuleOffer,
    getAscensionRuleOffer,
    getRuleConquestLedger,
    getRuleDeclinePasses,
    getStackedSecondModifier,
    isHeavyAscensionTwist,
    isStackedAscensionRuleDeckOpen,
} from '../src/systems/ascensionRule.js';
import { resolveEndgameVictory } from '../src/systems/endgameSettlement.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { createSeededRandom, deriveSeed } from '../src/utils/seededRandom.js';

/**
 * Wave 107 — 거절한 회차 규칙 카드도 이번 순환에서 지나간 것이다(소유자 결정 §111.7 (b)).
 *
 * 덱은 "정복 횟수가 가장 적은 규칙"이었고 거절한 카드는 정복되지 않아 덱에 남았다 — 다음 계승부터 그 카드만 나왔다(원장 §110.3 ·
 * §111.4). 이제 덱은 정복 + 거절하고 지나감을 센다. 거절 기록은 계승(`ASCEND`) 한 곳이 남기고, 계승 화면의 패는 기록 전 player로 뽑으므로
 * 지금 회차의 거절도 센다. 정복 보상 · 겹친 덱 열림은 정복만 본다.
 */

const NOW = 1_700_000_000_000;
const BASE_IDS = ASCENSION_RULES.map((rule) => rule.id);
const STACKED_IDS = STACKED_ASCENSION_RULES.map((rule) => rule.id);
const RECEIPTS = Array.from({ length: 60 }, (_, i) => `dp-${i}`);
const demonKing = { name: '마왕', baseName: '마왕', isBoss: true, hp: 0, maxHp: 10_000, atk: 500, def: 100, exp: 9_000, gold: 9_000 };

const veteranAt = (rank, receipt, ledger = BASE_IDS, { passes, meta = {}, declined } = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '지나간 길', job: '전사', level: 50, hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank, endgame: { lastEndgameReceiptKey: receipt }, ...meta },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: [...ledger], ...(passes ? { ruleDeclinePassIds: [...passes] } : {}) },
    ...(declined !== undefined ? { ascensionRuleDeclined: declined } : {}),
});

const ascendWith = (player, payload = {}) => gameReducer(
    { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: player.meta.prestigeRank, sourceReceiptKey: player.meta.endgame.lastEndgameReceiptKey,
        seed: 1, challengeModifiers: [], ...payload } },
);

/** 그 단계의 마왕을 잡고(정복이 있으면 정복) 다음 계승을 준비한 player. */
const killDemonKing = (player, receipt) => resolveEndgameVictory({ player: { ...player, hp: 900 }, deadEnemy: demonKing, receiptKey: receipt, rng: () => 0.99, now: NOW }).player;

/** Wave 106의 덱(정복만 센다) — 거절이 없으면 지금 덱과 같아야 한다. */
const conquestOnlyDeck = (stats) => {
    const counts = new Map();
    for (const id of getRuleConquestLedger(stats)) counts.set(id, (counts.get(id) || 0) + 1);
    const table = ASCENSION_RULES.every((rule) => (counts.get(rule.id) || 0) >= 1) ? STACKED_ASCENSION_RULES : ASCENSION_RULES;
    const fewest = Math.min(...table.map((rule) => counts.get(rule.id) || 0));
    return table.filter((rule) => (counts.get(rule.id) || 0) === fewest).map((rule) => rule.id);
};

test('거절이 없으면 덱 · 패는 정복만 세던 때와 같다(받아들이는 플레이어는 바이트 동일)', () => {
    const rng = createSeededRandom(deriveSeed(0, 'decline-pass-ledgers'));
    for (const receipt of RECEIPTS) {
        const ledger = [...BASE_IDS.filter(() => rng() < 0.8), ...STACKED_IDS.filter(() => rng() < 0.5)];
        for (const rank of [3, 6, 9]) {
            const player = veteranAt(rank, receipt, ledger);
            const offer = getAscensionRuleOffer(player, rank + 1).map((rule) => rule.id);
            const deck = conquestOnlyDeck(player.stats);
            assert.ok(offer.every((id) => deck.includes(id)), `${receipt} rank ${rank + 1}`);
            assert.equal(offer.length, Math.min(deck.length, BALANCE.ASCENSION_RULE_OFFER_COUNT));
            assert.deepEqual(getRuleDeclinePasses(player), []);
        }
    }
});

test('거절한 겹친 카드는 이번 순환에서 지나간다 — 다음 패에 다시 나오지 않고, 계승이 기록을 남긴다', () => {
    let checked = 0;
    for (const rule of STACKED_ASCENSION_RULES) {
        for (const receipt of RECEIPTS) {
            const second = getStackedSecondModifier(rule, receipt, 7, 0);
            if (!(rule.optional || isHeavyAscensionTwist(second))) continue;
            // rank 7: 이 카드 하나만 남은 덱이 아니라 덱 전체에서 이 카드를 고르고 거절한다.
            const offer7 = getAscensionRuleOffer(veteranAt(6, receipt), 7);
            if (!offer7.some((card) => card.id === rule.id)) continue;
            const declinedRun = ascendWith(veteranAt(6, receipt), { ruleId: rule.id, declineRule: true }).player;
            assert.equal(declinedRun.ascensionRuleDeclined, true);
            assert.deepEqual(declinedRun.stats.ruleDeclinePassIds, [], '거절 기록은 그 단계를 계승할 때 남는다');
            assert.deepEqual(getRuleDeclinePasses(declinedRun), [rule.id], '지금 회차의 거절은 기록 전에도 센다');

            const atRank8 = killDemonKing(declinedRun, `${receipt}-k7`);
            assert.ok(!getRuleConquestLedger(atRank8.stats).includes(rule.id), '거절하면 정복이 없다');
            const offer8 = getAscensionRuleOffer(atRank8, 8);
            assert.ok(offer8.length > 0 && offer8.every((card) => card.id !== rule.id), `${rule.id}: 다음 패에 다시 나오지 않는다`);
            const next = ascendWith(atRank8);
            assert.deepEqual(next.player.stats.ruleDeclinePassIds, [rule.id], '계승이 지나간 규칙을 기록한다');
            assert.equal(next.player.meta.prestigeRank, 8);
            checked += 1;
            break;
        }
    }
    assert.ok(checked >= 4, `거절 가능한 겹친 카드를 여럿 확인했다(${checked})`);
});

test('덱 순환 — 거절과 정복을 섞어도 여섯이 한 번씩 지나가면 덱이 다시 차고, 같은 순환에 같은 카드는 다시 나오지 않는다', () => {
    for (const receipt of RECEIPTS.slice(0, 20)) {
        let player = veteranAt(6, receipt);
        const seen = [];
        for (let rank = 7; rank <= 12; rank += 1) {
            const offer = getAscensionRuleOffer(player, rank);
            assert.ok(offer.every((card) => !seen.includes(card.id)), `${receipt} rank ${rank}: 지나간 카드가 다시 나왔다`);
            const card = offer[0];
            const run = ascendWith(player, { ruleId: card.id, declineRule: true }).player;
            seen.push(card.id);
            player = killDemonKing(run, `${receipt}-${rank}`);
        }
        assert.deepEqual([...seen].sort(), [...STACKED_IDS].sort(), `${receipt}: 여섯이 모두 한 번씩`);
        const refilled = getAscensionRuleOffer(player, 13);
        assert.equal(refilled.length, BALANCE.ASCENSION_RULE_OFFER_COUNT, '다시 찬 덱');
        assert.ok(refilled.every((card) => card.stackedOf), '겹친 덱 그대로');
    }
});

test('기본 덱 — 거절한 선택형 기본 규칙도 지나가지만, 겹친 덱은 기본 여섯을 모두 정복해야 열린다', () => {
    const tangled = ASCENSION_RULES.find((rule) => rule.optional);
    const light = BASE_IDS.filter((id) => id !== tangled.id && !ASCENSION_RULES.find((rule) => rule.id === id).optional);
    for (const receipt of RECEIPTS.slice(0, 20)) {
        const conquered = [...light];
        const run = ascendWith(veteranAt(3, receipt, conquered), { ruleId: tangled.id, declineRule: true }).player;
        if (run.meta.ascensionRule.ruleId !== tangled.id) continue;
        const atRank5 = killDemonKing(run, `${receipt}-k4`);
        const offer5 = getAscensionRuleOffer(atRank5, 5);
        assert.ok(offer5.every((card) => card.id !== tangled.id), '거절한 기본 규칙도 이번 순환에서 지나간다');
        // 나머지 둘을 정복해도 거절한 규칙은 정복되지 않아 겹친 덱은 닫혀 있다 — 기본 덱이 다시 찬다.
        const allPassed = veteranAt(6, receipt, [...light, ...BASE_IDS.filter((id) => id !== tangled.id && !light.includes(id))], { passes: [tangled.id] });
        assert.equal(isStackedAscensionRuleDeckOpen(allPassed.stats), false);
        const refilled = getAscensionRuleOffer(allPassed, 7);
        assert.ok(refilled.length > 0 && refilled.every((card) => !card.stackedOf), '기본 덱이 다시 찬다');
    }
});

test('거절할 수 없는 카드의 거절 요청 · 기록 없는 이전 세이브 · 모르는 id는 지나감이 아니다', () => {
    const forced = STACKED_ASCENSION_RULES.find((rule) => !rule.optional);
    const lightReceipt = RECEIPTS.find((key) => !isHeavyAscensionTwist(getStackedSecondModifier(forced, key, 7, 0)));
    const onlyForced = [...BASE_IDS, ...STACKED_IDS.filter((id) => id !== forced.id)];
    const run = ascendWith(veteranAt(6, lightReceipt, onlyForced), { ruleId: forced.id, declineRule: true }).player;
    assert.equal(run.ascensionRuleDeclined, false);
    assert.deepEqual(getRuleDeclinePasses(run), [], '거절할 수 없는 카드는 지나가지 않는다 — 정복해야 지나간다');
    // 변조된 플래그(거절할 수 없는 카드에 declined true)도 세지 않는다.
    assert.deepEqual(getRuleDeclinePasses({ ...run, ascensionRuleDeclined: true }), []);
    assert.deepEqual(getRuleDeclinePasses(veteranAt(7, 'old', BASE_IDS)), [], '이전 세이브');
    assert.deepEqual(getRuleDeclinePasses(veteranAt(7, 'bad', BASE_IDS, { passes: ['nope', STACKED_IDS[0]] })), [STACKED_IDS[0]], '모르는 id는 버린다');
    assert.deepEqual(getRuleDeclinePasses(null), []);
});

test('거절 기록은 계정 단위다 — 사망 재시작 · 계승을 넘고, 다시 뽑기 가능 여부도 지나간 규칙을 뺀 덱으로 본다', () => {
    const player = veteranAt(8, 'perm', BASE_IDS, { passes: [STACKED_IDS[3], STACKED_IDS[4]] });
    const permanent = pickPermanentPlayerState(player, INITIAL_STATE.player);
    assert.deepEqual(permanent.stats.ruleDeclinePassIds, [STACKED_IDS[3], STACKED_IDS[4]]);
    // 덱 여섯 중 넷이 지나가면 남은 둘 — 패(3장)보다 작으니 다시 뽑을 수 없다.
    const fourGone = veteranAt(10, 'reroll', [...BASE_IDS, STACKED_IDS[0], STACKED_IDS[1]], { passes: [STACKED_IDS[3], STACKED_IDS[4]] });
    assert.equal(getAscensionRuleOffer(fourGone, 11).length, 2);
    assert.equal(canRerollAscensionRuleOffer(fourGone, 11), false);
    const noneGone = veteranAt(6, 'reroll');
    assert.equal(canRerollAscensionRuleOffer(noneGone, 7), true);
    // 지나간 규칙은 정복 번호(칭호 복구 · 도감)에 들지 않는다.
    assert.equal(ALL_ASCENSION_RULES.length, 12);
});
