// Wave 14 F3 — `firestore.rules`를 **실행해서** 검증한다.
//
// 이 파일의 규칙 하나: **rules가 아니라 클라이언트 쓰기 지점에서 유도한다.**
//   rules 텍스트를 테스트로 옮겨 적으면 오늘의 rules 위에서는 언제나 초록이다 —
//   의견 보내기를 100% 거부하던 그 rules 위에서도. 그래서 여기 있는 페이로드는 전부
//   실제 쓰기 지점 6곳에서 온다. 세 곳(`createCloudAutosave` ×2, `TokenQuotaManager`)은
//   프로덕션 함수가 Firestore 연산을 주입받으므로 **그 함수를 그대로 실행**해 에뮬레이터에
//   쏘고, 나머지 세 곳(훅/컴포넌트 안에 인라인된 리터럴)은 같은 입력에서 같은 식으로
//   페이로드를 만든다(주석에 원본 파일:줄).
//
//   거부가 **정답인** 지점(admin `public/data`)도 거부로 고정한다 — 그게 의도라는 것을
//   실행으로 남겨야 나중에 "고치고 싶어지는" 유혹을 계획(§18 기각 7)이 막을 수 있다.
//
// 실행: `npm run test:rules` (firebase-tools 에뮬레이터가 이 파일만 돌린다).
//   `npm run test:unit`의 glob(`tests/*.test.js`)에도 잡히므로, 에뮬레이터가 없으면
//   **스킵**한다 — 단 CI의 전용 job은 `AETHERIA_REQUIRE_FIRESTORE_EMULATOR=1`을 세워
//   스킵 자체를 실패로 만든다(가장 흔한 실패 모드가 "조용히 아무것도 안 돌았다"이므로).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from '@firebase/rules-unit-testing';
import {
    doc,
    collection,
    addDoc,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';

import { APP_ID, CONSTANTS } from '../src/data/constants.js';
import { FeedbackValidator } from '../src/systems/FeedbackValidator.ts';
import { TokenQuotaManager } from '../src/systems/TokenQuotaManager.ts';
import { createCloudAutosave } from '../src/hooks/createCloudAutosave.ts';
import { makePlayerFixture } from './helpers/render.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 에뮬레이터 게이트
// ─────────────────────────────────────────────────────────────────────────────

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
const REQUIRE_EMULATOR = process.env.AETHERIA_REQUIRE_FIRESTORE_EMULATOR === '1';

if (!EMULATOR_HOST && REQUIRE_EMULATOR) {
    throw new Error(
        'AETHERIA_REQUIRE_FIRESTORE_EMULATOR=1 인데 FIRESTORE_EMULATOR_HOST가 없다 — '
        + '에뮬레이터 없이 rules semantics를 통과시킬 수 없다. `npm run test:rules`로 실행할 것.',
    );
}

/**
 * 에뮬레이터가 있을 때만 등록한다 — `test.skip`으로 두지 않는 이유는 이 파일이
 * `tests/*.test.js` glob에 잡혀 `npm run test:unit`에서도 열리기 때문이다. 저장소의
 * 유닛 스위트는 **skip 0**이 성질이고(CLAUDE.md §7), 여기 하나 때문에 16건이 skip으로
 * 세어지면 그 성질이 "지금은 16건"으로 바뀐다. 대신 에뮬레이터가 없는 실행에서는
 * 아래에서 **러너가 존재하는지**를 단언한다 — 의미는 전용 job이, 러너의 존재는
 * 유닛 스위트가 지킨다.
 */
const suite = (...args) => {
    if (EMULATOR_HOST) test(...args);
};

const [EMULATOR_HOSTNAME, EMULATOR_PORT] = EMULATOR_HOST
    ? [EMULATOR_HOST.split(':')[0], Number(EMULATOR_HOST.split(':').pop())]
    : ['127.0.0.1', 0];

const PLAYER_UID = 'player-under-test';
const OTHER_UID = 'some-other-player';

/** 테스트 환경은 파일당 한 번만 띄운다(에뮬레이터 연결 비용). */
let testEnv = null;

const getEnv = async () => {
    if (testEnv) return testEnv;
    testEnv = await initializeTestEnvironment({
        projectId: 'aetheria-rules-test',
        firestore: {
            rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
            host: EMULATOR_HOSTNAME,
            port: EMULATOR_PORT,
        },
    });
    return testEnv;
};

test.after(async () => {
    if (testEnv) await testEnv.cleanup();
});

/** 본인으로 인증된 Firestore 핸들. */
const asPlayer = async (uid = PLAYER_UID) => (await getEnv()).authenticatedContext(uid).firestore();
/** 미인증 Firestore 핸들. */
const asAnonymous = async () => (await getEnv()).unauthenticatedContext().firestore();

// ─────────────────────────────────────────────────────────────────────────────
// 쓰기 지점 1·2 — `createCloudAutosave.ts:117` (users/{uid}) / `:122` (leaderboard/{uid})
//   이 모듈은 Firestore 연산을 전부 주입받는다 → **프로덕션 함수를 그대로 실행**한다.
//   페이로드를 손으로 옮겨 적지 않으므로 클라이언트가 키를 하나 늘리면 여기가 먼저 깨진다.
// ─────────────────────────────────────────────────────────────────────────────

const makeSaveRecord = (overrides = {}) => ({
    saveVersion: 1,
    revision: 7,
    savedAt: 1_700_000_000_000,
    payload: {},
    ...overrides,
});

const runCloudAutosave = async ({ db, player, uid = PLAYER_UID }) => {
    const dispatched = [];
    const flush = createCloudAutosave({
        db,
        doc,
        setDoc,
        serverTimestamp,
        loadLocalRecord: async () => makeSaveRecord(),
        dispatch: (action) => dispatched.push(action),
        refs: {
            localSavePromise: { current: Promise.resolve(makeSaveRecord()) },
            pendingCloudRecord: { current: null },
            cloudRevisionFloor: { current: 0 },
            cloudRevisionAdvanceRequired: { current: false },
        },
        now: () => 1_700_000_000_000,
    });

    const result = await flush({
        uid,
        player,
        gameState: 'idle',
        enemy: null,
        grave: null,
        currentEvent: null,
        quickSlots: [null, null, null],
    });
    return { result, dispatched };
};

suite('site 1+2 — 클라우드 자동저장의 실제 페이로드가 users/{uid}와 leaderboard/{uid}에 통과한다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();

    // 리더보드 쓰기는 `player.name && kills > 0`에서만 일어난다(createCloudAutosave.ts:120).
    const player = makePlayerFixture({
        name: '테스트용사',
        level: 12,
        stats: { ...makePlayerFixture().stats, kills: 42 },
    });

    const { result, dispatched } = await runCloudAutosave({ db, player });

    // createCloudAutosave는 throw하지 않고 결과를 반환한다 — 'offline'이면 rules가 거부했다는 뜻.
    assert.equal(result, 'synced', '자동저장 두 쓰기가 모두 rules를 통과해야 한다');
    assert.deepEqual(
        dispatched.map((a) => a.payload),
        ['synced'],
        'SET_SYNC_STATUS는 synced 한 번이어야 한다',
    );
});

