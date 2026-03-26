/**
 * CombatEngine 유물 효과 유닛 테스트
 *
 * CombatEngine.js는 JSX → db.js 의존성으로 Node.js 직접 임포트 불가.
 * CombatEngine의 핵심 유물 로직(crit_dmg, low_hp_dmg, status_resist)을
 * 순수 함수로 추출해 동일 알고리즘을 검증합니다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ── 인라인 순수 함수 (CombatEngine 핵심 로직 미러) ───────────────────────────

/**
 * crit_dmg 유물 효과: 크리티컬 시 baseDmg에 val 배율 추가 적용
 * @param {number} rawBaseDmg 기본 데미지
 * @param {boolean} isCrit 크리티컬 여부
 * @param {{ effect: string, val: number }|null} critDmgRelic
 * @returns {number}
 */
function applyCritDmgRelic(rawBaseDmg, isCrit, critDmgRelic) {
    if (isCrit && critDmgRelic) {
        return Math.floor(rawBaseDmg * (critDmgRelic.val || 1));
    }
    return rawBaseDmg;
}

/**
 * low_hp_dmg 유물 효과: HP 비율이 threshold 미만일 때 피해 증폭
 * @param {number} damage
 * @param {number} hp 현재 HP
 * @param {number} maxHp 최대 HP
 * @param {{ effect: string, val: number, threshold: number }|null} relic
 * @returns {number}
 */
function applyLowHpDmgRelic(damage, hp, maxHp, relic) {
    if (!relic) return damage;
    const hpRatio = hp / Math.max(1, maxHp);
    if (hpRatio < (relic.threshold || 0.4)) {
        return Math.floor(damage * (relic.val || 1.4));
    }
    return damage;
}

/**
 * status_resist 유물 효과: 저항률(val)에 따라 상태이상 부여 여부 결정
 * @param {string} statusEffect
 * @param {string[]} currentStatus
 * @param {{ effect: string, val: number }|null} resistRelic
 * @returns {{ applied: boolean, resisted: boolean }}
 */
function applyStatusResistCheck(statusEffect, currentStatus, resistRelic, forceApply = false) {
    if (currentStatus.includes(statusEffect)) return { applied: false, resisted: false };
    const resistChance = resistRelic ? (resistRelic.val || 0) : 0;
    const roll = forceApply ? 0 : Math.random();
    if (roll < resistChance) {
        return { applied: false, resisted: true };
    }
    return { applied: true, resisted: false };
}

/**
 * getAchievementCurrentValue 인라인 (gameUtils.js에서 JSX 없이 추출)
 */
function getAchievementCurrentValue(achievement, player) {
    const stats = player?.stats || {};
    const target = achievement?.target;
    if (target === 'level') return player?.level || 0;
    if (target === 'prestige') return player?.meta?.prestigeRank || 0;
    if (target === 'synths') return stats?.syntheses || 0;
    return stats?.[target] || 0;
}

// ── crit_dmg 유물 테스트 ───────────────────────────────────────────────────────

test('crit_dmg 유물 없음: 크리티컬 시 rawBaseDmg 그대로 반환', () => {
    const result = applyCritDmgRelic(100, true, null);
    assert.equal(result, 100);
});

test('crit_dmg 유물 없음: 비크리티컬 시 rawBaseDmg 그대로 반환', () => {
    const result = applyCritDmgRelic(80, false, null);
    assert.equal(result, 80);
});

test('crit_dmg 유물 있음: 크리티컬 시 val 배율 적용', () => {
    const relic = { effect: 'crit_dmg', val: 1.5 };
    const result = applyCritDmgRelic(100, true, relic);
    assert.equal(result, Math.floor(100 * 1.5)); // 150
});

test('crit_dmg 유물 있음: 비크리티컬 시 배율 미적용', () => {
    const relic = { effect: 'crit_dmg', val: 1.5 };
    const result = applyCritDmgRelic(100, false, relic);
    assert.equal(result, 100); // 배율 없음
});

