import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveCharacterAppearance } from '../src/utils/characterAppearance.js';
import { getAvatarEquipmentPreviewCandidates, getAvatarSpriteCandidates, JOB_SPRITE_SLUG_MAP } from '../src/utils/avatarSpriteCandidates.js';
import { buildEquipmentPreviewAppearance, getEquipmentPreviewStage } from '../src/utils/avatarEquipmentPreview.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarAssetDir = path.resolve(__dirname, '../public/assets/avatars');

test('deriveCharacterAppearance falls back to a stable adventurer silhouette', () => {
    const appearance = deriveCharacterAppearance({
        job: '모험가',
        level: 1,
        equip: {},
    });

    assert.equal(appearance.job, '모험가');
    assert.equal(appearance.weapon.type, 'none');
    assert.equal(appearance.offhand.type, 'none');
    assert.equal(appearance.armorStyle, 'coat');
    assert.equal(appearance.loadoutStyle, 'sword');
    assert.equal(appearance.accessoryStyle, 'ribbon');
    assert.equal(appearance.palette.outfit, '#5b7dd8');
});

test('deriveCharacterAppearance maps magic two-hand weapons and focus offhands', () => {
    const appearance = deriveCharacterAppearance({
        job: '마법사',
        level: 8,
        equip: {
            weapon: { name: '화염의 지팡이', type: 'weapon', hands: 2, elem: '화염', enhance: 2 },
            offhand: { name: '심연의 마도서', type: 'shield', subtype: 'focus', elem: '어둠', enhance: 1 },
            armor: { name: '수련생 로브', type: 'armor', elem: '빛', enhance: 3 },
        },
    });

    assert.equal(appearance.weapon.type, 'staff');
    assert.equal(appearance.offhand.type, 'book');
    assert.equal(appearance.armorStyle, 'robe');
    assert.equal(appearance.loadoutStyle, 'caster');
    assert.equal(appearance.accessoryStyle, 'hat');
    assert.equal(appearance.palette.weapon, '#d8c7a5');
    assert.equal(appearance.palette.offhand, '#bfa88b');
    assert.equal(appearance.frameTone, '빛');
});

test('deriveCharacterAppearance maps martial loadouts to cute pixel combat silhouettes', () => {
    const appearance = deriveCharacterAppearance({
        job: '나이트',
        level: 12,
        equip: {
            weapon: { name: '롱소드', type: 'weapon', hands: 1, enhance: 4 },
            offhand: { name: '성광 방벽', type: 'shield', elem: '빛', enhance: 2 },
            armor: { name: '기사의 흉갑', type: 'armor', enhance: 1 },
        },
    });

    assert.equal(appearance.weapon.type, 'sword');
    assert.equal(appearance.offhand.type, 'shield');
    assert.equal(appearance.armorStyle, 'plate');
    assert.equal(appearance.loadoutStyle, 'guardian');
    assert.equal(appearance.accessoryStyle, 'crest');
    assert.equal(appearance.weapon.enhance, 4);
    assert.equal(appearance.offhand.enhance, 2);
});

test('deriveCharacterAppearance distinguishes leather and coat armor silhouettes from item naming', () => {
    const leatherAppearance = deriveCharacterAppearance({
        job: '도적',
        equip: {
            armor: { name: '가죽 조끼', type: 'armor' },
        },
    });
    const coatAppearance = deriveCharacterAppearance({
        job: '레인저',
        equip: {
            armor: { name: '사냥꾼의 외투', type: 'armor' },
        },
    });

    assert.equal(leatherAppearance.armorStyle, 'leather');
    assert.equal(coatAppearance.armorStyle, 'coat');
});

test('deriveCharacterAppearance derives distinct loadout styles from equipped weapon families', () => {
    const heavyAppearance = deriveCharacterAppearance({
        job: '버서커',
        equip: {
            weapon: { name: '광전사의 도끼', type: 'weapon', hands: 2 },
        },
    });
    const archerAppearance = deriveCharacterAppearance({
        job: '레인저',
        equip: {
            weapon: { name: '사냥꾼의 활', type: 'weapon', hands: 2 },
        },
    });
    const lancerAppearance = deriveCharacterAppearance({
        job: '전사',
        equip: {
            weapon: { name: '정예병의 창', type: 'weapon', hands: 2 },
        },
    });

    assert.equal(heavyAppearance.loadoutStyle, 'heavy');
    assert.equal(archerAppearance.loadoutStyle, 'archer');
    assert.equal(lancerAppearance.loadoutStyle, 'lancer');
});

