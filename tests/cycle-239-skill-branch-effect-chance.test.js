import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 239: skill branch override의 'effectChance' 키 dead config fix
 *   (cycle 222-238 silent dead config 시리즈 12번째).
 *
 * 발견 (effectChance 미적용):
 * - 전사 '파워배시' branch B = '기절 배시' (mult 2.0, effect 'stun', effectChance 0.2):
 *   "20% 확률 기절 1턴" desc — 데미지 trade-off 메커니즘.
 * - 도적 '등 찌르기' branch B = '혼란 찌르기' (mult 2.5, secondEffect 'bleed', effectChance 0.4):
 *   "기절 + 40% 확률 출혈" — secondEffect 확률 게이트.
 * - 그러나 코드는 STATUS_EFFECTS_TO_ENEMY.includes(skill.effect) 또는 secondEffect
 *   조건만 확인하고 100% 적용. effectChance 무시.
 * - 결과: 두 branch가 광고하는 확률적 status가 항상 100% 발동 — 데미지 페널티 무의미한 OP.
 *
 * 패턴 (cycle 222-238 silent dead config 시리즈 12번째):
 * - cycle 238: skill branch defBonus.
 * - cycle 239: skill branch effectChance.
 *
 * 수정 (src/systems/CombatEngine.ts performSkill status section):
 * - skill.effect / skill.secondEffect 적용 분기에서 skill.effectChance 정의 시 Math.random() 게이트.
 * - 미정의 시 100% 적용 (회귀 가드).
 *
 * 회귀 가드:
 * - 일반 effect (skill.effect 'burn'/'poison' 등 effectChance 없음) 100% 적용 유지.
 * - skill.effectChance = 1.0 시 100% 보장.
 */

test('cycle 239: effectChance 0 시 status 절대 부여 안 함', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // effectChance 0 — 절대 stun 안 됨.
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', effectChance: 0, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    let stunCount = 0;
    for (let i = 0; i < 30; i++) {
        const r = CombatEngine.performSkill(player, enemy, stats, skill);
        if (r.updatedEnemy.stunnedTurns) stunCount++;
    }
    assert.equal(stunCount, 0, 'effectChance 0 시 stun 0회 발생');
});

test('cycle 239: effectChance 1.0 시 status 100% 부여', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', effectChance: 1.0, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.ok(r.updatedEnemy.stunnedTurns >= 1, 'effectChance 1.0 시 stun 보장');
});

test('cycle 239: effectChance 미정의 시 100% 적용 (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // effectChance 미정의 — default 100% 적용 (기존 동작 유지).
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'burn', cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.ok(Array.isArray(r.updatedEnemy.dots) && r.updatedEnemy.dots.includes('burn'),
        'effectChance 미정의 시 burn 기본 100% 적용 (회귀 가드)');
});

test('cycle 239: secondEffect도 effectChance 게이트 적용', () => {
    const player = {
        name: 'Test', job: '도적', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // secondEffect bleed에도 effectChance 0 적용 — 절대 부여 안 됨.
    const skill = { name: 'Test', mp: 10, mult: 2.5, effect: 'stun', secondEffect: 'bleed', effectChance: 0, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    let bleedCount = 0;
    for (let i = 0; i < 30; i++) {
        const r = CombatEngine.performSkill(player, enemy, stats, skill);
        if (Array.isArray(r.updatedEnemy.dots) && r.updatedEnemy.dots.includes('bleed')) bleedCount++;
    }
    assert.equal(bleedCount, 0, 'effectChance 0 시 secondEffect도 0회 발생');
});

test('cycle 238 회귀 가드: defBonus override 처리 유지', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    const skill = { name: 'Test', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, defBonus: 1.2, turn: 3 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.ok(r.updatedPlayer.tempBuff.def > 0.19, 'cycle 238 defBonus 회귀 가드');
});
