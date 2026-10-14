import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { ALL_ASCENSION_RULES, ASCENSION_RULES, ASCENSION_TWIST_WEIGHTS, STACKED_ASCENSION_RULES } from '../src/data/ascensionRules.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import {
    getAscensionRuleCardWeight,
    getAscensionRuleOffer,
    getAscensionRuleOfferSecond,
    getAscensionRuleStartLog,
    getRuleSignatureDropMult,
    getSignatureSetMemberNames,
    getStackedSecondModifier,
    isHeavyAscensionTwist,
    isOptionalAscensionRule,
    resolveAscensionRuleChoice,
    resolveAscensionRuleDeclined,
    resolveAscensionRuleOfferChoice,
} from '../src/systems/ascensionRule.js';
import { resolveEndgameVictory } from '../src/systems/endgameSettlement.js';
import { buildAscensionRulePreview, getAscensionRuleOfferView } from '../src/utils/ascensionRuleView.js';
import { getCycleSummary } from '../src/utils/cycleSummary.js';
import { buildRunChallengeModifiers } from '../src/utils/runStart.js';
import ChallengeModifierPicker from '../src/components/ChallengeModifierPicker.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 106 — 무거운 두 번째 비틀기 카드는 거절할 수 있고, 기본 카드는 두 비틀기의 측정 무게 합이 가장 작은 카드다
 * (소유자 결정 §110.6 "(b)+(c) 같이").
 *
 * Wave 105 측정(원장 §110)에서 바탕이 가벼운 겹친 카드에 무거운 두 번째(생명 절반 · 강적 · 뒤섞인 기술)가 붙은 회차가 사망 5.09 ·
 * 루프 17이었고 거절할 수 없었다 — Wave 91 "무거운 비틀기는 거절할 수 있다"를 겹친 카드에도 적용한다(b). 고르지 않는 플레이어의 기본
 * 카드는 바탕 순서가 아니라 두 비틀기 측정 무게의 합으로 고른다(c).
 */

const NOW = 1_700_000_000_000;
const BASE_IDS = ASCENSION_RULES.map((rule) => rule.id);
const TWISTS = BALANCE.CHALLENGE_MODIFIERS.map((modifier) => modifier.id);
const RECEIPTS = Array.from({ length: 80 }, (_, i) => `hv-${i}`);
const demonKing = { name: '마왕', baseName: '마왕', isBoss: true, hp: 0, maxHp: 10_000, atk: 500, def: 100, exp: 9_000, gold: 9_000 };

const veteranAt = (rank, receipt, ledger = BASE_IDS, extraMeta = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '무거운 길', job: '전사', level: 50, hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank, endgame: { lastEndgameReceiptKey: receipt }, ...extraMeta },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: [...ledger] },
});

const ascendWith = (player, payload = {}) => gameReducer(
    { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: player.meta.prestigeRank, sourceReceiptKey: player.meta.endgame.lastEndgameReceiptKey,
        seed: 1, challengeModifiers: [], ...payload } },
);

/** 이 겹친 규칙 하나만 남은 덱(나머지 겹친 다섯은 이미 정복). */
const onlyRuleLedger = (rule) => [...BASE_IDS, ...STACKED_ASCENSION_RULES.filter((other) => other.id !== rule.id).map((other) => other.id)];

const expectedOptional = (rule, second) => rule.optional === true || ASCENSION_RULES.some((base) => base.optional && base.modifier === second);

