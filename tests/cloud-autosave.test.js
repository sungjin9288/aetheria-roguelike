import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createCloudAutosave } from '../src/hooks/createCloudAutosave.ts';
import { CONSTANTS, APP_ID } from '../src/data/constants.ts';
import { AT } from '../src/reducers/actionTypes.ts';

/**
 * useFirebaseSync 의 클라우드 자동저장 경로는 그동안 실행 테스트가 0건이었다
 * (4개 테스트가 소스 텍스트만 정규식으로 확인). 본문을 createCloudAutosave 로
 * 분리하면서 Firestore 의존성(doc/setDoc/addDoc/serverTimestamp)과 로컬 저장소
 * 로드를 전부 주입받게 했으므로, 여기서는 가짜 구현으로 실제 동작을 검증한다.
 *
 * 디바운스(BALANCE.DEBOUNCE_SAVE_MS)는 훅의 setTimeout 이 담당하므로 대기 없이
 * flush 함수를 직접 호출한다.
 */

const SERVER_TIMESTAMP = '<server-timestamp>';
const NOW = 1_700_000_000_000;

const makeHarness = ({
    localRecord = { saveVersion: 1, revision: 7, savedAt: 1_000, payload: {} },
    localSavePromiseValue = null,
    pendingCloudRecord = null,
    cloudRevisionFloor = 0,
    cloudRevisionAdvanceRequired = false,
    setDocImpl = null,
} = {}) => {
    const dispatched = [];
    const setDocCalls = [];
    const addDocCalls = [];
    let loadLocalRecordCalls = 0;

    const refs = {
        localSavePromise: { current: Promise.resolve(localSavePromiseValue) },
        pendingCloudRecord: { current: pendingCloudRecord },
        cloudRevisionFloor: { current: cloudRevisionFloor },
        cloudRevisionAdvanceRequired: { current: cloudRevisionAdvanceRequired },
    };

    const flush = createCloudAutosave({
        db: { fake: 'db' },
        doc: (dbArg, ...segments) => ({ db: dbArg, path: segments.join('/') }),
        collection: (ref, name) => ({ path: `${ref.path}/${name}` }),
        setDoc: async (ref, data, options) => {
            setDocCalls.push({ path: ref.path, data, options });
            if (setDocImpl) await setDocImpl(ref, data, options);
        },
        addDoc: async (ref, data) => {
            addDocCalls.push({ path: ref.path, data });
        },
        serverTimestamp: () => SERVER_TIMESTAMP,
        loadLocalRecord: async () => {
            loadLocalRecordCalls += 1;
            return localRecord;
        },
        dispatch: (action) => dispatched.push(action),
        refs,
        now: () => NOW,
    });

    return {
        flush,
        dispatched,
        setDocCalls,
        addDocCalls,
        refs,
        get loadLocalRecordCalls() { return loadLocalRecordCalls; },
    };
};

const makeSnapshot = (playerOverrides = {}) => ({
    uid: 'uid-1',
    player: {
        name: '아에테리아',
        level: 12,
        job: 'mage',
        stats: { kills: 0, bossKills: 0 },
        meta: { prestigeRank: 0 },
        ...playerOverrides,
    },
    gameState: 'idle',
    enemy: null,
    grave: null,
    currentEvent: null,
    quickSlots: [],
});

/** console.error 를 삼켜서 실패 경로 테스트가 로그를 오염시키지 않게 한다. */
const withSilencedErrors = async (fn) => {
    const original = console.error;
    const messages = [];
    console.error = (...args) => messages.push(args);
    try {
        return await fn(messages);
    } finally {
        console.error = original;
    }
};

