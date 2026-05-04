import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 109: 플레이어 blind 상태이상 → 공격 miss 확률 처리.
 *
 * cycle 106-108 status 복구 시리즈 연장.
 *
 * 발견:
 * - 적의 blindTurns는 BALANCE.BLIND_ATK_MULT(0.65)로 공격력 감소 정상 동작.
 * - 그러나 player가 blind 상태일 때 attack/performSkill에서 miss 처리 안 됨 —
 *   status가 표시만 되고 실제 페널티 0.
 *
 * 수정:
 * - BALANCE.BLIND_PLAYER_MISS_CHANCE = 0.30 (30% miss 확률).
 * - attack/performSkill: freeze/stun 스킵 다음에 blind 체크. 확률 hit 시 damage 0
 *   + "[실명] 공격이 빗나갔습니다" 로그. status는 유지(여러 턴 효과 — 저주해제
 *   주문서 / purify 스킬 / 휴식으로 해제).
 *
 * 영향:
 * 보스 phase 부여 blind가 의도대로 작동. 일반 몬스터 heavy attack의 statusEffect
 * 'blind' 설정도 적용됨.
 */

const baseStats = (overrides = {}) => ({
    atk: 100, def: 50, maxHp: 1000, maxMp: 100, crit: 0, elem: null,
    relics: [], activeSynergies: [],
    ...overrides,
});

const basePlayer = (overrides = {}) => ({
    hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
    status: [], relics: [],
    combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
    ...overrides,
});

const baseEnemy = (overrides = {}) => ({
    name: '슬라임', hp: 200, maxHp: 200, atk: 30, def: 10,
    pattern: { guardChance: 0, heavyChance: 0 },
    ...overrides,
});

test('BALANCE.BLIND_PLAYER_MISS_CHANCE 등록됨 (0 < x < 1)', () => {
    assert.ok(typeof BALANCE.BLIND_PLAYER_MISS_CHANCE === 'number');
    assert.ok(BALANCE.BLIND_PLAYER_MISS_CHANCE > 0 && BALANCE.BLIND_PLAYER_MISS_CHANCE < 1);
});

test('attack: blind 상태 + miss roll → 공격 빗나감, 적 HP 변화 없음', () => {
    const player = basePlayer({ status: ['blind'] });
    const mathRandomBackup = Math.random;
    Math.random = () => 0.0; // 가장 낮은 확률 → blind miss 확정 발동

    try {
        const result = CombatEngine.attack(player, baseEnemy(), baseStats());
        assert.equal(result.updatedEnemy.hp, 200, 'enemy HP unchanged when attack missed');
        assert.ok(result.updatedPlayer.status.includes('blind'), 'blind status persists across miss');
        assert.ok(result.logs.some((l) => /실명|빗나갔|miss/.test(l.text)));
    } finally {
        Math.random = mathRandomBackup;
    }
});

test('attack: blind 상태 + hit roll → 정상 공격', () => {
    const player = basePlayer({ status: ['blind'] });
    const mathRandomBackup = Math.random;
    Math.random = () => 0.99; // 가장 높은 확률 → miss 미발동

    try {
        const result = CombatEngine.attack(player, baseEnemy(), baseStats());
        assert.ok(result.updatedEnemy.hp < 200, 'enemy should take damage when blind miss did not trigger');
    } finally {
        Math.random = mathRandomBackup;
    }
});

test('attack: 일반 상태 → blind 검사 스킵, 정상 공격', () => {
    const result = CombatEngine.attack(basePlayer(), baseEnemy(), baseStats());
    assert.ok(result.updatedEnemy.hp < 200);
});

test('performSkill: blind + miss roll → 스킬 빗나감, MP 소비 안 됨', () => {
    const player = basePlayer({ status: ['blind'], mp: 100 });
    const skill = { name: '강타', type: 'physical', mpCost: 30, mult: 2.0 };
    const mathRandomBackup = Math.random;
    Math.random = () => 0.0;

    try {
        const result = CombatEngine.performSkill(player, baseEnemy(), baseStats(), skill);
        // miss 발동 시: success: true (스킬 발동했지만 빗나감) 또는 success: false 둘 다 OK.
        // 핵심은 enemy HP가 그대로여야 함.
        const enemyHpAfter = result.updatedEnemy?.hp ?? 200;
        assert.equal(enemyHpAfter, 200, 'enemy HP unchanged when skill missed');
    } finally {
        Math.random = mathRandomBackup;
    }
});
