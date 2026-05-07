import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 279: stats 출력에서 3 dead 필드 cleanup (weaponHands / traitBonus / titlePassive)
 *   (cycle 222-278 silent dead config 시리즈 49번째 — cleanup lens 연속).
 *
 * 발견 (3 dead exposed 필드):
 * - calculateFullStats 반환 객체:
 *   weaponHands (line 403): preBuildStats.weaponHands를 그대로 expose.
 *   traitBonus (line 410): getTraitBonus 결과를 그대로 expose.
 *   titlePassive (line 411): getTitlePassive 결과를 그대로 expose.
 * - 3 필드 모두 statsCalculator 내부 계산용 (atk/def/critChance 산출에 사용)이지만
 *   stats 객체에 노출 후 외부 consumer 0건.
 * - traitProfile / activeSynergies 등 active exposed 필드는 dispatch됨 (cycle 269 등).
 *
 * 패턴 (cycle 222-278 silent dead config 시리즈 49번째):
 * - cycle 270: tactical 12 fields 제거 (struct dead fields).
 * - cycle 277: totalPrestige 3 dead 필드 제거.
 * - cycle 278: killStreakTier 단일 dead 필드 제거.
 * - cycle 279: stats 3 dead exposed 필드 제거 (cleanup lens 연속).
 *
 * 수정:
 * 1) src/utils/statsCalculator.ts: stats 반환 객체에서 weaponHands / traitBonus / titlePassive 제거.
 * 2) tests/stats-calculator.test.js: 필드 presence 체크 리스트 업데이트.
 *
 * 회귀 가드:
 * - 내부 계산용 변수 (titlePassive / traitBonus / preBuildStats.weaponHands) 동작 유지.
 * - 다른 stats 필드 (atk/def/maxHp/maxMp/critChance/elem/isMagic/activeSet/activeSignatureSet/
 *   relics/buildProfile/traitProfile/activeSynergies/killStreak/passiveGoldMult/passiveExpMult/
 *   jobAffinity) 모두 dispatch 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 279: stats 반환에서 3 dead 필드 제거', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        equip: {}, relics: [], skillChoices: {}, titles: [], stats: {},
    };
    const stats = calculateFullStats(player);
    assert.equal(stats.weaponHands, undefined, 'weaponHands 제거됨');
    assert.equal(stats.traitBonus, undefined, 'traitBonus 제거됨');
    assert.equal(stats.titlePassive, undefined, 'titlePassive 제거됨');
});

test('cycle 279: active stats 필드 보존 (회귀 가드)', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        equip: {}, relics: [], skillChoices: {}, titles: [], stats: {},
    };
    const stats = calculateFullStats(player);
    const activeFields = [
        'atk', 'def', 'maxHp', 'maxMp', 'elem', 'isMagic', 'critChance',
        'activeSet', 'activeSignatureSet', 'relics', 'buildProfile', 'traitProfile',
        'activeSynergies', 'killStreak', 'passiveGoldMult', 'passiveExpMult', 'jobAffinity',
    ];
    activeFields.forEach((field) => {
        assert.ok(field in stats, `active field '${field}' 유지`);
    });
});

test('cycle 279: 내부 계산 동작 유지 (atk/def/critChance 정확)', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const playerWithTitle = {
        name: 'Test', job: '전사', level: 50,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        equip: {}, relics: [], skillChoices: {}, titles: ['first_blood'], activeTitle: 'first_blood',
        stats: {},
    };
    const stats = calculateFullStats(playerWithTitle);
    // titlePassive 'first_blood' = atk +1 — 내부 적용 (stats.atk에 합산).
    assert.ok(stats.atk > 50, `titlePassive 내부 atk 합산 (실제: ${stats.atk})`);
});

test('cycle 278 회귀 가드: killStreakTier 0건 유지', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(!/^\s*killStreakTier:/m.test(source),
        'cycle 278 killStreakTier 제거 유지');
});
