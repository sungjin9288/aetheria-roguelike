import { CONSTANTS } from '../data/constants';
import type { Player } from '../types';
import { getCycleBestLevel } from './cycleBestLevel';

/**
 * 순위표 기록(2026-11 E7, 소유자 결정 "계승 · 심연 · 레벨") — 평생 처치 수(시간 보상) 대신 계승 단계 → 혼돈의 심연 최고 기록 →
 * 이번 회차 최고 레벨 순서로 줄 세운다.
 *
 * - 계승 단계: `meta.prestigeRank`(계정).
 * - 심연 최고 기록: `stats.abyssRecord` — 돌파한 층의 최고치(계정 범위, 사망 · 계승에서 남는다). `abyssFloor`는 지금 층이다.
 * - 회차 최고 레벨: 이번 회차(같은 계승 단계)에 끝낸 여정들의 최고 레벨(`cycleBestLevel`, 사망 화면의 "회차 최고" 줄과 같은 기록)과
 *   지금 여정의 레벨 중 큰 값. 지금 레벨만 쓰면 죽는 순간 레벨 1로 떨어져 순위가 무너진다. 계승하면 기록은 지워지지만 계승 단계가
 *   한 칸 올라 첫 칸이 이기므로, 점수는 줄지 않는다.
 *
 * 정렬은 한 숫자(`rankScore`)로 한다 — 세 필드 `orderBy`는 복합 색인이 필요한데 파이프라인은 rules만 배포한다.
 * 칸마다 상한(`LEADERBOARD_MAX_*` 상수)으로 잘라 붙이므로 앞 칸이 언제나 이긴다. `firestore.rules`가 같은 식을 검사한다.
 */

export interface LeaderboardRecord {
    prestigeRank: number;
    abyssRecord: number;
    bestLevel: number;
}

const LEVEL_SLOT = CONSTANTS.LEADERBOARD_MAX_LEVEL + 1;
const ABYSS_SLOT = (CONSTANTS.LEADERBOARD_MAX_ABYSS_RECORD + 1) * LEVEL_SLOT;

const clampInt = (value: unknown, min: number, max: number): number => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
};

/** 이 플레이어의 순위표 기록 세 값 — 상한으로 자른 정수. */
export const getLeaderboardRecord = (player: Player): LeaderboardRecord => ({
    prestigeRank: clampInt(player.meta?.prestigeRank, 0, CONSTANTS.LEADERBOARD_MAX_PRESTIGE_RANK),
    abyssRecord: clampInt(player.stats?.abyssRecord, 0, CONSTANTS.LEADERBOARD_MAX_ABYSS_RECORD),
    bestLevel: clampInt(
        Math.max(getCycleBestLevel(player.meta) ?? 0, Number(player.level) || 1),
        1,
        CONSTANTS.LEADERBOARD_MAX_LEVEL,
    ),
});

/** 정렬 점수 — 계승 단계 × 10⁸ + 심연 최고 기록 × 10³ + 회차 최고 레벨. */
export const encodeLeaderboardScore = ({ prestigeRank, abyssRecord, bestLevel }: LeaderboardRecord): number => (
    prestigeRank * ABYSS_SLOT + abyssRecord * LEVEL_SLOT + bestLevel
);

/** 점수의 상한 — `firestore.rules`의 `rankScore` 상한과 같다. */
export const LEADERBOARD_MAX_SCORE = encodeLeaderboardScore({
    prestigeRank: CONSTANTS.LEADERBOARD_MAX_PRESTIGE_RANK,
    abyssRecord: CONSTANTS.LEADERBOARD_MAX_ABYSS_RECORD,
    bestLevel: CONSTANTS.LEADERBOARD_MAX_LEVEL,
});

/** 순위표에 오르는 플레이어인가 — 자동 저장이 순위표에 쓰는 조건과 같다(이름이 있고 처치가 있다). */
export const isLeaderboardEligible = (player: Player | null | undefined): player is Player => Boolean(
    player?.name && (player.stats?.kills || 0) > 0,
);
