import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';

/**
 * cycle 222: Sprint 21 추가 신규 무기 5종이 armors 버킷에 잘못 배치된 회귀 fix.
 *
 * 발견 (content data 오배치):
 * - DB.ITEMS.weapons (정상 weapon 버킷): 112 entries, 모두 type='weapon'.
 * - DB.ITEMS.armors (방어구 버킷): 117 entries, 그러나 type 분포 = armor / shield / **weapon**.
 * - armors 버킷에 5개 weapon-type 아이템이 잘못 placed:
 *   · 세계수의 검 (T5, ATK 192)
 *   · 신전 도시의 지팡이 (T5, ATK 188)
 *   · 균열의 날 (T5, ATK 197)
 *   · 세계수 절멸창 (T6, ATK 310)
 *   · 시간 파편 소드 (T6, ATK 295)
 * - Sprint 21이 신규 지역 테마(세계수 숲 / 고대 신전 도시 / 차원의 균열 등)의
 *   무기와 방어구를 추가하면서 armors 버킷 안에 weapon section을 잘못 추가.
 *
 * 결과 (UX 회귀):
 * - WeaponCodex.tsx:46: `if (category === 'weapons') return DB.ITEMS.weapons || []` —
 *   weapons 카테고리에 5종 누락 → Codex weapons 페이지에서 안 보임.
 * - WeaponCodex.tsx:47-48: armors/shields 필터(type==='armor'/'shield')는 type==='weapon'를
 *   자동 제외 → 다행히 잘못 표시되진 않음.
 * - 그러나 weapons 카테고리에서 영원히 미발견 → codex 100% 달성 불가.
 * - DB.ITEMS.weapons.find(name) 류 lookup도 실패.
 *
 * 수정 (src/data/items.ts):
 * - armors 버킷에서 5개 weapon-type 항목 제거.
 * - weapons 버킷 끝(차원 마왕의 낫 다음)에 T5/T6 신규 weapon section 합류.
 * - 데이터 자체는 변경 없음 — 단순히 올바른 버킷으로 이동.
 *
 * 회귀 가드: WeaponCodex 카테고리 분기는 그대로 유지.
 */

const MISPLACED_NAMES = ['세계수의 검', '신전 도시의 지팡이', '균열의 날', '세계수 절멸창', '시간 파편 소드'];

test('cycle 222: 5 weapon-type 신규 아이템이 DB.ITEMS.weapons 버킷에 있음', () => {
    const weaponNames = new Set((DB.ITEMS.weapons || []).map((w) => w.name));
    const missing = MISPLACED_NAMES.filter((n) => !weaponNames.has(n));
    assert.deepEqual(missing, [],
        `이 5종은 weapons 버킷에 있어야 함 (Codex weapons 페이지에 표시되도록): ${JSON.stringify(missing)}`);
});

test('cycle 222: DB.ITEMS.armors 버킷에는 weapon-type 0건', () => {
    const offenders = (DB.ITEMS.armors || []).filter((a) => a.type === 'weapon').map((a) => a.name);
    assert.deepEqual(offenders, [],
        `armors 버킷은 type='armor' / 'shield'만 포함해야 함. weapon offender: ${JSON.stringify(offenders)}`);
});

test('cycle 222: armors 버킷 type 분포 = armor / shield 만 (정합성 lock)', () => {
    const types = new Set((DB.ITEMS.armors || []).map((a) => a.type).filter(Boolean));
    assert.deepEqual([...types].sort(), ['armor', 'shield']);
});

test('cycle 222: 5 무기 모두 DB.ITEMS.weapons에서 type=weapon 확인', () => {
    for (const name of MISPLACED_NAMES) {
        const item = (DB.ITEMS.weapons || []).find((w) => w.name === name);
        assert.ok(item, `${name} should be in weapons bucket`);
        assert.equal(item.type, 'weapon');
    }
});

test('cycle 222: 무기 데이터 (val/tier/price 등) 보존 (회귀 가드)', () => {
    const expected = [
        { name: '세계수의 검', val: 192, tier: 5 },
        { name: '신전 도시의 지팡이', val: 188, tier: 5 },
        { name: '균열의 날', val: 197, tier: 5 },
        { name: '세계수 절멸창', val: 310, tier: 6 },
        { name: '시간 파편 소드', val: 295, tier: 6 },
    ];
    for (const exp of expected) {
        const item = (DB.ITEMS.weapons || []).find((w) => w.name === exp.name);
        assert.equal(item.val, exp.val, `${exp.name} val=${exp.val}`);
        assert.equal(item.tier, exp.tier, `${exp.name} tier=${exp.tier}`);
    }
});

test('cycle 222: weapons 버킷 type 분포 = weapon만 (회귀 가드)', () => {
    const types = new Set((DB.ITEMS.weapons || []).map((w) => w.type).filter(Boolean));
    assert.deepEqual([...types], ['weapon']);
});
