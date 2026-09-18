import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createBootState,
    findRestoreEffect,
    nextBootStep,
} from '../src/platform/bootStateMachine.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { MSG } from '../src/data/messages.ts';

/**
 * 부트 전이표 (Wave 10 B3).
 *
 * `useFirebaseSync`는 firebase를 import하므로 이 저장소(mock 프레임워크 없는 node:test)에서는
 * 단위 테스트가 불가능하다. 그래서 부트 순서·가드만 `platform/bootStateMachine.ts`로 떼어냈고,
 * 여기서 전이표 전체(모든 상태 × 모든 이벤트)와 CLAUDE.md §8-5 계약을 실행으로 고정한다.
 *
 * 훅은 이 전이표가 돌려준 dispatch/effect를 실행만 한다 — 온라인 복원 경로의 payload
 * dispatch(LOAD_DATA)는 훅이 갖되, "복원해도 되는가"는 전부 `step.restore`가 승인한다.
 */

const UID = 'uid-1';
const NAMED_RECORD = { data: { player: { name: '이리엘' } }, outcome: 'local' };
const FRESH_RECORD = { data: { player: {} }, outcome: 'fresh' };

const initState = () => createBootState();
const authState = (over = {}) => createBootState({ phase: 'auth', ...over });
const configState = (over = {}) => createBootState({ phase: 'config', uid: UID, authResolved: true, ...over });
const dataState = (over = {}) => createBootState({
    phase: 'data', uid: UID, authResolved: true, ...over,
});
const readyState = (over = {}) => createBootState({
    phase: 'ready', uid: UID, authResolved: true, bootResolved: true, restores: 1, ...over,
});

const kinds = (effects) => effects.map((effect) => effect.kind);
const types = (actions) => actions.map((action) => action.type);

const EVENT_SAMPLES = [
    { kind: 'mock_mode', data: { player: {} } },
    { kind: 'device_qa', scenario: 'true-ending-journey', data: { player: { name: '이리엘' } } },
    { kind: 'config_present' },
    { kind: 'config_missing' },
    { kind: 'auth_ok', uid: UID },
    { kind: 'auth_error' },
    { kind: 'auth_timeout' },
    { kind: 'data_stage_entered', uid: UID },
    {
        kind: 'remote_snapshot',
        doc: { lastActiveMillis: 1_700, hasLocalRecord: true },
        authority: 'remote',
        lastLoadedMillis: null,
    },
    { kind: 'local_record', record: NAMED_RECORD, source: 'fallback' },
    { kind: 'local_record', record: NAMED_RECORD, source: 'empty-remote-doc' },
    { kind: 'restore_prepared', source: 'remote-doc' },
    { kind: 'restore_prepared', source: 'local-record' },
    { kind: 'bootstrap_timeout' },
    { kind: 'remote_error' },
    { kind: 'restore_failed' },
    { kind: 'cancelled' },
];

const ALL_STATES = [
    initState(),
    authState(),
    authState({ authResolved: true }),
    configState(),
    dataState(),
    dataState({ bootResolved: true }),
    readyState(),
];

const KNOWN_EFFECTS = new Set([
    'startAuthTimer', 'signIn', 'syncTokenQuota', 'clearTimers', 'startBootstrapTimer',
    'subscribeUserDoc', 'fallbackOffline', 'restoreFromLocal', 'restoreFromLocalRecord',
    'restoreFromRemoteDoc',
]);

const AT_VALUES = new Set(Object.values(AT));

// ── 온라인 정상 경로 ────────────────────────────────────────────────────────

test('init + config_present → SET_BOOT_STAGE auth + 인증 타이머/로그인 effect', () => {
    const step = nextBootStep(initState(), { kind: 'config_present' });

    assert.deepEqual(step.dispatch, [{ type: AT.SET_BOOT_STAGE, payload: 'auth' }]);
    assert.deepEqual(kinds(step.effects), ['startAuthTimer', 'signIn']);
    assert.equal(step.restore, null);
    assert.equal(step.state.phase, 'auth');
    assert.equal(step.state.authResolved, false);
});

