import { useEffect } from 'react';
import {
    onSnapshot,
    doc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
} from 'firebase/firestore';

import { db } from '../firebase';
import { APP_ID } from '../data/constants';
import { AT } from '../reducers/actionTypes';
import type { Dispatch } from 'react';
import type { GameAction, GameState } from '../reducers/gameReducer';

const LEADERBOARD_PAGE_SIZE = 50;

interface UseLiveConfigAndLeaderboardOptions {
    bootStage: GameState['bootStage'];
    dispatch: Dispatch<GameAction>;
    mockMode: boolean;
}

/**
 * useLiveConfigAndLeaderboard — 세이브/로드와 무관한 공용(public) 문서 구독.
 *
 * `bootStage === 'config'` 구간에서만 동작한다:
 *  1. `artifacts/{APP_ID}/public/data` 의 live config 실시간 구독
 *  2. 리더보드 상위 50건 1회 fetch
 *  3. 두 작업을 시작한 뒤 boot stage 를 'data' 로 전진 (유저 데이터 리스너 차례)
 *
 * useFirebaseSync 에서 분리됐다. 클라우드 세이브 경로와 공유하는 ref/상태가 없어
 * 입력은 bootStage/dispatch/mockMode 뿐이고 반환값도 없다(부수효과는 dispatch 전용).
 */
export const useLiveConfigAndLeaderboard = ({
    bootStage,
    dispatch,
    mockMode,
}: UseLiveConfigAndLeaderboardOptions) => {
    useEffect(() => {
        if (mockMode) return undefined;
        if (bootStage !== 'config') return;
        // 'config' 단계는 온라인 인증 경로에서만 도달한다(useFirebaseSync) — db는 그때 non-null. 타입 가드.
        if (!db) return;
        const firestore = db;

        const configDocRef = doc(firestore, 'artifacts', APP_ID, 'public', 'data');
        const unsubConfig = onSnapshot(configDocRef, (snap) => {
            if (snap.exists() && snap.data().config) {
                dispatch({ type: AT.SET_LIVE_CONFIG, payload: snap.data().config });
            }
        }, (e: unknown) => {
            console.warn('Live config subscribe failed', e);
        });

        const fetchLeaderboard = async () => {
            try {
                const lbRef = collection(firestore, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');
                const q = query(lbRef, orderBy('totalKills', 'desc'), limit(LEADERBOARD_PAGE_SIZE));
                const snap = await getDocs(q);
                const data = snap.docs.map((d) => d.data());
                dispatch({ type: AT.SET_LEADERBOARD, payload: data });
            } catch (e) {
                console.warn('Leaderboard fetch failed', e);
            }
        };

        fetchLeaderboard();
        dispatch({ type: AT.SET_BOOT_STAGE, payload: 'data' });
        return () => unsubConfig();
    }, [bootStage, dispatch, mockMode]);
};
