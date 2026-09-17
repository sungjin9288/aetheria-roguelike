import test from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS } from '../src/data/items.js';
import {
    CANONICAL_EQUIPMENT,
    getCanonicalEquipmentPrice,
    migrateEquipmentInstancePrice,
    resolveEquipmentBaseIdentity,
    validateCanonicalEquipmentCatalog,
    withCanonicalEquipmentBaseIdentity,
} from '../src/utils/equipmentBaseIdentity.js';
import { makeItem } from '../src/utils/gameUtils.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { checkDiscoveryChains } from '../src/utils/exploreUtils.ts';
import { BALANCE } from '../src/data/constants.ts';

test('canonical equipment authority covers exactly 229 unique typed identities', () => {
    assert.equal(CANONICAL_EQUIPMENT.length, 229);
    assert.deepEqual(
        Object.fromEntries(['weapon', 'armor', 'shield'].map((type) => [
            type,
            CANONICAL_EQUIPMENT.filter((item) => item.type === type).length,
        ])),
        { weapon: 117, armor: 91, shield: 21 },
    );
    assert.doesNotThrow(() => validateCanonicalEquipmentCatalog());
    assert.equal(new Set(CANONICAL_EQUIPMENT.map((item) => `${item.type}\0${item.name}`)).size, 229);
});

test('catalog authority fails closed for a duplicate canonical identity', () => {
    const duplicate = [...CANONICAL_EQUIPMENT, { ...CANONICAL_EQUIPMENT[0] }];
    assert.throws(
        () => validateCanonicalEquipmentCatalog({ rows: duplicate }),
        /duplicate|229/i,
    );
});

test('catalog authority fails closed for invalid typed data and every required route', () => {
    const rows = [...CANONICAL_EQUIPMENT];
    const invalid = { ...rows[0], tier: 0, price: 0, val: 0, jobs: [] };
    assert.throws(() => validateCanonicalEquipmentCatalog({ rows: [invalid, ...rows.slice(1)] }), /tier|price|stat|job/i);

    const artEntries = Object.fromEntries(CANONICAL_EQUIPMENT.map((item) => [item.name, 'valid-route']));
    delete artEntries[CANONICAL_EQUIPMENT[0].name];
    assert.throws(() => validateCanonicalEquipmentCatalog({ artEntries }), /art route/i);

    const signatureName = '용의 화염';
    assert.throws(
        () => validateCanonicalEquipmentCatalog({
            signatures: { [signatureName]: { spriteKey: 'signature-armor-not-a-weapon' } },
        }),
        /signature route|unregistered signature/i,
    );
    assert.throws(() => validateCanonicalEquipmentCatalog({ shopRows: [] }), /shop route/i);

    const unknownJob = { ...rows[0], jobs: [...rows[0].jobs, '존재하지 않는 직업'] };
    assert.throws(
        () => validateCanonicalEquipmentCatalog({ rows: [unknownJob, ...rows.slice(1)] }),
        /unknown canonical job/i,
    );
});

test('base identity resolution is exact and never fuzzy-matches a legacy name', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);

    assert.equal(resolveEquipmentBaseIdentity({ type: 'weapon', baseItemName: base.name, name: base.name })?.name, base.name);
    assert.equal(resolveEquipmentBaseIdentity({ type: 'weapon', name: base.name })?.name, base.name);
    assert.equal(resolveEquipmentBaseIdentity({ type: 'weapon', name: `고대의 ${base.name}`, prefixed: true, prefixName: '고대의' })?.name, base.name);
    assert.equal(resolveEquipmentBaseIdentity({ type: 'weapon', name: `오래된 ${base.name}`, prefixed: true, prefixName: '오래된' }), null);
    assert.equal(resolveEquipmentBaseIdentity({
        type: 'weapon', name: `고대의 ${base.name}`, baseItemName: base.name,
        prefixed: 'true', prefixName: '고대의',
    }), null);
    assert.equal(resolveEquipmentBaseIdentity({ type: 'weapon', name: `유사 ${base.name}` }), null);
    assert.equal(resolveEquipmentBaseIdentity({ type: 'weapon', name: `${base.name} 유사` }), null);
});

test('persisted base identity requires the exact unprefixed display name', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);
    const malformed = {
        ...base,
        id: 'mismatched-unprefixed-display',
        baseItemName: base.name,
        name: '표시명 변경',
        price: 1,
    };

    assert.equal(resolveEquipmentBaseIdentity(malformed), null);
    assert.strictEqual(migrateEquipmentInstancePrice(malformed), malformed);
});