test('auth + auth_ok → SET_UID + SET_BOOT_STAGE config, 타이머 해제 후 쿼터 동기화', () => {
    const step = nextBootStep(authState(), { kind: 'auth_ok', uid: UID });

    assert.deepEqual(step.dispatch, [
        { type: AT.SET_UID, payload: UID },
        { type: AT.SET_BOOT_STAGE, payload: 'config' },
    ]);
    assert.deepEqual(step.effects, [{ kind: 'clearTimers' }, { kind: 'syncTokenQuota', uid: UID }]);
    assert.equal(step.state.phase, 'config');
    assert.equal(step.state.uid, UID);
    assert.equal(step.state.authResolved, true);
    assert.equal(step.restore, null);
});

test("config + data_stage_entered → 부트 타이머 + 사용자 문서 구독 (SET_BOOT_STAGE 'data'는 config 훅 소유)", () => {
    const step = nextBootStep(configState(), { kind: 'data_stage_entered', uid: UID });

    assert.deepEqual(step.dispatch, []);
    assert.deepEqual(step.effects, [
        { kind: 'startBootstrapTimer' },
        { kind: 'subscribeUserDoc', uid: UID },
    ]);
    assert.equal(step.state.phase, 'data');
});

test('uid 없이는 data 단계로 갈 수 없다 — 구독도 타이머도 시작하지 않는다', () => {
    const step = nextBootStep(configState({ uid: null }), { kind: 'data_stage_entered', uid: null });

    assert.deepEqual(step.dispatch, []);
    assert.deepEqual(step.effects, []);
    assert.equal(step.state.phase, 'config');
});

test('data_stage_entered 는 config 단계에서만 유효하다 (init/auth에서는 무시)', () => {
    for (const state of [initState(), authState()]) {
        const step = nextBootStep(state, { kind: 'data_stage_entered', uid: UID });
        assert.deepEqual(step.effects, []);
        assert.equal(step.state.phase, state.phase);
    }
});

// ── 원격 스냅샷 3분기 + 에코 ────────────────────────────────────────────────

test('원격 문서 + 로컬 권한 승 → restoreFromLocalRecord, 승인 시 local 복원', () => {
    const state = dataState();
    const snapshot = nextBootStep(state, {
        kind: 'remote_snapshot',
        doc: { lastActiveMillis: 1_700, hasLocalRecord: true },
        authority: 'local',
        lastLoadedMillis: null,
    });
    assert.deepEqual(kinds(snapshot.effects), ['restoreFromLocalRecord']);
    assert.equal(snapshot.restore, null);
    assert.equal(snapshot.state.phase, 'data');

    const prepared = nextBootStep(snapshot.state, { kind: 'restore_prepared', source: 'local-record' });
    assert.deepEqual(prepared.restore, { source: 'local-record', outcome: 'local' });
    assert.deepEqual(kinds(prepared.effects), ['clearTimers']);
    assert.equal(prepared.state.phase, 'ready');
    assert.equal(prepared.state.bootResolved, true);
    assert.equal(prepared.state.restores, 1);
});

test('로컬 권한이어도 로컬 레코드가 없으면 원격 문서를 채택한다', () => {
    const step = nextBootStep(dataState(), {
        kind: 'remote_snapshot',
        doc: { lastActiveMillis: 1_700, hasLocalRecord: false },
        authority: 'local',
        lastLoadedMillis: null,
    });

    assert.deepEqual(kinds(step.effects), ['restoreFromRemoteDoc']);
});

test('원격 문서 채택 → restore_prepared 가 cloud 복원을 승인한다', () => {
    const snapshot = nextBootStep(dataState(), {
        kind: 'remote_snapshot',
        doc: { lastActiveMillis: 2_000, hasLocalRecord: true },
        authority: 'remote',
        lastLoadedMillis: 1_000,
    });
    assert.deepEqual(kinds(snapshot.effects), ['restoreFromRemoteDoc']);

    const prepared = nextBootStep(snapshot.state, { kind: 'restore_prepared', source: 'remote-doc' });
    assert.deepEqual(prepared.restore, { source: 'remote-doc', outcome: 'cloud' });
    assert.equal(prepared.state.phase, 'ready');
});

