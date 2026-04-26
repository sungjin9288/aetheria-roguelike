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

test('label에 직업 이름 포함', () => {
    const aff = getJobOutfitAffinity({
        job: '아크메이지',
        equip: {
            weapon: { name: '마법지팡이', jobs: ['마법사', '아크메이지', '흑마법사'] },
            armor: { name: '로브', jobs: ['아크메이지'] },
            offhand: { name: '마도서', jobs: ['아크메이지'] },
        },
    });
    assert.match(aff.label, /아크메이지/);
});

test('jobs 메타데이터 없는 장비는 매칭 안 됨', () => {
    const aff = getJobOutfitAffinity({
        job: '전사',
        equip: { weapon: { name: '신비한 검' } }, // jobs 필드 없음
    });
    assert.equal(aff.matchCount, 0);
});
