import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * cycle 248: TITLES 정의 vs TITLE_PASSIVES 누락 dead config fix
 *   (cycle 222-247 silent dead config 시리즈 20번째).
 *
 * 발견 (TITLE_PASSIVES 누락 3종):
 * - 'void_conqueror' (허무의 정복자, 100 floor 도달): TITLES 정의 + 미패시브.
 * - 'abyss_legend'   (심연의 전설,   200 floor 도달): TITLES 정의 + 미패시브.
 * - 'void_sovereign' (공허의 군림자,  300 floor 도달): TITLES 정의 + 미패시브.
 * - 도전이 가장 어려운 abyss endgame 칭호 3종이 활성화해도 0 stat 보너스 — 광고 vs 보상 모순.
 * - getTitlePassive returns null → statsCalculator의 titlePassive.atk/def/hp/mp/crit 모두 0 적용.
 *
 * 패턴 (cycle 222-247 silent dead config 시리즈 20번째):
 * - cycle 247: skill branch desc-data 정합 fix (광고 vs 동작).
 * - cycle 248: TITLES vs TITLE_PASSIVES 정합 (정의 vs 보너스).
 *
 * 수정 (src/data/titles.ts):
 * - TITLE_PASSIVES에 void_conqueror / abyss_legend / void_sovereign 추가.
 * - 난이도 scaling: floor 100/200/300 ⇒ 점진 강화.
 *   - void_conqueror: ATK +3 · CRIT +2% · HP +20 (mid-high)
 *   - abyss_legend:   ATK +5 · CRIT +3% · HP +30 · DEF +2 (high)
 *   - void_sovereign: ATK +7 · CRIT +4% · HP +40 · DEF +3 · MP +20 (very high)
 *
 * 회귀 가드:
 * - 기존 TITLE_PASSIVES 32개 항목 변화 없음.
 * - TITLES 정의 변화 없음 (cond 그대로).
 */

test('cycle 248: void_conqueror 패시브 정의 (ATK/CRIT/HP)', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    const passive = TITLE_PASSIVES['void_conqueror'];
    assert.ok(passive, 'void_conqueror 패시브 존재');
    assert.equal(passive.atk, 3, `ATK +3 (실제: ${passive.atk})`);
    assert.equal(passive.crit, 0.02, `CRIT +2% (실제: ${passive.crit})`);
    assert.equal(passive.hp, 20, `HP +20 (실제: ${passive.hp})`);
    assert.ok(passive.label, 'label 존재');
});

test('cycle 248: abyss_legend 패시브 정의 (mid-high → high scaling)', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    const passive = TITLE_PASSIVES['abyss_legend'];
    assert.ok(passive, 'abyss_legend 패시브 존재');
    assert.equal(passive.atk, 5, `ATK +5 (실제: ${passive.atk})`);
    assert.equal(passive.crit, 0.03, `CRIT +3% (실제: ${passive.crit})`);
    assert.equal(passive.hp, 30, `HP +30 (실제: ${passive.hp})`);
    assert.equal(passive.def, 2, `DEF +2 (실제: ${passive.def})`);
});

test('cycle 248: void_sovereign 패시브 정의 (endgame top-tier)', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    const passive = TITLE_PASSIVES['void_sovereign'];
    assert.ok(passive, 'void_sovereign 패시브 존재');
    assert.equal(passive.atk, 7, `ATK +7 (실제: ${passive.atk})`);
    assert.equal(passive.crit, 0.04, `CRIT +4% (실제: ${passive.crit})`);
    assert.equal(passive.hp, 40, `HP +40 (실제: ${passive.hp})`);
    assert.equal(passive.def, 3, `DEF +3 (실제: ${passive.def})`);
    assert.equal(passive.mp, 20, `MP +20 (실제: ${passive.mp})`);
});

test('cycle 248: getTitlePassive 통합 — void_conqueror 활성 시 stats 합산', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const player = {
        name: 'Test', job: '전사', level: 50,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        equip: {}, relics: [], skillChoices: {}, titles: ['void_conqueror'],
        stats: {}, activeTitle: 'void_conqueror',
    };
    const stats = calculateFullStats(player);
    // base atk 50 + titlePassive.atk 3 = 53. relicBonus.atkFlat 0이라 수정 적용 후 53.
    assert.ok(stats.atk >= 53, `void_conqueror 활성 시 atk +3 (base 50 + 3 = 53, 실제: ${stats.atk})`);
    assert.ok(stats.maxHp >= 1020, `HP +20 적용 (base 1000 + 20, 실제: ${stats.maxHp})`);
});

test('cycle 248: TITLES 정의 변화 없음 (회귀 가드)', async () => {
    const { TITLES } = await import('../src/data/titles.js');
    const ids = TITLES.map((t) => t.id);
    assert.ok(ids.includes('void_conqueror'), 'void_conqueror TITLE 존재');
    assert.ok(ids.includes('abyss_legend'), 'abyss_legend TITLE 존재');
    assert.ok(ids.includes('void_sovereign'), 'void_sovereign TITLE 존재');
});

test('cycle 248: 기존 TITLE_PASSIVES 동작 유지 (회귀 가드)', async () => {
    const { TITLE_PASSIVES } = await import('../src/data/titles.js');
    // 대표 5종 sample 회귀 가드.
    assert.deepEqual(TITLE_PASSIVES['first_blood'], { atk: 1, label: 'ATK +1' });
    assert.equal(TITLE_PASSIVES['eternal'].hp, 50, 'eternal HP +50 유지');
    assert.equal(TITLE_PASSIVES['legend_chronicler'].atk, 4, 'legend_chronicler 동작 유지');
    assert.equal(TITLE_PASSIVES['cautious_explorer'].def, 1, 'cautious_explorer 동작 유지');
    assert.equal(TITLE_PASSIVES['에테르의 신'].hp, 60, '에테르의 신 (한국어 prestige) 유지');
});
