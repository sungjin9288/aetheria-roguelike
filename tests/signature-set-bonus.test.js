import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSignatureSetBonus, getSignatureSet, getSignatureSetDefinitions } from '../src/utils/signatureSetBonus.js';

test('no signature items equipped → neutral bonus', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '녹슨 단검', type: 'weapon' },
        armor: { name: '여행자 튜닉', type: 'armor' },
        offhand: null,
    });
    assert.equal(result.atkMult, 1);
    assert.equal(result.defMult, 1);
    assert.equal(result.hpMult, 1);
    assert.equal(result.activeSet, null);
});

test('single signature item equipped → neutral bonus (needs 2+)', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '성검 에테르니아' },
        armor: null,
        offhand: null,
    });
    assert.equal(result.activeSet, null);
});

test('celestial 2-piece (에테르니아 + 천공 성전) triggers 2-set bonus', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '성검 에테르니아' },
        offhand: { name: '천공 성전' },
        armor: null,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'celestial');
    assert.equal(result.activeSet.count, 2);
    assert.equal(result.activeSet.tier, 2);
    assert.ok(result.atkMult > 1);
});

test('dragon-lord 3-piece (용의 화염 + 드래곤로드 + 라그나로크) triggers 3-set', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '라그나로크' },
        armor: { name: '드래곤로드 갑주' },
        offhand: null,
    });
    // Only 2 equipped via the 3 slots (weapon, armor), both dragon-lord
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'dragon-lord');
    assert.equal(result.activeSet.count, 2);
});

test('shadow-lord 2-piece applies negative defMult (어둠 계약)', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '그림자 절단기' },
        armor: { name: '암흑 군주의 망토' },
        offhand: null,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'shadow-lord');
    assert.ok(result.atkMult > 1);
    assert.ok(result.defMult < 1, 'shadow-lord has defensive penalty');
});

test('different signature sets do not combine (uses most-count set)', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '라그나로크' }, // dragon-lord
        armor: { name: '세계수의 로브' }, // worldtree
        offhand: { name: '천공 성전' }, // celestial
    });
    // 3 different sets, each with count 1 → no set active
    assert.equal(result.activeSet, null);
});

test('worldtree 2-piece (검 + 로브) triggers bonus', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '세계수의 검' },
        armor: { name: '세계수의 로브' },
        offhand: null,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'worldtree');
    assert.ok(result.defMult > 1);
    assert.ok(result.hpMult > 1);
});

test('getSignatureSet returns definition or null', () => {
    assert.ok(getSignatureSet('worldtree'));
    assert.ok(getSignatureSet('celestial'));
    assert.equal(getSignatureSet('unknown-set'), null);
});

test('getSignatureSetDefinitions returns all 5 known sets', () => {
    const defs = getSignatureSetDefinitions();
    const keys = Object.keys(defs);
    assert.equal(keys.length, 5);
    for (const key of ['celestial', 'worldtree', 'dragon-lord', 'dimension', 'shadow-lord']) {
        assert.ok(defs[key], `${key} should exist`);
        assert.ok(defs[key].members.length >= 2);
        assert.ok(defs[key].bonuses['2']);
    }
});

test('every set member exists in SIGNATURE_ITEM_REGISTRY', () => {
    // 세트 멤버가 오타 나거나 registry에 없으면 세트가 영원히 활성화 안 됨
    const defs = getSignatureSetDefinitions();
    const memberNames = Object.values(defs).flatMap((def) => def.members);
    // Importing here to avoid circular worries
    return import('../src/data/signatureItems.js').then(({ SIGNATURE_ITEM_REGISTRY }) => {
        for (const name of memberNames) {
            assert.ok(SIGNATURE_ITEM_REGISTRY[name], `Set member "${name}" must be in SIGNATURE_ITEM_REGISTRY`);
        }
    });
});
