import type { GameMap } from '../types/index.js';

type MapIndex = Record<string, GameMap>;

export const getMapRequiredLevel = (map: GameMap | null | undefined, playerLevel: number) => {
    if (map?.level === 'infinite') return Math.max(playerLevel + 8, 50);
    if (typeof map?.minLv === 'number') return map.minLv;
    if (Array.isArray(map?.level)) return Number(map.level[0] || 1);
    return typeof map?.level === 'number' ? map.level : 1;
};

export const findMapPath = (maps: MapIndex, start: string, target: string) => {
    if (!start || !target || !maps[start] || !maps[target]) return [];
    if (start === target) return [start];

    const routes = [[start]];
    const visited = new Set([start]);

    for (let index = 0; index < routes.length; index += 1) {
        const route = routes[index];
        const current = route[route.length - 1];

        for (const next of maps[current]?.exits || []) {
            if (visited.has(next) || !maps[next]) continue;

            const nextRoute = [...route, next];
            if (next === target) return nextRoute;

            visited.add(next);
            routes.push(nextRoute);
        }
    }

    return [];
};

export const getNextMapTowardTarget = (maps: MapIndex, start: string, target: string) => (
    findMapPath(maps, start, target)[1] || null
);
