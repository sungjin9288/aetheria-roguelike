import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { applyBattleStartRelics } from '../src/utils/exploreUtils.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 158: 'battle_start_buff' / 'kill_stack_atk' 유물 핸들러 추가
 * (cycle 148 baseline 4 → 2).
 *
 * 1. battle_start_buff (전쟁의 북) — applyBattleStartRelics에서 tempBuff
 *    적용. statsCalculator의 baseAtk * (1 + buff.atk)로 즉시 반영.
 * 2. kill_stack_atk (허공의 왕좌) — combatFlags.killStackAtkBonus per-combat
 *    누적. 매 처치마다 perKill 증가, max 캡. 매 전투 시작 시 0으로 리셋.
 *    atkFlat 리듀서에 합산.
 */

const fakePlayer = () => ({
    name: 'tester', job: '모험가', level: 50,
    hp: 1000, maxHp: 1000, mp: 500, maxMp: 500, atk: 1000, def: 500,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null,
    killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    tempBuff: { atk: 0, def: 0, turn: 0, name: null },
});

test("battle_start_buff (war_drum): applyBattleStartRelics가 tempBuff 적용", () => {
    const player = fakePlayer();
    const relic = { effect: 'battle_start_buff', val: { atk: 0.2, turns: 2 } };

    const logs = [];
    const result = applyBattleStartRelics(player, [relic], { maxHp: 1000 }, {
        addLog: (type, text) => logs.push({ type, text }),
    });

    assert.equal(result.tempBuff.atk, 0.2);
    assert.equal(result.tempBuff.turn, 2);
    assert.equal(result.tempBuff.name, 'battle_start_buff');
    const startLog = logs.find((l) => l.text.includes('전쟁의 북'));
    assert.ok(startLog, '전쟁의 북 로그 출력돼야 함');
});

test("battle_start_buff: 전투 시작 후 finalAtk가 baseline 대비 +20%", () => {
    const base = fakePlayer();
    const baseStats = calculateFullStats(base);

    const withBuff = { ...base, tempBuff: { atk: 0.2, def: 0, turn: 2, name: 'battle_start_buff' } };
    const buffStats = calculateFullStats(withBuff);

    const ratio = buffStats.atk / baseStats.atk;
    assert.ok(ratio >= 1.18 && ratio <= 1.22,
        `expected battle_start_buff atk ratio ~1.20; got ${ratio.toFixed(3)}`);
});

test("kill_stack_atk (void_monarch): handleVictory가 combatFlags.killStackAtkBonus 증가", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
        atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
        relics: [{ effect: 'kill_stack_atk', val: { perKill: 0.05, max: 0.5 } }],
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
        challengeModifiers: [],
    };
    const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

    const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination
    assert.equal(result.updatedPlayer.combatFlags.killStackAtkBonus, 0.05);

    // 두 번째 처치
    const result2 = CombatEngine.handleVictory(result.updatedPlayer, enemy, {}, {}); // cycle 624: explicit elimination
    assert.equal(result2.updatedPlayer.combatFlags.killStackAtkBonus, 0.1);
});

test("kill_stack_atk: max(0.5)에서 캡 — 누적이 max 초과 안 함", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
        atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
        relics: [{ effect: 'kill_stack_atk', val: { perKill: 0.2, max: 0.5 } }],
        combatFlags: { killStackAtkBonus: 0.4 }, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
        challengeModifiers: [],
    };
    const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

    const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination
    // 0.4 + 0.2 = 0.6, but max 0.5 → 0.5
    assert.equal(result.updatedPlayer.combatFlags.killStackAtkBonus, 0.5);
});

test("kill_stack_atk: combatFlags.killStackAtkBonus가 finalAtk에 반영됨", () => {
    const base = fakePlayer();
    base.relics = [{ effect: 'kill_stack_atk', val: { perKill: 0.05, max: 0.5 } }];
    const baseStats = calculateFullStats(base);

    const withStack = { ...base, combatFlags: { killStackAtkBonus: 0.3 } };
    const stackStats = calculateFullStats(withStack);

    const ratio = stackStats.atk / baseStats.atk;
    assert.ok(ratio >= 1.28 && ratio <= 1.32,
        `expected kill_stack_atk(0.3) atk ratio ~1.30; got ${ratio.toFixed(3)}`);
});

test("applyBattleStartRelics: kill_stack_atk / phoenix 카운터 0으로 리셋", () => {
    const player = {
        ...fakePlayer(),
        combatFlags: {
            killStackAtkBonus: 0.4,
            phoenixUsed: true,
            voidHeartUsed: true,  // 보존돼야 하는 플래그
            voidHeartArmed: true,
        },
    };
    const result = applyBattleStartRelics(player, [], { maxHp: 1000 }, { addLog: () => {} });

    assert.equal(result.combatFlags.killStackAtkBonus, 0);
    assert.equal(result.combatFlags.phoenixUsed, false);
    // void_heart 플래그는 보존 (run-wide)
    assert.equal(result.combatFlags.voidHeartUsed, true);
    assert.equal(result.combatFlags.voidHeartArmed, true);
});
