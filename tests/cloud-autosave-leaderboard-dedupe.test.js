// 소유자 결정 D35(2026-10-26, 감사 CH-04): 클라우드 자동 저장은 행동마다 돌고 순위표 쓰기의 73%가 같은 값이었다.
// 순위표에 쓰는 값이 이 세션에서 마지막으로 쓴 값과 같으면 순위표 쓰기만 건너뛴다 — 세이브 문서 쓰기는 그대로(교체 쓰기),
// 순위표의 merge 방식도 그대로다. 쓰기가 실패하면 다음 저장이 다시 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudAutosave } from '../src/hooks/createCloudAutosave.ts';
import { makePlayerFixture } from './helpers/render.ts';

const USERS = 'users/uid-1';
const LEADERBOARD = 'public/data/leaderboard/uid-1';

const makeHarness = ({ withRef = true } = {}) => {
    const calls = [];
    const failures = new Set();
    const record = { saveVersion: 1, revision: 3, savedAt: 1_000, payload: {} };
    const lastLeaderboardEntryKey = { current: null };
    const flush = createCloudAutosave({
        db: { fake: 'db' },
        doc: (_db, ...segments) => ({ path: segments.slice(2).join('/') }),
        setDoc: async (ref, data, options) => {
            if (failures.has(ref.path)) {
                failures.delete(ref.path);
                throw new Error(`${ref.path} 쓰기 실패`);
            }
            calls.push({ path: ref.path, data, options });
        },
        serverTimestamp: () => '<ts>',
        loadLocalRecord: async () => record,
        dispatch: () => {},
        refs: {
            localSavePromise: { current: Promise.resolve(record) },
            pendingCloudRecord: { current: null },
            cloudRevisionFloor: { current: 0 },
            cloudRevisionAdvanceRequired: { current: false },
            ...(withRef ? { lastLeaderboardEntryKey } : {}),
        },
        now: () => 1_000,
    });
    const save = (player) => flush({
        uid: 'uid-1', player, gameState: 'idle', enemy: null, grave: null, currentEvent: null, quickSlots: [null, null, null],
    });
    const count = (path) => calls.filter((call) => call.path === path).length;
    return { save, calls, count, failNext: (path) => failures.add(path), lastLeaderboardEntryKey };
};

const hero = (overrides = {}) => makePlayerFixture({
    name: '테스트용사', level: 12, job: '전사', ...overrides,
    stats: { ...makePlayerFixture().stats, kills: 42, bossKills: 1, ...(overrides.stats || {}) },
});

test('순위표 값이 같으면 순위표 쓰기를 건너뛰고 세이브 문서는 그대로 쓴다', async () => {
    const h = makeHarness();
    assert.equal(await h.save(hero()), 'synced');
    assert.equal(await h.save(hero({ gold: 999, hp: 10 })), 'synced');
    assert.equal(h.count(USERS), 2, '세이브 문서는 저장마다 쓴다');
    assert.equal(h.count(LEADERBOARD), 1, '같은 순위표 값은 한 번만 쓴다');
});

test('순위표 값이 바뀌면 다시 쓰고, 페이로드 모양 · merge 방식은 그대로다', async () => {
    const h = makeHarness();
    await h.save(hero());
    await h.save(hero({ stats: { kills: 43 } }));
    await h.save(hero({ stats: { kills: 43 }, level: 13 }));
    assert.equal(h.count(LEADERBOARD), 3);
    const last = h.calls.filter((call) => call.path === LEADERBOARD).at(-1);
    assert.deepEqual(Object.keys(last.data),
        ['nickname', 'totalKills', 'prestigeRank', 'activeTitle', 'level', 'bossKills', 'job', 'uid', 'updatedAt']);
    assert.deepEqual(last.data, {
        nickname: '테스트용사', totalKills: 43, prestigeRank: 0, activeTitle: null, level: 13, bossKills: 1, job: '전사',
        uid: 'uid-1', updatedAt: '<ts>',
    });
    assert.deepEqual(last.options, { merge: true });
    assert.equal(h.calls.find((call) => call.path === USERS).options, undefined, '세이브 문서는 교체 쓰기다');
});

test('순위표 쓰기가 실패하면 다음 저장이 같은 값을 다시 쓴다', async () => {
    const h = makeHarness();
    h.failNext(LEADERBOARD);
    assert.equal(await h.save(hero()), 'offline');
    assert.equal(h.count(LEADERBOARD), 0);
    assert.equal(h.lastLeaderboardEntryKey.current, null, '실패한 값은 기억하지 않는다');
    assert.equal(await h.save(hero()), 'synced');
    assert.equal(h.count(LEADERBOARD), 1, '실패 뒤에는 같은 값도 다시 쓴다');
    assert.equal(await h.save(hero()), 'synced');
    assert.equal(h.count(LEADERBOARD), 1);
});

test('세이브 문서 쓰기가 실패하면 순위표는 쓰지 않고, 다음 저장이 쓴다', async () => {
    const h = makeHarness();
    h.failNext(USERS);
    assert.equal(await h.save(hero()), 'offline');
    assert.equal(h.count(LEADERBOARD), 0);
    await h.save(hero());
    assert.equal(h.count(LEADERBOARD), 1);
});

test('처치가 없거나 이름이 없으면 순위표를 쓰지 않는다(기존 조건 그대로)', async () => {
    const h = makeHarness();
    await h.save(hero({ stats: { kills: 0 } }));
    await h.save(hero({ name: '' }));
    assert.equal(h.count(LEADERBOARD), 0);
    assert.equal(h.count(USERS), 2);
});

test('세션 기록 칸이 없는 호출자는 이전처럼 저장마다 순위표를 쓴다', async () => {
    const h = makeHarness({ withRef: false });
    await h.save(hero());
    await h.save(hero());
    assert.equal(h.count(LEADERBOARD), 2);
});
