import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { RELICS, RELIC_SYNERGIES, getActiveRelicSynergies } from '../src/data/relics.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { formatSynergyDrawback, getRelicSynergyScore } from '../src/utils/relicSynergyHint.js';
import RelicChoicePanel from '../src/components/RelicChoicePanel.js';
import StatsPanel from '../src/components/StatsPanel.js';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 50 — 소유자 결정 "조합에 단점을 붙인다"(로그라이크 분위기: 강하지만 위험한 조합).
 *
 * 원장 §49.5: Wave 49에서 추천이 조합을 모으게 되자 추천을 따르는 플레이어의 사망이 첫 카드 정책의 절반이 됐다.
 * 모든 조합에 대가가 있고(받는 피해 증가 · 방어력 감소 · 공격력 감소), 대가 문구는 데이터에서 만든다.
 * 이 파일은 (1) 대가가 실제 능력치 · 받는 피해에 걸리는지 (2) 화면이 그 대가를 보여 주는지를 고정한다.
 */

const BY_NAME = Object.fromEntries(RELICS.map((relic) => [relic.name, relic]));
const FILLER = RELICS.find((relic) => relic.rarity === 'common'
    && !RELIC_SYNERGIES.some((syn) => syn.requires.includes(relic.name)));

const basePlayer = () => ({
    name: 'tester', job: '모험가', level: 50,
    hp: 5000, maxHp: 5000, mp: 500, maxMp: 500, atk: 2000, def: 1000,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null,
    killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
});

/** 조합은 유물 이름으로 켜진다 — 조각 하나의 이름만 바꾸면 유물 효과는 그대로이고 조합만 꺼진다. */
const withoutSynergy = (relics, pieceName) => relics.map((relic) => (
    relic.name === pieceName ? { ...relic, name: `${relic.name} (이름 없음)` } : relic
));

/** 조합 집합이 공격력 · 방어력 · 받는 피해에 주는 배율(생명이 가득일 때 — 낮은 생명 보너스는 꺼져 있다). */
const synergyFactors = (synergies) => {
    const sum = (key) => synergies.reduce((acc, syn) => acc + (syn.bonus[key] || 0), 0);
    const drawback = (stat) => synergies.filter((syn) => syn.drawback.stat === stat);
    const statMult = 1 + sum('statBonus');
    return {
        atk: (1 + sum('atkMult') + sum('chaosAtk')) * statMult
            * drawback('atk').reduce((m, syn) => m * (1 - syn.drawback.pct), 1),
        def: (1 + sum('defMult')) * statMult
            * drawback('def').reduce((m, syn) => m * (1 - syn.drawback.pct), 1),
        damageTaken: drawback('damageTaken').reduce((m, syn) => m * (1 + syn.drawback.pct), 1),
    };
};

test('모든 조합에 대가가 있다 — 세 종류 중 하나, 0 < 비율 < 1, 문구는 데이터에서 만든다', () => {
    const labels = { damageTaken: '받는 피해', def: '방어력', atk: '공격력' };
    for (const syn of RELIC_SYNERGIES) {
        assert.ok(syn.drawback, `${syn.label}: 대가`);
        assert.ok(['damageTaken', 'def', 'atk'].includes(syn.drawback.stat), `${syn.label}: 종류`);
        assert.ok(syn.drawback.pct > 0 && syn.drawback.pct < 1, `${syn.label}: 비율`);
        const text = formatSynergyDrawback(syn);
        const pct = Math.round(syn.drawback.pct * 100);
        assert.ok(text.startsWith(labels[syn.drawback.stat]), `${syn.label}: ${text}`);
        assert.ok(text.includes(`${pct}%`), `${syn.label}: ${text}에 ${pct}%`);
        assert.ok(text.endsWith(syn.drawback.stat === 'damageTaken' ? '증가' : '감소'), `${syn.label}: ${text}`);
    }
    assert.equal(RELIC_SYNERGIES.length, 20);
});

test('대가는 능력치에 걸린다 — 모든 조합 × 모든 조각: 조합만 끈 상태와의 비율 = 보너스 × 대가', () => {
    let checked = 0;
    const seenStats = new Set();
    for (const syn of RELIC_SYNERGIES) {
        const owned = syn.requires.map((name) => BY_NAME[name]);
        const withStats = calculateFullStats({ ...basePlayer(), relics: owned });
        for (const piece of syn.requires) {
            const offRelics = withoutSynergy(owned, piece);
            const offStats = calculateFullStats({ ...basePlayer(), relics: offRelics });
            const on = synergyFactors(getActiveRelicSynergies(owned));
            const off = synergyFactors(getActiveRelicSynergies(offRelics));
            assert.ok(Math.abs(withStats.atk / offStats.atk - on.atk / off.atk) < 0.01,
                `${syn.label} (${piece} 끔): 공격력 ${(withStats.atk / offStats.atk).toFixed(3)} vs ${(on.atk / off.atk).toFixed(3)}`);
            assert.ok(Math.abs(withStats.def / offStats.def - on.def / off.def) < 0.01,
                `${syn.label} (${piece} 끔): 방어력 ${(withStats.def / offStats.def).toFixed(3)} vs ${(on.def / off.def).toFixed(3)}`);
            assert.ok(Math.abs(withStats.damageTakenMult - on.damageTaken) < 1e-9, `${syn.label}: 받는 피해 배율`);
            assert.ok(Math.abs(offStats.damageTakenMult - off.damageTaken) < 1e-9, `${syn.label} (${piece} 끔): 받는 피해 배율`);
            checked += 1;
        }
        seenStats.add(syn.drawback.stat);
    }
    assert.deepEqual([...seenStats].sort(), ['atk', 'damageTaken', 'def']);
    assert.equal(checked, 15 * 2 + 5 * 3);
    assert.equal(calculateFullStats(basePlayer()).damageTakenMult, 1, '조합이 없으면 받는 피해 배율 1');
});

