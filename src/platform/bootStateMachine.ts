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
 *   원격 스냅샷, 로컬 부트스트랩 결과, 취소). 복원 payload를 만드는 IO(저장소 읽기,
 *   `migrateData`, 클라우드 레코드 import)는 훅이 하고, **그 결과를 이벤트가 싣고 온다**
 *   (`mock_mode`/`device_qa`/`local_record`/`restore_prepared`의 `data`/`record`).
 * - **출력(`BootStep`)**: 그 사건에 대한 결정 — 다음 상태, 그대로 dispatch 할
 *   `GameAction[]`, 훅이 실행할 `BootEffect[]`, 그리고 "이번 전이가 복원을
 *   승인했는가"(`restore`).
 *
 * Wave 11 C1: 복원 payload의 **dispatch까지** 이 파일이 소유한다 — `AT.LOAD_DATA`와
 * 그 결정에 딸린 `AT.SET_SYNC_STATUS`(offline/syncing), 복원 텔레메트리(`trackRestore`),
 * 안내 로그(`log`)가 전부 승인 전이 하나에서 같이 나온다. 그래서 "어떤 경로가 무엇을
 * 복원하고 무엇을 남기는가"는 훅을 읽지 않고 이 전이표만으로 확인된다.
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
 * 훅과의 분담: 이 파일은 **순서/가드/메시지 선택/복원 dispatch**를 소유하고, 훅은 firebase
 * 호출, 타이머, `onSnapshot` 배선, 저장소 IO, 텔레메트리 전송, 로그 id
 * 생성(`Date.now()`/`Math.random()`) 같은 부수효과 실행을 소유한다 — 무엇을 보낼지는
 * `trackRestore`/`log` effect가 이미 정해서 넘긴다.
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

/** 부트가 남기는 로그 종류 — 폴백 경고와 서버 복원 안내 두 가지뿐이다. */
export type BootLogLevel = 'warning' | 'system';

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
    /**
     * 오프라인 폴백이 읽어 온 로컬 부트스트랩 결과.
     * `message`는 이 폴백을 지시한 `fallbackOffline` effect의 문구 그대로다 —
     * 복원이 승인되면 같은 문구가 경고 로그로 나간다.
     */
    | {
        readonly kind: 'local_record';
        readonly record: OfflineBootstrapResult | null;
        readonly source: 'fallback';
        readonly message: string;
    }
    /** 원격 문서 부재로 로컬 부트스트랩을 채택하는 경로(폴백 경고 없음). */
    | {
        readonly kind: 'local_record';
        readonly record: OfflineBootstrapResult | null;
        readonly source: 'empty-remote-doc';
    }
    /** 로컬 레코드 payload 준비 완료 — 이제 복원을 승인받는다. */
    | {
        readonly kind: 'restore_prepared';
        readonly source: 'local-record';
        readonly data: LoadDataPayload;
    }
    /** 원격 문서 payload 준비 완료(가져오기·리비전 정산까지 끝난 뒤). */
    | {
        readonly kind: 'restore_prepared';
        readonly source: 'remote-doc';
        readonly data: LoadDataPayload;
        /** 클라우드 레코드의 로컬 미러 import가 실패했는가(`importCloudRecordAuthority`). */
        readonly localImportFailed: boolean;
        /** 훅의 `hasBootLogRef.current` — 이미 로그가 있으면 서버 복원 안내를 다시 내지 않는다. */
        readonly hasBootLog: boolean;
    }
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
    | { readonly kind: 'restoreFromRemoteDoc' }
    /**
     * 승인된 복원 1건을 제품 텔레메트리에 남긴다(`restore` 이벤트, receipt는 훅 소유).
     * 훅이 outcome을 다시 고르지 않도록 전이표가 결정한 값을 그대로 싣는다.
     */
    | {
        readonly kind: 'trackRestore';
        readonly outcome: BootRestoreOutcome;
        readonly player: LoadDataPayload['player'];
    }
    /** 로그 1건 — 문구/시점은 전이표가 고르고 id 생성(`Date.now`/`Math.random`)은 훅이 한다. */
    | { readonly kind: 'log'; readonly level: BootLogLevel; readonly message: string };

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
            const outcome: BootRestoreOutcome = isDeviceQa && hasPlayerName(event.data.player)
                ? 'local'
                : 'fresh';
            return restored(
                state,
                { source: isDeviceQa ? 'device-qa' : 'mock', outcome },
                [
                    { type: AT.LOAD_DATA, payload: event.data },
                    { type: AT.SET_SYNC_STATUS, payload: 'offline' },
                ],
                [{ kind: 'trackRestore', outcome, player: event.data.player }],
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
            const { data, outcome } = event.record;
            if (event.source === 'fallback') {
                // §8-5 (a): 복원이 끝난 뒤에 도착한 폴백은 기본값으로 덮지 않는다.
                if (state.phase === 'ready') return idle(state);
                return restored(
                    state,
                    { source: 'offline-fallback', outcome },
                    [
                        // 봉투(`{ data, outcome }`)가 아니라 그 안의 스냅샷을 싣는다.
                        { type: AT.LOAD_DATA, payload: data },
                        { type: AT.SET_SYNC_STATUS, payload: 'offline' },
                    ],
                    [
                        { kind: 'trackRestore', outcome, player: data.player },
                        { kind: 'log', level: 'warning', message: event.message },
                    ],
                );
            }
            const dispatch: GameAction[] = [{ type: AT.LOAD_DATA, payload: data }];
            // 이름 있는 런만 클라우드로 승격한다(빈 원격 문서 → 로컬 런이 최초 스냅샷이 된다).
            if (data.player?.name) dispatch.push({ type: AT.SET_SYNC_STATUS, payload: 'syncing' });
            return restored(
                state,
                { source: 'empty-remote-doc', outcome },
                dispatch,
                [{ kind: 'clearTimers' }, { kind: 'trackRestore', outcome, player: data.player }],
            );
        }

        case 'restore_prepared': {
            if (!inDataStage(state)) return idle(state);
            if (event.source === 'local-record') {
                return restored(
                    state,
                    { source: 'local-record', outcome: 'local' },
                    [
                        { type: AT.LOAD_DATA, payload: event.data },
                        { type: AT.SET_SYNC_STATUS, payload: 'syncing' },
                    ],
                    [
                        { kind: 'clearTimers' },
                        { kind: 'trackRestore', outcome: 'local', player: event.data.player },
                    ],
                );
            }
            const dispatch: GameAction[] = [{ type: AT.LOAD_DATA, payload: event.data }];
            const effects: BootEffect[] = [
                { kind: 'clearTimers' },
                { kind: 'trackRestore', outcome: 'cloud', player: event.data.player },
            ];
            if (event.localImportFailed) {
                // 클라우드는 채택했지만 로컬 미러가 실패했다 — 자동저장을 다시 켜지 않는다.
                dispatch.push({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
                effects.push({ kind: 'log', level: 'warning', message: MSG.SYNC_CONNECT_FAIL });
            }
            if (!event.hasBootLog) {
                effects.push({ kind: 'log', level: 'system', message: MSG.SYNC_SERVER_LOADED });
            }
            return restored(state, { source: 'remote-doc', outcome: 'cloud' }, dispatch, effects);
        }

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