test('getAvatarSpriteCandidates uses job-only default sprite (cycle 46)', () => {
    const candidates = getAvatarSpriteCandidates({
        job: '팔라딘',
        armorStyle: 'plate',
        loadoutStyle: 'guardian',
    });

    // cycle 46: 직업만이 sprite 결정. armor/loadout 무시. JOB_DEFAULT_SPRITE 매핑 우선.
    assert.deepEqual(candidates, [
        '/assets/avatars/paladin-plate-guardian.png',
        '/assets/avatars/paladin.png',
        '/assets/avatars/adventurer.png',
    ]);
});

test('shadow-lord uses dedicated default sprite regardless of equipment', () => {
    const candidates = getAvatarSpriteCandidates({
        job: '그림자 주군',
        armorStyle: 'plate',  // 비전공 armor
        loadoutStyle: 'sword', // 비전공 weapon
    });
    // cycle 46: 장비와 무관하게 shadow-lord-leather-dagger 첫번째
    assert.deepEqual(candidates, [
        '/assets/avatars/shadow-lord-leather-dagger.png',
        '/assets/avatars/shadow-lord.png',
        '/assets/avatars/adventurer.png',
    ]);
});

test('unknown job falls back to adventurer (jobSlug = adventurer)', () => {
    const candidates = getAvatarSpriteCandidates({
        job: '미확인 직업',
        armorStyle: 'robe',
        loadoutStyle: 'caster',
    });
    // cycle 46: jobSlug='adventurer' 폴백. JOB_DEFAULT_SPRITE.adventurer = 'adventurer'
    assert.deepEqual(candidates, ['/assets/avatars/adventurer.png']);
});

test('cycle 46: 모험가는 어떤 장비를 입든 항상 같은 sprite', () => {
    const cases = [
        { armorStyle: 'leather', loadoutStyle: 'dagger' },
        { armorStyle: 'plate', loadoutStyle: 'sword' },
        { armorStyle: 'robe', loadoutStyle: 'caster' },
        { armorStyle: 'coat', loadoutStyle: 'archer' },
    ];
    const sprites = new Set(
        cases.map((c) => getAvatarSpriteCandidates({ job: '모험가', ...c })[0])
    );
    assert.equal(sprites.size, 1, 'should always pick the same sprite');
    assert.equal([...sprites][0], '/assets/avatars/adventurer.png');
});

test('buildEquipmentPreviewAppearance derives robe previews from the same avatar family path', () => {
    const preview = buildEquipmentPreviewAppearance({
        name: '여행자 튜닉',
        type: 'armor',
    });

    assert.equal(preview.job, '모험가');
    assert.equal(preview.armorStyle, 'coat');
    assert.equal(preview.loadoutStyle, 'sword');
    assert.equal(preview.armor?.item?.name, '여행자 튜닉');
    assert.equal(preview.armor?.art?.bodyStyle, 'tunic');
});

test('buildEquipmentPreviewAppearance derives specific loadout previews for offhand and one-hand items', () => {
    const bookPreview = buildEquipmentPreviewAppearance({
        name: '견습 주문서',
        type: 'shield',
        subtype: 'focus',
    });
    const daggerPreview = buildEquipmentPreviewAppearance({
        name: '녹슨 단검',
        type: 'weapon',
        hands: 1,
    });

    assert.equal(bookPreview.job, '마법사');
    assert.equal(bookPreview.armorStyle, 'robe');
    assert.equal(bookPreview.loadoutStyle, 'caster');
    assert.equal(bookPreview.offhand?.art?.slot, 'offhand');
    assert.equal(daggerPreview.job, '도적');
    assert.equal(daggerPreview.armorStyle, 'leather');
    assert.equal(daggerPreview.loadoutStyle, 'dagger');
    assert.equal(daggerPreview.weapon?.art?.slot, 'weapon');
});

