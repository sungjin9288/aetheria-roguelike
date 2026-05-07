import test from 'node:test';
import assert from 'node:assert/strict';

import { getWeaponMagicSkills } from '../src/utils/equipmentUtils.js';

/**
 * cycle 256: WEAPON_SKILL_BY_ELEM의 '바람' / '에테르' 누락 dead config
 *   (cycle 222-255 silent dead config 시리즈 28번째).
 *
 * 발견 (WEAPON_SKILL_BY_ELEM 누락):
 * - src/utils/equipmentUtils.ts WEAPON_SKILL_BY_ELEM은 7 elements 정의:
 *   화염 / 냉기 / 어둠 / 빛 / 자연 / 대지 / 물리.
 * - 그러나 src/data/items.ts에는 추가 2 elements 무기 존재:
 *   '바람' (폭풍의 창 tier 4), '에테르' (에테르 검 tier 4 / 차원절단자 tier 5).
 * - 이 weapons은 buildWeaponSkill에서 fallback `WEAPON_SKILL_BY_ELEM.물리` ('아케인 볼트',
 *   mult 2.3, no effect)를 사용 → 고티어 elemental weapons이 일반 '물리' 스킬과 동일.
 * - 결과: 폭풍의 창 / 에테르 검 / 차원절단자 장착 시 '아케인 볼트 · 폭풍의 창' 같은 generic
 *   스킬 — 광고된 element 정체성 0.
 *
 * 패턴 (cycle 222-255 silent dead config 시리즈 28번째):
 * - cycle 251-255: monsters element typo 5사이클 마무리.
 * - cycle 256: weapon skill preset element 매핑 누락 (반대 방향 dead config).
 *
 * 수정 (src/utils/equipmentUtils.ts):
 * - 바람: '게일 컷', wind-themed, mult 2.7, mp 26, cooldown 2 (effect: 'bleed' — 바람이 베어내는 이미지).
 * - 에테르: '디멘션 리프트', ether-themed, mult 3.2, mp 32, cooldown 3 (effect: 'stun' — 차원 진동 마비).
 *
 * 회귀 가드:
 * - 기존 7 elements preset 변화 없음 (화염/냉기/어둠/빛/자연/대지/물리).
 * - getWeaponMagicSkills 시그니처 그대로.
 * - 비-마법 무기는 skill 생성 안 됨 (물리 fallback은 isMagicWeapon 통과 시에만).
 */

test('cycle 256: 바람 element weapon이 "게일 컷" preset 사용', () => {
    const equip = {
        weapon: { type: 'weapon', name: '폭풍의 창', val: 90, elem: '바람', hands: 2 },
    };
    const skills = getWeaponMagicSkills(equip);
    assert.equal(skills.length, 1, '바람 무기 1개의 magic skill 생성');
    const skill = skills[0];
    assert.ok(skill.name.includes('게일') || skill.name.includes('템페스트'),
        `바람 weapon skill 이름이 wind-themed (실제: ${skill.name})`);
    assert.equal(skill.type, '바람', `skill type '바람' (실제: ${skill.type})`);
    assert.notEqual(skill.name, '아케인 볼트 · 폭풍의 창',
        'fallback "아케인 볼트" 사용 안 됨');
});

test('cycle 256: 에테르 element weapon이 ether-themed preset 사용', () => {
    const equip = {
        weapon: { type: 'weapon', name: '에테르 검', val: 85, elem: '에테르' },
    };
    const skills = getWeaponMagicSkills(equip);
    assert.equal(skills.length, 1, '에테르 무기 1개의 magic skill 생성');
    const skill = skills[0];
    // skill.name = '디멘션 리프트 · 에테르 검' 형식. 시작이 '아케인 볼트' fallback 아니어야 함.
    assert.ok(!skill.name.startsWith('아케인 볼트'),
        `에테르 weapon이 fallback "아케인 볼트" 사용 안 함 (실제: ${skill.name})`);
    assert.ok(skill.name.startsWith('디멘션'),
        `에테르 preset '디멘션 리프트'로 시작 (실제: ${skill.name})`);
    assert.equal(skill.type, '에테르', `skill type '에테르' (실제: ${skill.type})`);
});

test('cycle 256: 화염 weapon preset 회귀 가드', () => {
    const equip = {
        weapon: { type: 'weapon', name: '용의 화염', val: 175, elem: '화염', hands: 2 },
    };
    const skills = getWeaponMagicSkills(equip);
    assert.equal(skills.length, 1);
    assert.ok(skills[0].name.includes('이그니스'),
        `화염 preset '이그니스 버스트' 유지 (실제: ${skills[0].name})`);
    assert.equal(skills[0].effect, 'burn', '화염 effect burn 유지');
});

test('cycle 256: 냉기 weapon preset 회귀 가드', () => {
    const equip = {
        weapon: { type: 'weapon', name: '서리칼날', val: 100, elem: '냉기' },
    };
    const skills = getWeaponMagicSkills(equip);
    assert.equal(skills.length, 1);
    assert.ok(skills[0].name.includes('프로스트'),
        `냉기 preset '프로스트 노바' 유지 (실제: ${skills[0].name})`);
});

test('cycle 256: 미정의 element 무기는 fallback "물리" preset (회귀 가드)', () => {
    // 가상 elem (아무도 없는) — 물리 fallback 동작 검증.
    const equip = {
        weapon: { type: 'weapon', name: 'TestSword', val: 50, elem: '미지의속성' },
    };
    const skills = getWeaponMagicSkills(equip);
    assert.equal(skills.length, 1, '미지 elem weapon도 magic 처리');
    assert.ok(skills[0].name.includes('아케인 볼트'),
        `미지 elem fallback '아케인 볼트' (실제: ${skills[0].name})`);
});
