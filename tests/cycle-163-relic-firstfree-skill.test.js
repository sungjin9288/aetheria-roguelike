import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { applyBattleStartRelics } from '../src/utils/exploreUtils.js';

/**
 * cycle 163: 'cooldown_reduce.firstFree' 잔존 메커니즘 정리 (cycle 151 TODO).
 *
 * 시간 군주의 왕관 (val: { cdReduction: 1, firstFree: true }):
 * - cdReduction 1턴 감소: cycle 151에서 적용 완료.
 * - firstFree (첫 스킬 MP 무소비): 본 사이클에서 추가.
 *
 * 메커니즘:
 * - applyBattleStartRelics: combatFlags.firstSkillUsed = false 리셋.
 * - performSkill: firstFreeAvailable = (cdRelic.val.firstFree && !firstSkillUsed)
 *   조건이면 actualMpCost = 0 강제. 첫 스킬 사용 후 firstSkillUsed = true.
 * - free_skill 유물(주문 메아리)와 분리된 로그 출력.
 */

const fakePlayer = (overrides = {}) => ({
    name: 'tester', job: '모험가', level: 10,
    hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
    relics: [], skillChoices: {}, titles: [], activeTitle: null,
    killStreak: 0, combatFlags: {}, status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
    ...overrides,
});

test("firstFree: 첫 스킬 사용 시 MP 무소비 (firstSkillUsed=false 시)", () => {
    const player = fakePlayer({
        relics: [{ effect: 'cooldown_reduce', val: { cdReduction: 1, firstFree: true } }],
        combatFlags: { firstSkillUsed: false },
    });
    const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
    const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
    const stats = {
        atk: 100, def: 50, elem: 'physical',
        relics: player.relics, activeSynergies: [], critChance: 0,
    };

    const result = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(result.success, true);
    assert.equal(result.updatedPlayer.mp, 100, 'MP 무소비 — 100 그대로');
    assert.equal(result.updatedPlayer.combatFlags.firstSkillUsed, true);
    const log = result.logs.find((l) => l.text.includes('시간 군주의 왕관'));
    assert.ok(log, 'firstFree 로그 출력');
});

test("firstFree: 두 번째 스킬은 정상 MP 소비 (firstSkillUsed=true)", () => {
    const player = fakePlayer({
        relics: [{ effect: 'cooldown_reduce', val: { cdReduction: 1, firstFree: true } }],
        combatFlags: { firstSkillUsed: true }, // 이미 첫 스킬 사용됨
    });
    const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
    const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
    const stats = {
        atk: 100, def: 50, elem: 'physical',
        relics: player.relics, activeSynergies: [], critChance: 0,
    };

    const result = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(result.success, true);
    assert.equal(result.updatedPlayer.mp, 50, 'MP 50 소비 (100 - 50)');
});

test("firstFree: 미보유 시 정상 MP 소비 (회귀 가드)", () => {
    const player = fakePlayer({
        combatFlags: { firstSkillUsed: false },
    });
    const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
    const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
    const stats = {
        atk: 100, def: 50, elem: 'physical',
        relics: [], activeSynergies: [], critChance: 0,
    };

    const result = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(result.success, true);
    assert.equal(result.updatedPlayer.mp, 50);
});

test("applyBattleStartRelics: firstSkillUsed=false 리셋 (매 전투 첫 스킬 가용)", () => {
    const player = fakePlayer({
        combatFlags: { firstSkillUsed: true, voidHeartUsed: true },
    });
    const result = applyBattleStartRelics(player, [], { maxHp: 1000 }, { addLog: () => {} });

    assert.equal(result.combatFlags.firstSkillUsed, false);
    assert.equal(result.combatFlags.voidHeartUsed, true, 'run-wide 플래그는 보존');
});

test("firstFree + cdReduction 동시 적용 (cycle 151 + cycle 163 통합)", () => {
    const player = fakePlayer({
        relics: [{ effect: 'cooldown_reduce', val: { cdReduction: 1, firstFree: true } }],
        combatFlags: { firstSkillUsed: false },
    });
    const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
    const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
    const stats = {
        atk: 100, def: 50, elem: 'physical',
        relics: player.relics, activeSynergies: [], critChance: 0,
    };

    const result = CombatEngine.performSkill(player, enemy, stats, skill);
    // MP 무소비 + cooldown 3 → 2 (cdReduction 1).
    assert.equal(result.updatedPlayer.mp, 100);
    assert.equal(result.updatedPlayer.skillLoadout.cooldowns['fireball'], 2);
});
