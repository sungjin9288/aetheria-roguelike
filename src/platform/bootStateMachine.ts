import { MSG } from '../data/messages';
import { AT } from '../reducers/actionTypes';
import type { GameAction, LoadDataPayload } from '../reducers/actionTypes';
import type { OfflineBootstrapResult, OfflineRestoreOutcome } from './persistenceTelemetry';

/**
 * bootStateMachine — 부팅 전이표 (Wave 10 B3)
 *
 * `useFirebaseSync`는 그동안 "무엇을 관찰했는가"와 "그래서 어떤 순서로 무엇을 한다"를
 * 한 덩어리로 들고 있었다. firebase를 import하는 훅은 단위 테스트가 불가능하므로
 * (mock 프레임워크 없이 `node:test`만 쓰는 이 저장소에서는 특히) 부트 순서·가드가
 * 실행 테스트 0건인 채로 남아 있었다. 이 파일은 그 중 **순서와 가드**만 떼어낸
 * 순수 전이표다 — React/firebase/타이머/저장소에 의존하지 않는다.
 *
 * - **입력(`BootEvent`)**: 훅이 관찰하는 사건들(config 유무, 인증 결과, 타임아웃,
 *   원격 스냅샷, 로컬 부트스트랩 결과, 취소).
 * - **출력(`BootStep`)**: 그 사건에 대한 결정 — 다음 상태, 그대로 dispatch 할
 *   `GameAction[]`, 훅이 실행할 `BootEffect[]`, 그리고 "이번 전이가 복원을
 *   승인했는가"(`restore`).
 *
 * §8-5 계약(CLAUDE.md): `bootStage`가 완료되기 전에 게임을 렌더링하지 않는다 —
 * 즉 `'ready'`(= `AT.LOAD_DATA` 처리 결과)는 **복원 결정을 정확히 한 번 거친 뒤에만**
 * 나온다. 이 파일이 그 불변식의 단일 소유자다:
 *   · 복원을 승인한 전이만 `phase: 'ready'`로 간다(`restores` 증가).
 *   · 인증/부트 타임아웃 같은 **폴백 복원은 이미 복원이 끝난 뒤에는 승인되지 않는다**
 *     (기본값이 실제 세이브를 덮어쓰는 race를 막는다).
 *   · 원격 문서 변경으로 들어오는 복원(cross-device sync)은 부트 이후에도 계속 허용된다.
 *   · `cancelled` 이후의 모든 이벤트는 무시된다.
 *
 * 훅과의 분담: 이 파일은 **순서/가드/메시지 선택**을 소유하고, 훅은 firebase 호출,
 * 타이머, `onSnapshot` 배선, 저장소 IO, 텔레메트리, 로그 id 생성(`Date.now()`/`Math.random()`)
 * 같은 부수효과를 소유한다.
 */

/** 훅이 `SET_BOOT_STAGE`로 내보내는 단계 + 복원 완료(`ready`). */
export type BootPhase = 'init' | 'auth' | 'config' | 'data' | 'ready';

/** `resolveCloudBootstrapAuthority`(platform/gameStorage)의 판정값. */
export type CloudBootstrapAuthority = 'local' | 'remote' | 'none';

/** 복원 텔레메트리 outcome — 오프라인 3종 + 클라우드. */
export type BootRestoreOutcome = OfflineRestoreOutcome | 'cloud';

/** 어떤 경로로 복원이 확정됐는가(= 부트가 `ready`에 도달한 이유). */
export type BootRestoreSource =
    | 'mock'
    | 'device-qa'
    | 'offline-fallback'
    | 'local-record'
    | 'remote-doc'
    | 'empty-remote-doc';

/** 전이가 승인한 복원 1건. `null`이면 이번 전이는 복원을 승인하지 않았다. */
export interface BootRestorePlan {
    readonly source: BootRestoreSource;
    readonly outcome: BootRestoreOutcome;
}

/** 훅이 관찰한 원격 사용자 문서(값 자체가 아니라 판정에 필요한 요약). */
export interface RemoteBootDoc {
    /** `remoteData.lastActive?.toMillis() || null` — 0/누락은 null로 접는다. */
    readonly lastActiveMillis: number | null;
    /** 로컬 세이브 레코드가 존재하는가(`authority === 'local'` 분기의 두 번째 조건). */
    readonly hasLocalRecord: boolean;
}

/** 로컬 부트스트랩 결과가 어떤 경로로 들어왔는가. */
export type BootLocalRecordSource = 'fallback' | 'empty-remote-doc';

