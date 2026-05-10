import type { GameMap, Player } from '../types/index.js';

// cycle 607: values default [] 제거 — 1 internal callsite (line 5)
//   uniqueList([...spread array]) 명시 전달이라 default 도달 불가.
//   private (no export). cycle 577과 동일 모듈 paired cleanup.
const uniqueList = (values: any) => [...new Set(values.filter(Boolean))];

export const getMapEncounterRoster = (map: GameMap | null | undefined) => uniqueList([
    ...(map?.monsters || []),
    ...(map?.bossMonsters || []),
    typeof map?.boss === 'string' ? map.boss : null,
]);

// cycle 577: codex default {} 제거 — 1 internal (line 28) + 1 test (map-progress
//   :22) 모두 명시 전달이라 default 도달 불가. body의 codex?.monsters || {}
//   defensive guard 보존. 청소 메가 시리즈 69번째.
export const getMapCodexProgress = (mapName: any, maps: any, codex: any) => {
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

export const getMapProgressState = (mapName: any, player: Player | null | undefined, maps: any) => {
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

    // cycle 442: visited 출력 필드 제거 — production read 0건. 내부 state 계산용
    //   const visited는 보존 (line 33+에서 상태 결정에 사용). cycle 333-356 시리즈 회귀.
    return {
        state,
        isCurrent: currentLoc === mapName,
        progress,
    };
};
