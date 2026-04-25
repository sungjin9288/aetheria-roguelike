import test from 'node:test';
import assert from 'node:assert/strict';

import { getEquipmentOverlayAssetSrc } from '../src/utils/itemVisuals.js';

/**
 * Avatar 시각 일관성 — 실기기 QA 발견 이슈.
 *
 * 베이스 sprite (adventurer-dagger.png 등)는 chibi 픽셀 일러스트로 손에 든 무기까지
 * 모두 baked-in 상태인데, AvatarEquipmentOverlay가 그 위에 procedural한
 * /equipment-family/overlays/weapon-dagger.png를 추가로 깔아왔다. 이 PNG는
 * 인벤토리 아이템 아이콘용 standalone dagger(십자가드/손잡이/폼멜 포함)이라
 * 캐릭터 위에 올리면 (1) 무기가 두 번 그려지는 redundancy, (2) chibi vs
 * procedural 스타일 충돌이 동시에 발생.
 *
 * 시그니처 아이템은 별도로 character-overlay-quality assets
 * (/equipment-wearable-exact/signature-*.png)를 가지고 있으므로 그건 유지.
 *
 * 계약:
 *   1. signature 아이템은 /equipment-wearable-exact/signature-*.png 경로 반환
 *   2. 일반 weapon/armor/shield는 null 반환 → AvatarEquipmentOverlay에서 자동 skip
 *      (베이스 sprite로 충분)
 *   3. 비장비(materials/consumables)는 기존대로 null 반환
 */

test('signature weapon resolves to equipment-wearable-exact path', () => {
    // 성검 에테르니아는 SIGNATURE_SPRITE_KEY_BY_NAME에 등록된 시그니처
    const src = getEquipmentOverlayAssetSrc({ name: '성검 에테르니아', type: 'weapon' });
    assert.match(src || '', /\/assets\/equipment-wearable-exact\/.+\.png$/);
});

test('common (non-signature) weapon returns null — base sprite covers it', () => {
    // 녹슨 단검은 일반 weapon, 베이스 sprite adventurer-dagger.png에 이미 baked-in
    const src = getEquipmentOverlayAssetSrc({ name: '녹슨 단검', type: 'weapon' });
    assert.equal(src, null, 'common weapons must not produce procedural overlay (causes style mismatch)');
});

test('common (non-signature) armor returns null', () => {
    const src = getEquipmentOverlayAssetSrc({ name: '여행자 튜닉', type: 'armor' });
    assert.equal(src, null, 'common armor must not produce procedural overlay');
});

test('common (non-signature) shield returns null', () => {
    const src = getEquipmentOverlayAssetSrc({ name: '나무 방패', type: 'shield' });
    assert.equal(src, null, 'common shield must not produce procedural overlay');
});

test('non-equipment items (materials, consumables) still return null', () => {
    assert.equal(getEquipmentOverlayAssetSrc({ name: '체력 물약', type: 'hp' }), null);
    assert.equal(getEquipmentOverlayAssetSrc({ name: '강화 재료', type: 'mat' }), null);
    assert.equal(getEquipmentOverlayAssetSrc(null), null);
});
