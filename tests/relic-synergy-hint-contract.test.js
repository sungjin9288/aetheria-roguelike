import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { MSG } from '../src/data/messages.js';
import { RELICS, RELIC_EFFECTS_BY_BUILD, RELIC_SYNERGIES, getActiveRelicSynergies } from '../src/data/relics.js';
import RelicChoicePanel from '../src/components/RelicChoicePanel.js';
import { getRelicChoiceDecisionStrip } from '../src/utils/relicChoiceDecision.js';
import { getRelicSynergyScore } from '../src/utils/relicSynergyHint.js';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 47 — 유물 선택 카드의 조합 힌트는 실제 조합(엔진의 `getActiveRelicSynergies`)이 켜지는 순간을 알린다.
 *
 * 원장 §47: 실제 조합 20개 중 15개가 두 조각인데, 선택 카드는 세 조각 전설 조합의 완성만 이름으로 찾았다.
 * 두 조각 조합의 마지막 조각을 제안받아도 15개 중 14개는 힌트가 없었고(추천도 등급 점수로만 갈렸다),
 * 대신 조합 보너스가 없는 효과 짝 표만 "좋은 조합"으로 점수를 받았다.
 */

const BY_NAME = Object.fromEntries(RELICS.map((relic) => [relic.name, relic]));
// 어떤 조합에도 들지 않는 일반 유물 — 추천 경쟁의 들러리.
const FILLERS = RELICS.filter((relic) => relic.rarity === 'common'
    && !RELIC_SYNERGIES.some((syn) => syn.requires.includes(relic.name)));

/** 조합마다 빠진 조각 하나를 제안받는 모든 경우(빠진 조각 = 조합의 각 조각). */
const completionCases = () => RELIC_SYNERGIES.flatMap((syn) => syn.requires.map((missing) => ({
    syn,
    missing: BY_NAME[missing],
    owned: syn.requires.filter((name) => name !== missing).map((name) => BY_NAME[name]),
})));

test('표본: 실제 조합은 두 조각 15개 · 세 조각 5개이고 조각은 모두 유물 목록에 있다', () => {
    const sizes = RELIC_SYNERGIES.reduce((acc, syn) => ({ ...acc, [syn.requires.length]: (acc[syn.requires.length] || 0) + 1 }), {});
    assert.deepEqual(sizes, { 2: 15, 3: 5 });
    for (const syn of RELIC_SYNERGIES) for (const name of syn.requires) assert.ok(BY_NAME[name], `${syn.label}: ${name}`);
    assert.ok(FILLERS.length >= 2, '추천 경쟁용 일반 유물 2개 이상');
});

test('모든 조합: 마지막 조각을 제안받으면 카드가 그 조합의 완성을 알린다 (조각 순서 전수)', () => {
    let cases = 0;
    for (const { syn, missing, owned } of completionCases()) {
        const hint = getRelicSynergyScore(missing, owned);
        const field = syn.requires.length === 3 ? 'legendaryHint' : 'completesPair';
        assert.equal(hint[field], syn.label, `${syn.label}: ${missing.name}를 제안받을 때 ${field}`);
        cases += 1;
    }
    assert.equal(cases, 15 * 2 + 5 * 3);
});