test('무거운 비틀기는 선택형 기본 규칙의 비틀기이고, 측정 무게로도 위쪽 셋이다', () => {
    assert.deepEqual(Object.keys(ASCENSION_TWIST_WEIGHTS).sort(), [...TWISTS].sort(), '모든 비틀기에 측정 무게가 있다');
    const heavy = TWISTS.filter((id) => isHeavyAscensionTwist(id));
    assert.deepEqual(heavy.sort(), ASCENSION_RULES.filter((rule) => rule.optional).map((rule) => rule.modifier).sort());
    const light = TWISTS.filter((id) => !isHeavyAscensionTwist(id));
    const minHeavy = Math.min(...heavy.map((id) => ASCENSION_TWIST_WEIGHTS[id]));
    const maxLight = Math.max(...light.map((id) => ASCENSION_TWIST_WEIGHTS[id]));
    assert.ok(minHeavy > maxLight, `무거운 셋(${minHeavy}) > 가벼운 셋(${maxLight}) — 측정이 뒤집히면 선택형 판정을 다시 볼 것`);
    assert.equal(isHeavyAscensionTwist('nope'), false);
    assert.equal(isHeavyAscensionTwist(null), false);
});

test('카드 판정 — 겹친 카드는 바탕이 선택형이거나 두 번째가 무거우면 거절할 수 있고, 화면 · 계승 · 표적 · 시작 로그 · 요약이 같은 판정이다', () => {
    let heavyForced = 0;
    let lightForced = 0;
    for (const rule of STACKED_ASCENSION_RULES) {
        for (const receipt of RECEIPTS.slice(0, 24)) {
            const second = getStackedSecondModifier(rule, receipt, 7, 0);
            const optional = expectedOptional(rule, second);
            if (!rule.optional) { if (optional) heavyForced += 1; else lightForced += 1; }
            assert.equal(isOptionalAscensionRule(rule, second), optional, `${rule.id} + ${second}`);
            assert.equal(buildAscensionRulePreview(rule, 7, second).optional, optional, '화면 카드');

            const next = ascendWith(veteranAt(6, receipt, onlyRuleLedger(rule)), { ruleId: rule.id, declineRule: true });
            assert.equal(next.player.meta.ascensionRule.secondModifier, second);
            assert.equal(next.player.ascensionRuleDeclined, optional, `${rule.id} + ${second}: 거절 저장`);
            const signature = getSignatureSetMemberNames(rule.signatureSet)[0];
            if (optional) {
                assert.deepEqual(next.player.challengeModifiers, [], '거절하면 두 비틀기가 모두 없다');
                assert.equal(getRuleSignatureDropMult(next.player, signature), 1, '거절하면 표적 배율이 없다');
                assert.equal(getAscensionRuleStartLog(next.player.meta, true), MSG.ASCENSION_RULE_DECLINED_START(rule.name));
                assert.equal(getCycleSummary(next.player).rule.status, 'declined');
            } else {
                assert.deepEqual(next.player.challengeModifiers.slice(0, 2), [rule.modifier, second], '가벼운 카드는 거절할 수 없다');
                assert.equal(getRuleSignatureDropMult(next.player, signature), BALANCE.ASCENSION_RULE_SIGNATURE_MULT);
                assert.notEqual(getAscensionRuleStartLog(next.player.meta, true), MSG.ASCENSION_RULE_DECLINED_START(rule.name));
                assert.equal(getCycleSummary(next.player).rule.status, 'open');
            }
        }
    }
    assert.ok(heavyForced > 0 && lightForced > 0, `바탕이 가벼운 카드의 두 경우가 모두 나온다(무거운 ${heavyForced} · 가벼운 ${lightForced})`);
});

