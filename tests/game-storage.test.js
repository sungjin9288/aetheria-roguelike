import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GAME_SAVE_PRIMARY_KEY,
    GAME_SAVE_STAGED_KEY,
    LEGACY_GAME_SNAPSHOT_KEY,
    createGameStorage,
    createBrowserStorageBackend,
    createRuntimeGameStorage,
    resolveCloudBootstrapAuthority,
    resolveSaveAuthority,
} from '../src/platform/gameStorage.ts';
import { importCloudRecordAuthority } from '../src/platform/cloudSaveAuthority.ts';

const makeAsyncStorage = (initial = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        values,
        async getItem(key) { return values.get(key) ?? null; },
        async setItem(key, value) { values.set(key, value); },
        async removeItem(key) { values.delete(key); },
    };
};

const makeSnapshot = (name, savedAt = 100) => ({
    player: { name },
    gameState: 'idle',
    version: 'test',
    savedAt,
});

test('GameStorage stages a checksummed snapshot and advances a monotonic revision', async () => {
    const backend = makeAsyncStorage();
    const storage = createGameStorage({ backend, now: () => 1_000 });

    const first = await storage.save(makeSnapshot('첫 저장'));
    const second = await storage.save(makeSnapshot('두 번째 저장'));

    assert.equal(first.revision, 1);
    assert.equal(second.revision, 2);
    assert.equal((await storage.load())?.payload.player.name, '두 번째 저장');
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), false);

    const envelope = JSON.parse(backend.values.get(GAME_SAVE_PRIMARY_KEY));
    assert.equal(envelope.formatVersion, 1);
    assert.match(envelope.checksum, /^[a-f0-9]{64}$/);
    assert.equal(envelope.revision, 2);
});

test('GameStorage recovers the newest valid staged write when primary is corrupt', async () => {
    const backend = makeAsyncStorage();
    const storage = createGameStorage({ backend, now: () => 2_000 });
    await storage.save(makeSnapshot('정상'));

    const staged = await storage.save(makeSnapshot('복구 대상'));
    backend.values.set(GAME_SAVE_STAGED_KEY, backend.values.get(GAME_SAVE_PRIMARY_KEY));
    backend.values.set(GAME_SAVE_PRIMARY_KEY, '{corrupt');

    const recovered = await storage.load();
    assert.equal(recovered?.revision, staged.revision);
    assert.equal(recovered?.payload.player.name, '복구 대상');
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), false);
    assert.doesNotThrow(() => JSON.parse(backend.values.get(GAME_SAVE_PRIMARY_KEY)));
});

test('GameStorage preserves a verified staged receipt when primary publication fails', async () => {
    const backend = makeAsyncStorage();
    let failPrimary = true;
    const guardedBackend = {
        ...backend,
        async setItem(key, value) {
            if (key === GAME_SAVE_PRIMARY_KEY && failPrimary) throw new Error('forced primary failure');
            backend.values.set(key, value);
        },
    };
    const storage = createGameStorage({ backend: guardedBackend, now: () => 3_000 });

    await assert.rejects(() => storage.save(makeSnapshot('staged')), /forced primary failure/);
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), true);
    assert.equal(backend.values.has(GAME_SAVE_PRIMARY_KEY), false);

    failPrimary = false;
    assert.equal((await storage.load())?.payload.player.name, 'staged');
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), false);
});

test('GameStorage keeps staged recovery when primary silently retains different valid bytes', async () => {
    const backend = makeAsyncStorage();
    const storage = createGameStorage({ backend, now: () => 3_100 });
    await storage.save(makeSnapshot('old'));
    const oldPrimary = backend.values.get(GAME_SAVE_PRIMARY_KEY);

    let retainOldPrimary = true;
    const guardedBackend = {
        ...backend,
        async setItem(key, value) {
            if (key === GAME_SAVE_PRIMARY_KEY && retainOldPrimary) {
                backend.values.set(key, oldPrimary);
                return;
            }
            backend.values.set(key, value);
        },
    };
    const guardedStorage = createGameStorage({ backend: guardedBackend, now: () => 3_200 });

    await assert.rejects(() => guardedStorage.save(makeSnapshot('new')), /publication verification failed/);
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), true);
    assert.equal((await guardedStorage.load())?.payload.player.name, 'new');
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), true);

    retainOldPrimary = false;
    assert.equal((await guardedStorage.load())?.payload.player.name, 'new');
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), false);
});

