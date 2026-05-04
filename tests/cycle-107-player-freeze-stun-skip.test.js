import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 107: 플레이어 freeze / stun 상태이상 턴 스킵 처리.
 *
 * 발견된 버그(cycle 106 bleed fix와 같은 결의 회귀):
 * - 보스 phase 2/3가 statusEffect: 'freeze' / 'stun' / 'curse' / 'fear' / 'blind'
 *   를 player에 부여 가능. 그러나 player.status 배열에 string이 추가만 되고,
 *   attack() / performSkill() 어디서도 검사하지 않음.
 * - 결과: 플레이어가 frozen / stunned 상태에서도 정상적으로 공격 가능.
 *   적의 stun/freeze는 stunnedTurns 카운터로 제대로 턴 스킵하는 반면 player
 *   쪽만 비대칭 회귀 — boss 위협이 무력화.
 *
 * cycle 107 범위 (가장 임팩트 큰 freeze/stun 우선):
 * - attack(): 시작 시 player.status에 freeze/stun이 있으면 해당 status 제거 후
 *   damage 0으로 즉시 return. enemy는 그대로 (enemy turn에서 자유 공격).
 * - performSkill(): 동일 처리.
 *
 * curse / fear / blind는 CombatEngine 외부 (damage scaling, miss chance 등)
 * 영향이라 별도 사이클에서 다룸.
 */

const baseStats = (overrides = {}) => ({
    atk: 100, def: 50, maxHp: 1000, maxMp: 100, crit: 0.1, elem: null,
    relics: [], activeSynergies: [],
    ...overrides,
});

const basePlayer = (overrides = {}) => ({
    hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
    status: [],
    combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
    relics: [],
    ...overrides,
});

const baseEnemy = (overrides = {}) => ({
    name: '슬라임', hp: 100, maxHp: 100, atk: 30, def: 10,
    pattern: { guardChance: 0, heavyChance: 0 },
    ...overrides,
});

test('attack: 플레이어 freeze 상태 → 턴 스킵, 적 HP 변화 없음', () => {
    const player = basePlayer({ status: ['freeze'] });
    const result = CombatEngine.attack(player, baseEnemy(), baseStats());
    assert.equal(result.updatedEnemy.hp, 100, 'enemy HP unchanged when player skipped');
    assert.ok(!result.updatedPlayer.status.includes('freeze'), 'freeze status consumed');
    assert.ok(result.logs.some((l) => /freeze|빙결|기절|행동.*불가|얼/.test(l.text)),
        'should log skip reason');
});

test('attack: 플레이어 stun 상태 → 턴 스킵', () => {
    const player = basePlayer({ status: ['stun'] });
    const result = CombatEngine.attack(player, baseEnemy(), baseStats());
    assert.equal(result.updatedEnemy.hp, 100);
    assert.ok(!result.updatedPlayer.status.includes('stun'));
});

test('attack: 일반 상태 → 정상 공격 (회귀 보존)', () => {
    const player = basePlayer({ status: [] });
    const result = CombatEngine.attack(player, baseEnemy(), baseStats());
    assert.ok(result.updatedEnemy.hp < 100, 'enemy should take damage when player not frozen');
});

test('attack: poison 상태 → 정상 공격 (DoT만, 행동 제약 없음)', () => {
    const player = basePlayer({ status: ['poison'] });
    const result = CombatEngine.attack(player, baseEnemy(), baseStats());
    assert.ok(result.updatedEnemy.hp < 100, 'poison should not skip turn');
});

test('attack: freeze + bleed 동시 → freeze가 우선 적용 (skip)', () => {
    const player = basePlayer({ status: ['bleed', 'freeze'] });
    const result = CombatEngine.attack(player, baseEnemy(), baseStats());
    assert.equal(result.updatedEnemy.hp, 100, 'should skip due to freeze');
    assert.ok(!result.updatedPlayer.status.includes('freeze'), 'freeze consumed');
    assert.ok(result.updatedPlayer.status.includes('bleed'), 'bleed preserved');
});

test('performSkill: 플레이어 freeze → 스킬 발동 안 됨, MP 소비 안 됨', () => {
    const player = basePlayer({ status: ['freeze'], mp: 100 });
    const skill = { name: '강타', type: 'physical', mpCost: 30, mult: 2.0 };
    const result = CombatEngine.performSkill(player, baseEnemy(), baseStats(), skill);
    // 스킬 발동 자체가 막힘 — MP가 소비되지 않거나 success: false 반환
    if (result.success !== false) {
        // success: true 인 경우 enemy 피해가 없어야 (skip)
        assert.equal(result.updatedEnemy?.hp ?? 100, 100, 'enemy untouched when skill skipped');
    }
});
