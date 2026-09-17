import test from 'node:test';
import assert from 'node:assert/strict';

import { getConsumableCompactLabel, getConsumableDescription } from '../src/utils/consumablePresentation.js';

test('compact QuickSlot labels distinguish recovery cure and buff categories', () => {
    assert.equal(getConsumableCompactLabel({ type: 'hp', val: 50 }), 'HP50');
    assert.equal(getConsumableCompactLabel({ type: 'hp', name: '엘릭서', val: 1 }), 'HP∞');
    assert.equal(getConsumableCompactLabel({ type: 'mp', val: 80 }), 'MP80');
    assert.equal(getConsumableCompactLabel({ type: 'cure', effect: 'poison' }), '해독');
    assert.equal(getConsumableCompactLabel({ type: 'cure', effect: 'freeze' }), '해빙');
    assert.equal(getConsumableCompactLabel({ type: 'buff', effect: 'atk_up' }), 'ATK');
    assert.equal(getConsumableCompactLabel({ type: 'buff', effect: 'all_up' }), 'ALL');
});

test('presentation preserves full accessible detail and Korean cure copy without raw effect tokens', () => {
    const cure = { name: '해독제', type: 'cure', effect: 'poison' };
    const detail = getConsumableDescription(cure, { includeTurnCost: true });

    assert.match(detail, /독 해제/);
    assert.doesNotMatch(detail, /poison/);
    assert.match(getConsumableDescription({ name: '분노의 물약', type: 'buff', effect: 'atk_up', val: 1.3, turn: 5 }, { includeTurnCost: true }), /전투 턴 1회/);
});
