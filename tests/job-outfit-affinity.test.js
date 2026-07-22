import test from 'node:test';
import assert from 'node:assert/strict';

import { getJobOutfitAffinity } from '../src/utils/jobOutfitAffinity.js';

/**
 * 직업-outfit affinity (cycle 45):
 *   - 각 장비의 jobs[]가 player.job 포함하는지 검사
 *   - 매칭 카운트별 누적 보너스 (페널티 없음)
 *   - 풀 outfit (3/3) → "직업 풀 정체성" 강한 보너스
 *
 * items.js의 기존 jobs 메타데이터 활용 — 추가 데이터 작업 0.
 */

test('빈 player → matchCount 0', () => {
    const aff = getJobOutfitAffinity(null);
    assert.equal(aff.matchCount, 0);
    assert.equal(aff.tier, 'none');
});

test('전사 + 롱소드 (전사 jobs에 포함) → 1/3 매칭', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: { weapon: { name: '롱소드', jobs: ['전사', '모험가', '나이트', '버서커'] } },
    });
    assert.equal(aff.matchCount, 1);
    assert.equal(aff.tier, 'partial1');
    assert.ok(aff.bonus.atkMult > 1);
});

test('전사 + 롱소드 + 가죽 갑옷(전사 jobs 포함) → 2/2 부분', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: {
            weapon: { name: '롱소드', jobs: ['전사', '나이트'] },
            armor: { name: '여행자 튜닉', jobs: ['전사', '모험가'] },
        },
    });
    assert.equal(aff.matchCount, 2);
    assert.equal(aff.tier, 'partial2');
    assert.ok(aff.bonus.atkMult >= 1.15);
});

test('호환 양손무기 단독은 주무기와 보조 손을 차지해 2/3으로 계산', () => {
    const aff = getJobOutfitAffinity({
        job: '레인저',
        equip: {
            weapon: { name: '사냥꾼의 활', type: 'weapon', hands: 2, jobs: ['레인저'] },
            armor: null,
            offhand: null,
        },
    });

    assert.equal(aff.matchCount, 2);
    assert.equal(aff.tier, 'partial2');
    assert.equal(aff.slots.weapon, true);
    assert.equal(aff.slots.offhand, true);
    assert.equal(aff.twoHandCounted, true);
});

test('호환 양손무기와 방어구는 3/3 풀세트 효과를 발동', () => {
    const aff = getJobOutfitAffinity({
        job: '레인저',
        equip: {
            weapon: { name: '사냥꾼의 활', type: 'weapon', hands: 2, jobs: ['레인저'] },
            armor: { name: '사냥꾼의 갑옷', type: 'armor', jobs: ['레인저'] },
            offhand: null,
        },
    });

    assert.equal(aff.matchCount, 3);
    assert.equal(aff.tier, 'full');
    assert.equal(aff.bonus.atkMult, 1.30);
    assert.equal(aff.bonus.defMult, 1.20);
    assert.equal(aff.bonus.hpBonus, 0.10);
    assert.equal(aff.bonus.mpBonus, 0.15);
});

test('직업과 맞지 않는 양손무기는 보조 손 피스를 대신 채우지 않음', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: {
            weapon: { name: '사냥꾼의 활', type: 'weapon', hands: 2, jobs: ['레인저'] },
            armor: { name: '판금 갑옷', type: 'armor', jobs: ['전사'] },
            offhand: null,
        },
    });

    assert.equal(aff.matchCount, 1);
    assert.equal(aff.tier, 'partial1');
    assert.equal(aff.slots.offhand, false);
    assert.equal(aff.twoHandCounted, false);
});

test('전사 풀 outfit (weapon + armor + offhand 모두 jobs 매칭) → full', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: {
            weapon: { name: '롱소드', jobs: ['전사'] },
            armor: { name: '판금 갑옷', jobs: ['전사'] },
            offhand: { name: '목재 방패', jobs: ['전사'] },
        },
    });
    assert.equal(aff.matchCount, 3);
    assert.equal(aff.tier, 'full');
    assert.ok(aff.bonus.atkMult >= 1.30);
    assert.ok(aff.bonus.hpBonus > 0);
    assert.ok(aff.bonus.mpBonus > 0);
});

test('어쌔신 + 단검 (jobs 포함) → 1/1 partial1', () => {
    const aff = getJobOutfitAffinity({
        job: '어쌔신',
        equip: { weapon: { name: '녹슨 단검', jobs: ['모험가', '도적', '마법사', '어쌔신', '레인저'] } },
    });
    assert.equal(aff.matchCount, 1);
    assert.equal(aff.tier, 'partial1');
});

test('전사 + 마법사용 무기 (전사 jobs에 없음) → 0/1 매칭 없음', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: { weapon: { name: '나무지팡이', jobs: ['마법사', '모험가'] } },
    });
    assert.equal(aff.matchCount, 0);
    assert.equal(aff.tier, 'none');
    assert.deepEqual(aff.bonus, {});
});

test('slots 정보가 어느 슬롯이 매칭됐는지 명시', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: {
            weapon: { name: '롱소드', jobs: ['전사'] },
            armor: { name: '로브', jobs: ['마법사'] },
        },
    });
    assert.equal(aff.slots.weapon, true);
    assert.equal(aff.slots.armor, false);
    assert.equal(aff.slots.offhand, false);
});

test('label은 직업별 flavor 명칭 (cycle 53: 흥미 유발 워딩)', () => {
    // 아크메이지 풀세트 → "원소의 군주"
    const affFull = getJobOutfitAffinity({
        job: '아크메이지',
        equip: {
            weapon: { name: '마법지팡이', jobs: ['마법사', '아크메이지', '흑마법사'] },
            armor: { name: '로브', jobs: ['아크메이지'] },
            offhand: { name: '마도서', jobs: ['아크메이지'] },
        },
    });
    assert.equal(affFull.label, '원소의 군주');
    assert.equal(affFull.tier, 'full');

    // 모험가 2/3 → "방랑자의 약속"
    const affPartial2 = getJobOutfitAffinity({
        job: '모험가',
        equip: {
            weapon: { name: '단검', jobs: ['모험가'] },
            armor: { name: '튜닉', jobs: ['모험가'] },
            offhand: null,
        },
    });
    assert.equal(affPartial2.label, '방랑자의 약속');
    assert.equal(affPartial2.tier, 'partial2');

    // 매핑에 없는 직업은 generic fallback
    const affUnknown = getJobOutfitAffinity({
        job: '커스텀직업',
        equip: { weapon: { jobs: ['커스텀직업'] } },
    });
    assert.equal(affUnknown.label, '커스텀직업의 결');
});

test('jobs 메타데이터 없는 장비는 매칭 안 됨', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: { weapon: { name: '신비한 검' } }, // jobs 필드 없음
    });
    assert.equal(aff.matchCount, 0);
});
