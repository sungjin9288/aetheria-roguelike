import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { MSG } from '../src/data/messages.js';
import { RELICS, RELIC_SYNERGIES, getActiveRelicSynergies } from '../src/data/relics.js';
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

/** Wave 47 이전 판정(RelicChoicePanel 안의 getRelicSynergyScore) — 완성이 없는 경우의 오라클. */
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
const legacyNonCompletionScore = (newRelic, ownedRelics) => {
    const ownedEffects = ownedRelics.map((r) => r.effect);
    const ownedNames = new Set(ownedRelics.map((r) => r.name));
    const near = RELIC_SYNERGIES.find((syn) => syn.requires.length === 3 && syn.requires.includes(newRelic.name)
        && syn.requires.filter((name) => ownedNames.has(name)).length === 1);
    if (!ownedRelics.length) return near ? { score: 0, label: null, synergies: [], nearLegendary: near.label } : { score: 0, label: null, synergies: [] };
    const synergyEffects = LEGACY_SYNERGY_MAP[newRelic.effect] || [];
    const matches = ownedEffects.filter((e) => synergyEffects.includes(e));
    ownedEffects.forEach((e) => { if ((LEGACY_SYNERGY_MAP[e] || []).includes(newRelic.effect) && !matches.includes(e)) matches.push(e); });
    if (!matches.length) return near ? { score: 0, label: null, synergies: [], nearLegendary: near.label } : { score: 0, label: null, synergies: [] };
    const score = Math.min(100, matches.length * 40);
    const label = score >= 80 ? '강한 조합' : score >= 40 ? '좋은 조합' : '이어지는 조합';
    return { score, label, synergies: ownedRelics.filter((r) => matches.includes(r.effect)).map((r) => r.name), nearLegendary: near?.label || null };
};

test('조합을 완성하지 않는 제안의 판정은 Wave 47 이전과 같다 — 가진 유물 0~1개 전수', () => {
    let compared = 0;
    const ownedSets = [[], ...RELICS.map((relic) => [relic])];
    for (const owned of ownedSets) {
        for (const relic of RELICS) {
            if (owned.some((r) => r.name === relic.name)) continue;
            const hint = getRelicSynergyScore(relic, owned);
            if (hint.legendaryHint || hint.completesPair) continue;
            assert.deepEqual(hint, legacyNonCompletionScore(relic, owned), `${relic.name} + [${owned.map((r) => r.name)}]`);
            compared += 1;
        }
    }
    assert.ok(compared > 4000, `비교 ${compared}건`);
});

test('조합 완성은 효과 짝 표의 "강한 조합"보다 먼저 추천된다', () => {
    // 가진 유물 = 두 조각 조합의 첫 조각 + 효과 짝 두 개. 제안 = 조합의 둘째 조각 vs 효과 짝 2개와 맞는 "강한 조합" 후보.
    let found = 0;
    for (const syn of RELIC_SYNERGIES.filter((entry) => entry.requires.length === 2)) {
        const [first, second] = syn.requires.map((name) => BY_NAME[name]);
        for (const rival of RELICS) {
            if (rival.name === first.name || rival.name === second.name) continue;
            const partners = RELICS.filter((relic) => relic.name !== rival.name && relic.name !== first.name && relic.name !== second.name
                && (LEGACY_SYNERGY_MAP[rival.effect] || []).includes(relic.effect));
            if (partners.length < 2) continue;
            const owned = [first, partners[0], partners[1]];
            const rivalHint = getRelicSynergyScore(rival, owned);
            const secondHint = getRelicSynergyScore(second, owned);
            if (rivalHint.score < 80 || rivalHint.legendaryHint || rivalHint.completesPair || secondHint.legendaryHint) continue;
            const cards = [rival, second].map((relic, index) => ({ relic, index, synergy: getRelicSynergyScore(relic, owned) }));
            // 등급 점수 차이가 순위를 뒤집지 않는 경우만 본다 — 등급 차 최대(전설 52 − 일반 0)보다 점수 차(140 − 110 = 30)가 작을 수 있다.
            const rarityGap = ({ common: 0, uncommon: 12, rare: 24, epic: 36, legendary: 52 })[rival.rarity] - ({ common: 0, uncommon: 12, rare: 24, epic: 36, legendary: 52 })[second.rarity];
            if (rarityGap >= 30) continue;
            assert.equal(getRelicChoiceDecisionStrip(cards, 'balanced').recommendedIndex, 1, `${syn.label}: ${second.name}(조합 완성) vs ${rival.name}(강한 조합)`);
            found += 1;
            break;
        }
    }
    assert.ok(found >= 3, `비교 구성 ${found}개`);
});