suite('site 1 — 자동저장은 남의 uid 문서에 쓸 수 없다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer(PLAYER_UID);
    const player = makePlayerFixture({ name: '테스트용사', level: 3 });

    // 인증은 PLAYER_UID인데 문서 경로는 OTHER_UID — isSelf(uid)가 거부해야 한다.
    const { result } = await runCloudAutosave({ db, player, uid: OTHER_UID });
    assert.equal(result, 'offline', '남의 세이브 문서 쓰기는 거부되어야 한다');
});

suite('site 1 — lastActive가 서버 타임스탬프가 아니면 거부된다(rules의 유일한 타입 절)', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();
    const ref = doc(db, 'artifacts', APP_ID, 'users', PLAYER_UID);

    await assertFails(setDoc(ref, {
        player: { name: '테스트용사' },
        gameState: 'idle',
        lastActive: 1_700_000_000_000, // 숫자 — `is timestamp` 위반
    }, { merge: true }));
});

suite('site 2 — 리더보드는 본인 entry만, 닉네임 20자 상한이 실제로 문다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();

    const entry = (overrides = {}) => ({
        nickname: '테스트용사',
        totalKills: 42,
        prestigeRank: 0,
        activeTitle: null,
        level: 12,
        bossKills: 1,
        job: CONSTANTS.DEFAULT_JOB,
        uid: PLAYER_UID,
        updatedAt: serverTimestamp(),
        ...overrides,
    });

    // 남의 entry
    await assertFails(setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', OTHER_UID),
        entry({ uid: OTHER_UID }),
        { merge: true },
    ));

    // 21자 닉네임 — strLen(nickname, 20) 위반
    await assertFails(setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', PLAYER_UID),
        entry({ nickname: 'a'.repeat(21) }),
        { merge: true },
    ));

    // 리더보드는 누구나 읽는다(랭킹 조회) — 미인증 포함.
    await assertSucceeds(setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', PLAYER_UID),
        entry(),
        { merge: true },
    ));
});

