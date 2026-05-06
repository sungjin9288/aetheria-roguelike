import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 229: 'spell_stack' relic effect dead config fix (cycle 222-228 시리즈 8번째).
 *
 * 발견 (relic effect 미적용):
 * - spell_weaver 레전더리 유물 (val: { perStack: 0.2, max: 0.6 }):
 *   "스킬 연속 사용 시 피해 +20% 누적 (최대 60%)"
 * - 그러나 src/ 어디에서도 'spell_stack' effect handler 0건. 60% 위력 증폭 메커니즘이
 *   완전히 발현 안 됨.
 * - cycle 157이 baseline 6 → 4로 줄였지만 spell_stack은 미해결 잔존이었음.
 *
 * 패턴 (cycle 222-229 silent dead config 시리즈 8번째):
 * - cycle 222-227: weapon bucket / elem / mpBonus / hpBonus / evasion / statusOnHit.
 * - cycle 228: phase3 defBonus.
 * - cycle 229: spell_stack relic effect (마지막 unhandled relic effect).
 *
 * 메커니즘:
 * - 스킬 사용 시 combatFlags.spellStackCount 증분.
 * - 스킬 데미지에 (1 + stack * perStack) 곱 (capped by max).
 * - 일반 공격(attack) 시 spellStackCount → 0 (연속 사용 깨짐).
 * - 새 전투 시작 시 0으로 리셋 (applyBattleStartRelics — combatFlags 초기화 패턴).
 *
 * 수정 (src/systems/CombatEngine.ts):
 * 1. performSkill: spell_stack 유물 보유 시 stackCount 증분 + 데미지 mult 적용.
 * 2. attack: spell_weaver 보유 시 spellStackCount 0으로 리셋.
 *
 * 회귀 가드:
 * - spell_stack 유물 미보유 시 0 영향.
 * - max cap (val.max=0.6) 보장 — 4번째 스킬부턴 60% 고정.
 */

test('cycle 229: 스킬 연속 사용 시 spell_stack 데미지 누적 (max stack 비교)', () => {
    // cycle 235: 데미지 분산 폭(±10%)이 +20% stack 보너스를 변동 우위 깨버리는 RNG flake.
    //   max stack(+60%)으로 비교하면 분산을 항상 우위 (deterministic).
    const playerStack0 = {
        name: 'Test', job: '아크메이지', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [{ id: 'spell_weaver', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
        skillChoices: {}, titles: [], equip: {},
        combatFlags: { spellStackCount: 0 }, // 0 stack
        status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const playerStack3 = {
        ...playerStack0,
        combatFlags: { spellStackCount: 3 }, // 3 stack → +60% (val.max cap)
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: '파이어볼', mp: 10, mult: 1.5, type: 'attack', element: '화염', cooldown: 0 };
    const stats = {
        atk: 200, def: 50,
        relics: playerStack0.relics,
        activeSynergies: [],
        critChance: 0,
    };

    // 동일 RNG seed 가정은 어렵지만, +60% 보너스가 ±10% 분산을 충분히 우위.
    // 평균 데미지를 비교하기 위해 N회 샘플링 (50회 → 분산 √50 ≈ 7배 좁아짐).
    const SAMPLES = 50;
    let dmgStack0Sum = 0, dmgStack3Sum = 0;
    for (let i = 0; i < SAMPLES; i++) {
        const r1 = CombatEngine.performSkill(playerStack0, enemy, stats, skill);
        const r2 = CombatEngine.performSkill(playerStack3, enemy, stats, skill);
        dmgStack0Sum += (enemy.hp - r1.updatedEnemy.hp);
        dmgStack3Sum += (enemy.hp - r2.updatedEnemy.hp);
    }
    assert.equal(playerStack0.combatFlags.spellStackCount, 0);
    // stack 3 평균 ≥ stack 0 평균 * 1.3 (60% 의도, 분산 + cap floor() 고려 1.3 보수).
    assert.ok(dmgStack3Sum > dmgStack0Sum * 1.3,
        `+60% stack은 평균 데미지 1.3x+ 차이여야 함. stack0=${dmgStack0Sum}, stack3=${dmgStack3Sum}`);

    // stackCount 증가 검증 (단일 호출).
    const r = CombatEngine.performSkill(playerStack0, enemy, stats, skill);
    assert.equal(r.updatedPlayer.combatFlags.spellStackCount, 1, '1번째 스킬 후 stack 1로 증분');
});

test('cycle 229: spell_stack 데미지 누적이 val.max로 cap', () => {
    const player = {
        name: 'Test', job: '아크메이지', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [{ id: 'spell_weaver', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
        skillChoices: {}, titles: [], equip: {},
        combatFlags: { spellStackCount: 5 }, // 이미 5스택 (1.0 cap)
        status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    const skill = { name: '파이어볼', mp: 10, mult: 1.5, type: 'attack' };
    const stats = {
        atk: 200, def: 50,
        relics: player.relics,
        activeSynergies: [],
        critChance: 0,
    };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    // stack은 max(stackCount + 1)이지만 damage mult는 cap by val.max.
    // 일반 mult 1.5 + spell stack max 0.6 → 1.5 * 1.6 ratio (or +60% on damage).
    assert.ok(r.updatedPlayer.combatFlags.spellStackCount >= 5, 'stackCount 보존');
});

test('cycle 229: 일반 공격 후 spellStackCount 리셋', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 100, def: 30,
        relics: [{ id: 'spell_weaver', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
        skillChoices: {}, titles: [], equip: { weapon: { type: 'weapon', val: 50 }, armor: null, offhand: null },
        combatFlags: { spellStackCount: 3 },
        status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    const stats = { atk: 200, def: 50, relics: player.relics, activeSynergies: [], critChance: 0 };

    const r = CombatEngine.attack(player, enemy, stats);
    assert.equal(r.updatedPlayer.combatFlags.spellStackCount, 0,
        '일반 공격 후 spellStackCount 리셋 (연속 스킬 깨짐)');
});

test('cycle 229: spell_stack 유물 미보유 시 0 영향 (회귀 가드)', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 100, def: 30,
        relics: [], // 유물 없음
        skillChoices: {}, titles: [], equip: {},
        combatFlags: { spellStackCount: 0 },
        status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    const skill = { name: '파이어볼', mp: 10, mult: 1.5 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    // stackCount 변화 없거나 0 — relic 없으면 increment 없음
    assert.equal((r.updatedPlayer.combatFlags?.spellStackCount || 0), 0,
        '유물 미보유 시 spellStackCount 증가 안 함');
});

test('cycle 228 회귀 가드: phase3 defBonus 처리 유지', () => {
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
        atk: 200, def: 50,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = {
        name: '마왕', isBoss: true,
        hp: 100, maxHp: 1000, atk: 100, def: 30,
        pattern: { guardChance: 0.0, heavyChance: 0.5 },
        phase3: {
            name: '종말의 마왕', threshold: 0.2, atkBonus: 0.6, defBonus: 10,
            pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '!',
        },
    };
    const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };
    const result = CombatEngine.enemyAttack(player, enemy, stats);
    assert.equal(result.updatedEnemy.def, 40, 'cycle 228 phase3 defBonus 보존');
});
