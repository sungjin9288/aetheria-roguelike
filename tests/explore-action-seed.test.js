import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveExploreActionRandom } from '../src/utils/exploreActionSeed.ts';
import { createSeededRandom } from '../src/utils/seededRandom.ts';

test('one explicit uint32 harness seed creates the canonical exploration stream', () => {
    const expected = createSeededRandom(112596);
    const actual = resolveExploreActionRandom(() => 0.25, 112596);
    assert.deepEqual(
        Array.from({ length: 8 }, () => actual()),
        Array.from({ length: 8 }, () => expected()),
    );
});

test('malformed harness seed preserves the production random source', () => {
    let calls = 0;
    const production = () => {
        calls += 1;
        return 0.75;
    };
    const actual = resolveExploreActionRandom(production, 0x100000000);
    assert.strictEqual(actual, production);
    assert.equal(actual(), 0.75);
    assert.equal(calls, 1);
});