test('persisted base identity requires the matching prefixed display name', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    const differentBase = ITEMS.weapons.find((item) => item.name === '에테르 검');
    assert.ok(base);
    assert.ok(differentBase);
    const malformed = {
        ...base,
        id: 'mismatched-prefixed-display',
        baseItemName: base.name,
        name: `고대의 ${differentBase.name}`,
        prefixed: true,
        prefixName: '고대의',
        price: 1,
    };

    assert.equal(resolveEquipmentBaseIdentity(malformed), null);
    assert.strictEqual(migrateEquipmentInstancePrice(malformed), malformed);
});

test('a present non-string, null, or undefined base identity is malformed instead of falling back', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);
    for (const baseItemName of [42, null, undefined]) {
        const malformed = {
            ...base,
            id: `malformed-base-identity-${String(baseItemName)}`,
            baseItemName,
            price: 1,
        };

        assert.equal(resolveEquipmentBaseIdentity(malformed), null, String(baseItemName));
        assert.strictEqual(migrateEquipmentInstancePrice(malformed), malformed, String(baseItemName));
    }
});

test('non-boolean prefixed metadata without a prefix name is unresolved and migration is a no-op', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);
    const malformed = {
        ...base,
        id: 'malformed-prefix-flag',
        baseItemName: base.name,
        prefixed: 'true',
        price: 1,
        extension: { preserve: true },
    };

    assert.equal(resolveEquipmentBaseIdentity(malformed), null);
    assert.strictEqual(migrateEquipmentInstancePrice(malformed), malformed);
});

test('boolean prefixed false remains an exact unprefixed canonical identity', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);
    const unprefixed = {
        ...base,
        id: 'legacy-unprefixed-flag',
        baseItemName: base.name,
        prefixed: false,
        price: 1,
    };

    assert.equal(resolveEquipmentBaseIdentity(unprefixed)?.name, base.name);
    assert.equal(migrateEquipmentInstancePrice(unprefixed).price, base.price);
});

test('prefixed items require a known compatible prefix before trusting a persisted base identity', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);
    for (const prefixName of ['오래된', '단단한']) {
        const malformed = {
            ...base,
            id: `malformed-prefix-${prefixName}`,
            name: `${prefixName} ${base.name}`,
            baseItemName: base.name,
            prefixed: true,
            prefixName,
            price: 1,
        };

        assert.equal(resolveEquipmentBaseIdentity(malformed), null, prefixName);
        assert.strictEqual(migrateEquipmentInstancePrice(malformed), malformed, prefixName);
    }
});

test('prefixed items without a prefix name are unresolved and migration is a no-op', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);
    const malformed = {
        ...base,
        id: 'missing-prefix-name',
        baseItemName: base.name,
        prefixed: true,
        price: 1,
    };

    assert.equal(resolveEquipmentBaseIdentity(malformed), null);
    assert.strictEqual(migrateEquipmentInstancePrice(malformed), malformed);
});

test('equipment creation persists only canonical base identity and prefix price is applied once', () => {
    const base = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(base);

    const equipment = makeItem(base, () => 0, () => 1000);
    const consumable = makeItem(ITEMS.consumables[0], () => 0, () => 1000);
    const prefixed = {
        ...base,
        name: `고대의 ${base.name}`,
        prefixed: true,
        prefixName: '고대의',
        val: base.val + 10,
        price: 1,
    };

    assert.equal(equipment.baseItemName, base.name);
    assert.equal('baseItemName' in consumable, false);
    assert.equal(withCanonicalEquipmentBaseIdentity({ type: 'weapon', name: '알 수 없는 장비' }).baseItemName, undefined);
    assert.equal(getCanonicalEquipmentPrice(prefixed), Math.floor(base.price * 2.5));
});

test('discovery-chain equipment rewards preserve the canonical base identity', () => {
    const equipmentChains = ['fire_convergence', 'frozen_truth', 'demon_trail'];

    for (const chainId of equipmentChains) {
        const chain = BALANCE.DISCOVERY_CHAINS.find((entry) => entry.id === chainId);
        assert.ok(chain?.reward?.item);
        const player = structuredClone(INITIAL_STATE.player);
        player.stats = {
            ...player.stats,
            visitedMaps: chain.locations.slice(0, -1),
            discoveryChains: [],
        };
        let updated;
        checkDiscoveryChains(player, chain.locations.at(-1), {
            addLog: () => {},
            dispatch: (action) => {
                updated = action.payload(player);
            },
        });

        const reward = updated.inv.find((item) => item.name === chain.reward.item);
        assert.equal(reward?.baseItemName, chain.reward.item, chainId);
        assert.equal(reward?.id?.startsWith('disc_'), true, chainId);
    }
});
