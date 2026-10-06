import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    type DocumentData,
    type Firestore,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { APP_ID, BALANCE } from '../data/constants';
import { excludeOwnGraves, type GraveEntry } from '../utils/graveUtils';
import type { PublicGraveDoc } from '../utils/publicGraveDoc';

/**
 * 공개 묘비 문서의 Firestore 입출력(Wave 70 — 다른 차원의 묘비). 쓰기는 사망 때 `useFirebaseSync`, 읽기는 온라인 세션의
 * `useDimensionGravePool`이 부른다. `tests/firestore-rules-semantics.test.js`가 같은 두 함수를 에뮬레이터에서 실행한다 —
 * 업로드 → 다른 플레이어의 조회 → 이벤트 후보까지가 배포된 rules 위에서 이어지는지는 사본이 아니라 이 함수로 확인한다.
 */
const gravesCollection = (firestore: Firestore) => collection(firestore, 'artifacts', APP_ID, 'public', 'data', 'graves');

export const writePublicGrave = (firestore: Firestore, graveDoc: PublicGraveDoc): Promise<void> => (
    setDoc(doc(gravesCollection(firestore), graveDoc.uid), { ...graveDoc, createdAt: serverTimestamp() })
);

/** 최근 공개 묘비 `DIMENSION_GRAVE_POOL_LIMIT`개 — 내 묘비는 뺀다. */
export const readDimensionGravePool = async (firestore: Firestore, uid: string): Promise<GraveEntry[]> => {
    const snapshot = await getDocs(query(gravesCollection(firestore), orderBy('createdAt', 'desc'), limit(BALANCE.DIMENSION_GRAVE_POOL_LIMIT)));
    const fetched: GraveEntry[] = [];
    snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>) => {
        fetched.push({ ...document.data(), uid: document.id });
    });
    return excludeOwnGraves(fetched, uid);
};
