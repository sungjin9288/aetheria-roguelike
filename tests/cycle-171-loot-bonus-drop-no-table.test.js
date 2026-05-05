import test from 'node:test';
import assert from 'node:assert/strict';

import { processLoot } from '../src/systems/CombatEngine.loot.js';
import { LOOT_TABLE } from '../src/data/loot.js';
import { DROP_TABLES } from '../src/data/dropTables.js';

/**
 * cycle 171: loot.ts early-return 버그 fix — drop/loot 테이블 없는 enemy도
 * inferredLevel >= 30이면 보너스 장비 드랍 발동되도록.
 *
 * 발견:
 * - processLoot가 line 71에서 lootList 미존재(null/빈 배열) 시 early return
 *   하던 회귀. 그 아래 line 89-105에 inferredLevel >= LOOT_BONUS_MIN_LEVEL(=30)
 *   이면 tier 4-6 장비 보너스 드랍 로직이 있는데, lootList 없으면 영원히 fire
 *   안 함.
 * - 결과: 104종 non-boss monster (drop/loot 둘 다 미등록)가 inferredLevel
 *   기준 한참 넘는 고레벨 enemy여도 아이템 드롭 0건. 플레이어 입장에서 "강해
 *   보이는데 빈손" 회귀.
 *
 * 수정:
 * - lootList 분기를 if-block으로 변경 → early return 제거.
 * - 보너스 드랍 로직이 lootList 유/무 관계없이 항상 실행되도록.
 */

// 테스트용 고레벨 enemy stub — exp 200 (inferredLevel = (200-10)/5 = 38, >= 30).
const makeHighLvEnemy = (name) => ({
    name,
    baseName: name,
    hp: 0,
    maxHp: 1000,
    atk: 100,
    def: 50,
    exp: 200,
    gold: 100,
    isBoss: false,
});

// drop/loot 둘 다 없는 monster 이름 선택 — '폭풍 수호자' 등.
const NO_TABLE_MONSTER = '폭풍 수호자';

test('cycle 171 RED→GREEN: drop/loot 없는 고레벨 enemy도 보너스 드랍 발동 가능', () => {
    // 보장: 이 monster가 정말 두 테이블 모두에 없음.
    assert.ok(!DROP_TABLES[NO_TABLE_MONSTER], 'precondition: 드랍 테이블 없음');
    assert.ok(!LOOT_TABLE[NO_TABLE_MONSTER], 'precondition: 루트 테이블 없음');

    // Math.random을 stub해 보너스 chance 통과 보장.
    const orig = Math.random;
    Math.random = () => 0.0;  // 모든 chance roll 통과
    try {
        const enemy = makeHighLvEnemy(NO_TABLE_MONSTER);
        const result = processLoot(enemy);
        // bonus chance는 LOOT_NORMAL_BONUS_CHANCE * dropRateMult(=1) * bossDropMult(=1).
        // Math.random 0.0이면 bonusChance > 0이면 발동 → items 1+ 보장.
        assert.ok(result.items.length >= 1,
            `expected bonus drop for high-level no-table enemy; got ${result.items.length} items`);
    } finally {
        Math.random = orig;
    }
});

test('cycle 171: drop/loot 없는 저레벨 enemy는 여전히 빈 드롭 (회귀 가드)', () => {
    const orig = Math.random;
    Math.random = () => 0.0;
    try {
        const enemy = {
            name: NO_TABLE_MONSTER,
            baseName: NO_TABLE_MONSTER,
            hp: 0,
            maxHp: 100,
            atk: 10,
            def: 5,
            exp: 20,  // inferredLevel = (20-10)/5 = 2, < 30
            gold: 10,
            isBoss: false,
        };
        const result = processLoot(enemy);
        assert.equal(result.items.length, 0,
            '저레벨(inferredLevel < 30)은 보너스 드랍 발동 안 함');
    } finally {
        Math.random = orig;
    }
});

test('cycle 171: drop table 있는 enemy 회귀 가드 — 정상 드랍 동작', () => {
    const orig = Math.random;
    Math.random = () => 0.0;
    try {
        // 슬라임은 drop table 보유.
        const enemy = {
            name: '슬라임',
            baseName: '슬라임',
            hp: 0,
            maxHp: 30,
            atk: 5,
            def: 2,
            exp: 5,
            gold: 5,
            isBoss: false,
        };
        const result = processLoot(enemy);
        // 슬라임 drop table에 슬라임 젤리(rate 0.55) + 하급 체력 물약(rate 0.2).
        assert.ok(result.items.length >= 1, '슬라임 drop table 정상 fire');
    } finally {
        Math.random = orig;
    }
});
