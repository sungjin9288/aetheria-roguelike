import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEquipmentCatalogRows } from '../scripts/dump-equipment-catalog.mjs';
import { deriveCharacterAppearance } from '../src/utils/characterAppearance.js';
import { isMagicWeapon } from '../src/utils/equipmentUtils.js';

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
const equipmentManifestPath = path.resolve(__dirname, '../src/data/equipmentArtManifest.json');
const weaponCoreProvenancePath = path.resolve(__dirname, '../docs/evidence/art/equipment-weapon-core-provenance.json');
const weaponRangedMagicProvenancePath = path.resolve(__dirname, '../docs/evidence/art/equipment-weapon-ranged-magic-provenance.json');
const offhandHeadgearProvenancePath = path.resolve(__dirname, '../docs/evidence/art/equipment-offhand-headgear-provenance.json');
const hasItemAsset = (key) => existsSync(path.join(itemAssetDir, `${key}.png`)) || existsSync(path.join(itemAssetDir, `${key}.svg`));
const hasEquipmentFamilyItemAsset = (key) => existsSync(path.join(equipmentFamilyItemDir, `${key}.png`));
const hasEquipmentFamilyOverlayAsset = (key) => existsSync(path.join(equipmentFamilyOverlayDir, `${key}.png`));
const hasEquipmentExactAsset = (key) => existsSync(path.join(equipmentExactDir, `${key}.png`));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const readPngSize = (data) => {
    assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    return {
        width: data.readUInt32BE(16),
        height: data.readUInt32BE(20),
    };
};

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

