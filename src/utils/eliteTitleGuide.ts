import { MAPS } from '../data/maps.js';
import { MSG } from '../data/messages.js';
import type { Player } from '../types/index.js';
import { ELITE_TITLE_MAPS, getEliteTitleId } from './eliteTitles.js';
import { getMapRouteGate, nonWalkingEntryOf, type NonWalkingEntry } from './mapRouteGate.js';
import { findMapPath } from './mapTopology.js';

/**
 * 정예 칭호 안내 (2026-10 Wave 101, 원장 §105.4 b — 소유자 결정 "b로 진행").
 *
 * 정예 목격 칭호(Wave 72)는 47곳인데 자연 플레이는 진행 경로 위의 19곳 근처에서 멈췄다(원장 §105.3) — 나머지는 경로 밖이다.
 * 안내는 아직 칭호가 없는 지역을 "갈 곳"으로 바꾼다: 지금 걸어서 들어갈 수 있는 곳(가까운 순), 아직 레벨이 모자란 곳(진입 레벨 순),
 * 걸어서는 못 들어가는 곳(계절 · 열쇠). 진입 레벨은 실제 이동 규칙의 경로 게이트(`getMapRouteGate`), 거리는 지도 안내와 같은
 * `findMapPath`다 — 갈 수 없는 곳을 가깝다고 말하지 않는다. 표시만이다(게임 판정은 이 안내를 읽지 않는다).
 */

export interface EliteTitleGuideEntry {
    map: string;
    /** 실제 이동 규칙으로 처음 걸어 들어가는 레벨 — 걸어서 못 들어가면 null. */
    gateLevel: number | null;
    /** 지금 위치에서의 이동 칸 수 — 지금 들어갈 수 있는 곳만. */
    steps: number | null;
    /** 걸어서는 못 들어가는 곳의 입구. */
    entry: NonWalkingEntry | null;
}

export interface EliteTitleGuide {
    owned: number;
    total: number;
    /** 지금 레벨로 걸어 들어갈 수 있는 곳 — 가까운 순(같으면 진입 레벨 · 데이터 순). */
    reachable: EliteTitleGuideEntry[];
    /** 레벨이 모자란 곳 — 진입 레벨 순. */
    upcoming: EliteTitleGuideEntry[];
    /** 걸어서는 못 들어가는 곳(계절 · 열쇠). */
    special: EliteTitleGuideEntry[];
}

/** 아직 칭호가 없는 정예 칭호 지역 — 데이터 순서. */
export const getMissingEliteTitleMaps = (titles: readonly string[] | null | undefined): string[] => {
    const owned = new Set(titles || []);
    return ELITE_TITLE_MAPS.filter((map) => !owned.has(getEliteTitleId(map)));
};

export const isEliteTitleMissing = (player: Pick<Player, 'titles'> | null | undefined, mapName: string | null | undefined): boolean => (
    Boolean(mapName) && ELITE_TITLE_MAPS.includes(mapName as string) && !(player?.titles || []).includes(getEliteTitleId(mapName as string))
);

/** 이 레벨로 걸어 들어갈 수 있는 정예 칭호 지역인가 — 지도 배지가 읽는다. */
export const isEliteTitleTargetNow = (player: Pick<Player, 'titles' | 'level'> | null | undefined, mapName: string | null | undefined): boolean => {
    if (!isEliteTitleMissing(player, mapName)) return false;
    const gate = getMapRouteGate(MAPS, mapName as string)?.routeGateLevel ?? null;
    return gate !== null && gate <= Math.max(1, Number(player?.level) || 1);
};

const byGateThenOrder = (a: EliteTitleGuideEntry, b: EliteTitleGuideEntry) => (
    (a.gateLevel ?? Infinity) - (b.gateLevel ?? Infinity) || ELITE_TITLE_MAPS.indexOf(a.map) - ELITE_TITLE_MAPS.indexOf(b.map)
);

