/**
 * CombatEngine 핵심 로직 유닛 테스트
 *
 * CombatEngine.js는 JSX → db.js 의존성으로 Node.js 직접 임포트 불가.
 * 인라인 미러 패턴으로 핵심 순수 함수 알고리즘을 검증합니다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ── BALANCE 상수 미러 (src/data/constants.js 에서 복사) ───────────────────────
const BALANCE = {
    CRIT_CHANCE: 0.1,
    ESCAPE_CHANCE: 0.5,
    ELEMENT_WEAK_MULT: 1.25,
    ELEMENT_RESIST_MULT: 0.75,
    GUARD_DAMAGE_MULT: 0.65,
    DAMAGE_BASE_RATIO: 0.9,
    DAMAGE_VARIANCE: 0.2,
    EXP_SCALE_RATE: 1.15,              // 실제값: 완화된 스케일 (1.20 → 1.15)
    EXP_LEVEL_HARD_CAP: 150000,        // 레벨당 최대 EXP 상한선 (300K → 150K)
    HP_PER_LEVEL: 20,
    MP_PER_LEVEL: 10,
    ATK_PER_LEVEL: 2,
    DEF_PER_LEVEL: 1,
    LEVEL_MILESTONE_EVERY: 5,          // N레벨마다 골드 보너스
    LEVEL_MAJOR_MILESTONE_EVERY: 10,   // N레벨마다 스탯 보너스
    MILESTONE_GOLD_PER_LV: 60,
    MILESTONE_STAT_HP: 25,
    MILESTONE_STAT_MP: 12,
    MILESTONE_STAT_ATK: 4,
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
 * CombatEngine.applyExpGain 미러 (레벨업 루프 + 마일스톤)
 */
