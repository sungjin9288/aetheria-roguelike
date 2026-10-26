import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { clearTemporaryAdventureState } from '../src/utils/playerStateUtils.ts';
import { buildCloudPlayerSnapshot } from '../src/platform/cloudPlayerSnapshot.ts';

test('fresh and restored players serialize cleared adventure fields for Firestore (no undefined)', () => {
    const fresh = clearTemporaryAdventureState({ ...INITIAL_STATE.player, name: 'save-test' });
    const restored = gameReducer(INITIAL_STATE, {
        type: 'LOAD_DATA', payload: { player: fresh, gameState: 'idle' },
    }).player;
    for (const player of [fresh, restored]) {
        const before = structuredClone(player);
        const snapshot = buildCloudPlayerSnapshot(player, 1234);
        assert.equal(snapshot.deferredEventChainSteps, null);
        assert.equal(snapshot.adventureRelicBonuses, null);
        assert.equal(snapshot.stats.lastSeenAt, 1234);
        assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot, 'no undefined values in cloud player');
        assert.deepEqual(player, before, 'projection must not mutate live state');
    }
});

test('active expedition markers survive cloud projection while cleared ones travel as explicit null', () => {
    const player = { ...INITIAL_STATE.player,
        deferredEventChainSteps: { lost_wizard: 0 },
        adventureRelicBonuses: { killStackAtk: 3 },
    };
    const active = buildCloudPlayerSnapshot(player, 100);
    assert.deepEqual(active.deferredEventChainSteps, { lost_wizard: 0 });
    assert.deepEqual(active.adventureRelicBonuses, { killStackAtk: 3 });
    const cleared = buildCloudPlayerSnapshot(clearTemporaryAdventureState(player), 200);
    assert.ok(Object.hasOwn(cleared, 'deferredEventChainSteps'));
    assert.ok(Object.hasOwn(cleared, 'adventureRelicBonuses'));
    assert.equal(cleared.deferredEventChainSteps, null, 'Firestore rejects undefined — cleared fields travel as null');
    assert.equal(cleared.adventureRelicBonuses, null);
    const restored = gameReducer(INITIAL_STATE, {
        type: 'LOAD_DATA', payload: { player: cleared, gameState: 'idle' },
    }).player;
    assert.equal(restored.deferredEventChainSteps, undefined);
    assert.equal(restored.adventureRelicBonuses, undefined);
});