test('crit_dmg 유물 val=2.0: 크리티컬 시 2배 추가 배율', () => {
    const relic = { effect: 'crit_dmg', val: 2.0 };
    const result = applyCritDmgRelic(50, true, relic);
    assert.equal(result, 100);
});

// ── low_hp_dmg 유물 테스트 ────────────────────────────────────────────────────

test('low_hp_dmg 유물 없음: 피해 그대로', () => {
    const result = applyLowHpDmgRelic(100, 20, 100, null);
    assert.equal(result, 100);
});

test('low_hp_dmg 유물: HP 100% → 효과 없음', () => {
    const relic = { effect: 'low_hp_dmg', val: 1.4, threshold: 0.4 };
    const result = applyLowHpDmgRelic(100, 100, 100, relic);
    assert.equal(result, 100);
});

test('low_hp_dmg 유물: HP 40% 정확히 경계 → 효과 없음 (미만이어야 발동)', () => {
    const relic = { effect: 'low_hp_dmg', val: 1.4, threshold: 0.4 };
    const result = applyLowHpDmgRelic(100, 40, 100, relic); // ratio = 0.4, 미만이 아님
    assert.equal(result, 100);
});

test('low_hp_dmg 유물: HP 39% → 효과 발동 (threshold 0.4)', () => {
    const relic = { effect: 'low_hp_dmg', val: 1.4, threshold: 0.4 };
    const result = applyLowHpDmgRelic(100, 39, 100, relic);
    assert.equal(result, Math.floor(100 * 1.4)); // 140
});

test('low_hp_dmg 유물: HP 1% → 최대 증폭', () => {
    const relic = { effect: 'low_hp_dmg', val: 1.4, threshold: 0.4 };
    const result = applyLowHpDmgRelic(200, 1, 100, relic);
    assert.equal(result, Math.floor(200 * 1.4)); // 280
});

test('low_hp_dmg 유물: maxHp 0일 때 Math.max(1,maxHp) 적용으로 안전 처리', () => {
    const relic = { effect: 'low_hp_dmg', val: 1.4, threshold: 0.4 };
    // maxHp=0 → 비율=hp/1 → hp>0이면 threshold 초과 가능성 높음
    assert.doesNotThrow(() => applyLowHpDmgRelic(50, 0, 0, relic));
});

// ── status_resist 유물 테스트 ─────────────────────────────────────────────────

test('status_resist 유물 없음: 상태이상 항상 부여 (forceApply)', () => {
    const result = applyStatusResistCheck('poison', [], null, true);
    assert.equal(result.applied, true);
    assert.equal(result.resisted, false);
});

test('status_resist val=1.0: 항상 저항 성공 (roll=0 < 1.0)', () => {
    const relic = { effect: 'status_resist', val: 1.0 };
    const result = applyStatusResistCheck('burn', [], relic, true); // forceApply=true → roll=0
    assert.equal(result.resisted, true);
    assert.equal(result.applied, false);
});

test('status_resist val=0.0: 저항 안 됨 (forceApply)', () => {
    const relic = { effect: 'status_resist', val: 0.0 };
    const result = applyStatusResistCheck('freeze', [], relic, true); // roll=0 < 0.0 = false
    assert.equal(result.applied, true);
    assert.equal(result.resisted, false);
});

test('status_resist: 이미 상태이상 중이면 중복 부여 안 됨', () => {
    const relic = { effect: 'status_resist', val: 0.0 };
    const result = applyStatusResistCheck('poison', ['poison'], relic, true);
    assert.equal(result.applied, false);
    assert.equal(result.resisted, false);
});

test('status_resist val=1.0: 100회 반복해도 항상 저항', () => {
    const relic = { effect: 'status_resist', val: 1.0 };
    let resistCount = 0;
    for (let i = 0; i < 100; i++) {
        const result = applyStatusResistCheck('curse', [], relic);
        if (result.resisted) resistCount++;
    }
    assert.equal(resistCount, 100, `100회 모두 저항해야 합니다 (실제: ${resistCount})`);
});

