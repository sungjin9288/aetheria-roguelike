import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRODUCTION_GAME_CAPABILITIES } from '../src/platform/gameCapabilities.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { createInventoryActions } from '../src/hooks/useInventoryActions.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSource = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

test('production capabilities keep public grave invasion frozen off', () => {
    assert.deepEqual(PRODUCTION_GAME_CAPABILITIES, { publicGraveInvasion: false });
    assert.equal(Object.isFrozen(PRODUCTION_GAME_CAPABILITIES), true);
    assert.throws(() => {
        PRODUCTION_GAME_CAPABILITIES.publicGraveInvasion = true;
    }, TypeError);
});

test('production inventory actions do not expose public grave invasion', () => {
    const actions = createInventoryActions({
        player: structuredClone(INITIAL_STATE.player),
        gameState: 'idle',
        dispatch: () => assert.fail('public grave action must not dispatch'),
        addLog: () => assert.fail('public grave action must not log'),
        addStoryLog: () => {},
        getFullStats: () => ({ atk: 10 }),
    });

    assert.equal('invadeGrave' in actions, false);
});

test('direct public grave reducer dispatch is an exact no-op in production', () => {
    const state = structuredClone(INITIAL_STATE);
    const next = gameReducer(state, {
        type: AT.INVADE_GRAVE,
        payload: {
            uid: 'remote-grave',
            reward: { id: 'forged', name: '복제된 장비', type: 'weapon', tier: 6 },
        },
    });

    assert.equal(next, state);
});

test('all public grave network and render owners share the production capability gate', async () => {
    const [panel, dashboard, sync] = await Promise.all([
        readSource('src/components/GravePanel.tsx'),
        readSource('src/components/Dashboard.tsx'),
        readSource('src/hooks/useFirebaseSync.ts'),
    ]);

    assert.match(panel, /capabilities\.publicGraveInvasion/);
    assert.match(panel, /capabilities\.publicGraveInvasion\s*&&\s*\(/);
    assert.match(dashboard, /capabilities=\{PRODUCTION_GAME_CAPABILITIES\}/);
    assert.match(sync, /PRODUCTION_GAME_CAPABILITIES\.publicGraveInvasion/);
});
