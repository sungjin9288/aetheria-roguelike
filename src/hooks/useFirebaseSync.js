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
import { migrateData } from '../utils/gameUtils';
import { normalizeGraves, getGraveItems } from '../utils/graveUtils';
import { isSmokeRuntime } from '../utils/runtimeMode';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';

const BOOTSTRAP_TIMEOUT_MS = 6000;
const AUTH_TIMEOUT_MS = 8000;
const makeLogPayload = (type, text) => ({ type, text, id: `${Date.now()}_${Math.random()}` });

/**
 * useFirebaseSync — Firebase 인증, 실시간 동기화, 리더보드, 자동 저장
 */
export const useFirebaseSync = (state, dispatch) => {
    const smokeMode = isSmokeRuntime();
    const {
        player,
        gameState,
        enemy,
        grave,
        currentEvent,
        quickSlots,
        onboardingDismissed,
        syncStatus,
        uid,
        bootStage
    } = state;

    const lastLoadedTimestampRef = useRef(state.lastLoadedTimestamp);
    const hasBootLogRef = useRef(state.logs.length > 0);

    useEffect(() => {
        if (!smokeMode || syncStatus === 'offline') return;
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
    }, [dispatch, smokeMode, syncStatus]);

    // --- Auth ---
    useEffect(() => {
        if (smokeMode) {
            dispatch({ type: 'LOAD_DATA', payload: { player: INITIAL_STATE.player } });
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
            return undefined;
        }

        dispatch({ type: 'SET_BOOT_STAGE', payload: 'auth' });
        let authResolved = false;

        const fallbackAuthOffline = (message) => {
            if (authResolved) return;
            authResolved = true;
            dispatch({ type: 'LOAD_DATA', payload: { player: INITIAL_STATE.player } });
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
            dispatch({ type: 'ADD_LOG', payload: makeLogPayload('warning', message) });
        };

        const authTimer = setTimeout(() => {
            fallbackAuthOffline('인증 지연으로 오프라인 모드로 시작했습니다.');
        }, AUTH_TIMEOUT_MS);

        if (!hasFirebaseConfig) {
            console.warn('[FIREBASE] Missing required config. Booting in offline mode.');
            clearTimeout(authTimer);
            fallbackAuthOffline('클라우드 설정을 찾을 수 없어 오프라인 모드로 시작했습니다.');
            return () => clearTimeout(authTimer);
        }

        signInAnonymously(auth)
            .then((cred) => {
                if (authResolved) return;
                authResolved = true;
                clearTimeout(authTimer);
                const uid = cred.user.uid;
                dispatch({ type: 'SET_UID', payload: uid });
                dispatch({ type: 'SET_BOOT_STAGE', payload: 'config' });
                // 크로스 디바이스 쿼터 동기화 (Dead Code → 활성화)
                TokenQuotaManager.syncToFirestore(uid, db).catch((e) => {
                    console.warn('Token quota sync failed', e);
                });
            })
            .catch((e) => {
                console.error('Auth Failed', e);
                clearTimeout(authTimer);
                fallbackAuthOffline('클라우드 인증 실패로 오프라인 모드로 시작했습니다.');
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
        const unsubConfig = onSnapshot(configDocRef, (snap) => {
            if (snap.exists() && snap.data().config) {
                dispatch({ type: 'SET_LIVE_CONFIG', payload: snap.data().config });
            }
        }, (e) => {
            console.warn('Live config subscribe failed', e);
        });

        const fetchLeaderboard = async () => {
            try {
                const lbRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');
                const q = query(lbRef, orderBy('totalKills', 'desc'), limit(50));
                const snap = await getDocs(q);
                const data = [];
                snap.forEach((d) => data.push(d.data()));
                dispatch({ type: 'SET_LEADERBOARD', payload: data });
            } catch (e) {
                console.warn('Leaderboard fetch failed', e);
            }
        };

        fetchLeaderboard();
        dispatch({ type: 'SET_BOOT_STAGE', payload: 'data' });
        return () => unsubConfig();
    }, [bootStage, dispatch, smokeMode]);

    // --- User Data Listener ---
    useEffect(() => {
        if (smokeMode) return undefined;
        if (bootStage !== 'data' || !uid) return;

        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        let bootResolved = false;

        const fallbackToOffline = (message) => {
            if (bootResolved) return;
            bootResolved = true;
            dispatch({ type: 'LOAD_DATA', payload: { player: INITIAL_STATE.player } });
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
            dispatch({ type: 'ADD_LOG', payload: makeLogPayload('warning', message) });
        };

        const bootstrapTimer = setTimeout(() => {
            fallbackToOffline('클라우드 응답 지연으로 오프라인 모드로 시작했습니다.');
        }, BOOTSTRAP_TIMEOUT_MS);

        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
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
                    if (!activeData.player.loc) activeData.player.loc = '시작의 마을';

                    dispatch({ type: 'LOAD_DATA', payload: activeData });
                    lastLoadedTimestampRef.current = remoteData.lastActive?.toMillis() || Date.now();
                    if (!hasBootLogRef.current) {
                        hasBootLogRef.current = true;
                        dispatch({ type: 'ADD_LOG', payload: makeLogPayload('system', '서버 데이터와 동기화되었습니다.') });
                    }
                }
            } else {
                dispatch({ type: 'LOAD_DATA', payload: { player: INITIAL_STATE.player } });
            }
        }, (e) => {
            console.warn('User data subscribe failed', e);
            clearTimeout(bootstrapTimer);
            fallbackToOffline('클라우드 연결 실패로 오프라인 모드로 시작했습니다.');
        });

        return () => {
            clearTimeout(bootstrapTimer);
            unsubscribe();
        };
    }, [uid, bootStage, dispatch, smokeMode]);

    // --- Auto Save (Debounced) ---
    useEffect(() => {
        if (smokeMode) return undefined;
        if (syncStatus !== 'syncing' || !uid) return;

        const saveData = async () => {
            try {
                const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
                const playerPayload = { ...player, archivedHistory: [] };
                const payload = {
                    player: playerPayload,
                    gameState,
                    enemy,
                    grave,
                    currentEvent,
                    quickSlots,
                    onboardingDismissed,
                    version: CONSTANTS.DATA_VERSION,
                    lastActive: serverTimestamp()
                };

                if (player.archivedHistory && player.archivedHistory.length > 0) {
                    const historyCol = collection(userDocRef, 'history');
                    await Promise.all(player.archivedHistory.map((h) => addDoc(historyCol, h)));
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
                        job:          player.job || '모험가',
                        uid,
                        updatedAt:    serverTimestamp(),
                    }, { merge: true });
                }

                dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
            } catch (e) {
                console.error('Save Failed', e);
                dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
            }
        };

        const timer = setTimeout(saveData, BALANCE.DEBOUNCE_SAVE_MS);
        return () => clearTimeout(timer);
    }, [player, gameState, enemy, grave, currentEvent, quickSlots, onboardingDismissed, syncStatus, uid, dispatch, smokeMode]);

    // Update boot log ref
    useEffect(() => {
        hasBootLogRef.current = state.logs.length > 0;
    }, [state.logs]);

    // --- Public Grave Upload on Death ---
    useEffect(() => {
        if (smokeMode || !uid || !hasFirebaseConfig) return;
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
        }).catch((e) => console.warn('Public grave upload failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState, uid]);
};
