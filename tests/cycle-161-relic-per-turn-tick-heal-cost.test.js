import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 161: per-turn 보조 메커니즘 정리 — 3종 (cycles 149/154/150 잔존 TODO).
 *
 * cycle 148 baseline 0(cycle 159) 달성 후 잔존 secondary 메커니즘 정리.
 * 모두 tickCombatState에 매 턴 처리 추가:
 *
 * 1. genesis (창세의 핵) — val.healPerTurn 0.02 매 턴 HP 회복.
 *    cycle 149에서 statBonus만 적용 → healPerTurn 추가.
 * 2. eternal_fortress 시너지 — bonus.regenPerTurn 0.08 매 턴 HP 재생.
 *    cycle 154에서 defMult만 적용 → regenPerTurn 추가.
 * 3. hp_drain_atk (혈맹의 반지/심연의 계약) — val.hpCost 매 턴 HP 소모.
 *    cycle 150에서 atkBonus만 적용 → hpCost 추가. hell_reaper 시너지
 *    (hpCostReduction)는 cost를 직접 대체.
 */

const fakePlayer = (overrides = {}) => ({
    name: 'tester', job: '모험가', level: 10,
    hp: 500, maxHp: 1000, mp: 50, maxMp: 100,
    relics: [], skillChoices: {}, titles: [], activeTitle: null,
    killStreak: 0, combatFlags: {}, status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
    tempBuff: { atk: 0, def: 0, turn: 0, name: null },
    ...overrides,
});

test("genesis (창세의 핵): healPerTurn 0.02 — 매 턴 maxHp 2% 회복", () => {
    const player = fakePlayer({
        relics: [{ effect: 'genesis', val: { statBonus: 0.15, healPerTurn: 0.02 } }],
    });
    const result = CombatEngine.tickCombatState(player);
    // 1000 * 0.02 = 20 HP heal. 500 → 520.
    assert.equal(result.updatedPlayer.hp, 520);
    const log = result.logs.find((l) => l.text.includes('창세의 핵'));
    assert.ok(log);
});

test("genesis: HP가 maxHp일 때 회복 안 함 (overheal 가드)", () => {
    const player = fakePlayer({
        hp: 1000, maxHp: 1000,
        relics: [{ effect: 'genesis', val: { statBonus: 0.15, healPerTurn: 0.02 } }],
    });
    const result = CombatEngine.tickCombatState(player);
    assert.equal(result.updatedPlayer.hp, 1000);
});

test("eternal_fortress 시너지: regenPerTurn 0.08 — 매 턴 maxHp 8% 재생", () => {
    // 시너지 require: 난공불락 + 암석 피부 + 대지의 심장
    const player = fakePlayer({
        relics: [
            { name: '난공불락', effect: 'def_mult', val: 0.3 },
            { name: '암석 피부', effect: 'stone_skin', val: 0.5 },
            { name: '대지의 심장', effect: 'regen', val: 0.05 },
        ],
    });
    const result = CombatEngine.tickCombatState(player);
    // regenRelic(대지의 심장) +5% = 50 HP, eternal_fortress regenPerTurn +8% = 80 HP.
    // 500 → 550 (regen) → 630 (eternal_fortress) — 두 핸들러 누적.
    assert.equal(result.updatedPlayer.hp, 630);
    const fortressLog = result.logs.find((l) => l.text.includes('영원의 요새'));
    assert.ok(fortressLog, 'eternal_fortress 시너지 회복 로그');
});

test("hp_drain_atk (혈맹의 반지): hpCost 0.03 — 매 턴 maxHp 3% 소모", () => {
    const player = fakePlayer({
        relics: [{ effect: 'hp_drain_atk', val: { hpCost: 0.03, atkBonus: 0.35 } }],
    });
    const result = CombatEngine.tickCombatState(player);
    // 1000 * 0.03 = 30 HP cost. 500 → 470.
    assert.equal(result.updatedPlayer.hp, 470);
    const log = result.logs.find((l) => l.text.includes('혈맹의 반지'));
    assert.ok(log);
});

test("hp_drain_atk + hell_reaper 시너지: hpCostReduction 0.02 — cost가 0.02로 대체 (감소)", () => {
    // hell_reaper 시너지 require: 심연의 계약 + 영혼 흡수
    const player = fakePlayer({
        relics: [
            { name: '심연의 계약', effect: 'hp_drain_atk', val: { hpCost: 0.05, atkBonus: 0.6 } },
            { name: '영혼 흡수', effect: 'skill_lifesteal', val: 0.1 },
        ],
    });
    const result = CombatEngine.tickCombatState(player);
    // 원래 cost 5% (50 HP), hell_reaper hpCostReduction 0.02 → cost 2% (20 HP).
    // 500 → 480.
    assert.equal(result.updatedPlayer.hp, 480);
    const log = result.logs.find((l) => l.text.includes('지옥의 수확자'));
    assert.ok(log, 'hell_reaper 라벨 로그 — 감소된 cost임을 표시');
});

test("hp_drain_atk: HP 1 미만으로 떨어지지 않음 (사망 방지 가드)", () => {
    const player = fakePlayer({
        hp: 5, maxHp: 1000,
        relics: [{ effect: 'hp_drain_atk', val: { hpCost: 0.03, atkBonus: 0.35 } }],
    });
    const result = CombatEngine.tickCombatState(player);
    // hp 5에서 30 차감 → 0이 되어야 하지만 max(1, ...)로 1 보장.
    assert.equal(result.updatedPlayer.hp, 1);
});
