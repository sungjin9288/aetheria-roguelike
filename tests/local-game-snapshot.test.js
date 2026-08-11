import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    ASCENSION_JOURNEY_DEVICE_QA_SNAPSHOT_KEY,
    DEVICE_QA_SNAPSHOT_KEY,
    GRAVE_RECOVERY_DEVICE_QA_SNAPSHOT_KEY,
    LOCAL_GAME_SNAPSHOT_KEY,
    MIRROR_JOURNEY_DEVICE_QA_SNAPSHOT_KEY,
    CRYSTAL_EXCHANGE_DEVICE_QA_SNAPSHOT_KEY,
    SYSTEM_SETTINGS_DEVICE_QA_SNAPSHOT_KEY,
    PROGRESSION_ACCEPTANCE_DEVICE_QA_SNAPSHOT_KEY,
    TRUE_ENDING_JOURNEY_DEVICE_QA_SNAPSHOT_KEY,
    clearDeviceQaSnapshot,
    clearLocalGameSnapshot,
    readDeviceQaSnapshot,
    readLocalGameSnapshot,
    writeDeviceQaSnapshot,
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

test('device QA snapshot is isolated from the production offline save', () => {
    const storage = makeStorage();
    const production = { player: { name: '루비아' }, gameState: 'idle' };
    const deviceQa = { player: { name: '정비 검증' }, gameState: 'crafting' };

    assert.equal(writeLocalGameSnapshot(production, storage), true);
    assert.equal(writeDeviceQaSnapshot(deviceQa, storage), true);
    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.deepEqual(readDeviceQaSnapshot(storage), deviceQa);
    assert.ok(storage.values.has(LOCAL_GAME_SNAPSHOT_KEY));
    assert.ok(storage.values.has(DEVICE_QA_SNAPSHOT_KEY));

    assert.equal(clearDeviceQaSnapshot(storage), true);
    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.equal(readDeviceQaSnapshot(storage), null);
});

test('grave recovery QA keeps a separate snapshot from item investment QA', () => {
    const storage = makeStorage();
    const itemInvestment = { player: { name: '정비 검증' }, gameState: 'crafting' };
    const graveRecovery = { player: { name: '유해 검증' }, gameState: 'idle' };

    assert.equal(writeDeviceQaSnapshot(itemInvestment, storage), true);
    assert.equal(writeDeviceQaSnapshot(graveRecovery, storage, 'grave-recovery'), true);
    assert.deepEqual(readDeviceQaSnapshot(storage), itemInvestment);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'grave-recovery'), graveRecovery);
    assert.ok(storage.values.has(DEVICE_QA_SNAPSHOT_KEY));
    assert.ok(storage.values.has(GRAVE_RECOVERY_DEVICE_QA_SNAPSHOT_KEY));

    assert.equal(clearDeviceQaSnapshot(storage, 'grave-recovery'), true);
    assert.deepEqual(readDeviceQaSnapshot(storage), itemInvestment);
    assert.equal(readDeviceQaSnapshot(storage, 'grave-recovery'), null);
});

test('ascension journey QA keeps a separate snapshot from other device scenarios', () => {
    const storage = makeStorage();
    const itemInvestment = { player: { name: '정비 검증' }, gameState: 'crafting' };
    const graveRecovery = { player: { name: '유해 검증' }, gameState: 'idle' };
    const ascensionJourney = { player: { name: '계승 검증' }, gameState: 'ascension' };

    writeDeviceQaSnapshot(itemInvestment, storage);
    writeDeviceQaSnapshot(graveRecovery, storage, 'grave-recovery');
    writeDeviceQaSnapshot(ascensionJourney, storage, 'ascension-journey');

    assert.deepEqual(readDeviceQaSnapshot(storage), itemInvestment);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'grave-recovery'), graveRecovery);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'ascension-journey'), ascensionJourney);
    assert.ok(storage.values.has(ASCENSION_JOURNEY_DEVICE_QA_SNAPSHOT_KEY));

    clearDeviceQaSnapshot(storage, 'ascension-journey');
    assert.deepEqual(readDeviceQaSnapshot(storage), itemInvestment);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'grave-recovery'), graveRecovery);
    assert.equal(readDeviceQaSnapshot(storage, 'ascension-journey'), null);
});