test('equipment preview candidates emphasize loadout silhouettes for weapon and offhand cards', () => {
    const swordPreview = buildEquipmentPreviewAppearance({
        name: '롱소드',
        type: 'weapon',
        hands: 1,
    });
    const shieldPreview = buildEquipmentPreviewAppearance({
        name: '목재 방패',
        type: 'shield',
    });
    const armorPreview = buildEquipmentPreviewAppearance({
        name: '여행자 튜닉',
        type: 'armor',
    });
    const robePreview = buildEquipmentPreviewAppearance({
        name: '천 로브',
        type: 'armor',
        elem: '빛',
    });
    const bowPreview = buildEquipmentPreviewAppearance({
        name: '엘프의활',
        type: 'weapon',
        hands: 2,
        elem: '자연',
    });
    const platePreview = buildEquipmentPreviewAppearance({
        name: '기사의 흉갑',
        type: 'armor',
        elem: '빛',
    });

    assert.equal(getAvatarEquipmentPreviewCandidates(swordPreview)[0], '/assets/avatars/adventurer-sword.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(shieldPreview)[0], '/assets/avatars/knight-plate-guardian.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(armorPreview)[0], '/assets/avatars/adventurer-coat.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(robePreview)[0], '/assets/avatars/archmage-robe.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(bowPreview)[0], '/assets/avatars/ranger-coat-archer.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(platePreview)[0], '/assets/avatars/paladin-plate.png');
});

test('equipment preview stage emphasizes the relevant slot instead of shrinking everything equally', () => {
    const headgearStage = getEquipmentPreviewStage(
        { name: '짚 모자', type: 'armor' },
        buildEquipmentPreviewAppearance({ name: '짚 모자', type: 'armor' }),
    );
    const armorStage = getEquipmentPreviewStage(
        { name: '여행자 튜닉', type: 'armor' },
        buildEquipmentPreviewAppearance({ name: '여행자 튜닉', type: 'armor' }),
    );
    const shieldStage = getEquipmentPreviewStage(
        { name: '목재 방패', type: 'shield' },
        buildEquipmentPreviewAppearance({ name: '목재 방패', type: 'shield' }),
    );
    const swordStage = getEquipmentPreviewStage(
        { name: '롱소드', type: 'weapon', hands: 1 },
        buildEquipmentPreviewAppearance({ name: '롱소드', type: 'weapon', hands: 1 }),
    );

    assert.equal(headgearStage.focus, 'headgear');
    assert.equal(armorStage.focus, 'armor');
    assert.equal(shieldStage.focus, 'offhand');
    assert.equal(swordStage.focus, 'weapon');
    assert.equal(headgearStage.scale > armorStage.scale, true);
    assert.equal(shieldStage.translateX > 0, true);
    assert.equal(swordStage.translateX < 0, true);

    const headgearCardStage = getEquipmentPreviewStage(
        { name: '짚 모자', type: 'armor' },
        buildEquipmentPreviewAppearance({ name: '짚 모자', type: 'armor' }),
        'card',
    );
    const shieldCardStage = getEquipmentPreviewStage(
        { name: '목재 방패', type: 'shield' },
        buildEquipmentPreviewAppearance({ name: '목재 방패', type: 'shield' }),
        'card',
    );

    assert.equal(headgearCardStage.scale > headgearStage.scale, true);
    assert.equal(headgearCardStage.origin, '50% 14%');
    assert.equal(shieldCardStage.scale > shieldStage.scale, true);
    assert.equal(shieldCardStage.translateX > shieldStage.translateX, true);
});

test('all mapped job sprites exist as concrete avatar PNG assets', () => {
    const uniqueSlugs = [...new Set(Object.values(JOB_SPRITE_SLUG_MAP))];

    for (const slug of uniqueSlugs) {
        const assetPath = path.join(avatarAssetDir, `${slug}.png`);
        assert.equal(
            existsSync(assetPath),
            true,
            `Expected avatar sprite asset for slug "${slug}" at ${assetPath}`,
        );
    }
});

test('class-specific armor variants exist for the current premium avatar coverage set', () => {
    const expectedVariants = [
        'warrior-plate',
        'knight-plate',
        'berserker-plate',
        'rogue-leather',
        'assassin-leather',
        'ranger-coat',
        'mage-robe',
        'archmage-robe',
        'warlock-robe',
        'paladin-plate',
        'chronomancer-robe',
        'shadow-lord-leather',
        'grand-mage-robe',
    ];

    for (const variant of expectedVariants) {
        const assetPath = path.join(avatarAssetDir, `${variant}.png`);
        assert.equal(
            existsSync(assetPath),
            true,
            `Expected armor-style avatar variant asset at ${assetPath}`,
        );
    }
});

test('loadout-style avatar variants exist for the premium individuality coverage set', () => {
    const expectedVariants = [
        'adventurer-sword',
        'adventurer-heavy',
        'adventurer-archer',
        'adventurer-caster',
        'adventurer-guardian',
        'adventurer-dagger',
        'adventurer-lancer',
        'warrior-plate-sword',
        'warrior-plate-heavy',
        'knight-plate-guardian',
        'berserker-plate-heavy',
        'rogue-leather-dagger',
        'assassin-leather-dagger',
        'ranger-coat-archer',
        'mage-robe-caster',
        'archmage-robe-caster',
        'warlock-robe-caster',
        'paladin-plate-guardian',
        'chronomancer-robe-caster',
        'shadow-lord-leather-dagger',
        'grand-mage-robe-caster',
    ];

    for (const variant of expectedVariants) {
        const assetPath = path.join(avatarAssetDir, `${variant}.png`);
        assert.equal(
            existsSync(assetPath),
            true,
            `Expected loadout-style avatar variant asset at ${assetPath}`,
        );
    }
});
