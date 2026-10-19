import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { ALL_ASCENSION_RULES, ASCENSION_RULES, OUTLOOK_DEFAULT_SAMPLES, STACKED_ASCENSION_RULES } from '../src/data/ascensionRules.js';
import { BALANCE } from '../src/data/constants.js';
import { TITLES, TITLE_PASSIVES } from '../src/data/titles.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import {
    getActiveAscensionTwists,
    getAscensionRuleOffer,
    getAscensionRuleOfferSecond,
    getAscensionRuleStartLog,
    getStackedSecondModifier,
    resolveAscensionRuleChoice,
} from '../src/systems/ascensionRule.js';
import { resolveEndgameVictory } from '../src/systems/endgameSettlement.js';
import { getAscensionRuleOfferView, getAscensionRulePreview, getCollectionSummary } from '../src/utils/ascensionRuleView.js';
import { getChallengeRewardMult } from '../src/utils/challengeRules.js';
import { checkTitles } from '../src/utils/gameUtils.js';
import { buildRunChallengeModifiers } from '../src/utils/runStart.js';
import ChallengeModifierPicker from '../src/components/ChallengeModifierPicker.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 105 — 겹친 회차 규칙 (소유자 결정 §109.4 (c): "2순환부터 겹친 카드만 · 카드마다 무작위 두 번째 비틀기 · 새 정복 칭호 6개 + 각인").
 *
 * 13회차 측정(원장 §109)에서 2순환 무거운 회차의 사망이 1순환의 37 ~ 63%로 줄었다 — 영구 성장이 비틀기 하나의 무게를 따라잡는다.
 * 기본 여섯 규칙을 모두 한 번 정복하면 덱이 겹친 여섯 규칙으로 바뀌고, 카드마다 두 번째 비틀기가 하나 더 붙는다(수치 보정이 아니라 콘텐츠).
 */

const NOW = 1_700_000_000_000;
const BASE_IDS = ASCENSION_RULES.map((rule) => rule.id);
const TWISTS = BALANCE.CHALLENGE_MODIFIERS.map((modifier) => modifier.id);
const RECEIPTS = Array.from({ length: 80 }, (_, i) => `rk-${i}`);

const veteranAt = (rank, receipt, ledger = BASE_IDS, extraMeta = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '겹친 길', job: '전사', level: 50, hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank, endgame: { lastEndgameReceiptKey: receipt }, ...extraMeta },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: [...ledger] },
});

const ascendWith = (player, payload = {}) => gameReducer(
    { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: player.meta.prestigeRank, sourceReceiptKey: player.meta.endgame.lastEndgameReceiptKey,
        seed: 1, challengeModifiers: [], ...payload } },
);

const demonKing = { name: '마왕', baseName: '마왕', isBoss: true, hp: 0, maxHp: 10_000, atk: 500, def: 100, exp: 9_000, gold: 9_000 };

test('겹친 규칙 데이터 — 기본 여섯을 하나씩 바탕으로, 비틀기 · 표적 · 선택형은 그대로, 칭호는 자기 것(패시브 포함)', () => {
    assert.equal(STACKED_ASCENSION_RULES.length, ASCENSION_RULES.length);
    assert.deepEqual(STACKED_ASCENSION_RULES.map((rule) => rule.stackedOf), BASE_IDS);
    assert.deepEqual(ALL_ASCENSION_RULES.map((rule) => rule.id), [...BASE_IDS, ...STACKED_ASCENSION_RULES.map((rule) => rule.id)]);
    for (const [index, stacked] of STACKED_ASCENSION_RULES.entries()) {
        const base = ASCENSION_RULES[index];
        assert.equal(stacked.modifier, base.modifier);
        assert.equal(stacked.signatureSet, base.signatureSet);
        assert.equal(stacked.optional === true, base.optional === true);
        assert.notEqual(stacked.conquestTitle.id, base.conquestTitle.id);
        assert.ok(TITLES.some((title) => title.id === stacked.conquestTitle.id && title.name === stacked.conquestTitle.name), stacked.id);
        assert.ok(TITLE_PASSIVES[stacked.conquestTitle.id]?.label, `${stacked.id} 칭호 패시브`);
    }
    assert.equal(new Set(ALL_ASCENSION_RULES.map((rule) => rule.conquestTitle.id)).size, 12, '칭호 12개가 서로 다르다');
});

