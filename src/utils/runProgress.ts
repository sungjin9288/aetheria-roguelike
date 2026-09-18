import type { Player } from '../types/player.js';

export interface CurrentRunProgress {
    startedAt: number | null;
    complete: boolean;
    killsAtStart: number;
    bossKillsAtStart: number;
    totalGoldAtStart: number;
    escapesAtStart: number;
    visitedMapsAtStart: string[];
    maxKillStreak: number;
}

const toCount = (value: unknown) => Math.max(0, Number.isFinite(value) ? Number(value) : 0);

const toUniqueLocations = (value: unknown) => (
    Array.isArray(value)
        ? [...new Set(value.filter((location): location is string => typeof location === 'string' && location.length > 0))]
        : []
);

/** player.stats처럼 신뢰할 수 없는 저장 데이터 필드를 동적 키로 읽기 위한 narrowing. */
const isRecord = (value: unknown): value is Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const createCurrentRunProgress = (
    stats: Player['stats'] = {},
    options: { complete?: boolean; startedAt?: number | null } = {},
): CurrentRunProgress => ({
    startedAt: options.startedAt === undefined ? Date.now() : options.startedAt,
    complete: options.complete !== false,
    killsAtStart: toCount(stats.kills),
    bossKillsAtStart: toCount(stats.bossKills),
    totalGoldAtStart: toCount(stats.total_gold),
    escapesAtStart: toCount(stats.escapes),
    visitedMapsAtStart: toUniqueLocations(stats.visitedMaps),
    maxKillStreak: 0,
});

/**
 * W11-C2(B2): `now`는 "currentRun이 아예 없던 저장본에 런을 새로 여는 시각"이다.
 * 생략하면 `createCurrentRunProgress`의 기본값(`Date.now()`)이 그대로 쓰여 기존 동작과 같고,
 * `migrateData(raw, { now })`처럼 시각을 소유한 호출자가 넘기면 그 경로가 결정론적이 된다.
 */
export const normalizeCurrentRunProgress = (
    stats: Player['stats'] = {},
    options: { now?: number } = {},
): CurrentRunProgress => {
    // stats.currentRun은 CurrentRunProgress 타입이지만 이 함수 자체가 구형/손상된
    // 저장 데이터를 방어적으로 정규화하는 경계다 — unknown으로 다시 받아 재검증한다.
    const currentRun: unknown = stats.currentRun;
    if (!isRecord(currentRun)) {
        return createCurrentRunProgress(stats, { complete: false, startedAt: options.now });
    }

    return {
        startedAt: Number.isFinite(currentRun.startedAt) ? Number(currentRun.startedAt) : null,
        complete: currentRun.complete !== false,
        killsAtStart: toCount(currentRun.killsAtStart),
        bossKillsAtStart: toCount(currentRun.bossKillsAtStart),
        totalGoldAtStart: toCount(currentRun.totalGoldAtStart),
        escapesAtStart: toCount(currentRun.escapesAtStart),
        visitedMapsAtStart: toUniqueLocations(currentRun.visitedMapsAtStart),
        maxKillStreak: toCount(currentRun.maxKillStreak),
    };
};

export const getCurrentRunSnapshot = (stats: Player['stats'] = {}) => {
    const currentRun = normalizeCurrentRunProgress(stats);
    const visitedAtStart = new Set(currentRun.visitedMapsAtStart);
    const visitedNow = toUniqueLocations(stats.visitedMaps);

    return {
        complete: currentRun.complete,
        kills: Math.max(0, toCount(stats.kills) - currentRun.killsAtStart),
        bossKills: Math.max(0, toCount(stats.bossKills) - currentRun.bossKillsAtStart),
        totalGold: Math.max(0, toCount(stats.total_gold) - currentRun.totalGoldAtStart),
        escapes: Math.max(0, toCount(stats.escapes) - currentRun.escapesAtStart),
        discoveries: visitedNow.filter((location) => !visitedAtStart.has(location)).length,
        maxKillStreak: currentRun.maxKillStreak,
    };
};

export const recordCurrentRunMaxKillStreak = (stats: Player['stats'] = {}, streak: number) => {
    const currentRun = normalizeCurrentRunProgress(stats);
    return {
        ...stats,
        currentRun: {
            ...currentRun,
            maxKillStreak: Math.max(currentRun.maxKillStreak, toCount(streak)),
        },
    };
};
