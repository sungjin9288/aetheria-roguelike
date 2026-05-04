import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 108: 플레이어 curse 상태이상 → 받는 피해 증폭 처리.
 *
 * cycle 106(bleed)/107(freeze/stun) 시리즈 연장. 보스 phase 2/3가 부여하는
 * 또 하나의 무력화된 status effect 복구.
 *
 * 발견:
 * - MSG.SKILL_CURSE_AMPLIFY는 "[X] 저주가 강화되어 피해가 증폭됩니다!" 라는
 *   의도를 명시하지만 player에 curse 상태가 있어도 받는 피해에 변화 없음.
 * - 적의 cursedTurns는 BALANCE.CURSE_ATK_MULT(0.75)로 ATK 감소 정상 동작 —
 *   player 쪽만 비대칭.
 *
 * 수정:
 * - BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT 신규 (1.3 — 받는 피해 +30%).
 * - enemyAttack: enemyDmg 계산 후 player.status에 'curse' 있으면 multiplier
 *   적용. 로그에 "[저주] 받는 피해 +30%" 라인.
 *
 * 영향:
 * 보스 phase 부여 curse + 일반 몬스터 heavy curse 부여 모두 의도대로 위협 증폭.
 * 회피 옵션은 저주해제 주문서(items 기존), purify 스킬, status_resist 유물.
 */

const baseStats = (overrides = {}) => ({
    atk: 100, def: 50, maxHp: 1000, maxMp: 100, crit: 0.1, elem: null,
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
    name: '슬라임', hp: 200, maxHp: 200, atk: 100, def: 10,
    pattern: { guardChance: 0, heavyChance: 0 },
    ...overrides,
});

test('BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT 등록됨 (≥ 1.0)', () => {
    assert.ok(typeof BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT === 'number');
    assert.ok(BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT > 1, 'should be > 1.0 for amplification');
});

test('enemyAttack: 일반 상태 vs curse 상태 — curse가 더 큰 피해', () => {
    const stats = baseStats();
    const enemy = baseEnemy();
    const mathRandomBackup = Math.random;
    Math.random = () => 0.99; // pattern 결정론 (heavy 안 발동 보장)

    try {
        const normal = CombatEngine.enemyAttack(basePlayer(), enemy, stats);
        const cursed = CombatEngine.enemyAttack(basePlayer({ status: ['curse'] }), enemy, stats);
        assert.ok(cursed.damage > normal.damage, `cursed dmg ${cursed.damage} should exceed normal ${normal.damage}`);
    } finally {
        Math.random = mathRandomBackup;
    }
});

test('enemyAttack: cursed damage = normal * CURSE_PLAYER_DMG_TAKEN_MULT 비율', () => {
    const stats = baseStats();
    const enemy = baseEnemy();
    const mathRandomBackup = Math.random;
    Math.random = () => 0.99;

    try {
        const normal = CombatEngine.enemyAttack(basePlayer(), enemy, stats);
        const cursed = CombatEngine.enemyAttack(basePlayer({ status: ['curse'] }), enemy, stats);
        const expected = Math.floor(normal.damage * BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT);
        // floor 오차 허용 — Math.floor 단계가 amplifier에서 한 번 더 일어나므로 ±1 허용
        const diff = Math.abs(cursed.damage - expected);
        assert.ok(diff <= 1, `cursed dmg ${cursed.damage} ≈ expected ${expected} (diff ${diff})`);
    } finally {
        Math.random = mathRandomBackup;
    }
});

test('enemyAttack: curse 없을 때 동작 회귀 보존', () => {
    const stats = baseStats();
    const result = CombatEngine.enemyAttack(basePlayer(), baseEnemy(), stats);
    // damage 양수 + isDead false (HP 1000 - 작은 피해)
    assert.ok(result.damage > 0);
    assert.equal(result.isDead, false);
});

test('enemyAttack: curse 상태에서 로그에 저주 증폭 안내 등장', () => {
    const stats = baseStats();
    const mathRandomBackup = Math.random;
    Math.random = () => 0.99;
    try {
        const result = CombatEngine.enemyAttack(basePlayer({ status: ['curse'] }), baseEnemy(), stats);
        assert.ok(
            result.logs.some((l) => /저주.*증폭|저주.*피해|받는 피해.*저주/.test(l.text)),
            'should log curse amplification reason'
        );
    } finally {
        Math.random = mathRandomBackup;
    }
});
