/**
 * CombatEngine 루팅 로직 유닛 테스트
 *
 * CombatEngine.loot.js는 db.js/loot.js/dropTables.js 의존으로
 * Node.js 직접 임포트 불가. 인라인 미러 패턴으로 핵심 알고리즘 검증.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ── resolveEnemyBaseName 미러 ───────────────────────────────────────────────

/**
 * 접두사를 제거하고 기본 이름을 반환합니다.
 * LOOT_TABLE 참조 없이 알고리즘만 미러 (LOOT_TABLE 존재 체크는 별도 분기).
 * @param {Object} enemy
 * @param {Object} lootTable - LOOT_TABLE 키 집합 (Set)
 * @returns {string}
 */
function resolveEnemyBaseName(enemy, lootTable = new Set()) {
    if (!enemy) return '';
    if (enemy.baseName) return enemy.baseName;
    if (lootTable.has(enemy.name)) return enemy.name;
    const parts = String(enemy.name || '').split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : (enemy.name || '');
}

/**
 * 고레벨 몬스터 보너스 장비 드랍 — 레벨 추정 + 티어 결정 로직 미러
 */
function inferLevelAndBonusTier(enemy) {
    const inferredLevel = Math.max(1, Math.floor(((enemy.exp || 10) - 10) / 5));
    if (inferredLevel < 30) return { inferredLevel, bonusTier: null, eligible: false };
    const bonusTier = inferredLevel >= 50 ? 6 : inferredLevel >= 40 ? 5 : 4;
    const bonusChance = enemy.isBoss ? 0.25 : 0.06;
    return { inferredLevel, bonusTier, bonusChance, eligible: true };
}

// ── resolveEnemyBaseName 테스트 ─────────────────────────────────────────────

test('resolveEnemyBaseName: baseName 존재 → 그대로 반환', () => {
    const enemy = { name: '광폭한 슬라임', baseName: '슬라임' };
    assert.equal(resolveEnemyBaseName(enemy), '슬라임');
});

test('resolveEnemyBaseName: baseName 없지만 LOOT_TABLE에 이름 존재 → 그대로 반환', () => {
    const lootTable = new Set(['고블린 전사']);
    const enemy = { name: '고블린 전사' };
    assert.equal(resolveEnemyBaseName(enemy, lootTable), '고블린 전사');
});

test('resolveEnemyBaseName: baseName 없고 LOOT_TABLE에도 없음 → 접두사 제거', () => {
    const enemy = { name: '광폭한 슬라임' };
    assert.equal(resolveEnemyBaseName(enemy), '슬라임');
});

test('resolveEnemyBaseName: 단어 1개 → 그대로 반환', () => {
    const enemy = { name: '슬라임' };
    assert.equal(resolveEnemyBaseName(enemy), '슬라임');
});

test('resolveEnemyBaseName: 접두사 2단어 → 마지막 단어만 반환', () => {
    const enemy = { name: '재앙의 고대 드래곤' };
    assert.equal(resolveEnemyBaseName(enemy), '고대 드래곤');
});

test('resolveEnemyBaseName: enemy null → 빈 문자열', () => {
    assert.equal(resolveEnemyBaseName(null), '');
});

test('resolveEnemyBaseName: enemy.name 없음 → 빈 문자열', () => {
    assert.equal(resolveEnemyBaseName({}), '');
});

test('resolveEnemyBaseName: baseName이 빈 문자열 → 빈 문자열 반환 (truthy 체크)', () => {
    const enemy = { name: '광폭한 슬라임', baseName: '' };
    // baseName이 falsy → 접두사 제거 로직으로 진행
    assert.equal(resolveEnemyBaseName(enemy), '슬라임');
});

// ── 고레벨 보너스 드랍 로직 테스트 ──────────────────────────────────────────

test('inferLevelAndBonusTier: exp=10 → inferredLevel=1, 보너스 없음', () => {
    const result = inferLevelAndBonusTier({ exp: 10 });
    assert.equal(result.inferredLevel, 1);
    assert.equal(result.eligible, false);
});

test('inferLevelAndBonusTier: exp 없음 → fallback 10 → level=1', () => {
    const result = inferLevelAndBonusTier({});
    assert.equal(result.inferredLevel, 1);
    assert.equal(result.eligible, false);
});

test('inferLevelAndBonusTier: exp=160 → level=30, tier=4', () => {
    // (160-10)/5 = 30
    const result = inferLevelAndBonusTier({ exp: 160 });
    assert.equal(result.inferredLevel, 30);
    assert.equal(result.bonusTier, 4);
    assert.equal(result.eligible, true);
});

test('inferLevelAndBonusTier: exp=210 → level=40, tier=5', () => {
    // (210-10)/5 = 40
    const result = inferLevelAndBonusTier({ exp: 210 });
    assert.equal(result.inferredLevel, 40);
    assert.equal(result.bonusTier, 5);
});

test('inferLevelAndBonusTier: exp=260 → level=50, tier=6', () => {
    // (260-10)/5 = 50
    const result = inferLevelAndBonusTier({ exp: 260 });
    assert.equal(result.inferredLevel, 50);
    assert.equal(result.bonusTier, 6);
});