// ─────────────────────────────────────────────────────────────────────────────
// 쓰기 지점 3 — `useFirebaseSync.ts:585` (public/data/graves/{uid})
//   훅 이펙트 안의 인라인 리터럴이라 함수로 뽑혀 있지 않다. 같은 입력에서 같은 식으로
//   만든다(원본과 나란히 읽을 것).
// ─────────────────────────────────────────────────────────────────────────────

/** useFirebaseSync.ts:585 의 페이로드 식을 그대로 옮긴 것. */
const buildGraveUploadPayload = ({ player, allItems, totalGold, uid }) => ({
    playerName: player.name || '무명 용사',
    level: player.level || 1,
    loc: player.loc || '알 수 없는 곳',
    items: allItems,
    gold: totalGold,
    guardPower: player.atk || 10,
    createdAt: serverTimestamp(),
    uid,
});

suite('site 3 — 사망 시 공개 묘비 업로드가 통과한다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();

    const player = makePlayerFixture({ name: '테스트용사', level: 30, loc: '어둠의 동굴', atk: 120 });
    const payload = buildGraveUploadPayload({
        player,
        allItems: [],
        totalGold: 12_345,
        uid: PLAYER_UID,
    });

    await assertSucceeds(setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'graves', PLAYER_UID),
        payload,
    ));
});

// rules가 거는 상한 중 **클라이언트가 보장하지 않는 것**을 실행으로 드러낸다.
//   `grave.gold = floor(player.gold / 2 × dropBonus)`이고 `MAX_GOLD` 상수는 없다.
//   즉 아래 거부는 가설이 아니라 도달 가능한 상태다 — 묘비 업로드는
//   `.catch(console.warn)`이라 그 순간 조용히 사라진다.
const GRAVE_UNGUARANTEED_CAPS = [
    ['gold 상한 9,999,999', { totalGold: 10_000_000 }],
    ['guardPower 상한 9,999', { player: { atk: 10_000 } }],
    ['level 상한 99', { player: { level: 100 } }],
];

suite(`site 3 — 묘비의 상한 ${GRAVE_UNGUARANTEED_CAPS.length}종은 클라이언트가 보장하지 않는다(도달 시 조용히 거부)`, async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();

    for (const [label, over] of GRAVE_UNGUARANTEED_CAPS) {
        const player = makePlayerFixture({
            name: '테스트용사', level: 30, loc: '어둠의 동굴', atk: 120, ...(over.player || {}),
        });
        const payload = buildGraveUploadPayload({
            player,
            allItems: [],
            totalGold: over.totalGold ?? 12_345,
            uid: PLAYER_UID,
        });
        await assertFails(setDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'graves', PLAYER_UID),
            payload,
        ), label);
    }
});

