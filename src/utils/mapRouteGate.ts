import { CONSTANTS } from '../data/constants.js';

/**
 * 맵의 **실제 진입 레벨**(경로 게이트) 단일 authority — Wave 13 E2에서
 * `systems/contentReachability.ts`의 도달성 보행을 그대로 추출한 것이다.
 *
 * 두 값은 다른 것을 뜻한다:
 *   - **선언 레벨**(`map.level`) — 그 지역 자신의 잠금. `getMapAccess`가 실제로 비교하는 값이고
 *     이동 권한은 여전히 이것만으로 판정한다(이 모듈은 권한을 정하지 않는다).
 *   - **경로 게이트**(`routeGateLevel`) — 시작의 마을에서 실제로 걸어 들어갈 수 있게 되는 최소 레벨.
 *     유일한 경로가 더 높은 지역을 지나면 선언보다 높아진다(실측: 52개 중 10개).
 *
 * 증빙 리포트와 UI가 같은 값을 읽어야 하므로 계산은 이 파일 하나에만 있다 —
 * 리포트(`contentReachability.ts`)도 UI(`components/MapNavigator.tsx`)도 여기서 읽는다.
 */

/**
 * 이 모듈이 실제로 읽는 필드만의 최소 지역 형태.
 * 프로덕션 `DB.MAPS`(GameMap)와 리포트의 테스트 목업을 같은 함수로 받기 위한 공통 계약이다.
 */
export interface RouteGateMapLike {
    exits?: unknown[];
    seasonOnly?: boolean;
    /** MAPS 실측: 숫자 / [최소, 최대] 범위 / 'infinite'(무한 심연) 세 모양이 모두 존재한다. */
    level?: number | number[] | string;
}

export interface MapRouteGate {
    /** 지역이 선언한 값 그대로 — 숫자 / [최소, 최대] / 'infinite'. 선언이 없으면 null. */
    declaredLevel: number | number[] | string | null;
    /** 선언 레벨을 `getMapAccess`와 같은 규칙으로 읽은 값(잠금이 없으면 원점 레벨). */
    declaredGateLevel: number;
    /** 시작의 마을에서 실제로 걸어 들어갈 수 있게 되는 최소 레벨. 끝내 못 걸으면 null. */
    routeGateLevel: number | null;
    /**
     * 선언에 유한한 레벨 잠금이 있는가.
     * `'infinite'`은 `getMapAccess`의 `level < Number('infinite')`가 NaN 비교라 **잠금이 아니다**.
     */
    declaredIsLocked: boolean;
    /** 선언과 경로가 갈라지는가 — 카드가 보여주던 숫자가 진입 레벨이 아닌 경우. */
    diverges: boolean;
}

export const MAP_ROUTE_START_LOCATION = '시작의 마을';
export const MAP_ROUTE_ORIGIN_LEVEL = 1;

/** seasonOnly 지역과 함께, 출구만으로 재투입되는 예외 노드(보행 큐 재투입 대상). */
const REENTRY_REGION = '고대 보물고';

const codePointCompare = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const sorted = (values: Iterable<string>) => [...new Set(values)].sort(codePointCompare);

/** 선언 레벨을 `getMapAccess`와 같은 규칙으로 하나만 고른다 — 범위(`[min, max]`)는 첫 값이 입장선이다. */
const declaredLevelValue = (map: RouteGateMapLike | undefined) => (
    Array.isArray(map?.level) ? map.level[0] : map?.level
);

/** 선언에 유한한 레벨 잠금이 있는가 — `'infinite'`은 NaN이라 잠금이 아니다. */
const isDeclaredLevelLocked = (map: RouteGateMapLike | undefined) => (
    Number.isFinite(Number(declaredLevelValue(map)))
);

/**
 * 지역의 입장 레벨 — `getMapAccess`와 같은 규칙으로 읽는다.
 * 범위(`[min, max]`)는 첫 값이 입장선이고, 유한하지 않은 값('infinite')은 레벨 잠금이 없다
 * (`getMapAccess`의 `level < Number('infinite')`는 항상 false다).
 */
