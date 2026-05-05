import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 172: 'counter' 스킬 효과 추가 ('반격 자세' — 마지막 dead skill effect).
 *
 * 발견:
 * - classes.ts에 '반격 자세' (effect: 'counter', val: 1.4, turn: 3, type: 'buff')
 *   스킬 정의 있음. desc: "피격 시 반격 확률 상승 3턴".
 * - 그러나 CombatEngine.performSkill의 buff 분기에서 counter 처리 없음 → 스킬
 *   사용해도 tempBuff name 외에 효과 0 (silent no-op).
 * - cycle 164 어시 검증에서 dead skill effect 1건으로 식별.
 *
 * 수정:
 * 1. performSkill buff 분기 — skill.effect === 'counter' 처리 추가:
 *    buff.counterChance = max(0.2, val - 1) (val 1.4 → 0.4 = 40%).
 * 2. enemyAttack — applyFatalProtection 직후 분기:
 *    tempBuff.counterChance > 0 + turn > 0 + 양쪽 생존 → 확률 발동.
 *    counter damage = stats.atk (1배 추가타). enemy hp 차감 + 반격 로그.
 */

test('counter buff 활성 (chance 1.0 강제) → 적에게 반격 추가타', () => {
    const orig = Math.random;
    Math.random = () => 0.0; // 모든 chance roll 통과
    try {
        const player = {
            name: 'tester', job: '모험가', level: 10,
            hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
            relics: [], skillChoices: {}, titles: [], activeTitle: null,
            killStreak: 0, combatFlags: {}, status: [],
            tempBuff: { atk: 0, def: 0, turn: 3, name: '반격 자세', counterChance: 1.0 },
        };
        const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
        const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

        const result = CombatEngine.enemyAttack(player, enemy, stats);
        // counter damage = stats.atk(50). enemy hp 100 → 50.
        assert.equal(result.updatedEnemy.hp, 50,
            `expected enemy hp 50 after counter; got ${result.updatedEnemy.hp}`);
        const counterLog = result.logs.find((l) => l.text && l.text.includes('반격'));
        assert.ok(counterLog, '반격 로그 출력');
    } finally {
        Math.random = orig;
    }
});

test('counter buff 만료 (turn 0) → 반격 발동 안 함', () => {
    const orig = Math.random;
    Math.random = () => 0.0;
    try {
        const player = {
            name: 'tester', job: '모험가', level: 10,
            hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
            relics: [], skillChoices: {}, titles: [], activeTitle: null,
            killStreak: 0, combatFlags: {}, status: [],
            tempBuff: { atk: 0, def: 0, turn: 0, name: '반격 자세', counterChance: 1.0 },
        };
        const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
        const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

        const result = CombatEngine.enemyAttack(player, enemy, stats);
        // counter 발동 안 함 → enemy hp 100 그대로.
        assert.equal(result.updatedEnemy.hp, 100);
    } finally {
        Math.random = orig;
    }
});

test('counter chance 0.0 → 반격 발동 안 함 (chance 가드)', () => {
    const orig = Math.random;
    Math.random = () => 0.5;
    try {
        const player = {
            name: 'tester', job: '모험가', level: 10,
            hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
            relics: [], skillChoices: {}, titles: [], activeTitle: null,
            killStreak: 0, combatFlags: {}, status: [],
            tempBuff: { atk: 0, def: 0, turn: 3, name: '반격 자세', counterChance: 0.0 },
        };
        const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
        const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

        const result = CombatEngine.enemyAttack(player, enemy, stats);
        assert.equal(result.updatedEnemy.hp, 100);
    } finally {
        Math.random = orig;
    }
});

test('performSkill counter: tempBuff.counterChance가 val(=1.4)에서 0.4로 변환됨', () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        relics: [], skillChoices: {}, titles: [], activeTitle: null,
        killStreak: 0, combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 10000, maxHp: 10000, atk: 30, def: 5 };
    const skill = { name: '반격 자세', mp: 35, type: 'buff', effect: 'counter', val: 1.4, turn: 3 };
    const stats = { atk: 50, def: 30, elem: 'physical', relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(result.success, true);
    assert.equal(result.updatedPlayer.tempBuff.name, '반격 자세');
    assert.equal(result.updatedPlayer.tempBuff.turn, 3);
    // val 1.4 - 1 = 0.4 (floating point ~0.3999... 허용)
    const cc = result.updatedPlayer.tempBuff.counterChance;
    assert.ok(cc >= 0.39 && cc <= 0.41, `expected counterChance ~0.4; got ${cc}`);
});

test('회귀 가드: counter buff 없으면 enemyAttack 결과 변화 없음', () => {
    const orig = Math.random;
    Math.random = () => 0.0;
    try {
        const player = {
            name: 'tester', job: '모험가', level: 10,
            hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
            relics: [], skillChoices: {}, titles: [], activeTitle: null,
            killStreak: 0, combatFlags: {}, status: [],
            // tempBuff 없음
        };
        const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
        const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

        const result = CombatEngine.enemyAttack(player, enemy, stats);
        // 반격 없음 → enemy hp 100 그대로.
        assert.equal(result.updatedEnemy.hp, 100);
    } finally {
        Math.random = orig;
    }
});
