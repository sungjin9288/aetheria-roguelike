import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SIGNATURE_CANDIDATES,
    SIGNATURE_ITEM_REGISTRY,
    getSignatureItemCount,
    getSignatureMetadata,
    getSignatureSpriteKey,
    hasDedicatedSignatureArt,
    isSignatureItem,
} from '../src/data/signatureItems.js';
import { ITEMS } from '../src/data/items.js';
import {
    SPECIAL_ITEM_ICON_KEYS,
    getEquipmentOverlayAssetSrc,
    getItemIconAssetSrc,
} from '../src/utils/itemVisuals.js';

test('isSignatureItem returns true for items already registered in SPECIAL_ITEM_ICON_KEYS', () => {
    assert.equal(isSignatureItem({ name: '성검 에테르니아' }), true);
    assert.equal(isSignatureItem({ name: '마왕의 대낫' }), true);
});

test('isSignatureItem returns false for plain family items', () => {
    assert.equal(isSignatureItem({ name: '녹슨 단검' }), false);
    assert.equal(isSignatureItem({ name: '나무지팡이' }), false);
    assert.equal(isSignatureItem(null), false);
    assert.equal(isSignatureItem(undefined), false);
});

test('getSignatureSpriteKey returns the dedicated signature key when available', () => {
    const key = getSignatureSpriteKey({ name: '성검 에테르니아' });
    assert.equal(key, 'signature-weapon-ethernia');
});

test('getSignatureSpriteKey falls back to SPECIAL_ITEM_ICON_KEYS for named-but-not-dedicated items', () => {
    // 현자의 예복 is in SPECIAL_ITEM_ICON_KEYS but not in SIGNATURE_ITEM_REGISTRY (tinted fallback).
    const key = getSignatureSpriteKey({ name: '현자의 예복' });
    assert.equal(key, SPECIAL_ITEM_ICON_KEYS['현자의 예복']);
    assert.doesNotMatch(key, /^signature-/);
});

test('getSignatureSpriteKey returns null for family items', () => {
    assert.equal(getSignatureSpriteKey({ name: '녹슨 단검' }), null);
    assert.equal(getSignatureSpriteKey(null), null);
});

test('hasDedicatedSignatureArt distinguishes dedicated Tier S/A art from tinted named items', () => {
    assert.equal(hasDedicatedSignatureArt({ name: '성검 에테르니아' }), true);
    assert.equal(hasDedicatedSignatureArt({ name: '드래곤로드 갑주' }), true);
    // 현자의 예복 is named-tinted only, no dedicated art
    assert.equal(hasDedicatedSignatureArt({ name: '현자의 예복' }), false);
    assert.equal(hasDedicatedSignatureArt({ name: '녹슨 단검' }), false);
});

test('getSignatureMetadata returns tier/category/tone/artNote for registered signatures', () => {
    const meta = getSignatureMetadata({ name: '마왕의 대낫' });
    assert.ok(meta);
    assert.equal(meta.tier, 'legendary');
    assert.equal(meta.category, 'boss-drop');
    assert.equal(meta.tone, 'shadow');
    assert.ok(meta.artNote);
});

test('getSignatureMetadata returns null for non-signature items', () => {
    assert.equal(getSignatureMetadata({ name: '녹슨 단검' }), null);
    assert.equal(getSignatureMetadata(null), null);
});

test('SIGNATURE_CANDIDATES all reference real items in the catalog', () => {
    const allItemNames = new Set(
        Object.values(ITEMS).flat().filter(Boolean).map((item) => item.name)
    );
    for (const candidate of SIGNATURE_CANDIDATES) {
        assert.equal(
            allItemNames.has(candidate.itemName),
            true,
            `Candidate "${candidate.itemName}" must exist in items.js`
        );
    }
});