test('덱 — 기본 여섯을 모두 정복하기 전에는 기본 카드만, 모두 정복하면 겹친 카드만, 겹친 여섯도 다 정복하면 겹친 카드로 다시 찬다', () => {
    for (const receipt of RECEIPTS.slice(0, 20)) {
        assert.ok(getAscensionRuleOffer(veteranAt(5, receipt, BASE_IDS.slice(0, 5)), 6).every((rule) => !rule.stackedOf), '한 규칙이 남으면 기본');
        assert.ok(getAscensionRuleOffer(veteranAt(6, receipt), 7).every((rule) => rule.stackedOf), '모두 정복하면 겹친 카드만');
        const third = getAscensionRuleOffer(veteranAt(12, receipt, ALL_ASCENSION_RULES.map((rule) => rule.id)), 13);
        assert.equal(third.length, BALANCE.ASCENSION_RULE_OFFER_COUNT);
        assert.ok(third.every((rule) => rule.stackedOf), '3순환도 겹친 카드');
    }
    // 2순환을 고르지 않고(가장 가벼운 카드) 돌면 겹친 여섯을 모두 거친다.
    for (const receipt of ['a', 'b', 'c']) {
        let ledger = [...BASE_IDS];
        const seen = [];
        for (let rank = 7; rank <= 12; rank += 1) {
            const rule = resolveAscensionRuleChoice(getAscensionRuleOffer(veteranAt(rank - 1, `${receipt}-${rank}`, ledger), rank), undefined);
            seen.push(rule.id);
            ledger = [...ledger, rule.id];
        }
        assert.deepEqual([...seen].sort(), STACKED_ASCENSION_RULES.map((rule) => rule.id).sort(), receipt);
    }
});

test('두 번째 비틀기 — 바탕 비틀기를 뺀 다섯 가지 중 하나, 같은 카드는 같은 값, 처치 · 다시 뽑기마다 달라진다(난수 미사용)', () => {
    for (const stacked of STACKED_ASCENSION_RULES) {
        const seen = new Set();
        for (const receipt of RECEIPTS) {
            const second = getStackedSecondModifier(stacked, receipt, 7, 0);
            assert.ok(TWISTS.includes(second) && second !== stacked.modifier, `${stacked.id} ${receipt}`);
            assert.equal(getStackedSecondModifier(stacked, receipt, 7, 0), second, '같은 입력은 같은 값');
            seen.add(second);
        }
        assert.equal(seen.size, TWISTS.length - 1, `${stacked.id}: 다섯 가지가 모두 나온다`);
        const byReroll = new Set([0, 1, 2, 3, 4, 5].map((k) => getStackedSecondModifier(stacked, 'rk-x', 7, k)));
        assert.ok(byReroll.size > 1, '다시 뽑기 횟수가 씨앗에 든다');
    }
    assert.equal(getStackedSecondModifier(ASCENSION_RULES[0], 'rk', 7, 0), null, '기본 규칙은 두 번째 비틀기가 없다');
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random'); };
    try {
        getAscensionRuleOfferView(veteranAt(6, 'rk-rng'), 7);
    } finally {
        Math.random = original;
    }
});

test('계승 — 고른 겹친 카드의 두 번째 비틀기가 화면 카드와 같고, 두 비틀기가 강제되며 슬롯은 그대로 · 보상 배율은 둘을 센다', () => {
    let checked = 0;
    for (const receipt of RECEIPTS.slice(0, 30)) {
        const player = veteranAt(6, receipt);
        const view = getAscensionRuleOfferView(player, 7);
        for (const card of view.cards) {
            assert.equal(card.lockedIds.length, 2, `${card.id}: 잠긴 칸 둘`);
            const next = ascendWith(player, { ruleId: card.id, challengeModifiers: TWISTS });
            const second = getAscensionRuleOfferSecond(player, 7, STACKED_ASCENSION_RULES.find((rule) => rule.id === card.id));
            assert.deepEqual(card.lockedIds, [STACKED_ASCENSION_RULES.find((rule) => rule.id === card.id).modifier, second]);
            assert.deepEqual(next.player.meta.ascensionRule, { rank: 7, ruleId: card.id, secondModifier: second });
            const mods = next.player.challengeModifiers;
            assert.deepEqual(mods.slice(0, 2), card.lockedIds, '두 비틀기가 먼저');
            assert.equal(new Set(mods).size, mods.length, '중복 없음');
            assert.ok(mods.length - 2 <= 4, '고른 도전 조건은 슬롯 수까지(rank 7 슬롯 4)');
            assert.equal(getChallengeRewardMult(mods.length), BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT[Math.min(mods.length, 4)]);
            // 같은 단계의 사망 재시작(start)도 같은 두 비틀기를 읽는다.
            assert.deepEqual(buildRunChallengeModifiers([], next.player.meta), card.lockedIds);
            assert.deepEqual(getActiveAscensionTwists(next.player.meta), card.lockedIds);
            checked += 1;
        }
    }
    assert.ok(checked >= 60);
});

