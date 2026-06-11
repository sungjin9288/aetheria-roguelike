import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    EXACT_ITEM_ICON_KEYS,
    EQUIPMENT_FAMILY_ITEM_ASSET_KEYS,
    EQUIPMENT_FAMILY_OVERLAY_ASSET_KEYS,
    getEquipmentIllustrationFamilyKey,
    getExactEquipmentItemAssetKey,
    getArmorStyleFromItem,
    getAvatarLoadoutStyle,
    getEquipmentVisualKey,
    getEquipmentWearableFamilyKey,
    getItemIconAssetSrc,
    getNonEquipmentIllustrationFamilyKey,
    getWeaponVisualKey,
    ITEM_ICON_ASSET_KEYS,
    NON_EQUIPMENT_FAMILY_ITEM_ASSET_KEYS,
    SPECIAL_ITEM_ICON_KEYS,
    shouldUseAvatarPreviewItemIcon,
} from '../src/utils/itemVisuals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const itemAssetDir = path.resolve(__dirname, '../public/assets/items');
const equipmentFamilyItemDir = path.resolve(__dirname, '../public/assets/equipment-family/items');
const equipmentFamilyOverlayDir = path.resolve(__dirname, '../public/assets/equipment-family/overlays');
const equipmentExactDir = path.resolve(__dirname, '../public/assets/equipment-exact');
const hasItemAsset = (key) => existsSync(path.join(itemAssetDir, `${key}.png`)) || existsSync(path.join(itemAssetDir, `${key}.svg`));
const hasEquipmentFamilyItemAsset = (key) => existsSync(path.join(equipmentFamilyItemDir, `${key}.png`));
const hasEquipmentFamilyOverlayAsset = (key) => existsSync(path.join(equipmentFamilyOverlayDir, `${key}.png`));
const hasEquipmentExactAsset = (key) => existsSync(path.join(equipmentExactDir, `${key}.png`));

test('getEquipmentVisualKey maps representative equipment families to distinct asset keys', () => {
    assert.equal(getEquipmentVisualKey({ name: '시험용 중형 도끼', type: 'weapon', hands: 2 }), 'greataxe');
    assert.equal(getEquipmentVisualKey({ name: '시험용 전쟁망치', type: 'weapon', hands: 2 }), 'hammer');
    assert.equal(getEquipmentVisualKey({ name: '시험용 기병창', type: 'weapon', hands: 2 }), 'lance');
    assert.equal(getEquipmentVisualKey({ name: '시험용 독니 단검', type: 'weapon' }), 'dagger');
    assert.equal(getEquipmentVisualKey({ name: '시험용 심연 지팡이', type: 'weapon', hands: 2, elem: '어둠' }), 'staff');
    assert.equal(getEquipmentVisualKey({ name: '시험용 심연 마도서', type: 'shield', subtype: 'focus' }), 'book');
    assert.equal(getEquipmentVisualKey({ name: '시험용 의식 로브', type: 'armor' }), 'robe');
    assert.equal(getEquipmentVisualKey({ name: '시험용 전령 외투', type: 'armor' }), 'cloak');
    assert.equal(getEquipmentVisualKey({ name: '시험용 검은 광석', type: 'mat' }), 'ore');
    assert.equal(getEquipmentVisualKey({ name: '시험용 달빛 결정', type: 'mat' }), 'crystal');
    assert.equal(getEquipmentVisualKey({ name: '시험용 와이번 비늘', type: 'mat' }), 'scale');
    assert.equal(getEquipmentVisualKey({ name: '시험용 늑대 송곳니', type: 'mat' }), 'fang');
    assert.equal(getEquipmentVisualKey({ name: '시험용 거수 뼈', type: 'mat' }), 'bone');
    assert.equal(getEquipmentVisualKey({ name: '시험용 차원 핵', type: 'mat' }), 'core');
    assert.equal(getEquipmentVisualKey({ name: '시험용 봉인 각인석', type: 'mat' }), 'relic');
    assert.equal(getEquipmentVisualKey({ name: '시험용 별포자', type: 'mat' }), 'herb');
    assert.equal(getEquipmentVisualKey({ name: '시험용 전리품 주머니', type: 'mat' }), 'pouch');
    assert.equal(getEquipmentVisualKey({ name: '시험용 봉인 열쇠', type: 'key' }), 'key');
});

