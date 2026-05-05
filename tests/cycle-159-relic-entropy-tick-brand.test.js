import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { applyBattleStartRelics } from '../src/utils/exploreUtils.js';

/**
 * cycle 159: 'entropy_tick' / 'entropy_brand' 핸들러 추가
 * (cycle 148 baseline 2 → 0 🎯).
 *
 * 마지막 2종 — 둘 다 turn-based DOT 메커니즘. 공통 헬퍼 applyEntropyTick으로
 * 통합 처리. 시너지(brand)가 활성이면 시너지 파라미터 우선 (damage 0.12 /
 * interval 2 — 유물의 0.08 / 3 강화).
 *
 * - turnCount는 매 전투 시작 시 0으로 리셋 (applyBattleStartRelics).
 * - attack / performSkill 끝에서 turnCount 증가 + 조건 시 적 hp 차감.
 */

const fakePlayer = (overrides = {}) => ({
    name: 'tester', job: '모험가', level: 10,
    hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
    relics: [], skillChoices: {}, titles: [], activeTitle: null,
    killStreak: 0, combatFlags: {}, status: [],
    ...overrides,
});

const baseStats = {
    atk: 100, def: 50, elem: 'physical',
    relics: [],
    activeSynergies: [],
    critChance: 0,
};

test("entropy_tick (entropy_engine): interval 3마다 적 maxHp 8% 고정 피해", () => {
    // turnCount=2이면 2+1=3. 3 % 3 == 0 → 발동.
    const player = fakePlayer({
        relics: [{ effect: 'entropy_tick', val: { interval: 3, damage: 0.08 } }],
        combatFlags: { turnCount: 2 },
    });
    const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };

    const result = CombatEngine.applyEntropyTick(player, enemy, []);
    // damage = 1000 * 0.08 = 80. enemy hp 1000 → 920.
    assert.equal(result.enemy.hp, 920);
    assert.equal(result.player.combatFlags.turnCount, 3);
    const log = result.logs.find((l) => l.text.includes('엔트로피 엔진'));
    assert.ok(log, '엔트로피 엔진 로그');
});

test("entropy_tick: interval 미달 — 발동 안 함", () => {
    const player = fakePlayer({
        relics: [{ effect: 'entropy_tick', val: { interval: 3, damage: 0.08 } }],
        combatFlags: { turnCount: 0 },
    });
    const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };

    // turnCount 0 → 1. 1 % 3 != 0 → 발동 안 함.
    const result = CombatEngine.applyEntropyTick(player, enemy, []);
    assert.equal(result.enemy.hp, 1000);
    assert.equal(result.player.combatFlags.turnCount, 1);
});

test("entropy_brand 시너지: damage / interval이 유물 값 override (0.12 / 2)", () => {
    const player = fakePlayer({
        relics: [{ effect: 'entropy_tick', val: { interval: 3, damage: 0.08 } }],
        combatFlags: { turnCount: 1 },
    });
    const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };
    const synergies = [{ bonus: { effect: 'entropy_brand', damage: 0.12, interval: 2 } }];

    // turnCount 1 → 2. 2 % 2(시너지) == 0 → 발동.
    // damage 0.12(시너지) * 1000 = 120. enemy hp 1000 → 880.
    const result = CombatEngine.applyEntropyTick(player, enemy, synergies);
    assert.equal(result.enemy.hp, 880);
    const log = result.logs.find((l) => l.text.includes('엔트로피 낙인'));
    assert.ok(log, '엔트로피 낙인 시너지 라벨');
});

test("entropy_tick: 적 이미 사망(hp=0) — 발동 안 함", () => {
    const player = fakePlayer({
        relics: [{ effect: 'entropy_tick', val: { interval: 1, damage: 0.5 } }],
        combatFlags: { turnCount: 0 },
    });
    const enemy = { name: '오크', hp: 0, maxHp: 1000, atk: 10, def: 5 };

    const result = CombatEngine.applyEntropyTick(player, enemy, []);
    assert.equal(result.enemy.hp, 0);  // 이미 죽은 적엔 추가 피해 안 줌
});

test("관련 유물/시너지 미보유 — turnCount만 증가, 적 hp 변화 없음", () => {
    const player = fakePlayer({ combatFlags: { turnCount: 5 } });
    const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };

    const result = CombatEngine.applyEntropyTick(player, enemy, []);
    assert.equal(result.enemy.hp, 1000);
    // 미보유 시 turnCount 증가 여부 — early return으로 증가
    assert.equal(result.player.combatFlags.turnCount, 6);
});

test("attack: entropy_tick이 attack 끝에 호출됨 — interval 1 / damage 0.1로 적 hp 추가 감소", () => {
    const player = fakePlayer({
        relics: [{ effect: 'entropy_tick', val: { interval: 1, damage: 0.1 } }],
        combatFlags: { turnCount: 0 },
    });
    const enemy = { name: '오크', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
    const stats = {
        ...baseStats,
        relics: player.relics,
        activeSynergies: [],
    };

    const result = CombatEngine.attack(player, enemy, stats);
    // 일반 공격 피해 + entropy 1000 추가 피해.
    // turnCount 0 → 1, 1 % 1 == 0 → 발동.
    const entropyLog = result.logs.find((l) => l.text && l.text.includes('엔트로피 엔진'));
    assert.ok(entropyLog, 'attack 끝에 entropy 로그 출력돼야 함');
    assert.equal(result.updatedPlayer.combatFlags.turnCount, 1);
});

test("applyBattleStartRelics: turnCount 0으로 리셋", () => {
    const player = {
        ...fakePlayer(),
        combatFlags: { turnCount: 12, voidHeartUsed: true },
    };
    const result = applyBattleStartRelics(player, [], { maxHp: 1000 }, { addLog: () => {} });

    assert.equal(result.combatFlags.turnCount, 0);
    assert.equal(result.combatFlags.voidHeartUsed, true);  // run-wide 보존
});
