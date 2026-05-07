import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 247: skill branch override의 desc-data 정합성 audit
 *   (cycle 222-246 silent dead config 시리즈 19번째 — data correctness lens).
 *
 * 발견 (desc vs override 불일치 2건):
 *
 * 1) 흑마법사 '저주의 낙인' branch B = '지속 저주' (mult 1.6, curseTurn 3):
 *    - desc: "저주 지속 +2턴" — 의도: 기본(3턴) + 2 = 5턴.
 *    - 그러나 override curseTurn: 3 → cycle 244 dispatch와 합쳐도 default와 동일 3턴.
 *    - 결과: 화력 페널티(2.32 → 1.6)만 발현, 저주 지속 보너스 0 — 단순 nerf 분기.
 *
 * 2) 성직자 '천벌' branch B = '심판의 천벌' (mult 6.0, secondEffect 'curse', stunTurn 2):
 *    - desc: "기절 2턴 + 저주" — 의도: 기절 2턴 + 저주 동시 부여.
 *    - 그러나 base '천벌' effect: 'purify' (player status cleanse)이고 override는 effect 변경 없음.
 *    - STATUS_EFFECTS_TO_ENEMY에 'purify' 없어 stun 부여 분기 미진입 → stunTurn 영원히 영향 없음.
 *    - 결과: 저주만 부여, 기절 0턴 — desc와 모순.
 *
 * 패턴 (cycle 222-246 silent dead config 시리즈 19번째):
 * - cycle 244: skill branch curseTurn dispatch (구현체).
 * - cycle 247: 동일 branch의 데이터 정합성 fix (광고 vs 실제 동작 일치).
 *
 * 수정 (src/data/classes.ts):
 * - '지속 저주' override curseTurn: 3 → 5 (default 3 + desc "+2턴" 정합).
 * - '심판의 천벌' override에 effect: 'stun' 추가 (desc "기절" 정합 — purify cleanse 포기 trade-off).
 *
 * 회귀 가드:
 * - 다른 skillBranches 동작 변화 없음.
 * - cycle 244 curseTurn dispatch 구현 유지.
 * - cycle 241 stunTurn 동작 유지.
 */

test('cycle 247: 지속 저주 branch curseTurn: 5 (data 정합)', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    // '저주의 낙인' branch는 무당 직업 소속 (Sprint 16).
    const shaman = CLASSES['무당'];
    const branchB = shaman.skillBranches['저주의 낙인'].find((b) => b.choice === 'B');
    assert.equal(branchB.override.curseTurn, 5,
        `'지속 저주' curseTurn 5 (default 3 + "+2턴" desc 정합, 실제: ${branchB.override.curseTurn})`);
});

test('cycle 247: 지속 저주 시뮬레이션 — cursedTurns 5 적용', () => {
    const player = {
        name: 'Test', job: '흑마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, cursedTurns: 0 };
    // '지속 저주' branch B 시뮬레이션 (cycle 247 후): curseTurn 5.
    const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', curseTurn: 5, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.cursedTurns, 5,
        `'지속 저주' 적용 후 cursedTurns 5 (실제: ${r.updatedEnemy.cursedTurns})`);
});

test('cycle 247: 심판의 천벌 branch effect: "stun" 추가 (data 정합)', async () => {
    const { CLASSES } = await import('../src/data/classes.js');
    // '천벌' branch는 아크메이지 직업 소속.
    const archmage = CLASSES['아크메이지'];
    const branchB = archmage.skillBranches['천벌'].find((b) => b.choice === 'B');
    assert.equal(branchB.override.effect, 'stun',
        `'심판의 천벌' override effect: 'stun' (desc "기절 2턴" 정합, 실제: ${branchB.override.effect})`);
    assert.equal(branchB.override.secondEffect, 'curse', 'secondEffect curse 보존');
    assert.equal(branchB.override.stunTurn, 2, 'stunTurn 2 보존');
});

test('cycle 247: 심판의 천벌 시뮬레이션 — stun 2턴 + curse 동시 부여', () => {
    const player = {
        name: 'Test', job: '성직자', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0, cursedTurns: 0 };
    // '심판의 천벌' branch B 시뮬레이션 (cycle 247 후): effect 'stun', stunTurn 2, secondEffect 'curse'.
    const skill = { name: 'Test', mp: 10, mult: 6.0, effect: 'stun', secondEffect: 'curse', stunTurn: 2, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.stunnedTurns, 2,
        `stun 2턴 부여 (실제: ${r.updatedEnemy.stunnedTurns})`);
    assert.equal(r.updatedEnemy.cursed, true,
        `curse 동시 부여 (cursed: ${r.updatedEnemy.cursed})`);
});

test('cycle 244 회귀 가드: skill.curseTurn 미정의 시 default 3 유지', () => {
    const player = {
        name: 'Test', job: '흑마법사', level: 30,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [], skillChoices: {}, titles: [], equip: {},
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, cursedTurns: 0 };
    const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'curse', cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const r = CombatEngine.performSkill(player, enemy, stats, skill);
    assert.equal(r.updatedEnemy.cursedTurns, 3, 'cycle 244 curseTurn 미정의 시 3 default');
});
