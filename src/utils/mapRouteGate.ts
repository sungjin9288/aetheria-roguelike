import { CONSTANTS } from '../data/constants.js';
import { getReachableMaps } from './mapAccess.js';

/**
 * 맵의 **실제 진입 레벨**(경로 게이트) 단일 authority — Wave 13 E2에서
 * `systems/contentReachability.ts`의 도달성 보행을 그대로 추출한 것이다.
 *
 * 두 값은 다른 것을 뜻한다:
 *   - **선언 레벨**(`map.level`) — 그 지역 자신의 잠금. `getMapAccess`가 실제로 비교하는 값이고
 *     이동 권한은 여전히 이것만으로 판정한다(이 모듈은 권한을 정하지 않는다).
 *   - **경로 게이트**(`routeGateLevel`) — 시작의 마을에서 실제로 걸어 들어갈 수 있게 되는 최소 레벨.
 *     유일한 경로가 더 높은 지역을 지나면 선언보다 높아진다(실측: 52개 중 16개).
 *
 * 2026-09 Wave 27 N3: 경로 게이트의 보행은 **실제 이동 규칙 그 자체**다 — `getReachableMaps`
 * (`getMapAccess` 위의 BFS, `progressionDiagnostic`이 이미 쓰는 것)를 기본 설정(시즌 없음,
 * `liveConfig.seasonEvent`의 기본값은 `null`)으로 부른다. 전에는 이 파일이 자기 보행을 따로 들고
 * seasonOnly 지역을 "출구 하나만 닿으면 들어간다"로 재투입했는데, 실제 이동 규칙은 시즌이 없으면
 * 시즌 지역을 `'season'`으로 거부한다. 서리 폭풍 유적(시즌)이 얼음 성채로 이어지므로 북부 권역 8곳이
 * 20~34로 표시·보고됐고, 실제 첫 진입은 암흑 성(35) → 저주받은 묘지 → 얼음 성채로만 가능한 Lv35였다.
 * 같은 재투입이 고대 보물고도 "출구(시작의 마을)가 닿으면 Lv25"로 셌지만, 어느 지역도 보물고로
 * 출구가 없고 입장은 잊혀진 열쇠 이벤트(이동이 아니다)뿐이다.
 *
 * 그래서 **걸어서 못 들어가는 지역의 경로 게이트는 null**이다(시즌 지역 둘 · 고대 보물고).
 * 시즌 중 게이트는 두지 않는다 — 읽는 곳이 없다(UI는 시즌 상태를 받지 않고, 리포트는 기본 설정의
 * 보행을 가격 매긴다). 이 지역들이 **어떤 입구로** 들어가는지는 `nonWalkingEntryOf`가 말한다.
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
    /**
     * 시작의 마을에서 실제 이동 규칙(`getMapAccess`, 시즌 없음)으로 걸어 들어갈 수 있게 되는 최소 레벨.
     * 끝내 못 걸으면 null — 시즌 지역과 고대 보물고가 그렇다(입구가 이동이 아니다).
     */
    routeGateLevel: number | null;
    /**
     * 선언에 유한한 레벨 잠금이 있는가.
     * `'infinite'`은 `getMapAccess`의 `level < Number('infinite')`가 NaN 비교라 **잠금이 아니다**.
     */
    declaredIsLocked: boolean;
    /** 선언과 경로가 갈라지는가 — 카드가 보여주던 숫자가 진입 레벨이 아닌 경우. */
    diverges: boolean;
}

/**
 * 걸어서는 못 들어가는 지역의 입구 종류.
 *   - `season`    : seasonOnly — 시즌 이벤트 중에만 어디서든 이동할 수 있다(`getMapAccess`의 `'season'`).
 *   - `vault-key` : 고대 보물고 — 잊혀진 열쇠를 든 탐험 이벤트가 옮겨 놓는다(`exploreFlow`). 출구로는 못 온다.
 */
export type NonWalkingEntry = 'season' | 'vault-key';

export const MAP_ROUTE_START_LOCATION = '시작의 마을';
export const MAP_ROUTE_ORIGIN_LEVEL = 1;

/** 열쇠 이벤트로만 들어가는 지역 — 어느 지역도 이곳으로 출구를 두지 않는다. */
const VAULT_KEY_REGION = '고대 보물고';

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

/** 걸어서는 못 들어가는 지역이 무엇으로 들어가는가 — 이동이 아닌 입구가 없으면 null. */
export const nonWalkingEntryOf = (name: string, map: RouteGateMapLike | undefined): NonWalkingEntry | null => {
    if (map?.seasonOnly) return 'season';
    if (name === VAULT_KEY_REGION) return 'vault-key';
    return null;
};

