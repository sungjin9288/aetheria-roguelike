import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';

/**
 * cycle 234: 7 classes의 armor 사용 가능 baseline 5+로 확장 (cycle 233 lens follow-up).
 *
 * 발견 (armor coverage gap):
 * - cycle 233에서 weapon coverage fix.
 * - 그러나 armor coverage도 동일 회귀:
 *   · 성직자 / 드래곤 나이트 / 무당 / 시간술사: 0 armors.
 *   · 대마법사 / 그림자 주군 / 사냥의 군주: 1 armor.
 *   · 팔라딘: 2 armors.
 * - 결과: 4 클래스가 armor 0 (천옷 외 장착 불가) — cycle 233 weapon fix와 같은 결.
 *
 * 패턴 (cycle 222-229, 231, 233 dead/orphan content 시리즈 lens):
 * - cycle 233: weapon coverage.
 * - cycle 234: armor coverage (parallel content gap).
 *
 * 수정 (src/data/items.ts):
 * - mage path armors의 jobs[]에 성직자 / 무당 / 대마법사 / 시간술사 추가.
 * - warrior path armors의 jobs[]에 드래곤 나이트 / 팔라딘 추가.
 * - rogue path armors의 jobs[]에 그림자 주군 / 사냥의 군주 추가.
 *
 * 회귀 가드:
 * - 기존 jobs[] 보존.
 * - shield는 워리어 클래스만 — 4 mage 클래스는 shield 0 OK (디자인 의도).
 */

const ALL_JOBS = ['모험가', '전사', '마법사', '도적', '나이트', '버서커', '아크메이지', '흑마법사', '어쌔신', '레인저', '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '무당', '시간술사', '사냥의 군주'];

test('cycle 234: 모든 18 classes가 최소 5 armors 사용 가능', () => {
    const armors = (DB.ITEMS.armors || []).filter((a) => a.type === 'armor');
    const insufficient = [];
    for (const job of ALL_JOBS) {
        const usable = armors.filter((a) => !Array.isArray(a.jobs) || a.jobs.includes(job));
        if (usable.length < 5) {
            insufficient.push(`${job}: ${usable.length}`);
        }
    }
    assert.deepEqual(insufficient, [],
        `모든 클래스가 5+ armors 사용 가능해야 함. 부족: ${JSON.stringify(insufficient)}`);
});

test('cycle 234: 4 zero-armor classes 회귀 fix', () => {
    const armors = (DB.ITEMS.armors || []).filter((a) => a.type === 'armor');
    const zeroFixed = ['성직자', '드래곤 나이트', '무당', '시간술사'];
    for (const job of zeroFixed) {
        const usable = armors.filter((a) => !Array.isArray(a.jobs) || a.jobs.includes(job));
        assert.ok(usable.length >= 5,
            `${job}: ${usable.length} armors (>= 5 필요, cycle 234 fix)`);
    }
});

test('cycle 233 회귀 가드: weapon coverage 유지 (모든 18 classes >= 5 weapons)', () => {
    const weapons = DB.ITEMS.weapons || [];
    for (const job of ALL_JOBS) {
        const usable = weapons.filter((w) => !Array.isArray(w.jobs) || w.jobs.includes(job));
        assert.ok(usable.length >= 5, `cycle 233 weapon coverage: ${job} (${usable.length})`);
    }
});

test('cycle 234: 기존 armor jobs[] 보존 (회귀 가드)', () => {
    const armors = (DB.ITEMS.armors || []).filter((a) => a.type === 'armor');
    // 전사/마법사/도적은 이미 다수의 armor. 변경 후에도 보존.
    const warriorCount = armors.filter((a) => a.jobs?.includes('전사')).length;
    const mageCount = armors.filter((a) => a.jobs?.includes('마법사')).length;
    const thiefCount = armors.filter((a) => a.jobs?.includes('도적')).length;
    assert.ok(warriorCount >= 20, `전사 armor 보존 (${warriorCount})`);
    assert.ok(mageCount >= 10, `마법사 armor 보존 (${mageCount})`);
    assert.ok(thiefCount >= 15, `도적 armor 보존 (${thiefCount})`);
});
