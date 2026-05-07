import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * cycle 264: 방패 강화(enhance) DEF 기여 누락 dead config
 *   (cycle 222-263 silent dead config 시리즈 35번째).
 *
 * 발견 (statsCalculator computeEnhanceBonus):
 * - ENHANCE_ITEM 핸들러는 weapon / armor / offhand(shield 포함) 3 슬롯 모두 enhance 카운터 +1.
 * - 그러나 src/utils/statsCalculator.ts computeEnhanceBonus (line 195-208):
 *   - atk = weapon.enhance × val + offhand.enhance × val × 0.5 (dual-wield 가정).
 *   - def = armor.enhance × val 만 적용.
 * - 결과: 방패(offhand shield) 강화 시 enhance 카운터는 올라가지만 stat 보너스 0.
 *   shield val 14 +5 강화 → +3 ~ +5 def 의도지만 실제 +0. 강화 비용 (gold + 재료) 낭비.
 *
 * 추가 발견:
 * - 방패가 offhand에 장착되면 atk 계산 (line 204)에 shield.val × 0.5 추가됨 — 잘못된
 *   atk 보너스. shields는 atk 보너스 X.
 *
 * 패턴 (cycle 222-263 silent dead config 시리즈 35번째):
 * - cycle 224/225: equipment mp/hp bonus dispatch 누락 fix.
 * - cycle 226: armor evasion dispatch.
 * - cycle 264: shield enhance def bonus dispatch (paired equipment field 누락).
 *
 * 수정 (src/utils/statsCalculator.ts computeEnhanceBonus):
 * - isShield import 추가.
 * - offhand이 shield인 경우 def에 enhance × val 가산, atk 가산 제외.
 * - offhand이 weapon인 경우 기존 atk × 0.5 dual-wield 동작 유지.
 *
 * 회귀 가드:
 * - weapon enhance atk 동작 유지.
 * - armor enhance def 동작 유지.
 * - offhand weapon enhance atk × 0.5 동작 유지.
 * - 모든 enhance 0 시 stat boost 0.
 */

test('cycle 264: 방패 enhance가 def 보너스 추가', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const player = {
        name: 'Test', job: '나이트', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        relics: [], skillChoices: {}, titles: [], stats: {},
        equip: {
            weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
            armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
            offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 5 },
        },
    };
    const noShieldEnhance = calculateFullStats({
        ...player,
        equip: { ...player.equip, offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 0 } },
    });
    const withShieldEnhance = calculateFullStats(player);
    // shield enhance 5 → val 14 * 0.04 * 5 = 2.8 → floor 2 def 추가 (BALANCE.ENHANCE_STAT_BONUS = 0.04).
    assert.ok(withShieldEnhance.def > noShieldEnhance.def,
        `방패 enhance 5 → def 증가 (no enhance ${noShieldEnhance.def} vs enhance ${withShieldEnhance.def})`);
});

test('cycle 264: 방패 enhance가 atk 보너스 추가하지 않음 (회귀 가드)', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const playerNoEnhance = {
        name: 'Test', job: '나이트', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        relics: [], skillChoices: {}, titles: [], stats: {},
        equip: {
            weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
            armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
            offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 0 },
        },
    };
    const playerWithShieldEnhance = {
        ...playerNoEnhance,
        equip: {
            ...playerNoEnhance.equip,
            offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 10 },
        },
    };
    const statsA = calculateFullStats(playerNoEnhance);
    const statsB = calculateFullStats(playerWithShieldEnhance);
    // shield enhance는 atk 변화 X.
    assert.equal(statsA.atk, statsB.atk,
        `shield enhance가 atk에 영향 없음 (실제: A ${statsA.atk} == B ${statsB.atk})`);
});

test('cycle 264: 무기 enhance atk 기여 회귀 가드', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const playerA = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        relics: [], skillChoices: {}, titles: [], stats: {},
        equip: {
            weapon: { type: 'weapon', name: 'Test Sword', val: 100, enhance: 0 },
            armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
        },
    };
    const playerB = {
        ...playerA,
        equip: { ...playerA.equip, weapon: { type: 'weapon', name: 'Test Sword', val: 100, enhance: 5 } },
    };
    const statsA = calculateFullStats(playerA);
    const statsB = calculateFullStats(playerB);
    assert.ok(statsB.atk > statsA.atk,
        `무기 enhance 5 → atk 증가 (cycle 264 회귀 가드, A ${statsA.atk} vs B ${statsB.atk})`);
});

test('cycle 264: 갑옷 enhance def 기여 회귀 가드', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const playerA = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        relics: [], skillChoices: {}, titles: [], stats: {},
        equip: {
            weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
            armor: { type: 'armor', name: 'Test Armor', val: 30, enhance: 0 },
        },
    };
    const playerB = {
        ...playerA,
        equip: { ...playerA.equip, armor: { type: 'armor', name: 'Test Armor', val: 30, enhance: 5 } },
    };
    const statsA = calculateFullStats(playerA);
    const statsB = calculateFullStats(playerB);
    assert.ok(statsB.def > statsA.def,
        `갑옷 enhance 5 → def 증가 (회귀 가드, A ${statsA.def} vs B ${statsB.def})`);
});

test('cycle 264: 듀얼 무기 (offhand weapon) enhance atk 회귀 가드', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const playerA = {
        name: 'Test', job: '도적', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        relics: [], skillChoices: {}, titles: [], stats: {},
        equip: {
            weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
            armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
            offhand: { type: 'weapon', name: 'Test Dagger', val: 30, enhance: 0 },
        },
    };
    const playerB = {
        ...playerA,
        equip: { ...playerA.equip, offhand: { type: 'weapon', name: 'Test Dagger', val: 30, enhance: 5 } },
    };
    const statsA = calculateFullStats(playerA);
    const statsB = calculateFullStats(playerB);
    assert.ok(statsB.atk > statsA.atk,
        `offhand weapon enhance 5 → atk 증가 (회귀 가드, A ${statsA.atk} vs B ${statsB.atk})`);
});