test('mirror journey QA keeps purchases away from production and other QA saves', () => {
    const storage = makeStorage();
    const production = { player: { name: '루비아' }, gameState: 'idle' };
    const mirrorJourney = {
        player: { name: '거울 검증', meta: { essence: 100, mirror: { start_gold: 2 } } },
        gameState: 'idle',
    };

    writeLocalGameSnapshot(production, storage);
    writeDeviceQaSnapshot(mirrorJourney, storage, 'mirror-journey');

    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'mirror-journey'), mirrorJourney);
    assert.ok(storage.values.has(MIRROR_JOURNEY_DEVICE_QA_SNAPSHOT_KEY));

    clearDeviceQaSnapshot(storage, 'mirror-journey');
    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.equal(readDeviceQaSnapshot(storage, 'mirror-journey'), null);
});

test('crystal exchange QA keeps exchanges away from production and other QA saves', () => {
    const storage = makeStorage();
    const production = { player: { name: '루비아', premiumCurrency: 12 }, gameState: 'idle' };
    const exchange = {
        player: { name: '교환 검증', premiumCurrency: 130, maxInv: 30 },
        gameState: 'idle',
    };

    writeLocalGameSnapshot(production, storage);
    writeDeviceQaSnapshot(exchange, storage, 'crystal-exchange');

    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'crystal-exchange'), exchange);
    assert.ok(storage.values.has(CRYSTAL_EXCHANGE_DEVICE_QA_SNAPSHOT_KEY));

    clearDeviceQaSnapshot(storage, 'crystal-exchange');
    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.equal(readDeviceQaSnapshot(storage, 'crystal-exchange'), null);
});

test('system settings QA keeps visual preferences away from production saves', () => {
    const storage = makeStorage();
    const production = { player: { name: '루비아', settings: { readabilityMode: 'high' } }, gameState: 'idle' };
    const settingsQa = {
        player: { name: '설정 검증', settings: { readabilityMode: 'standard', equipmentDetailMode: 'auto' } },
        gameState: 'idle',
    };

    writeLocalGameSnapshot(production, storage);
    writeDeviceQaSnapshot(settingsQa, storage, 'system-settings');

    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'system-settings'), settingsQa);
    assert.ok(storage.values.has(SYSTEM_SETTINGS_DEVICE_QA_SNAPSHOT_KEY));

    clearDeviceQaSnapshot(storage, 'system-settings');
    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.equal(readDeviceQaSnapshot(storage, 'system-settings'), null);
});

test('progression acceptance QA keeps rewards and growth choices away from production saves', () => {
    const storage = makeStorage();
    const production = { player: { name: '루비아', job: '모험가', gold: 1046 }, gameState: 'idle' };
    const progression = {
        player: {
            name: '성장 검증',
            job: '전사',
            gold: 350,
            skillChoices: { 파워배시: 'A' },
            stats: { codexClaimed: ['weapons_5'], codexBonusAtk: 2 },
        },
        gameState: 'idle',
    };

    writeLocalGameSnapshot(production, storage);
    writeDeviceQaSnapshot(progression, storage, 'progression-acceptance');

    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.deepEqual(readDeviceQaSnapshot(storage, 'progression-acceptance'), progression);
    assert.ok(storage.values.has(PROGRESSION_ACCEPTANCE_DEVICE_QA_SNAPSHOT_KEY));

    clearDeviceQaSnapshot(storage, 'progression-acceptance');
    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.equal(readDeviceQaSnapshot(storage, 'progression-acceptance'), null);
});