test('GameStorage rejects a different staged envelope even when its revision matches', async () => {
    const backend = makeAsyncStorage();
    const seedStorage = createGameStorage({ backend, now: () => 3_300 });
    await seedStorage.save(makeSnapshot('different'));
    const differentSameRevision = backend.values.get(GAME_SAVE_PRIMARY_KEY);
    await seedStorage.remove();

    const substitutingBackend = {
        ...backend,
        async setItem(key, value) {
            backend.values.set(key, key === GAME_SAVE_STAGED_KEY ? differentSameRevision : value);
        },
    };
    const storage = createGameStorage({ backend: substitutingBackend, now: () => 3_300 });
    await assert.rejects(() => storage.save(makeSnapshot('requested')), /Staged game snapshot verification failed/);
    assert.equal(backend.values.has(GAME_SAVE_PRIMARY_KEY), false);
});

test('GameStorage preserves a valid staged import when primary metadata is equal but bytes differ', async () => {
    const backend = makeAsyncStorage();
    const storage = createGameStorage({ backend, now: () => 8_000 });
    await storage.importRecord({
        saveVersion: 1,
        revision: 8,
        savedAt: 8_000,
        payload: makeSnapshot('local'),
    });
    const localPrimary = backend.values.get(GAME_SAVE_PRIMARY_KEY);
    let retainLocalPrimary = true;
    const guardedBackend = {
        ...backend,
        async setItem(key, value) {
            backend.values.set(
                key,
                key === GAME_SAVE_PRIMARY_KEY && retainLocalPrimary ? localPrimary : value,
            );
        },
    };
    const guardedStorage = createGameStorage({ backend: guardedBackend, now: () => 8_000 });

    await assert.rejects(() => guardedStorage.importRecord({
        saveVersion: 1,
        revision: 8,
        savedAt: 8_000,
        payload: makeSnapshot('remote'),
    }), /publication verification failed/);
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), true);
    assert.equal((await guardedStorage.load())?.payload.player.name, 'remote');
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), true);

    retainLocalPrimary = false;
    assert.equal((await guardedStorage.load())?.payload.player.name, 'remote');
    assert.equal(backend.values.has(GAME_SAVE_STAGED_KEY), false);
});

test('GameStorage serializes remove after an in-flight save so reset cannot resurrect a run', async () => {
    const backend = makeAsyncStorage();
    let releaseStagedWrite;
    const stagedWriteBlocked = new Promise((resolve) => { releaseStagedWrite = resolve; });
    const blockingBackend = {
        ...backend,
        async setItem(key, value) {
            if (key === GAME_SAVE_STAGED_KEY) await stagedWriteBlocked;
            backend.values.set(key, value);
        },
    };
    const storage = createGameStorage({ backend: blockingBackend, now: () => 3_400 });
    const savePromise = storage.save(makeSnapshot('must-be-cleared'));
    await Promise.resolve();
    const removePromise = storage.remove();

    releaseStagedWrite();
    await Promise.all([savePromise, removePromise]);
    assert.equal(await storage.load(), null);
});

test('GameStorage migrates the legacy local snapshot only after a verified v2 commit', async () => {
    const legacy = makeSnapshot('legacy', 55);
    const backend = makeAsyncStorage({ [LEGACY_GAME_SNAPSHOT_KEY]: JSON.stringify(legacy) });
    const storage = createGameStorage({ backend, now: () => 4_000 });

    const migrated = await storage.migrate((payload) => ({ ...payload, migrated: true }));
    assert.equal(migrated?.revision, 1);
    assert.equal(migrated?.payload.migrated, true);
    assert.equal(backend.values.has(LEGACY_GAME_SNAPSHOT_KEY), false);
    assert.equal((await storage.load())?.payload.player.name, 'legacy');
});

