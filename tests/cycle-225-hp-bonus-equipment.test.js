import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getEquipmentProfile } from '../src/utils/equipmentUtils.js';

/**
 * cycle 225: 2 armors의 hpBonus 필드가 dead config인 silent 회귀 fix
 *   (cycle 224 mpBonus와 동일 lens).
 *
 * 발견 (item.hpBonus 미적용):
 * - 2 armors에 hpBonus 필드 + desc_stat 'HP+N' 표시:
 *   · 용암 판금갑 (T4 armor, hpBonus: 80)
 *   · 용비늘 갑주 (T5 armor, hpBonus: 150)
 * - 그러나 코드에서 'item.hpBonus' read 0건. statsCalculator의 hpBonus 처리는
 *   jobOutfitAffinity.bonus.hpBonus(% 기반)와 CombatEngine 레벨 마일스톤만.
 * - 결과: 플레이어가 desc_stat 'HP+80' 보고 장착하지만 실제 maxHp 변화 없음.
 *   합계 +230 HP가 영원히 적용 안 되던 silent dead config.
 *
 * 패턴 (cycle 224 lens 확장):
 * - cycle 137: BALANCE.X 미참조 dead config.
 * - cycle 215: claimAchievement premiumCurrency 미처리.
 * - cycle 222: weapon 5종 armors 버킷 오배치.
 * - cycle 223: '얼음' elem 비매칭.
 * - cycle 224: 4 items mpBonus 미적용.
 * - cycle 225: 2 armors hpBonus 미적용.
 *
 * 수정 (src/utils/equipmentUtils.ts):
 * - getItemHpContribution 헬퍼 추가 — item.hpBonus 합산.
 * - getEquipmentProfile에 hpBonus 필드 추가 (mpBonus 패턴 동일).
 *
 * 수정 (src/utils/statsCalculator.ts):
 * - equipmentHpBonus를 equipProfile에서 추출.
 * - baseMaxHp 계산에 +equipmentHpBonus 합산.
 *
 * 회귀 가드:
 * - 기존 hpBonus 미설정 armor는 0 영향.
 * - jobOutfitAffinity의 hpBonus(%)는 그대로 (별도 path).
 *
 * 영향 (의도된 활성화):
 * - 전사/버서커가 용암 판금갑 장착 시 +80 maxHp.
 * - 용비늘 갑주 장착 시 +150 maxHp.
 * - desc_stat과 실제 stat 정합성 회복.
 */

test('cycle 225: 2 armors가 hpBonus 필드 정의 (baseline)', () => {
    const expected = [
        { name: '용암 판금갑', hpBonus: 80 },
        { name: '용비늘 갑주', hpBonus: 150 },
    ];
    const allArmors = DB.ITEMS.armors || [];
    for (const exp of expected) {
        const item = allArmors.find((i) => i.name === exp.name);
        assert.ok(item, `${exp.name} should exist`);
        assert.equal(item.hpBonus, exp.hpBonus);
    }
});

test('cycle 225: getEquipmentProfile이 armor hpBonus 합산 (hpBonus 필드 노출)', () => {
    const equip = {
        weapon: null,
        armor: { name: '용암 판금갑', type: 'armor', val: 65, hpBonus: 80 },
        offhand: null,
    };
    const profile = getEquipmentProfile(equip);
    assert.ok(profile.hpBonus >= 80,
        `armor hpBonus 80이 profile.hpBonus에 반영되어야 함 (실제: ${profile.hpBonus})`);
});

test('cycle 225: 용암 판금갑 장착 시 maxHp +80 실제 적용', () => {
    const player = {
        name: 'Test', job: '전사', level: 10,
        hp: 100, maxHp: 200, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: {
            weapon: null,
            armor: { name: '용암 판금갑', type: 'armor', val: 65, hpBonus: 80 },
            offhand: null,
        },
        relics: [],
        skillChoices: {},
        titles: [],
        stats: {},
    };
    const stats = calculateFullStats(player);
    // baseMaxHp = (player.maxHp + codexBonus.hp + passiveBonus.hp + equipmentHpBonus) * setBonus.hpMult * ...
    // 200 + 80 (hpBonus) = 280 minimum
    assert.ok(stats.maxHp >= 280,
        `용암 판금갑의 hpBonus 80이 maxHp에 반영되어야 함 (baseline 200, 실제: ${stats.maxHp})`);
});

test('cycle 225: 용비늘 갑주 장착 시 maxHp +150 실제 적용', () => {
    const player = {
        name: 'Test', job: '전사', level: 20,
        hp: 100, maxHp: 300, mp: 50, maxMp: 100,
        atk: 30, def: 10,
        equip: {
            weapon: null,
            armor: { name: '용비늘 갑주', type: 'armor', val: 95, hpBonus: 150 },
            offhand: null,
        },
        relics: [],
        skillChoices: {},
        titles: [],
        stats: {},
    };
    const stats = calculateFullStats(player);
    assert.ok(stats.maxHp >= 450,
        `용비늘 갑주의 hpBonus 150이 maxHp에 반영되어야 함 (baseline 300, 실제: ${stats.maxHp})`);
});

test('cycle 225: hpBonus 미설정 armor는 0 영향 (회귀 가드)', () => {
    const equip = {
        weapon: null,
        armor: { name: '강철 갑옷', type: 'armor', val: 30 },
        offhand: null,
    };
    const profile = getEquipmentProfile(equip);
    assert.equal(profile.hpBonus || 0, 0, 'hpBonus 미설정 armor는 0 영향');
});

test('cycle 224 회귀 가드: mpBonus 합산 동작 유지', () => {
    const equip = {
        weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30 },
        armor: { name: '상급 폭풍 로브', type: 'armor', val: 40, mpBonus: 25 },
        offhand: null,
    };
    const profile = getEquipmentProfile(equip);
    assert.equal(profile.mpBonus, 55, '30+25 mpBonus 합산 (cycle 224)');
});

test('cycle 225: 합계 230 HP가 더 이상 dead config 아님 (정합성 lock)', () => {
    // 용암 판금갑 80 + 용비늘 갑주 150 = 230
    const dragon1 = (DB.ITEMS.armors || []).find((a) => a.name === '용암 판금갑');
    const dragon2 = (DB.ITEMS.armors || []).find((a) => a.name === '용비늘 갑주');
    const total = (dragon1?.hpBonus || 0) + (dragon2?.hpBonus || 0);
    assert.equal(total, 230, 'cycle 225 fix 이전 230 HP가 dead config였음 (회귀 baseline)');
});
