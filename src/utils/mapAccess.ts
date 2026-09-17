type AccessMap = {
    level?: number | number[] | string;
    minLv?: number;
    seasonOnly?: boolean;
    exits?: string[];
};

/** Static movement eligibility; combat state and side effects belong to moveActions. */
export const getMapAccess = (
    maps: Record<string, AccessMap>,
    from: string,
    to: string,
    level: number,
    seasonActive = false,
) => {
    const target = maps[to];
    const requiredLevel = target?.minLv
        ?? (Array.isArray(target?.level) ? target.level[0] : target?.level) ?? 1;
    if (!target) return { reason: 'missing', requiredLevel } as const;
    if (target.seasonOnly && !seasonActive) return { reason: 'season', requiredLevel } as const;
    // Preserve the existing numeric comparison, including unbounded 'infinite' maps.
    if (level < Number(requiredLevel)) return { reason: 'level', requiredLevel } as const;
    if (!target.seasonOnly && !maps[from]?.exits?.includes(to)) {
        return { reason: 'exit', requiredLevel } as const;
    }
    return { reason: null, requiredLevel } as const;
};

export const getReachableMaps = (
    maps: Record<string, AccessMap>,
    start: string,
    level: number,
    seasonActive = false,
) => {
    const visited = new Set<string>();
    if (!maps[start]) return visited;
    const queue = [start];
    visited.add(start);
    const seasonal = seasonActive ? Object.keys(maps).filter(name => maps[name].seasonOnly) : [];
    for (const from of queue) {
        for (const to of [...(maps[from].exits || []), ...seasonal]) {
            if (visited.has(to) || getMapAccess(maps, from, to, level, seasonActive).reason !== null) continue;
            visited.add(to);
            queue.push(to);
        }
    }
    return visited;
};