test('선택형 겹친 규칙을 거절하면 두 비틀기 · 표적 · 정복이 모두 없다 — 바탕이 가벼운 겹친 규칙은 두 번째도 가벼우면 거절할 수 없다', () => {
    const optional = STACKED_ASCENSION_RULES.filter((rule) => rule.optional);
    const forced = STACKED_ASCENSION_RULES.filter((rule) => !rule.optional);
    assert.equal(optional.length, 3);
    for (const rule of optional) {
        const ledger = [...BASE_IDS, ...STACKED_ASCENSION_RULES.filter((other) => other.id !== rule.id).map((other) => other.id)];
        const player = veteranAt(6, 'rk-opt', ledger);
        const declined = ascendWith(player, { ruleId: rule.id, declineRule: true });
        assert.equal(declined.player.ascensionRuleDeclined, true);
        assert.deepEqual(declined.player.challengeModifiers, []);
        const kill = resolveEndgameVictory({ player: { ...declined.player, hp: 900 }, deadEnemy: demonKing, receiptKey: 'kill-opt', rng: () => 0.99, now: NOW });
        assert.ok(!(kill.player.titles || []).includes(rule.conquestTitle.id), '거절하면 정복 칭호가 없다');
    }
    // 2026-10 Wave 106: 무거운 두 번째 비틀기가 붙으면 바탕이 가벼워도 거절할 수 있다(`tests/stacked-heavy-second-optional.test.js`) —
    //   여기서는 가벼운 두 번째가 붙은 카드만 본다. 처치 영수증은 그런 카드가 나오는 것을 고른다(고정 영수증 하나로는 우연에 기댄다).
    for (const rule of forced) {
        const ledger = [...BASE_IDS, ...STACKED_ASCENSION_RULES.filter((other) => other.id !== rule.id).map((other) => other.id)];
        const receipt = RECEIPTS.find((key) => {
            const second = getStackedSecondModifier(rule, key, 7, 0);
            return !ASCENSION_RULES.some((base) => base.optional && base.modifier === second);
        });
        assert.ok(receipt, `${rule.id}: 가벼운 두 번째가 붙는 영수증`);
        const next = ascendWith(veteranAt(6, receipt, ledger), { ruleId: rule.id, declineRule: true });
        assert.equal(next.player.ascensionRuleDeclined, false);
        assert.equal(next.player.challengeModifiers.length >= 2, true);
    }
});

test('정복 — 겹친 규칙의 칭호 · 각인 · 원장 한 줄, 칭호는 기록으로 복구되고 "모든 규칙의 정복자"는 기본 여섯만 본다', () => {
    const rule = STACKED_ASCENSION_RULES[1];
    const ledger = [...BASE_IDS, ...STACKED_ASCENSION_RULES.filter((other) => other.id !== rule.id).map((other) => other.id)];
    const ascended = ascendWith(veteranAt(6, 'rk-conquer', ledger), { ruleId: rule.id });
    const kill = resolveEndgameVictory({ player: { ...ascended.player, hp: 900 }, deadEnemy: demonKing, receiptKey: 'kill-conquer', rng: () => 0.99, now: NOW });
    assert.ok(kill.player.titles.includes(rule.conquestTitle.id));
    assert.equal(kill.player.stats.ruleConquestRuleIds.at(-1), rule.id);
    const restored = checkTitles({ ...kill.player, titles: [] });
    assert.ok(restored.includes(rule.conquestTitle.id), '정복 기록으로 칭호 복구');

    const onlyStacked = checkTitles({ ...structuredClone(INITIAL_STATE.player), titles: [],
        stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: STACKED_ASCENSION_RULES.map((r) => r.id) } });
    assert.ok(!onlyStacked.includes('conquest_all'), '겹친 규칙만 정복해서는 모든 규칙의 정복자가 아니다');
    assert.ok(STACKED_ASCENSION_RULES.every((r) => onlyStacked.includes(r.conquestTitle.id)));
});