test('완성 힌트 ⇔ 엔진에서 새로 켜지는 조합 — 모든 유물 × 조합 조각 부분집합', () => {
    // 가진 유물 = 어떤 조합의 조각 부분집합(빈 집합 포함). 제안 = 모든 유물 67개.
    const ownedSets = new Map([['', []]]);
    for (const syn of RELIC_SYNERGIES) {
        const pieces = syn.requires.map((name) => BY_NAME[name]);
        for (let mask = 1; mask < (1 << pieces.length) - 1; mask += 1) {
            const subset = pieces.filter((_, i) => mask & (1 << i));
            ownedSets.set(subset.map((r) => r.name).sort().join('|'), subset);
        }
    }
    let checked = 0;
    for (const owned of ownedSets.values()) {
        const ownedNames = new Set(owned.map((r) => r.name));
        const before = new Set(getActiveRelicSynergies(owned).map((syn) => syn.label));
        for (const relic of RELICS) {
            if (ownedNames.has(relic.name)) continue;
            const newly = getActiveRelicSynergies([...owned, relic]).filter((syn) => !before.has(syn.label));
            const hint = getRelicSynergyScore(relic, owned);
            const expectedLegendary = newly.find((syn) => syn.requires.length === 3)?.label;
            const expectedPair = newly.find((syn) => syn.requires.length === 2)?.label;
            assert.equal(hint.legendaryHint, expectedLegendary, `${relic.name} + [${[...ownedNames]}] 전설 조합`);
            assert.equal(hint.completesPair, expectedPair, `${relic.name} + [${[...ownedNames]}] 두 조각 조합`);
            checked += 1;
        }
    }
    assert.ok(checked > 3000, `판정 ${checked}건`);
});

test('추천 줄은 조합을 완성하는 카드를 고르고 그 이유를 말한다', () => {
    for (const { syn, missing, owned } of completionCases()) {
        const cards = [FILLERS[0], missing, FILLERS[1]].map((relic, index) => ({
            relic, index, synergy: getRelicSynergyScore(relic, owned),
        }));
        const decision = getRelicChoiceDecisionStrip(cards, 'balanced');
        assert.equal(decision.recommendedIndex, 1, `${syn.label}: 완성 조각 추천`);
        const reason = decision.cells.find((cell) => cell.label === '이유')?.value;
        assert.equal(reason, syn.requires.length === 3 ? MSG.RELIC_SYNERGY_LEGENDARY_COMPLETE : MSG.RELIC_REASON_PAIR_COMPLETE, `${syn.label}: 추천 이유`);
    }
});

test('선택 화면은 두 조각 조합 완성을 배지와 조합 이름으로 그리고 추천 표시를 붙인다', () => {
    for (const syn of RELIC_SYNERGIES.filter((entry) => entry.requires.length === 2)) {
        const [first, second] = syn.requires.map((name) => BY_NAME[name]);
        const html = renderStatic(React.createElement(RelicChoicePanel, {
            pendingRelics: [FILLERS[0], second, FILLERS[1]],
            dispatch: () => {},
            player: makePlayerFixture({ relics: [first] }),
            stats: null,
        }));
        assert.ok(html.includes(MSG.RELIC_SYNERGY_COMPLETE_LINE(syn.label)), `${syn.label}: 완성 줄`);
        assert.ok(html.includes(MSG.RELIC_PAIR_COMPLETE_BADGE), `${syn.label}: 완성 배지`);
        assert.match(html, /data-testid="relic-choice-1"[^>]*data-relic-recommended="true"/, `${syn.label}: 추천 표시`);
    }
});

