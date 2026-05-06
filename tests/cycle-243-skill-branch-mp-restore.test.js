import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 243: skill branch override의 'mpRestore' 키 dead config fix
 *   (cycle 222-242 silent dead config 시리즈 15번째).
 *
 * 발견 (mpRestore 미적용):
 * - 시간술사 '시간 정지' branch B = '시간 충전' (effect: 'extraTurn', mpRestore: 30):
 *   "추가 행동 + MP 30 즉시 회복" desc — 추가 행동 + MP 회복 trade-off (val ATK 보너스 대신).
 * - 그러나 CombatEngine extraTurn 처리는 skill.val(ATK 보너스)만 read하고 skill.mpRestore는 dispatch 0건.
 * - 결과: '시간 충전' branch는 ATK 페널티 없이 추가 행동만 부여 — MP 회복 광고는 fake.
 *
 * 패턴 (cycle 222-242 silent dead config 시리즈 15번째):
 * - cycle 238/239/241/242: skill branch defBonus / effectChance / stunTurn / crit.
 * - cycle 243: skill branch mpRestore.
 *
 * 수정 (src/systems/CombatEngine.ts performSkill extraTurn section):
 * - skill.mpRestore 정의 시 updatedPlayer.mp += mpRestore (maxMp cap 적용).
 * - 미정의 시 영향 없음 (회귀 가드).
 *
 * 회귀 가드:
 * - skill.mpRestore 미정의 시 기존 extraTurn 동작 유지 (val 만 적용).
 * - extraTurn 외의 effect는 mpRestore 무시.
 */

test('cycle 243: extraTurn + mpRestore 30 시 MP +30 회복', () => {
    const player = {
        name: 'Test', job: '시간술사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // mpCost 50, mpRestore 30 → MP 100 - 50 + 30 = 80 기대.
    const skill = { name: 'Test', mp: 50, mult: 1.0, effect: 'extraTurn', mpRestore: 30, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.success, true);
    assert.equal(r.updatedPlayer.mp, 80,
        `mpRestore 30 → MP 100-50+30=80 (실제: ${r.updatedPlayer.mp})`);
    assert.equal(r.updatedPlayer.extraTurnGranted, true,
        'extraTurn 플래그 설정');
});

test('cycle 243: mpRestore가 maxMp를 초과하지 않음', () => {
    const player = {
        name: 'Test', job: '시간술사', level: 30,
        hp: 1000, maxHp: 1000, mp: 180, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // 180 - 50 + 100 = 230 → cap 200.
    const skill = { name: 'Test', mp: 50, mult: 1.0, effect: 'extraTurn', mpRestore: 100, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedPlayer.mp, 200,
        `mpRestore 100 시 maxMp 200 cap (실제: ${r.updatedPlayer.mp})`);
});

test('cycle 243: extraTurn + val (ATK 보너스) 동작 회귀 가드', () => {
    const player = {
        name: 'Test', job: '시간술사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // '시간 폭주' branch — val 1.4 (ATK +40%), no mpRestore.
    const skill = { name: 'Test', mp: 50, mult: 1.0, effect: 'extraTurn', val: 1.4, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedPlayer.mp, 50, 'mpRestore 미정의 시 MP 회복 0 (회귀 가드)');
    // float precision tolerance.
    assert.ok(Math.abs(r.updatedPlayer.tempBuff.atk - 0.4) < 0.01,
        `val 1.4 → tempBuff.atk +0.4 회귀 가드 (실제: ${r.updatedPlayer.tempBuff.atk})`);
});

test('cycle 243: extraTurn 외 effect에서 mpRestore 무시 (안전 가드)', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // effect: 'stun' + mpRestore: 30 → mpRestore 무시 (extraTurn 분기에만).
    const skill = { name: 'Test', mp: 50, mult: 2.0, effect: 'stun', mpRestore: 30, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedPlayer.mp, 50,
        `extraTurn 외 effect → mpRestore 무시 (실제: ${r.updatedPlayer.mp})`);
});
