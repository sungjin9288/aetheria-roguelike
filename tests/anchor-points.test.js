import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AVATAR_ANCHORS,
    BACK_LAYER_ARMOR_STYLES,
    BACK_LAYER_HEADGEAR_STYLES,
    BACK_LAYER_OFFHAND_STYLES,
    getArmorPlacement,
    getBodyPlacement,
    getHeadgearPlacement,
    getOffhandPlacement,
    getWeaponPlacement,
    placementLayer,
    placementToTransform,
} from '../src/utils/anchorPoints.js';
import {
    getArmorTransform,
    getOffhandTransform,
    getWeaponTransform,
} from '../src/utils/avatarEquipmentPreview.js';

test('AVATAR_ANCHORS defines the 6 canonical anchor points', () => {
    for (const name of ['head_top', 'head_center', 'torso_center', 'hand_front', 'hand_back', 'back_anchor', 'feet']) {
        assert.ok(AVATAR_ANCHORS[name], `${name} anchor should exist`);
        assert.equal(typeof AVATAR_ANCHORS[name].x, 'number');
        assert.equal(typeof AVATAR_ANCHORS[name].y, 'number');
    }
});

test('every weapon style resolves to a placement attached to hand_front', () => {
    const styles = ['sword', 'dagger', 'greatsword', 'greataxe', 'bow', 'longbow', 'staff', 'wand', 'rod', 'axe', 'hammer', 'mace', 'spear', 'lance', 'scythe', 'rapier', 'saber', 'falchion', 'fork', 'fang-dagger', 'throwing-blade', 'twinblade', 'whip'];
    for (const style of styles) {
        const plc = getWeaponPlacement(style);
        assert.equal(plc.anchor, 'hand_front', `${style} should attach to hand_front`);
        assert.equal(plc.layer, 'front');
        assert.ok(plc.transform.scale > 0);
    }
});

test('every offhand style resolves to a placement attached to hand_back', () => {
    const styles = ['shield', 'tower-shield', 'kite-shield', 'buckler', 'grimoire', 'tome', 'tablet', 'scroll', 'bow', 'staff', 'wand', 'dagger', 'sword'];
    for (const style of styles) {
        const plc = getOffhandPlacement(style);
        assert.equal(plc.anchor, 'hand_back', `${style} offhand should attach to hand_back`);
    }
});

test('shields render in the back layer so the body overlaps the grip edge', () => {
    for (const style of BACK_LAYER_OFFHAND_STYLES) {
        const plc = getOffhandPlacement(style);
        assert.equal(placementLayer(plc), 'back', `${style} should be in back layer`);
    }
});

test('cloak body armor renders in the back layer', () => {
    assert.ok(BACK_LAYER_ARMOR_STYLES.has('cloak'));
    const plc = getBodyPlacement('cloak');
    assert.equal(placementLayer(plc), 'back');
});

test('hood-cloak headgear renders in the back layer', () => {
    assert.ok(BACK_LAYER_HEADGEAR_STYLES.has('hood-cloak'));
    const plc = getHeadgearPlacement('hood-cloak');
    assert.equal(placementLayer(plc), 'back');
});

test('plate, robe, leather, tunic all attach to torso_center', () => {
    for (const style of ['plate', 'robe', 'leather', 'tunic']) {
        const plc = getBodyPlacement(style);
        assert.equal(plc.anchor, 'torso_center', `${style} should attach to torso_center`);
    }
});

test('helm, hood, cap, straw-hat attach to head_top', () => {
    for (const style of ['helm', 'hood', 'cap', 'straw-hat', 'wizard-hat']) {
        const plc = getHeadgearPlacement(style);
        assert.equal(plc.anchor, 'head_top', `${style} should attach to head_top`);
    }
});

test('circlet and mask attach to head_center (tighter-fitting headgear)', () => {
    assert.equal(getHeadgearPlacement('circlet').anchor, 'head_center');
    assert.equal(getHeadgearPlacement('mask').anchor, 'head_center');
});