suite('site 3 — 묘비는 인증된 유저만 읽고, 클라이언트는 지울 수 없다', async () => {
    const env = await getEnv();
    await env.clearFirestore();

    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
            doc(ctx.firestore(), 'artifacts', APP_ID, 'public', 'data', 'graves', OTHER_UID),
            { playerName: '남의용사', level: 5, loc: '초원', gold: 1, guardPower: 1, uid: OTHER_UID },
        );
    });

    const anon = await asAnonymous();
    const { getDoc, deleteDoc } = await import('firebase/firestore');
    await assertFails(getDoc(
        doc(anon, 'artifacts', APP_ID, 'public', 'data', 'graves', OTHER_UID),
    ));

    const db = await asPlayer();
    await assertSucceeds(getDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'graves', OTHER_UID),
    ));
    await assertFails(deleteDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'graves', PLAYER_UID),
    ));
});

// ─────────────────────────────────────────────────────────────────────────────
// 쓰기 지점 4 — `TokenQuotaManager.ts:211` (users/{uid}/quota/daily-ai)
//   주입 가능한 프로덕션 메서드다 → 그대로 실행한다. Wave 13 E4가 rules **텍스트**로만
//   묶어 둔 블록이고, 여기서 처음 의미가 실행된다.
// ─────────────────────────────────────────────────────────────────────────────

const makeLocalStorageStub = (entries = {}) => {
    const store = new Map(Object.entries(entries));
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

const withLocalStorage = async (localStorage, fn) => {
    const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
    const original = globalThis.localStorage;
    globalThis.localStorage = localStorage;
    try {
        return await fn();
    } finally {
        if (hadOwn) globalThis.localStorage = original;
        else delete globalThis.localStorage;
    }
};

/**
 * 실제 `syncToFirestore`를 에뮬레이터에 쏜다.
 * 이 메서드는 거부를 내부에서 삼키므로(그게 프로덕션 동작이다) setDoc 경계에서 오류를 잡는다.
 * 로컬 레코드는 기존 계약 테스트와 같은 방식으로 localStorage에 시드한다.
 */
const runQuotaSync = async ({ db, dispatches, adopted = 0, unadopted = 0, uid = PLAYER_UID }) => {
    const outcomes = {};
    if (adopted) outcomes.adopted = adopted;
    if (unadopted) outcomes['proxy-rejected'] = unadopted;

    const localStorage = makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({
            date: new Date().toDateString(),
            used: dispatches,
            outcomes,
        }),
    });

    let writeError = null;
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        await withLocalStorage(localStorage, async () => {
            await TokenQuotaManager.syncToFirestore(uid, db, {
                doc,
                serverTimestamp,
                setDoc: async (...args) => {
                    try {
                        return await setDoc(...args);
                    } catch (e) {
                        writeError = e;
                        throw e;
                    }
                },
            });
        });
    } finally {
        console.warn = originalWarn;
    }
    return writeError;
};

suite('site 4 — AI 쿼터 미러링(6키)이 통과하고, 단조성이 실제로 문다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();

    // create — 디스패치 5 = 채택 2 + 미채택 1 + 미정산 2
    assert.equal(
        await runQuotaSync({ db, dispatches: 5, adopted: 2, unadopted: 1 }),
        null,
        '6키 쿼터 create가 통과해야 한다',
    );

    // update — 같은 날짜, 카운터 증가: 통과
    assert.equal(
        await runQuotaSync({ db, dispatches: 9, adopted: 4, unadopted: 2 }),
        null,
        '같은 날짜의 증가 update가 통과해야 한다',
    );

    // update — 같은 날짜, `used` 되감기: 거부(단조성)
    const rollback = await runQuotaSync({ db, dispatches: 3, adopted: 1, unadopted: 1 });
    assert.ok(rollback, '같은 날짜에 used를 되감는 쓰기는 거부되어야 한다');
});

