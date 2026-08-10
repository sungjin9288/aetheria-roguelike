import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { pickFallbackEvent } from '../src/utils/aiEventUtils.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import {
    createDomainRandom,
    createSeededRandom,
    deriveSeed,
} from '../src/utils/seededRandom.ts';

const sequence = (seed) => {
    const rng = createSeededRandom(seed);
    return [rng(), rng(), rng(), rng()].map((value) => Number(value.toFixed(12)));
};

test('shared Mulberry32 vectors remain byte-stable for fixed simulator seeds', () => {
    assert.deepEqual(sequence(0), [0.266429208685, 0.000329745701, 0.223272027448, 0.146202147938]);
    assert.deepEqual(sequence(1), [0.627073940588, 0.00273572118, 0.52744703996, 0.981050967472]);
    assert.deepEqual(sequence(20260810), [0.545970282983, 0.899680187926, 0.475864324253, 0.291497320635]);
});

test('domain streams are independent of invocation order', () => {
    assert.equal(deriveSeed(20260810, 'expedition-1', 'spawn'), 3641314344);
    assert.equal(deriveSeed(20260810, 'expedition-1', 'loot'), 1578786199);
    const spawnFirst = [
        createDomainRandom(42, 'run-1', 'spawn')(),
        createDomainRandom(42, 'run-1', 'loot')(),
    ];
    const lootFirst = [
        createDomainRandom(42, 'run-1', 'loot')(),
        createDomainRandom(42, 'run-1', 'spawn')(),
    ];
    assert.equal(spawnFirst[0], lootFirst[1]);
    assert.equal(spawnFirst[1], lootFirst[0]);
});

test('exploration spawn and fallback event accept explicit deterministic RNG without global patching', () => {
    const player = { ...structuredClone(INITIAL_STATE.player), loc: '고요한 숲' };
    const mapData = { level: 7, monsters: ['슬라임', '고블린'], bossMonsters: [] };
    const spawn = (seed) => spawnEnemy(
        mapData,
        player,
        [],
        { addLog: () => {} },
        { rng: createSeededRandom(seed) },
    );
    assert.deepEqual(spawn(7), spawn(7));
    assert.equal(spawn(7).mStats.level, 7);

    const fallback = (seed) => pickFallbackEvent(
        '고요한 숲',
        [],
        { job: '모험가', level: 1 },
        createSeededRandom(seed),
    );
    assert.deepEqual(fallback(99), fallback(99));
});

test('explore and event action authorities expose an injected RNG seam', () => {
    for (const relativePath of [
        '../src/hooks/gameActions/exploreActions.ts',
        '../src/hooks/gameActions/eventActions.ts',
    ]) {
        const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /Math\.random\s*\(/, relativePath);
        assert.match(source, /typeof deps\.rng === 'function'/, relativePath);
    }
});
