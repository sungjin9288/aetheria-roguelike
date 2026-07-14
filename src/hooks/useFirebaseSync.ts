import { useEffect, useRef } from 'react';
import {
    onSnapshot,
    doc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    setDoc,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

import { auth, db, hasFirebaseConfig } from '../firebase';
import { CONSTANTS, APP_ID, BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { migrateData } from '../utils/gameUtils';
import { normalizeGraves, getGraveItems } from '../utils/graveUtils';
import { isMockRuntime } from '../utils/runtimeMode';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import { clearLocalGameSnapshot, readLocalGameSnapshot, writeLocalGameSnapshot } from '../utils/localGameSnapshot';

const BOOTSTRAP_TIMEOUT_MS = 6000;
const AUTH_TIMEOUT_MS = 8000;
const makeLogPayload = (type: any, text: any) => ({ type, text, id: `${Date.now()}_${Math.random()}` });

const getOfflineBootstrapData = () => {
    const localSnapshot = readLocalGameSnapshot();
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
    const smokeMode = isMockRuntime();
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

    useEffect(() => {
        if (!smokeMode || syncStatus === 'offline') return;
        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
    }, [dispatch, smokeMode, syncStatus]);

    // --- Auth ---
    useEffect(() => {
        if (smokeMode) {
            dispatch({ type: AT.LOAD_DATA, payload: { player: INITIAL_STATE.player } });
            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            return undefined;
        }

        dispatch({ type: AT.SET_BOOT_STAGE, payload: 'auth' });
        let authResolved = false;

        const fallbackAuthOffline = (message: any) => {
            if (authResolved) return;
            authResolved = true;
            dispatch({ type: AT.LOAD_DATA, payload: getOfflineBootstrapData() });
            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            dispatch({ type: AT.ADD_LOG, payload: makeLogPayload('warning', message) });
        };

        const authTimer = setTimeout(() => {
            fallbackAuthOffline(MSG.SYNC_AUTH_TIMEOUT);
        }, AUTH_TIMEOUT_MS);

        if (!hasFirebaseConfig) {
            console.warn('[FIREBASE] Missing required config. Booting in offline mode.');
            clearTimeout(authTimer);
            fallbackAuthOffline(MSG.SYNC_NO_CONFIG);
            return () => clearTimeout(authTimer);
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
                fallbackAuthOffline(MSG.SYNC_AUTH_FAIL);
            });
        return () => clearTimeout(authTimer);
    }, [dispatch, smokeMode]);

    useEffect(() => {
        lastLoadedTimestampRef.current = state.lastLoadedTimestamp;
    }, [state.lastLoadedTimestamp]);

    // --- Config & Leaderboard ---
    useEffect(() => {
        if (smokeMode) return undefined;
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
    }, [bootStage, dispatch, smokeMode]);

    // --- User Data Listener ---
    useEffect(() => {
        if (smokeMode) return undefined;
        if (bootStage !== 'data' || !uid) return;

        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        let bootResolved = false;

        const fallbackToOffline = (message: any) => {
            if (bootResolved) return;
            bootResolved = true;
            dispatch({ type: AT.LOAD_DATA, payload: getOfflineBootstrapData() });
            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            dispatch({ type: AT.ADD_LOG, payload: makeLogPayload('warning', message) });
        };

        const bootstrapTimer = setTimeout(() => {
            fallbackToOffline(MSG.SYNC_TIMEOUT);
        }, BOOTSTRAP_TIMEOUT_MS);

        const unsubscribe = onSnapshot(userDocRef, (docSnap: any) => {
            if (docSnap.metadata.hasPendingWrites) return;

            bootResolved = true;
            clearTimeout(bootstrapTimer);

            if (docSnap.exists()) {
                const remoteData = docSnap.data();
                if (lastLoadedTimestampRef.current && remoteData.lastActive?.toMillis() === lastLoadedTimestampRef.current) {
                    return;
                }

                const activeData = migrateData(remoteData);
                if (activeData) {
                    if (activeData.gameState === 'combat' && !activeData.enemy) activeData.gameState = 'idle';
                    if (!activeData.player.loc) activeData.player.loc = CONSTANTS.START_LOCATION;

                    dispatch({ type: AT.LOAD_DATA, payload: activeData });
                    lastLoadedTimestampRef.current = remoteData.lastActive?.toMillis() || Date.now();
                    if (!hasBootLogRef.current) {
                        hasBootLogRef.current = true;
                        dispatch({ type: AT.ADD_LOG, payload: makeLogPayload('system', MSG.SYNC_SERVER_LOADED) });
                    }
                }
            } else {
                const localData = getOfflineBootstrapData();
                dispatch({ type: AT.LOAD_DATA, payload: localData });
                if (localData.player?.name) {
                    dispatch({ type: AT.SET_SYNC_STATUS, payload: 'syncing' });
                }
            }
        }, (e: any) => {
            console.warn('User data subscribe failed', e);
            clearTimeout(bootstrapTimer);
            fallbackToOffline(MSG.SYNC_CONNECT_FAIL);
        });

        return () => {
            clearTimeout(bootstrapTimer);
            unsubscribe();
        };
    }, [uid, bootStage, dispatch, smokeMode]);

    // Cloud sync가 지연되거나 끊겨도 모바일 런이 앱 재실행 한 번으로 사라지지 않도록
    // 동일한 저장 payload를 로컬에 미러링한다. 기존 Firestore 문서가 있으면 원격 데이터가
    // 기준이며, 문서가 아직 없으면 오프라인 런을 최초 cloud snapshot으로 승격한다.
    useEffect(() => {
        const previousPlayerName = previousLocalPlayerNameRef.current;
        previousLocalPlayerNameRef.current = player?.name;
        if (smokeMode) return undefined;
        if (!player?.name) {
            if (previousPlayerName) clearLocalGameSnapshot();
            return undefined;
        }

        const timer = setTimeout(() => {
            const savedAt = Date.now();
            writeLocalGameSnapshot({
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
            });
        }, BALANCE.DEBOUNCE_SAVE_MS);

        return () => clearTimeout(timer);
    }, [player, gameState, enemy, grave, currentEvent, quickSlots, smokeMode]);

    // --- Auto Save (Debounced) ---
    useEffect(() => {
        if (smokeMode) return undefined;
        if (syncStatus !== 'syncing' || !uid) return;

        const saveData = async () => {
            try {
                const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
                // 복귀 브리핑 카드(returnBriefing.ts)가 클라이언트 ms 타임스탬프로 경과 시간을
                // 계산하므로, Firestore serverTimestamp()(lastActive)와 별도로 player.stats에
                // 저장 시각을 기록한다. 매 autosave마다 갱신 — 플레이 중에는 계속 최신화되고,
                // 세션 종료 후에는 마지막 저장 시각에 고정된다.
                const playerPayload = {
                    ...player,
                    archivedHistory: [],
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
                    lastActive: serverTimestamp()
                };

                if (player.archivedHistory && player.archivedHistory.length > 0) {
                    const historyCol = collection(userDocRef, 'history');
                    await Promise.all(player.archivedHistory.map((h: any) => addDoc(historyCol, h)));
                }

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
    }, [player, gameState, enemy, grave, currentEvent, quickSlots, syncStatus, uid, dispatch, smokeMode]);

    // Update boot log ref
    useEffect(() => {
        hasBootLogRef.current = state.logs.length > 0;
    }, [state.logs]);

    // --- Public Grave Upload on Death ---
    useEffect(() => {
        if (smokeMode || !uid || !hasFirebaseConfig) return;
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
};
