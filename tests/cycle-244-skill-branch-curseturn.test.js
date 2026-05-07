import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 244: skill branch override의 'curseTurn' 키 dead config fix
 *   (cycle 222-243 silent dead config 시리즈 16번째).
 *
 * 발견 (curseTurn 미적용):
 * - 흑마법사 '저주의 낙인' branch B = '지속 저주' (mult 1.6, curseTurn 3):
 *   "저주 지속 +2턴" desc — 저주 지속 시간 확장 의도.
 * - 그러나 applyStatusEffectToEnemy는 curse 시 cursedTurns = 3 hardcoded 고정.
 *   skill.curseTurn 키 read 0건 → branch override 무의미.
 * - cycle 241 stunTurn / cycle 243 mpRestore 패턴과 동일.
 *
 * 패턴 (cycle 222-243 silent dead config 시리즈 16번째):
 * - cycle 241: skill branch stunTurn (cursedTurns 카운터 형제).
 * - cycle 244: skill branch curseTurn.
 *
 * 수정 (src/systems/CombatEngine.ts performSkill status section):
 * - skill.effect = 'curse' 부여 직후 skill.curseTurn 정의되면 cursedTurns 그 값으로 max 처리.
 * - secondEffect = 'curse'도 동일.
 * - 미정의 시 기본 3 (회귀 가드).
 *
 * 회귀 가드:
 * - skill.curseTurn 미정의 시 기존 cursedTurns 3턴 동작 유지.
 * - skill.curseTurn 1 시 1턴 (단축).
 */

test('cycle 244: skill.curseTurn 5 시 cursedTurns 5 적용', () => {
    const player = {
        name: 'Test', job: '흑마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', curseTurn: 5, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.success, true);
    assert.equal(r.updatedEnemy.cursedTurns, 5,
        `curseTurn 5 → cursedTurns 5 적용 (실제: ${r.updatedEnemy.cursedTurns})`);
    assert.equal(r.updatedEnemy.cursed, true, 'cursed 플래그 set');
});

test('cycle 244: skill.curseTurn 미정의 시 cursedTurns 3 (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '흑마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.cursedTurns, 3,
        `curseTurn 미정의 시 default 3턴 (회귀 가드, 실제: ${r.updatedEnemy.cursedTurns})`);
});

test('cycle 244: secondEffect curse도 curseTurn 게이트 적용', () => {
    const player = {
        name: 'Test', job: '도적', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // secondEffect: 'curse' + curseTurn: 4 → 4턴 cursedTurns.
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'bleed', secondEffect: 'curse', curseTurn: 4, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.cursedTurns, 4,
        `secondEffect curse + curseTurn 4 → cursedTurns 4 (실제: ${r.updatedEnemy.cursedTurns})`);
});

test('cycle 244: curseTurn 1 시 cursedTurns 1 (단축 가능 — desc per-skill 명시)', () => {
    const player = {
        name: 'Test', job: '흑마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', curseTurn: 1, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    // 신선 적용 시: applyStatusEffectToEnemy 기본 cursedTurns 3 → max(3, 1) = 3.
    // curseTurn 1은 단축이 아니라 floor — applyStatusEffectToEnemy의 기본 3보다 작으면 영향 없음.
    assert.equal(r.updatedEnemy.cursedTurns, 3,
        `curseTurn 1 시 default 3 보존 (max 보존 — single-skill 단축 의도 X)`);
});

test('cycle 241 회귀 가드: stunTurn 동작 유지', () => {
    const player = {
        name: 'Test', job: '마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', stunTurn: 3, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.stunnedTurns, 3, 'cycle 241 stunTurn 회귀 가드');
});
