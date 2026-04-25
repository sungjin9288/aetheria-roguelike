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

// --- Cycle 34: tier-based drop-shadow glow ---

test('tier 1-2 items do NOT add drop-shadow glow', () => {
    const t1 = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 1 });
    const t2 = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 2 });
    assert.ok(!/drop-shadow/.test(t1 || ''), `tier 1 should NOT have drop-shadow, got: ${t1}`);
    assert.ok(!/drop-shadow/.test(t2 || ''), `tier 2 should NOT have drop-shadow, got: ${t2}`);
});

test('tier 3+ items add drop-shadow glow', () => {
    const t3 = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 3 });
    const t5 = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 5 });
    assert.match(t3 || '', /drop-shadow\(/);
    assert.match(t5 || '', /drop-shadow\(/);
});

test('higher tier produces stronger glow (larger blur radius)', () => {
    const t3 = getEquipmentTintFilter({ name: '성광의 검', type: 'weapon', tier: 3 });
    const t5 = getEquipmentTintFilter({ name: '성광의 검', type: 'weapon', tier: 5 });
    // Extract blur radius from "drop-shadow(0 0 Npx ...)"
    const t3Match = (t3 || '').match(/drop-shadow\(0 0 (\d+(?:\.\d+)?)px/);
    const t5Match = (t5 || '').match(/drop-shadow\(0 0 (\d+(?:\.\d+)?)px/);
    assert.ok(t3Match && t5Match, 'both tiers should have drop-shadow');
    const t3Blur = Number.parseFloat(t3Match[1]);
    const t5Blur = Number.parseFloat(t5Match[1]);
    assert.ok(t5Blur > t3Blur, `tier 5 blur (${t5Blur}) should exceed tier 3 blur (${t3Blur})`);
});

test('glow color matches hint palette (rust → orange-ish, holy → gold)', () => {
    const rustGlow = getEquipmentTintFilter({ name: '녹슨 단검', type: 'weapon', tier: 4 });
    const holyGlow = getEquipmentTintFilter({ name: '성광의 검', type: 'weapon', tier: 4 });
    // Different hints should produce different glow colors
    const rustColor = (rustGlow || '').match(/drop-shadow\([^)]*?(rgb[a]?\([^)]+\)|#[0-9a-f]{3,6})/i);
    const holyColor = (holyGlow || '').match(/drop-shadow\([^)]*?(rgb[a]?\([^)]+\)|#[0-9a-f]{3,6})/i);
    assert.ok(rustColor, `rust glow should specify a color, got: ${rustGlow}`);
    assert.ok(holyColor, `holy glow should specify a color, got: ${holyGlow}`);
    assert.notEqual(rustColor[1], holyColor[1], 'rust and holy glows should use distinct colors');
});

test('signature items still skip glow (their PNG art handles it)', () => {
    assert.equal(
        getEquipmentTintFilter({ name: '성검 에테르니아', type: 'weapon', tier: 5 }),
        null,
        'signature items must not be tinted/glowed (they have dedicated art)'
    );
});