test('화면 — 겹친 카드는 두 비틀기를 함께 말하고 두 칸을 잠그며, 시작 로그도 둘을 말한다. 도감 정복 분모는 덱이 열린 뒤에만 12', () => {
    const player = veteranAt(6, 'rk-view');
    const view = getAscensionRuleOfferView(player, 7);
    const card = view.cards[0];
    const labelOf = (id) => BALANCE.CHALLENGE_MODIFIERS.find((modifier) => modifier.id === id).label;
    for (const id of card.lockedIds) assert.ok(card.twist.includes(labelOf(id)) && card.detail.includes(labelOf(id)));
    const html = renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 4, onToggle: () => {}, rule: card, ruleOffer: view.cards, onSelectRule: () => {},
    }));
    for (const id of card.lockedIds) {
        assert.match(html.match(new RegExp(`<button[^>]*data-testid="probe-challenge-${id}"[^>]*>`))[0], /aria-disabled="true"/);
    }
    const next = ascendWith(player, { ruleId: card.id });
    const log = getAscensionRuleStartLog(next.player.meta);
    for (const id of card.lockedIds) assert.ok(log.includes(labelOf(id)), `시작 로그에 ${id}`);
    assert.deepEqual(getAscensionRulePreview(next.player.meta).lockedIds, card.lockedIds, '사망 재시작 화면도 같은 두 칸');

    assert.equal(getCollectionSummary(veteranAt(5, 'x', BASE_IDS.slice(0, 5))).conquestTotal, 6, '덱이 열리기 전에는 겹친 규칙을 말하지 않는다');
    assert.equal(getCollectionSummary(veteranAt(6, 'x')).conquestTotal, 12);
});

test('변조 · 이전 세이브 — 두 번째 비틀기 기록이 없거나 잘못됐거나 바탕과 같으면 바탕 비틀기 하나만', () => {
    const rule = STACKED_ASCENSION_RULES[0];
    const metaWith = (secondModifier) => ({ prestigeRank: 7, ascensionRule: { rank: 7, ruleId: rule.id, ...(secondModifier === undefined ? {} : { secondModifier }) } });
    assert.deepEqual(getActiveAscensionTwists(metaWith(undefined)), [rule.modifier]);
    assert.deepEqual(getActiveAscensionTwists(metaWith('nope')), [rule.modifier]);
    assert.deepEqual(getActiveAscensionTwists(metaWith(rule.modifier)), [rule.modifier]);
    assert.deepEqual(getActiveAscensionTwists({ prestigeRank: 8, ascensionRule: { rank: 7, ruleId: rule.id, secondModifier: 'halfHp' } }).length, 1, '다른 단계 기록은 고정 순서(기본)');
    assert.deepEqual(getActiveAscensionTwists({ prestigeRank: 1, ascensionRule: { rank: 1, ruleId: ASCENSION_RULES[0].id, secondModifier: 'halfHp' } }), [ASCENSION_RULES[0].modifier], '기본 규칙은 두 번째를 무시');
});

