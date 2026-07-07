import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSignatureSetBonus, getSignatureSet, getSignatureSetDefinitions, getSignatureSetProgress } from '../src/utils/signatureSetBonus.js';

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

test('dragon-lord 2H weapon + armor triggers 3-set (fix/signature-set-two-hand: 라그나로크 is 2H, counts as 2)', () => {
    const result = computeSignatureSetBonus({
        weapon: { name: '라그나로크' },
        armor: { name: '드래곤로드 갑주' },
        offhand: null,
    });
    // 라그나로크(2H, weight 2) + 드래곤로드 갑주(armor, weight 1) = count 3.
    // Previously this asserted count=2 (physical item count); the 2H-as-2-piece
    // rule changed this to reflect the weapon occupying both weapon+offhand slots.
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'dragon-lord');
    assert.equal(result.activeSet.count, 3);
    assert.equal(result.activeSet.tier, 3);
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
        weapon: { name: '세계수의 검' }, // worldtree, 1H — weight 1
        armor: { name: '드래곤로드 갑주' }, // dragon-lord, weight 1
        offhand: { name: '천공 성전' }, // celestial, weight 1
    });
    // 3 different sets, each with count 1 → no set active.
    // NOTE: uses 1H members only (fix/signature-set-two-hand made 2H weapons count
    // as 2 pieces, so a 2H weapon here would activate its own set alone).
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

// --- getSignatureSetProgress (EquipmentPanel 세트 진행도 힌트용) ---

test('getSignatureSetProgress returns null when no signature is equipped', () => {
    const result = getSignatureSetProgress({
        weapon: { name: '녹슨 단검' },
        armor: null,
        offhand: null,
    });
    assert.equal(result, null);
});

test('getSignatureSetProgress returns null when equip is falsy', () => {
    assert.equal(getSignatureSetProgress(null), null);
    assert.equal(getSignatureSetProgress(undefined), null);
});

test('getSignatureSetProgress: 1 celestial equipped → nextTier=2, not active', () => {
    const result = getSignatureSetProgress({
        weapon: { name: '성검 에테르니아' },
        armor: null,
        offhand: null,
    });
    assert.ok(result);
    assert.equal(result.key, 'celestial');
    assert.equal(result.equippedCount, 1);
    assert.equal(result.totalMembers, 4);
    assert.equal(result.currentTier, null);
    assert.equal(result.nextTier, 2);
    assert.ok(result.nextBonus);
    assert.ok(result.nextBonus.atkMult > 1, 'celestial 2-set should boost atk');
    assert.equal(result.isActive, false);
    assert.ok(result.missingMembers.includes('천공 성전'));
});

test('getSignatureSetProgress: 2 celestial equipped → active at tier 2, nextTier=3', () => {
    const result = getSignatureSetProgress({
        weapon: { name: '성검 에테르니아' },
        offhand: { name: '천공 성전' },
        armor: null,
    });
    assert.ok(result);
    assert.equal(result.equippedCount, 2);
    assert.equal(result.currentTier, 2);
    assert.equal(result.nextTier, 3);
    assert.equal(result.isActive, true);
    assert.ok(result.nextBonus);
});

test('getSignatureSetProgress: shadow-lord 2-piece → active, no higher tier in some sets', () => {
    // shadow-lord has bonuses 2 and 3 — 2 equipped, nextTier=3
    const result = getSignatureSetProgress({
        weapon: { name: '그림자 절단기' },
        armor: { name: '암흑 군주의 망토' },
        offhand: null,
    });
    assert.ok(result);
    assert.equal(result.key, 'shadow-lord');
    assert.equal(result.currentTier, 2);
    assert.equal(result.nextTier, 3);
});

test('getSignatureSetProgress: dimension set only has 2-tier, reaching 2 exhausts progression', () => {
    // dimension bonuses = { 2: ... } — 2 equipped, nextTier=null
    const result = getSignatureSetProgress({
        weapon: { name: '차원 마왕의 낫' },
        offhand: { name: '차원 방패 이지스' },
        armor: null,
    });
    assert.ok(result);
    assert.equal(result.key, 'dimension');
    assert.equal(result.currentTier, 2);
    assert.equal(result.nextTier, null);
    assert.equal(result.nextBonus, null);
    assert.equal(result.isActive, true);
});

test('getSignatureSetProgress picks the set with most equipped when multiple groups present', () => {
    const result = getSignatureSetProgress({
        weapon: { name: '성검 에테르니아' }, // celestial
        offhand: { name: '천공 성전' }, // celestial
        armor: { name: '세계수의 로브' }, // worldtree (1개뿐)
    });
    assert.ok(result);
    assert.equal(result.key, 'celestial', 'celestial(2) wins over worldtree(1)');
    assert.equal(result.equippedCount, 2);
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
