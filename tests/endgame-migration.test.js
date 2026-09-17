import assert from 'node:assert/strict';
import test from 'node:test';

import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { migrateData } from '../src/utils/dataMigration.js';

const shard = (id) => ({
    id,
    name: '원시의 파편',
    type: 'key',
    tier: 5,
    price: 0,
});

const legacyMeta = Object.fromEntries(
    Object.entries(INITIAL_STATE.player.meta).filter(([key]) => key !== 'endgame'),
);

const migratePlayer = (overrides = {}) => migrateData({
    version: 5,
    player: {
        ...structuredClone(INITIAL_STATE.player),
        ...overrides,
    },
}).player;

test('legacy inventory primal shards migrate once into permanent endgame progress', () => {
    const migrated = migratePlayer({
        meta: { ...legacyMeta },
        inv: [
            { id: 'keep-a', name: '보존 A', type: 'mat' },
            shard('legacy-1'),
            { id: 'keep-b', name: '보존 B', type: 'mat' },
            shard('legacy-2'),
            shard('legacy-3'),
        ],
    });

    assert.deepEqual(migrated.meta.endgame, {
        version: 1,
        primalShards: 3,
        legacyInventoryMigrated: true,
        lastEndgameReceiptKey: null,
        trueEndingSeen: false,
    });
    assert.deepEqual(
        migrated.inv.map((item) => item.id),
        ['keep-a', 'keep-b'],
    );

    const replayed = migrateData({ version: 5, player: migrated }).player;
    assert.deepEqual(replayed.meta.endgame, migrated.meta.endgame);
    assert.deepEqual(replayed.inv, migrated.inv);
});

test('endgame migration clamps malformed values and ignores post-migration legacy items', () => {
    const migrated = migratePlayer({
        meta: {
            ...INITIAL_STATE.player.meta,
            endgame: {
                version: 99,
                primalShards: Number.POSITIVE_INFINITY,
                legacyInventoryMigrated: true,
                lastEndgameReceiptKey: '../unsafe',
                trueEndingSeen: 'yes',
            },
        },
        inv: [shard('late-corrupt-shard')],
    });

    assert.deepEqual(migrated.meta.endgame, {
        version: 1,
        primalShards: 0,
        legacyInventoryMigrated: true,
        lastEndgameReceiptKey: null,
        trueEndingSeen: false,
    });
    assert.equal(
        migrated.inv.some((item) => item.name === '원시의 파편'),
        false,
    );
});

test('new and shard-free legacy saves receive the canonical empty endgame ledger', () => {
    const migrated = migratePlayer({
        meta: { ...legacyMeta },
    });

    assert.deepEqual(migrated.meta.endgame, {
        version: 1,
        primalShards: 0,
        legacyInventoryMigrated: true,
        lastEndgameReceiptKey: null,
        trueEndingSeen: false,
    });
});
