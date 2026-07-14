import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import {
    isWeapon,
    isShield,
    isFocusOffhand,
    isTwoHandWeapon,
    isOneHandWeapon,
    isMagicWeapon,
    getWeaponHands,
    getWeaponStyleLabel,
    getItemStatText,
    getEquipmentIdentity,
    getWeaponAttackValue,
    getWeaponCritBonus,
    getOffhandCritBonus,
    getOffhandMpBonus,
    getEquipmentProfile,
    getNextEquipmentState,
    getEquippedWeapons,
    getWeaponMagicSkills,
} from '../src/utils/equipmentUtils.js';

// ─── Type predicates ─────────────────────────────────────────────────────
test('isWeapon / isShield / isFocusOffhand identify item categories', () => {
    assert.equal(isWeapon({ type: 'weapon' }), true);
    assert.equal(isWeapon({ type: 'armor' }), false);
    assert.equal(isWeapon(null), false);

    assert.equal(isShield({ type: 'shield' }), true);
    assert.equal(isShield({ type: 'weapon' }), false);

    assert.equal(isFocusOffhand({ type: 'shield', subtype: 'focus' }), true);
    assert.equal(isFocusOffhand({ type: 'shield' }), false);
});

test('getWeaponHands falls back to 1 when hands is missing or invalid', () => {
    assert.equal(getWeaponHands({}), 1);
    assert.equal(getWeaponHands({ hands: 2 }), 2);
    assert.equal(getWeaponHands({ hands: 0 }), 1);
    assert.equal(getWeaponHands({ hands: 'bad' }), 1);
});

test('isTwoHandWeapon / isOneHandWeapon distinguish weapon hand counts', () => {
    const oneHand = { type: 'weapon', hands: 1 };
    const twoHand = { type: 'weapon', hands: 2 };
    const shield = { type: 'shield' };

    assert.equal(isOneHandWeapon(oneHand), true);
    assert.equal(isTwoHandWeapon(oneHand), false);

    assert.equal(isTwoHandWeapon(twoHand), true);
    assert.equal(isOneHandWeapon(twoHand), false);

    assert.equal(isOneHandWeapon(shield), false);
    assert.equal(isTwoHandWeapon(shield), false);
});

test('getEquipmentIdentity returns id when available, falls back to type:name', () => {
    assert.equal(getEquipmentIdentity({ id: 'i1', type: 'weapon', name: 'Sword' }), 'i1');
    assert.equal(getEquipmentIdentity({ type: 'weapon', name: 'Sword' }), 'weapon:Sword');
    assert.equal(getEquipmentIdentity(null), null);
});

test('getWeaponStyleLabel returns contextual label by item type', () => {
    assert.equal(getWeaponStyleLabel(null), '미장착');
    assert.equal(getWeaponStyleLabel({ type: 'weapon', hands: 2 }), '양손 무기');
    assert.equal(getWeaponStyleLabel({ type: 'weapon', hands: 1 }), '한손 무기');
    assert.equal(getWeaponStyleLabel({ type: 'shield', subtype: 'focus' }), '마력 보조 장비');
    assert.equal(getWeaponStyleLabel({ type: 'shield' }), '방어 보조 장비');
    assert.equal(getWeaponStyleLabel({ type: 'armor' }), '방어구');
});

test('getItemStatText describes equipment with player-facing Korean terms', () => {
    assert.equal(
        getItemStatText({ type: 'weapon', hands: 2, val: 40, elem: '화염' }),
        `양손 무기 · 공격력 +${Math.floor(40 * BALANCE.TWO_HAND_ATK_BONUS)} · 화염 속성 · 강한 일격`
    );
    assert.equal(
        getItemStatText({ type: 'shield', subtype: 'focus', val: 4, mp: 20, crit: 0.04 }),
        '방어력 +4 · 기력 +20 · 치명타 +4% · 마력 보조 장비'
    );
    assert.equal(getItemStatText({ type: 'hp', val: 30 }), '생명 +30');
    assert.equal(getItemStatText({ type: 'mp', val: 15 }), '기력 +15');
});