test('getArmorPlacement prefers headgear when isHeadgearOnly is true', () => {
    const plc = getArmorPlacement({ isHeadgearOnly: true, headgearStyle: 'straw-hat', bodyStyle: 'none' });
    assert.equal(plc.anchor, 'head_top');
    assert.equal(plc.transform.scale, 0.48);
});

test('getArmorPlacement prefers body style when both head and body are set', () => {
    const plc = getArmorPlacement({ isHeadgearOnly: false, headgearStyle: 'circlet', bodyStyle: 'robe' });
    assert.equal(plc.anchor, 'torso_center');
});

test('getArmorPlacement returns null when no visible armor style', () => {
    assert.equal(getArmorPlacement({ headgearStyle: 'none', bodyStyle: 'none' }), null);
    assert.equal(getArmorPlacement(null), null);
});

test('placementToTransform produces SVG transform string with translate, rotate, scale', () => {
    const plc = getWeaponPlacement('sword');
    const str = placementToTransform(plc);
    assert.match(str, /^translate\(/);
    assert.match(str, /rotate\(/);
    assert.match(str, /scale\(/);
});

test('armor transforms skip the rotate step (no rotation needed for body armor)', () => {
    const str = placementToTransform(getBodyPlacement('plate'));
    assert.match(str, /^translate\(/);
    assert.doesNotMatch(str, /rotate/);
});

// Regression: verify that refactoring preserved the exact pixel positioning.
test('backwards compatibility: sword weapon transform is unchanged', () => {
    assert.equal(getWeaponTransform({ style: 'sword' }), 'translate(41 34) rotate(10 12 12) scale(0.26)');
});

test('backwards compatibility: greatsword weapon transform is unchanged', () => {
    assert.equal(getWeaponTransform({ style: 'greatsword' }), 'translate(34 23) rotate(-18 12 12) scale(0.41)');
});

test('backwards compatibility: bow weapon transform is unchanged', () => {
    assert.equal(getWeaponTransform({ style: 'bow' }), 'translate(34 22) rotate(-10 12 12) scale(0.39)');
});

test('backwards compatibility: staff weapon transform is unchanged', () => {
    assert.equal(getWeaponTransform({ style: 'staff' }), 'translate(35 20) rotate(-16 12 12) scale(0.39)');
});

test('backwards compatibility: dagger weapon transform is unchanged', () => {
    assert.equal(getWeaponTransform({ style: 'dagger' }), 'translate(41 35) rotate(18 12 12) scale(0.23)');
});

test('backwards compatibility: kite-shield offhand transform is unchanged', () => {
    assert.equal(getOffhandTransform({ style: 'kite-shield' }), 'translate(11 31) rotate(-6 12 12) scale(0.33)');
});

test('backwards compatibility: grimoire offhand transform is unchanged', () => {
    assert.equal(getOffhandTransform({ style: 'grimoire' }), 'translate(13 35) rotate(-10 12 12) scale(0.23)');
});

test('backwards compatibility: plate body transform is unchanged', () => {
    assert.equal(
        getArmorTransform({ bodyStyle: 'plate', headgearStyle: 'none', isHeadgearOnly: false }),
        'translate(8 20) scale(0.7)'
    );
});

test('backwards compatibility: robe body transform is unchanged', () => {
    assert.equal(
        getArmorTransform({ bodyStyle: 'robe', headgearStyle: 'none', isHeadgearOnly: false }),
        'translate(8 19) scale(0.72)'
    );
});

test('backwards compatibility: straw-hat headgear-only transform is unchanged', () => {
    assert.equal(
        getArmorTransform({ bodyStyle: 'none', headgearStyle: 'straw-hat', isHeadgearOnly: true }),
        'translate(12 6) scale(0.48)'
    );
});

test('backwards compatibility: circlet headgear-only transform is unchanged', () => {
    assert.equal(
        getArmorTransform({ bodyStyle: 'none', headgearStyle: 'circlet', isHeadgearOnly: true }),
        'translate(15 10) scale(0.42)'
    );
});

test('backwards compatibility: cloak body transform is unchanged', () => {
    assert.equal(
        getArmorTransform({ bodyStyle: 'cloak', headgearStyle: 'none', isHeadgearOnly: false }),
        'translate(7 18) scale(0.74)'
    );
});
