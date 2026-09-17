import test from 'node:test';
import assert from 'node:assert/strict';

import { RELICS, relicNumber, relicDict } from '../src/data/relics.js';

/**
 * `relicNumber` / `relicDict` 순수 접근자 동치 가드 (2026-09 Wave 4 트랙 M).
 *
 * `Relic.val`을 `any`에서 `effect` 판별 유니온으로 바꾸면서, 판별이 불가능한 소비처
 * 3곳이 접근자를 쓰게 됐다. 이 테스트는 "런타임 변경 0"을 데이터로 증명한다 —
 * RELICS 67종 전체에 대해 접근자 결과가 교체 이전 표현식과 한 글자도 다르지 않아야 한다.
 *
 * 교체된 소비처와 이전 표현식:
 *   1. `systems/CombatEngine.ts` getElementMultiplier
 *      before: `typeof boostRelic?.val === 'number' ? boostRelic.val : 0`
 *      after : `relicNumber(boostRelic)`
 *   2. `utils/statsCalculator.ts` defFlat ('stone_skin' / 죽은 'def_mult' 분기)
 *      before: `acc + r.val`
 *      after : `acc + relicNumber(r)`
 *   3. `utils/hpDrainAtkRelic.ts` makeSelection (object 가드 통과 후)
 *      before: `(relic.val as Record<string, unknown>).atkBonus / .hpCost`
 *      after : `relicDict(relic).atkBonus / .hpCost`
 */

/** 교체 이전 표현식 1 — CombatEngine.getElementMultiplier. */
const legacyNumberOrZero = (relic) => (typeof relic?.val === 'number' ? relic.val : 0);

/** 교체 이전 표현식 3 — hpDrainAtkRelic.makeSelection (object 가드 이후의 dict 읽기). */
const legacyDictRead = (relic, key) => {
    const value = relic?.val;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value[key];
};

test('relicNumber: RELICS 67종 전체에서 교체 이전 표현식과 동치다', () => {
    assert.equal(RELICS.length, 67);
    for (const relic of RELICS) {
        assert.equal(
            relicNumber(relic),
            legacyNumberOrZero(relic),
            `${relic.id}(${relic.effect}): relicNumber 불일치`,
        );
    }
});

test('relicNumber: number val은 그대로, dict/없음은 0을 돌려준다', () => {
    const numericRelics = RELICS.filter((relic) => typeof relic.val === 'number');
    const dictRelics = RELICS.filter((relic) => relic.val && typeof relic.val === 'object');
    const valuelessRelics = RELICS.filter((relic) => relic.val === undefined);
    assert.equal(numericRelics.length + dictRelics.length + valuelessRelics.length, 67);
    assert.ok(numericRelics.length > 0 && dictRelics.length > 0 && valuelessRelics.length > 0);

    for (const relic of numericRelics) assert.equal(relicNumber(relic), relic.val);
    for (const relic of dictRelics) assert.equal(relicNumber(relic), 0);
    for (const relic of valuelessRelics) assert.equal(relicNumber(relic), 0);
    assert.equal(relicNumber(undefined), 0);
    assert.equal(relicNumber(null), 0);
    assert.equal(Number.isNaN(relicNumber({ effect: 'stone_skin', val: { atk: 1 } })), false);
});

test('relicNumber: stone_skin 소비처는 교체 전후 같은 수를 더한다', () => {
    const stoneSkin = RELICS.find((relic) => relic.effect === 'stone_skin');
    assert.ok(stoneSkin, 'stone_skin 유물이 카탈로그에 있어야 한다');
    assert.equal(relicNumber(stoneSkin), stoneSkin.val);
    assert.equal(0 + relicNumber(stoneSkin), 0 + stoneSkin.val);
});

test('relicNumber: elem_boost 소비처는 교체 전후 같은 배율을 만든다', () => {
    const boost = RELICS.find((relic) => relic.effect === 'elem_boost');
    assert.ok(boost, 'elem_boost 유물이 카탈로그에 있어야 한다');
    assert.equal(relicNumber(boost), legacyNumberOrZero(boost));
    assert.equal(relicNumber(undefined), legacyNumberOrZero(undefined));
});

test('relicDict: dict val은 같은 참조를, 그 외에는 빈 객체를 돌려준다', () => {
    for (const relic of RELICS) {
        if (relic.val && typeof relic.val === 'object') {
            assert.equal(relicDict(relic), relic.val, `${relic.id}: dict 참조가 바뀌었다`);
        } else {
            assert.deepEqual(relicDict(relic), {}, `${relic.id}: dict가 아닌데 빈 객체가 아니다`);
        }
    }
    assert.deepEqual(relicDict(undefined), {});
    assert.deepEqual(relicDict(null), {});
    assert.deepEqual(relicDict({ effect: 'stone_skin', val: 0.25 }), {});
});

test('relicDict: RELICS 67종 전체에서 키 읽기가 교체 이전 표현식과 동치다', () => {
    for (const relic of RELICS) {
        const keys = relic.val && typeof relic.val === 'object' ? Object.keys(relic.val) : [];
        for (const key of [...keys, 'atkBonus', 'hpCost', 'missingKey']) {
            assert.equal(
                relicDict(relic)[key],
                legacyDictRead(relic, key),
                `${relic.id}(${relic.effect}).${key}: relicDict 불일치`,
            );
        }
    }
});

test('relicDict: hp_drain_atk 소비처는 교체 전후 같은 atkBonus/hpCost를 읽는다', () => {
    const family = RELICS.filter((relic) => relic.effect === 'hp_drain_atk');
    assert.equal(family.length, 2);
    for (const relic of family) {
        assert.equal(relicDict(relic).atkBonus, legacyDictRead(relic, 'atkBonus'));
        assert.equal(relicDict(relic).hpCost, legacyDictRead(relic, 'hpCost'));
        assert.equal(typeof relicDict(relic).atkBonus, 'number');
        assert.equal(typeof relicDict(relic).hpCost, 'number');
    }
});