test('save authority compares schema version and monotonic revision before timestamps', () => {
    const local = { saveVersion: 3, revision: 7, savedAt: 100 };
    assert.equal(resolveSaveAuthority(local, { saveVersion: 2, revision: 99, savedAt: 999 }), 'local');
    assert.equal(resolveSaveAuthority(local, { saveVersion: 3, revision: 8, savedAt: 1 }), 'remote');
    assert.equal(resolveSaveAuthority(local, { saveVersion: 3, revision: 7, savedAt: 200 }), 'remote');
    assert.equal(resolveSaveAuthority(local, { saveVersion: 3, revision: 7, savedAt: 100 }), 'equal');
});

test('runtime storage isolates Toss SDK use and falls back without blocking the game', async () => {
    const browserBackend = makeAsyncStorage();
    const tossBackend = makeAsyncStorage();
    const tossStorage = createRuntimeGameStorage({
        environment: 'sandbox',
        browserBackend,
        tossBackend,
        now: () => 5_000,
    });
    await tossStorage.save(makeSnapshot('sandbox'));
    assert.ok([...tossBackend.values.keys()].some((key) => key.includes('storage-journal')));
    assert.ok([...browserBackend.values.keys()].some((key) => key.includes('storage-journal')));

    const failingTossBackend = {
        async getItem() { throw new Error('SDK unavailable'); },
        async setItem() { throw new Error('SDK unavailable'); },
        async removeItem() { throw new Error('SDK unavailable'); },
    };
    const fallbackStorage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend,
        tossBackend: failingTossBackend,
        now: () => 6_000,
    });
    await fallbackStorage.save(makeSnapshot('fallback'));
    assert.equal((await fallbackStorage.load())?.payload.player.name, 'fallback');

    const webBackend = makeAsyncStorage();
    const webStorage = createRuntimeGameStorage({
        environment: 'web',
        browserBackend: webBackend,
        tossBackend,
        now: () => 7_000,
    });
    await webStorage.save(makeSnapshot('web'));
    assert.equal(webBackend.values.has(GAME_SAVE_PRIMARY_KEY), true);
});

test('Toss storage reconciles a newer browser fallback after the SDK bridge recovers', async () => {
    const browserBackend = makeAsyncStorage();
    const tossValues = new Map();
    let tossAvailable = true;
    const tossBackend = {
        async getItem(key) {
            if (!tossAvailable) throw new Error('bridge unavailable');
            return tossValues.get(key) ?? null;
        },
        async setItem(key, value) {
            if (!tossAvailable) throw new Error('bridge unavailable');
            tossValues.set(key, value);
        },
        async removeItem(key) {
            if (!tossAvailable) throw new Error('bridge unavailable');
            tossValues.delete(key);
        },
    };
    const storage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend,
        tossBackend,
        now: (() => { let time = 8_000; return () => time++; })(),
        operationTimeoutMs: 10,
    });

    await storage.save(makeSnapshot('old'));
    tossAvailable = false;
    await storage.save(makeSnapshot('new'));
    tossAvailable = true;

    assert.equal((await storage.load())?.payload.player.name, 'new');
    assert.equal(tossValues.get(GAME_SAVE_PRIMARY_KEY), browserBackend.values.get(GAME_SAVE_PRIMARY_KEY));
});

test('Toss storage times out a never-settling bridge and continues with browser storage', async () => {
    const browserBackend = makeAsyncStorage();
    const never = new Promise(() => {});
    let primaryCallCount = 0;
    const hangingTossBackend = {
        getItem: async () => { primaryCallCount += 1; return never; },
        setItem: async () => { primaryCallCount += 1; return never; },
        removeItem: async () => { primaryCallCount += 1; return never; },
    };
    const storage = createRuntimeGameStorage({
        environment: 'sandbox',
        browserBackend,
        tossBackend: hangingTossBackend,
        now: () => 9_000,
        operationTimeoutMs: 5,
    });

    await storage.save(makeSnapshot('timeout fallback'));
    assert.equal((await storage.load())?.payload.player.name, 'timeout fallback');
    assert.ok(primaryCallCount <= 16, `expected one bounded timeout wave, received ${primaryCallCount} SDK calls`);
});