test('자동저장: 로컬 리비전이 클라우드 floor 이상이면 유저 문서를 업로드하고 synced 로 전이한다', async () => {
    const harness = makeHarness({
        localRecord: { saveVersion: 3, revision: 9, savedAt: 4_242, payload: {} },
        cloudRevisionFloor: 9,
    });

    const result = await harness.flush(makeSnapshot());

    assert.equal(result, 'synced');
    assert.equal(harness.setDocCalls.length, 1);

    const [userSave] = harness.setDocCalls;
    assert.equal(userSave.path, `artifacts/${APP_ID}/users/uid-1`);
    assert.deepEqual(userSave.options, { merge: true });
    assert.equal(userSave.data.player.name, '아에테리아');
    assert.equal(userSave.data.player.stats.lastSeenAt, NOW);
    assert.deepEqual(userSave.data.player.archivedHistory, []);
    assert.equal(userSave.data.version, CONSTANTS.DATA_VERSION);
    assert.equal(userSave.data.saveSchemaVersion, 3);
    assert.equal(userSave.data.saveRevision, 9);
    assert.equal(userSave.data.savedAt, 4_242);
    assert.equal(userSave.data.lastActive, SERVER_TIMESTAMP);
    assert.equal(userSave.data.gameState, 'idle');

    assert.deepEqual(harness.dispatched, [
        { type: AT.SET_SYNC_STATUS, payload: 'synced' },
    ]);
});

test('자동저장: in-flight 로컬 save 결과가 있으면 그것을 쓰고 저장소를 다시 읽지 않는다', async () => {
    const harness = makeHarness({
        localSavePromiseValue: { saveVersion: 1, revision: 5, savedAt: 777, payload: {} },
        localRecord: { saveVersion: 1, revision: 1, savedAt: 1, payload: {} },
    });

    assert.equal(await harness.flush(makeSnapshot()), 'synced');
    assert.equal(harness.loadLocalRecordCalls, 0);
    assert.equal(harness.setDocCalls[0].data.saveRevision, 5);
});

test('자동저장: 로컬 리비전이 클라우드 floor 아래면 업로드하지 않고 offline 으로 전이한다', async () => {
    const harness = makeHarness({
        localRecord: { saveVersion: 1, revision: 4, savedAt: 100, payload: {} },
        cloudRevisionFloor: 9,
    });

    const result = await harness.flush(makeSnapshot());

    assert.equal(result, 'offline');
    assert.equal(harness.setDocCalls.length, 0);
    assert.deepEqual(harness.dispatched, [
        { type: AT.SET_SYNC_STATUS, payload: 'offline' },
    ]);
});

test('자동저장: floor 와 동률인 리비전은 전진 요구 플래그가 서 있을 때만 거부된다', async () => {
    const blocked = makeHarness({
        localRecord: { saveVersion: 1, revision: 9, savedAt: 100, payload: {} },
        cloudRevisionFloor: 9,
        cloudRevisionAdvanceRequired: true,
    });
    assert.equal(await blocked.flush(makeSnapshot()), 'offline');
    assert.equal(blocked.setDocCalls.length, 0);

    const allowed = makeHarness({
        localRecord: { saveVersion: 1, revision: 10, savedAt: 100, payload: {} },
        cloudRevisionFloor: 9,
        cloudRevisionAdvanceRequired: true,
    });
    assert.equal(await allowed.flush(makeSnapshot()), 'synced');
    assert.equal(allowed.setDocCalls.length, 1);
});

test('자동저장: 로컬 레코드가 없거나 미반영 원격 레코드가 남아 있으면 업로드를 건너뛴다', async () => {
    const noRecord = makeHarness({ localRecord: null });
    assert.equal(await noRecord.flush(makeSnapshot()), 'offline');
    assert.equal(noRecord.setDocCalls.length, 0);

    const pending = makeHarness({
        pendingCloudRecord: { saveVersion: 1, revision: 20, savedAt: 200, payload: {} },
    });
    assert.equal(await pending.flush(makeSnapshot()), 'offline');
    assert.equal(pending.setDocCalls.length, 0);
});

