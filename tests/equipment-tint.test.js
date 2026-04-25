import test from 'node:test';
import assert from 'node:assert/strict';

import { getEquipmentTintFilter } from '../src/utils/equipmentTint.js';

/**
 * 일반 장비 per-item tint — Phase D: 시그니처가 아닌 무기/방어구가 family overlay
 * PNG 1종을 공유해 같은 family의 모든 아이템이 똑같이 보이는 한계를 해소한다.
 *
 * 시그니처는 이미 PNG에 색이 들어있어 추가 tint를 하면 색이 깨지므로 skip.
 *
 * 계약:
 *   1. 비-아이템(null/undefined) → null
 *   2. 시그니처 아이템 → null (skip, 자체 art 보존)
 *   3. 이름 hint(녹슨/성/어둠/세계수 등)에 따라 hue-rotate가 다르게 적용됨
 *   4. 같은 family 다른 hint → 다른 filter (즉 시각 차별화 발생)
 *   5. tier 영향 — 상위 tier일수록 saturate/brightness 살짝 부스트
 *   6. 매칭되는 hint도 elem도 없으면 null (필터 미적용)
 */

test('null/undefined input returns null', () => {
    assert.equal(getEquipmentTintFilter(null), null);
    assert.equal(getEquipmentTintFilter(undefined), null);
});

test('signature items skip tinting (preserve their dedicated art)', () => {
    // 성검 에테르니아는 SIGNATURE_ITEM_REGISTRY 등록 시그니처
    assert.equal(getEquipmentTintFilter({ name: '성검 에테르니아', type: 'weapon', tier: 5 }), null);
});

test('rust hint produces a hue-rotate filter', () => {
    const filter = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 1 });
    assert.match(filter || '', /hue-rotate\(-20deg\)/);
    assert.match(filter || '', /saturate\(/);
    assert.match(filter || '', /brightness\(/);
});

test('holy hint produces a different (gold-shifted) filter', () => {
    const filter = getEquipmentTintFilter({ name: '성광의 검', type: 'weapon', tier: 3 });
    assert.match(filter || '', /hue-rotate\(35deg\)/);
});

test('shadow hint produces a dark-purple shifted filter distinct from rust', () => {
    const rust = getEquipmentTintFilter({ name: '녹슨 도끼', type: 'weapon', tier: 1 });
    const shadow = getEquipmentTintFilter({ name: '어둠의 단검', type: 'weapon', tier: 1 });
    assert.notEqual(rust, shadow, 'different hints must produce different filters');
    assert.match(shadow || '', /hue-rotate\(270deg\)/);
});

test('nature hint matches even on long descriptive names', () => {
    const filter = getEquipmentTintFilter({ name: '세계수 절멸창', type: 'weapon', tier: 4 });
    assert.match(filter || '', /hue-rotate\(100deg\)/);
});

test('elem fallback when no name hint matches', () => {
    const filter = getEquipmentTintFilter({ name: '평범한 도끼', type: 'weapon', tier: 1, elem: '냉기' });
    assert.match(filter || '', /hue-rotate\(180deg\)/);
});

test('higher tier brightens (>=4)', () => {
    const t1 = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 1 });
    const t5 = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 5 });
    assert.notEqual(t1, t5, 'tier should change filter');
    // tier 5 → brightness * 1.08, saturate * (1 + 0.04)
    assert.match(t5 || '', /brightness\(0\.92\)/);  // 0.85 * 1.08 = 0.918
});

test('no hint and no elem returns null (silence)', () => {
    const filter = getEquipmentTintFilter({ name: '평범한 무기', type: 'weapon', tier: 1 });
    assert.equal(filter, null);
});