suite('site 4 — 쿼터 문서는 읽을 수도 지울 수도 없다(write-only)', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();
    const { getDoc, deleteDoc } = await import('firebase/firestore');
    const ref = doc(db, 'artifacts', APP_ID, 'users', PLAYER_UID, 'quota', 'daily-ai');

    await assertFails(getDoc(ref));
    await assertFails(deleteDoc(ref));
});

suite('site 4 — 한도 초과와 정산 > 디스패치는 rules가 거부한다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();
    const ref = doc(db, 'artifacts', APP_ID, 'users', PLAYER_UID, 'quota', 'daily-ai');
    const base = {
        date: new Date().toDateString(),
        limit: TokenQuotaManager.DAILY_LIMIT,
        updatedAt: serverTimestamp(),
    };

    // used > DAILY_LIMIT
    await assertFails(setDoc(ref, {
        ...base, used: TokenQuotaManager.DAILY_LIMIT + 1, adopted: 0, unadopted: 0,
    }, { merge: true }));

    // adopted + unadopted > used  (= unsettled < 0)
    await assertFails(setDoc(ref, {
        ...base, used: 3, adopted: 3, unadopted: 1,
    }, { merge: true }));

    // limit이 BALANCE.DAILY_AI_LIMIT가 아니면 거부
    await assertFails(setDoc(ref, {
        ...base, limit: TokenQuotaManager.DAILY_LIMIT + 1, used: 1, adopted: 0, unadopted: 0,
    }, { merge: true }));
});

suite('site 4 — 구버전 클라이언트의 4키 쓰기는 계속 통과한다(hasAll 4키 유지의 이유)', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();
    const ref = doc(db, 'artifacts', APP_ID, 'users', PLAYER_UID, 'quota', 'daily-ai');

    // 이미 설치된 Capacitor 빌드는 정산 키를 영원히 모른다 — 이 쓰기가 거부되면
    // 그 집단의 쿼터 미러링이 영구히 죽는다(§17.1 발견 7).
    await assertSucceeds(setDoc(ref, {
        date: new Date().toDateString(),
        used: 2,
        limit: TokenQuotaManager.DAILY_LIMIT,
        updatedAt: serverTimestamp(),
    }, { merge: true }));
});

// ─────────────────────────────────────────────────────────────────────────────
// 쓰기 지점 5 — `SystemTab.tsx:309` (public/data)
//   **거부가 정답이다.** Console 전용 운영 도구이고, §18이 "동작하게 만들지 않는다"를
//   명시적으로 기각 목록에 올렸다. 그 의도를 실행으로 고정한다.
// ─────────────────────────────────────────────────────────────────────────────

suite('site 5 — admin live config 쓰기는 무조건 거부된다(의도 — Console 전용)', async () => {
    const env = await getEnv();
    await env.clearFirestore();

    // `updateLiveConfig`(SystemTab.tsx:307-310)의 실제 페이로드.
    const write = async (db) => setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data'),
        { config: { eventMultiplier: 2 } },
        { merge: true },
    );

    await assertFails(write(await asPlayer()));
    await assertFails(write(await asAnonymous()));

    // 읽기는 열려 있다 — 앱 초기화가 live config를 읽는다.
    const { getDoc } = await import('firebase/firestore');
    await assertSucceeds(getDoc(doc(await asAnonymous(), 'artifacts', APP_ID, 'public', 'data')));
});

// ─────────────────────────────────────────────────────────────────────────────
// 쓰기 지점 6 — `SystemTab.tsx:370` (public/data/feedback)
//   **이 트랙이 닫는 버그.** 이전에는 rules에 `feedback`이 0건이라 전면 차단 catch-all이
//   받아 100% 거부됐다. 아래 첫 케이스가 그 회귀를 잡는다.
// ─────────────────────────────────────────────────────────────────────────────

