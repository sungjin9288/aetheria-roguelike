import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 242: stats.critChance dispatch 0건 + skill.crit branch override dead config fix
 *   (cycle 222-241 silent dead config 시리즈 14번째 — 가장 큰 영향).
 *
 * 발견 (CRITICAL silent regression):
 * - statsCalculator의 finalCritChance (line 386, 399)는 다음을 합산:
 *   baseCritChance(BALANCE.CRIT_CHANCE 0.1 + equipmentCritBonus + relicBonus.critBonus +
 *   abyssBonus.crit + titlePassive.crit + passiveBonus.crit) + traitBonus.critBonus +
 *   streak.critBonus + synergyBonus.critBonus.
 * - 그러나 CombatEngine.calculateDamage 호출 시 critChance 옵션을 전달하지 않아
 *   options 분해 default `BALANCE.CRIT_CHANCE` (0.1)만 사용 → stats.critChance dispatch 0건.
 * - 결과: 모든 crit 보너스(장비 / 유물 / 심연 / 칭호 / 패시브 / 트레이트 / killStreak / 시너지)가 dead.
 * - 도적 '치명 특화' branch (crit: 0.7) / 어쌔신 '치명 암살' branch (crit: 0.95)도 read 0건.
 * - SystemTab은 stats.critChance를 표시 → 사용자가 본 수치는 fake.
 *
 * 패턴 (cycle 222-241 silent dead config 시리즈 14번째):
 * - cycle 237: synergyBonus.critBonus 합산 (statsCalculator 측). paired completion.
 * - cycle 238: skill branch defBonus.
 * - cycle 239: skill branch effectChance.
 * - cycle 241: skill branch stunTurn.
 * - cycle 242: stats.critChance dispatch + skill.crit branch override.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - attack section: calculateDamage 호출 시 critChance: stats.critChance 전달.
 * - skill section: calculateDamage 호출 시 critChance: skill.crit ?? stats.critChance.
 *
 * 회귀 가드:
 * - stats.critChance 미정의(undefined) 시 기존 default BALANCE.CRIT_CHANCE 사용.
 * - skill.crit 미정의 시 stats.critChance 사용 (branch override 없음).
 */

test('cycle 242: stats.critChance 0 시 attack isCrit 0회 (dispatch 확인)', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    let critCount = 0;
    for (let i = 0; i < 50; i++) {
        const r = CombatEngine.attack(player, enemy, stats);
        if (r.isCrit) critCount++;
    }
    assert.equal(critCount, 0, `stats.critChance 0 시 isCrit 0회 (실제 dispatch 안되면 ~5회 발생, 실제: ${critCount})`);
});

test('cycle 242: stats.critChance 1.0 시 attack isCrit 매번', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 1.0 };

    let critCount = 0;
    for (let i = 0; i < 30; i++) {
        const r = CombatEngine.attack(player, enemy, stats);
        if (r.isCrit) critCount++;
    }
    assert.equal(critCount, 30, `stats.critChance 1.0 시 매 attack isCrit (실제: ${critCount}/30)`);
});

test('cycle 242: stats.critChance 0 시 skill isCrit 0회', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    let critCount = 0;
    for (let i = 0; i < 30; i++) {
        const r = CombatEngine.performSkill(player, enemy, stats, skill);
        if (r.isCrit) critCount++;
    }
    assert.equal(critCount, 0, `stats.critChance 0 + skill.crit 미정의 → 0회 (실제: ${critCount})`);
});

test('cycle 242: skill.crit 1.0 override 시 stats.critChance 0 무시하고 매번 isCrit', () => {
    const player = {
        name: 'Test', job: '도적', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // 도적 '치명 특화' branch B = crit: 0.7. 1.0으로 테스트.
    const skill = { name: 'Test', mp: 10, mult: 2.0, crit: 1.0, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    let critCount = 0;
    for (let i = 0; i < 30; i++) {
        const r = CombatEngine.performSkill(player, enemy, stats, skill);
        if (r.isCrit) critCount++;
    }
    assert.equal(critCount, 30, `skill.crit 1.0 override → 매번 isCrit (실제: ${critCount}/30)`);
});

test('cycle 242: skill.crit 0 override 시 stats.critChance 1.0 무시하고 0회', () => {
    const player = {
        name: 'Test', job: '도적', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, crit: 0, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 1.0 };

    let critCount = 0;
    for (let i = 0; i < 30; i++) {
        const r = CombatEngine.performSkill(player, enemy, stats, skill);
        if (r.isCrit) critCount++;
    }
    assert.equal(critCount, 0, `skill.crit 0 override → 0회 (실제: ${critCount}/30)`);
});

test('cycle 242: stats.critChance 미정의 시 BALANCE.CRIT_CHANCE 0.1 fallback (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // critChance 미정의 stats (legacy/external test).
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [] };

    let critCount = 0;
    for (let i = 0; i < 1000; i++) {
        const r = CombatEngine.attack(player, enemy, stats);
        if (r.isCrit) critCount++;
    }
    // BALANCE.CRIT_CHANCE = 0.1 → ~100/1000. 기대 50~170 (loose tolerance).
    assert.ok(critCount >= 50 && critCount <= 170,
        `stats.critChance 미정의 시 default 0.1 fallback (~100/1000, 실제: ${critCount})`);
});