test('getWeaponVisualKey separates one-hand and two-hand subfamilies with readable silhouette keys', () => {
    assert.equal(getWeaponVisualKey({ name: '사막의 시미터', type: 'weapon', hands: 1 }), 'saber');
    assert.equal(getWeaponVisualKey({ name: '기계식 레이피어', type: 'weapon', hands: 1 }), 'rapier');
    assert.equal(getWeaponVisualKey({ name: '농부의 포크', type: 'weapon', hands: 1 }), 'fork');
    assert.equal(getWeaponVisualKey({ name: '철퇴장', type: 'weapon', hands: 1 }), 'mace');
    assert.equal(getWeaponVisualKey({ name: '암살의 표창', type: 'weapon', hands: 1 }), 'throwing-blade');
    assert.equal(getWeaponVisualKey({ name: '쌍칼', type: 'weapon', hands: 1 }), 'twinblade');
    assert.equal(getWeaponVisualKey({ name: '광기의 도끼', type: 'weapon', hands: 2 }), 'greataxe');
    assert.equal(getWeaponVisualKey({ name: '빙결 장궁', type: 'weapon', hands: 2 }), 'longbow');
    assert.equal(getWeaponVisualKey({ name: '빙원의 장창', type: 'weapon', hands: 2 }), 'lance');
    assert.equal(getWeaponVisualKey({ name: '에테르 플럭스 로드', type: 'weapon', hands: 2, elem: '빛' }), 'rod');
});

test('getEquipmentVisualKey prefers exact named-art keys for tier 5+ signature gear', () => {
    assert.equal(getEquipmentVisualKey({ name: '성검 에테르니아', type: 'weapon', tier: 5 }), 'named-weapon-01');
    assert.equal(getEquipmentVisualKey({ name: '차원 방패 이지스', type: 'shield', tier: 6 }), 'named-shield-02');
    assert.equal(getEquipmentVisualKey({ name: '에테르 로브 오브 아포칼립스', type: 'armor', tier: 6 }), 'named-armor-25');
});

test('getEquipmentVisualKey prefers exact per-name art for normal items before family fallback', () => {
    assert.equal(getEquipmentVisualKey({ name: '녹슨 도끼', type: 'weapon', tier: 1 }), EXACT_ITEM_ICON_KEYS['녹슨 도끼']);
    assert.equal(getEquipmentVisualKey({ name: '여행자 튜닉', type: 'armor', tier: 1 }), EXACT_ITEM_ICON_KEYS['여행자 튜닉']);
    assert.equal(getEquipmentVisualKey({ name: '해독제', type: 'cure', tier: 1 }), EXACT_ITEM_ICON_KEYS['해독제']);
});

test('getArmorStyleFromItem recognizes armor naming used in late-game items', () => {
    assert.equal(getArmorStyleFromItem({ name: '균열 외피갑옷', type: 'armor' }, 'coat'), 'leather');
    assert.equal(getArmorStyleFromItem({ name: '세계수 갑주', type: 'armor' }, 'coat'), 'plate');
    assert.equal(getArmorStyleFromItem({ name: '신전 제관 예복', type: 'armor' }, 'coat'), 'robe');
});

test('getAvatarLoadoutStyle groups weapon families into readable avatar silhouettes', () => {
    assert.equal(getAvatarLoadoutStyle('axe', 'material'), 'heavy');
    assert.equal(getAvatarLoadoutStyle('bow', 'material'), 'archer');
    assert.equal(getAvatarLoadoutStyle('staff', 'book'), 'caster');
    assert.equal(getAvatarLoadoutStyle('spear', 'material'), 'lancer');
    assert.equal(getAvatarLoadoutStyle('sword', 'shield'), 'guardian');
    assert.equal(getAvatarLoadoutStyle('longbow', 'material'), 'archer');
    assert.equal(getAvatarLoadoutStyle('rapier', 'material'), 'sword');
    assert.equal(getAvatarLoadoutStyle('twinblade', 'material'), 'dagger');
    assert.equal(getAvatarLoadoutStyle('greataxe', 'material'), 'heavy');
});