/** Wave 47 이전 판정의 효과 짝 표 사본 — 짝 판정(어떤 효과끼리 짝인가)은 바뀌지 않았다. */
const LEGACY_SYNERGY_MAP = {
    double_strike: ['execute_bonus', 'combo_stack', 'armor_pen', 'ancient_power'],
    execute_bonus: ['double_strike', 'low_hp_atk', 'combo_stack'],
    combo_stack: ['double_strike', 'execute_bonus', 'ancient_power'],
    ancient_power: ['double_strike', 'combo_stack', 'execute_bonus'],
    low_hp_atk: ['execute_bonus', 'death_save', 'void_heart'],
    skill_lifesteal: ['skill_mult', 'free_skill', 'mp_regen_turn', 'crit_mp_regen'],
    skill_mult: ['skill_lifesteal', 'free_skill', 'mp_regen_turn'],
    free_skill: ['skill_mult', 'skill_lifesteal', 'mp_regen_turn', 'crit_mp_regen'],
    mp_regen_turn: ['skill_mult', 'skill_lifesteal', 'free_skill', 'crit_mp_regen'],
    crit_mp_regen: ['skill_mult', 'free_skill', 'mp_regen_turn', 'ancient_power'],
    reflect: ['fortress', 'stone_skin', 'crit_block'],
    fortress: ['reflect', 'stone_skin', 'battle_start_heal'],
    death_save: ['void_heart', 'low_hp_atk', 'battle_start_heal'],
    void_heart: ['death_save', 'low_hp_atk'],
    dot_mult: ['armor_pen', 'execute_bonus'],
    gold_mult: ['drop_rate', 'boss_hunter'],
    drop_rate: ['gold_mult', 'boss_hunter', 'exp_mult'],
    boss_hunter: ['drop_rate', 'execute_bonus', 'double_strike'],
};
/**
 * 완성하지 않는 제안의 오라클. 세 조각 조합 진행(nearLegendary)과 짝 판정은 Wave 47 이전 그대로이고,
 * Wave 48(소유자 결정)에서 효과 짝의 점수(짝당 20 · 최대 40)와 이름("함께 쓰기 좋음")만 바뀌었다.
 * Wave 49(소유자 결정 "측정 후 조건부 반영"): 진행이 아니면서 가진 조각이 하나도 없는 실제 조합의 조각이면
 * 그 조합(데이터 순서의 첫 조합)을 `startsCombo`로 싣는다.
 */
const expectedNonCompletionScore = (newRelic, ownedRelics) => {
    const ownedEffects = ownedRelics.map((r) => r.effect);
    const ownedNames = new Set(ownedRelics.map((r) => r.name));
    const near = RELIC_SYNERGIES.find((syn) => syn.requires.length === 3 && syn.requires.includes(newRelic.name)
        && syn.requires.filter((name) => ownedNames.has(name)).length === 1);
    const start = near ? undefined : RELIC_SYNERGIES.find((syn) => syn.requires.includes(newRelic.name)
        && syn.requires.every((name) => !ownedNames.has(name)));
    const startField = start ? { startsCombo: start.label } : {};
    const noPair = near ? { score: 0, label: null, synergies: [], nearLegendary: near.label } : { score: 0, label: null, synergies: [], ...startField };
    if (!ownedRelics.length) return noPair;
    const synergyEffects = LEGACY_SYNERGY_MAP[newRelic.effect] || [];
    const matches = ownedEffects.filter((e) => synergyEffects.includes(e));
    ownedEffects.forEach((e) => { if ((LEGACY_SYNERGY_MAP[e] || []).includes(newRelic.effect) && !matches.includes(e)) matches.push(e); });
    if (!matches.length) return noPair;
    return {
        score: Math.min(40, matches.length * 20),
        label: MSG.RELIC_EFFECT_PAIR_LABEL,
        synergies: ownedRelics.filter((r) => matches.includes(r.effect)).map((r) => r.name),
        nearLegendary: near?.label || null,
        ...startField,
    };
};

test('조합을 완성하지 않는 제안: 조합 진행 · 시작 판정, 효과 짝은 "함께 쓰기 좋음"(짝당 20 · 최대 40) — 가진 유물 0~2개', () => {
    let compared = 0;
    const ownedSets = [[], ...RELICS.map((relic) => [relic])];
    // 효과 짝 두 개가 걸리는 구성(최대 40)을 표본에 넣는다 — 서로 다른 효과의 두 유물.
    for (const [effect, partners] of Object.entries(LEGACY_SYNERGY_MAP)) {
        const a = RELICS.find((r) => r.effect === partners[0]);
        const b = RELICS.find((r) => r.effect === partners[1]);
        if (a && b && a.name !== b.name) ownedSets.push([a, b]);
        assert.ok(RELICS.some((r) => r.effect === effect), `효과 ${effect}의 유물이 있다`);
    }
    for (const owned of ownedSets) {
        for (const relic of RELICS) {
            if (owned.some((r) => r.name === relic.name)) continue;
            const hint = getRelicSynergyScore(relic, owned);
            if (hint.legendaryHint || hint.completesPair) continue;
            assert.deepEqual(hint, expectedNonCompletionScore(relic, owned), `${relic.name} + [${owned.map((r) => r.name)}]`);
            if (hint.score > 0) assert.equal(hint.label, MSG.RELIC_EFFECT_PAIR_LABEL, '효과 짝은 "조합"으로 부르지 않는다');
            compared += 1;
        }
    }
    assert.ok(compared > 4000, `비교 ${compared}건`);
});

