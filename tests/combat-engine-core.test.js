/**
 * CombatEngine 핵심 로직 유닛 테스트
 *
 * CombatEngine.js는 JSX → db.js 의존성으로 Node.js 직접 임포트 불가.
 * 인라인 미러 패턴으로 핵심 순수 함수 알고리즘을 검증합니다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ── BALANCE 상수 미러 ───────────────────────────────────────────────────────
const BALANCE = {
    CRIT_CHANCE: 0.1,
    ESCAPE_CHANCE: 0.5,
    ELEMENT_WEAK_MULT: 1.25,
    ELEMENT_RESIST_MULT: 0.75,
    GUARD_DAMAGE_MULT: 0.65,
    DAMAGE_BASE_RATIO: 0.9,
    DAMAGE_VARIANCE: 0.2,
    EXP_SCALE_RATE: 1.38,
    EXP_LEVEL_CAP_50: 800000,
    HP_PER_LEVEL: 20,
    MP_PER_LEVEL: 10,
};
const MAX_LEVEL = 99;

// ── 인라인 순수 함수 (CombatEngine 핵심 로직 미러) ─────────────────────────

/**
 * CombatEngine.getElementMultiplier 미러
 */
function getElementMultiplier(elem, enemy) {
    if (!elem || elem === 'physical' || elem === 'none') return 1;
    if (enemy?.weakness && enemy.weakness === elem) return BALANCE.ELEMENT_WEAK_MULT;
    if (enemy?.resistance && enemy.resistance === elem) return BALANCE.ELEMENT_RESIST_MULT;
    return 1;
}

/**
 * CombatEngine.calculateDamage 미러 (결정론적 버전: crit/random 주입)
 */
function calculateDamage(stats, options = {}, rolls = {}) {
    const {
        mult = 1,
        guarding = false,
        elementMultiplier = 1,
        critChance = BALANCE.CRIT_CHANCE,
    } = options;
    const { randomValue = 0, critRoll = 1 } = rolls;
    const guardMult = guarding ? BALANCE.GUARD_DAMAGE_MULT : 1;
    const baseDamage = Math.floor(
        stats.atk * (BALANCE.DAMAGE_BASE_RATIO + randomValue * BALANCE.DAMAGE_VARIANCE) * mult * guardMult * elementMultiplier
    );
    const isCrit = critRoll < critChance;
    return {
        damage: Math.max(1, isCrit ? baseDamage * 2 : baseDamage),
        isCrit,
    };
}

/**
 * CombatEngine.applyExpGain 미러 (레벨업 루프)
 */
function applyExpGain(player, expGained = 0) {
    const p = { ...player, exp: (player.exp || 0) + expGained };
    const logs = [];
    let levelUps = 0;
    let visualEffect = null;

    while (p.level < MAX_LEVEL && p.exp >= p.nextExp) {
        p.exp -= p.nextExp;
        p.level += 1;
        p.nextExp = Math.floor(p.nextExp * BALANCE.EXP_SCALE_RATE);
        if (p.level >= 50) p.nextExp = Math.max(p.nextExp, BALANCE.EXP_LEVEL_CAP_50);
        p.maxHp += 20;
        p.maxMp += 10;
        p.hp = Math.min(p.hp + 20, p.maxHp);
        p.mp = Math.min(p.mp + 10, p.maxMp);
        p.atk += 2;
        p.def += 1;
        levelUps += 1;
        visualEffect = 'levelUp';
        logs.push({ type: 'system', text: `레벨업! Lv.${p.level}` });
    }

    if (p.level >= MAX_LEVEL) {
        p.exp = Math.min(p.exp, Math.max(0, p.nextExp - 1));
    }

    return { updatedPlayer: p, logs, leveledUp: levelUps > 0, levelUps, visualEffect };
}

/**
 * CombatEngine.attemptEscape 미러 (결정론적 버전)
 */
function attemptEscape(enemy, stats, roll) {
    const success = roll > BALANCE.ESCAPE_CHANCE;
    if (success) {
        return { success: true, damage: 0 };
    }
    const enemyDmg = Math.max(1, enemy.atk - stats.def);
    return { success: false, damage: enemyDmg };
}

// ── getElementMultiplier 테스트 ─────────────────────────────────────────────

