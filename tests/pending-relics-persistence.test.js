import test from 'node:test';
import assert from 'node:assert/strict';

import { RELICS } from '../src/data/relics.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { migrateData } from '../src/utils/dataMigration.ts';
import { createCloudAutosave } from '../src/hooks/createCloudAutosave.ts';

/**
 * 2026-09 Wave 34 — 원장 §27.6 "알고 남긴 것": `pendingRelics`가 세이브 봉투 밖이었다.
 *
 * 유물 선택(발견 3택 · 시작 부트 · 체인 완주 보상 · 상한 교체 제안)이 떠 있는 동안 리로드하면 제안이 사라졌다 —
 * 그 제안을 만든 사건(전투 승리 · 체인 스텝 진행)은 이미 저장돼 있어 다시 오지 않는다. 즉 보상 소실이다.
 * `migrateData`가 로드 때 `pendingRelics`를 무조건 null로 만들었고(주석: "런타임 전용 — 저장 불필요"),
 * 로컬·클라우드 저장 봉투 어디에도 없었다. 이제 봉투에 싣고, 로드 때 정본 유물로만 되살린다.
 */

const relicById = (id) => {
    const relic = RELICS.find((entry) => entry.id === id);
    assert.ok(relic, `전제: 유물 ${id}가 있다`);
    return structuredClone(relic);
};
const [A, B, C] = RELICS.slice(0, 3).map((relic) => relic.id);

const loadState = (payload) => gameReducer(
    { ...structuredClone(INITIAL_STATE), bootStage: 'booting' },
    { type: AT.LOAD_DATA, payload },
);
const savedPlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '유물 수집가',
    level: 20,
    loc: '시작의 마을',
    relics: [],
    ...overrides,
});

// ── 로드(migrateData) ───────────────────────────────────────────────────────

test('[마이그레이션] 저장된 유물 제안은 정본 유물로 되살아난다', () => {
    const forged = { ...relicById(A), name: '위조된 이름', val: 999 };
    const migrated = migrateData({ player: savedPlayer(), gameState: 'idle', pendingRelics: [forged, relicById(B)] }, { now: 0 });
    assert.deepEqual(migrated.pendingRelics.map((relic) => relic.id), [A, B]);
    assert.deepEqual(migrated.pendingRelics[0], relicById(A), '세이브의 필드가 아니라 데이터 정의를 쓴다');
});

test('[마이그레이션] 모르는 유물 · 중복 · 배열이 아닌 값은 버리고, 남는 게 없으면 null', () => {
    const mixed = migrateData({ player: savedPlayer(), pendingRelics: [{ id: '없는_유물' }, relicById(C), relicById(C), 'x', null] }, { now: 0 });
    assert.deepEqual(mixed.pendingRelics.map((relic) => relic.id), [C]);
    assert.equal(migrateData({ player: savedPlayer(), pendingRelics: [{ id: '없는_유물' }] }, { now: 0 }).pendingRelics, null);
    assert.equal(migrateData({ player: savedPlayer(), pendingRelics: { id: A } }, { now: 0 }).pendingRelics, null);
    assert.equal(migrateData({ player: savedPlayer() }, { now: 0 }).pendingRelics, null, '구세이브(필드 없음)는 null');
});

// ── 복원(LOAD_DATA) ─────────────────────────────────────────────────────────

test('[복원] LOAD_DATA가 유물 제안을 되살린다', () => {
    const migrated = migrateData({ player: savedPlayer(), gameState: 'idle', pendingRelics: [relicById(A), relicById(B)] }, { now: 0 });
    const state = loadState(migrated);
    assert.equal(state.bootStage, 'ready');
    assert.deepEqual(state.pendingRelics.map((relic) => relic.id), [A, B]);
});

test('[복원] 이미 가진 유물은 제안에서 빠진다(전부 가졌으면 null)', () => {
    const partly = loadState(migrateData({ player: savedPlayer({ relics: [relicById(A)] }), gameState: 'idle', pendingRelics: [relicById(A), relicById(B)] }, { now: 0 }));
    assert.deepEqual(partly.pendingRelics.map((relic) => relic.id), [B]);
    const all = loadState(migrateData({ player: savedPlayer({ relics: [relicById(A)] }), gameState: 'idle', pendingRelics: [relicById(A)] }, { now: 0 }));
    assert.equal(all.pendingRelics, null);
});

test('[복원] 사망 세이브의 제안은 되살리지 않는다(dead는 언제나 idle로 접힌다)', () => {
    const state = loadState(migrateData({ player: savedPlayer(), gameState: GS.DEAD, pendingRelics: [relicById(A)] }, { now: 0 }));
    assert.equal(state.gameState, GS.IDLE);
    assert.equal(state.pendingRelics, null);
});

// ── 저장(봉투) ──────────────────────────────────────────────────────────────

const cloudFlush = () => {
    const setDocCalls = [];
    const record = { saveVersion: 1, revision: 3, savedAt: 1_000, payload: {} };
    const flush = createCloudAutosave({
        db: { fake: 'db' },
        doc: (_db, ...segments) => ({ path: segments.join('/') }),
        setDoc: async (ref, data) => { setDocCalls.push({ path: ref.path, data }); },
        serverTimestamp: () => '<ts>',
        loadLocalRecord: async () => record,
        dispatch: () => {},
        refs: {
            localSavePromise: { current: Promise.resolve(record) },
            pendingCloudRecord: { current: null },
            cloudRevisionFloor: { current: 0 },
            cloudRevisionAdvanceRequired: { current: false },
        },
        now: () => 1_000,
    });
    return { flush, setDocCalls };
};
const cloudSnapshot = (pendingRelics) => ({
    uid: 'uid-1',
    player: savedPlayer(),
    gameState: 'idle',
    enemy: null,
    grave: null,
    currentEvent: null,
    quickSlots: [null, null, null],
    pendingRelics,
});

test('[클라우드 저장] 자동 저장 문서에 유물 제안이 실리고, 없으면 null이다(Firestore는 undefined를 거부한다)', async () => {
    const withChoice = cloudFlush();
    await withChoice.flush(cloudSnapshot([relicById(A), relicById(B)]));
    const saved = withChoice.setDocCalls.find((call) => call.path.endsWith('users/uid-1'));
    assert.deepEqual(saved.data.pendingRelics.map((relic) => relic.id), [A, B]);

    const none = cloudFlush();
    await none.flush(cloudSnapshot(null));
    const empty = none.setDocCalls.find((call) => call.path.endsWith('users/uid-1'));
    assert.ok(Object.hasOwn(empty.data, 'pendingRelics'));
    assert.equal(empty.data.pendingRelics, null);
});

test('[왕복] 클라우드 문서 → migrateData → LOAD_DATA가 같은 제안을 돌려준다', async () => {
    const { flush, setDocCalls } = cloudFlush();
    await flush(cloudSnapshot([relicById(C)]));
    const doc = JSON.parse(JSON.stringify(setDocCalls.find((call) => call.path.endsWith('users/uid-1')).data));
    const state = loadState(migrateData(doc, { now: 0 }));
    assert.deepEqual(state.pendingRelics.map((relic) => relic.id), [C]);
});
