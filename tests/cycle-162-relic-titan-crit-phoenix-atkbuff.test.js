import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 162: titan critReduce / phoenix_revive atkBuff 잔존 메커니즘 정리
 * (cycles 149/157 TODO).
 *
 * 1. titan (타이탄의 허리띠) — val.critReduce 0.5 받는 치명타 피해 -50%.
 *    cycle 149에서 hp 보너스만 적용 → 받는 치명타(heavyResolved) 차감 추가.
 * 2. phoenix_revive (불사조의 깃털) — val.atkBuff 0.5, val.duration 3.
 *    cycle 157에서 healRatio만 적용 → tempBuff atk multiplier 적용 추가.
 *    statsCalculator의 (1 + buff.atk) 패턴으로 즉시 반영.
 */

test("phoenix_revive: 부활 시 tempBuff(atkBuff/duration) 설정", () => {
    const player = {
        hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
        relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3, atkBuff: 0.5, duration: 3 } }],
        combatFlags: {},
        status: [],
    };
    const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

    assert.equal(result.updatedPlayer.hp, 300, '부활 HP 30% (cycle 157 회귀)');
    assert.equal(result.updatedPlayer.tempBuff?.atk, 0.5, 'atkBuff 0.5 적용');
    assert.equal(result.updatedPlayer.tempBuff?.turn, 3);
    assert.equal(result.updatedPlayer.tempBuff?.name, 'phoenix_revive');
});

test("phoenix_revive: atkBuff 0이면 tempBuff 설정 안 함 (가드)", () => {
    const player = {
        hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
        relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3, atkBuff: 0, duration: 3 } }],
        combatFlags: {},
        status: [],
    };
    const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);
    // tempBuff 설정 안 함 (atkBuff 0).
    assert.equal(result.updatedPlayer.tempBuff, undefined);
});

test("titan critReduce: enemy heavy attack 시 받는 피해 -50%", () => {
    // heavy attack을 강제로 발동하려면 Math.random을 stub해야 함.
    // 직접 Math.random 모킹 — heavy 트리거(roll < heavyChance) + critBlock 미발동(roll >= critBlock).
    const orig = Math.random;
    let callCount = 0;
    Math.random = () => {
        callCount += 1;
        // 첫 호출(heavy 결정): 0.0 → heavy 발동
        // 그 외: 0.99 → critBlock 등 회피
        return callCount === 1 ? 0.0 : 0.99;
    };

    try {
        const player = {
            name: 'tester', job: '모험가', level: 10,
            hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
            relics: [{ effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } }],
            combatFlags: {}, status: [],
        };
        const enemy = {
            name: '오크', hp: 100, maxHp: 100, atk: 100, def: 5,
            pattern: { guardChance: 0.0, heavyChance: 1.0 },  // heavy 100%
        };
        const stats = {
            atk: 100, def: 0,
            relics: player.relics, activeSynergies: [],
            critChance: 0,
        };

        const result = CombatEngine.enemyAttack(player, enemy, stats);
        // titan 적용 시 강타 피해 50% 감소 로그가 있어야 함.
        const titanLog = result.logs.find((l) => l.text && l.text.includes('타이탄의 허리띠'));
        assert.ok(titanLog, '타이탄의 허리띠 강타 감소 로그 출력돼야 함');
    } finally {
        Math.random = orig;
    }
});

test("titan critReduce: heavy 미발동 시 적용 안 함 (회귀 가드)", () => {
    const orig = Math.random;
    Math.random = () => 0.99; // heavy 미발동

    try {
        const player = {
            name: 'tester', job: '모험가', level: 10,
            hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
            relics: [{ effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } }],
            combatFlags: {}, status: [],
        };
        const enemy = {
            name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5,
            pattern: { guardChance: 0.0, heavyChance: 0.0 },  // heavy 0%
        };
        const stats = {
            atk: 100, def: 50,
            relics: player.relics, activeSynergies: [],
            critChance: 0,
        };

        const result = CombatEngine.enemyAttack(player, enemy, stats);
        const titanLog = result.logs.find((l) => l.text && l.text.includes('타이탄의 허리띠'));
        assert.equal(titanLog, undefined, '일반 공격엔 titan 발동 안 함');
    } finally {
        Math.random = orig;
    }
});