test('내가 올린 저장의 에코(lastActive 일치)는 복원 없이 부트만 확정한다', () => {
    const step = nextBootStep(dataState(), {
        kind: 'remote_snapshot',
        doc: { lastActiveMillis: 1_234, hasLocalRecord: true },
        authority: 'remote',
        lastLoadedMillis: 1_234,
    });

    assert.deepEqual(step.dispatch, []);
    assert.deepEqual(step.effects, [{ kind: 'clearTimers' }]);
    assert.equal(step.restore, null);
    assert.equal(step.state.bootResolved, true);
    assert.equal(step.state.phase, 'data');
});

test('lastLoadedMillis 가 없으면(첫 부팅) 에코 판정을 하지 않는다', () => {
    const step = nextBootStep(dataState(), {
        kind: 'remote_snapshot',
        doc: { lastActiveMillis: null, hasLocalRecord: false },
        authority: 'remote',
        lastLoadedMillis: null,
    });

    assert.deepEqual(kinds(step.effects), ['restoreFromRemoteDoc']);
});

test('원격 문서 부재 → restoreFromLocal, 로컬 결과로 empty-remote-doc 복원', () => {
    const snapshot = nextBootStep(dataState(), {
        kind: 'remote_snapshot', doc: null, authority: null, lastLoadedMillis: null,
    });
    assert.deepEqual(kinds(snapshot.effects), ['restoreFromLocal']);
    assert.equal(snapshot.restore, null);

    const restored = nextBootStep(snapshot.state, {
        kind: 'local_record', record: NAMED_RECORD, source: 'empty-remote-doc',
    });
    assert.deepEqual(restored.restore, { source: 'empty-remote-doc', outcome: 'local' });
    assert.deepEqual(kinds(restored.effects), ['clearTimers']);
    assert.equal(restored.state.phase, 'ready');
});

// ── 오프라인 폴백 4종(config 없음 / 인증 타임아웃 / 인증 실패 / 부트 타임아웃) ──

test("(c) config_missing 은 MSG.SYNC_NO_CONFIG 오프라인 경로로 가고 'config'/'data' 단계를 만들지 않는다", () => {
    const step = nextBootStep(initState(), { kind: 'config_missing' });

    assert.deepEqual(step.dispatch, [{ type: AT.SET_BOOT_STAGE, payload: 'auth' }]);
    assert.deepEqual(step.effects, [
        { kind: 'startAuthTimer' },
        { kind: 'clearTimers' },
        { kind: 'fallbackOffline', message: MSG.SYNC_NO_CONFIG },
    ]);
    assert.equal(step.state.authResolved, true);
    assert.equal(step.restore, null);

    // 이어지는 복원까지, 이 경로의 어떤 전이도 'config'/'data' 를 dispatch 하지 않는다.
    const restored = nextBootStep(step.state, {
        kind: 'local_record', record: NAMED_RECORD, source: 'fallback',
    });
    const stages = [...step.dispatch, ...restored.dispatch]
        .filter((action) => action.type === AT.SET_BOOT_STAGE)
        .map((action) => action.payload);
    assert.deepEqual(stages, ['auth']);
    assert.deepEqual(restored.restore, { source: 'offline-fallback', outcome: 'local' });
    assert.equal(restored.state.phase, 'ready');
});

test('auth_timeout → MSG.SYNC_AUTH_TIMEOUT 폴백 (타이머는 이미 발화했으므로 해제하지 않는다)', () => {
    const step = nextBootStep(authState(), { kind: 'auth_timeout' });

    assert.deepEqual(step.effects, [{ kind: 'fallbackOffline', message: MSG.SYNC_AUTH_TIMEOUT }]);
    assert.deepEqual(step.dispatch, []);
    assert.equal(step.state.authResolved, true);
});

test('auth_error → 타이머 해제 후 MSG.SYNC_AUTH_FAIL 폴백', () => {
    const step = nextBootStep(authState(), { kind: 'auth_error' });

    assert.deepEqual(step.effects, [
        { kind: 'clearTimers' },
        { kind: 'fallbackOffline', message: MSG.SYNC_AUTH_FAIL },
    ]);
    assert.equal(step.state.authResolved, true);
});