const BUILD_IDS = Object.keys(RELIC_EFFECTS_BY_BUILD);
const recommend = (cards, owned, buildId) => getRelicChoiceDecisionStrip(
    cards.map((relic, index) => ({ relic, index, synergy: getRelicSynergyScore(relic, owned) })),
    buildId,
);
const isPlain = (relic, owned) => {
    const hint = getRelicSynergyScore(relic, owned);
    return !hint.legendaryHint && !hint.completesPair && !hint.nearLegendary;
};

test('층 순서 1: 두 조각 조합 완성은 등급 · 빌드 적합 · 효과 짝과 무관하게 어떤 일반 카드보다 먼저 (전 빌드 × 전 경쟁 유물)', () => {
    let checked = 0;
    for (const syn of RELIC_SYNERGIES.filter((entry) => entry.requires.length === 2)) {
        const [first, second] = syn.requires.map((name) => BY_NAME[name]);
        const owned = [first];
        for (const rival of RELICS) {
            if (rival.name === first.name || rival.name === second.name || !isPlain(rival, owned)) continue;
            for (const buildId of BUILD_IDS) {
                assert.equal(recommend([rival, second], owned, buildId).recommendedIndex, 1, `${syn.label}: ${second.name} vs ${rival.name} (${buildId})`);
                checked += 1;
            }
        }
    }
    assert.ok(checked > 5000, `비교 ${checked}건`);
});

const tierOf = (relic, owned) => {
    const hint = getRelicSynergyScore(relic, owned);
    if (hint.legendaryHint) return 'legendary';
    if (hint.completesPair) return 'pair';
    if (hint.nearLegendary) return 'progress';
    if (hint.startsCombo) return 'start';
    return 'plain';
};

test('층 순서 2: 세 조각 조합 진행(2개째)은 어떤 일반 카드보다 먼저 — 제안 생성기의 조합 보장 슬롯과 같은 기준', () => {
    let checked = 0;
    const covered = new Set();
    for (const syn of RELIC_SYNERGIES.filter((entry) => entry.requires.length === 3)) {
        const pieces = syn.requires.map((name) => BY_NAME[name]);
        // 세 조각 조합이 두 조각 조합을 품으면(혈맹 불사 ⊃ 흡혈 군주) 그 두 조각의 순서는 "완성" 층이다 — 순수한 진행 순서만 본다.
        for (const ownedPiece of pieces) {
            for (const progressPiece of pieces) {
                if (ownedPiece === progressPiece) continue;
                const owned = [ownedPiece];
                if (tierOf(progressPiece, owned) !== 'progress') continue;
                assert.equal(getRelicSynergyScore(progressPiece, owned).nearLegendary, syn.label, `${syn.label}: 진행 판정`);
                covered.add(syn.label);
                for (const rival of RELICS) {
                    // 일반 카드와 조합 시작 카드(Wave 49) 모두 진행보다 아래다.
                    if (syn.requires.includes(rival.name) || !['plain', 'start'].includes(tierOf(rival, owned))) continue;
                    for (const buildId of BUILD_IDS) {
                        assert.equal(recommend([rival, progressPiece], owned, buildId).recommendedIndex, 1, `${syn.label}: ${progressPiece.name} vs ${rival.name} (${buildId})`);
                        checked += 1;
                    }
                }
            }
        }
    }
    assert.equal(covered.size, 5, '세 조각 조합 5개 모두 순수한 진행 순서가 있다');
    assert.ok(checked > 1000, `비교 ${checked}건`);
});