test('elemental weapons keep 23 exact physical silhouettes through family and avatar routing', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const itemsByName = new Map(ITEMS.weapons.map((item) => [item.name, item]));
    const expected = [
        ['공허의 대검', 'greatsword', 'weapon-sword', 'heavy'],
        ['성기사의 검', 'sword', 'weapon-sword', 'sword'],
        ['시간 파편 소드', 'sword', 'weapon-sword', 'sword'],
        ['심판자의 검', 'sword', 'weapon-sword', 'sword'],
        ['암흑의 대검', 'greatsword', 'weapon-sword', 'heavy'],
        ['에테르 검', 'sword', 'weapon-sword', 'sword'],
        ['용암 대검', 'greatsword', 'weapon-sword', 'heavy'],
        ['차원절단자', 'sword', 'weapon-sword', 'sword'],
        ['타락 기사의 검', 'sword', 'weapon-sword', 'sword'],
        ['파멸의 검', 'sword', 'weapon-sword', 'sword'],
        ['화염 사원의 검', 'sword', 'weapon-sword', 'sword'],
        ['균열의 날', 'dagger', 'weapon-dagger', 'dagger'],
        ['서리칼날', 'dagger', 'weapon-dagger', 'dagger'],
        ['빙결의 왕관검', 'sword', 'weapon-sword', 'sword'],
        ['세계수의 검', 'sword', 'weapon-sword', 'sword'],
        ['에테르 거인의 대검', 'greatsword', 'weapon-sword', 'heavy'],
        ['영혼 절단자', 'dagger', 'weapon-dagger', 'dagger'],
        ['성검 에테르니아', 'sword', 'weapon-sword', 'sword'],
        ['라그나로크', 'greatsword', 'weapon-sword', 'heavy'],
        ['용의 화염', 'greatsword', 'weapon-sword', 'heavy'],
        ['대지의 심판', 'greatsword', 'weapon-sword', 'heavy'],
        ['그림자 절단기', 'dagger', 'weapon-dagger', 'dagger'],
        ['독아 채찍', 'whip', 'weapon-whip', 'dagger'],
    ];

    assert.equal(expected.length, 23);
    for (const [name, visualKey, familyKey, loadoutStyle] of expected) {
        const item = itemsByName.get(name);
        assert.ok(item, `Expected live catalog item ${name}`);
        assert.equal(isMagicWeapon(item), true, `Gameplay magic semantics must remain active for ${name}`);
        assert.equal(getWeaponVisualKey(item), visualKey, `Expected physical weapon silhouette for ${name}`);
        assert.equal(getEquipmentIllustrationFamilyKey(item), familyKey, `Expected illustration family for ${name}`);

        const appearance = deriveCharacterAppearance({ job: '모험가', equip: { weapon: item } });
        assert.equal(appearance.weapon.type, visualKey, `Expected avatar weapon routing for ${name}`);
        assert.equal(appearance.loadoutStyle, loadoutStyle, `Expected avatar loadout silhouette for ${name}`);
    }

    for (const [name, visualKey] of [
        ['화염의 지팡이', 'staff'],
        ['에테르 플럭스 로드', 'rod'],
        ['유성 완드', 'wand'],
    ]) {
        const item = itemsByName.get(name);
        assert.ok(item, `Expected live magic-weapon control ${name}`);
        assert.equal(getWeaponVisualKey(item), visualKey);
        assert.equal(getEquipmentIllustrationFamilyKey(item), 'weapon-staff');
        assert.equal(deriveCharacterAppearance({ job: '마법사', equip: { weapon: item } }).loadoutStyle, 'caster');
    }

    const adjectiveControl = { name: '검은 마력 완드', type: 'weapon', elem: '어둠', hands: 1 };
    assert.equal(getWeaponVisualKey(adjectiveControl), 'wand');
    assert.equal(getEquipmentIllustrationFamilyKey(adjectiveControl), 'weapon-staff');
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
    assert.equal(getArmorStyleFromItem({ name: '암살자 장갑', type: 'armor' }, 'coat'), 'leather');
    for (const name of ['드래곤 임페리얼', '화염 방어복', '냉기 방어복', '심해의 수호복']) {
        assert.equal(getArmorStyleFromItem({ name, type: 'armor' }, 'coat'), 'plate', name);
    }
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
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '신전 제관 예복', type: 'armor' }), 'armor-robe');
    assert.equal(getEquipmentIllustrationFamilyKey({ name: '암살자 장갑', type: 'armor' }), 'armor-leather');
    for (const name of ['드래곤 임페리얼', '화염 방어복', '냉기 방어복', '심해의 수호복']) {
        assert.equal(getEquipmentIllustrationFamilyKey({ name, type: 'armor' }), 'armor-plate', name);
    }
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

