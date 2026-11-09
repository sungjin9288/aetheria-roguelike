import { CHAPTER_BANDS, type ChapterBand } from '../data/chapters.js';
import { MAPS } from '../data/maps.js';
import type { GameMap } from '../types/map.js';
import { getMapRouteGate } from './mapRouteGate.js';

/**
 * 2026-11 B1 · B6 (명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md` §1.2): 지역 → 장 번호.
 * 장 지역 = 안전지대가 아님 · 사냥감이 있음 · 무한 지역이 아님 · 걸어서 들어갈 수 있음(경로 게이트가 있음).
 * 안전지대(황금 왕국 포함) · 혼돈의 심연 · 계절 지역 · 고대 보물고는 장이 아니다(null).
 * 지도와 시작점만의 함수라 지도 객체마다 한 번만 계산한다.
 */
const chapterCache = new WeakMap<object, Map<string, number>>();

const isChapterRegion = (map: GameMap | undefined): boolean => (
    Boolean(map)
    && map?.type !== 'safe'
    && Array.isArray(map?.monsters)
    && (map?.monsters?.length ?? 0) > 0
    && map?.level !== 'infinite'
);

const bandForGate = (gate: number): ChapterBand => {
    let band = CHAPTER_BANDS[0];
    for (const candidate of CHAPTER_BANDS) {
        if (gate >= candidate.minGate) band = candidate;
    }
    return band;
};

const buildChapterTable = (maps: Record<string, GameMap>): Map<string, number> => {
    const table = new Map<string, number>();
    for (const [name, map] of Object.entries(maps)) {
        if (!isChapterRegion(map)) continue;
        const gate = getMapRouteGate(maps, name)?.routeGateLevel;
        if (typeof gate !== 'number' || !Number.isFinite(gate)) continue;
        table.set(name, bandForGate(gate).chapter);
    }
    return table;
};

const chapterTableFor = (maps: Record<string, GameMap>): Map<string, number> => {
    const cached = chapterCache.get(maps);
    if (cached) return cached;
    const table = buildChapterTable(maps);
    chapterCache.set(maps, table);
    return table;
};

/** 지역의 장 번호. 장이 아닌 곳 · 모르는 지역이면 null. */
export const getChapterOf = (loc: unknown, maps: Record<string, GameMap> = MAPS): number | null => {
    if (typeof loc !== 'string' || !loc) return null;
    return chapterTableFor(maps).get(loc) ?? null;
};

export const getChapterBand = (chapter: number): ChapterBand | null => (
    CHAPTER_BANDS.find((band) => band.chapter === chapter) ?? null
);

export const CHAPTER_COUNT = CHAPTER_BANDS.length;

/** 장마다 속한 지역(장 표 골든 · 화면용). */
export const getChapterRegions = (maps: Record<string, GameMap> = MAPS): Record<number, string[]> => {
    const result: Record<number, string[]> = {};
    for (const [name, chapter] of chapterTableFor(maps)) {
        result[chapter] = [...(result[chapter] ?? []), name];
    }
    return result;
};