export const mapGateLevel = (map: RouteGateMapLike | undefined) => (
    isDeclaredLevelLocked(map) ? Number(declaredLevelValue(map)) : MAP_ROUTE_ORIGIN_LEVEL
);

/**
 * `levelCap`을 주면 그 레벨에서 실제로 걸어 들어갈 수 있는 지역만 센다.
 * 기본값(Infinity)에서는 레벨 게이트가 한 번도 걸리지 않으므로 기존 위상 전용 동작과 동일하다.
 * `visited`를 별도로 두는 이유: 레벨로 막힌 노드는 `reachable`에 들어가지 않으므로,
 * 방문 표시가 없으면 seasonOnly/고대 보물고 재투입 루프에서 큐가 무한히 자란다.
 */
export const reachableMapsFrom = (
    start: string,
    maps: Record<string, RouteGateMapLike>,
    levelCap = Number.POSITIVE_INFINITY,
) => {
    const reachable = new Set<string>();
    const visited = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current) || !Object.hasOwn(maps, current)) continue;
        visited.add(current);
        if (mapGateLevel(maps[current]) > levelCap) continue;
        reachable.add(current);
        const exits = Array.isArray(maps[current]?.exits) ? maps[current].exits : [];
        queue.push(...exits.filter((entry: unknown): entry is string => typeof entry === 'string'));
        for (const [name, map] of Object.entries(maps)) {
            if (!map?.seasonOnly && name !== REENTRY_REGION) continue;
            const entryExits = Array.isArray(map?.exits) ? map.exits : [];
            if (entryExits.some((exit: unknown) => typeof exit === 'string' && reachable.has(exit))) queue.push(name);
        }
    }
    return sorted(reachable);
};

/** 각 지역이 열리는 최소 플레이어 레벨 — 도달성 보행에 레벨 상한을 씌워 구한다. */
export const mapRouteGateLevels = (start: string, maps: Record<string, RouteGateMapLike>) => {
    const gates = new Map<string, number>();
    const total = Object.keys(maps).length;
    for (let level = MAP_ROUTE_ORIGIN_LEVEL; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        for (const name of reachableMapsFrom(start, maps, level)) {
            if (!gates.has(name)) gates.set(name, level);
        }
        if (gates.size >= total) break;
    }
    return gates;
};

/**
 * 같은 MAPS 객체에 대한 보행 결과 재사용 — 게이트 표는 MAPS와 시작점만의 함수라
 * 렌더마다 다시 걸을 이유가 없다(UI가 지역 52개를 한 번에 그린다).
 */
const gateCache = new WeakMap<object, Map<string, Map<string, number>>>();

const routeGatesFor = (maps: Record<string, RouteGateMapLike>, start: string) => {
    const byStart = gateCache.get(maps) ?? new Map<string, Map<string, number>>();
    const cached = byStart.get(start);
    if (cached) return cached;
    const gates = mapRouteGateLevels(start, maps);
    byStart.set(start, gates);
    gateCache.set(maps, byStart);
    return gates;
};

/**
 * 한 지역의 선언 레벨과 경로 게이트를 함께 읽는다 — UI가 "카드의 숫자가 곧 진입 레벨인가"를
 * 판단할 때 쓰는 표면. 목록에 없는 지역이면 null.
 */
export const getMapRouteGate = (
    maps: Record<string, RouteGateMapLike>,
    name: string,
    start: string = MAP_ROUTE_START_LOCATION,
): MapRouteGate | null => {
    const map = Object.hasOwn(maps, name) ? maps[name] : undefined;
    if (!map) return null;
    const declaredGateLevel = mapGateLevel(map);
    const routeGateLevel = routeGatesFor(maps, start).get(name) ?? null;
    return {
        declaredLevel: map.level ?? null,
        declaredGateLevel,
        routeGateLevel,
        declaredIsLocked: isDeclaredLevelLocked(map),
        diverges: routeGateLevel !== null && routeGateLevel !== declaredGateLevel,
    };
};