test('겹친 규칙은 단계 구간마다 거절할 수 있는 카드의 받아들임 · 거절 측정을 들고, 화면은 지금 단계의 구간 값을 거절할 수 있는 카드에서만 그린다', async () => {
    const { MSG } = await import('../src/data/messages.js');
    const { buildAscensionRulePreview } = await import('../src/utils/ascensionRuleView.js');
    const { getPrestigeUnlocks } = await import('../src/systems/prestigeUnlocks.js');
    const r1 = (value) => (Math.round(value * 10) / 10).toFixed(1);
    const isHeavy = (id) => ASCENSION_RULES.some((base) => base.optional && base.modifier === id);
    // 2026-10 Wave 123: 구간 경계는 영구 능력치가 ×2가 되는 단계다 — 그 앞뒤로 같은 카드의 사망이 2.6 ~ 10배 다르다(원장 §128.5 · §130).
    const transcendRank = Array.from({ length: 40 }, (_, i) => i + 1).find((rank) => getPrestigeUnlocks(rank).statMult > 1);
    const first = ASCENSION_RULES.length + 1;
    const last = ASCENSION_RULES.length * 2;
    assert.ok(transcendRank > first && transcendRank <= last, `구간 경계 ${transcendRank}는 2순환 안이다`);
    for (const rule of STACKED_ASCENSION_RULES) {
        // 2026-10 Wave 106: 바탕이 가벼운 겹친 규칙도 무거운 두 번째 비틀기가 붙으면 거절할 수 있어 측정을 든다.
        assert.deepEqual(rule.outlook.map((o) => o.measuredRanks), [[first, transcendRank - 1], [transcendRank, last]], `${rule.id}: 영구 능력치 ×2 앞뒤 두 구간`);
        for (const o of rule.outlook) {
            const band = o.measuredRanks.join('~');
            assert.ok(o.measuredRank >= o.measuredRanks[0] && o.measuredRank <= o.measuredRanks[1], `${rule.id} ${band}: 가장 많이 놓인 단계는 구간 안`);
            assert.ok(o.acceptedDeaths > o.declinedDeaths, `${rule.id} ${band}: 받아들임이 더 위험하다`);
            assert.ok(o.acceptedSignatures > o.declinedSignatures, `${rule.id} ${band}: 받아들임이 각인을 더 준다`);
        }
        for (const receipt of RECEIPTS.slice(0, 12)) {
            for (const rank of [first, transcendRank - 1, transcendRank, last, last + 4]) {
                const o = rule.outlook[rank < transcendRank ? 0 : 1];
                const second = getStackedSecondModifier(rule, receipt, rank, 0);
                const preview = buildAscensionRulePreview(rule, rank, second);
                if (!(rule.optional || isHeavy(second))) {
                    assert.equal(preview.outlook, null, `${rule.id} + ${second}: 거절할 수 없는 카드에는 고를 차이가 없다`);
                    continue;
                }
                assert.equal(preview.outlook.accepted, MSG.ASCENSION_RULE_OUTLOOK_ACCEPTED(r1(o.acceptedDeaths), r1(o.acceptedSignatures)), `${rule.id} rank ${rank}`);
                assert.equal(preview.outlook.declined, MSG.ASCENSION_RULE_OUTLOOK_DECLINED(r1(o.declinedDeaths), r1(o.declinedSignatures)), `${rule.id} rank ${rank}`);
                assert.equal(preview.outlook.source, MSG.ASCENSION_RULE_OUTLOOK_SOURCE_STACKED(o.measuredRanks[0], o.measuredRanks[1], o.samples ?? OUTLOOK_DEFAULT_SAMPLES), `${rule.id} rank ${rank}: 잰 구간 · 판 수를 밝힌다`);
            }
        }
    }
});

test('Wave 123: 겹친 카드 미리보기는 지금 단계의 구간(영구 능력치 ×2 앞 · 뒤) 값이고, 출처 줄은 잰 구간 · 판 수를 밝힌다', async () => {
    const { buildAscensionRulePreview } = await import('../src/utils/ascensionRuleView.js');
    const byId = Object.fromEntries(STACKED_ASCENSION_RULES.map((rule) => [rule.id, rule]));
    const early = buildAscensionRulePreview(byId.stacked_empty_crusade, 8, 'halfHp');
    assert.equal(early.outlook.accepted, '받아들이면: 사망 37.7회 · 새 각인 +1.2개 · 정복 보상');
    assert.equal(early.outlook.declined, '거절하면: 사망 2.4회 · 새 각인 +0.3개');
    assert.equal(early.outlook.source, '그 회차 평균 · 모의 플레이 77판 · 2순환 카드 뽑기, 계승 7 ~ 9단계에서 잰 값');
    const late = buildAscensionRulePreview(byId.stacked_empty_crusade, 10, 'halfHp');
    assert.equal(late.outlook.accepted, '받아들이면: 사망 5.3회 · 새 각인 +1.2개 · 정복 보상', '5.25는 5.3으로 반올림한다');
    assert.equal(late.outlook.source, '그 회차 평균 · 모의 플레이 61판 · 2순환 카드 뽑기, 계승 10 ~ 12단계에서 잰 값');
    assert.equal(buildAscensionRulePreview(byId.stacked_tangled_legends, 9, 'noGold').outlook.accepted, '받아들이면: 사망 124.4회 · 새 각인 +1.0개 · 정복 보상');
    // 3순환 이후는 마지막 구간(영구 능력치 ×2 뒤) 값이고, 출처 줄이 잰 구간을 밝힌다(숫자를 지어내지 않는다).
    assert.deepEqual(buildAscensionRulePreview(byId.stacked_fading_dimension, 18, 'noGold').outlook, buildAscensionRulePreview(byId.stacked_fading_dimension, 12, 'noGold').outlook);
    assert.ok(!late.outlook.source.includes('고정 순서'), '겹친 규칙은 고정 순서에서 재지 않는다');
});
