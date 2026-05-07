import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 258: '강화 흡수' branch A의 drainRatio 누락 (cycle 257 paired completion)
 *   (cycle 222-257 silent dead config 시리즈 30번째).
 *
 * 발견 (cycle 257 paired data audit):
 * - cycle 257에서 drainRatio dispatch + '혼의 흡수'/'흡혈의 낫' 데이터 정합 fix.
 * - 잔존: 흑마법사 '생명흡수' branch A = '강화 흡수' (override: { mult: 3.9 }).
 *   - desc: "데미지 및 흡수량 +30%" — damage *1.3 + 흡수량 *1.3 의도.
 *   - mult 3.0 → 3.9 (damage +30% 정합).
 *   - 그러나 drainRatio 누락 → default 0.25 그대로, "흡수량 +30%" desc는 무력.
 * - 결과: '강화 흡수' branch가 데미지만 +30% 받고 흡수량 보너스 0 — 'A' 분기의 정체성 절반만 발현.
 *
 * 패턴 (cycle 222-257 silent dead config 시리즈 30번째):
 * - cycle 257: drainRatio dispatch + 2건 데이터 정합 ('혼의 흡수' 30%, '흡혈의 낫' 35%).
 * - cycle 258: '강화 흡수' branch drainRatio 0.325 (paired data follow-up).
 *
 * 수정 (src/data/classes.ts):
 * - 흑마법사 '생명흡수' branch A '강화 흡수' override에 drainRatio: 0.325 추가
 *   (default 0.25 * 1.3 = 0.325 — desc "+30%" 정합).
 *
 * 회귀 가드:
 * - cycle 257 동작 유지 (혼의 흡수 0.30, 흡혈의 낫 0.35).
 * - 다른 branch 영향 없음.
 * - drainRatio 미정의 시 default 0.25 (회귀 가드).
 */

test('cycle 258: 강화 흡수 branch A에 drainRatio: 0.325 정의', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    // 흑마법사 '생명흡수' branches.
    const blackMage = CLASSES['흑마법사'];
    const branchA = blackMage.skillBranches['생명흡수'].find((b) => b.choice === 'A');
    assert.ok(branchA, "'강화 흡수' branch A 존재");
    assert.equal(branchA.label, '강화 흡수');
    // default 0.25 * 1.3 = 0.325 (desc "흡수량 +30%" 정합).
    assert.ok(Math.abs(branchA.override.drainRatio - 0.325) < 0.001,
        `branch override drainRatio 0.325 (desc "흡수량 +30%" 정합, 실제: ${branchA.override.drainRatio})`);
    // damage scaling 보존.
    assert.equal(branchA.override.mult, 3.9, 'mult 3.9 (damage +30%) 회귀 가드');
});

test('cycle 258: 저주 흡수 branch B는 drainRatio 없음 (기본 0.25 — "흡수" 강조 없음)', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    const blackMage = CLASSES['흑마법사'];
    const branchB = blackMage.skillBranches['생명흡수'].find((b) => b.choice === 'B');
    assert.equal(branchB.label, '저주 흡수');
    // desc: "저주 부여 + 흡수" — 흡수량 강화 없음. drainRatio 정의 X (default 0.25).
    assert.equal(branchB.override.drainRatio, undefined,
        `'저주 흡수' branch drainRatio 미정의 — 기본 0.25 사용 (desc 흡수량 보너스 없음)`);
});

test('cycle 258: 강화 흡수 시뮬레이션 — 32.5% 흡수', () => {
    const player = {
        name: 'Test', job: '흑마법사', level: 30,
        hp: 500, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
    // '강화 흡수' branch A 시뮬: mult 3.9, effect 'drain', drainRatio 0.325.
    const skill = { name: 'Test', mp: 40, mult: 3.9, effect: 'drain', drainRatio: 0.325, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };
    const before = player.hp;

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    const damage = enemy.hp - r.updatedEnemy.hp;
    const expectedHeal = Math.floor(damage * 0.325);
    const actualHeal = r.updatedPlayer.hp - before;

    assert.equal(actualHeal, expectedHeal,
        `'강화 흡수' drainRatio 0.325 → ${expectedHeal} 흡수 (실제: ${actualHeal})`);
});

test('cycle 257 회귀 가드: 혼의 흡수 / 흡혈의 낫 drainRatio 유지', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    const shaman = CLASSES['무당'];
    const drainSkill = shaman.skills.find((s) => s.name === '혼의 흡수');
    assert.equal(drainSkill.drainRatio, 0.30, 'cycle 257 혼의 흡수 0.30 회귀 가드');

    const reaperBranchB = shaman.skillBranches['죽음의 낫'].find((b) => b.choice === 'B');
    assert.equal(reaperBranchB.override.drainRatio, 0.35, 'cycle 257 흡혈의 낫 0.35 회귀 가드');
});
