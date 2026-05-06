import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 227: 27 monsters의 statusOnHit 필드가 dead config인 silent 회귀 fix
 *   (cycle 222-226 silent dead config 시리즈 연장).
 *
 * 발견 (monster.statusOnHit 미적용):
 * - 27 monsters에 statusOnHit 필드 정의 (poison/curse/burn/freeze 종류).
 *   예: 슬라임(poison), 화염 비룡(burn), 망자의 사제(curse), 서리 마법사(freeze).
 * - 그러나 src/ 어디에서도 'statusOnHit' read 안 함. CombatEngine.enemyAttack은
 *   phase2/phase3 statusEffect만 처리, 일반 hit에는 dispatch path 0건.
 * - 결과: 27 몬스터가 desc 내러티브상 status를 부여하는 것처럼 보이지만 실제 상태이상 0건.
 *
 * 패턴 (cycle 222-227 silent dead config 시리즈 6번째):
 * - cycle 222: weapon 5종 armors 버킷 오배치.
 * - cycle 223: '얼음' elem 비매칭.
 * - cycle 224: 4 items mpBonus 미적용.
 * - cycle 225: 2 armors hpBonus 미적용 (+230 HP).
 * - cycle 226: 2 armors evasion 미적용.
 * - cycle 227: 27 monsters statusOnHit 미적용 (가장 큰 규모).
 *
 * 수정 (src/systems/CombatEngine.ts enemyAttack):
 * - heavy hit (heavyResolved) + statusOnHit 정의 + 플레이어 생존 + 상태 미보유 시 status 부여.
 * - heavy hit만 trigger — 모든 hit마다 적용은 너무 강함 (slime이 매 턴 독 부여).
 * - status_resist relic의 확률로 저항 체크 (phase2/3 패턴 동일).
 * - 상태이상 부여 로그 emit.
 *
 * 회귀 가드:
 * - statusOnHit 미정의 monster는 0 영향.
 * - phase2/phase3 statusEffect 처리는 별도 path 보존.
 * - 일반 hit (heavyResolved=false)는 status 부여 안 함.
 * - 이미 보유 중인 status는 중복 안 됨.
 */

test('cycle 227: heavy hit + statusOnHit인 적이 player에 status 부여', () => {
    // 강제로 heavy hit 발생 시키기 위해 mock 필요. enemyAttack 분기 검증을 위해
    // pattern.heavyChance = 1로 설정 (100% heavy).
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [],
        skillChoices: {},
        titles: [],
        combatFlags: {},
        status: [],
    };
    const enemy = {
        name: '슬라임', baseName: '슬라임',
        hp: 100, maxHp: 100, atk: 50, def: 5,
        statusOnHit: 'poison',
        pattern: { guardChance: 0.0, heavyChance: 1.0 }, // 100% heavy
    };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    // heavy hit + statusOnHit → 100% poison 부여
    const playerStatus = result.updatedPlayer.status || [];
    assert.ok(playerStatus.includes('poison'),
        `slime의 statusOnHit poison이 heavy hit 시 부여되어야 함 (실제 status: ${JSON.stringify(playerStatus)})`);
});

test('cycle 227: statusOnHit 미정의 monster는 status 부여 안 함', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = {
        name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5,
        pattern: { guardChance: 0.0, heavyChance: 1.0 },
        // statusOnHit 미정의
    };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    assert.deepEqual(result.updatedPlayer.status || [], [],
        'statusOnHit 미정의 적은 player.status 변화 없음');
});

test('cycle 227: 일반 hit (heavyChance=0)는 statusOnHit 부여 안 함', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = {
        name: '슬라임', hp: 100, maxHp: 100, atk: 50, def: 5,
        statusOnHit: 'poison',
        pattern: { guardChance: 0.0, heavyChance: 0.0 }, // 0% heavy
    };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    // 일반 hit → status 부여 안 됨
    assert.deepEqual(result.updatedPlayer.status || [], [],
        '일반 hit은 statusOnHit 부여 안 함 (heavy 전용)');
});

test('cycle 227: 이미 같은 status 보유 중인 player는 중복 추가 안 함', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {},
        status: ['poison'], // 이미 poison 보유
    };
    const enemy = {
        name: '슬라임', hp: 100, maxHp: 100, atk: 50, def: 5,
        statusOnHit: 'poison',
        pattern: { guardChance: 0.0, heavyChance: 1.0 },
    };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    const poisonCount = (result.updatedPlayer.status || []).filter((s) => s === 'poison').length;
    assert.equal(poisonCount, 1, '동일 status는 중복 안 됨 (cycle 106 phase pattern과 정합)');
});

test('cycle 226 회귀 가드: armor evasion 처리 유지', () => {
    const player = {
        name: 'Test', job: '도적', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: { weapon: null, armor: { name: '극한 회피갑', type: 'armor', val: 30, evasion: 1.0 }, offhand: null },
        relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
    };
    const enemy = { name: '슬라임', hp: 100, atk: 50, def: 5, statusOnHit: 'poison', pattern: { guardChance: 0, heavyChance: 1.0 } };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    assert.equal(result.damage, 0, 'evasion=1.0 회피');
    // 회피 시 statusOnHit 부여 안 됨 (early return)
    assert.deepEqual(result.updatedPlayer.status || [], [],
        '회피 시 statusOnHit 미부여 — 회피로 모든 효과 무효화');
});
