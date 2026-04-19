import test from 'node:test';
import assert from 'node:assert/strict';

import { __NAME_GENERATOR_TESTING__, createRandomMobileName } from '../src/utils/nameGenerator.js';

test('createRandomMobileName can return a curated fantasy-style name', () => {
    const name = createRandomMobileName(() => 0);
    assert.equal(name, __NAME_GENERATOR_TESTING__.CURATED_FANTASY_NAMES[0]);
});

test('createRandomMobileName can build a fantasy two-to-four-syllable name from prefix/suffix pools', () => {
    const sequence = [0.8, 0.1, 0, 0];
    let index = 0;
    const name = createRandomMobileName(() => sequence[index++] ?? 0);

    assert.ok(Array.from(name).length >= 2);
    assert.ok(Array.from(name).length <= 4);
    assert.match(name, __NAME_GENERATOR_TESTING__.HANGUL_NAME_RE);
});

test('createRandomMobileName can build a fantasy three-to-four-syllable name from curated syllable chains', () => {
    const sequence = [0.95, 0.95, 0, 0, 0];
    let index = 0;
    const name = createRandomMobileName(() => sequence[index++] ?? 0);

    assert.ok(Array.from(name).length >= 3);
    assert.ok(Array.from(name).length <= 4);
    assert.match(name, __NAME_GENERATOR_TESTING__.HANGUL_NAME_RE);
});

test('createRandomMobileName avoids duplicated single-syllable repeats', () => {
    const sequence = [0.8, 0.1, 0.2, 0.2];
    let index = 0;
    const name = createRandomMobileName(() => sequence[index++] ?? 0);

    assert.notEqual(name, '엘엘');
    assert.match(name, __NAME_GENERATOR_TESTING__.HANGUL_NAME_RE);
});