test('층 순서 3: 조합 완성은 조합 진행보다, 전설 조합 완성은 두 조각 완성보다 먼저', () => {
    let progressVsPair = 0;
    let pairVsLegendary = 0;
    const pairs = RELIC_SYNERGIES.filter((entry) => entry.requires.length === 2);
    const triples = RELIC_SYNERGIES.filter((entry) => entry.requires.length === 3);
    for (const pair of pairs) {
        const [p1, p2] = pair.requires.map((name) => BY_NAME[name]);
        for (const triple of triples) {
            if (triple.requires.some((name) => pair.requires.includes(name))) continue;
            const pieces = triple.requires.map((name) => BY_NAME[name]);
            for (const buildId of BUILD_IDS) {
                for (const [t1, t2] of pieces.flatMap((a) => pieces.filter((b) => b !== a).map((b) => [a, b]))) {
                    const owned = [p1, t1];
                    if (tierOf(p2, owned) !== 'pair' || tierOf(t2, owned) !== 'progress') continue;
                    assert.equal(recommend([t2, p2], owned, buildId).recommendedIndex, 1, `${pair.label} 완성 > ${triple.label} 진행 (${buildId})`);
                    progressVsPair += 1;
                }
                const t3 = pieces[2];
                const ownedForLegendary = [p1, pieces[0], pieces[1]];
                if (tierOf(t3, ownedForLegendary) === 'legendary' && tierOf(p2, ownedForLegendary) === 'pair') {
                    assert.equal(recommend([p2, t3], ownedForLegendary, buildId).recommendedIndex, 1, `${triple.label} 전설 완성 > ${pair.label} 완성 (${buildId})`);
                    pairVsLegendary += 1;
                }
            }
        }
    }
    assert.ok(progressVsPair > 100, `완성 vs 진행 ${progressVsPair}건`);
    assert.ok(pairVsLegendary > 100, `전설 완성 vs 두 조각 완성 ${pairVsLegendary}건`);
});

// 2026-09 Wave 49(소유자 결정 "측정 후 조건부 반영"): 가진 조각이 하나도 없는 실제 조합의 첫 조각은 진행 아래 · 일반 위 층이다.
test('층 순서 4: 조합 시작 조각은 가장 강한 일반 카드보다 먼저 (가진 유물 0~1개 × 전 빌드)', () => {
    const pieceNames = new Set(RELIC_SYNERGIES.flatMap((syn) => syn.requires));
    // 아무것도 없을 때는 모든 조합 조각이 시작 조각이고, 어떤 조합에도 들지 않는 유물은 아니다.
    for (const relic of RELICS) {
        assert.equal(tierOf(relic, []) === 'start', pieceNames.has(relic.name), `${relic.name}: 빈 손 시작 판정`);
    }
    let checked = 0;
    const startedLabels = new Set();
    for (const owned of [[], ...RELICS.map((relic) => [relic])]) {
        const ownedNames = new Set(owned.map((r) => r.name));
        const offerable = RELICS.filter((relic) => !ownedNames.has(relic.name));
        const starters = offerable.filter((relic) => tierOf(relic, owned) === 'start');
        const plains = offerable.filter((relic) => tierOf(relic, owned) === 'plain');
        if (!starters.length || !plains.length) continue;
        for (const starter of starters) {
            const label = getRelicSynergyScore(starter, owned).startsCombo;
            const syn = RELIC_SYNERGIES.find((entry) => entry.label === label);
            assert.ok(syn?.requires.includes(starter.name), `${starter.name}: ${label}의 조각`);
            assert.ok(syn.requires.every((name) => !ownedNames.has(name)), `${starter.name}: ${label}의 조각을 가지고 있지 않다`);
            startedLabels.add(label);
        }
        for (const buildId of BUILD_IDS) {
            // 등급 · 빌드 적합 · 효과 짝으로 가장 강한 일반 카드가 경쟁자다 — 동점이면 앞 카드가 이기므로 앞에 둔다.
            const strongest = plains[recommend(plains, owned, buildId).recommendedIndex];
            for (const starter of starters) {
                const decision = recommend([strongest, starter], owned, buildId);
                assert.equal(decision.recommendedIndex, 1, `${starter.name} vs ${strongest.name} + [${[...ownedNames]}] (${buildId})`);
                assert.equal(decision.cells[1].value, MSG.RELIC_REASON_COMBO_START);
                checked += 1;
            }
        }
    }
    assert.ok(checked > 10000, `비교 ${checked}건`);
    assert.ok(startedLabels.size >= 15, `시작 판정에 쓰인 조합 ${startedLabels.size}개`);
});

