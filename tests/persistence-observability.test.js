import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolveOfflineBootstrapResult } from '../src/platform/persistenceTelemetry.ts';

test('offline timeout/error fallback unwraps the restored payload and preserves its outcome', () => {
    const data = { player: { name: 'restored-local-player' } };
    assert.deepEqual(resolveOfflineBootstrapResult({ data, outcome: 'local' }), {
        data,
        outcome: 'local',
    });
});

test('both Firebase offline fallback paths dispatch data and emit the restore outcome', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');
    const offlineDispatches = source.match(/LOAD_DATA, payload: offlineResult\.data/g) || [];
    const offlineTracking = source.match(/offlineResult\.data\.player,[\s\S]{0,100}'restore',[\s\S]{0,100}offlineResult\.outcome/g) || [];
    assert.equal(offlineDispatches.length, 2);
    assert.equal(offlineTracking.length, 2);
    assert.doesNotMatch(source, /LOAD_DATA, payload: offlineData\b/);
});
