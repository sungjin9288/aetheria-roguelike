/**
 * questObjectiveGate.ts — 임무 목표 지역의 실제 진입 레벨 (2026-09 Wave 28, 소유자 결정 "수락은 두고 보드에 진입 Lv 표시").
 *
 * 임무 20개는 목표 지역에 걸어 들어갈 수 있게 되기 전에 수락된다(예: 84 기계 폐도 — 수락 Lv28, 실제 진입 Lv35).
 * 수락 규칙은 그대로 두고, 보드·추적기가 "목표 지역 실제 진입 레벨"을 말하게 한다. 값은 경로 게이트 authority
 * (`mapRouteGate.ts`, 실제 이동 규칙으로 걷는다)를 그대로 쓴다.
 *
 * 목표 지역 규칙은 도달 비용 리포트(`contentReachability.questObjectiveMaps`)와 같다: `location`이 있으면 그 지역,
 * 없으면 목표 몬스터가 조우되는 지역(안전지대는 조사 가능한 곳만) 중 경로 게이트가 가장 낮은 곳 — 같으면 이름의
 * 코드포인트 순서가 앞선 곳. 시스템 카운터 목표(level/explores…)나 걸어서 못 가는 지역뿐이면 null이다.
 * 두 구현이 같은 답을 내는지는 tests/quest-objective-gate.test.js가 전 임무로 대조한다.
 */
import { DB } from '../data/db';
import { getMapRouteGate } from './mapRouteGate';
import { canInvestigateTown } from './townInvestigation';
import type { GameMap, Quest } from '../types/index.js';

export interface QuestObjectiveGate {
    map: string;
    routeGateLevel: number;
}

type MapTable = Record<string, GameMap>;

const codePointCompare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const monsterNames = (map: GameMap) => [
    ...(Array.isArray(map.monsters) ? map.monsters : []),
    ...(Array.isArray(map.bossMonsters) ? map.bossMonsters : []),
    ...(typeof map.boss === 'string' ? [map.boss] : []),
];

const regionCache = new WeakMap<object, Map<string, string[]>>();

const monsterRegions = (maps: MapTable) => {
    const cached = regionCache.get(maps);
    if (cached) return cached;
    const regions = new Map<string, string[]>();
    for (const [name, map] of Object.entries(maps)) {
        if (map.type === 'safe' && !canInvestigateTown(name, map)) continue;
        for (const monster of monsterNames(map)) {
            regions.set(monster, [...(regions.get(monster) || []), name]);
        }
    }
    regionCache.set(maps, regions);
    return regions;
};

export const getQuestObjectiveGate = (
    quest: Pick<Quest, 'location' | 'target'> | null | undefined,
    maps: MapTable = DB.MAPS,
): QuestObjectiveGate | null => {
    if (!quest) return null;
    const candidates = quest.location
        ? (Object.hasOwn(maps, quest.location) ? [quest.location] : [])
        : [...new Set(monsterRegions(maps).get(String(quest.target ?? '')) || [])].sort(codePointCompare);
    let best: QuestObjectiveGate | null = null;
    for (const map of candidates) {
        const routeGateLevel = getMapRouteGate(maps, map)?.routeGateLevel;
        if (typeof routeGateLevel !== 'number') continue;
        if (!best || routeGateLevel < best.routeGateLevel) best = { map, routeGateLevel };
    }
    return best;
};

/** 지금 레벨로는 목표 지역에 아직 걸어 들어갈 수 없을 때만 안내를 돌려준다(이미 갈 수 있으면 null). */
export const getQuestObjectiveGateNotice = (
    quest: Pick<Quest, 'location' | 'target'> | null | undefined,
    playerLevel: number | undefined,
    maps: MapTable = DB.MAPS,
): QuestObjectiveGate | null => {
    const gate = getQuestObjectiveGate(quest, maps);
    return gate && gate.routeGateLevel > (playerLevel || 1) ? gate : null;
};