test('선택 화면: 카드 줄은 추천 층 순서를 따른다 — 진행 줄 > 시작 줄 > 효과 짝 줄', () => {
    const render = (pendingRelics, relics) => renderStatic(React.createElement(RelicChoicePanel, {
        pendingRelics, dispatch: () => {}, player: makePlayerFixture({ relics }), stats: null,
    }));
    // 시작: 빈 손에서 조합 조각을 제안받으면 조합 이름으로 첫 조각을 알린다.
    for (const syn of RELIC_SYNERGIES) {
        const piece = BY_NAME[syn.requires[0]];
        const label = getRelicSynergyScore(piece, []).startsCombo;
        const html = render([FILLERS[0], piece, FILLERS[1]], []);
        assert.ok(html.includes('data-testid="relic-choice-1-start"'), `${piece.name}: 시작 줄`);
        assert.ok(html.includes(MSG.RELIC_COMBO_START_LINE(label)), `${piece.name}: ${label} 첫 조각`);
        assert.ok(!html.includes('data-testid="relic-choice-0-start"'), '일반 카드에는 시작 줄이 없다');
    }
    // 진행과 효과 짝이 겹치는 카드는 진행 줄을 그린다(추천 이유와 같은 층).
    let overlaps = 0;
    for (const syn of RELIC_SYNERGIES.filter((entry) => entry.requires.length === 3)) {
        for (const ownedPiece of syn.requires.map((name) => BY_NAME[name])) {
            for (const candidate of syn.requires.map((name) => BY_NAME[name])) {
                if (candidate === ownedPiece) continue;
                const hint = getRelicSynergyScore(candidate, [ownedPiece]);
                if (!hint.nearLegendary || !(hint.score > 0) || hint.completesPair) continue;
                const html = render([FILLERS[0], candidate], [ownedPiece]);
                assert.ok(html.includes(`${hint.nearLegendary}까지 1개 남음`), `${candidate.name}: 진행 줄`);
                assert.ok(!html.includes('함께 쓰기 · '), `${candidate.name}: 효과 짝 줄은 진행에 가려진다`);
                overlaps += 1;
            }
        }
    }
    assert.ok(overlaps >= 1, `진행 · 효과 짝 겹침 ${overlaps}건`);
    // 시작과 효과 짝이 겹치는 카드는 시작 줄을 그린다.
    let startOverlaps = 0;
    for (const ownedRelic of RELICS) {
        for (const candidate of RELICS) {
            if (candidate === ownedRelic) continue;
            const hint = getRelicSynergyScore(candidate, [ownedRelic]);
            if (!hint.startsCombo || !(hint.score > 0)) continue;
            const html = render([FILLERS[0], candidate], [ownedRelic]);
            assert.ok(html.includes(MSG.RELIC_COMBO_START_LINE(hint.startsCombo)), `${candidate.name}: 시작 줄`);
            assert.ok(!html.includes('함께 쓰기 · '), `${candidate.name}: 효과 짝 줄은 시작에 가려진다`);
            startOverlaps += 1;
        }
    }
    assert.ok(startOverlaps >= 10, `시작 · 효과 짝 겹침 ${startOverlaps}건`);
});