test('거절한 무거운 두 번째 카드는 정복 칭호를 주지 않고, 받아들이면 준다 — 사망 재시작도 같은 판정이다', () => {
    const rule = STACKED_ASCENSION_RULES.find((candidate) => !candidate.optional);
    const receipt = RECEIPTS.find((key) => isHeavyAscensionTwist(getStackedSecondModifier(rule, key, 7, 0)));
    assert.ok(receipt);
    const declined = ascendWith(veteranAt(6, receipt, onlyRuleLedger(rule)), { ruleId: rule.id, declineRule: true });
    const accepted = ascendWith(veteranAt(6, receipt, onlyRuleLedger(rule)), { ruleId: rule.id });
    const kill = (player) => resolveEndgameVictory({ player: { ...player, hp: 900 }, deadEnemy: demonKing, receiptKey: 'kill-hv', rng: () => 0.99, now: NOW });
    assert.ok(!(kill(declined.player).player.titles || []).includes(rule.conquestTitle.id), '거절하면 정복이 없다');
    assert.ok((kill(accepted.player).player.titles || []).includes(rule.conquestTitle.id), '받아들이면 정복 칭호');

    // 사망 재시작(새 게임 `start`)은 같은 meta로 같은 판정을 읽는다.
    const meta = accepted.player.meta;
    assert.equal(resolveAscensionRuleDeclined(meta, true), true);
    assert.deepEqual(buildRunChallengeModifiers([], meta, true), []);
    // 변조 · 이전 세이브 — 두 번째 기록이 없거나 바탕과 같으면 바탕 하나이고, 바탕이 가벼우면 거절할 수 없다.
    for (const secondModifier of [undefined, rule.modifier, 'nope']) {
        const tampered = { ...meta, ascensionRule: { ...meta.ascensionRule, secondModifier } };
        assert.equal(resolveAscensionRuleDeclined(tampered, true), false, String(secondModifier));
        assert.deepEqual(buildRunChallengeModifiers([], tampered, false), [rule.modifier]);
    }
});

test('기본 카드 — 겹친 패는 두 비틀기의 측정 무게 합이 가장 작은 카드(같으면 규칙 번호 순), 기본 패는 규칙 표 순서 그대로', () => {
    const order = (rule) => ALL_ASCENSION_RULES.indexOf(rule);
    for (const receipt of RECEIPTS) {
        for (const [rank, ledger] of [[6, BASE_IDS], [8, [...BASE_IDS, STACKED_ASCENSION_RULES[0].id, STACKED_ASCENSION_RULES[3].id]]]) {
            const player = veteranAt(rank, receipt, ledger);
            const offer = getAscensionRuleOffer(player, rank + 1);
            assert.ok(offer.every((rule) => rule.stackedOf));
            const weighed = offer.map((rule) => ({ rule, weight: getAscensionRuleCardWeight(rule, getAscensionRuleOfferSecond(player, rank + 1, rule)) }));
            const expected = [...weighed].sort((a, b) => a.weight - b.weight || order(a.rule) - order(b.rule))[0].rule;
            assert.equal(resolveAscensionRuleOfferChoice(player, rank + 1, undefined).id, expected.id, `${receipt} rank ${rank + 1}`);
            assert.equal(getAscensionRuleOfferView(player, rank + 1).defaultId, expected.id, '화면이 처음 골라 두는 카드');
            const next = ascendWith(player);
            assert.equal(next.player.meta.ascensionRule.ruleId, expected.id, '고르지 않은 계승');
            assert.equal(next.player.meta.ascensionRule.secondModifier, getAscensionRuleOfferSecond(player, rank + 1, expected));
        }
        // 1순환은 Wave 90 · 94 그대로 — 규칙 표 순서(측정 무게 표로 다시 줄 세우지 않는다).
        const base = veteranAt(3, receipt, BASE_IDS.slice(0, 1));
        const baseOffer = getAscensionRuleOffer(base, 4);
        const first = [...baseOffer].sort((a, b) => order(a) - order(b))[0];
        assert.equal(resolveAscensionRuleOfferChoice(base, 4, undefined).id, first.id);
        assert.equal(resolveAscensionRuleChoice(baseOffer, undefined).id, first.id);
    }
});

