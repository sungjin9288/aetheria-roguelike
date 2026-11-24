import {
    collection,
    getCountFromServer,
    getDocs,
    limit,
    orderBy,
    query,
    where,
    type Firestore,
} from 'firebase/firestore';
import { APP_ID } from '../data/constants';
import type { LeaderboardEntry } from '../types/session';

/**
 * 순위표 읽기(2026-11 E7). 쓰기는 자동 저장(`createCloudAutosave`)이 한다.
 *
 * 정렬 키는 한 필드 `rankScore`다 — 한 필드 `orderBy` · 한 필드 범위 조건은 자동 색인으로 돈다. 세 필드 `orderBy`
 * (계승 · 심연 · 레벨)로 바꾸면 복합 색인이 필요한데 파이프라인(`deploy-rules`)은 rules만 배포하므로 쿼리가 실패한다.
 * `rankScore`가 없는 이전 클라이언트의 문서는 이 쿼리에 나오지 않는다 — 그 플레이어가 새 클라이언트로 한 번 저장하면 다시 오른다.
 * `tests/firestore-rules-semantics.test.js`가 같은 두 함수를 에뮬레이터에서 실행한다.
 */
export const LEADERBOARD_PAGE_SIZE = 50;

const leaderboardCollection = (firestore: Firestore) => collection(firestore, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');

/** 위에서 `LEADERBOARD_PAGE_SIZE`명. */
export const readLeaderboardTop = async (firestore: Firestore): Promise<LeaderboardEntry[]> => {
    const snapshot = await getDocs(query(
        leaderboardCollection(firestore),
        orderBy('rankScore', 'desc'),
        limit(LEADERBOARD_PAGE_SIZE),
    ));
    return snapshot.docs.map((document) => document.data() as LeaderboardEntry);
};

/** 점수가 `score`보다 높은 기록 수 — 내 순위는 이 값 + 1이다(같은 점수는 같은 순위). 문서를 내려받지 않는 집계 읽기다. */
export const countLeaderboardAbove = async (firestore: Firestore, score: number): Promise<number> => {
    const snapshot = await getCountFromServer(query(leaderboardCollection(firestore), where('rankScore', '>', score)));
    return snapshot.data().count;
};