export type BootEvent =
    /** 모의 런타임(mock) 부팅 — 신규 캐릭터 기본값으로 즉시 복원한다. */
    | { readonly kind: 'mock_mode'; readonly data: LoadDataPayload }
    /** device-QA 런타임 부팅 — 시나리오 스냅샷으로 즉시 복원한다. */
    | { readonly kind: 'device_qa'; readonly scenario: string; readonly data: LoadDataPayload }
    /** 온라인 부팅 시작, firebase config 있음. */
    | { readonly kind: 'config_present' }
    /** 온라인 부팅 시작, firebase config 없음(`!hasFirebaseConfig || !auth`). */
    | { readonly kind: 'config_missing' }
    | { readonly kind: 'auth_ok'; readonly uid: string }
    | { readonly kind: 'auth_error' }
    | { readonly kind: 'auth_timeout' }
    /** `bootStage === 'data'` 리스너 진입 — uid가 없으면 전이표가 거부한다. */
    | { readonly kind: 'data_stage_entered'; readonly uid: string | null }
    /** 사용자 문서 스냅샷 1건. `doc: null`은 문서 부재(`!docSnap.exists()`). */
    | {
        readonly kind: 'remote_snapshot';
        readonly doc: RemoteBootDoc | null;
        readonly authority: CloudBootstrapAuthority | null;
        /** 훅의 `lastLoadedTimestampRef.current`(React state 파생) — 에코 판정 입력. */
        readonly lastLoadedMillis: number | null;
    }
    /** 로컬 부트스트랩 결과 도착(`getOfflineBootstrapData()`의 반환). */
    | {
        readonly kind: 'local_record';
        readonly record: OfflineBootstrapResult | null;
        readonly source: BootLocalRecordSource;
    }
    /** 원격/로컬 스냅샷 payload 준비 완료 — 이제 복원을 승인받는다. */
    | { readonly kind: 'restore_prepared'; readonly source: 'local-record' | 'remote-doc' }
    | { readonly kind: 'bootstrap_timeout' }
    /** `onSnapshot` 에러 콜백. */
    | { readonly kind: 'remote_error' }
    /** 스냅샷 처리 중 예외(복원 payload 불량 포함). */
    | { readonly kind: 'restore_failed' }
    /** effect cleanup — 이후 모든 전이를 억제한다. */
    | { readonly kind: 'cancelled' };

export type BootEffect =
    /** `AUTH_TIMEOUT_MS` 타이머 시작 → 만료 시 `auth_timeout`. */
    | { readonly kind: 'startAuthTimer' }
    /** 익명 인증 시작 → `auth_ok` / `auth_error`. */
    | { readonly kind: 'signIn' }
    /** 크로스 디바이스 토큰 쿼터 동기화. */
    | { readonly kind: 'syncTokenQuota'; readonly uid: string }
    /** 이 effect 수명에서 돌고 있는 타이머 해제. */
    | { readonly kind: 'clearTimers' }
    /** `BOOTSTRAP_TIMEOUT_MS` 타이머 시작 → 만료 시 `bootstrap_timeout`. */
    | { readonly kind: 'startBootstrapTimer' }
    /** 사용자 문서 `onSnapshot` 구독 시작. */
    | { readonly kind: 'subscribeUserDoc'; readonly uid: string }
    /** 오프라인 폴백: 로컬 부트스트랩을 읽고 `local_record`(source 'fallback')로 돌아온다. */
    | { readonly kind: 'fallbackOffline'; readonly message: string }
    /** 원격 문서 부재: 로컬 부트스트랩으로 복원한다. */
    | { readonly kind: 'restoreFromLocal' }
    /** 로컬 세이브가 권한을 이겼다: 로컬 레코드로 복원한다. */
    | { readonly kind: 'restoreFromLocalRecord' }
    /** 원격 문서를 채택한다(가져오기·리비전 정산 포함). */
    | { readonly kind: 'restoreFromRemoteDoc' };

/** 복원 payload를 준비하라는 지시 3종 — 훅이 직접 실행한다(비동기·저장소 IO). */
export type BootRestoreEffect = Extract<
    BootEffect,
    { kind: 'restoreFromLocal' | 'restoreFromLocalRecord' | 'restoreFromRemoteDoc' }
>;