/** SystemTab.tsx:370 의 페이로드 식을 그대로 옮긴 것. */
const buildFeedbackPayload = ({ player, message, uid }) => ({
    uid,
    nickname: player.name,
    message: message.trim(),
    statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
    timestamp: serverTimestamp(),
});

const feedbackCollection = (db) => collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');

suite('site 6 — 의견 보내기가 통과한다(이 트랙 이전에는 100% 거부됐다)', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();

    const player = makePlayerFixture({ name: '테스트용사', level: 12 });
    await assertSucceeds(addDoc(feedbackCollection(db), buildFeedbackPayload({
        player,
        message: '전투 로그가 너무 빨리 지나가서 읽기 어렵습니다.',
        uid: PLAYER_UID,
    })));
});

suite('site 6 — 입력창 상한(500자) 길이의 한글 의견이 통과한다 — size()는 바이트가 아니다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();
    const player = makePlayerFixture({ name: '테스트용사', level: 12 });

    // SystemTab 의 textarea 는 maxLength={500}. 한글은 UTF-8 3바이트/자이므로 1,500바이트다.
    // rules 의 `size()`가 바이트였다면 이 쓰기는 1000 상한에 걸려 거부된다 —
    // 즉 이 케이스는 "한국어 UI에서만 터지는 거부"를 실행으로 배제한다.
    const koreanMax = '가'.repeat(500);
    assert.equal(koreanMax.length, 500);
    assert.equal(Buffer.byteLength(koreanMax, 'utf8'), 1500);

    await assertSucceeds(addDoc(feedbackCollection(db), buildFeedbackPayload({
        player, message: koreanMax, uid: PLAYER_UID,
    })));
});

const FEEDBACK_DENIALS = [
    // 라벨, 페이로드 변형
    ['남의 uid로 제출', (p) => ({ ...p, uid: OTHER_UID })],
    ['로그인 전(uid=null) 제출', (p) => ({ ...p, uid: null })],
    ['검증기 하한 미만 메시지', (p) => ({ ...p, message: '짧다' })],
    ['검증기 상한 초과 메시지', (p) => ({ ...p, message: 'a'.repeat(FeedbackValidator.MAX_LENGTH + 1) })],
    ['빈 닉네임', (p) => ({ ...p, nickname: '' })],
    ['21자 닉네임', (p) => ({ ...p, nickname: 'a'.repeat(21) })],
    ['키 추가(임의 필드 주입)', (p) => ({ ...p, injected: 'x' })],
    ['statsSummary 키 누락', (p) => ({ ...p, statsSummary: { level: 1, job: '모험가' } })],
    ['statsSummary 키 추가', (p) => ({ ...p, statsSummary: { ...p.statsSummary, extra: 1 } })],
    ['level 상한(MAX_LEVEL) 초과', (p) => ({ ...p, statsSummary: { ...p.statsSummary, level: 100 } })],
    ['음수 kills', (p) => ({ ...p, statsSummary: { ...p.statsSummary, kills: -1 } })],
    ['클라이언트 타임스탬프', (p) => ({ ...p, timestamp: new Date() })],
];

suite(`site 6 — 의견 보내기 거부 ${FEEDBACK_DENIALS.length}종`, async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();
    const player = makePlayerFixture({ name: '테스트용사', level: 12 });
    const base = buildFeedbackPayload({
        player, message: '전투 로그가 너무 빨리 지나갑니다.', uid: PLAYER_UID,
    });

    for (const [label, mutate] of FEEDBACK_DENIALS) {
        await assertFails(addDoc(feedbackCollection(db), mutate(base)), label);
    }
});

