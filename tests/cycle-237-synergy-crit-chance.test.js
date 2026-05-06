import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * cycle 237: primordial_wrath 시너지의 critChance 0.25 dead config fix
 *   (cycle 236 synergy bonus keys 시리즈 마지막 합류).
 *
 * 발견 (synergy critChance 미적용):
 * - primordial_wrath 시너지 (요구: 고대의 분노 + 드래곤 발톱 + 광전사의 분노):
 *   bonus: { effect: 'primordial_wrath', critChance: 0.25, critDmg: 2.5, lowHpAtk: 0.8 }
 * - critDmg / lowHpAtk는 handled (cycle 154 / statsCalculator).
 * - 그러나 critChance는 어디에서도 read 안 됨. baseCritChance 계산은
 *   BALANCE.CRIT_CHANCE + equipmentCritBonus + relicBonus.critBonus + abyssBonus.crit
 *   + titlePassive.crit + passiveBonus.crit 만 합산.
 * - applySynergyBonuses는 atkMult/mpMult/statBonus/lowHpAtk/defMult/chaosAtk 처리하지만
 *   critChance 누락.
 * - 결과: primordial_wrath 발동 시 +25% crit 광고하지만 실제 crit chance 변화 0.
 *
 * 패턴 (cycle 222-229, 236 silent dead config 시리즈 10번째):
 * - cycle 236: fixedDmg / killStack 2 synergy bonus keys.
 * - cycle 237: critChance 1 key — synergy bonus 마지막 unhandled.
 *
 * 수정 (src/utils/statsCalculator.ts):
 * - applySynergyBonuses에 critBonus 누적 추가.
 * - calculateFullStats baseCritChance에 synergyBonus.critBonus 합산.
 *
 * 회귀 가드:
 * - 다른 critDmg / lowHpAtk synergy 처리 보존.
 * - synergy 미보유 시 0 영향.
 */

test('cycle 237: primordial_wrath 시너지가 critChance에 +25% 추가', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 100, def: 30,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [],
        skillChoices: {}, titles: [], stats: {},
    };

    // synergy 미보유: baseline crit
    const baseStats = calculateFullStats(player);

    // synergy 보유: primordial_wrath
    // calculateFullStats는 player.relics를 보고 활성 시너지 계산.
    // 직접 시너지 인풋 메커니즘이 없으므로 synergy 발동 조건의 3 유물을 추가.
    const playerWithSynergy = {
        ...player,
        relics: [
            { id: 'titans_wrath', name: '고대의 분노', effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } },
            { id: 'dragon_claw', name: '드래곤 발톱', effect: 'crit_dmg', val: 2.0 },
            { id: 'berserker_rage', name: '광전사의 분노', effect: 'low_hp_atk', val: 0.5 },
        ],
    };
    const synStats = calculateFullStats(playerWithSynergy);

    // primordial_wrath 시너지 발동 시 critChance + 0.25.
    // baseStats (no synergy) vs synStats (with synergy) 차이 검증.
    const critDelta = synStats.critChance - baseStats.critChance;
    assert.ok(critDelta >= 0.20,
        `primordial_wrath 시너지 발동 시 critChance +25% 추가되어야 함. delta=${critDelta} (baseline=${baseStats.critChance}, with synergy=${synStats.critChance})`);
});

test('cycle 237: synergy 미보유 시 critChance baseline 보존 (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 100, maxHp: 100, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [],
        skillChoices: {}, titles: [], stats: {},
    };
    const stats = calculateFullStats(player);
    // BALANCE.CRIT_CHANCE = 0.1, 최대 0.75 cap.
    assert.ok(stats.critChance >= 0.1 && stats.critChance <= 0.75,
        `synergy 미보유 baseline (${stats.critChance})`);
});

test('cycle 236 회귀 가드: synergy fixedDmg / killStack 처리 유지', async () => {
    const { CombatEngine } = await import('../src/systems/CombatEngine.js');
    // entropy_god fixedDmg 회귀 가드.
    const player = { name: 'Test', combatFlags: { turnCount: 1 }, status: [], relics: [] };
    const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 50, def: 5 };
    const result = CombatEngine.applyEntropyTick(player, enemy, [
        { bonus: { effect: 'entropy_god', fixedDmg: 0.15, interval: 1 } },
    ]);
    assert.ok(result.enemy.hp < 1000, 'cycle 236 entropy_god fixedDmg 회귀 가드');
});
