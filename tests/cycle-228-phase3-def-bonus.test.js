import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 228: 8 phase3 bosses의 defBonus dead config fix (cycle 222-227 시리즈 7번째).
 *
 * 발견 (phase3.defBonus 미적용):
 * - phase3 keys: atkBonus / defBonus / log / name / pattern / statusEffect / threshold.
 * - 그러나 CombatEngine.ts:1019의 phase3 전환은 atkBonus만 적용 (atk 증가).
 *   defBonus는 read 안 함 → 8+ phase3 보스의 def 강화가 0건 dispatch.
 * - 영향 보스 (phase3.defBonus 정의):
 *   · 종말의 마왕 (defBonus: 10)
 *   · 수호신의 심판 (defBonus: 15)
 *   · 절대 심판 (defBonus: 20)
 *   · 허무의 절대 권능 (defBonus: 25)
 *   · 절대 공허 (defBonus: 40)
 *   · 에테르의 절대 심판 (defBonus: 15)
 *   · 절대 공허의 대행자 (defBonus: 20)
 *   · 종말의 화신 (defBonus: 25)
 *
 * 결과 (UX/balance 회귀):
 * - phase3 전환 시 atk만 강해지고 def는 그대로 → 보스 후반 페이즈 발딘력이 의도보다 약함.
 * - 게임 디자인상 phase3는 'last stand' 강화 모먼트 — defBonus는 핵심 spec.
 *
 * 패턴 (cycle 222-228 silent dead config 시리즈 7번째):
 * - cycle 222: weapon 5종 armors 버킷 오배치.
 * - cycle 223: '얼음' elem 비매칭.
 * - cycle 224: 4 items mpBonus 미적용.
 * - cycle 225: 2 armors hpBonus 미적용.
 * - cycle 226: 2 armors evasion 미적용.
 * - cycle 227: 27 monsters statusOnHit 미적용.
 * - cycle 228: 8 phase3 bosses defBonus 미적용.
 *
 * 수정 (src/systems/CombatEngine.ts enemyAttack phase3 전환):
 * - p3.defBonus 정의 시 enemy.def += defBonus.
 * - 기존 atkBonus 처리는 그대로 유지.
 *
 * 회귀 가드:
 * - phase2는 defBonus 미정의 → 기존 동작 유지.
 * - defBonus 미정의 phase3는 0 영향.
 */

test('cycle 228: 8 phase3 bosses가 defBonus 정의 (baseline)', () => {
    const expected = [
        { name: '종말의 마왕', defBonus: 10 },
        { name: '수호신의 심판', defBonus: 15 },
        { name: '절대 심판', defBonus: 20 },
        { name: '허무의 절대 권능', defBonus: 25 },
        { name: '절대 공허', defBonus: 40 },
        { name: '에테르의 절대 심판', defBonus: 15 },
        { name: '절대 공허의 대행자', defBonus: 20 },
        { name: '종말의 화신', defBonus: 25 },
    ];
    const monsters = DB.MONSTERS || {};
    const found = [];
    for (const [name, m] of Object.entries(monsters)) {
        if (m.phase3?.defBonus) found.push({ name: m.phase3.name, defBonus: m.phase3.defBonus });
    }
    for (const exp of expected) {
        const match = found.find((f) => f.name === exp.name);
        assert.ok(match, `phase3 boss '${exp.name}' should have defBonus`);
        assert.equal(match.defBonus, exp.defBonus);
    }
});

test('cycle 228: phase3 전환 시 def 증가 적용', () => {
    // phase3 transition: hp <= threshold → name/atk/pattern/def 변경 + log emit.
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
        atk: 200, def: 50,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = {
        name: '마왕', baseName: '마왕', isBoss: true,
        hp: 100, maxHp: 1000, atk: 100, def: 30,
        pattern: { guardChance: 0.0, heavyChance: 0.5 },
        phase3: {
            name: '종말의 마왕', threshold: 0.2, atkBonus: 0.6, defBonus: 10,
            pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '마왕이 최후의 힘을 끌어냅니다!',
        },
    };
    const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    // phase3 triggered → enemy def 30 + 10 = 40
    assert.equal(result.updatedEnemy.def, 40,
        `phase3 defBonus 10 적용되어야 함 (30 + 10 = 40, 실제: ${result.updatedEnemy.def})`);
    assert.equal(result.updatedEnemy.phase3Triggered, true);
});

test('cycle 228: phase3 atkBonus도 동시 적용 (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
        atk: 200, def: 50,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = {
        name: '마왕', baseName: '마왕', isBoss: true,
        hp: 100, maxHp: 1000, atk: 100, def: 30,
        pattern: { guardChance: 0.0, heavyChance: 0.5 },
        phase3: {
            name: '종말의 마왕', threshold: 0.2, atkBonus: 0.6, defBonus: 10,
            pattern: { guardChance: 0.0, heavyChance: 0.7 },
            log: '마왕이 최후의 힘을 끌어냅니다!',
        },
    };
    const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    // atkBonus 0.6 = 60% increase → 100 * 1.6 = 160
    assert.equal(result.updatedEnemy.atk, 160, 'phase3 atkBonus 보존');
});

test('cycle 228: defBonus 미정의 phase3는 def 변화 없음 (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
        atk: 200, def: 50,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = {
        name: '몹', baseName: '몹', isBoss: true,
        hp: 50, maxHp: 1000, atk: 100, def: 30,
        pattern: { guardChance: 0.0, heavyChance: 0.5 },
        phase3: {
            name: '강화몹', threshold: 0.2, atkBonus: 0.5,
            pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '강화!',
            // defBonus 미정의
        },
    };
    const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    assert.equal(result.updatedEnemy.def, 30, 'defBonus 미정의 phase3는 def 그대로');
});

test('cycle 227 회귀 가드: heavy hit + statusOnHit 처리 유지', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = {
        name: '슬라임', hp: 100, atk: 50, def: 5,
        statusOnHit: 'poison',
        pattern: { guardChance: 0.0, heavyChance: 1.0 },
    };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    assert.ok((result.updatedPlayer.status || []).includes('poison'), 'cycle 227 statusOnHit 보존');
});
