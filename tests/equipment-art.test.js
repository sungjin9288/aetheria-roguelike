import test from 'node:test';
import assert from 'node:assert/strict';

import { getEquipmentArtProfile } from '../src/utils/equipmentArt.js';
import { ITEMS } from '../src/data/items.js';

test('getEquipmentArtProfile maps straw hat armor into a visible headgear state', () => {
    const profile = getEquipmentArtProfile({ name: '짚 모자', type: 'armor' }, 'armor', 'coat');

    assert.equal(profile.slot, 'armor');
    assert.equal(profile.headgearStyle, 'straw-hat');
    assert.equal(profile.bodyStyle, 'none');
    assert.equal(profile.toneKey, 'straw');
});

test('getEquipmentArtProfile keeps tunic armor on the body instead of treating it as headgear', () => {
    const profile = getEquipmentArtProfile({ name: '여행자 튜닉', type: 'armor' }, 'armor', 'coat');

    assert.equal(profile.slot, 'armor');
    assert.equal(profile.headgearStyle, 'none');
    assert.equal(profile.bodyStyle, 'tunic');
});

test('getEquipmentArtProfile recognizes cap and circlet style headgear correctly', () => {
    const capProfile = getEquipmentArtProfile({ name: '천 모자', type: 'armor' }, 'armor', 'coat');
    const circletProfile = getEquipmentArtProfile({ name: '신전 제관 예복', type: 'armor' }, 'armor', 'robe');

    assert.equal(capProfile.headgearStyle, 'cap');
    assert.equal(capProfile.bodyStyle, 'none');
    assert.equal(circletProfile.headgearStyle, 'circlet');
    assert.equal(circletProfile.bodyStyle, 'robe');
});

test('getEquipmentArtProfile distinguishes focus books from shields', () => {
    const focusProfile = getEquipmentArtProfile({ name: '견습 주문서', type: 'shield', subtype: 'focus' }, 'offhand');
    const shieldProfile = getEquipmentArtProfile({ name: '목재 방패', type: 'shield' }, 'offhand');
    const grimoireProfile = getEquipmentArtProfile({ name: '에테르 그리모어', type: 'shield', subtype: 'focus' }, 'offhand');

    assert.equal(focusProfile.style, 'scroll');
    assert.equal(shieldProfile.style, 'kite-shield');
    assert.equal(grimoireProfile.style, 'grimoire');
});

test('getEquipmentArtProfile differentiates weapon tones by exact item naming', () => {
    const rustyDagger = getEquipmentArtProfile({ name: '녹슨 단검', type: 'weapon', hands: 1 }, 'weapon');
    const woodenStaff = getEquipmentArtProfile({ name: '나무지팡이', type: 'weapon', hands: 2 }, 'weapon');
    const rapier = getEquipmentArtProfile({ name: '기계식 레이피어', type: 'weapon', hands: 1 }, 'weapon');
    const greataxe = getEquipmentArtProfile({ name: '광기의 도끼', type: 'weapon', hands: 2 }, 'weapon');

    assert.equal(rustyDagger.style, 'dagger');
    assert.equal(rustyDagger.toneKey, 'rust');
    assert.equal(woodenStaff.style, 'staff');
    assert.equal(woodenStaff.toneKey, 'wood');
    assert.equal(rapier.style, 'rapier');
    assert.equal(greataxe.style, 'greataxe');
});

test('every equipment item in the catalog resolves to a concrete wearable art profile', () => {
    const equipmentItems = Object.values(ITEMS).flat().filter((item) => item && ['weapon', 'armor', 'shield'].includes(item.type));

    for (const item of equipmentItems) {
        const profile = getEquipmentArtProfile(item, item.type === 'shield' ? 'offhand' : item.type, 'coat');
        assert.equal(Boolean(profile), true, `Expected art profile for ${item.name}`);
        assert.notEqual(profile.slot, 'none', `Expected concrete slot for ${item.name}`);
        if (item.type === 'weapon') {
            assert.notEqual(profile.style, 'none', `Expected weapon style for ${item.name}`);
        }
        if (item.type === 'shield') {
            assert.notEqual(profile.style, 'none', `Expected offhand style for ${item.name}`);
        }
        if (item.type === 'armor') {
            assert.equal(
                profile.headgearStyle !== 'none' || profile.bodyStyle !== 'none',
                true,
                `Expected visible armor style for ${item.name}`
            );
        }
    }
});