test('SIGNATURE_CANDIDATES all have required metadata fields', () => {
    for (const candidate of SIGNATURE_CANDIDATES) {
        assert.ok(candidate.itemName, 'itemName required');
        assert.ok(['weapon', 'armor', 'shield'].includes(candidate.slot), `slot must be weapon/armor/shield, got ${candidate.slot}`);
        assert.ok(candidate.reason && candidate.reason.length > 5, 'reason must be a non-trivial string');
    }
});

test('SIGNATURE_CANDIDATES has 10-20 entries as per art direction guidance', () => {
    assert.ok(SIGNATURE_CANDIDATES.length >= 10, `Expected at least 10 candidates, got ${SIGNATURE_CANDIDATES.length}`);
    assert.ok(SIGNATURE_CANDIDATES.length <= 25, `Expected at most 25 candidates, got ${SIGNATURE_CANDIDATES.length}`);
});

test('getSignatureItemCount returns a breakdown of dedicated + tinted signatures', () => {
    const count = getSignatureItemCount();
    assert.ok(count.total > 0);
    assert.ok(count.dedicated >= 5, 'At least 5 dedicated signatures (Tier S)');
    assert.ok(count.namedTinted > 0);
    assert.ok(count.total >= count.dedicated);
});

test('SIGNATURE_ITEM_REGISTRY has the 5 Tier S entries with dedicated sprite keys', () => {
    assert.equal(typeof SIGNATURE_ITEM_REGISTRY, 'object');
    assert.ok(Object.isFrozen(SIGNATURE_ITEM_REGISTRY));
    for (const name of ['성검 에테르니아', '마왕의 대낫', '라그나로크', '차원 마왕의 낫', '천공 성전']) {
        assert.ok(SIGNATURE_ITEM_REGISTRY[name], `${name} should be registered`);
        assert.match(SIGNATURE_ITEM_REGISTRY[name].spriteKey, /^signature-/);
    }
});

test('SIGNATURE_ITEM_REGISTRY has the 10 Tier A entries', () => {
    const tierA = [
        '드래곤로드 갑주', '암흑 군주의 망토', '세계수의 지팡이', '차원 방패 이지스', '에테르 그리모어',
        '천벌의 지팡이', '빙결의 왕관검', '바람의 궁극', '그림자 절단기', '성스러운 창',
    ];
    for (const name of tierA) {
        assert.ok(SIGNATURE_ITEM_REGISTRY[name], `Tier A ${name} should be registered`);
    }
});

test('SIGNATURE_ITEM_REGISTRY has the 5 Tier B entries', () => {
    const tierB = [
        '용의 화염', '세계수의 검', '신전 도시의 지팡이', '광기의 갑주', '세계수의 로브',
    ];
    for (const name of tierB) {
        assert.ok(SIGNATURE_ITEM_REGISTRY[name], `Tier B ${name} should be registered`);
        assert.match(SIGNATURE_ITEM_REGISTRY[name].spriteKey, /^signature-/);
    }
});

test('registry reaches 20 dedicated signatures total', () => {
    const count = getSignatureItemCount();
    assert.ok(count.dedicated >= 20, `Expected at least 20 dedicated signatures, got ${count.dedicated}`);
});

test('getItemIconAssetSrc prefers signature sprite path for Tier S items', () => {
    const src = getItemIconAssetSrc({ name: '성검 에테르니아', type: 'weapon' });
    assert.equal(src, '/assets/equipment-exact/signature-weapon-ethernia.png');
});

test('getEquipmentOverlayAssetSrc prefers signature wearable path for Tier S items', () => {
    const src = getEquipmentOverlayAssetSrc({ name: '라그나로크', type: 'weapon', hands: 2 });
    assert.equal(src, '/assets/equipment-wearable-exact/signature-weapon-ragnarok.png');
});

test('getItemIconAssetSrc falls back to family/tinted art for non-signature items', () => {
    const src = getItemIconAssetSrc({ name: '녹슨 단검', type: 'weapon' });
    // should NOT contain 'signature-' prefix
    assert.doesNotMatch(src, /signature-/);
});
