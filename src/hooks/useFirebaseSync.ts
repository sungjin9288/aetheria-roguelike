import { useCallback, useEffect, useRef } from 'react';
import {
    onSnapshot,
    doc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    setDoc,
    serverTimestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import { auth, db, hasFirebaseConfig } from '../firebase';
import { CONSTANTS, APP_ID, BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { migrateData } from '../utils/gameUtils';
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
import { resolveOfflineBootstrapResult } from '../platform/persistenceTelemetry';
import { PRODUCTION_GAME_CAPABILITIES } from '../platform/gameCapabilities';
import {
    resolveCloudBootstrapAuthority,
    type GameSaveRecord,
} from '../platform/gameStorage';

const BOOTSTRAP_TIMEOUT_MS = 6000;
const AUTH_TIMEOUT_MS = 8000;
const makeLogPayload = (type: any, text: any) => ({ type, text, id: `${Date.now()}_${Math.random()}` });

const trackPersistenceResult = (
    player: any,
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

const getOfflineBootstrapData = async () => {
    try {
        const localRecord = await getRuntimeGameStorage().migrate((payload) => payload);
        if (!localRecord) return {
            data: { player: INITIAL_STATE.player },
            outcome: 'fresh' as const,
        };

        const activeData = migrateData(localRecord.payload);
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

const getDeviceQaBootstrapData = (scenario: string | null) => {
    const localSnapshot = readDeviceQaSnapshot(undefined, scenario);
    if (!localSnapshot) return { player: INITIAL_STATE.player };

    const activeData = migrateData(localSnapshot);
    if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
    if (!activeData.player.loc) activeData.player.loc = CONSTANTS.START_LOCATION;
    return activeData;
};

/**
 * useFirebaseSync — Firebase 인증, 실시간 동기화, 리더보드, 자동 저장
 */
export const useFirebaseSync = (state: any, dispatch: any) => {
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
    useEffect(() => {
        if (mockMode) {
            const deviceQaData = deviceQaMode
                ? getDeviceQaBootstrapData(deviceQaScenario)
                : { player: INITIAL_STATE.player };
            dispatch({
                type: AT.LOAD_DATA,
                payload: deviceQaData,
            });
            trackPersistenceResult(
                deviceQaData.player,
                'restore',
                deviceQaMode && String(deviceQaData.player?.name || '').trim() ? 'local' : 'fresh',
                'restore',
            );
            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            return undefined;
        }

        dispatch({ type: AT.SET_BOOT_STAGE, payload: 'auth' });
        let authResolved = false;
        let cancelled = false;

        const fallbackAuthOffline = async (message: any) => {
            if (authResolved) return;
            authResolved = true;
            const offlineResult = resolveOfflineBootstrapResult(await getOfflineBootstrapData());
            if (cancelled) return;
            dispatch({ type: AT.LOAD_DATA, payload: offlineResult.data });
            trackPersistenceResult(
                offlineResult.data.player,
                'restore',
                offlineResult.outcome,
                'restore',
            );
            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            dispatch({ type: AT.ADD_LOG, payload: makeLogPayload('warning', message) });
        };

        const authTimer = setTimeout(() => {
            void fallbackAuthOffline(MSG.SYNC_AUTH_TIMEOUT);
        }, AUTH_TIMEOUT_MS);

        if (!hasFirebaseConfig) {
            console.warn('[FIREBASE] Missing required config. Booting in offline mode.');
            clearTimeout(authTimer);
            void fallbackAuthOffline(MSG.SYNC_NO_CONFIG);
            return () => {
                cancelled = true;
                clearTimeout(authTimer);
            };
        }

        signInAnonymously(auth)
            .then((cred: any) => {
                if (authResolved) return;
                authResolved = true;
                clearTimeout(authTimer);
                const uid = cred.user.uid;
                dispatch({ type: AT.SET_UID, payload: uid });
                dispatch({ type: AT.SET_BOOT_STAGE, payload: 'config' });
                // 크로스 디바이스 쿼터 동기화 (Dead Code → 활성화)
                TokenQuotaManager.syncToFirestore(uid, db).catch((e: any) => {
                    console.warn('Token quota sync failed', e);
                });
            })
            .catch((e: any) => {
                console.error('Auth Failed', e);
                clearTimeout(authTimer);
                void fallbackAuthOffline(MSG.SYNC_AUTH_FAIL);
            });
        return () => {
            cancelled = true;
            clearTimeout(authTimer);
        };
    }, [deviceQaMode, deviceQaScenario, dispatch, mockMode]);

    useEffect(() => {
        lastLoadedTimestampRef.current = state.lastLoadedTimestamp;
    }, [state.lastLoadedTimestamp]);

    // --- Config & Leaderboard ---
    useEffect(() => {
        if (mockMode) return undefined;
        if (bootStage !== 'config') return;

        const configDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
        const unsubConfig = onSnapshot(configDocRef, (snap: any) => {
            if (snap.exists() && snap.data().config) {
                dispatch({ type: AT.SET_LIVE_CONFIG, payload: snap.data().config });
            }
        }, (e: any) => {
            console.warn('Live config subscribe failed', e);
        });

        const fetchLeaderboard = async () => {
            try {
                const lbRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');
                const q = query(lbRef, orderBy('totalKills', 'desc'), limit(50));
                const snap = await getDocs(q);
                const data = snap.docs.map((d: any) => d.data());
                dispatch({ type: AT.SET_LEADERBOARD, payload: data });
            } catch (e) {
                console.warn('Leaderboard fetch failed', e);
            }
        };

        fetchLeaderboard();
        dispatch({ type: AT.SET_BOOT_STAGE, payload: 'data' });
        return () => unsubConfig();
    }, [bootStage, dispatch, mockMode]);

    // --- User Data Listener ---
    useEffect(() => {
        if (mockMode) return undefined;
        if (bootStage !== 'data' || !uid) return;

        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        let bootResolved = false;
        let cancelled = false;
        let callbackSequence = 0;

        const fallbackToOffline = async (message: any) => {
            if (bootResolved) return;
            bootResolved = true;
            const offlineResult = resolveOfflineBootstrapResult(await getOfflineBootstrapData());
            if (cancelled) return;
            dispatch({ type: AT.LOAD_DATA, payload: offlineResult.data });
            trackPersistenceResult(
                offlineResult.data.player,
                'restore',
                offlineResult.outcome,
                'restore',
            );
            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            dispatch({ type: AT.ADD_LOG, payload: makeLogPayload('warning', message) });
        };

        const bootstrapTimer = setTimeout(() => {
            void fallbackToOffline(MSG.SYNC_TIMEOUT);
        }, BOOTSTRAP_TIMEOUT_MS);

        const unsubscribe = onSnapshot(userDocRef, async (docSnap: any) => {
            if (docSnap.metadata.hasPendingWrites) return;
            const sequence = ++callbackSequence;

            try {
                if (docSnap.exists()) {
                    const remoteData = docSnap.data();
                    const localRecord = await getRuntimeGameStorage().load().catch(() => null);
                    if (cancelled || sequence !== callbackSequence) return;
                    if (resolveCloudBootstrapAuthority(localRecord, remoteData) === 'local' && localRecord) {
                        const localData = migrateData(localRecord.payload);
                        if (localData.gameState === 'combat' && !localData.enemy) localData.gameState = 'idle';
                        if (!localData.player.loc) localData.player.loc = CONSTANTS.START_LOCATION;
                        bootResolved = true;
                        clearTimeout(bootstrapTimer);
                        dispatch({ type: AT.LOAD_DATA, payload: localData });
                        trackPersistenceResult(localData.player, 'restore', 'local', 'restore');
                        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'syncing' });
                        return;
                    }
                    if (lastLoadedTimestampRef.current && remoteData.lastActive?.toMillis() === lastLoadedTimestampRef.current) {
                        bootResolved = true;
                        clearTimeout(bootstrapTimer);
                        return;
                    }

                    let activeData = migrateData(remoteData);
                    if (activeData) {
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
                        if (cancelled || sequence !== callbackSequence) return;

                        bootResolved = true;
                        clearTimeout(bootstrapTimer);
                        dispatch({ type: AT.LOAD_DATA, payload: activeData });
                        trackPersistenceResult(activeData.player, 'restore', 'cloud', 'restore');
                        if (localImportFailed) {
                            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
                            dispatch({
                                type: AT.ADD_LOG,
                                payload: makeLogPayload('warning', MSG.SYNC_CONNECT_FAIL),
                            });
                        }
                        lastLoadedTimestampRef.current = remoteData.lastActive?.toMillis() || Date.now();
                        if (!hasBootLogRef.current) {
                            hasBootLogRef.current = true;
                            dispatch({ type: AT.ADD_LOG, payload: makeLogPayload('system', MSG.SYNC_SERVER_LOADED) });
                        }
                    }
                } else {
                    const localResult = await getOfflineBootstrapData();
                    if (cancelled || sequence !== callbackSequence) return;
                    bootResolved = true;
                    clearTimeout(bootstrapTimer);
                    dispatch({ type: AT.LOAD_DATA, payload: localResult.data });
                    trackPersistenceResult(
                        localResult.data.player,
                        'restore',
                        localResult.outcome,
                        'restore',
                    );
                    if (localResult.data.player?.name) {
                        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'syncing' });
                    }
                }
            } catch (error) {
                if (cancelled || sequence !== callbackSequence) return;
                console.warn('User data restore failed', error);
                clearTimeout(bootstrapTimer);
                await fallbackToOffline(MSG.SYNC_CONNECT_FAIL);
            }
        }, (e: any) => {
            console.warn('User data subscribe failed', e);
            callbackSequence += 1;
            clearTimeout(bootstrapTimer);
            void fallbackToOffline(MSG.SYNC_CONNECT_FAIL);
        });

        return () => {
            cancelled = true;
            clearTimeout(bootstrapTimer);
            unsubscribe();
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
    useEffect(() => {
        if (mockMode) return undefined;
        if (syncStatus !== 'syncing' || !uid) return;

        const saveData = async () => {
            try {
                const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
                const localRecord = (await localSavePromiseRef.current)
                    ?? await getRuntimeGameStorage().load().catch(() => null);
                if (
                    !localRecord
                    || pendingCloudRecordRef.current
                    || localRecord.revision < cloudRevisionFloorRef.current
                    || (
                        cloudRevisionAdvanceRequiredRef.current
                        && localRecord.revision <= cloudRevisionFloorRef.current
                    )
                ) {
                    dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
                    return;
                }
                // 복귀 브리핑 카드(returnBriefing.ts)가 클라이언트 ms 타임스탬프로 경과 시간을
                // 계산하므로, Firestore serverTimestamp()(lastActive)와 별도로 player.stats에
                // 저장 시각을 기록한다. 매 autosave마다 갱신 — 플레이 중에는 계속 최신화되고,
                // 세션 종료 후에는 마지막 저장 시각에 고정된다.
                const playerPayload = {
                    ...player,
                    stats: { ...player.stats, lastSeenAt: Date.now() },
                };
                const payload: Record<string, any> = {
                    player: playerPayload,
                    gameState,
                    enemy,
                    grave,
                    currentEvent,
                    quickSlots,
                    version: CONSTANTS.DATA_VERSION,
                    saveSchemaVersion: localRecord?.saveVersion ?? 1,
                    saveRevision: localRecord?.revision ?? 0,
                    savedAt: localRecord?.savedAt ?? Date.now(),
                    lastActive: serverTimestamp()
                };

                await setDoc(userDocRef, payload, { merge: true });

                // v5.0: 리더보드 entry 업데이트 (kills > 0 일 때만)
                if (player.name && (player.stats?.kills || 0) > 0) {
                    const lbDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', uid);
                    await setDoc(lbDocRef, {
                        nickname:     player.name,
                        totalKills:   player.stats?.kills || 0,
                        prestigeRank: player.meta?.prestigeRank || 0,
                        activeTitle:  player.activeTitle || null,
                        level:        player.level || 1,
                        bossKills:    player.stats?.bossKills || 0,
                        job:          player.job || CONSTANTS.DEFAULT_JOB,
                        uid,
                        updatedAt:    serverTimestamp(),
                    }, { merge: true });
                }

                dispatch({ type: AT.SET_SYNC_STATUS, payload: 'synced' });
            } catch (e) {
                console.error('Save Failed', e);
                dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            }
        };

        const timer = setTimeout(saveData, BALANCE.DEBOUNCE_SAVE_MS);
        return () => clearTimeout(timer);
    }, [player, gameState, enemy, grave, currentEvent, quickSlots, syncStatus, uid, dispatch, mockMode]);

    // Update boot log ref
    useEffect(() => {
        hasBootLogRef.current = state.logs.length > 0;
    }, [state.logs]);

    // --- Public Grave Upload on Death ---
    useEffect(() => {
        if (!PRODUCTION_GAME_CAPABILITIES.publicGraveInvasion) return;
        if (mockMode || !uid || !hasFirebaseConfig) return;
        if (gameState !== 'dead') return;
        const graveEntries = normalizeGraves(grave);
        const allItems = graveEntries.flatMap((g: any) => getGraveItems(g)).slice(0, 3);
        const totalGold = graveEntries.reduce((sum: any, g: any) => sum + (g?.gold || 0), 0);
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
        }).catch((e: any) => console.warn('Public grave upload failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState, uid]);

    return { flushLocalSave };
};