test('다시 뽑은 패도 같은 기본 카드 판정이고, 고른 카드는 무게와 무관하게 그대로다', () => {
    for (const receipt of RECEIPTS.slice(0, 30)) {
        for (const rerolls of [1, 2]) {
            const player = veteranAt(6, receipt, BASE_IDS, { ascensionRuleOffer: { receiptKey: receipt, rank: 7, rerolls } });
            const view = getAscensionRuleOfferView(player, 7);
            const next = ascendWith(player);
            assert.equal(next.player.meta.ascensionRule.ruleId, view.defaultId, `${receipt} 다시 뽑기 ${rerolls}`);
            const heaviest = [...getAscensionRuleOffer(player, 7)].sort((a, b) => (
                getAscensionRuleCardWeight(b, getAscensionRuleOfferSecond(player, 7, b)) - getAscensionRuleCardWeight(a, getAscensionRuleOfferSecond(player, 7, a))
            ))[0];
            assert.equal(ascendWith(player, { ruleId: heaviest.id }).player.meta.ascensionRule.ruleId, heaviest.id, '고른 카드는 그대로');
        }
    }
});

test('고르지 않는 플레이어는 바탕 순서로 고르던 때보다 가벼운 카드를 받는다', () => {
    const order = (rule) => ALL_ASCENSION_RULES.indexOf(rule);
    let weightNow = 0;
    let weightBefore = 0;
    let heavyNow = 0;
    let heavyBefore = 0;
    for (const receipt of RECEIPTS) {
        const player = veteranAt(6, receipt);
        const second = (rule) => getAscensionRuleOfferSecond(player, 7, rule);
        const now = resolveAscensionRuleOfferChoice(player, 7, undefined);
        const before = [...getAscensionRuleOffer(player, 7)].sort((a, b) => order(a) - order(b))[0];
        weightNow += getAscensionRuleCardWeight(now, second(now));
        weightBefore += getAscensionRuleCardWeight(before, second(before));
        if (isHeavyAscensionTwist(second(now)) || now.optional) heavyNow += 1;
        if (isHeavyAscensionTwist(second(before)) || before.optional) heavyBefore += 1;
    }
    assert.ok(weightNow < weightBefore, `무게 합 평균 ${weightNow / RECEIPTS.length} < ${weightBefore / RECEIPTS.length}`);
    assert.ok(heavyNow < heavyBefore, `무거운 비틀기가 든 기본 카드 ${heavyNow} < ${heavyBefore}`);
});

test('선택 화면 — 무거운 두 번째가 붙은 카드에는 받아들임 · 거절 단추와 거절 표시가 있고, 가벼운 카드에는 없다', () => {
    const rule = STACKED_ASCENSION_RULES.find((candidate) => !candidate.optional);
    const heavyReceipt = RECEIPTS.find((key) => isHeavyAscensionTwist(getStackedSecondModifier(rule, key, 7, 0)));
    const lightReceipt = RECEIPTS.find((key) => !isHeavyAscensionTwist(getStackedSecondModifier(rule, key, 7, 0)));
    const render = (preview, declined = false) => renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'hv', selected: [], slots: 4, onToggle: () => {}, rule: preview, ruleDeclined: declined, onToggleRule: () => {},
        ruleOffer: [preview, preview], onSelectRule: () => {},
    }));
    const heavy = buildAscensionRulePreview(rule, 7, getStackedSecondModifier(rule, heavyReceipt, 7, 0));
    const light = buildAscensionRulePreview(rule, 7, getStackedSecondModifier(rule, lightReceipt, 7, 0));
    assert.match(render(heavy), /data-testid="hv-ascension-rule-toggle"/);
    assert.ok(render(heavy).includes(MSG.ASCENSION_RULE_CARD_OPTIONAL), '카드에 거절할 수 있다는 표시');
    assert.ok(render(heavy, true).includes(MSG.ASCENSION_RULE_DECLINED_DETAIL), '거절하면 거절 문구');
    for (const id of heavy.lockedIds) assert.doesNotMatch(render(heavy, true), new RegExp(`data-testid="hv-challenge-${id}"[^>]*aria-disabled="true"`), '거절하면 잠긴 칸이 없다');
    assert.doesNotMatch(render(light), /data-testid="hv-ascension-rule-toggle"/);
    assert.ok(!render(light).includes(MSG.ASCENSION_RULE_CARD_OPTIONAL));
});