export interface BootStep {
    /** 전이 후 상태. 호출자는 이 값을 다음 전이의 입력으로 쓴다. */
    readonly state: BootState;
    /** 그대로 순서대로 dispatch 할 action(전부 실제 `AT` 키). */
    readonly dispatch: readonly GameAction[];
    /** 훅이 실행할 부수효과(순서 보존). */
    readonly effects: readonly BootEffect[];
    /** 이번 전이가 승인한 복원. `null`이면 복원 없음. */
    readonly restore: BootRestorePlan | null;
}

export interface BootState {
    readonly phase: BootPhase;
    readonly uid: string | null;
    /** 인증 경로가 이미 결론났는가(성공/실패/타임아웃 중 먼저 온 하나). */
    readonly authResolved: boolean;
    /** 부트(데이터) 경로가 이미 결론났는가. */
    readonly bootResolved: boolean;
    readonly cancelled: boolean;
    /** 승인된 복원 횟수 — `restores > 0` ⟺ `phase === 'ready'`. */
    readonly restores: number;
}

export const createBootState = (init: Partial<BootState> = {}): BootState => ({
    phase: 'init',
    uid: null,
    authResolved: false,
    bootResolved: false,
    cancelled: false,
    restores: 0,
    ...init,
});

const idle = (state: BootState): BootStep => ({
    state,
    dispatch: [],
    effects: [],
    restore: null,
});

const restored = (
    state: BootState,
    restore: BootRestorePlan,
    dispatch: readonly GameAction[] = [],
    effects: readonly BootEffect[] = [],
): BootStep => ({
    state: {
        ...state,
        phase: 'ready',
        authResolved: true,
        bootResolved: true,
        restores: state.restores + 1,
    },
    dispatch,
    effects,
    restore,
});

const hasPlayerName = (player: LoadDataPayload['player'] | undefined): boolean =>
    String(player?.name || '').trim().length > 0;

const isRestoreEffect = (effect: BootEffect): effect is BootRestoreEffect => (
    effect.kind === 'restoreFromLocal'
    || effect.kind === 'restoreFromLocalRecord'
    || effect.kind === 'restoreFromRemoteDoc'
);

/** 전이가 지시한 복원 준비 effect 1건(없으면 null). */
export const findRestoreEffect = (effects: readonly BootEffect[]): BootRestoreEffect | null =>
    effects.find(isRestoreEffect) ?? null;

/** 데이터 단계(구독이 살아 있는 구간)인가 — 부트 타임아웃/스냅샷 전이가 유효한 구간. */
const inDataStage = (state: BootState): boolean => state.phase === 'data' || state.phase === 'ready';

/**
 * 부팅 전이 1건. 순수 함수 — 같은 (state, event)는 항상 같은 step을 만든다.
 */