// ─── Weapon stats ────────────────────────────────────────────────────────
test('getWeaponAttackValue applies the correct ratio per slot and handedness', () => {
    const twoHand = { type: 'weapon', hands: 2, val: 100 };
    const oneHand = { type: 'weapon', hands: 1, val: 100 };

    assert.equal(getWeaponAttackValue(twoHand, 'main'), Math.floor(100 * BALANCE.TWO_HAND_ATK_BONUS));
    assert.equal(getWeaponAttackValue(oneHand, 'main'), Math.floor(100 * BALANCE.ONE_HAND_ATK_RATIO));
    assert.equal(getWeaponAttackValue(oneHand, 'offhand'), Math.floor(100 * BALANCE.OFFHAND_WEAPON_RATIO));
    assert.equal(getWeaponAttackValue(null), 0);
    assert.equal(getWeaponAttackValue({ type: 'armor', val: 100 }), 0);
});

test('getWeaponCritBonus reads explicit crit, else slot default, and returns 0 for two-handers', () => {
    const explicit = { type: 'weapon', hands: 1, crit: 0.2 };
    const defaults = { type: 'weapon', hands: 1 };
    const twoHand = { type: 'weapon', hands: 2 };

    assert.equal(getWeaponCritBonus(explicit, 'main'), 0.2);
    assert.equal(getWeaponCritBonus(defaults, 'main'), BALANCE.ONE_HAND_CRIT_BONUS);
    assert.equal(getWeaponCritBonus(defaults, 'offhand'), BALANCE.OFFHAND_ONE_HAND_CRIT_BONUS);
    assert.equal(getWeaponCritBonus(twoHand, 'main'), 0);
});

test('getOffhandCritBonus covers shields, focuses, and weapons', () => {
    assert.equal(getOffhandCritBonus(null), 0);
    assert.equal(getOffhandCritBonus({ type: 'shield', crit: 0.05 }), 0.05);
    assert.equal(getOffhandCritBonus({ type: 'shield' }), 0);
    assert.equal(
        getOffhandCritBonus({ type: 'weapon', hands: 1 }),
        BALANCE.OFFHAND_ONE_HAND_CRIT_BONUS
    );
});

test('getOffhandMpBonus returns mp only for shields', () => {
    assert.equal(getOffhandMpBonus({ type: 'shield', mp: 10 }), 10);
    assert.equal(getOffhandMpBonus({ type: 'weapon', mp: 10 }), 0);
    assert.equal(getOffhandMpBonus(null), 0);
});

// ─── Equipment profile ───────────────────────────────────────────────────
test('getEquipmentProfile aggregates sole weapon correctly', () => {
    const equip = { weapon: { type: 'weapon', hands: 1, val: 50 } };
    const profile = getEquipmentProfile(equip);

    assert.equal(profile.mainWeapon, equip.weapon);
    assert.equal(profile.offhandWeapon, null);
    assert.equal(profile.offhandShield, null);
    assert.equal(profile.mainAttack, Math.floor(50 * BALANCE.ONE_HAND_ATK_RATIO));
    assert.equal(profile.offhandAttack, 0);
    assert.equal(profile.shieldDef, 0);
});

test('getEquipmentProfile supports shield offhand with mp bonus', () => {
    const shield = { type: 'shield', val: 8, mp: 15, crit: 0.04 };
    const equip = {
        weapon: { type: 'weapon', hands: 1, val: 40 },
        offhand: shield,
    };

    const profile = getEquipmentProfile(equip);

    assert.equal(profile.offhandShield, shield);
    assert.equal(profile.shieldDef, 8);
    assert.equal(profile.mpBonus, 15);
    assert.ok(profile.critBonus >= 0.04);
});

test('getEquipmentProfile handles dual-wield setups', () => {
    const equip = {
        weapon: { type: 'weapon', hands: 1, val: 60 },
        offhand: { type: 'weapon', hands: 1, val: 50 },
    };

    const profile = getEquipmentProfile(equip);

    assert.ok(profile.offhandWeapon);
    assert.equal(profile.offhandShield, null);
    assert.equal(profile.mainAttack, Math.floor(60 * BALANCE.ONE_HAND_ATK_RATIO));
    assert.equal(profile.offhandAttack, Math.floor(50 * BALANCE.OFFHAND_WEAPON_RATIO));
});