suite('site 6 — 의견은 append-only다: 본인도 읽거나 고칠 수 없다', async () => {
    const env = await getEnv();
    await env.clearFirestore();
    const db = await asPlayer();
    const { getDoc, updateDoc, deleteDoc } = await import('firebase/firestore');

    let id = null;
    await env.withSecurityRulesDisabled(async (ctx) => {
        const ref = await addDoc(feedbackCollection(ctx.firestore()), {
            uid: PLAYER_UID, nickname: '테스트용사', message: '이미 저장된 의견입니다.',
            statsSummary: { level: 1, job: '모험가', kills: 0 }, timestamp: new Date(),
        });
        id = ref.id;
    });

    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'feedback', id);
    await assertFails(getDoc(ref));
    await assertFails(updateDoc(ref, { message: '고쳐 쓴 의견입니다.' }));
    await assertFails(deleteDoc(ref));
});

// ─────────────────────────────────────────────────────────────────────────────
// rules 리터럴 ↔ 클라이언트 상수 커플링
//   E4가 `DAILY_AI_LIMIT`에 건 것과 같은 형태다 — rules는 상수를 import할 수 없으므로
//   리터럴이 사본이고, 사본이 갈라지는 것을 여기서 막는다.
// ─────────────────────────────────────────────────────────────────────────────

// 에뮬레이터 없이 열린 실행(= `npm run test:unit`)에서는 **러너가 사라지지 않았는지**를
//   단언한다. 이 스위트의 가장 흔한 실패 모드는 빨개지는 것이 아니라 "아무도 안 돌리는
//   것"이고, 그건 스크립트나 CI job이 지워지는 순간 조용히 일어난다.
if (!EMULATOR_HOST) {
    test('에뮬레이터 밖에서는 rules 스위트의 러너 존재를 단언한다', async () => {
        const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
        const script = pkg.scripts['test:rules'];
        assert.ok(script, 'package.json에 test:rules 스크립트가 있어야 한다');
        assert.match(script, /emulators:exec/, 'test:rules는 에뮬레이터 안에서 돌아야 한다');
        assert.match(script, /firestore-rules-semantics\.test\.js/, 'test:rules가 이 파일을 돌려야 한다');

        const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
        assert.match(workflow, /run: npm run test:rules/, 'CI에 rules job이 있어야 한다');
        assert.match(
            workflow,
            /AETHERIA_REQUIRE_FIRESTORE_EMULATOR: '1'/,
            'CI의 rules job은 스킵을 실패로 만들어야 한다 — 없으면 조용히 0건 실행된다',
        );

        const emulators = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8')).emulators;
        assert.ok(emulators?.firestore?.port, 'firebase.json에 firestore 에뮬레이터 포트가 있어야 한다');
    });
}

test('feedback 블록의 길이 리터럴은 FeedbackValidator에서 도출된다', async () => {
    const source = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    const start = source.indexOf('match /public/data/feedback/{feedbackId}');
    assert.ok(start >= 0, 'feedback match가 rules에 있어야 한다');
    const block = source.slice(start, source.indexOf('match /{document=**}', start));
    const code = block.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

    const min = code.match(/message\.size\(\) >= (\d+)/);
    const max = code.match(/message\.size\(\) <= (\d+)/);
    assert.ok(min && max, 'message 길이 상·하한이 rules에 있어야 한다');
    assert.equal(Number(min[1]), FeedbackValidator.MIN_LENGTH);
    assert.equal(Number(max[1]), FeedbackValidator.MAX_LENGTH);

    // level 상한은 게임이 보장하는 CONSTANTS.MAX_LEVEL의 사본이다.
    const level = code.match(/statsSummary\.level <= (\d+)/);
    assert.ok(level, 'statsSummary.level 상한이 rules에 있어야 한다');
    assert.equal(Number(level[1]), CONSTANTS.MAX_LEVEL);

    // `kills`에는 리터럴 상한을 걸지 않는다 — 옆 graves 블록의 "보장되지 않는 상한"
    // 절벽을 복제하지 않기로 한 결정(rules 주석 4)을 되돌리기 어렵게 고정한다.
    assert.doesNotMatch(code, /statsSummary\.kills <=/);
});
