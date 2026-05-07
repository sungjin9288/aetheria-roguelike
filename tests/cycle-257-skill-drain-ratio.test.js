import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 257: skill drain effect의 desc-data 모순 + drainRatio dispatch 누락
 *   (cycle 222-256 silent dead config 시리즈 29번째).
 *
 * 발견 (drain ratio hardcoded vs desc 광고):
 * - CombatEngine performSkill drain section (line 919-923): drainHeal = totalDamage * 0.25 (25% 고정).
 * - 그러나 데이터 desc는 30% / 35% 광고:
 *   - '혼의 흡수' (effect: 'drain', mp 30, mult 1.8): desc "피해의 30% HP 회복".
 *   - '흡혈의 낫' branch B (override: { mult 2.5, effect: 'drain' }): desc "피해의 35% HP 흡수".
 * - 결과: 광고된 30% / 35%가 실제는 25% — 차별화된 흡혈 강도 밸런싱 의도가 무력.
 *
 * 패턴 (cycle 222-256 silent dead config 시리즈 29번째):
 * - cycle 247: skill branch override desc-data 정합 (2건 데이터 fix).
 * - cycle 257: skill drain ratio dispatch + 데이터 정합 (코드 + 데이터 paired fix).
 *
 * 수정:
 * 1) src/systems/CombatEngine.ts: drain 분기에 skill.drainRatio 우선 read (default 0.25).
 * 2) src/data/classes.ts:
 *    - '혼의 흡수' skill에 drainRatio: 0.30 추가.
 *    - '흡혈의 낫' branch override에 drainRatio: 0.35 추가.
 *
 * 회귀 가드:
 * - skill.drainRatio 미정의 시 기본 0.25 (생명흡수 같은 기존 drain skills 동작 유지).
 * - 다른 effect 분기 (drain 외) 영향 없음.
 */

const makePlayer = () => ({
    name: 'Test', job: '전사', level: 30,
    hp: 500, maxHp: 1000, mp: 200, maxMp: 200,
    atk: 100, def: 30,
    relics: [], skillChoices: {}, titles: [], equip: {},
    combatFlags: {}, status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
});

const makeEnemy = () => ({ name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 });
const makeStats = () => ({ atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 });

test('cycle 257: skill.drainRatio 0.30 시 30% 흡수', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'drain', drainRatio: 0.30, cooldown: 0 };
    const stats = makeStats();
    const before = player.hp;

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    const damage = enemy.hp - r.updatedEnemy.hp;
    const expectedHeal = Math.floor(damage * 0.30);
    const actualHeal = r.updatedPlayer.hp - before;

    assert.equal(actualHeal, expectedHeal,
        `drainRatio 0.30 시 ${expectedHeal} 흡수 (실제: ${actualHeal})`);
});

test('cycle 257: skill.drainRatio 0.35 시 35% 흡수', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'drain', drainRatio: 0.35, cooldown: 0 };
    const stats = makeStats();
    const before = player.hp;

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    const damage = enemy.hp - r.updatedEnemy.hp;
    const expectedHeal = Math.floor(damage * 0.35);
    const actualHeal = r.updatedPlayer.hp - before;

    assert.equal(actualHeal, expectedHeal,
        `drainRatio 0.35 시 ${expectedHeal} 흡수 (실제: ${actualHeal})`);
});

test('cycle 257: skill.drainRatio 미정의 시 default 0.25 (회귀 가드)', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'drain', cooldown: 0 };
    const stats = makeStats();
    const before = player.hp;

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    const damage = enemy.hp - r.updatedEnemy.hp;
    const expectedHeal = Math.floor(damage * 0.25);
    const actualHeal = r.updatedPlayer.hp - before;

    assert.equal(actualHeal, expectedHeal,
        `drainRatio 미정의 시 default 0.25 (실제: ${actualHeal} == ${expectedHeal})`);
});

test('cycle 257: 혼의 흡수 skill 데이터에 drainRatio: 0.30 정의', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    // '혼의 흡수' is in 무당 class skills.
    const shaman = CLASSES['무당'];
    const drainSkill = shaman.skills.find((s) => s.name === '혼의 흡수');
    assert.ok(drainSkill, "'혼의 흡수' skill 존재");
    assert.equal(drainSkill.drainRatio, 0.30,
        `drainRatio 0.30 (desc "피해의 30% HP 회복" 정합, 실제: ${drainSkill.drainRatio})`);
});

test('cycle 257: 흡혈의 낫 branch override에 drainRatio: 0.35 정의', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    // '죽음의 낫' branches in 무당 class.
    const shaman = CLASSES['무당'];
    const branchB = shaman.skillBranches['죽음의 낫'].find((b) => b.choice === 'B');
    assert.ok(branchB, "'흡혈의 낫' branch B 존재");
    assert.equal(branchB.label, '흡혈의 낫');
    assert.equal(branchB.override.drainRatio, 0.35,
        `branch override drainRatio 0.35 (desc "피해의 35% HP 흡수" 정합, 실제: ${branchB.override.drainRatio})`);
});

test('cycle 257: 다른 effect (drain 외) 영향 없음 (회귀 가드)', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    // drainRatio 정의되어도 effect != 'drain'이면 무시.
    const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'burn', drainRatio: 0.50, cooldown: 0 };
    const stats = makeStats();
    const before = player.hp;

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    const actualHeal = r.updatedPlayer.hp - before;
    assert.equal(actualHeal, 0, 'effect=burn 시 drainRatio 무시 (회귀 가드)');
});