test('Toss fallback keeps a durable reset tombstone against late SDK writes', async () => {
    const browserBackend = makeAsyncStorage();
    const tossValues = new Map();
    const pendingWrites = [];
    const tossBackend = {
        async getItem(key) { return tossValues.get(key) ?? null; },
        async setItem(key, value) {
            await new Promise((resolve) => pendingWrites.push(() => {
                tossValues.set(key, value);
                resolve();
            }));
        },
        async removeItem(key) { tossValues.delete(key); },
    };
    const storage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend,
        tossBackend,
        now: () => 9_100,
        operationTimeoutMs: 5,
    });

    await storage.save(makeSnapshot('late write'));
    await storage.remove();
    for (const release of pendingWrites.splice(0)) release();
    await Promise.resolve();

    assert.equal(await storage.load(), null);
});

test('healthy Toss storage remains usable when browser persistence is unavailable', async () => {
    const tossBackend = makeAsyncStorage();
    const storage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend: createBrowserStorageBackend(null),
        tossBackend,
        now: () => 9_200,
        operationTimeoutMs: 5,
    });

    await storage.save(makeSnapshot('toss only'));
    assert.equal((await storage.load())?.payload.player.name, 'toss only');
    await storage.remove();
    assert.equal(await storage.load(), null);
});

test('Toss-side removal authority prevents resurrection while browser fallback is offline', async () => {
    const tossBackend = makeAsyncStorage();
    const browserValues = new Map();
    let browserAvailable = true;
    const browserBackend = {
        async getItem(key) {
            if (!browserAvailable) throw new Error('browser unavailable');
            return browserValues.get(key) ?? null;
        },
        async setItem(key, value) {
            if (!browserAvailable) throw new Error('browser unavailable');
            browserValues.set(key, value);
        },
        async removeItem(key) {
            if (!browserAvailable) throw new Error('browser unavailable');
            browserValues.delete(key);
        },
    };
    const storage = createRuntimeGameStorage({
        environment: 'sandbox',
        browserBackend,
        tossBackend,
        now: () => 9_300,
        operationTimeoutMs: 5,
    });

    await storage.save(makeSnapshot('must-stay-cleared'));
    const latePrimary = tossBackend.values.get(GAME_SAVE_PRIMARY_KEY);
    await storage.remove();
    tossBackend.values.set(GAME_SAVE_PRIMARY_KEY, latePrimary);
    browserAvailable = false;

    assert.equal(await storage.load(), null);
});

test('Toss publication stores value and authority in one journal record', async () => {
    const tossValues = new Map();
    const browserValues = new Map();
    const tossBackend = {
        async getItem(key) { return tossValues.get(key) ?? null; },
        async setItem() { throw new Error('Toss write failed'); },
        async removeItem(key) { tossValues.delete(key); },
    };
    const browserBackend = {
        async getItem(key) { return browserValues.get(key) ?? null; },
        async setItem(key, value) { browserValues.set(key, value); },
        async removeItem(key) { browserValues.delete(key); },
    };
    const storage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend,
        tossBackend,
        now: () => 9_400,
        operationTimeoutMs: 5,
    });

    await storage.save(makeSnapshot('integral commit'));
    assert.equal((await storage.load())?.payload.player.name, 'integral commit');
    const journal = [...browserValues.entries()]
        .filter(([key]) => key.includes('storage-journal'))
        .map(([, value]) => JSON.parse(value));
    assert.ok(journal.some((entry) => entry.state === 'present' && typeof entry.value === 'string'));
});

test('deferred journal repair restores the newest generation after a late slot collision', async () => {
    const tossValues = new Map();
    const browserValues = new Map();
    let browserAvailable = true;
    let releaseFirstWrite;
    let delayed = false;
    const tossBackend = {
        async getItem(key) { return tossValues.get(key) ?? null; },
        async setItem(key, value) {
            if (!delayed && key.includes('storage-journal')) {
                delayed = true;
                await new Promise((resolve) => { releaseFirstWrite = () => {
                    tossValues.set(key, value);
                    resolve();
                }; });
                return;
            }
            tossValues.set(key, value);
        },
        async removeItem(key) { tossValues.delete(key); },
    };
    const browserBackend = {
        async getItem(key) {
            if (!browserAvailable) throw new Error('browser unavailable');
            return browserValues.get(key) ?? null;
        },
        async setItem(key, value) {
            if (!browserAvailable) throw new Error('browser unavailable');
            browserValues.set(key, value);
        },
        async removeItem(key) {
            if (!browserAvailable) throw new Error('browser unavailable');
            browserValues.delete(key);
        },
    };
    const storage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend,
        tossBackend,
        now: (() => { let value = 10_000; return () => value++; })(),
        operationTimeoutMs: 5,
    });

    await storage.save(makeSnapshot('old'));
    for (let index = 1; index <= 8; index += 1) {
        await storage.save(makeSnapshot(`new-${index}`));
    }
    releaseFirstWrite();
    await new Promise((resolve) => setImmediate(resolve));
    browserAvailable = false;
    const restartedStorage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend,
        tossBackend,
        now: () => 20_000,
        operationTimeoutMs: 5,
    });

    assert.equal((await restartedStorage.load())?.payload.player.name, 'new-8');
});

