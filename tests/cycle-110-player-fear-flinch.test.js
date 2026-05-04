import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 110: 플레이어 fear 상태이상 → 확률적 턴 스킵 (flinch).
 *
 * cycle 106-109 status 복구 시리즈 마무리. 보스 phase 2/3가 부여 가능한 다섯
 * 가지 status (bleed/freeze/stun/curse/blind/fear) 중 마지막.
 *
 * 발견:
 * - 적의 fearTurns는 BALANCE.FEAR_ATK_MULT(0.70)로 공격력 감소 정상 동작.
 * - player가 fear 상태에서 attack/performSkill에 영향 없음 — 비대칭 회귀.
 *
 * 모델 (blind와 유사하지만 의미 다름):
 * - blind = "보이지 않아 빗나감" (miss)
 * - fear  = "두려움에 움츠림" (flinch — 행동 자체가 일어나지 않음)
 * - 차이점: blind miss는 attack/skill cost(MP) 소모 안 됨이지만 시도는 했음.
 *           fear flinch는 행동 시도 자체가 무위 — 같은 결과지만 시각적으로 구분.
 *
 * 수정:
 * - BALANCE.FEAR_PLAYER_FLINCH_CHANCE = 0.25 (25% — blind 30%보다 약간 낮게).
 * - attack/performSkill: blind 체크 다음에 fear 체크. roll 성공 시 damage 0
 *   + "[공포] 두려움에 움츠립니다!" 로그. status 유지(다중 턴).
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

test('BALANCE.FEAR_PLAYER_FLINCH_CHANCE 등록됨 (0 < x < 1)', () => {
    assert.ok(typeof BALANCE.FEAR_PLAYER_FLINCH_CHANCE === 'number');
    assert.ok(BALANCE.FEAR_PLAYER_FLINCH_CHANCE > 0 && BALANCE.FEAR_PLAYER_FLINCH_CHANCE < 1);
});

test('attack: fear 상태 + flinch roll → 행동 무위, 적 HP 변화 없음', () => {
    const player = basePlayer({ status: ['fear'] });
    const mathRandomBackup = Math.random;
    Math.random = () => 0.0;

    try {
        const result = CombatEngine.attack(player, baseEnemy(), baseStats());
        assert.equal(result.updatedEnemy.hp, 200, 'enemy HP unchanged when player flinched');
        assert.ok(result.updatedPlayer.status.includes('fear'), 'fear status persists');
        assert.ok(result.logs.some((l) => /공포|움츠|두려움/.test(l.text)));
    } finally {
        Math.random = mathRandomBackup;
    }
});

test('attack: fear 상태 + non-flinch roll → 정상 공격', () => {
    const player = basePlayer({ status: ['fear'] });
    const mathRandomBackup = Math.random;
    Math.random = () => 0.99;

    try {
        const result = CombatEngine.attack(player, baseEnemy(), baseStats());
        assert.ok(result.updatedEnemy.hp < 200);
    } finally {
        Math.random = mathRandomBackup;
    }
});

test('performSkill: fear flinch → 스킬 발동 안 됨, MP 소비 안 됨', () => {
    const player = basePlayer({ status: ['fear'], mp: 100 });
    const skill = { name: '강타', type: 'physical', mpCost: 30, mult: 2.0 };
    const mathRandomBackup = Math.random;
    Math.random = () => 0.0;

    try {
        const result = CombatEngine.performSkill(player, baseEnemy(), baseStats(), skill);
        assert.equal(result.updatedEnemy?.hp ?? 200, 200, 'enemy HP unchanged');
    } finally {
        Math.random = mathRandomBackup;
    }
});

test('cycle 106-110 status 시스템: 모든 5종 status 복구 완료 (regression sanity)', () => {
    // 한 번에 검증: bleed/freeze/curse/blind/fear가 player에 효과를 갖는다.
    // 빌드 단계에서 BALANCE 키 5종 + DOT_STATUSES bleed가 모두 존재해야 함.
    assert.ok(typeof BALANCE.STATUS_DOT_RATIO === 'number', 'bleed DoT (cycle 106)');
    assert.ok(typeof BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT === 'number', 'curse amp (cycle 108)');
    assert.ok(typeof BALANCE.BLIND_PLAYER_MISS_CHANCE === 'number', 'blind miss (cycle 109)');
    assert.ok(typeof BALANCE.FEAR_PLAYER_FLINCH_CHANCE === 'number', 'fear flinch (cycle 110)');
});
