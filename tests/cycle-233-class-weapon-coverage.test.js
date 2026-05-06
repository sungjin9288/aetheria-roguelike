import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';

/**
 * cycle 233: 3 classes (성직자 / 드래곤 나이트 / 무당)의 사용 가능 weapon 0개 회귀 fix.
 *
 * 발견 (content gap):
 * - DB.CLASSES 18종 / DB.ITEMS.weapons 117종.
 * - 그러나 사용 가능 weapon 0개:
 *   · 성직자 (T1, mage path, mpMod=1.6): 0 weapons.
 *   · 드래곤 나이트 (T3, warrior path, hpMod=1.9): 0 weapons.
 *   · 무당 (T2, mage path, mpMod=1.6): 0 weapons.
 * - 모든 weapon에 jobs[] array가 정의되어 있지만 위 3 class를 포함 안 함.
 * - 결과: 이 3 클래스로 플레이하는 동안 '맨손' 외에 무기 장착 불가 — 게임 무진행.
 *
 * 패턴 (cycle 222-229, 231 dead/orphan content 시리즈 lens 확장):
 * - 정의됐으나 도달/사용 불가능한 컨텐츠 — 명시적 player-facing 회귀.
 *
 * 수정 (src/data/items.ts):
 * - 성직자: mage staffs + holy weapons (마법봉/지팡이류 + 성스러운 창/검).
 * - 무당: mage staffs + dark/curse 무기 (마법봉/지팡이류 + 어둠/저주 themed).
 * - 드래곤 나이트: warrior heavy weapons (검/창/도끼류).
 * - 각 클래스가 최소 5종 이상 weapon 사용 가능 보장 (T1-T6 분포).
 *
 * 회귀 가드:
 * - 기존 jobs[] 항목은 보존.
 * - 다른 클래스(전사/마법사 등) 영향 0.
 */

const ALL_JOBS = ['모험가', '전사', '마법사', '도적', '나이트', '버서커', '아크메이지', '흑마법사', '어쌔신', '레인저', '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '무당', '시간술사', '사냥의 군주'];

test('cycle 233: 모든 18 classes가 최소 5 weapons 사용 가능', () => {
    const weapons = DB.ITEMS.weapons || [];
    const insufficient = [];
    for (const job of ALL_JOBS) {
        const usable = weapons.filter((w) => !Array.isArray(w.jobs) || w.jobs.includes(job));
        if (usable.length < 5) {
            insufficient.push(`${job}: ${usable.length}`);
        }
    }
    assert.deepEqual(insufficient, [],
        `모든 클래스가 5+ weapons 사용 가능해야 함. 부족: ${JSON.stringify(insufficient)}`);
});

test('cycle 233: 성직자 5+ weapons (priest path coverage)', () => {
    const usable = (DB.ITEMS.weapons || []).filter((w) => !Array.isArray(w.jobs) || w.jobs.includes('성직자'));
    assert.ok(usable.length >= 5, `성직자: ${usable.length} weapons (>= 5 필요)`);
});

test('cycle 233: 무당 5+ weapons (shaman path coverage)', () => {
    const usable = (DB.ITEMS.weapons || []).filter((w) => !Array.isArray(w.jobs) || w.jobs.includes('무당'));
    assert.ok(usable.length >= 5, `무당: ${usable.length} weapons (>= 5 필요)`);
});

test('cycle 233: 드래곤 나이트 5+ weapons (Dragon Knight path coverage)', () => {
    const usable = (DB.ITEMS.weapons || []).filter((w) => !Array.isArray(w.jobs) || w.jobs.includes('드래곤 나이트'));
    assert.ok(usable.length >= 5, `드래곤 나이트: ${usable.length} weapons (>= 5 필요)`);
});

test('cycle 233: 기존 클래스 weapon 수 보존 (전사/마법사 등 회귀 가드)', () => {
    const weapons = DB.ITEMS.weapons || [];
    // 전사/마법사/도적은 이미 19+ weapons. 변경 후에도 보존.
    assert.ok(weapons.filter((w) => w.jobs?.includes('전사')).length >= 30);
    assert.ok(weapons.filter((w) => w.jobs?.includes('마법사')).length >= 19);
    assert.ok(weapons.filter((w) => w.jobs?.includes('도적')).length >= 19);
});
