import { useEffect } from 'react';
import { db, hasFirebaseConfig } from '../firebase';
import { BALANCE } from '../data/constants';
import { isMockRuntime } from '../utils/runtimeMode';
import { PRODUCTION_GAME_CAPABILITIES } from '../platform/gameCapabilities';
import { setDimensionGravePool } from '../platform/dimensionGravePool';
import { readDimensionGravePool } from '../platform/publicGraveFirestore';

/**
 * 다른 차원의 묘비 풀(Wave 70)을 채운다 — 로그인된 온라인 세션에서 최근 공개 묘비를 읽어 모듈 상태에 둔다.
 * 읽기만 한다(rules `graves`: 인증된 유저 읽기). mock 런타임 · Firebase 설정 없음 · 로그인 전에는 아무것도 하지 않으므로
 * 풀은 비어 있고 탐험은 이 기능의 난수를 쓰지 않는다. 실패는 게임으로 전파하지 않는다(풀이 그대로 남는다).
 */
export const useDimensionGravePool = (uid: string | null | undefined) => {
    useEffect(() => {
        if (!PRODUCTION_GAME_CAPABILITIES.dimensionGraveEvent) return undefined;
        if (isMockRuntime() || !uid || !hasFirebaseConfig || !db) return undefined;
        const firestore = db;
        let cancelled = false;
        const load = async () => {
            try {
                const entries = await readDimensionGravePool(firestore, uid);
                if (!cancelled) setDimensionGravePool(entries);
            } catch (error) {
                console.warn('Dimension grave fetch failed', error);
            }
        };
        void load();
        const timer = setInterval(() => { void load(); }, BALANCE.DIMENSION_GRAVE_REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [uid]);
};
