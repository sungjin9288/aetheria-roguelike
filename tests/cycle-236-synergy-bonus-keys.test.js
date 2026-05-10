import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { RELIC_SYNERGIES } from '../src/data/relics.js';

/**
 * cycle 236: 2 unhandled synergy bonus keys fix (cycle 222-229 silent dead config 시리즈 9번째).
 *
 * 발견 (synergy bonus key 미적용):
 * - 'fixedDmg': entropy_god 시너지 (val: { fixedDmg: 0.15, interval: 1, chaosAtk: 0.5 }).
 *   - applyEntropyTick은 brandSyn 조건이 'damage && interval'이라 fixedDmg 사용하는 entropy_god를 catch 안 함.
 *   - 결과: entropy_god의 매 턴 maxHp 15% 고정 피해가 영원히 0.
 * - 'killStack': annihilator (0.07) / void_dragon (0.08) 시너지.
 *   - kill_stack_atk relic의 perKill은 처치 시 ATK 누적되지만 synergy의 killStack는 dispatch 0건.
 *   - 결과: 두 시너지가 공언하는 kill 누적 가속이 영원히 0.
 *
 * 패턴 (cycle 222-229 silent dead config 시리즈 9번째):
 * - cycle 222-228: item/monster dead config.
 * - cycle 229: relic effect (spell_stack).
 * - cycle 236: synergy bonus key (fixedDmg / killStack).
 *
 * 수정:
 * 1. src/systems/CombatEngine.ts applyEntropyTick:
 *    - brandSyn detection 확장 — 'fixedDmg && interval'도 catch.
 *    - damage 추출 시 'damage ?? fixedDmg' fallback.
 * 2. src/systems/CombatEngine.ts handleVictory (kill_stack_atk handler 근처):
 *    - 시너지의 killStack 합산 — 기존 relic perKill 위에 추가.
 *
 * 회귀 가드:
 * - 기존 entropy_brand (damage) / entropy_tick (relic) 동작 유지.
 * - kill_stack_atk relic 단독 동작 유지.
 * - 시너지 미보유 시 0 영향.
 */

test('cycle 236: entropy_god 시너지의 fixedDmg가 entropy tick에 적용', () => {
    const player = {
        name: 'Test', combatFlags: { turnCount: 1 }, status: [], relics: [],
    };
    const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 50, def: 5 };
    const synergies = [{ bonus: { effect: 'entropy_god', fixedDmg: 0.15, interval: 1, chaosAtk: 0.5 } }];
    const result = CombatEngine.applyEntropyTick(player, enemy, synergies);
    // entropy_god fixedDmg 0.15 * maxHp 1000 = 150 dmg
    const dmgDealt = enemy.hp - result.enemy.hp;
    assert.ok(dmgDealt >= 150, `entropy_god fixedDmg 적용되어야 함 (예상 150+, 실제 ${dmgDealt})`);
});

test('cycle 236: 시너지의 killStack이 kill_stack_atk 누적에 합산', () => {
    const player = {
        name: 'Test', level: 10, hp: 100, maxHp: 100, mp: 50, maxMp: 100,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        combatFlags: { killStackAtkBonus: 0 }, // 0 stack
        relics: [{ id: 'void_throne', effect: 'kill_stack_atk', val: { perKill: 0.05, max: 1 } }],
        skillChoices: {}, titles: [], stats: {}, equip: {},
    };
    const enemy = { name: '슬라임', hp: 0, maxHp: 100, isBoss: false, exp: 50, gold: 10 };
    const passiveBonus = { goldMult: 0, expMult: 0 };
    const result = CombatEngine.handleVictory(player, enemy, passiveBonus, {}); // cycle 624: explicit elimination
    // void_throne perKill 0.05 → 0.05 누적. 시너지 killStack 0.07 추가 시 0.12 누적.
    // 본 테스트는 시너지 없이 baseline 0.05 유지 검증 (회귀 가드).
    assert.ok((result.updatedPlayer.combatFlags?.killStackAtkBonus || 0) >= 0.05,
        `kill_stack_atk relic perKill 0.05 누적되어야 함`);
});

test('cycle 236: 시너지 보유 시 killStack가 perKill에 합산', () => {
    // 본 cycle의 핵심 — annihilator 시너지의 killStack 0.07이 누적에 +.
    const player = {
        name: 'Test', level: 10, hp: 100, maxHp: 100, mp: 50, maxMp: 100,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        combatFlags: { killStackAtkBonus: 0 },
        relics: [{ id: 'void_throne', effect: 'kill_stack_atk', val: { perKill: 0.05, max: 1 } }],
        skillChoices: {}, titles: [], stats: {}, equip: {},
        activeSynergies: [{ bonus: { effect: 'annihilator', executeThreshold: 0.35, killStack: 0.07 } }],
    };
    const enemy = { name: '슬라임', hp: 0, maxHp: 100, isBoss: false, exp: 50, gold: 10 };
    const passiveBonus = { goldMult: 0, expMult: 0, activeSynergies: player.activeSynergies };
    const result = CombatEngine.handleVictory(player, enemy, passiveBonus, {}); // cycle 624: explicit elimination
    // 합산 0.05 + 0.07 = 0.12 누적
    const stack = result.updatedPlayer.combatFlags?.killStackAtkBonus || 0;
    assert.ok(stack >= 0.12,
        `annihilator killStack 0.07 + relic 0.05 = 0.12 누적되어야 함 (실제 ${stack})`);
});

test('cycle 236: entropy_brand 기존 damage 키 동작 유지 (회귀 가드)', () => {
    const player = {
        name: 'Test', combatFlags: { turnCount: 1 }, status: [], relics: [],
    };
    const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 50, def: 5 };
    const synergies = [{ bonus: { effect: 'entropy_brand', damage: 0.12, interval: 2 } }];
    // turnCount becomes 2 after applyEntropyTick (initial 1 + 1) → 2 % 2 === 0 → trigger
    // Re-check: starts at flags.turnCount=1 then +1 = 2. 2 % 2 = 0 trigger. So damage applies.
    const result = CombatEngine.applyEntropyTick(player, enemy, synergies);
    // entropy_brand의 'damage' 키 인식되어 trigger되어야 함 (회귀 가드 — fixedDmg 추가가
    // 기존 damage 키 처리를 깨면 안 됨).
    assert.ok(result.enemy.hp < 1000, 'entropy_brand damage 키 인식되어 trigger');
});

test('cycle 229 회귀 가드: spell_stack 처리 유지', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
        atk: 100, def: 30,
        relics: [{ effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
        skillChoices: {}, titles: [], equip: {},
        combatFlags: { spellStackCount: 0 }, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const skill = { name: '스킬', mp: 10, mult: 1.5, cooldown: 0 };
    const stats = { atk: 200, def: 50, relics: player.relics, activeSynergies: [], critChance: 0 };
    const r = CombatEngine.performSkill(player, { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 }, stats, skill);
    assert.equal(r.updatedPlayer.combatFlags.spellStackCount, 1);
});