// slice 26: 일반 장비는 아이템별 auto 아트(family 실루엣 + elem/tier 리컬러)가
//   1순위 — '수련생의 검' == '강철 롱소드' 공유 그림 문제 해소. family 경로는
//   매니페스트 미등록(신규 아이템) fallback으로만 허용.
test('non-signature equipment item icons use per-item auto art (family silhouette base)', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const equipItems = [...ITEMS.weapons, ...ITEMS.armors].filter((item) => (
        item
        && ['weapon', 'armor', 'shield'].includes(item.type)
        && !SPECIAL_ITEM_ICON_KEYS[item.name]
    ));

    assert.ok(equipItems.length > 100, 'Expected broad non-signature equipment coverage');
    let autoCount = 0;
    for (const item of equipItems) {
        const src = getItemIconAssetSrc(item);
        assert.match(
            src,
            /^\/assets\/equipment-(exact\/auto\/auto-[0-9a-f]{12}|family\/items\/[a-z-]+)\.png$/,
            `Expected per-item auto art (or family fallback) for ${item.name} (${src})`
        );
        if (/\/auto\//.test(src)) autoCount += 1;
        assert.equal(shouldUseAvatarPreviewItemIcon(item), false, `Expected no avatar-preview icon mix for ${item.name}`);
    }
    assert.equal(autoCount, equipItems.length,
        `비-시그니처 장비 전수 auto 아트 커버 (${autoCount}/${equipItems.length})`);
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

// slice 27: 비장비도 아이템별 auto 아트 1순위 — 물약 14종 동일 그림(마나
//   물약도 빨간 병) 문제 해소. family 그림은 매니페스트 미등록 fallback.
test('non-equipment playable item icons use per-item auto art (type tone / self-jitter)', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const nonEquipmentItems = Object.values(ITEMS).flat().filter((item) => (
        item
        && item.type
        && !['weapon', 'armor', 'shield'].includes(item.type)
    ));

    assert.ok(nonEquipmentItems.length > 70, 'Expected broad non-equipment item coverage');
    let autoCount = 0;
    for (const item of nonEquipmentItems) {
        const src = getItemIconAssetSrc(item);
        assert.match(src, /^\/assets\/items\/(auto\/auto-[0-9a-f]{12}|potion|material|ore|crystal|scale|fang|bone|core|relic|herb|pouch|key)\.png$/);
        if (/\/auto\//.test(src)) autoCount += 1;
        assert.doesNotMatch(src, /\/item-[a-z]+-\d+\./, `Expected no exact-name item art routing for ${item.name}`);
    }
    assert.equal(autoCount, nonEquipmentItems.length,
        `비장비 전수 auto 아트 커버 (${autoCount}/${nonEquipmentItems.length})`);
});

test('every displayable catalog item resolves into a cohesive item art system', async () => {
    const { ITEMS } = await import('../src/data/items.js');
    const displayableItems = Object.values(ITEMS).flat().filter((item) => item?.name);

    assert.ok(displayableItems.length > 300, 'Expected full catalog display coverage');
    for (const item of displayableItems) {
        const src = getItemIconAssetSrc(item);
        const isSignatureArt = /^\/assets\/equipment-exact\/signature-/.test(src);
        // slice 26/27: 아이템별 auto 아트 루트 합류 (장비 + 비장비)
        const isAutoEquipmentArt = /^\/assets\/equipment-exact\/auto\/auto-[0-9a-f]{12}\.png$/.test(src);
        const isAutoNonEquipArt = /^\/assets\/items\/auto\/auto-[0-9a-f]{12}\.png$/.test(src);
        const isEquipmentFamilyArt = /^\/assets\/equipment-family\/items\//.test(src);
        const isNonEquipmentFamilyArt = /^\/assets\/items\/(potion|material|ore|crystal|scale|fang|bone|core|relic|herb|pouch|key)\.png$/.test(src);

        assert.equal(
            isSignatureArt || isAutoEquipmentArt || isAutoNonEquipArt || isEquipmentFamilyArt || isNonEquipmentFamilyArt,
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
    const equipItems = [...ITEMS.weapons, ...ITEMS.armors]
        .filter((item) => item && ['weapon', 'armor', 'shield'].includes(item.type));

    for (const item of equipItems) {
        const key = getExactEquipmentItemAssetKey(item);
        assert.ok(key, `Expected exact equipment asset key for ${item.name}`);
        assert.equal(hasEquipmentExactAsset(key), true, `Expected exact avatar-style equipment asset for ${item.name} (${key})`);
    }
});

test('weapon-core exact illustrations are v2, provenance-bound, 160px and unique within each family', async () => {
    const catalog = (await buildEquipmentCatalogRows()).filter((entry) => entry.cohort === 'weapon-core');
    const manifest = JSON.parse(await readFile(equipmentManifestPath, 'utf8'));
    const provenance = JSON.parse(await readFile(weaponCoreProvenancePath, 'utf8'));
    const exportsByName = new Map(
        provenance.batches.flatMap((batch) => batch.exports.map((entry) => [entry.name, { ...entry, batch }]))
    );
    const hashesByFamily = new Map();

    assert.equal(catalog.length, 54);
    assert.equal(provenance.cohort, 'weapon-core');
    assert.equal(provenance.catalogSha256, manifest.catalogSha256);

    for (const entry of catalog) {
        const artwork = manifest.artwork?.[entry.name];
        assert.ok(artwork, `Expected v2 artwork metadata for ${entry.name}`);
        assert.equal(artwork.styleVersion, 2, `Expected styleVersion 2 for ${entry.name}`);
        assert.equal(artwork.familyKey, entry.familyKey, `Expected family identity for ${entry.name}`);
        assert.match(artwork.sourcePath, /^scripts\/art_sources\/equipment\/v2\/weapon-core\/.+\.png$/);
        assert.match(artwork.sourceSha256, /^[0-9a-f]{64}$/);
        assert.match(artwork.exportSha256, /^[0-9a-f]{64}$/);

        const source = await readFile(path.resolve(__dirname, '..', artwork.sourcePath));
        const runtime = await readFile(path.resolve(__dirname, '..', 'public', entry.runtimePath.replace(/^\//, '')));
        assert.equal(sha256(source), artwork.sourceSha256, `Expected source hash match for ${entry.name}`);
        assert.equal(sha256(runtime), artwork.exportSha256, `Expected export hash match for ${entry.name}`);
        assert.deepEqual(readPngSize(runtime), { width: 160, height: 160 }, `Expected 160px runtime art for ${entry.name}`);

        const provenExport = exportsByName.get(entry.name);
        assert.ok(provenExport, `Expected provenance export for ${entry.name}`);
        assert.equal(provenExport.batch.batchId, artwork.batchId);
        assert.equal(provenExport.batch.sourceSheetSha256, artwork.sourceSha256);
        assert.equal(provenExport.exportSha256, artwork.exportSha256);

        const familyHashes = hashesByFamily.get(entry.familyKey) || new Set();
        assert.equal(familyHashes.has(artwork.exportSha256), false, `Duplicate exact illustration in ${entry.familyKey}: ${entry.name}`);
        familyHashes.add(artwork.exportSha256);
        hashesByFamily.set(entry.familyKey, familyHashes);
    }
});

test('weapon-ranged-magic exact illustrations cover all 47 identities with v2 tracked art and family-unique exports', async () => {
    const catalog = (await buildEquipmentCatalogRows()).filter((entry) => entry.cohort === 'weapon-ranged-magic');
    const manifest = JSON.parse(await readFile(equipmentManifestPath, 'utf8'));
    const provenance = JSON.parse(await readFile(weaponRangedMagicProvenancePath, 'utf8'));
    const exportsByName = new Map(
        provenance.batches.flatMap((batch) => batch.exports.map((entry) => [entry.name, { ...entry, batch }]))
    );
    const hashesByFamily = new Map();

    assert.equal(catalog.length, 47);
    assert.deepEqual(
        Object.fromEntries(['weapon-bow', 'weapon-lance', 'weapon-staff', 'weapon-whip'].map((familyKey) => [
            familyKey,
            catalog.filter((entry) => entry.familyKey === familyKey).length,
        ])),
        { 'weapon-bow': 11, 'weapon-lance': 11, 'weapon-staff': 24, 'weapon-whip': 1 }
    );
    assert.equal(provenance.cohort, 'weapon-ranged-magic');
    assert.equal(provenance.catalogSha256, manifest.catalogSha256);
    assert.equal(exportsByName.size, 47);

    for (const entry of catalog) {
        const artwork = manifest.artwork?.[entry.name];
        assert.ok(artwork, `Expected v2 artwork metadata for ${entry.name}`);
        assert.equal(artwork.styleVersion, 2, `Expected styleVersion 2 for ${entry.name}`);
        assert.equal(artwork.familyKey, entry.familyKey, `Expected family identity for ${entry.name}`);
        assert.match(artwork.sourcePath, /^scripts\/art_sources\/equipment\/v2\/weapon-ranged-magic\/.+\.png$/);
        assert.match(artwork.sourceSha256, /^[0-9a-f]{64}$/);
        assert.match(artwork.exportSha256, /^[0-9a-f]{64}$/);

        const source = await readFile(path.resolve(__dirname, '..', artwork.sourcePath));
        const runtime = await readFile(path.resolve(__dirname, '..', 'public', entry.runtimePath.replace(/^\//, '')));
        assert.equal(sha256(source), artwork.sourceSha256, `Expected source hash match for ${entry.name}`);
        assert.equal(sha256(runtime), artwork.exportSha256, `Expected export hash match for ${entry.name}`);
        assert.deepEqual(readPngSize(runtime), { width: 160, height: 160 }, `Expected 160px runtime art for ${entry.name}`);

        const provenExport = exportsByName.get(entry.name);
        assert.ok(provenExport, `Expected provenance export for ${entry.name}`);
        assert.equal(provenExport.batch.batchId, artwork.batchId);
        assert.equal(provenExport.batch.sourceSheetSha256, artwork.sourceSha256);
        assert.equal(provenExport.exportSha256, artwork.exportSha256);

        const familyHashes = hashesByFamily.get(entry.familyKey) || new Set();
        assert.equal(familyHashes.has(artwork.exportSha256), false, `Duplicate exact illustration in ${entry.familyKey}: ${entry.name}`);
        familyHashes.add(artwork.exportSha256);
        hashesByFamily.set(entry.familyKey, familyHashes);
    }
});

test('offhand-headgear exact illustrations cover all 21 identities with v2 tracked art and family-unique exports', async () => {
    const catalog = (await buildEquipmentCatalogRows()).filter((entry) => entry.cohort === 'offhand-headgear');
    const manifest = JSON.parse(await readFile(equipmentManifestPath, 'utf8'));
    const provenance = JSON.parse(await readFile(offhandHeadgearProvenancePath, 'utf8'));
    const exportsByName = new Map(
        provenance.batches.flatMap((batch) => batch.exports.map((entry) => [entry.name, { ...entry, batch }]))
    );
    const hashesByFamily = new Map();

    assert.equal(catalog.length, 21);
    assert.equal(provenance.cohort, 'offhand-headgear');
    assert.equal(provenance.catalogSha256, manifest.catalogSha256);
    assert.equal(exportsByName.size, 21);

    for (const entry of catalog) {
        const artwork = manifest.artwork?.[entry.name];
        assert.ok(artwork, `Expected v2 artwork metadata for ${entry.name}`);
        assert.equal(artwork.styleVersion, 2, `Expected styleVersion 2 for ${entry.name}`);
        assert.equal(artwork.familyKey, entry.familyKey, `Expected family identity for ${entry.name}`);
        assert.match(artwork.sourcePath, /^scripts\/art_sources\/equipment\/v2\/offhand-headgear\/.+\.png$/);

        const source = await readFile(path.resolve(__dirname, '..', artwork.sourcePath));
        const runtime = await readFile(path.resolve(__dirname, '..', 'public', entry.runtimePath.replace(/^\//, '')));
        assert.equal(sha256(source), artwork.sourceSha256, `Expected source hash match for ${entry.name}`);
        assert.equal(sha256(runtime), artwork.exportSha256, `Expected export hash match for ${entry.name}`);
        assert.deepEqual(readPngSize(runtime), { width: 160, height: 160 }, `Expected 160px runtime art for ${entry.name}`);

        const provenExport = exportsByName.get(entry.name);
        assert.ok(provenExport, `Expected provenance export for ${entry.name}`);
        assert.equal(provenExport.batch.batchId, artwork.batchId);
        assert.equal(provenExport.batch.sourceSheetSha256, artwork.sourceSha256);
        assert.equal(provenExport.exportSha256, artwork.exportSha256);

        const familyHashes = hashesByFamily.get(entry.familyKey) || new Set();
        assert.equal(familyHashes.has(artwork.exportSha256), false, `Duplicate exact illustration in ${entry.familyKey}: ${entry.name}`);
        familyHashes.add(artwork.exportSha256);
        hashesByFamily.set(entry.familyKey, familyHashes);
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