function applyExpGain(player, expGained = 0) {
    const p = { ...player, exp: (player.exp || 0) + expGained };
    const logs = [];
    let levelUps = 0;
    let visualEffect = null;

    while (p.level < MAX_LEVEL && p.exp >= p.nextExp) {
        p.exp -= p.nextExp;
        p.level += 1;
        p.nextExp = Math.min(
            Math.floor(p.nextExp * BALANCE.EXP_SCALE_RATE),
            BALANCE.EXP_LEVEL_HARD_CAP
        );
        p.maxHp += BALANCE.HP_PER_LEVEL;
        p.maxMp += BALANCE.MP_PER_LEVEL;
        p.hp = Math.min(p.hp + BALANCE.HP_PER_LEVEL, p.maxHp);
        p.mp = Math.min(p.mp + BALANCE.MP_PER_LEVEL, p.maxMp);
        p.atk += BALANCE.ATK_PER_LEVEL;
        p.def += BALANCE.DEF_PER_LEVEL;
        levelUps += 1;
        visualEffect = 'levelUp';
        logs.push({ type: 'system', text: `레벨업! Lv.${p.level}` });

        // 레벨 마일스톤 보상 (CombatEngine.applyExpGain 동일 로직)
        const isMajor = p.level % BALANCE.LEVEL_MAJOR_MILESTONE_EVERY === 0;
        const isMinor = !isMajor && p.level % BALANCE.LEVEL_MILESTONE_EVERY === 0;
        if (isMajor) {
            p.atk += BALANCE.MILESTONE_STAT_ATK;
            p.maxHp += BALANCE.MILESTONE_STAT_HP;
            p.hp = Math.min(p.hp + BALANCE.MILESTONE_STAT_HP, p.maxHp);
            p.maxMp += BALANCE.MILESTONE_STAT_MP;
            p.mp = Math.min(p.mp + BALANCE.MILESTONE_STAT_MP, p.maxMp);
            logs.push({ type: 'event', text: `메이저 마일스톤 Lv.${p.level}` });
        } else if (isMinor) {
            const goldBonus = p.level * BALANCE.MILESTONE_GOLD_PER_LV;
            p.gold = (p.gold || 0) + goldBonus;
            logs.push({ type: 'event', text: `마일스톤 Lv.${p.level} 골드 +${goldBonus}` });
        }
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

test('applyExpGain: nextExp 스케일링 (EXP_SCALE_RATE = 1.15)', () => {
    const player = { level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 100);
    assert.equal(result.updatedPlayer.nextExp, Math.floor(100 * BALANCE.EXP_SCALE_RATE));
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

// ── 레벨 마일스톤 보상 테스트 ───────────────────────────────────────────────

test('applyExpGain: Lv.5 마일스톤 → 골드 보상 획득 (5 * MILESTONE_GOLD_PER_LV)', () => {
    // Lv.4 → Lv.5: minor 마일스톤, gold 지급
    const player = { level: 4, exp: 0, nextExp: 10, gold: 0, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 10);
    const p = result.updatedPlayer;
    assert.equal(p.level, 5);
    const expectedGold = 5 * BALANCE.MILESTONE_GOLD_PER_LV; // 300
    assert.equal(p.gold, expectedGold, `Lv.5 마일스톤 골드 ${expectedGold} 기대 (실제: ${p.gold})`);
});

test('applyExpGain: Lv.10 메이저 마일스톤 → ATK/HP/MP 추가 보너스, 골드 없음', () => {
    // Lv.9 → Lv.10: major 마일스톤
    const player = { level: 9, exp: 0, nextExp: 10, gold: 500, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 10);
    const p = result.updatedPlayer;
    assert.equal(p.level, 10);
    // 레벨업 기본 스탯 + 메이저 마일스톤 스탯
    assert.equal(p.atk, player.atk + BALANCE.ATK_PER_LEVEL + BALANCE.MILESTONE_STAT_ATK);
    assert.equal(p.maxHp, player.maxHp + BALANCE.HP_PER_LEVEL + BALANCE.MILESTONE_STAT_HP);
    assert.equal(p.maxMp, player.maxMp + BALANCE.MP_PER_LEVEL + BALANCE.MILESTONE_STAT_MP);
    // 메이저 마일스톤은 골드 미지급
    assert.equal(p.gold, 500, 'Lv.10 메이저 마일스톤은 골드 지급 없음');
});

test('applyExpGain: Lv.10 메이저 마일스톤에서 Lv.5 골드 마일스톤과 중복되지 않음', () => {
    // Lv.10은 major이므로 isMinor=false, 골드 지급 없음
    const player = { level: 9, exp: 0, nextExp: 10, gold: 0, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 10);
    const p = result.updatedPlayer;
    assert.equal(p.gold, 0, '10레벨 메이저 마일스톤은 골드 지급 없어야 함 (5의 배수 골드 중복 없음)');
});

test('applyExpGain: Lv.15 마일스톤 → 골드만 보상 (15 * MILESTONE_GOLD_PER_LV)', () => {
    // Lv.14 → Lv.15: minor 마일스톤 (15 % 5 == 0, 15 % 10 != 0)
    const player = { level: 14, exp: 0, nextExp: 10, gold: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, 10);
    const p = result.updatedPlayer;
    assert.equal(p.level, 15);
    const expectedGold = 100 + (15 * BALANCE.MILESTONE_GOLD_PER_LV); // 100 + 900
    assert.equal(p.gold, expectedGold);
});

test('applyExpGain: nextExp는 EXP_LEVEL_HARD_CAP을 초과하지 않음', () => {
    // nextExp가 매우 클 때 하드캡 적용 확인
    const player = { level: 1, exp: 0, nextExp: BALANCE.EXP_LEVEL_HARD_CAP, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5 };
    const result = applyExpGain(player, BALANCE.EXP_LEVEL_HARD_CAP);
    const nextExp = result.updatedPlayer.nextExp;
    assert.ok(nextExp <= BALANCE.EXP_LEVEL_HARD_CAP, `nextExp ${nextExp}가 하드캡 ${BALANCE.EXP_LEVEL_HARD_CAP}을 초과함`);
});

// ── calculateDamage 범위 안전성 추가 테스트 ─────────────────────────────────

test('calculateDamage: guarding + 크리티컬 복합 시 guard 감소가 크리티컬 2배 적용 전에 처리됨', () => {
    // baseDamage = floor(100 * 0.9 * 0.65) = floor(58.5) = 58
    // crit: 58 * 2 = 116
    const result = calculateDamage({ atk: 100 }, { guarding: true }, { randomValue: 0, critRoll: 0 });
    const expectedBase = Math.floor(100 * BALANCE.DAMAGE_BASE_RATIO * BALANCE.GUARD_DAMAGE_MULT);
    assert.equal(result.damage, expectedBase * 2);
    assert.equal(result.isCrit, true);
});

test('calculateDamage: 속성 저항 적용 시 데미지가 일반보다 낮음', () => {
    const normal = calculateDamage({ atk: 100 }, {}, { randomValue: 0, critRoll: 1 });
    const resist = calculateDamage({ atk: 100 }, { elementMultiplier: BALANCE.ELEMENT_RESIST_MULT }, { randomValue: 0, critRoll: 1 });
    assert.ok(resist.damage < normal.damage, `저항 데미지 ${resist.damage} < 일반 ${normal.damage}`);
});

// ── getElementMultiplier 추가 엣지 케이스 ────────────────────────────────────

test('getElementMultiplier: weakness와 resistance가 모두 같은 속성인 경우 weakness 우선', () => {
    // weakness가 resistance보다 먼저 체크됨
    const enemy = { weakness: 'fire', resistance: 'fire' };
    const result = getElementMultiplier('fire', enemy);
    assert.equal(result, BALANCE.ELEMENT_WEAK_MULT, 'weakness가 resistance보다 우선 처리');
});
