import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 241: skill branch override의 'stunTurn' 키 dead config fix
 *   (cycle 222-239 silent dead config 시리즈 13번째 — cycle 240 batch 이후 재개).
 *
 * 발견 (stunTurn 미적용):
 * - 마법사 '썬더볼트' branch B = '마비 번개' (mult 3.5, effect 'stun', stunTurn 2):
 *   "기절 2턴 (확률 +)" desc — 2턴 stun 의도.
 * - 성직자 '천벌' branch B = '심판의 천벌' (mult 6.0, secondEffect 'curse', stunTurn 2):
 *   "기절 2턴 + 저주" desc — 기절 2턴 + 저주 의도. (별도 데이터 fix 필요)
 * - 그러나 applyStatusEffectToEnemy는 stun/freeze 시 stunnedTurns = max(prev, 1) 고정 적용.
 *   skill.stunTurn 키를 read 안 함 → '마비 번개' 의도 (2턴) 영원히 1턴만 적용.
 *
 * 패턴 (cycle 222-239 silent dead config 시리즈 13번째):
 * - cycle 238: skill branch defBonus.
 * - cycle 239: skill branch effectChance.
 * - cycle 241: skill branch stunTurn.
 *
 * 수정 (src/systems/CombatEngine.ts performSkill status section):
 * - skill.effect = 'stun' / 'freeze' 부여 시 skill.stunTurn 정의되면 stunnedTurns 그 값으로 max 처리.
 * - secondEffect도 동일.
 * - 미정의 시 기본 1 (회귀 가드).
 *
 * 회귀 가드:
 * - skill.stunTurn 미정의 시 기존 stun 1턴 동작 유지.
 * - skill.stunTurn = 1 시 1턴 (기본과 동일).
 */

test('cycle 241: skill.stunTurn 2 시 stunnedTurns 2 적용', () => {
    const player = {
        name: 'Test', job: '마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', stunTurn: 2, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.success, true);
    assert.equal(r.updatedEnemy.stunnedTurns, 2,
        `stunTurn 2 → stunnedTurns 2 적용 (실제: ${r.updatedEnemy.stunnedTurns})`);
});

test('cycle 241: skill.stunTurn 미정의 시 stunnedTurns 1 (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.stunnedTurns, 1,
        'stunTurn 미정의 시 1턴 기본 유지 (회귀 가드)');
});

test('cycle 241: skill.stunTurn freeze에도 적용', () => {
    const player = {
        name: 'Test', job: '마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
    // freeze도 stunnedTurns 카운터를 사용 (CombatEngine line 234).
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'freeze', stunTurn: 3, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.stunnedTurns, 3,
        `freeze + stunTurn 3 → stunnedTurns 3 (실제: ${r.updatedEnemy.stunnedTurns})`);
});

test('cycle 241: secondEffect stun도 stunTurn 게이트 적용', () => {
    const player = {
        name: 'Test', job: '도적', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
    // secondEffect: 'stun' + stunTurn: 2 → 2턴 stun.
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'bleed', secondEffect: 'stun', stunTurn: 2, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.stunnedTurns, 2,
        `secondEffect stun + stunTurn 2 → stunnedTurns 2 (실제: ${r.updatedEnemy.stunnedTurns})`);
});

test('cycle 239 회귀 가드: effectChance 0 시 stun 부여 안 됨 + stunTurn도 영향 없음', () => {
    const player = {
        name: 'Test', job: '마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', effectChance: 0, stunTurn: 2, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    let stunCount = 0;
    for (let i = 0; i < 30; i++) {
        const r = CombatEngine.performSkill(player, enemy, stats, skill);
        if (r.updatedEnemy.stunnedTurns) stunCount++;
    }
    assert.equal(stunCount, 0, 'cycle 239 effectChance 0 가드 + stunTurn 영향 없음');
});
