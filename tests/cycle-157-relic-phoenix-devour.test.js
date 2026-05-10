import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 157: 'phoenix_revive' / 'devour_hp' 유물 핸들러 추가
 * (cycle 148 baseline 6 → 4).
 *
 * 1. phoenix_revive (phoenix_feather) — applyFatalProtection의 void_heart 분기
 *    아래 fallback. HP 0 도달 시 healRatio(=0.3) HP로 부활. 1회 한정.
 *    atkBuff/duration tempBuff는 별도 사이클 (multiplier 인프라 필요).
 * 2. devour_hp (world_eater) — handleVictory에서 적 maxHp의 val(=0.1)만큼
 *    player.maxHp 영구 증가. "전투 내" 리셋은 별도 사이클 (per-combat reset
 *    인프라 미구현).
 */

test("phoenix_revive (phoenix_feather): HP 0 도달 시 healRatio 비율로 부활", () => {
    const player = {
        hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
        relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3, atkBuff: 0.5, duration: 3 } }],
        combatFlags: {},
        status: [],
    };
    const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

    // healRatio 0.3 * maxHp 1000 = 300 HP로 부활.
    assert.equal(result.updatedPlayer.hp, 300,
        `expected hp 300 (30% of maxHp); got ${result.updatedPlayer.hp}`);
    assert.equal(result.isDead, false);
    assert.equal(result.updatedPlayer.combatFlags.phoenixUsed, true,
        'phoenix 1회 사용 플래그 확인');
});

test("phoenix_revive: 1회만 발동 — phoenixUsed 플래그 보존 시 부활 안 함", () => {
    const player = {
        hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
        relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3 } }],
        combatFlags: { phoenixUsed: true },
        status: [],
    };
    const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

    // 이미 1회 사용된 상태 → 부활 안 함.
    assert.equal(result.updatedPlayer.hp, 0);
    assert.equal(result.isDead, true);
});

test("phoenix_revive: void_heart 우선순위 — void_heart 사용 안 했으면 phoenix 발동 안 함", () => {
    // void_heart와 phoenix 둘 다 보유 — void_heart 먼저 발동
    const player = {
        hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
        relics: [
            { effect: 'void_heart' },
            { effect: 'phoenix_revive', val: { healRatio: 0.3 } },
        ],
        combatFlags: {},
        status: [],
    };
    const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

    // void_heart가 먼저 → hp=1, voidHeartUsed=true, phoenix는 그대로 (다음에 발동)
    assert.equal(result.updatedPlayer.hp, 1);
    assert.equal(result.updatedPlayer.combatFlags.voidHeartUsed, true);
    assert.notEqual(result.updatedPlayer.combatFlags.phoenixUsed, true);
});

test("devour_hp (world_eater): handleVictory 시 enemy.maxHp * val 만큼 player maxHp 증가", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
        atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
        relics: [{ effect: 'devour_hp', val: 0.1 }],
        combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
        challengeModifiers: [],
    };
    const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

    const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination

    // val 0.1 * enemy.maxHp 200 = 20 HP 증가.
    assert.equal(result.updatedPlayer.maxHp, 1020,
        `expected maxHp 1020 (1000 + 20); got ${result.updatedPlayer.maxHp}`);
    // hp도 같은 양만큼 증가 (현재 hp 500 + 20 = 520).
    assert.equal(result.updatedPlayer.hp, 520,
        `expected hp 520 (500 + 20); got ${result.updatedPlayer.hp}`);
});

test("devour_hp: 미보유 시 maxHp 변화 없음 (회귀 가드)", () => {
    const player = {
        name: 'tester', job: '모험가', level: 10,
        hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
        atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
        relics: [], combatFlags: {}, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
        challengeModifiers: [],
    };
    const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

    const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination
    assert.equal(result.updatedPlayer.maxHp, 1000);
});
