import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 238: skill branch override의 'defBonus' 필드 dead config fix
 *   (cycle 222-237 silent dead config 시리즈 11번째).
 *
 * 발견 (branch override defBonus 미적용):
 * - '광폭화' skill (effect: 'berserk', val: 2.0) — 광란 (val 1.7) / 분노의 방패 (val 1.5, defBonus 1.2).
 * - '실드배시' skill (effect: 'stun') — 강력 배시 (mult 3.5) / 철벽 배시 (mult 2.5, defBonus 1.2).
 * - 두 branch 'B'는 모두 defBonus: 1.2 (DEF +20%) 의도하지만 코드에서 read 안 됨.
 * - '분노의 방패' 케이스: berserk effect는 buff.def = -0.2 (페널티) 고정 → defBonus override 무시 → 페널티만 적용.
 * - '철벽 배시' 케이스: stun effect는 buff path 미진입 → defBonus 영원히 0.
 *
 * 패턴 (cycle 222-237 silent dead config 시리즈 11번째):
 * - cycle 236-237: synergy bonus keys.
 * - cycle 238: skill branch override key (defBonus).
 *
 * 수정 (src/systems/CombatEngine.ts performSkill buff section):
 * - skill.defBonus 정의 시 buff.def 값 override (default 페널티 / 0 우선).
 * - non-buff effect 스킬도 defBonus 있으면 buff 생성.
 *
 * 회귀 가드:
 * - skill.defBonus 미정의 스킬은 0 영향 (기존 buff/atk_up/def_up/berserk 동작 유지).
 * - skill.val 기반 buff.atk 계산은 그대로.
 */

test('cycle 238: 분노의 방패 branch override 시 buff.def +20%', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: { '광폭화': 'B' }, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    // 전사 '광폭화' skill (effect:'atk_up', val:1.5) — 분기 'B' = 분노의 방패 (val 1.5, defBonus 1.2).
    const skill = { name: '광폭화', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, turn: 3 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.success, true);
    // branch override 후: skill.val=1.5, skill.defBonus=1.2 → buff.def = +20%.
    assert.ok(r.updatedPlayer.tempBuff.def > 0.19,
        `branch defBonus 1.2 적용되어야 함 (buff.def +20%, float precision tolerance, 실제: ${r.updatedPlayer.tempBuff.def})`);
});

test('cycle 238: 광란 branch (defBonus 미정의) 시 기본 동작 유지', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: { '광폭화': 'A' }, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    // 분기 'A' = 광란 (val 1.7, no defBonus).
    const skill = { name: '광폭화', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, turn: 3 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    // branch 'A' override: val=1.7, defBonus 미정의 → atk_up 기본 buff.def = 0.
    assert.equal(r.updatedPlayer.tempBuff.def, 0,
        'defBonus 미정의 시 atk_up 기본 buff.def 0 유지 (회귀 가드)');
});

test('cycle 238: defBonus 미정의 일반 buff 스킬 회귀 가드', () => {
    const player = {
        name: 'Test', job: '나이트', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    const skill = { name: '방어 자세', mp: 20, type: 'buff', effect: 'def_up', val: 1.3, turn: 3 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    // float precision 0.30000000000000004 ≈ 0.3
    assert.ok(Math.abs(r.updatedPlayer.tempBuff.def - 0.3) < 0.01,
        `def_up val 1.3 → buff.def ≈ 0.3 (회귀 가드, 실제: ${r.updatedPlayer.tempBuff.def})`);
});

test('cycle 237 회귀 가드: synergy critChance 합산 유지', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const player = {
        name: 'Test', job: '전사', level: 30, hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 100, def: 30, equip: {}, relics: [
            { name: '고대의 분노', effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } },
            { name: '드래곤 발톱', effect: 'crit_dmg', val: 2.0 },
            { name: '광전사의 분노', effect: 'low_hp_atk', val: 0.5 },
        ], skillChoices: {}, titles: [], stats: {},
    };
    const stats = calculateFullStats(player);
    // primordial_wrath 발동 시 critChance > 0.3 (baseline 0.1 + 0.25)
    assert.ok(stats.critChance >= 0.3, `cycle 237 primordial_wrath critChance 회귀 가드 (${stats.critChance})`);
});