test('자동저장: setDoc 이 throw 하면 예외를 전파하지 않고 offline 으로 전이한다', async () => {
    await withSilencedErrors(async (messages) => {
        const harness = makeHarness({
            setDocImpl: async () => { throw new Error('permission-denied'); },
        });

        const result = await harness.flush(makeSnapshot());

        assert.equal(result, 'offline');
        assert.deepEqual(harness.dispatched, [
            { type: AT.SET_SYNC_STATUS, payload: 'offline' },
        ]);
        assert.equal(messages.length, 1);
        assert.equal(messages[0][0], 'Save Failed');
    });
});

test('자동저장: 리더보드 entry 는 kills > 0 일 때만 기록된다', async () => {
    const noKills = makeHarness();
    assert.equal(await noKills.flush(makeSnapshot()), 'synced');
    assert.equal(noKills.setDocCalls.length, 1);
    assert.ok(!noKills.setDocCalls.some((call) => call.path.includes('leaderboard')));

    const withKills = makeHarness();
    assert.equal(await withKills.flush(makeSnapshot({
        stats: { kills: 3, bossKills: 1 },
        activeTitle: '심연 답사자',
        meta: { prestigeRank: 2 },
    })), 'synced');
    assert.equal(withKills.setDocCalls.length, 2);

    const leaderboard = withKills.setDocCalls[1];
    assert.equal(leaderboard.path, `artifacts/${APP_ID}/public/data/leaderboard/uid-1`);
    assert.deepEqual(leaderboard.options, { merge: true });
    assert.deepEqual(leaderboard.data, {
        nickname: '아에테리아',
        totalKills: 3,
        prestigeRank: 2,
        activeTitle: '심연 답사자',
        level: 12,
        bossKills: 1,
        job: 'mage',
        uid: 'uid-1',
        updatedAt: SERVER_TIMESTAMP,
    });
});

test('자동저장: archivedHistory 는 history 서브컬렉션으로 옮기고 본문에서는 비운다', async () => {
    const harness = makeHarness();

    await harness.flush(makeSnapshot({ archivedHistory: [{ run: 1 }, { run: 2 }] }));

    assert.equal(harness.addDocCalls.length, 2);
    assert.equal(harness.addDocCalls[0].path, `artifacts/${APP_ID}/users/uid-1/history`);
    assert.deepEqual(harness.addDocCalls.map((call) => call.data), [{ run: 1 }, { run: 2 }]);
    assert.deepEqual(harness.setDocCalls[0].data.player.archivedHistory, []);
});

test('useFirebaseSync 는 syncStatus 가 syncing 일 때만 디바운스 후 분리된 flush 를 호출한다', async () => {
    const source = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');

    assert.match(source, /if \(syncStatus !== 'syncing' \|\| !uid\) return;/);
    assert.match(source, /const flushCloudSave = createCloudAutosave\(\{/);
    assert.match(source, /setTimeout\(\(\) => \{\s*void flushCloudSave\(\{ uid, player, gameState, enemy, grave, currentEvent, quickSlots \}\);\s*\}, BALANCE\.DEBOUNCE_SAVE_MS\);/);
});

test('리더보드/live-config 구독은 useFirebaseSync 가 아니라 전용 훅이 소유한다', async () => {
    const hookSource = await readFile(new URL('../src/hooks/useFirebaseSync.ts', import.meta.url), 'utf8');
    const splitSource = await readFile(new URL('../src/hooks/useLiveConfigAndLeaderboard.ts', import.meta.url), 'utf8');

    assert.match(hookSource, /useLiveConfigAndLeaderboard\(\{ bootStage, dispatch, mockMode \}\)/);
    assert.doesNotMatch(hookSource, /SET_LEADERBOARD|SET_LIVE_CONFIG/);

    assert.match(splitSource, /if \(bootStage !== 'config'\) return;/);
    assert.match(splitSource, /orderBy\('totalKills', 'desc'\)/);
    assert.match(splitSource, /AT\.SET_LIVE_CONFIG/);
    assert.match(splitSource, /AT\.SET_LEADERBOARD/);
    assert.match(splitSource, /AT\.SET_BOOT_STAGE, payload: 'data'/);
});