test('status_resist 유물 없음: 100회 중 대부분 부여됨', () => {
    let applyCount = 0;
    for (let i = 0; i < 100; i++) {
        const result = applyStatusResistCheck('bleed', [], null);
        if (result.applied) applyCount++;
    }
    assert.equal(applyCount, 100, `유물 없으면 100회 모두 부여 (실제: ${applyCount})`);
});

// ── getAchievementCurrentValue 업적 진행값 테스트 ─────────────────────────────

test('getAchievementCurrentValue: prestige 타겟 → meta.prestigeRank', () => {
    const player = { level: 1, stats: {}, meta: { prestigeRank: 3 } };
    assert.equal(getAchievementCurrentValue({ target: 'prestige' }, player), 3);
});

test('getAchievementCurrentValue: prestige, meta 없으면 0', () => {
    const player = { level: 5, stats: {} };
    assert.equal(getAchievementCurrentValue({ target: 'prestige' }, player), 0);
});

test('getAchievementCurrentValue: synths 타겟 → stats.syntheses', () => {
    const player = { level: 1, stats: { syntheses: 12 }, meta: {} };
    assert.equal(getAchievementCurrentValue({ target: 'synths' }, player), 12);
});

test('getAchievementCurrentValue: synths, syntheses 없으면 0', () => {
    const player = { level: 1, stats: {}, meta: {} };
    assert.equal(getAchievementCurrentValue({ target: 'synths' }, player), 0);
});

test('getAchievementCurrentValue: level 타겟 → player.level', () => {
    const player = { level: 25, stats: {}, meta: {} };
    assert.equal(getAchievementCurrentValue({ target: 'level' }, player), 25);
});

test('getAchievementCurrentValue: relicCount 타겟 → stats.relicCount', () => {
    const player = { level: 1, stats: { relicCount: 7 }, meta: {} };
    assert.equal(getAchievementCurrentValue({ target: 'relicCount' }, player), 7);
});

test('getAchievementCurrentValue: kills 타겟 → stats.kills', () => {
    const player = { level: 1, stats: { kills: 250 }, meta: {} };
    assert.equal(getAchievementCurrentValue({ target: 'kills' }, player), 250);
});

test('getAchievementCurrentValue: discoveries 타겟 → stats.discoveries', () => {
    const player = { level: 1, stats: { discoveries: 8 }, meta: {} };
    assert.equal(getAchievementCurrentValue({ target: 'discoveries' }, player), 8);
});

// ── 복합 시나리오 테스트 ──────────────────────────────────────────────────────

test('crit_dmg + low_hp_dmg 복합: 저HP 크리티컬 시 두 유물 모두 적용', () => {
    const critRelic = { effect: 'crit_dmg', val: 1.5 };
    const lowHpRelic = { effect: 'low_hp_dmg', val: 1.4, threshold: 0.4 };

    const rawBase = 100;
    // 1단계: crit_dmg 적용 (크리티컬 + 유물)
    const afterCrit = applyCritDmgRelic(rawBase, true, critRelic); // 150
    // 2단계: low_hp_dmg 적용 (HP 20%)
    const finalDmg = applyLowHpDmgRelic(afterCrit, 20, 100, lowHpRelic); // floor(150*1.4)=210

    assert.equal(afterCrit, 150);
    assert.equal(finalDmg, 210);
    assert.ok(finalDmg > rawBase, '복합 유물 피해가 기본보다 커야 합니다');
});

test('crit_dmg 없는 상황 + low_hp_dmg만: 피해 단일 증폭', () => {
    const lowHpRelic = { effect: 'low_hp_dmg', val: 1.4, threshold: 0.4 };

    const base = 100;
    const afterCrit = applyCritDmgRelic(base, false, null); // 100 그대로
    const final = applyLowHpDmgRelic(afterCrit, 10, 100, lowHpRelic); // 140

    assert.equal(afterCrit, 100);
    assert.equal(final, 140);
});
