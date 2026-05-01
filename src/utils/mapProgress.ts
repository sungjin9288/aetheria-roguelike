import type { GameMap } from '../types/index.js';

const uniqueList = (values: any = []) => [...new Set(values.filter(Boolean))];

export const getMapEncounterRoster = (map: GameMap | null | undefined) => uniqueList([
    ...(map?.monsters || []),
    ...(map?.bossMonsters || []),
    typeof map?.boss === 'string' ? map.boss : null,
]);

export const getMapCodexProgress = (mapName: any, maps: any, codex: any = {}) => {
    const map = maps?.[mapName];
    const roster = getMapEncounterRoster(map);
    const discoveredSet = new Set(Object.keys(codex?.monsters || {}));
    const discovered = roster.filter((monster: any) => discoveredSet.has(monster)).length;

    return {
        total: roster.length,
        discovered,
        remaining: Math.max(0, roster.length - discovered),
    };
};

export const getMapProgressState = (mapName: any, player: any, maps: any) => {
    const currentLoc = player?.loc;
    const visitedSet = new Set([...(player?.stats?.visitedMaps || []), currentLoc].filter(Boolean));
    const codex = player?.stats?.codex || {};
    const progress = getMapCodexProgress(mapName, maps, codex);
    const visited = visitedSet.has(mapName);

    let state = 'unexplored';
    if (progress.total === 0) {
        state = visited ? 'completed' : 'unexplored';
    } else if (progress.discovered >= progress.total) {
        state = 'completed';
    } else if (visited || progress.discovered > 0 || currentLoc === mapName) {
        state = 'exploring';
    }

    return {
        visited,
        state,
        isCurrent: currentLoc === mapName,
        progress,
    };
};
