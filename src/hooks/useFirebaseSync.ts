import { useCallback, useEffect, useRef } from 'react';
import {
    onSnapshot,
    doc,
    setDoc,
    serverTimestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import { auth, db, hasFirebaseConfig } from '../firebase';
import { CONSTANTS, APP_ID, BALANCE } from '../data/constants';
import { migrateData } from '../utils/gameUtils';
import { hasMigratedPlayer } from '../utils/dataMigration';
import { normalizeGraves, getGraveItems } from '../utils/graveUtils';
import { getDeviceQaScenario, isMockRuntime } from '../utils/runtimeMode';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import {
    clearDeviceQaSnapshot,
    readDeviceQaSnapshot,
    writeDeviceQaSnapshot,
} from '../utils/localGameSnapshot';
import { getRuntimeGameStorage } from '../platform/gameStorageRuntime';
import { importCloudRecordAuthority } from '../platform/cloudSaveAuthority';
import { trackRuntimeProductEvent } from '../platform/productEventCoordinator';
import { normalizeProductEventJob, type ProductEventName } from '../platform/productEvents';
import {
    resolveOfflineBootstrapResult,
    type OfflineBootstrapData,
    type OfflineBootstrapResult,
} from '../platform/persistenceTelemetry';
import { PRODUCTION_GAME_CAPABILITIES } from '../platform/gameCapabilities';
import {
    resolveCloudBootstrapAuthority,
    type GameSaveRecord,
} from '../platform/gameStorage';
import {
    createBootState,
    findRestoreEffect,
    nextBootStep,
    type BootEffect,
    type BootEvent,
    type BootStep,
} from '../platform/bootStateMachine';
import { createCloudAutosave } from './createCloudAutosave';
import { useLiveConfigAndLeaderboard } from './useLiveConfigAndLeaderboard';
import type { Player } from '../types';
import type { GameAction, GameState } from '../reducers/gameReducer';
import type { Dispatch } from 'react';

const BOOTSTRAP_TIMEOUT_MS = 6000;
const AUTH_TIMEOUT_MS = 8000;
const makeLogPayload = (type: string, text: string) => ({ type, text, id: `${Date.now()}_${Math.random()}` });

// `player`가 `Partial<Player>`인 것은 복원 경로의 실제 폭이다 — `migrateData`는 알려진
// 필드만 정규화하므로(`MigratedSave['player']`) 구세이브는 name/job/level이 비어 있을 수
// 있다. 본문은 이미 `player?.name` / `Number(player?.level) || 1`로 그 경우를 다룬다.
const trackPersistenceResult = (
    player: Partial<Player>,
    name: Extract<ProductEventName, 'save' | 'restore'>,
    outcome: string,
    receipt: string,
) => trackRuntimeProductEvent({
    receipt,
    name,
    fields: {
        job: String(player?.name || '').trim() ? normalizeProductEventJob(player?.job) : 'unknown',
        level: Number(player?.level) || 1,
        outcome,
    },
});

const getOfflineBootstrapData = async (): Promise<OfflineBootstrapResult> => {
    try {
        const localRecord = await getRuntimeGameStorage().migrate((payload) => payload);
        if (!localRecord) return {
            data: { player: INITIAL_STATE.player },
            outcome: 'fresh' as const,
        };

        const activeData = migrateData(localRecord.payload);
        // 로컬 레코드의 payload는 gameStorage가 `isGameSnapshot`(= player 필드 존재)을
        // 통과한 것만 저장/복원하지만, 그 보장은 저장 계층의 것이고 migrateData 반환형의
        // 것이 아니다(구형 flat 세이브는 player 키 자체가 없다). 이전에는 바로 아래
        // `activeData.player.loc`이 TypeError를 던져 catch가 'failure'로 내려보냈고,
        // 여기서는 같은 결과를 조기 반환으로 낸다(차이: console.warn 한 줄이 없다).
        if (!hasMigratedPlayer(activeData)) return {
            data: { player: INITIAL_STATE.player },
            outcome: 'failure' as const,
        };
        if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
        if (!activeData.player.loc) activeData.player.loc = CONSTANTS.START_LOCATION;
        return { data: activeData, outcome: 'local' as const };
    } catch (error) {
        console.warn('Local game restore failed', error);
        return {
            data: { player: INITIAL_STATE.player },
            outcome: 'failure' as const,
        };
    }
};

const getDeviceQaBootstrapData = (scenario: string | null): OfflineBootstrapData => {
    const localSnapshot = readDeviceQaSnapshot(undefined, scenario);
    if (!localSnapshot) return { player: INITIAL_STATE.player };

    const activeData = migrateData(localSnapshot);
    // device-QA 스냅샷은 시나리오 파일이라 player가 빠질 수 있다. 이전에는 아래
    // `activeData.player.loc`이 TypeError를 던져 부팅 effect가 그대로 터졌고,
    // 여기서는 스냅샷이 없을 때와 같은 신규 캐릭터 기본값으로 조기 반환한다.
    if (!hasMigratedPlayer(activeData)) return { player: INITIAL_STATE.player };
    if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
    if (!activeData.player.loc) activeData.player.loc = CONSTANTS.START_LOCATION;
    return activeData;
};

/**
 * useFirebaseSync — Firebase 인증, 실시간 동기화, 리더보드, 자동 저장
 */
export const useFirebaseSync = (state: GameState, dispatch: Dispatch<GameAction>) => {
    const mockMode = isMockRuntime();
    const deviceQaScenario = getDeviceQaScenario();
    const deviceQaMode = deviceQaScenario !== null;
    const {
        player,
        gameState,
        enemy,
        grave,
        currentEvent,
        quickSlots,
        syncStatus,
        uid,
        bootStage
    } = state;

    const lastLoadedTimestampRef = useRef(state.lastLoadedTimestamp);
    const hasBootLogRef = useRef(state.logs.length > 0);
    const previousLocalPlayerNameRef = useRef(player?.name);
    const localSavePromiseRef = useRef<Promise<GameSaveRecord | null>>(Promise.resolve(null));
    const pendingCloudRecordRef = useRef<GameSaveRecord | null>(null);
    const cloudRevisionFloorRef = useRef(0);
    const cloudRevisionAdvanceRequiredRef = useRef(false);

    const flushLocalSave = useCallback(async (): Promise<GameSaveRecord | null> => {
        if ((mockMode && !deviceQaMode) || !player?.name) return null;
        const savedAt = Date.now();
        const snapshot = {
            player: {
                ...player,
                stats: { ...player.stats, lastSeenAt: savedAt },
            },
            gameState,
            enemy,
            grave,
            currentEvent,
            quickSlots,
            version: CONSTANTS.DATA_VERSION,
            savedAt,
        };
        if (deviceQaMode) {
            writeDeviceQaSnapshot(snapshot, undefined, deviceQaScenario);
            trackPersistenceResult(player, 'save', 'success', `save:device-qa:${savedAt}`);
            return null;
        }

        const storage = getRuntimeGameStorage();
        localSavePromiseRef.current = (async () => {
            const pendingCloudRecord = pendingCloudRecordRef.current;
            if (pendingCloudRecord) {
                await storage.importRecord(pendingCloudRecord);
            }
            const saved = await storage.save(snapshot);
            trackPersistenceResult(player, 'save', 'success', `save:${saved.revision}`);
            if (saved.revision > cloudRevisionFloorRef.current) {
                cloudRevisionAdvanceRequiredRef.current = false;
                if (pendingCloudRecordRef.current === pendingCloudRecord) {
                    pendingCloudRecordRef.current = null;
                }
            }
            return saved;
        })().catch((error) => {
            console.warn('Local game save failed', error);
            trackPersistenceResult(player, 'save', 'failure', `save-failure:${savedAt}`);
            return null;
        });
        return localSavePromiseRef.current;
    }, [
        currentEvent,
        deviceQaMode,
        deviceQaScenario,
        enemy,
        gameState,
        grave,
        mockMode,
        player,
        quickSlots,
    ]);

    useEffect(() => {
        if (!mockMode || syncStatus === 'offline') return;
        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
    }, [dispatch, mockMode, syncStatus]);

    // --- Auth ---
    // 부트 순서('auth' → 'config', 오프라인 폴백은 두 단계를 건너뛴다)와 가드(authResolved/
    // cancelled)는 platform/bootStateMachine.ts 전이표가 소유한다. 이 effect는 관찰한 사건을
    // 이벤트로 넣고, 돌아온 step의 dispatch/effect를 실행할 뿐이다.
    useEffect(() => {
        let bootState = createBootState();
        let authTimer: ReturnType<typeof setTimeout> | undefined;

        const applyBoot = (event: BootEvent): BootStep => {
            const step = nextBootStep(bootState, event);
            bootState = step.state;
            step.dispatch.forEach((action) => dispatch(action));
            step.effects.forEach((effect) => runBootEffect(effect));
            return step;
        };

        // 복원 승인(§8-5)도 복원 dispatch/텔레메트리/로그 문구도 전이표가 소유한다 —
        // 여기서는 로컬 부트스트랩을 읽어(IO) 이벤트로 넣을 뿐이다.
        const fallbackAuthOffline = async (message: string) => {
            const offlineResult = resolveOfflineBootstrapResult(await getOfflineBootstrapData());
            applyBoot({ kind: 'local_record', record: offlineResult, source: 'fallback', message });
        };

        const runBootEffect = (effect: BootEffect) => {
            switch (effect.kind) {
                case 'startAuthTimer':
                    authTimer = setTimeout(() => {
                        applyBoot({ kind: 'auth_timeout' });
                    }, AUTH_TIMEOUT_MS);
                    break;
                case 'clearTimers':
                    clearTimeout(authTimer);
                    break;
                case 'signIn':
                    // auth는 hasFirebaseConfig가 참일 때만 non-null(firebase.ts) — 타입 가드용 동치 검사.
                    if (!auth) break;
                    signInAnonymously(auth)
                        .then((cred) => {
                            applyBoot({ kind: 'auth_ok', uid: cred.user.uid });
                        })
                        .catch((e: unknown) => {
                            console.error('Auth Failed', e);
                            applyBoot({ kind: 'auth_error' });
                        });
                    break;
                case 'syncTokenQuota':
                    // 크로스 디바이스 쿼터 동기화 (Dead Code → 활성화)
                    TokenQuotaManager.syncToFirestore(effect.uid, db).catch((e: unknown) => {
                        console.warn('Token quota sync failed', e);
                    });
                    break;
                case 'fallbackOffline':
                    void fallbackAuthOffline(effect.message);
                    break;
                case 'trackRestore':
                    trackPersistenceResult(effect.player, 'restore', effect.outcome, 'restore');
                    break;
                case 'log':
                    // 서버 복원 안내는 부트당 1회 — 원본과 같은 지점에서 ref를 닫는다.
                    if (effect.level === 'system') hasBootLogRef.current = true;
                    dispatch({ type: AT.ADD_LOG, payload: makeLogPayload(effect.level, effect.message) });
                    break;
                default:
                    // 데이터 단계 전용 effect는 이 수명에서 나오지 않는다(전이표가 phase로 막는다).
                    break;
            }
        };

        if (mockMode) {
            const deviceQaData = deviceQaMode
                ? getDeviceQaBootstrapData(deviceQaScenario)
                : { player: INITIAL_STATE.player };
            applyBoot(deviceQaScenario !== null
                ? { kind: 'device_qa', scenario: deviceQaScenario, data: deviceQaData }
                : { kind: 'mock_mode', data: deviceQaData });
            return undefined;
        }

        // auth는 hasFirebaseConfig가 참일 때만 non-null(firebase.ts) — 타입 가드용 동치 검사.
        if (!hasFirebaseConfig || !auth) {
            console.warn('[FIREBASE] Missing required config. Booting in offline mode.');
            applyBoot({ kind: 'config_missing' });
        } else {
            applyBoot({ kind: 'config_present' });
        }

        return () => {
            applyBoot({ kind: 'cancelled' });
        };
    }, [deviceQaMode, deviceQaScenario, dispatch, mockMode]);

    useEffect(() => {
        lastLoadedTimestampRef.current = state.lastLoadedTimestamp;
    }, [state.lastLoadedTimestamp]);

    // --- Config & Leaderboard (세이브/로드와 무관 — 전용 훅으로 분리) ---
    useLiveConfigAndLeaderboard({ bootStage, dispatch, mockMode });

    // --- User Data Listener ---
    useEffect(() => {
        if (mockMode) return undefined;
        if (bootStage !== 'data') return undefined;
        // config 부재(db null)면 부트가 'data' 단계에 오지 않는다(오프라인 폴백이 직접 'ready'로 간다).
        // 이전엔 이 경로에서 doc(null, …)이 throw했을 것 — 타입 가드로 명시한다.
        if (!db) return undefined;
        const firestore = db;

        // "uid 없이는 'data' 단계가 성립하지 않는다"는 가드도 전이표가 소유한다
        // (uid가 없으면 step이 비어 있고, 구독/타이머가 시작되지 않는다).
        let bootState = createBootState({ phase: 'config', uid, authResolved: true });
        let bootstrapTimer: ReturnType<typeof setTimeout> | undefined;
        let unsubscribe: (() => void) | null = null;
        let callbackSequence = 0;

        const applyBoot = (event: BootEvent): BootStep => {
            const step = nextBootStep(bootState, event);
            bootState = step.state;
            step.dispatch.forEach((action) => dispatch(action));
            step.effects.forEach((effect) => runBootEffect(effect));
            return step;
        };

        const fallbackToOffline = async (message: string) => {
            const offlineResult = resolveOfflineBootstrapResult(await getOfflineBootstrapData());
            applyBoot({ kind: 'local_record', record: offlineResult, source: 'fallback', message });
        };

        const subscribeUserDoc = (subscribedUid: string) => {
            const userDocRef = doc(firestore, 'artifacts', APP_ID, 'users', subscribedUid);
            return onSnapshot(userDocRef, async (docSnap) => {
                if (docSnap.metadata.hasPendingWrites) return;
                const sequence = ++callbackSequence;
                // 콜백 경쟁(늦게 끝난 이전 콜백)은 여기서, 취소는 전이표(cancelled)가 막는다.
                const isStale = () => bootState.cancelled || sequence !== callbackSequence;

                try {
                    if (docSnap.exists()) {
                        const remoteData = docSnap.data();
                        const localRecord = await getRuntimeGameStorage().load().catch(() => null);
                        if (isStale()) return;
                        const restoreEffect = findRestoreEffect(applyBoot({
                            kind: 'remote_snapshot',
                            doc: {
                                lastActiveMillis: remoteData.lastActive?.toMillis() || null,
                                hasLocalRecord: Boolean(localRecord),
                            },
                            authority: resolveCloudBootstrapAuthority(localRecord, remoteData),
                            lastLoadedMillis: lastLoadedTimestampRef.current || null,
                        }).effects);
                        // 복원 지시가 없으면 내가 올린 저장의 에코다 — 전이표가 부트만 확정한다.
                        if (!restoreEffect) return;
                        if (restoreEffect.kind === 'restoreFromLocalRecord' && localRecord) {
                            const localData = migrateData(localRecord.payload);
                            // 로컬 권한 판정(`resolveCloudBootstrapAuthority`)은 이미 끝났고
                            // 여기서 분기를 바꾸지 않는다. player 없는 스냅샷은 이전에도
                            // 바로 아래 `localData.player.loc`에서 TypeError로 아래 catch →
                            // fallbackToOffline(SYNC_CONNECT_FAIL)로 갔다 — 같은 경로를 유지한다.
                            if (!hasMigratedPlayer(localData)) {
                                throw new Error('A restored local game snapshot requires player data');
                            }
                            if (localData.gameState === 'combat' && !localData.enemy) localData.gameState = 'idle';
                            if (!localData.player.loc) localData.player.loc = CONSTANTS.START_LOCATION;
                            applyBoot({
                                kind: 'restore_prepared',
                                source: 'local-record',
                                data: localData,
                            });
                            return;
                        }

                        let activeData = migrateData(remoteData);
                        if (activeData) {
                            // 원격 문서가 존재하지만 player 필드가 없는 경우(권한 판정 'none' 등)
                            // 이전에도 바로 아래 `activeData.player.loc`에서 TypeError가 나
                            // 아래 catch → fallbackToOffline(SYNC_CONNECT_FAIL)로 갔다.
                            // `if (activeData)` 바깥 분기는 그대로 두고 같은 경로만 유지한다.
                            if (!hasMigratedPlayer(activeData)) {
                                throw new Error('A restored cloud game snapshot requires player data');
                            }
                            if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
                            if (!activeData.player.loc) activeData.player.loc = CONSTANTS.START_LOCATION;

                            const remoteSaveVersion = Number(remoteData.saveSchemaVersion);
                            const remoteRevision = Number(remoteData.saveRevision);
                            const remoteSavedAt = Number(remoteData.savedAt);
                            let localImportFailed = false;
                            if (
                                Number.isSafeInteger(remoteSaveVersion)
                                && remoteSaveVersion >= 0
                                && Number.isSafeInteger(remoteRevision)
                                && remoteRevision > 0
                                && Number.isSafeInteger(remoteSavedAt)
                                && remoteSavedAt >= 0
                            ) {
                                const remoteRecord: GameSaveRecord = {
                                    saveVersion: remoteSaveVersion,
                                    revision: remoteRevision,
                                    savedAt: remoteSavedAt,
                                    payload: activeData,
                                };
                                const importResult = await importCloudRecordAuthority(
                                    getRuntimeGameStorage(),
                                    remoteRecord,
                                );
                                const importedRecord = importResult.record;
                                activeData = migrateData(importedRecord.payload);
                                // importedRecord는 방금 올린 remoteRecord이거나 로컬이 이긴
                                // 기존 레코드다. player 없는 payload는 이전에도 바로 아래
                                // `activeData.player.loc`에서 TypeError → catch → fallback 이었다.
                                if (!hasMigratedPlayer(activeData)) {
                                    throw new Error('A re-imported game snapshot requires player data');
                                }
                                if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
                                if (!activeData.player.loc) activeData.player.loc = CONSTANTS.START_LOCATION;
                                cloudRevisionFloorRef.current = Math.max(
                                    cloudRevisionFloorRef.current,
                                    importedRecord.revision,
                                );
                                cloudRevisionAdvanceRequiredRef.current = true;
                                if (!importResult.localImportFailed) {
                                    pendingCloudRecordRef.current = null;
                                } else {
                                    localImportFailed = true;
                                    pendingCloudRecordRef.current = remoteRecord;
                                    console.warn('Cloud save local import failed', importResult.error);
                                }
                            }
                            if (isStale()) return;

                            // 복원 payload·클라우드 미러 실패·첫 로그 여부를 넣으면 전이표가
                            // LOAD_DATA / SET_SYNC_STATUS / 텔레메트리 / 안내 로그를 결정한다.
                            if (!applyBoot({
                                kind: 'restore_prepared',
                                source: 'remote-doc',
                                data: activeData,
                                localImportFailed,
                                hasBootLog: hasBootLogRef.current,
                            }).restore) return;
                            lastLoadedTimestampRef.current = remoteData.lastActive?.toMillis() || Date.now();
                        }
                    } else {
                        const localResult = await getOfflineBootstrapData();
                        if (isStale()) return;
                        // 원격 문서 부재 — 전이표가 'restoreFromLocal'을 지시하면 방금 읽은
                        // 로컬 부트스트랩 결과로 복원을 승인받는다.
                        if (!findRestoreEffect(applyBoot({
                            kind: 'remote_snapshot',
                            doc: null,
                            authority: null,
                            lastLoadedMillis: lastLoadedTimestampRef.current || null,
                        }).effects)) return;
                        applyBoot({
                            kind: 'local_record',
                            record: localResult,
                            source: 'empty-remote-doc',
                        });
                    }
                } catch (error) {
                    if (isStale()) return;
                    console.warn('User data restore failed', error);
                    applyBoot({ kind: 'restore_failed' });
                }
            }, (e: unknown) => {
                console.warn('User data subscribe failed', e);
                callbackSequence += 1;
                applyBoot({ kind: 'remote_error' });
            });
        };

        const runBootEffect = (effect: BootEffect) => {
            switch (effect.kind) {
                case 'startBootstrapTimer':
                    bootstrapTimer = setTimeout(() => {
                        applyBoot({ kind: 'bootstrap_timeout' });
                    }, BOOTSTRAP_TIMEOUT_MS);
                    break;
                case 'clearTimers':
                    clearTimeout(bootstrapTimer);
                    break;
                case 'subscribeUserDoc':
                    unsubscribe = subscribeUserDoc(effect.uid);
                    break;
                case 'fallbackOffline':
                    void fallbackToOffline(effect.message);
                    break;
                case 'trackRestore':
                    trackPersistenceResult(effect.player, 'restore', effect.outcome, 'restore');
                    break;
                case 'log':
                    // 서버 복원 안내는 부트당 1회 — 원본과 같은 지점에서 ref를 닫는다.
                    if (effect.level === 'system') hasBootLogRef.current = true;
                    dispatch({ type: AT.ADD_LOG, payload: makeLogPayload(effect.level, effect.message) });
                    break;
                default:
                    // 복원 준비(restoreFrom*)는 스냅샷 콜백이 직접 await 하며 실행한다.
                    break;
            }
        };

        // 전이표가 거부하면(uid 없음) 구독도 타이머도 시작되지 않는다.
        if (!applyBoot({ kind: 'data_stage_entered', uid }).effects.length) return undefined;

        return () => {
            applyBoot({ kind: 'cancelled' });
            unsubscribe?.();
        };
    }, [uid, bootStage, dispatch, mockMode]);

    // Cloud sync가 지연되거나 끊겨도 모바일 런이 앱 재실행 한 번으로 사라지지 않도록
    // 동일한 저장 payload를 로컬에 미러링한다. 기존 Firestore 문서가 있으면 원격 데이터가
    // 기준이며, 문서가 아직 없으면 오프라인 런을 최초 cloud snapshot으로 승격한다.
    useEffect(() => {
        const previousPlayerName = previousLocalPlayerNameRef.current;
        previousLocalPlayerNameRef.current = player?.name;
        if (mockMode && !deviceQaMode) return undefined;
        if (!player?.name) {
            if (previousPlayerName) {
                if (deviceQaMode) clearDeviceQaSnapshot(undefined, deviceQaScenario);
                else void getRuntimeGameStorage().remove().catch((error) => {
                    console.warn('Local game clear failed', error);
                });
            }
            return undefined;
        }

        const timer = setTimeout(() => {
            void flushLocalSave();
        }, BALANCE.DEBOUNCE_SAVE_MS);

        return () => clearTimeout(timer);
    }, [
        deviceQaMode,
        deviceQaScenario,
        flushLocalSave,
        mockMode,
        player?.name,
    ]);

    // --- Auto Save (Debounced) ---
    // 본문은 createCloudAutosave 로 분리 — Firestore 의존성을 주입받아 훅 없이 테스트된다.
    useEffect(() => {
        if (mockMode) return undefined;
        if (syncStatus !== 'syncing' || !uid) return;
        if (!db) return; // config 부재면 syncStatus가 'syncing'이 되지 않는다 — 타입 가드

        const flushCloudSave = createCloudAutosave({
            db,
            doc,
            setDoc,
            serverTimestamp,
            loadLocalRecord: () => getRuntimeGameStorage().load().catch(() => null),
            dispatch,
            refs: {
                localSavePromise: localSavePromiseRef,
                pendingCloudRecord: pendingCloudRecordRef,
                cloudRevisionFloor: cloudRevisionFloorRef,
                cloudRevisionAdvanceRequired: cloudRevisionAdvanceRequiredRef,
            },
        });

        const timer = setTimeout(() => {
            void flushCloudSave({ uid, player, gameState, enemy, grave, currentEvent, quickSlots });
        }, BALANCE.DEBOUNCE_SAVE_MS);
        return () => clearTimeout(timer);
    }, [player, gameState, enemy, grave, currentEvent, quickSlots, syncStatus, uid, dispatch, mockMode]);

    // Update boot log ref
    useEffect(() => {
        hasBootLogRef.current = state.logs.length > 0;
    }, [state.logs]);

    // --- Public Grave Upload on Death ---
    useEffect(() => {
        if (!PRODUCTION_GAME_CAPABILITIES.publicGraveInvasion) return;
        if (mockMode || !uid || !hasFirebaseConfig || !db) return;
        if (gameState !== 'dead') return;
        const graveEntries = normalizeGraves(grave);
        const allItems = graveEntries.flatMap((g) => getGraveItems(g)).slice(0, 3);
        const totalGold = graveEntries.reduce((sum, g) => sum + (g?.gold || 0), 0);
        const graveDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'graves', uid);
        setDoc(graveDocRef, {
            playerName: player.name || '무명 용사',
            level: player.level || 1,
            loc: player.loc || '알 수 없는 곳',
            items: allItems,
            gold: totalGold,
            guardPower: player.atk || 10,
            createdAt: serverTimestamp(),
            uid,
        }).catch((e: unknown) => console.warn('Public grave upload failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState, uid]);

    return { flushLocalSave };
};