export const nextBootStep = (state: BootState, event: BootEvent): BootStep => {
    // 취소 이후에는 어떤 이벤트도 상태를 바꾸지 못한다(§8-5 (e)).
    if (state.cancelled) return idle(state);

    switch (event.kind) {
        case 'cancelled':
            return {
                state: { ...state, cancelled: true },
                dispatch: [],
                effects: [{ kind: 'clearTimers' }],
                restore: null,
            };

        case 'mock_mode':
        case 'device_qa': {
            if (state.phase !== 'init') return idle(state);
            const isDeviceQa = event.kind === 'device_qa';
            return restored(
                state,
                {
                    source: isDeviceQa ? 'device-qa' : 'mock',
                    outcome: isDeviceQa && hasPlayerName(event.data.player) ? 'local' : 'fresh',
                },
                [
                    { type: AT.LOAD_DATA, payload: event.data },
                    { type: AT.SET_SYNC_STATUS, payload: 'offline' },
                ],
            );
        }

        case 'config_present':
            if (state.phase !== 'init') return idle(state);
            return {
                state: { ...state, phase: 'auth' },
                dispatch: [{ type: AT.SET_BOOT_STAGE, payload: 'auth' }],
                effects: [{ kind: 'startAuthTimer' }, { kind: 'signIn' }],
                restore: null,
            };

        case 'config_missing':
            // config가 없으면 'config'/'data' 단계에 가지 않고 곧장 오프라인 폴백이다.
            if (state.phase !== 'init') return idle(state);
            return {
                state: { ...state, phase: 'auth', authResolved: true },
                dispatch: [{ type: AT.SET_BOOT_STAGE, payload: 'auth' }],
                effects: [
                    { kind: 'startAuthTimer' },
                    { kind: 'clearTimers' },
                    { kind: 'fallbackOffline', message: MSG.SYNC_NO_CONFIG },
                ],
                restore: null,
            };

        case 'auth_ok':
            if (state.phase !== 'auth' || state.authResolved) return idle(state);
            return {
                state: { ...state, phase: 'config', uid: event.uid, authResolved: true },
                dispatch: [
                    { type: AT.SET_UID, payload: event.uid },
                    { type: AT.SET_BOOT_STAGE, payload: 'config' },
                ],
                effects: [{ kind: 'clearTimers' }, { kind: 'syncTokenQuota', uid: event.uid }],
                restore: null,
            };

        case 'auth_timeout':
            // 이미 인증이 결론난 뒤의 타임아웃은 무시한다(§8-5 (d)).
            if (state.phase !== 'auth' || state.authResolved) return idle(state);
            return {
                state: { ...state, authResolved: true },
                dispatch: [],
                // 타이머가 스스로 발화했으므로 해제할 것이 없다.
                effects: [{ kind: 'fallbackOffline', message: MSG.SYNC_AUTH_TIMEOUT }],
                restore: null,
            };

        case 'auth_error':
            if (state.phase !== 'auth' || state.authResolved) return idle(state);
            return {
                state: { ...state, authResolved: true },
                dispatch: [],
                effects: [
                    { kind: 'clearTimers' },
                    { kind: 'fallbackOffline', message: MSG.SYNC_AUTH_FAIL },
                ],
                restore: null,
            };

        case 'data_stage_entered':
            // uid 없이는 사용자 문서 경로로 갈 수 없다.
            if (!event.uid || state.phase !== 'config') return idle(state);
            return {
                state: { ...state, phase: 'data', uid: event.uid },
                dispatch: [],
                effects: [
                    { kind: 'startBootstrapTimer' },
                    { kind: 'subscribeUserDoc', uid: event.uid },
                ],
                restore: null,
            };

        case 'remote_snapshot': {
            if (!inDataStage(state)) return idle(state);
            if (!event.doc) {
                return { state, dispatch: [], effects: [{ kind: 'restoreFromLocal' }], restore: null };
            }
            if (event.authority === 'local' && event.doc.hasLocalRecord) {
                return {
                    state,
                    dispatch: [],
                    effects: [{ kind: 'restoreFromLocalRecord' }],
                    restore: null,
                };
            }
            if (event.lastLoadedMillis !== null && event.doc.lastActiveMillis === event.lastLoadedMillis) {
                // 내가 방금 올린 저장의 에코 — 복원 없이 부트만 확정한다.
                return {
                    state: { ...state, bootResolved: true },
                    dispatch: [],
                    effects: [{ kind: 'clearTimers' }],
                    restore: null,
                };
            }
            return {
                state,
                dispatch: [],
                effects: [{ kind: 'restoreFromRemoteDoc' }],
                restore: null,
            };
        }

        case 'local_record': {
            if (state.phase !== 'auth' && !inDataStage(state)) return idle(state);
            if (!event.record) return idle(state);
            if (event.source === 'fallback') {
                // §8-5 (a): 복원이 끝난 뒤에 도착한 폴백은 기본값으로 덮지 않는다.
                if (state.phase === 'ready') return idle(state);
                return restored(state, { source: 'offline-fallback', outcome: event.record.outcome });
            }
            return restored(state, {
                source: 'empty-remote-doc',
                outcome: event.record.outcome,
            }, [], [{ kind: 'clearTimers' }]);
        }

        case 'restore_prepared':
            if (!inDataStage(state)) return idle(state);
            return restored(
                state,
                event.source === 'local-record'
                    ? { source: 'local-record', outcome: 'local' }
                    : { source: 'remote-doc', outcome: 'cloud' },
                [],
                [{ kind: 'clearTimers' }],
            );

        case 'bootstrap_timeout':
            if (!inDataStage(state) || state.bootResolved) return idle(state);
            return {
                state: { ...state, bootResolved: true },
                dispatch: [],
                effects: [{ kind: 'fallbackOffline', message: MSG.SYNC_TIMEOUT }],
                restore: null,
            };

        case 'remote_error':
        case 'restore_failed':
            if (!inDataStage(state)) return idle(state);
            return {
                state: state.bootResolved ? state : { ...state, bootResolved: true },
                dispatch: [],
                effects: state.bootResolved
                    ? [{ kind: 'clearTimers' }]
                    : [
                        { kind: 'clearTimers' },
                        { kind: 'fallbackOffline', message: MSG.SYNC_CONNECT_FAIL },
                    ],
                restore: null,
            };
    }
};
