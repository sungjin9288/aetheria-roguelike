import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getEquipmentProfile } from '../src/utils/equipmentUtils.js';

/**
 * cycle 224: 4 items의 mpBonus 필드가 dead config인 silent 회귀 fix.
 *
 * 발견 (item.mpBonus 미적용):
 * - 4 items에 mpBonus 필드 + desc_stat 'MP+N' 표시:
 *   · 빙결 지팡이 (T4 weapon, mpBonus: 30)
 *   · 빙하의 지팡이 (T5 weapon, mpBonus: 50)
 *   · 상급 폭풍 로브 (T4 armor, mpBonus: 25)
 *   · 차원의 로브 (T5 armor, mpBonus: 45)
 * - 그러나 코드에서 'item.mpBonus' read 0건. equipmentUtils.getOffhandMpBonus는
 *   'item.mp' 필드만 읽고 (focus subtype 방패용), weapon/armor의 mpBonus는 무시.
 * - 결과: 플레이어가 desc_stat 'MP+30' 등을 보고 장착하지만 실제 maxMp는 변화 없음.
 *   silent dead config — cycle 137(BALANCE.X 미참조) / cycle 215(reward type 미처리)와 동일 lens.
 *
 * 추정 origin: 데이터 작성 시 두 표기('mp' on shield / 'mpBonus' on weapon-armor) 혼용.
 * 코드는 'mp'만 처리해 mpBonus가 silently 누락.
 *
 * 수정 (src/utils/equipmentUtils.ts):
 * - getEquipmentProfile.mpBonus 계산 확장 — main weapon + armor의 mpBonus|mp 필드도 합산.
 *   기존 offhand shield 방식 유지 + main + armor 추가.
 *
 * 회귀 가드:
 * - shield offhand의 mp 필드는 그대로 유지 (focus 마도서들 영향 없음).
 * - mpBonus 미설정 weapon/armor는 0 영향.
 *
 * 영향 (의도된 활성화):
 * - 마법사/아크메이지가 빙결 지팡이 장착 시 +30 maxMp.
 * - 차원의 로브 장착 시 +45 maxMp.
 * - desc_stat과 실제 stat 정합성 회복.
 */

test('cycle 224: 4 items이 mpBonus 필드 정의 (baseline)', () => {
    const expected = [
        { name: '빙결 지팡이', mpBonus: 30 },
        { name: '빙하의 지팡이', mpBonus: 50 },
        { name: '상급 폭풍 로브', mpBonus: 25 },
        { name: '차원의 로브', mpBonus: 45 },
    ];
    const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
    for (const exp of expected) {
        const item = allItems.find((i) => i.name === exp.name);
        assert.ok(item, `${exp.name} should exist`);
        assert.equal(item.mpBonus, exp.mpBonus);
    }
});

test('cycle 224: getEquipmentProfile이 main weapon mpBonus 합산', () => {
    const equip = {
        weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30, hands: 2 },
        armor: null,
        offhand: null,
    };
    const profile = getEquipmentProfile(equip);
    assert.ok(profile.mpBonus >= 30,
        `main weapon mpBonus 30이 profile.mpBonus에 반영되어야 함 (실제: ${profile.mpBonus})`);
});

test('cycle 224: getEquipmentProfile이 armor mpBonus 합산', () => {
    const equip = {
        weapon: null,
        armor: { name: '차원의 로브', type: 'armor', val: 60, mpBonus: 45 },
        offhand: null,
    };
    const profile = getEquipmentProfile(equip);
    assert.ok(profile.mpBonus >= 45,
        `armor mpBonus 45가 profile.mpBonus에 반영되어야 함 (실제: ${profile.mpBonus})`);
});

test('cycle 224: weapon + armor + shield mp 모두 합산', () => {
    const equip = {
        weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30 },
        armor: { name: '상급 폭풍 로브', type: 'armor', val: 40, mpBonus: 25 },
        offhand: { name: '룬 마도서', type: 'shield', subtype: 'focus', val: 4, mp: 20 },
    };
    const profile = getEquipmentProfile(equip);
    assert.equal(profile.mpBonus, 75,
        '30 (weapon) + 25 (armor) + 20 (shield offhand) = 75');
});

test('cycle 224: 빙결 지팡이 장착 시 maxMp +30 실제 적용', () => {
    const player = {
        name: 'Test', job: '마법사', level: 10,
        hp: 100, maxHp: 200, mp: 50, maxMp: 100,
        atk: 20, def: 5,
        equip: {
            weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30, hands: 2 },
            armor: null,
            offhand: null,
        },
        relics: [],
        skillChoices: {},
        titles: [],
        stats: {},
    };
    const stats = calculateFullStats(player);
    // baseMaxMp = (player.maxMp + equipmentMpBonus + ...) * relicBonus.mpMult * (1 + affinityMpBonus)
    // 100 + 30 (mpBonus) = 130 minimum
    assert.ok(stats.maxMp >= 130,
        `빙결 지팡이의 mpBonus 30이 maxMp에 반영되어야 함 (baseline 100, 실제: ${stats.maxMp})`);
});

test('cycle 224: mpBonus 없는 무기는 0 영향 (회귀 가드)', () => {
    const equip = {
        weapon: { name: '강철 롱소드', type: 'weapon', val: 30 },
        armor: null,
        offhand: null,
    };
    const profile = getEquipmentProfile(equip);
    assert.equal(profile.mpBonus, 0, 'mpBonus 미설정 weapon은 0 영향');
});

test('cycle 224: shield의 mp 필드는 그대로 동작 (회귀 가드)', () => {
    const equip = {
        weapon: null,
        armor: null,
        offhand: { name: '견습 주문서', type: 'shield', subtype: 'focus', val: 2, mp: 12 },
    };
    const profile = getEquipmentProfile(equip);
    assert.equal(profile.mpBonus, 12, 'focus shield의 mp 12는 보존되어야 함 (cycle 224 회귀 가드)');
});