const ENEMY = () => ({ name: '시험용 골렘', baseName: '시험용 골렘', hp: 10_000, maxHp: 10_000, atk: 6000, def: 0, level: 50, pattern: { guardChance: 0, heavyChance: 0 } });
const RNG = () => 0.5;

test('받는 피해 대가는 적 공격과 도주 실패 피해에 걸린다 — 받는 피해 대가가 있는 조합 전부', () => {
    const damageTakenSyns = RELIC_SYNERGIES.filter((syn) => syn.drawback.stat === 'damageTaken');
    assert.ok(damageTakenSyns.length >= 5);
    let compared = 0;
    for (const syn of damageTakenSyns) {
        const owned = syn.requires.map((name) => BY_NAME[name]);
        const offRelics = withoutSynergy(owned, syn.requires[0]);
        const player = { ...basePlayer(), relics: owned };
        const offPlayer = { ...basePlayer(), relics: offRelics };
        const onStats = calculateFullStats(player);
        const offStats = calculateFullStats(offPlayer);
        // 방어력이 같을 때만 순수한 받는 피해 비교다(방어력 보너스 · 대가가 없는 조합).
        if (onStats.def !== offStats.def) continue;
        const expected = onStats.damageTakenMult / offStats.damageTakenMult;
        assert.ok(expected > 1, `${syn.label}: 이 조합이 받는 피해 배율을 올린다`);

        const onHit = CombatEngine.enemyAttack(player, ENEMY(), onStats, RNG);
        const offHit = CombatEngine.enemyAttack(offPlayer, ENEMY(), offStats, RNG);
        assert.ok(offHit.damage > 100, `${syn.label}: 기준 피해 ${offHit.damage}`);
        assert.ok(Math.abs(onHit.damage / offHit.damage - expected) < 0.01,
            `${syn.label}: 적 공격 ${onHit.damage}/${offHit.damage} vs ${expected.toFixed(3)}`);

        const failRng = () => 0; // ESCAPE_CHANCE 이하 — 도주 실패
        const onEscape = CombatEngine.attemptEscape(ENEMY(), onStats, failRng);
        const offEscape = CombatEngine.attemptEscape(ENEMY(), offStats, failRng);
        assert.equal(onEscape.success, false);
        assert.ok(Math.abs(onEscape.damage / offEscape.damage - expected) < 0.01,
            `${syn.label}: 도주 실패 ${onEscape.damage}/${offEscape.damage} vs ${expected.toFixed(3)}`);
        compared += 1;
    }
    assert.ok(compared >= damageTakenSyns.length - 1, `비교 ${compared}/${damageTakenSyns.length}`);
});

test('유물 선택 카드: 조합을 완성하는 카드는 새로 켜지는 조합의 대가를 보여 준다 (조합 20개 × 마지막 조각)', () => {
    for (const syn of RELIC_SYNERGIES) {
        const missing = BY_NAME[syn.requires[syn.requires.length - 1]];
        const owned = syn.requires.slice(0, -1).map((name) => BY_NAME[name]);
        const hint = getRelicSynergyScore(missing, owned);
        const newly = getActiveRelicSynergies([...owned, missing])
            .filter((entry) => !getActiveRelicSynergies(owned).some((before) => before.label === entry.label));
        assert.deepEqual(hint.drawbacks, newly.map(formatSynergyDrawback), `${syn.label}: 대가 목록`);

        const html = renderStatic(React.createElement(RelicChoicePanel, {
            pendingRelics: [FILLER, missing],
            dispatch: () => {},
            player: makePlayerFixture({ relics: owned }),
            stats: null,
        }));
        assert.ok(html.includes('data-testid="relic-choice-1-drawback"'), `${syn.label}: 대가 줄`);
        assert.ok(html.includes(MSG.RELIC_SYNERGY_DRAWBACK_LINE(hint.drawbacks.join(' · '))), `${syn.label}: 대가 문구`);
        assert.ok(!html.includes('data-testid="relic-choice-0-drawback"'), '조합과 무관한 카드에는 대가 줄이 없다');
    }
    // 완성하지 않는 카드는 대가를 싣지 않는다.
    assert.equal(getRelicSynergyScore(FILLER, []).drawbacks, undefined);
});

test('능력치 화면: 활성 조합마다 대가를 설명 아래에 보여 준다 (실제 능력치 계산)', () => {
    const syns = [RELIC_SYNERGIES.find((syn) => syn.drawback.stat === 'damageTaken'), RELIC_SYNERGIES.find((syn) => syn.drawback.stat === 'atk')];
    const relics = syns.flatMap((syn) => syn.requires.map((name) => BY_NAME[name]));
    const player = makePlayerFixture({ relics });
    const stats = calculateFullStats(player);
    assert.ok(stats.activeSynergies.length >= 2);
    const html = renderStatic(React.createElement(StatsPanel, { player, stats }));
    for (const syn of stats.activeSynergies) {
        assert.ok(html.includes(MSG.RELIC_SYNERGY_DRAWBACK_LINE(formatSynergyDrawback(syn))), `${syn.label}: 대가 줄`);
    }
    assert.equal((html.match(/data-testid="stats-synergy-drawback"/g) || []).length, stats.activeSynergies.length);
});
