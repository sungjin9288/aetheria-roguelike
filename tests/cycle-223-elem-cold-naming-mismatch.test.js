import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';

/**
 * cycle 223: 얼음/냉기 element naming inconsistency fix (cycle 222 content audit lens 확장).
 *
 * 발견 (element naming 분기):
 * - 39 monsters use weakness='냉기' (cold 표준 convention).
 * - 0 monsters use weakness='얼음'.
 * - 그러나 3 items use elem='얼음':
 *   · 빙결 지팡이 (T4 weapon, ATK 70, mage)
 *   · 빙하의 지팡이 (T5 weapon, ATK 110, mage)
 *   · 빙화 경갑 (T4 armor, DEF 45)
 * - CombatEngine.getElementMultiplier는 'enemy.weakness === elem' exact compare.
 * - 결과: '얼음' 아이템은 '냉기' weakness 몬스터에서 ELEMENT_WEAK_MULT 적용 안 됨 →
 *   element 보너스 영원히 미발현 → 데이터상으로 'cold' 컨셉이지만 게임플레이상
 *   일반 무기와 같은 dmg multiplier.
 *
 * 추정 origin: 데이터 작성 시점에 두 표기 ('얼음' / '냉기') 혼용. 표준 convention은
 * '냉기' (15 items + 39 monsters 사용).
 *
 * 수정 (src/data/items.ts):
 * - 3 items의 elem: '얼음' → '냉기'.
 * - desc_stat의 '(빙)' → '(냉)' (15 냉기 items 동일 convention).
 *
 * 회귀 가드:
 * - 0 items with elem='얼음' (전체 표준 통일).
 * - 18 items with elem='냉기' (기존 15 + 변환된 3).
 * - 39 monsters with weakness='냉기' 보존.
 *
 * 영향:
 * - 빙결 지팡이 / 빙하의 지팡이 / 빙화 경갑 사용자가 '냉기' 약점 39 몬스터에
 *   (BALANCE.ELEMENT_WEAK_MULT × ATK) 보너스 deal 가능 → 의도된 cold 컨셉 활성화.
 * - cycle 137 lens (BALANCE.X 미참조 dead config)와 같은 결 — 데이터상 의도된 효과가
 *   실제로는 dispatch path 단절로 무력화되던 silent 회귀.
 */

test('cycle 223: items 중 elem=얼음 0건 (표준 통일)', () => {
    const offenders = [];
    for (const bucket of ['weapons', 'armors']) {
        for (const item of (DB.ITEMS[bucket] || [])) {
            if (item.elem === '얼음') offenders.push(`${bucket}/${item.name}`);
        }
    }
    assert.deepEqual(offenders, [], `elem='얼음' 사용 아이템 0건이어야 함 (모두 '냉기'로 통일): ${JSON.stringify(offenders)}`);
});

test('cycle 223: 3 items이 elem=냉기로 변환됨', () => {
    const expected = ['빙결 지팡이', '빙하의 지팡이', '빙화 경갑'];
    const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
    for (const name of expected) {
        const item = allItems.find((i) => i.name === name);
        assert.ok(item, `${name} should exist`);
        assert.equal(item.elem, '냉기', `${name} elem='냉기'`);
    }
});

test('cycle 223: 3 items의 desc_stat이 (빙) → (냉) 변환됨', () => {
    const expected = [
        { name: '빙결 지팡이', stat: 'ATK+70(냉) MP+30 / 2H' },
        { name: '빙하의 지팡이', stat: 'ATK+110(냉) MP+50 / 2H' },
        { name: '빙화 경갑', stat: 'DEF+45(냉)' },
    ];
    const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
    for (const exp of expected) {
        const item = allItems.find((i) => i.name === exp.name);
        assert.equal(item.desc_stat, exp.stat, `${exp.name} desc_stat='${exp.stat}'`);
    }
});

test('cycle 223: 39 monsters가 weakness=냉기 보존 (회귀 가드)', () => {
    const count = Object.values(DB.MONSTERS || {}).filter((m) => m.weakness === '냉기').length;
    assert.ok(count >= 39, `weakness='냉기' 몬스터 39+ 유지 (실제: ${count})`);
});

test('cycle 223: items 중 elem=냉기가 17+ 건 (weapons/armors 버킷, 변환 3건 포함)', () => {
    let count = 0;
    for (const bucket of ['weapons', 'armors']) {
        for (const item of (DB.ITEMS[bucket] || [])) {
            if (item.elem === '냉기') count++;
        }
    }
    // 변환 전: 14건 (weapons 8 + armors 6). 변환 후: 17건 (weapons 9 + armors 8 — 빙결/빙하 weapon 2 + 빙화 armor 1).
    assert.ok(count >= 17, `elem='냉기' 아이템 17+ 건 (실제: ${count})`);
});

test('cycle 222 회귀 가드: 5 weapons가 weapons 버킷에 보존', () => {
    const weaponNames = new Set((DB.ITEMS.weapons || []).map((w) => w.name));
    const expected = ['세계수의 검', '신전 도시의 지팡이', '균열의 날', '세계수 절멸창', '시간 파편 소드'];
    for (const n of expected) {
        assert.ok(weaponNames.has(n), `${n} should remain in weapons bucket`);
    }
});
