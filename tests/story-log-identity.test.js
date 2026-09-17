import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as engine from '../src/hooks/useGameEngine.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';

test('same-millisecond victory and level-up stories update only their own placeholder', () => {
    assert.equal(typeof engine.allocateStoryLogId, 'function');
    const sequence = { current: 0 };
    const ids = [engine.allocateStoryLogId(sequence, 100), engine.allocateStoryLogId(sequence, 100)];
    assert.notEqual(ids[0], ids[1]);
    let state = { ...structuredClone(INITIAL_STATE), logs: [] };
    for (const id of ids) state = gameReducer(state, {
        type: 'ADD_LOG', payload: { id, type: 'loading', text: '...' },
    });
    state = gameReducer(state, {
        type: 'UPDATE_LOG', payload: { id: ids[1], log: { id: ids[1], type: 'story', text: '레벨 상승' } },
    });
    assert.deepEqual(state.logs.map(log => log.text), ['...', '레벨 상승']);
    state = gameReducer(state, {
        type: 'UPDATE_LOG', payload: { id: ids[0], log: { id: ids[0], type: 'story', text: '전투 승리' } },
    });
    assert.deepEqual(state.logs.map(log => log.text), ['전투 승리', '레벨 상승']);
    assert.equal(new Set(state.logs.map(log => log.id)).size, 2);
});

test('story identity stays unique with a stopped or backwards clock and consumes no RNG', () => {
    assert.equal(typeof engine.allocateStoryLogId, 'function');
    const originalRandom = Math.random;
    Math.random = () => { throw new Error('Narrative identity must not consume gameplay RNG'); };
    try {
        const sequence = { current: 0 };
        const ids = [100, 100, 99, 100].map(now => engine.allocateStoryLogId(sequence, now));
        assert.equal(new Set(ids).size, 4);
        assert.equal(sequence.current, 4);
    } finally {
        Math.random = originalRandom;
    }
});

test('production story callback allocates identity from a persistent ref before awaiting narration', () => {
    const source = readFileSync(new URL('../src/hooks/useGameEngine.ts', import.meta.url), 'utf8');
    assert.match(source, /const storyLogSequenceRef = useRef\(0\)/);
    assert.match(source, /const tempId = allocateStoryLogId\(storyLogSequenceRef\)/);
    assert.ok(source.indexOf('const tempId = allocateStoryLogId') < source.indexOf('await AI_SERVICE.generateStory'));
});