test('getElementMultiplier: null/physical/none → 1 (중립)', () => {
    const enemy = { weakness: '불', resistance: '물' };
    assert.equal(getElementMultiplier(null, enemy), 1);
    assert.equal(getElementMultiplier('physical', enemy), 1);
    assert.equal(getElementMultiplier('none', enemy), 1);
});

test('getElementMultiplier: 약점 속성 → ELEMENT_WEAK_MULT (1.25)', () => {
    const enemy = { weakness: '불', resistance: '물' };
    assert.equal(getElementMultiplier('불', enemy), 1.25);
});

test('getElementMultiplier: 저항 속성 → ELEMENT_RESIST_MULT (0.75)', () => {
    const enemy = { weakness: '불', resistance: '물' };
    assert.equal(getElementMultiplier('물', enemy), 0.75);
});

test('getElementMultiplier: 약점도 저항도 아닌 속성 → 1', () => {
    const enemy = { weakness: '불', resistance: '물' };
    assert.equal(getElementMultiplier('번개', enemy), 1);
});

test('getElementMultiplier: enemy 없음 → 1', () => {
    assert.equal(getElementMultiplier('불', null), 1);
    assert.equal(getElementMultiplier('불', undefined), 1);
});

test('getElementMultiplier: enemy에 weakness/resistance 없음 → 1', () => {
    assert.equal(getElementMultiplier('불', {}), 1);
});

// ── calculateDamage 테스트 ──────────────────────────────────────────────────

test('calculateDamage: 기본 (non-crit, 분산 0) → atk * 0.9', () => {
    const result = calculateDamage({ atk: 100 }, {}, { randomValue: 0, critRoll: 1 });
    assert.equal(result.damage, Math.floor(100 * 0.9));
    assert.equal(result.isCrit, false);
});

test('calculateDamage: 분산 최대 (randomValue=1) → atk * (0.9 + 0.2)', () => {
    const result = calculateDamage({ atk: 100 }, {}, { randomValue: 1, critRoll: 1 });
    assert.equal(result.damage, Math.floor(100 * 1.1));
    assert.equal(result.isCrit, false);
});

test('calculateDamage: 크리티컬 → 데미지 2배', () => {
    const result = calculateDamage({ atk: 100 }, {}, { randomValue: 0, critRoll: 0 });
    assert.equal(result.damage, Math.floor(100 * 0.9) * 2);
    assert.equal(result.isCrit, true);
});

test('calculateDamage: guard → GUARD_DAMAGE_MULT (0.65) 적용', () => {
    const result = calculateDamage({ atk: 100 }, { guarding: true }, { randomValue: 0, critRoll: 1 });
    assert.equal(result.damage, Math.floor(100 * 0.9 * 0.65));
});

test('calculateDamage: 속성 배율 적용', () => {
    const result = calculateDamage({ atk: 100 }, { elementMultiplier: 1.25 }, { randomValue: 0, critRoll: 1 });
    assert.equal(result.damage, Math.floor(100 * 0.9 * 1.25));
});

test('calculateDamage: mult 배율 적용 (스킬 배율)', () => {
    const result = calculateDamage({ atk: 100 }, { mult: 1.5 }, { randomValue: 0, critRoll: 1 });
    assert.equal(result.damage, Math.floor(100 * 0.9 * 1.5));
});

test('calculateDamage: 모든 배율 복합 (guard + element + mult + crit)', () => {
    const result = calculateDamage(
        { atk: 100 },
        { guarding: true, elementMultiplier: 1.25, mult: 1.5 },
        { randomValue: 0, critRoll: 0 }
    );
    const base = Math.floor(100 * 0.9 * 1.5 * 0.65 * 1.25);
    assert.equal(result.damage, base * 2);
    assert.equal(result.isCrit, true);
});

test('calculateDamage: 최소 데미지 1 보장 (atk=0)', () => {
    const result = calculateDamage({ atk: 0 }, {}, { randomValue: 0, critRoll: 1 });
    assert.equal(result.damage, 1);
});

test('calculateDamage: critChance=0 → 절대 크리티컬 안 됨', () => {
    for (let i = 0; i < 50; i++) {
        const result = calculateDamage({ atk: 100 }, { critChance: 0 }, { randomValue: 0, critRoll: Math.random() });
        assert.equal(result.isCrit, false);
    }
});

test('calculateDamage: critChance=1 → 항상 크리티컬', () => {
    for (let i = 0; i < 50; i++) {
        const result = calculateDamage({ atk: 100 }, { critChance: 1 }, { randomValue: 0, critRoll: Math.random() });
        assert.equal(result.isCrit, true);
    }
});