test('bootstrap_timeout → MSG.SYNC_TIMEOUT 폴백, 이미 부트가 끝났으면 무시', () => {
    const fired = nextBootStep(dataState(), { kind: 'bootstrap_timeout' });
    assert.deepEqual(fired.effects, [{ kind: 'fallbackOffline', message: MSG.SYNC_TIMEOUT }]);
    assert.equal(fired.state.bootResolved, true);

    const late = nextBootStep(dataState({ bootResolved: true }), { kind: 'bootstrap_timeout' });
    assert.deepEqual(late.effects, []);
    assert.equal(late.restore, null);
});

test('remote_error / restore_failed → 타이머 해제 + MSG.SYNC_CONNECT_FAIL 폴백', () => {
    for (const kind of ['remote_error', 'restore_failed']) {
        const step = nextBootStep(dataState(), { kind });
        assert.deepEqual(step.effects, [
            { kind: 'clearTimers' },
            { kind: 'fallbackOffline', message: MSG.SYNC_CONNECT_FAIL },
        ], kind);
        assert.equal(step.state.bootResolved, true, kind);

        // 부트가 이미 끝난 뒤에는 타이머 해제만 한다(복원을 다시 시도하지 않는다).
        const resolved = nextBootStep(readyState(), { kind });
        assert.deepEqual(resolved.effects, [{ kind: 'clearTimers' }], kind);
        assert.equal(resolved.restore, null, kind);
    }
});

test('local_record 는 로컬 결과의 outcome(local/fresh/failure)을 그대로 복원 계획에 싣는다', () => {
    for (const record of [NAMED_RECORD, FRESH_RECORD, { data: { player: {} }, outcome: 'failure' }]) {
        const step = nextBootStep(authState({ authResolved: true }), {
            kind: 'local_record', record, source: 'fallback',
        });
        assert.deepEqual(step.restore, { source: 'offline-fallback', outcome: record.outcome });
    }
});

test('로컬 부트스트랩 결과가 없으면 복원하지 않는다', () => {
    const step = nextBootStep(authState({ authResolved: true }), {
        kind: 'local_record', record: null, source: 'fallback',
    });

    assert.equal(step.restore, null);
    assert.deepEqual(step.dispatch, []);
    assert.equal(step.state.phase, 'auth');
});

// ── mock / device-QA ────────────────────────────────────────────────────────

test('mock_mode → LOAD_DATA + 오프라인 상태, outcome 은 항상 fresh', () => {
    const data = { player: { name: '이리엘' } };
    const step = nextBootStep(initState(), { kind: 'mock_mode', data });

    assert.deepEqual(step.dispatch, [
        { type: AT.LOAD_DATA, payload: data },
        { type: AT.SET_SYNC_STATUS, payload: 'offline' },
    ]);
    assert.deepEqual(step.restore, { source: 'mock', outcome: 'fresh' });
    assert.equal(step.state.phase, 'ready');
});

test('device_qa → 스냅샷에 이름이 있으면 local, 없으면 fresh', () => {
    const named = nextBootStep(initState(), {
        kind: 'device_qa', scenario: 'true-ending-journey', data: { player: { name: '이리엘' } },
    });
    assert.deepEqual(named.restore, { source: 'device-qa', outcome: 'local' });
    assert.deepEqual(types(named.dispatch), [AT.LOAD_DATA, AT.SET_SYNC_STATUS]);

    for (const player of [{}, { name: '' }, { name: '   ' }]) {
        const blank = nextBootStep(initState(), {
            kind: 'device_qa', scenario: 'fresh-run', data: { player },
        });
        assert.deepEqual(blank.restore, { source: 'device-qa', outcome: 'fresh' });
    }
});

test('mock/device_qa 부트 이벤트는 init 에서만 받는다', () => {
    for (const state of [authState(), configState(), dataState(), readyState()]) {
        const step = nextBootStep(state, { kind: 'mock_mode', data: { player: {} } });
        assert.equal(step.restore, null, state.phase);
        assert.deepEqual(step.dispatch, [], state.phase);
    }
});

