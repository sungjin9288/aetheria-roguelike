import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 226: 2 armors의 evasion 필드가 dead config인 silent 회귀 fix
 *   (cycle 222-225 silent dead config 시리즈 마지막 합류).
 *
 * 발견 (item.evasion 미적용):
 * - 2 armors에 evasion 필드 + desc_stat '회피+N%' 표시:
 *   · 암영 망토 (T4 armor, evasion: 0.08, 도적/어쌔신용)
 *   · 공허의 전투 외투 (T5 armor, evasion: 0.12, 도적/어쌔신용)
 * - 그러나 코드에서 'item.evasion' read 0건. CombatEngine.enemyAttack은 stealth/skill
 *   기반 'nextHitEvaded'만 처리, 장비 evasion은 0.
 * - 결과: 도적/어쌔신이 desc_stat '회피+8%' 보고 장착하지만 실제 evasion 0.
 *
 * 패턴 (cycle 222-225 silent dead config 시리즈):
 * - cycle 222: weapon 5종 armors 버킷 오배치.
 * - cycle 223: '얼음' elem 비매칭.
 * - cycle 224: 4 items mpBonus 미적용.
 * - cycle 225: 2 armors hpBonus 미적용 (+230 HP).
 * - cycle 226: 2 armors evasion 미적용 (마지막 unhandled field).
 *
 * 수정 (src/systems/CombatEngine.ts enemyAttack):
 * - stealth 회피 분기 직후 장비 evasion roll 추가.
 * - player.equip.armor.evasion 확률로 attack 회피.
 * - 회피 성공 시 stealth와 동일 패턴 — 0 dmg, '회피' 로그.
 *
 * 회귀 가드:
 * - evasion 미설정 armor는 0 영향.
 * - stealth nextHitEvaded는 우선 처리 유지.
 * - 보스 phase 전환 분기는 evasion 후에 평가.
 */

test('cycle 226: 2 armors가 evasion 필드 정의 (baseline)', () => {
    const expected = [
        { name: '암영 망토', evasion: 0.08 },
        { name: '공허의 전투 외투', evasion: 0.12 },
    ];
    const allArmors = DB.ITEMS.armors || [];
    for (const exp of expected) {
        const item = allArmors.find((i) => i.name === exp.name);
        assert.ok(item, `${exp.name} should exist`);
        assert.equal(item.evasion, exp.evasion);
    }
});

test('cycle 226: enemyAttack이 evasion=1.0 armor 장착 시 항상 회피', () => {
    // Math.random()이 0~1 사이이므로 evasion=1.0이면 100% 회피.
    const player = {
        name: 'Test', job: '도적', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: {
            weapon: null,
            armor: { name: '극한 회피갑', type: 'armor', val: 30, evasion: 1.0 },
            offhand: null,
        },
        relics: [],
        skillChoices: {},
        titles: [],
        combatFlags: {},
        status: [],
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    assert.equal(result.damage, 0, 'evasion=1.0이면 항상 회피, damage=0');
    assert.ok(result.logs.some((l) => l.text && l.text.includes('회피')),
        '회피 로그 emit 필요');
});

test('cycle 226: enemyAttack이 evasion=0 armor에서 회피 안 함 (회귀 가드)', () => {
    // evasion 미설정 armor는 회피 0%.
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: {
            weapon: null,
            armor: { name: '강철 갑옷', type: 'armor', val: 30 },
            offhand: null,
        },
        relics: [],
        skillChoices: {},
        titles: [],
        combatFlags: {},
        status: [],
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    // 100번 시도 — 회피 안 됨이 정상 (random < 0).
    let evadedCount = 0;
    for (let i = 0; i < 50; i++) {
        const result = CombatEngine.enemyAttack(player, enemy, stats);
        const evadeLog = result.logs.find((l) => l.text && l.text.includes('회피') && !l.text.includes('은신'));
        if (evadeLog) evadedCount++;
    }
    assert.equal(evadedCount, 0, 'evasion 미설정 armor는 회피 0건');
});

test('cycle 226: armor evasion이 stealth보다 후순위 (회귀 가드)', () => {
    // nextHitEvaded(stealth)이 true이면 그것이 먼저 처리되어야 함.
    const player = {
        name: 'Test', job: '도적', level: 10,
        hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: {
            weapon: null,
            armor: { name: '암영 망토', type: 'armor', val: 35, evasion: 0.08 },
            offhand: null,
        },
        relics: [],
        skillChoices: {},
        titles: [],
        combatFlags: {},
        status: [],
        nextHitEvaded: true,
    };
    const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
    const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

    const result = CombatEngine.enemyAttack(player, enemy, stats);
    assert.equal(result.damage, 0);
    // 은신 로그가 우선 emit되어야 함 (armor 회피 로그가 아님).
    assert.ok(result.logs.some((l) => l.text && l.text.includes('은신')),
        '은신 로그가 emit되어야 함 (stealth 우선 처리)');
});

test('cycle 222-225 회귀 가드: 기존 dead config fixes 유지', async () => {
    // cycle 222: 5 weapons in weapons bucket
    const weaponNames = new Set((DB.ITEMS.weapons || []).map((w) => w.name));
    assert.ok(weaponNames.has('세계수의 검'));
    assert.ok(weaponNames.has('시간 파편 소드'));
    // cycle 223: '얼음' elem 0건
    const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
    const iceElem = allItems.filter((i) => i.elem === '얼음');
    assert.equal(iceElem.length, 0);
    // cycle 224: 4 items mpBonus
    assert.ok(allItems.some((i) => i.name === '빙결 지팡이' && i.mpBonus === 30));
    // cycle 225: 2 armors hpBonus
    assert.ok(allItems.some((i) => i.name === '용암 판금갑' && i.hpBonus === 80));
});