test('equipment family asset keys map representative gear into avatar-style illustration families', () => {
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '롱소드', type: 'weapon', hands: 1 }), 'weapon-sword');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '정예병의 창', type: 'weapon', hands: 2 }), 'weapon-lance');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '대지의 지팡이', type: 'weapon', hands: 2, elem: '대지' }), 'weapon-staff');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '목재 방패', type: 'shield' }), 'offhand-shield');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '견습 주문서', type: 'shield', subtype: 'focus' }), 'offhand-book');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '짚 모자', type: 'armor' }), 'headgear-straw-hat');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '여행자 튜닉', type: 'armor' }), 'armor-coat');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '기사의 흉갑', type: 'armor' }), 'armor-plate');
    assert.equal(getEquipmentWearableFamilyKey({ name: '목재 방패', type: 'shield' }), 'offhand-shield');
    assert.equal(getEquipmentWearableFamilyKey({ name: '견습 주문서', type: 'shield', subtype: 'focus' }), 'offhand-book');
    assert.equal(getEquipmentWearableFamilyKey({ name: '롱소드', type: 'weapon', hands: 1 }), 'weapon-sword');
    assert.equal(getEquipmentWearableFamilyKey({ name: '기사의 흉갑', type: 'armor' }), 'armor-plate');
    assert.equal(getEquipmentWearableFamilyKey({ name: '짚 모자', type: 'armor' }), 'headgear-straw-hat');
});

test('avatar preview item icon routing stays disabled for normal equipment item surfaces', () => {
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '짚 모자', type: 'armor' }), false);
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '현자의 관', type: 'armor' }), false);
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '여행자 튜닉', type: 'armor' }), false);
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '균열 외피갑옷', type: 'armor' }), false);
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '롱소드', type: 'weapon', hands: 1 }), false);
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '목재 방패', type: 'shield' }), false);
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '기사의 흉갑', type: 'armor' }), false);
    assert.equal(shouldUseAvatarPreviewItemIcon({ name: '수호의 물약', type: 'hp' }), false);
});

test('non-signature equipment item icons consistently use the family art system', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const equipItems = Object.values(ITEMS).flat().filter((item) => (
        item
        && ['weapon', 'armor', 'shield'].includes(item.type)
        && !SPECIAL_ITEM_ICON_KEYS[item.name]
    ));

    assert.ok(equipItems.length > 100, 'Expected broad non-signature equipment coverage');
    for (const item of equipItems) {
        assert.match(
            getItemIconAssetSrc(item),
            /^\/assets\/equipment-family\/items\//,
            `Expected family item icon art for ${item.name}`
        );
        assert.equal(shouldUseAvatarPreviewItemIcon(item), false, `Expected no avatar-preview icon mix for ${item.name}`);
    }
});

test('non-equipment family asset keys map readable item categories', () => {
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '하급 체력 물약', type: 'hp' }), 'potion');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '상급 마나 물약', type: 'mp' }), 'potion');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '저주해제 주문서', type: 'cure' }), 'potion');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '영웅의 물약', type: 'buff' }), 'potion');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '동전 주머니', type: 'mat' }), 'pouch');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '철광석', type: 'mat' }), 'ore');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '마나 결정', type: 'mat' }), 'crystal');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '용의 비늘', type: 'mat' }), 'scale');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '늑대 송곳니', type: 'mat' }), 'fang');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '고대의 뼈', type: 'mat' }), 'bone');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '마왕의 핵', type: 'mat' }), 'core');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '봉인 각인석', type: 'mat' }), 'relic');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '별포자', type: 'mat' }), 'herb');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '봉인 열쇠', type: 'key' }), 'key');
    assert.equal(getNonEquipmentIllustrationFamilyKey({ name: '고대 유물', type: 'all' }), 'relic');
});

test('non-equipment playable item icons consistently use shared family art', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const nonEquipmentItems = Object.values(ITEMS).flat().filter((item) => (
        item
        && item.type
        && !['weapon', 'armor', 'shield'].includes(item.type)
    ));

    assert.ok(nonEquipmentItems.length > 70, 'Expected broad non-equipment item coverage');
    for (const item of nonEquipmentItems) {
        const src = getItemIconAssetSrc(item);
        assert.match(src, /^\/assets\/items\/(potion|material|ore|crystal|scale|fang|bone|core|relic|herb|pouch|key)\.png$/);
        assert.doesNotMatch(src, /\/item-[a-z]+-\d+\./, `Expected no exact-name item art routing for ${item.name}`);
    }
});