// ── applyExpGain 테스트 ─────────────────────────────────────────────────────

test('applyExpGain: EXP 부족 → 레벨업 안 함', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 50);
    assert.equal(result.updatedPlayer.level, 1);
    assert.equal(result.updatedPlayer.exp, 50);
    assert.equal(result.leveledUp, false);
    assert.equal(result.levelUps, 0);
});

test('applyExpGain: 정확히 nextExp → 레벨업 1회', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 100);
    assert.equal(result.updatedPlayer.level, 2);
    assert.equal(result.leveledUp, true);
    assert.equal(result.levelUps, 1);
});

test('applyExpGain: 레벨업 시 스탯 증가 (+20 HP, +10 MP, +2 ATK, +1 DEF)', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 100, maxHp: 150, mp: 30, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 100);
    const p = result.updatedPlayer;
    assert.equal(p.maxHp, 170); // 150 + 20
    assert.equal(p.maxMp, 60);  // 50 + 10
    assert.equal(p.hp, 120);    // min(100 + 20, 170)
    assert.equal(p.mp, 40);     // min(30 + 10, 60)
    assert.equal(p.atk, 12);    // 10 + 2
    assert.equal(p.def, 6);     // 5 + 1
});

test('applyExpGain: 다중 레벨업 (EXP 충분할 때)', () => {
    const player = { level: 1, exp: 0, nextExp: 10, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 10000);
    assert.ok(result.updatedPlayer.level > 3, `다중 레벨업: ${result.updatedPlayer.level}`);
    assert.ok(result.levelUps > 2);
});

test('applyExpGain: nextExp 스케일링 (EXP_SCALE_RATE = 1.38)', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 100);
    assert.equal(result.updatedPlayer.nextExp, Math.floor(100 * 1.38));
});

test('applyExpGain: MAX_LEVEL(99) 캡', () => {
    const player = { level: 98, exp: 0, nextExp: 100, hp: 2000, maxHp: 2000, mp: 1000, maxMp: 1000, atk: 200, def: 100 };
    const result = applyExpGain(player, 500);
    assert.equal(result.updatedPlayer.level, 99);
    assert.equal(result.levelUps, 1);
    // MAX_LEVEL 도달 후 EXP는 nextExp-1 이하
    assert.ok(result.updatedPlayer.exp < result.updatedPlayer.nextExp);
});

test('applyExpGain: 이미 MAX_LEVEL → 레벨업 안 함', () => {
    const player = { level: 99, exp: 0, nextExp: 999999, hp: 2000, maxHp: 2000, mp: 1000, maxMp: 1000, atk: 200, def: 100 };
    const result = applyExpGain(player, 500000);
    assert.equal(result.updatedPlayer.level, 99);
    assert.equal(result.levelUps, 0);
});

test('applyExpGain: 레벨업 시 visualEffect = levelUp', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 100);
    assert.equal(result.visualEffect, 'levelUp');
});

test('applyExpGain: 레벨업 없으면 visualEffect = null', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 10);
    assert.equal(result.visualEffect, null);
});

test('applyExpGain: 원본 player 변이 없음', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    applyExpGain(player, 500);
    assert.equal(player.level, 1);
    assert.equal(player.exp, 0);
});

// ── attemptEscape 테스트 ────────────────────────────────────────────────────

test('attemptEscape: roll > 0.5 → 도주 성공', () => {
    const result = attemptEscape({ atk: 30 }, { def: 10 }, 0.8);
    assert.equal(result.success, true);
    assert.equal(result.damage, 0);
});

test('attemptEscape: roll <= 0.5 → 도주 실패 + 데미지', () => {
    const result = attemptEscape({ atk: 30 }, { def: 10 }, 0.3);
    assert.equal(result.success, false);
    assert.equal(result.damage, 20); // max(1, 30 - 10)
});

test('attemptEscape: 도주 실패 시 데미지 최소 1', () => {
    const result = attemptEscape({ atk: 5 }, { def: 100 }, 0.1);
    assert.equal(result.success, false);
    assert.equal(result.damage, 1);
});

test('attemptEscape: roll = 0.5 정확히 → 실패 (> 아닌 경우)', () => {
    const result = attemptEscape({ atk: 20 }, { def: 5 }, 0.5);
    assert.equal(result.success, false);
});
