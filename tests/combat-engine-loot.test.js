/**
 * CombatEngine 루팅 로직 유닛 테스트
 *
 * Bonus tier는 production processLoot로 검증한다.
 * 아래 일부 오래된 확률/이름 helper 미러는 통합 검증을 대체하지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { processLoot } from '../src/systems/CombatEngine.loot.ts';
import { DROP_TABLES } from '../src/data/dropTables.ts';
import { LOOT_TABLE } from '../src/data/loot.ts';
import { MSG } from '../src/data/messages.ts';
import { getStrongestNumericRelicValue } from '../src/systems/CombatEngine.actions.ts';

function controlledRandom(rolls) {
    let calls = 0;
    const random = () => {
        if (calls >= rolls.length) {
            throw new Error(`controlled RNG exhausted at call ${calls}`);
        }
        const roll = rolls[calls];
        calls += 1;
        return roll;
    };
    Object.defineProperty(random, 'calls', { get: () => calls });
    return random;
}

function withTemporaryTableEntry(table, key, value, run) {
    const previous = table[key];
    table[key] = value;
    try {
        return run();
    } finally {
        if (previous === undefined) delete table[key];
        else table[key] = previous;
    }
}

function assertLootCandidateContract(result) {
    assert.deepEqual(result.items, result.candidates.map(({ item }) => item));
    assert.deepEqual(result.logs, result.candidates.flatMap(({ logs }) => logs));
    assert.equal(result.candidates.length, result.items.length);
    assert.ok(result.candidates.every(({ item, logs }) => item && Array.isArray(logs)));
}

function runLootFixtureTwice(enemy, player, rolls, expectedCalls) {
    const baselineRng = controlledRandom(rolls);
    const baseline = processLoot(enemy, player, 1, baselineRng, () => 1_700_000_000_000);
    const replayRng = controlledRandom(rolls);
    const result = processLoot(enemy, player, 1, replayRng, () => 1_700_000_000_000);

    assert.deepEqual(result, baseline);
    assert.deepEqual(result.items, baseline.items);
    assert.deepEqual(result.logs, baseline.logs);
    assert.equal(baselineRng.calls, expectedCalls);
    assert.equal(replayRng.calls, baselineRng.calls);
    assertLootCandidateContract(result);
    return result;
}

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

// Excluded legacy enemies have no trustworthy level/map provenance.
for (const [exp, tier] of [[undefined,null],[10,null],[155,null],[160,4],[210,5],[260,6]]) {
    test(`production legacy bonus: exp=${exp}, tier=${tier}`, () => {
        const result = processLoot({ name: 'legacy bonus fixture', baseName: 'legacy bonus fixture', exp }, null, 1, () => 0, () => 1);
        assert.equal(result.items.length, tier === null ? 0 : 1);
        if (tier !== null) assert.equal(result.items[0].tier, tier);
    });
}
for (const [isBoss, chance] of [[false,0.06],[true,0.25]]) {
    test(`production legacy bonus chance boundary: boss=${isBoss}`, () => {
        const enemy = { name: 'legacy bonus fixture', baseName: 'legacy bonus fixture', exp: 200, isBoss };
        assert.equal(processLoot(enemy, null, 1, () => chance, () => 1).items.length, 0);
        assert.equal(processLoot(enemy, null, 1, () => chance - 0.000001, () => 1).items.length, 1);
    });
}

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

// ── per-item loot provenance contract ──────────────────────────────────────

test('processLoot candidate provenance: enriched drops keep each item\'s logs', () => {
    const enemy = { name: '__loot_provenance_enriched__', dropMod: 1 };
    const rolls = [0, 0.25, 0, 0, 0, 0.5, 0.99];

    withTemporaryTableEntry(DROP_TABLES, enemy.name, [
        { item: '용살자의창', rate: 1 },
        { item: '대마법사로브', rate: 1 },
    ], () => {
        const result = runLootFixtureTwice(enemy, null, rolls, 7);
        const [prefixed, plain] = result.candidates;

        assert.equal(prefixed.item.prefixed, true);
        assert.deepEqual(prefixed.logs, [
            { type: 'success', text: MSG.LOOT_GET(prefixed.item.name) },
            { type: 'event', text: MSG.LOOT_PREFIX(prefixed.item.prefixName) },
        ]);
        assert.deepEqual(plain.logs, [
            { type: 'success', text: MSG.LOOT_GET(plain.item.name) },
        ]);
    });
});

test('processLoot candidate provenance: legacy drops keep each item\'s logs', () => {
    const enemy = { name: '__loot_provenance_legacy__', dropMod: 1 };
    const rolls = [0, 0.25, 0, 0, 0, 0.5, 0.99];

    withTemporaryTableEntry(LOOT_TABLE, enemy.name, [
        '용살자의창',
        '대마법사로브',
    ], () => {
        const result = runLootFixtureTwice(enemy, null, rolls, 7);
        const [prefixed, plain] = result.candidates;

        assert.equal(prefixed.item.prefixed, true);
        assert.deepEqual(prefixed.logs, [
            { type: 'success', text: MSG.LOOT_GET(prefixed.item.name) },
            { type: 'event', text: MSG.LOOT_PREFIX(prefixed.item.prefixName) },
        ]);
        assert.deepEqual(plain.logs, [
            { type: 'success', text: MSG.LOOT_GET(plain.item.name) },
        ]);
    });
});

test('processLoot candidate provenance: high-level bonus keeps its item log', () => {
    const enemy = { name: '__loot_provenance_high_level__', exp: 160, dropMod: 1 };
    const result = runLootFixtureTwice(enemy, null, [0, 0.25, 0.5, 0.99], 4);
    const [candidate] = result.candidates;

    assert.deepEqual(candidate.logs, [
        { type: 'success', text: MSG.LOOT_GET(candidate.item.name) },
    ]);
});

test('processLoot candidate provenance: prestige drop keeps rare-drop log separate', () => {
    const enemy = { name: '__loot_provenance_prestige__', isBoss: true, dropMod: 1 };
    const player = { meta: { prestigeRank: 3 } };
    const rolls = [0, 0.25, 0.99, 0, 0.5, 0.99];

    withTemporaryTableEntry(DROP_TABLES, enemy.name, [
        { item: '슬라임 젤리', rate: 1 },
    ], () => {
        const result = runLootFixtureTwice(enemy, player, rolls, 6);
        const [prestige, normal] = result.candidates;

        assert.deepEqual(prestige.logs, [
            { type: 'event', text: MSG.PRESTIGE_RARE_DROP(prestige.item.name) },
        ]);
        assert.deepEqual(normal.logs, [
            { type: 'success', text: MSG.LOOT_GET(normal.item.name) },
        ]);
    });
});

// ── 유물 드랍률 배율 계산 테스트 ────────────────────────────────────────────

function calcBossDropMult(relics, isBoss) {
    if (!isBoss) return 1;
    return 1 + (relics.find((relic) => relic.effect === 'boss_hunter')?.val?.drop || 0);
}

const luckyCoin = {
    id: 'lucky_coin',
    effect: 'drop_rate',
    val: 0.5,
};

const fortuneRelic = {
    id: 'fortune_relic',
    effect: 'drop_rate',
    val: 1.0,
};

test('production processLoot resolves drop_rate independently of relic inventory order', () => {
    const enemy = { name: '__drop_rate_controlled_enriched__', dropMod: 1 };
    DROP_TABLES[enemy.name] = [{ item: '슬라임 젤리', rate: 0.4 }];
    try {
        const roll = () => 0.7;
        const firstWeak = processLoot(enemy, { relics: [luckyCoin, fortuneRelic] }, 1, roll, () => 1);
        const firstStrong = processLoot(enemy, { relics: [fortuneRelic, luckyCoin] }, 1, roll, () => 1);

        assert.equal(firstStrong.items.length, 1);
        assert.equal(firstWeak.items.length, firstStrong.items.length);
        assert.deepEqual(firstWeak, firstStrong);
    } finally {
        delete DROP_TABLES[enemy.name];
    }
});

test('drop_rate: shared strongest selector has no matching relic → 0', () => {
    assert.equal(getStrongestNumericRelicValue([], 'drop_rate'), 0);
});

test('drop_rate: shared strongest selector chooses the greater matching value', () => {
    assert.equal(getStrongestNumericRelicValue([luckyCoin, fortuneRelic], 'drop_rate'), 1);
    assert.equal(getStrongestNumericRelicValue([fortuneRelic, luckyCoin], 'drop_rate'), 1);
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