test('every displayable catalog item resolves into a cohesive item art system', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const displayableItems = Object.values(ITEMS).flat().filter((item) => item?.name);

    assert.ok(displayableItems.length > 300, 'Expected full catalog display coverage');
    for (const item of displayableItems) {
        const src = getItemIconAssetSrc(item);
        const isSignatureArt = /^\/assets\/equipment-exact\/signature-/.test(src);
        const isEquipmentFamilyArt = /^\/assets\/equipment-family\/items\//.test(src);
        const isNonEquipmentFamilyArt = /^\/assets\/items\/(potion|material|ore|crystal|scale|fang|bone|core|relic|herb|pouch|key)\.png$/.test(src);

        assert.equal(
            isSignatureArt || isEquipmentFamilyArt || isNonEquipmentFamilyArt,
            true,
            `Expected cohesive art route for ${item.name || item.desc || 'unknown'} (${src})`
        );
    }
});

test('all pixel item icon assets exist for the shared equipment image set', () => {
    for (const key of ITEM_ICON_ASSET_KEYS) {
        assert.equal(hasItemAsset(key), true, `Expected item icon asset for key ${key}`);
    }
});

test('all non-equipment family item assets exist', () => {
    for (const key of NON_EQUIPMENT_FAMILY_ITEM_ASSET_KEYS) {
        assert.equal(hasItemAsset(key), true, `Expected non-equipment family item asset for key ${key}`);
    }
});

test('named gear icon map remains unique and asset-backed', () => {
    const keys = Object.values(SPECIAL_ITEM_ICON_KEYS);
    assert.equal(new Set(keys).size, keys.length);
    for (const key of keys) {
        assert.equal(hasItemAsset(key), true, `Expected named item icon asset for key ${key}`);
    }
});

test('exact item-name icon map remains unique and asset-backed', () => {
    const keys = Object.values(EXACT_ITEM_ICON_KEYS);
    assert.ok(keys.length > 200, 'Expected exact item-name icon coverage for the full item catalog');
    assert.equal(new Set(keys).size, keys.length);
    for (const key of keys) {
        assert.equal(hasItemAsset(key), true, `Expected exact item icon asset for key ${key}`);
    }
});

test('avatar-style equipment family assets exist for item illustrations and wearable overlays', () => {
    for (const key of EQUIPMENT_FAMILY_ITEM_ASSET_KEYS) {
        assert.equal(hasEquipmentFamilyItemAsset(key), true, `Expected avatar-style equipment item asset for key ${key}`);
    }

    for (const key of EQUIPMENT_FAMILY_OVERLAY_ASSET_KEYS) {
        assert.equal(hasEquipmentFamilyOverlayAsset(key), true, `Expected avatar-style equipment overlay asset for key ${key}`);
    }
});

test('every equippable item has an exact avatar-style equipment illustration asset', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const equipItems = Object.values(ITEMS).flat().filter((item) => item && ['weapon', 'armor', 'shield'].includes(item.type));

    for (const item of equipItems) {
        const key = getExactEquipmentItemAssetKey(item);
        assert.ok(key, `Expected exact equipment asset key for ${item.name}`);
        assert.equal(hasEquipmentExactAsset(key), true, `Expected exact avatar-style equipment asset for ${item.name} (${key})`);
    }
});

test('equipment overlay assets exist for every wearable family actually used by the avatar path', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const equipItems = Object.values(ITEMS).flat().filter((item) => item && ['weapon', 'armor', 'shield'].includes(item.type));
    const wearableFamilyKeys = [...new Set(equipItems.map((item) => getEquipmentWearableFamilyKey(item)).filter(Boolean))];

    assert.equal(wearableFamilyKeys.length >= 4, true);

    for (const key of wearableFamilyKeys) {
        assert.equal(hasEquipmentFamilyOverlayAsset(key), true, `Expected wearable avatar overlay asset for key ${key}`);
    }
});
