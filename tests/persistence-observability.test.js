import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { resolveOfflineBootstrapResult } from '../src/platform/persistenceTelemetry.ts';
import { MSG } from '../src/data/messages.ts';

test('offline timeout/error fallback unwraps the restored payload and preserves its outcome', () => {
    const data = { player: { name: 'restored-local-player' } };
    assert.deepEqual(resolveOfflineBootstrapResult({ data, outcome: 'local' }), {
        data,
        outcome: 'local',
    });
});

test('a restored named run replaces the indefinite empty-log placeholder with one stable entry', () => {
    const restored = gameReducer(INITIAL_STATE, {
        type: AT.LOAD_DATA,
        payload: {
            player: { ...INITIAL_STATE.player, name: '이리엘', gold: 518 },
            gameState: 'idle',
        },
    });

    assert.deepEqual(restored.logs, [{
        id: 'bootstrap-restore',
        type: 'system',
        text: MSG.SYNC_SAVE_RESTORED,
    }]);

    const existingLog = { id: 'existing', type: 'success', text: '기존 기록' };
    const retained = gameReducer({ ...INITIAL_STATE, logs: [existingLog] }, {
        type: AT.LOAD_DATA,
        payload: { player: { ...INITIAL_STATE.player, name: '이리엘' } },
    });
    assert.deepEqual(retained.logs, [existingLog]);

    const fresh = gameReducer(INITIAL_STATE, {
        type: AT.LOAD_DATA,
        payload: { player: INITIAL_STATE.player },
    });
    assert.deepEqual(fresh.logs, []);
});

test('both Firebase offline fallback paths dispatch data and emit the restore outcome', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');
    const offlineDispatches = source.match(/LOAD_DATA, payload: offlineResult\.data/g) || [];
    const offlineTracking = source.match(/offlineResult\.data\.player,[\s\S]{0,100}'restore',[\s\S]{0,100}offlineResult\.outcome/g) || [];
    assert.equal(offlineDispatches.length, 2);
    assert.equal(offlineTracking.length, 2);
    assert.doesNotMatch(source, /LOAD_DATA, payload: offlineData\b/);
});
