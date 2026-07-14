import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    LOCAL_GAME_SNAPSHOT_KEY,
    clearLocalGameSnapshot,
    readLocalGameSnapshot,
    writeLocalGameSnapshot,
} from '../src/utils/localGameSnapshot.js';

const makeStorage = () => {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
        values,
    };
};

test('local game snapshot round-trips a native offline run', () => {
    const storage = makeStorage();
    const snapshot = {
        player: { name: '루비아', level: 1, loc: '고요한 숲' },
        gameState: 'idle',
        enemy: null,
        version: 5,
    };

    assert.equal(writeLocalGameSnapshot(snapshot, storage), true);
    assert.deepEqual(readLocalGameSnapshot(storage), snapshot);
    assert.ok(storage.values.has(LOCAL_GAME_SNAPSHOT_KEY));
});

test('local game snapshot ignores corrupt or incomplete payloads', () => {
    const storage = makeStorage();
    storage.setItem(LOCAL_GAME_SNAPSHOT_KEY, '{broken');
    assert.equal(readLocalGameSnapshot(storage), null);

    storage.setItem(LOCAL_GAME_SNAPSHOT_KEY, JSON.stringify({ gameState: 'idle' }));
    assert.equal(readLocalGameSnapshot(storage), null);
    assert.equal(writeLocalGameSnapshot({ gameState: 'idle' }, storage), false);
});

test('local game snapshot can be cleared explicitly', () => {
    const storage = makeStorage();
    writeLocalGameSnapshot({ player: { name: '루비아' } }, storage);

    assert.equal(clearLocalGameSnapshot(storage), true);
    assert.equal(readLocalGameSnapshot(storage), null);
});

test('firebase sync restores local data only on offline fallback and mirrors named runs', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');

    assert.match(source, /fallbackAuthOffline[\s\S]+?getOfflineBootstrapData\(\)/);
    assert.match(source, /fallbackToOffline[\s\S]+?getOfflineBootstrapData\(\)/);
    assert.match(source, /previousLocalPlayerNameRef/);
    assert.match(source, /if \(previousPlayerName\) clearLocalGameSnapshot\(\)/);
    assert.match(source, /writeLocalGameSnapshot\(\{/);
    assert.match(source, /version: CONSTANTS\.DATA_VERSION/);
});

test('firebase sync promotes a local run only when the cloud document is absent', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');

    assert.match(source, /if \(docSnap\.exists\(\)\)[\s\S]+?migrateData\(remoteData\)/);
    assert.match(source, /else \{\s*const localData = getOfflineBootstrapData\(\)/);
    assert.match(source, /if \(localData\.player\?\.name\)[\s\S]+?payload: 'syncing'/);
});
