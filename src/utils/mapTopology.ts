import type { GameMap } from '../types/index.js';

type MapIndex = Record<string, GameMap>;

interface MapSelectionRoute {
    name: string;
    isMissionRoute?: boolean;
    isLocked?: boolean;
}

// Wave 61: 무한 심연은 잠금이 없다(`getMapAccess`의 `NaN` 비교 — 이동은 언제나 통과한다). `레벨 + 8`을 돌려주던 동안
//   이동 버튼 · 경로 · 안내가 심연을 영원히 "잠김"으로 그렸고 터미널 `move`로만 들어갈 수 있었다(원장 §61 A3).
export const getMapRequiredLevel = (map: GameMap | null | undefined, _playerLevel: number) => {
    if (map?.level === 'infinite') return 1;
    // 2026-09 N3: `minLv` 우선 분기 제거 — MAPS 52개 중 정의 0개라 도달 불가였다.
    if (Array.isArray(map?.level)) return Number(map.level[0] || 1);
    return typeof map?.level === 'number' ? map.level : 1;
};

/**
 * `getMapAccess`와 같은 규칙으로 읽은 진입 레벨 — 배열은 첫 값, `'infinite'`는 잠금 없음(`NaN` 비교라
 * 항상 통과)이라 0이다. 레벨이 없는 지도는 1.
 */
const entryLevel = (map: GameMap | undefined): number => {
    const raw = Array.isArray(map?.level) ? map.level[0] : map?.level;
    const level = Number(raw ?? 1);
    return Number.isFinite(level) ? level : 0;
};

const shortestRoute = (maps: MapIndex, start: string, target: string, admits: (name: string) => boolean) => {
    const routes = [[start]];
    const visited = new Set([start]);

    for (let index = 0; index < routes.length; index += 1) {
        const route = routes[index];
        const current = route[route.length - 1];

        for (const next of maps[current]?.exits || []) {
            if (visited.has(next) || !maps[next]) continue;
            if (next !== target && !admits(next)) continue;

            const nextRoute = [...route, next];
            if (next === target) return nextRoute;

            visited.add(next);
            routes.push(nextRoute);
        }
    }

    return [];
};

/**
 * 임무 경로 안내가 가리키는 길(Wave 27). 출구만 보는 최단 BFS는 같은 길이의 길 중 출구 순서가
 * 먼저인 쪽을 골라, 목적지에 걸어서 닿을 수 있는 레벨에서도 더 높은 지역을 경유하게 안내했다
 * (실제 데이터 839쌍 — 암흑 성→기계 폐도가 Lv44 지하 미궁을 가리켰다). 이제 경유지의 최고 진입
 * 레벨(병목)이 가장 낮은 길을 고르고, 병목이 같으면 최단이다. 계절 전용 지역은 목적지가 아닌 한
 * 경유지로 쓰지 않는다 — 기본 설정(시즌 없음)에서 `getMapAccess`가 막는 길이다. 그런 길밖에 없으면
 * 그 길이라도 보여 준다(시즌 중에는 실제로 걷는다). 오라클: `tests/mission-route-walkable.test.js`.
 */
export const findMapPath = (maps: MapIndex, start: string, target: string) => {
    if (!start || !target || !maps[start] || !maps[target]) return [];
    if (start === target) return [start];

    const isWaypoint = (name: string) => name !== start && name !== target && !maps[name]?.seasonOnly;
    const ceilings = [...new Set(Object.keys(maps).filter(isWaypoint).map((name) => entryLevel(maps[name])))]
        .sort((left, right) => left - right);

    for (const ceiling of ceilings) {
        const route = shortestRoute(maps, start, target, (name) => isWaypoint(name) && entryLevel(maps[name]) <= ceiling);
        if (route.length) return route;
    }

    return shortestRoute(maps, start, target, () => true);
};

export const getNextMapTowardTarget = (maps: MapIndex, start: string, target: string) => (
    findMapPath(maps, start, target)[1] || null
);

export const getDefaultMapSelection = (currentName: string, routes: MapSelectionRoute[]) => (
    routes.find((route) => route.isMissionRoute && !route.isLocked)?.name || currentName
);