test('true ending journey QA persists its combat-to-New Game+ checkpoint in an isolated namespace', () => {
    const storage = makeStorage();
    const production = { player: { name: '루비아', level: 31 }, gameState: 'idle' };
    const trueEndingJourney = {
        player: {
            name: '종언 검증',
            meta: {
                prestigeRank: 3,
                endgame: { version: 1, primalShards: 2, trueEndingSeen: false },
            },
        },
        gameState: 'combat',
        enemy: { name: '마왕', baseName: '마왕', hp: 1 },
    };

    writeLocalGameSnapshot(production, storage);
    writeDeviceQaSnapshot(trueEndingJourney, storage, 'true-ending-journey');

    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.deepEqual(
        readDeviceQaSnapshot(storage, 'true-ending-journey'),
        trueEndingJourney,
    );
    assert.ok(storage.values.has(TRUE_ENDING_JOURNEY_DEVICE_QA_SNAPSHOT_KEY));

    clearDeviceQaSnapshot(storage, 'true-ending-journey');
    assert.deepEqual(readLocalGameSnapshot(storage), production);
    assert.equal(readDeviceQaSnapshot(storage, 'true-ending-journey'), null);
});

test('firebase sync restores local data only on offline fallback and mirrors named runs', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');

    assert.match(source, /fallbackAuthOffline[\s\S]+?await getOfflineBootstrapData\(\)/);
    assert.match(source, /fallbackToOffline[\s\S]+?await getOfflineBootstrapData\(\)/);
    assert.match(source, /previousLocalPlayerNameRef/);
    assert.match(source, /if \(previousPlayerName\) \{[\s\S]+?getRuntimeGameStorage\(\)\.remove\(\)/);
    assert.match(source, /localSavePromiseRef\.current = \(async \(\) =>[\s\S]+?const saved = await storage\.save\(snapshot\)/);
    assert.match(source, /version: CONSTANTS\.DATA_VERSION/);
});

test('firebase sync promotes a local run only when the cloud document is absent', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');

    assert.match(source, /if \(docSnap\.exists\(\)\)[\s\S]+?migrateData\(remoteData\)/);
    assert.match(source, /resolveCloudBootstrapAuthority\(localRecord, remoteData\)[\s\S]+?payload: 'syncing'/);
    assert.match(source, /else \{\s*const localResult = await getOfflineBootstrapData\(\)/);
    assert.match(source, /if \(localResult\.data\.player\?\.name\)[\s\S]+?payload: 'syncing'/);
    assert.match(source, /saveSchemaVersion: localRecord\?\.saveVersion \?\? 1/);
    assert.match(source, /saveRevision: localRecord\?\.revision \?\? 0/);
    assert.match(source, /importCloudRecordAuthority\([\s\S]+?getRuntimeGameStorage\(\)[\s\S]+?remoteRecord/);
    assert.match(source, /const importedRecord = importResult\.record[\s\S]+?activeData = migrateData\(importedRecord\.payload\)/);
    assert.match(source, /localImportFailed[\s\S]+?LOAD_DATA, payload: activeData[\s\S]+?SET_SYNC_STATUS, payload: 'offline'/);
    assert.match(source, /pendingCloudRecordRef/);
    assert.match(source, /cloudRevisionFloorRef/);
    assert.match(source, /cloudRevisionAdvanceRequiredRef/);
    assert.match(source, /localRecord\.revision < cloudRevisionFloorRef\.current/);
    assert.match(source, /localRecord\.revision <= cloudRevisionFloorRef\.current/);
    assert.match(source, /callbackSequence/);
    assert.match(source, /sequence !== callbackSequence/);
});

test('device QA runtime stays offline and persists only to its isolated snapshot', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');

    assert.match(source, /deviceQaMode\s*\? getDeviceQaBootstrapData\(deviceQaScenario\)/);
    assert.match(source, /if \(deviceQaMode\) \{[\s\S]+?writeDeviceQaSnapshot\(snapshot, undefined, deviceQaScenario\)/);
    assert.match(source, /if \(mockMode\) return undefined;[\s\S]+?Auto Save/);
});