// ─── getNextEquipmentState ───────────────────────────────────────────────
test('getNextEquipmentState equips armor into the armor slot', () => {
    const armor = { type: 'armor', val: 10, name: 'Plate' };
    const next = getNextEquipmentState({}, armor);
    assert.equal(next.armor, armor);
});

test('equipping a two-hand weapon clears the offhand slot', () => {
    const current = {
        weapon: { type: 'weapon', hands: 1, val: 20, name: 'Dagger' },
        offhand: { type: 'weapon', hands: 1, val: 15, name: 'Dagger2' },
    };
    const twoHand = { type: 'weapon', hands: 2, val: 80, name: 'GreatSword' };
    const next = getNextEquipmentState(current, twoHand);

    assert.equal(next.weapon, twoHand);
    assert.equal(next.offhand, null);
});

test('equipping a shield while wielding a two-hand weapon is rejected', () => {
    const current = { weapon: { type: 'weapon', hands: 2, val: 80, name: 'GreatAxe' } };
    const shield = { type: 'shield', val: 10, name: 'Buckler' };
    const next = getNextEquipmentState(current, shield);

    assert.equal(next.offhand, undefined);
    assert.equal(next.weapon, current.weapon);
});

test('equipping a shield places it on offhand when wielding a one-hand weapon', () => {
    const weapon = { type: 'weapon', hands: 1, val: 30, name: 'Rapier' };
    const shield = { type: 'shield', val: 6, name: 'Buckler' };
    const next = getNextEquipmentState({ weapon }, shield);

    assert.equal(next.offhand, shield);
    assert.equal(next.weapon, weapon);
});

test('equipping a better one-hand weapon in dual-wield picks the best pair', () => {
    const weakMain = { type: 'weapon', hands: 1, val: 10, name: 'A' };
    const weakOff = { type: 'weapon', hands: 1, val: 12, name: 'B' };
    const strongerNew = { type: 'weapon', hands: 1, val: 50, name: 'C' };

    const next = getNextEquipmentState({ weapon: weakMain, offhand: weakOff }, strongerNew);

    // The new weapon must end up somewhere in the dual-wield pair
    assert.ok(next.weapon === strongerNew || next.offhand === strongerNew);
});

// ─── Magic weapon detection ──────────────────────────────────────────────
test('isMagicWeapon detects elemental and keyword-based magic weapons', () => {
    assert.equal(isMagicWeapon({ type: 'weapon', elem: '화염' }), true);
    assert.equal(isMagicWeapon({ type: 'weapon', elem: '물리' }), false);
    assert.equal(isMagicWeapon({ type: 'weapon', name: '숙련자의 지팡이' }), true);
    assert.equal(isMagicWeapon({ type: 'weapon', name: '강철 롱소드' }), false);
    assert.equal(isMagicWeapon(null), false);
    assert.equal(isMagicWeapon({ type: 'armor', name: '지팡이' }), false);
});

test('getEquippedWeapons returns only weapon slots', () => {
    const equip = {
        weapon: { type: 'weapon', name: 'A' },
        offhand: { type: 'shield', name: 'S' },
    };
    const entries = getEquippedWeapons(equip);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].slot, 'main');
});

test('getWeaponMagicSkills creates skill entries for magic weapons', () => {
    const equip = {
        weapon: { type: 'weapon', elem: '화염', name: '불꽃의 검', val: 60 },
        offhand: { type: 'weapon', elem: '냉기', name: '서리 검', val: 50 },
    };
    const skills = getWeaponMagicSkills(equip);
    assert.equal(skills.length, 2);
    assert.ok(skills.every((skill) => skill.fromWeapon === true));
    assert.ok(skills.some((skill) => skill.type === '화염'));
    assert.ok(skills.some((skill) => skill.type === '냉기'));
});

test('getWeaponMagicSkills ignores physical weapons', () => {
    const equip = {
        weapon: { type: 'weapon', name: '강철 롱소드', val: 50 },
    };
    assert.equal(getWeaponMagicSkills(equip).length, 0);
});
