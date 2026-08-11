import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCombatActionSeed } from '../src/utils/combatActionSeed.js';

test('combat action seed accepts one explicit uint32 test-harness token', () => {
    assert.equal(resolveCombatActionSeed(() => 0.75, 1), 1);
    assert.equal(resolveCombatActionSeed(() => 0.75, 0xffffffff), 0xffffffff);
});

test('combat action seed rejects malformed tokens and uses the production RNG', () => {
    assert.equal(resolveCombatActionSeed(() => 0.25, -1), 0x40000000);
    assert.equal(resolveCombatActionSeed(() => 0.25, 0x100000000), 0x40000000);
    assert.equal(resolveCombatActionSeed(() => 0.25, 1.5), 0x40000000);
    assert.equal(resolveCombatActionSeed(() => 0.25, '1'), 0x40000000);
});
