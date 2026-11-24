import { useEffect, useState } from 'react';
import { auth, db, hasFirebaseConfig } from '../firebase';
import { countLeaderboardAbove } from '../platform/leaderboardFirestore';
import { isMockRuntime } from '../utils/runtimeMode';
import { encodeLeaderboardScore, getLeaderboardRecord, isLeaderboardEligible } from '../utils/leaderboardScore';
import type { Player } from '../types';

interface RankResult {
    score: number;
    rank: number;
}

/**
 * 사망 · 계승 화면의 "내 순위"(2026-11 E7) — 내 점수보다 높은 기록 수를 집계 읽기로 세어 + 1. 같은 점수는 같은 순위다.
 * 로그인된 온라인 세션에서만 읽는다: mock 런타임(e2e · 스모크 · 기기 QA) · Firebase 설정 없음 · 로그인 전 · 읽기 실패면
 * `null`이고 화면은 줄을 그리지 않는다. 순위표에 오르지 않는 플레이어(이름 없음 · 처치 0)도 `null`이다.
 */
export const useMyLeaderboardRank = (player: Player | null | undefined): number | null => {
    const score = isLeaderboardEligible(player) ? encodeLeaderboardScore(getLeaderboardRecord(player)) : null;
    const [result, setResult] = useState<RankResult | null>(null);

    useEffect(() => {
        if (score === null) return undefined;
        if (isMockRuntime() || !hasFirebaseConfig || !db || !auth?.currentUser) return undefined;
        const firestore = db;
        let cancelled = false;
        countLeaderboardAbove(firestore, score)
            .then((above) => {
                if (!cancelled) setResult({ score, rank: above + 1 });
            })
            .catch((error: unknown) => {
                console.warn('Leaderboard rank fetch failed', error);
            });
        return () => {
            cancelled = true;
        };
    }, [score]);

    return result && result.score === score ? result.rank : null;
};