export const getEliteTitleGuide = (player: Pick<Player, 'titles' | 'level' | 'loc'>): EliteTitleGuide => {
    const missing = getMissingEliteTitleMaps(player.titles);
    const level = Math.max(1, Number(player.level) || 1);
    const reachable: EliteTitleGuideEntry[] = [];
    const upcoming: EliteTitleGuideEntry[] = [];
    const special: EliteTitleGuideEntry[] = [];
    for (const map of missing) {
        const gateLevel = getMapRouteGate(MAPS, map)?.routeGateLevel ?? null;
        const entry = gateLevel === null ? nonWalkingEntryOf(map, MAPS[map]) : null;
        if (gateLevel === null) {
            special.push({ map, gateLevel, steps: null, entry });
        } else if (gateLevel <= level) {
            const path = player.loc ? findMapPath(MAPS, player.loc, map) : [];
            reachable.push({ map, gateLevel, steps: path.length > 0 ? path.length - 1 : null, entry: null });
        } else {
            upcoming.push({ map, gateLevel, steps: null, entry: null });
        }
    }
    reachable.sort((a, b) => (a.steps ?? Infinity) - (b.steps ?? Infinity) || byGateThenOrder(a, b));
    upcoming.sort(byGateThenOrder);
    special.sort(byGateThenOrder);
    return { owned: ELITE_TITLE_MAPS.length - missing.length, total: ELITE_TITLE_MAPS.length, reachable, upcoming, special };
};

/** 다음 회차(Lv1부터)에 들를 순서 — 걸어 들어갈 수 있는 곳 전부를 진입 레벨 순으로. 계승 화면 요약이 읽는다. */
export const getNextCycleEliteTitleRoute = (titles: readonly string[] | null | undefined): EliteTitleGuideEntry[] => (
    getMissingEliteTitleMaps(titles)
        .map((map) => ({ map, gateLevel: getMapRouteGate(MAPS, map)?.routeGateLevel ?? null, steps: null, entry: null }))
        .filter((entry) => entry.gateLevel !== null)
        .sort(byGateThenOrder)
);

/** 안내 줄에 이름을 다 싣지 않는다 — 앞의 몇 곳과 나머지 수. */
const ELITE_GUIDE_NAME_LIMIT = 3;

const joinLimited = (labels: string[]): string => {
    const shown = labels.slice(0, ELITE_GUIDE_NAME_LIMIT).join(' · ');
    const rest = labels.length - ELITE_GUIDE_NAME_LIMIT;
    return rest > 0 ? MSG.ELITE_GUIDE_MORE(shown, rest) : shown;
};

const levelLabel = (entry: EliteTitleGuideEntry) => (
    entry.gateLevel !== null ? MSG.ELITE_GUIDE_LEVEL(entry.map, entry.gateLevel) : entry.map
);

/** 칭호 목록(기록 탭)이 그리는 안내 줄 — 지금 갈 수 있는 곳(가까운 순), 레벨이 모자란 곳, 계절 · 열쇠 지역. */
export const getEliteTitleGuideLines = (player: Pick<Player, 'titles' | 'level' | 'loc'>): string[] => {
    const guide = getEliteTitleGuide(player);
    if (guide.owned >= guide.total) return [MSG.ELITE_GUIDE_DONE];
    const lines: string[] = [];
    if (guide.reachable.length > 0) {
        lines.push(MSG.ELITE_GUIDE_NEAR(guide.reachable.length, joinLimited(guide.reachable.map((entry) => (
            entry.steps !== null && entry.steps > 0 ? MSG.ELITE_GUIDE_STEP(entry.map, entry.steps) : entry.map
        )))));
    }
    if (guide.upcoming.length > 0) lines.push(MSG.ELITE_GUIDE_NEXT(joinLimited(guide.upcoming.map(levelLabel))));
    if (guide.special.length > 0) lines.push(MSG.ELITE_GUIDE_SPECIAL(joinLimited(guide.special.map((entry) => entry.map))));
    lines.push(MSG.ELITE_GUIDE_HINT);
    return lines;
};

/** 계승 화면 요약의 다음 회차 안내 줄 — 걸어서 들어갈 곳이 남아 있지 않으면 null. */
export const getNextCycleEliteRouteLine = (titles: readonly string[] | null | undefined): string | null => {
    const route = getNextCycleEliteTitleRoute(titles);
    return route.length > 0 ? MSG.CYCLE_SUMMARY_ELITE_ROUTE(joinLimited(route.map(levelLabel))) : null;
};