// ── §8-5 계약 ───────────────────────────────────────────────────────────────

test('(a) ready 이후에는 어떤 이벤트도 LOAD_DATA/SET_PLAYER 를 만들지 않는다', () => {
    for (const event of EVENT_SAMPLES) {
        const step = nextBootStep(readyState(), event);
        const emitted = types(step.dispatch);
        assert.ok(!emitted.includes(AT.LOAD_DATA), `${event.kind} → LOAD_DATA`);
        assert.ok(!emitted.includes(AT.SET_PLAYER), `${event.kind} → SET_PLAYER`);
    }
});

test('(a) 복원이 끝난 뒤 도착한 오프라인 폴백은 기본값으로 덮어쓰지 않는다', () => {
    // 부트 타임아웃이 먼저 발화해 로컬을 읽는 사이에 클라우드 복원이 끝난 경우.
    const timedOut = nextBootStep(dataState(), { kind: 'bootstrap_timeout' });
    const restoredFromCloud = nextBootStep(timedOut.state, {
        kind: 'restore_prepared', source: 'remote-doc',
    });
    assert.equal(restoredFromCloud.state.phase, 'ready');

    const late = nextBootStep(restoredFromCloud.state, {
        kind: 'local_record', record: FRESH_RECORD, source: 'fallback',
    });
    assert.equal(late.restore, null);
    assert.deepEqual(late.dispatch, []);
    assert.equal(late.state.restores, 1);
});

test('(b) ready 는 복원 결정을 정확히 한 번 거친 뒤에만 나온다', () => {
    for (const state of ALL_STATES) {
        for (const event of EVENT_SAMPLES) {
            const step = nextBootStep(state, event);
            const label = `${state.phase}/${event.kind}`;

            if (step.restore) {
                assert.equal(step.state.phase, 'ready', `${label}: 복원 승인은 ready 로 간다`);
                assert.equal(step.state.restores, state.restores + 1, `${label}: restores +1`);
                assert.equal(step.state.bootResolved, true, label);
            } else {
                assert.equal(step.state.restores, state.restores, `${label}: 복원 없이 restores 증가 금지`);
                if (state.phase !== 'ready') {
                    assert.notEqual(step.state.phase, 'ready', `${label}: 복원 없이 ready 진입 금지`);
                }
            }
            if (types(step.dispatch).includes(AT.LOAD_DATA)) {
                assert.ok(step.restore, `${label}: LOAD_DATA 는 복원 승인과 함께만 나온다`);
            }
        }
    }
});

test('(d) 인증이 이미 끝난 뒤의 auth_timeout/auth_error/auth_ok 는 무시된다', () => {
    const ok = nextBootStep(authState(), { kind: 'auth_ok', uid: UID });
    assert.equal(ok.state.authResolved, true);

    // 타이머가 늦게 발화해도(=이미 config 단계) 폴백을 만들지 않는다.
    const lateTimeout = nextBootStep(ok.state, { kind: 'auth_timeout' });
    assert.deepEqual(lateTimeout.effects, []);
    assert.deepEqual(lateTimeout.dispatch, []);
    assert.equal(lateTimeout.state.phase, 'config');

    // 반대로 폴백이 먼저면 뒤늦은 인증 성공이 'config' 단계를 다시 열지 않는다.
    const timedOut = nextBootStep(authState(), { kind: 'auth_timeout' });
    const lateAuth = nextBootStep(timedOut.state, { kind: 'auth_ok', uid: UID });
    assert.deepEqual(lateAuth.dispatch, []);
    assert.deepEqual(lateAuth.effects, []);
    assert.equal(lateAuth.state.phase, 'auth');

    const afterError = nextBootStep(authState(), { kind: 'auth_error' });
    const secondError = nextBootStep(afterError.state, { kind: 'auth_error' });
    assert.deepEqual(secondError.effects, []);
});

