/**
 * 이번 회차(계승 단계)에서 여정을 끝낼 때 닿았던 가장 높은 레벨 — 사망 화면과 다시 오르는 레벨업 기록이 읽는다.
 *
 * 기록은 영구 meta `cycleBestLevel = { rank, level }`이고 여정을 끝내는 한 곳(`pickPermanentPlayerState`의 사망 · 다시 시작)이
 * 남긴다. `rank`가 지금 `prestigeRank`와 다르면(계승한 뒤 · 이전 세이브) 기록이 없는 것으로 읽는다 — 회차 단위 기록이다
 * (`mirrorEndlessCycle`과 같은 방식). 게임 판정은 이 기록을 읽지 않는다.
 */

export interface CycleBestLevel {
    rank: number;
    level: number;
}

interface CycleBestLevelMeta {
    prestigeRank?: number;
    cycleBestLevel?: CycleBestLevel;
}

const getCurrentRank = (meta: CycleBestLevelMeta | null | undefined): number => (
    Math.max(0, Math.floor(Number(meta?.prestigeRank) || 0))
);

const toLevel = (value: unknown): number => Math.max(0, Math.floor(Number(value) || 0));

/** 이번 회차에 끝낸 여정들의 최고 레벨. 이번 회차에 끝낸 여정이 없으면 `null`. */
export const getCycleBestLevel = (meta: CycleBestLevelMeta | null | undefined): number | null => {
    const record = meta?.cycleBestLevel;
    if (!record || record.rank !== getCurrentRank(meta)) return null;
    const level = toLevel(record.level);
    return level > 0 ? level : null;
};

/** 여정 하나를 레벨 `level`에서 끝낸 뒤의 기록 — 지금 단계로 키를 맞추고 더 높은 레벨만 남긴다. */
export const recordCycleBestLevel = (meta: CycleBestLevelMeta | null | undefined, level: unknown): CycleBestLevel => ({
    rank: getCurrentRank(meta),
    level: Math.max(getCycleBestLevel(meta) ?? 0, toLevel(level)),
});
