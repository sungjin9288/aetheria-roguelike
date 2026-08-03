import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.js';
import {
    consumeInventoryItemByName,
    countInventoryItemByName,
    getEnhanceAvailability,
    getEnhanceMaterialCount,
    getEnhancePreview,
    getEnhanceRequirement,
} from '../src/utils/enhancementUtils.js';

test('enhance requirement scales gold and material cost by current level', () => {
    const early = getEnhanceRequirement(0);
    const late = getEnhanceRequirement(7);

    assert.equal(early.materialName, CONSTANTS.ENHANCE_MATERIAL_NAME);
    assert.equal(early.gold, 150);
    assert.equal(early.materials, 1);
    assert.equal(late.gold, 25000);
    assert.equal(late.materials, 4);
});

test('enhance success rates are non-guaranteed and decline by level', () => {
    const materials = Array.from({ length: 10 }, (_, index) => ({
        id: `mat-${index}`,
        name: CONSTANTS.ENHANCE_MATERIAL_NAME,
    }));
    const early = getEnhancePreview({ type: 'weapon', val: 25, enhance: 0 }, 100_000, materials, 'weapon');
    const mid = getEnhancePreview({ type: 'weapon', val: 25, enhance: 4 }, 100_000, materials, 'weapon');
    const late = getEnhancePreview({ type: 'weapon', val: 25, enhance: 9 }, 100_000, materials, 'weapon');

    assert.equal(early.successRate, 0.9);
    assert.equal(mid.successRate, 0.5);
    assert.equal(late.successRate, 0.18);
    assert.ok(early.successRate > mid.successRate);
    assert.ok(mid.successRate > late.successRate);
});

test('enhance material count only counts the configured reinforcement material', () => {
    const inventory = [
        { id: 'a', name: CONSTANTS.ENHANCE_MATERIAL_NAME },
        { id: 'b', name: '철광석' },
        { id: 'c', name: CONSTANTS.ENHANCE_MATERIAL_NAME },
    ];

    assert.equal(countInventoryItemByName(inventory, CONSTANTS.ENHANCE_MATERIAL_NAME), 2);
    assert.equal(getEnhanceMaterialCount(inventory), 2);
});

test('consumeInventoryItemByName removes only the requested number of materials', () => {
    const inventory = [
        { id: 'a', name: CONSTANTS.ENHANCE_MATERIAL_NAME },
        { id: 'b', name: CONSTANTS.ENHANCE_MATERIAL_NAME },
        { id: 'c', name: '철광석' },
        { id: 'd', name: CONSTANTS.ENHANCE_MATERIAL_NAME },
    ];

    const { nextInventory, removed } = consumeInventoryItemByName(inventory, CONSTANTS.ENHANCE_MATERIAL_NAME, 2);

    assert.equal(removed, 2);
    assert.deepEqual(nextInventory.map((item) => item.id), ['c', 'd']);
});

test('enhance availability reports the blocking resource before the action runs', () => {
    const weapon = { name: '훈련용 검', type: 'weapon', enhance: 0 };

    const noGold = getEnhanceAvailability(weapon, 100, [
        { id: 'mat-1', name: CONSTANTS.ENHANCE_MATERIAL_NAME },
    ]);
    assert.equal(noGold.affordable, false);
    assert.equal(noGold.missing, 'gold');
    assert.equal(noGold.hint, '골드 부족');

    const noMaterial = getEnhanceAvailability(weapon, 500, []);
    assert.equal(noMaterial.affordable, false);
    assert.equal(noMaterial.missing, 'material');
    assert.equal(noMaterial.hint, '재료 부족');

    const ready = getEnhanceAvailability(weapon, 500, [
        { id: 'mat-1', name: CONSTANTS.ENHANCE_MATERIAL_NAME },
    ]);
    assert.equal(ready.affordable, true);
    assert.equal(ready.missing, null);
    assert.equal(ready.hint, '강화 가능');
});
