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

export const createCurrentRunProgress = (
    stats: Record<string, any> = {},
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

export const normalizeCurrentRunProgress = (stats: Record<string, any> = {}): CurrentRunProgress => {
    const currentRun = stats.currentRun;
    if (!currentRun || typeof currentRun !== 'object' || Array.isArray(currentRun)) {
        return createCurrentRunProgress(stats, { complete: false });
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

export const getCurrentRunSnapshot = (stats: Record<string, any> = {}) => {
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

export const recordCurrentRunMaxKillStreak = (stats: Record<string, any> = {}, streak: number) => {
    const currentRun = normalizeCurrentRunProgress(stats);
    return {
        ...stats,
        currentRun: {
            ...currentRun,
            maxKillStreak: Math.max(currentRun.maxKillStreak, toCount(streak)),
        },
    };
};