type MoveRuleMap = { level?: number | number[] | string; seasonOnly?: boolean; exits: string[] };

/**
 * `getMapAccess`가 읽는 모양으로 좁힌 사본 — 목업의 문자열 아닌 출구나 없는 지역을 가리키는 출구는
 * (`findInvalidExits`가 따로 보고한다) 보행에서 뺀다. 같은 MAPS 객체에는 한 번만 만든다.
 */
const moveRuleViewCache = new WeakMap<object, Record<string, MoveRuleMap>>();

const moveRuleView = (maps: Record<string, RouteGateMapLike>) => {
    const cached = moveRuleViewCache.get(maps);
    if (cached) return cached;
    const view: Record<string, MoveRuleMap> = {};
    for (const [name, map] of Object.entries(maps)) {
        view[name] = {
            level: map?.level,
            seasonOnly: map?.seasonOnly,
            exits: (Array.isArray(map?.exits) ? map.exits : [])
                .filter((exit: unknown): exit is string => typeof exit === 'string' && Object.hasOwn(maps, exit)),
        };
    }
    moveRuleViewCache.set(maps, view);
    return view;
};

/**
 * 그 레벨에서 시작점부터 **실제 이동 규칙**으로 걸어 들어갈 수 있는 지역 — `getReachableMaps`를
 * 기본 설정(시즌 없음)으로 부른다. moveActions가 매 이동마다 부르는 `getMapAccess`와 같은 판정이다.
 * `level`을 Infinity로 주면 레벨 잠금이 한 번도 걸리지 않는다(걷기로 닿는 지역의 상한).
 */
export const walkableMapsAt = (
    start: string,
    maps: Record<string, RouteGateMapLike>,
    level: number,
) => {
    if (!Object.hasOwn(maps, start)) return [];
    return sorted(getReachableMaps(moveRuleView(maps), start, level, false));
};

/**
 * **위상** 도달성 — 레벨과 시즌을 무시하고 "어떤 입구로든 한 번은 들어갈 수 있는가"만 센다.
 * 리포트의 `maps.reachable`/`UNREACHABLE_MAPS`(고아 지역 검출)가 쓰는 것이고 **게이트가 아니다** —
 * 레벨이 붙은 진입선은 `walkableMapsAt`/`mapRouteGateLevels`가 소유한다(Wave 27 N3: 전에는 이 함수가
 * 레벨 상한을 받아 게이트까지 매겼고, 그 때문에 시즌 재투입이 게이트로 샜다).
 * 이동이 아닌 입구(`nonWalkingEntryOf`)를 가진 지역은 자기 출구 하나가 닿으면 도달 가능으로 센다.
 * `visited`를 별도로 두는 이유: 방문 표시가 없으면 재투입 루프에서 큐가 무한히 자란다.
 */
export const reachableMapsFrom = (
    start: string,
    maps: Record<string, RouteGateMapLike>,
) => {
    const reachable = new Set<string>();
    const visited = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current) || !Object.hasOwn(maps, current)) continue;
        visited.add(current);
        reachable.add(current);
        const exits = Array.isArray(maps[current]?.exits) ? maps[current].exits : [];
        queue.push(...exits.filter((entry: unknown): entry is string => typeof entry === 'string'));
        for (const [name, map] of Object.entries(maps)) {
            if (nonWalkingEntryOf(name, map) === null) continue;
            const entryExits = Array.isArray(map?.exits) ? map.exits : [];
            if (entryExits.some((exit: unknown) => typeof exit === 'string' && reachable.has(exit))) queue.push(name);
        }
    }
    return sorted(reachable);
};

/**
 * 각 지역을 실제 이동 규칙으로 처음 걸어 들어가는 최소 플레이어 레벨.
 * 걸어서 못 들어가는 지역(시즌 · 고대 보물고 · 고아)은 표에 아예 없다.
 */
export const mapRouteGateLevels = (start: string, maps: Record<string, RouteGateMapLike>) => {
    const gates = new Map<string, number>();
    const ceiling = walkableMapsAt(start, maps, Number.POSITIVE_INFINITY).length;
    for (let level = MAP_ROUTE_ORIGIN_LEVEL; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        for (const name of walkableMapsAt(start, maps, level)) {
            if (!gates.has(name)) gates.set(name, level);
        }
        if (gates.size >= ceiling) break;
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