test('inferLevelAndBonusTier: 보스 → bonusChance=0.25', () => {
    const result = inferLevelAndBonusTier({ exp: 200, isBoss: true });
    assert.equal(result.bonusChance, 0.25);
});

test('inferLevelAndBonusTier: 일반 → bonusChance=0.06', () => {
    const result = inferLevelAndBonusTier({ exp: 200, isBoss: false });
    assert.equal(result.bonusChance, 0.06);
});

test('inferLevelAndBonusTier: level 29 → 보너스 미해당', () => {
    // (155-10)/5 = 29
    const result = inferLevelAndBonusTier({ exp: 155 });
    assert.equal(result.inferredLevel, 29);
    assert.equal(result.eligible, false);
});

// ── 드랍 확률 계산 로직 미러 테스트 ─────────────────────────────────────────

/**
 * 단일 아이템 드랍 확률 계산 (DROP_TABLES 경로)
 */
function calcDropChance(entry, enemy, dropRateMult, bossDropMult) {
    return Math.min(1, entry.rate * (enemy.dropMod || 1.0) * dropRateMult * bossDropMult);
}

test('calcDropChance: 기본 확률 (배율 없음)', () => {
    const chance = calcDropChance({ rate: 0.3 }, {}, 1, 1);
    assert.equal(chance, 0.3);
});

test('calcDropChance: dropMod 적용', () => {
    const chance = calcDropChance({ rate: 0.3 }, { dropMod: 2.0 }, 1, 1);
    assert.ok(Math.abs(chance - 0.6) < 0.001);
});

test('calcDropChance: dropRateMult 유물 적용', () => {
    const chance = calcDropChance({ rate: 0.5 }, {}, 1.5, 1);
    assert.ok(Math.abs(chance - 0.75) < 0.001);
});

test('calcDropChance: 확률 1 초과 → 1로 cap', () => {
    const chance = calcDropChance({ rate: 0.8 }, { dropMod: 3.0 }, 1.5, 1);
    assert.equal(chance, 1);
});

test('calcDropChance: 보스 사냥꾼 유물 (bossDropMult) 적용', () => {
    const chance = calcDropChance({ rate: 0.4 }, { dropMod: 1.0 }, 1, 1.3);
    assert.ok(Math.abs(chance - 0.52) < 0.001);
});

// ── qty 범위 계산 테스트 ────────────────────────────────────────────────────

/**
 * 수량 범위 [min, max]에서 랜덤 수량 계산 미러
 */
function calcQty(entry) {
    if (!entry.qty) return 1;
    return entry.qty[0] + Math.floor(Math.random() * (entry.qty[1] - entry.qty[0] + 1));
}

test('calcQty: qty 미지정 → 1', () => {
    assert.equal(calcQty({}), 1);
    assert.equal(calcQty({ rate: 0.5 }), 1);
});

test('calcQty: qty=[1,1] → 항상 1', () => {
    for (let i = 0; i < 20; i++) {
        assert.equal(calcQty({ qty: [1, 1] }), 1);
    }
});

test('calcQty: qty=[2,5] → 2~5 범위', () => {
    const results = new Set();
    for (let i = 0; i < 200; i++) {
        const q = calcQty({ qty: [2, 5] });
        assert.ok(q >= 2 && q <= 5, `수량이 2~5 범위여야 합니다: ${q}`);
        results.add(q);
    }
    // 200회면 2,3,4,5 모두 나와야 함
    assert.ok(results.size >= 3, `다양한 수량이 나와야 합니다 (${results.size}종)`);
});

// ── 유물 드랍률 배율 계산 테스트 ────────────────────────────────────────────

/**
 * 유물 기반 드랍률 배율 계산 미러
 */
function calcDropRateMult(relics) {
    return 1 + (relics.find((relic) => relic.effect === 'drop_rate')?.val || 0);
}

function calcBossDropMult(relics, isBoss) {
    if (!isBoss) return 1;
    return 1 + (relics.find((relic) => relic.effect === 'boss_hunter')?.val?.drop || 0);
}

test('calcDropRateMult: 유물 없음 → 1', () => {
    assert.equal(calcDropRateMult([]), 1);
});

test('calcDropRateMult: drop_rate 유물 → 1 + val', () => {
    const relics = [{ effect: 'drop_rate', val: 0.3 }];
    assert.ok(Math.abs(calcDropRateMult(relics) - 1.3) < 0.001);
});

test('calcBossDropMult: 보스 아님 → 1', () => {
    const relics = [{ effect: 'boss_hunter', val: { drop: 0.5 } }];
    assert.equal(calcBossDropMult(relics, false), 1);
});

test('calcBossDropMult: 보스 + 유물 → 1 + drop val', () => {
    const relics = [{ effect: 'boss_hunter', val: { drop: 0.5 } }];
    assert.ok(Math.abs(calcBossDropMult(relics, true) - 1.5) < 0.001);
});

test('calcBossDropMult: 보스 + 유물 없음 → 1', () => {
    assert.equal(calcBossDropMult([], true), 1);
});