test('late-success Toss repairs settle once without an autonomous retry loop', async () => {
    const browserBackend = makeAsyncStorage();
    const tossValues = new Map();
    let setItemCalls = 0;
    const tossBackend = {
        async getItem(key) { return tossValues.get(key) ?? null; },
        async setItem(key, value) {
            setItemCalls += 1;
            await new Promise((resolve) => setTimeout(resolve, 20));
            tossValues.set(key, value);
        },
        async removeItem(key) { tossValues.delete(key); },
    };
    const storage = createRuntimeGameStorage({
        environment: 'toss',
        browserBackend,
        tossBackend,
        now: () => 30_000,
        operationTimeoutMs: 5,
    });

    await storage.importRecord({
        saveVersion: 1,
        revision: 8,
        savedAt: 8_000,
        payload: makeSnapshot('remote'),
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const settledCallCount = setItemCalls;
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(setItemCalls, settledCallCount);
    assert.ok(settledCallCount > 0);
});

test('importRecord preserves remote revision authority before the next local save', async () => {
    const backend = makeAsyncStorage();
    const storage = createGameStorage({ backend, now: () => 10_000 });
    const imported = await storage.importRecord({
        saveVersion: 1,
        revision: 8,
        savedAt: 8_000,
        payload: makeSnapshot('remote'),
    });
    const next = await storage.save(makeSnapshot('next local'));

    assert.equal(imported.revision, 8);
    assert.equal(next.revision, 9);
    assert.equal((await storage.load())?.payload.player.name, 'next local');
});

test('overlapping cloud imports keep the highest returned authority payload', async () => {
    const backend = makeAsyncStorage();
    const storage = createGameStorage({ backend, now: () => 11_000 });
    const remoteEight = {
        saveVersion: 1,
        revision: 8,
        savedAt: 8_000,
        payload: makeSnapshot('remote-8'),
    };
    const remoteOne = {
        saveVersion: 1,
        revision: 1,
        savedAt: 1_000,
        payload: makeSnapshot('remote-1'),
    };

    const [, latestCallback] = await Promise.all([
        importCloudRecordAuthority(storage, remoteEight),
        importCloudRecordAuthority(storage, remoteOne),
    ]);

    assert.equal(latestCallback.localImportFailed, false);
    assert.equal(latestCallback.record.revision, 8);
    assert.equal(latestCallback.record.payload.player.name, 'remote-8');
});

test('browser storage backend remains load-safe when persistent storage is unavailable', async () => {
    const backend = createBrowserStorageBackend(null);
    assert.equal(await backend.getItem('missing'), null);
    await assert.rejects(() => backend.setItem('key', 'value'), /unavailable/);
    await assert.doesNotReject(() => backend.removeItem('key'));
});

test('cloud bootstrap uses schema and revision while preserving legacy remote authority', () => {
    const local = {
        saveVersion: 1,
        revision: 8,
        savedAt: 800,
        payload: makeSnapshot('local'),
    };
    assert.equal(resolveCloudBootstrapAuthority(local, makeSnapshot('legacy remote')), 'remote');
    assert.equal(resolveCloudBootstrapAuthority(local, {
        ...makeSnapshot('older remote'),
        saveSchemaVersion: 1,
        saveRevision: 7,
        savedAt: 9_999,
    }), 'local');
    assert.equal(resolveCloudBootstrapAuthority(local, {
        ...makeSnapshot('newer remote'),
        saveSchemaVersion: 1,
        saveRevision: 9,
        savedAt: 1,
    }), 'remote');
    assert.equal(resolveCloudBootstrapAuthority(null, null), 'none');
});
