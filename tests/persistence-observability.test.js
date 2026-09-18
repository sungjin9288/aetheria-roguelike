import assert from 'node:assert/strict';
import test from 'node:test';

import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { resolveOfflineBootstrapResult } from '../src/platform/persistenceTelemetry.ts';
import { createBootState, nextBootStep } from '../src/platform/bootStateMachine.ts';
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

/**
 * Wave 11 C1 — 아래 두 테스트는 `useFirebaseSync` 소스를 정규식으로 읽던 가드
 * (`/LOAD_DATA, payload: offlineResult\.data/` 2회 · 텔레메트리 2회 ·
 *  `doesNotMatch(/LOAD_DATA, payload: offlineData\b/)`)를 행동 단언으로 옮긴 것이다.
 * 복원 dispatch가 전이표(`platform/bootStateMachine.ts`)로 들어오면서 그 텍스트는
 * 훅에 남아 있지 않고, 같은 불변식을 실행으로 고정할 수 있게 됐다.
 */

const fallbackStep = (state, record) => nextBootStep(state, {
    kind: 'local_record',
    record,
    source: 'fallback',
    message: MSG.SYNC_TIMEOUT,
});

test('both Firebase offline fallback paths dispatch data and emit the restore outcome', () => {
    // "폴백 2곳"의 실체: 인증 수명(config 없음/인증 타임아웃/인증 실패)과 데이터 수명
    // (부트 타임아웃/구독 에러/복원 실패) — 두 수명 모두에서 같은 복원이 나와야 한다.
    const lifetimes = {
        auth: createBootState({ phase: 'auth', authResolved: true }),
        data: createBootState({ phase: 'data', uid: 'uid-1', authResolved: true }),
    };
    const record = resolveOfflineBootstrapResult({
        data: { player: { name: 'restored-local-player' } },
        outcome: 'local',
    });

    for (const [lifetime, state] of Object.entries(lifetimes)) {
        const step = fallbackStep(state, record);

        assert.deepEqual(step.restore, { source: 'offline-fallback', outcome: 'local' }, lifetime);
        const loads = step.dispatch.filter((action) => action.type === AT.LOAD_DATA);
        assert.equal(loads.length, 1, lifetime);
        // 봉투(`{ data, outcome }`)가 아니라 그 안의 스냅샷을 그대로 싣는다.
        assert.equal(loads[0].payload, record.data, lifetime);
        assert.equal(Object.hasOwn(loads[0].payload, 'outcome'), false, lifetime);
        assert.deepEqual(step.effects.filter((effect) => effect.kind === 'trackRestore'), [
            { kind: 'trackRestore', outcome: 'local', player: record.data.player },
        ], lifetime);
    }
});

test('offline fallback telemetry carries the bootstrap outcome, not a fixed one', () => {
    const state = createBootState({ phase: 'auth', authResolved: true });

    for (const outcome of ['local', 'fresh', 'failure']) {
        const record = resolveOfflineBootstrapResult({ data: { player: {} }, outcome });
        const step = fallbackStep(state, record);

        assert.equal(step.restore.outcome, outcome);
        assert.deepEqual(step.effects.filter((effect) => effect.kind === 'trackRestore'), [
            { kind: 'trackRestore', outcome, player: record.data.player },
        ], outcome);
    }
});
