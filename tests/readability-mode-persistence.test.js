import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { migrateData } from '../src/utils/gameUtils.ts';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('initial player state persists standard readability mode by default', () => {
    assert.equal(INITIAL_STATE.player.settings?.readabilityMode, 'standard');
    assert.equal(INITIAL_STATE.player.settings?.equipmentDetailMode, 'auto');
});

test('legacy saves receive a standard readability mode during migration', () => {
    const legacySave = clone(INITIAL_STATE);
    delete legacySave.player.settings;

    const migrated = migrateData(legacySave);

    assert.equal(migrated.player.settings.readabilityMode, 'standard');
    assert.equal(migrated.player.settings.equipmentDetailMode, 'auto');
});

test('equipment detail mode is sanitized and preserves explicit choices during migration', () => {
    const invalidSave = clone(INITIAL_STATE);
    invalidSave.player.settings = { equipmentDetailMode: 'everything' };
    assert.equal(migrateData(invalidSave).player.settings.equipmentDetailMode, 'auto');

    for (const mode of ['summary', 'full']) {
        const save = clone(INITIAL_STATE);
        save.player.settings.equipmentDetailMode = mode;
        assert.equal(migrateData(save).player.settings.equipmentDetailMode, mode);
    }
});

test('invalid readability mode values are sanitized during migration', () => {
    const save = clone(INITIAL_STATE);
    save.player.settings = { readabilityMode: 'glow-heavy' };

    const migrated = migrateData(save);

    assert.equal(migrated.player.settings.readabilityMode, 'standard');
});

test('high readability mode is preserved during migration', () => {
    const save = clone(INITIAL_STATE);
    save.player.settings = { readabilityMode: 'high' };

    const migrated = migrateData(save);

    assert.equal(migrated.player.settings.readabilityMode, 'high');
});

test('readability mode update keeps existing settings fields', () => {
    const state = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            settings: {
                readabilityMode: 'standard',
                retainedFlag: true,
            },
        },
    };

    const nextState = gameReducer(state, {
        type: AT.SET_PLAYER,
        payload: (player) => ({
            settings: {
                ...(player.settings || {}),
                readabilityMode: 'high',
            },
        }),
    });

    assert.equal(nextState.player.settings.readabilityMode, 'high');
    assert.equal(nextState.player.settings.retainedFlag, true);
    assert.equal(nextState.syncStatus, 'syncing');
});