test('(e) cancelled 는 타이머를 끄고 이후 모든 전이를 억제한다', () => {
    for (const state of ALL_STATES) {
        const cancelled = nextBootStep(state, { kind: 'cancelled' });
        assert.deepEqual(cancelled.effects, [{ kind: 'clearTimers' }], state.phase);
        assert.equal(cancelled.state.cancelled, true, state.phase);

        for (const event of EVENT_SAMPLES) {
            const step = nextBootStep(cancelled.state, event);
            const label = `${state.phase}/${event.kind}`;
            assert.deepEqual(step.dispatch, [], label);
            assert.deepEqual(step.effects, [], label);
            assert.equal(step.restore, null, label);
            assert.deepEqual(step.state, cancelled.state, label);
        }
    }
});

// ── 전이표 전수 점검 ────────────────────────────────────────────────────────

test('전이표: 모든 상태 × 모든 이벤트가 유효한 step 을 만든다 (순수/불변)', () => {
    let pairs = 0;
    for (const state of ALL_STATES) {
        for (const event of EVENT_SAMPLES) {
            const before = JSON.stringify(state);
            const step = nextBootStep(state, event);
            const label = `${state.phase}/${event.kind}`;
            pairs += 1;

            assert.equal(JSON.stringify(state), before, `${label}: 입력 상태를 변이하면 안 된다`);
            assert.ok(Array.isArray(step.dispatch) && Array.isArray(step.effects), label);
            assert.ok(step.restore === null || typeof step.restore.source === 'string', label);

            for (const action of step.dispatch) {
                assert.ok(AT_VALUES.has(action.type), `${label}: ${action.type} 은 실제 AT 키가 아니다`);
            }
            for (const effect of step.effects) {
                assert.ok(KNOWN_EFFECTS.has(effect.kind), `${label}: ${effect.kind} 미정의 effect`);
            }

            // 순수성: 같은 입력은 항상 같은 step.
            assert.deepEqual(nextBootStep(state, event), step, `${label}: 결정론`);
        }
    }
    assert.equal(pairs, ALL_STATES.length * EVENT_SAMPLES.length);
    assert.ok(pairs >= 100, `전이 조합 ${pairs}건`);
});

test('전이표: 복원 준비 effect 는 데이터 단계에서만, 인증 effect 는 init/auth 에서만 나온다', () => {
    const authOnly = new Set(['startAuthTimer', 'signIn', 'syncTokenQuota']);
    const dataOnly = new Set([
        'startBootstrapTimer', 'subscribeUserDoc',
        'restoreFromLocal', 'restoreFromLocalRecord', 'restoreFromRemoteDoc',
    ]);

    for (const state of ALL_STATES) {
        for (const event of EVENT_SAMPLES) {
            const step = nextBootStep(state, event);
            for (const effect of step.effects) {
                const label = `${state.phase}/${event.kind}/${effect.kind}`;
                if (authOnly.has(effect.kind)) {
                    assert.ok(['init', 'auth'].includes(state.phase), label);
                }
                if (dataOnly.has(effect.kind)) {
                    assert.ok(['config', 'data', 'ready'].includes(state.phase), label);
                }
            }
        }
    }
});

test('findRestoreEffect 는 복원 준비 effect 1건만 골라낸다', () => {
    assert.equal(findRestoreEffect([{ kind: 'clearTimers' }]), null);
    assert.equal(findRestoreEffect([]), null);
    assert.deepEqual(
        findRestoreEffect([{ kind: 'clearTimers' }, { kind: 'restoreFromRemoteDoc' }]),
        { kind: 'restoreFromRemoteDoc' },
    );
    assert.deepEqual(
        findRestoreEffect([{ kind: 'restoreFromLocal' }]),
        { kind: 'restoreFromLocal' },
    );
});

test('createBootState 는 init 기본값을 주고 부분 초기화를 허용한다', () => {
    assert.deepEqual(createBootState(), {
        phase: 'init',
        uid: null,
        authResolved: false,
        bootResolved: false,
        cancelled: false,
        restores: 0,
    });
    assert.deepEqual(createBootState({ phase: 'config', uid: UID, authResolved: true }), {
        phase: 'config',
        uid: UID,
        authResolved: true,
        bootResolved: false,
        cancelled: false,
        restores: 0,
    });
});
