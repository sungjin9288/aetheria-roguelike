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

import { auth, db } from '../firebase';
import { CONSTANTS, APP_ID, BALANCE } from '../data/constants';
import { migrateData } from '../utils/gameUtils';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';

/**
 * useFirebaseSync — Firebase 인증, 실시간 동기화, 리더보드, 자동 저장
 */
export const useFirebaseSync = (state, dispatch) => {
    const {
        player,
        gameState,
        enemy,
        grave,
        currentEvent,
        syncStatus,
        uid,
        bootStage
    } = state;

    const lastLoadedTimestampRef = useRef(state.lastLoadedTimestamp);
    const hasBootLogRef = useRef(state.logs.length > 0);

    // --- Auth ---
    useEffect(() => {
        dispatch({ type: 'SET_BOOT_STAGE', payload: 'auth' });
        signInAnonymously(auth)
            .then((cred) => {
                const uid = cred.user.uid;
                dispatch({ type: 'SET_UID', payload: uid });
                dispatch({ type: 'SET_BOOT_STAGE', payload: 'config' });
                // 크로스 디바이스 쿼터 동기화 (Dead Code → 활성화)
                TokenQuotaManager.syncToFirestore(uid, db);
            })
            .catch((e) => {
                console.error('Auth Failed', e);
            });
    }, [dispatch]);

    useEffect(() => {
        lastLoadedTimestampRef.current = state.lastLoadedTimestamp;
    }, [state.lastLoadedTimestamp]);

    // --- Config & Leaderboard ---
    useEffect(() => {
        if (bootStage !== 'config') return;

        const configDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
        const unsubConfig = onSnapshot(configDocRef, (snap) => {
            if (snap.exists() && snap.data().config) {
                dispatch({ type: 'SET_LIVE_CONFIG', payload: snap.data().config });
            }
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
    }, [bootStage, dispatch]);

    // --- User Data Listener ---
    useEffect(() => {
        if (bootStage !== 'data' || !uid) return;

        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites) return;

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
                        dispatch({ type: 'ADD_LOG', payload: { type: 'system', text: '서버 데이터와 동기화되었습니다.' } });
                    }
                }
            } else {
                dispatch({ type: 'LOAD_DATA', payload: { player: INITIAL_STATE.player } });
            }
        });

        return () => unsubscribe();
    }, [uid, bootStage, dispatch]);

    // --- Auto Save (Debounced) ---
    useEffect(() => {
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
                    version: CONSTANTS.DATA_VERSION,
                    lastActive: serverTimestamp()
                };

                if (player.archivedHistory && player.archivedHistory.length > 0) {
                    const historyCol = collection(userDocRef, 'history');
                    await Promise.all(player.archivedHistory.map((h) => addDoc(historyCol, h)));
                }

                await setDoc(userDocRef, payload, { merge: true });
                dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
            } catch (e) {
                console.error('Save Failed', e);
                dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
            }
        };

        const timer = setTimeout(saveData, BALANCE.DEBOUNCE_SAVE_MS);
        return () => clearTimeout(timer);
    }, [player, gameState, enemy, grave, currentEvent, syncStatus, uid, dispatch]);

    // Update boot log ref
    useEffect(() => {
        hasBootLogRef.current = state.logs.length > 0;
    }, [state.logs]);
};
