import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { getFieldBiome } from '../systems/fieldBiome';
import { getFieldDoorIndex } from '../systems/fieldDoor';
import { getFieldNeighbor, getFieldTileDanger } from '../systems/fieldMapWalk';
import { getAreaBossName } from '../utils/bossGauge';
import type { FieldDirection, FieldMapLayout, FieldMapState } from '../types/fieldMap';

/**
 * 2026-11 오버월드 3단계 — QA 시드(`seedFieldMapScenario`)의 지도 모양. 프로덕션 번들에서는 테스트 API와 함께 빠진다.
 *   biome: 숲이 아닌 바이옴의 지도 지역(구역 보스가 있는 첫 지역) · door: 그 지역에서 열린 보스 문 바로 옆
 *   walkChest: 첫 지도 지역에서 위험한 칸이 하나 남았고 그 칸이 열지 않은 상자 옆 — 자동 걷기가 한 걸음 뒤 상자 앞에서 멈춘다.
 */

const DIRECTIONS: FieldDirection[] = ['up', 'right', 'down', 'left'];

const neighborsOf = (layout: FieldMapLayout, index: number): number[] => DIRECTIONS
    .map((direction) => getFieldNeighbor(layout, index, direction))
    .filter((next): next is number => next !== null);

const withVisited = (field: FieldMapState, extra: readonly number[]): number[] => (
    [...new Set([...field.visited, ...extra])].sort((a, b) => a - b)
);

/** 숲이 아닌 바이옴이고 구역 보스가 있는 첫 지도 지역(선언 레벨이 수인 곳) */
export const pickFieldQaBiomeRegion = (): string | null => BALANCE.FIELD_MAP_REGIONS.find((loc) => {
    const mapData = DB.MAPS[loc];
    return Boolean(mapData) && typeof mapData.level === 'number' && getAreaBossName(mapData) !== null
        && getFieldBiome(loc, mapData) !== 'forest';
}) ?? null;

/** 보스 문 옆 칸(상자 · 출구가 아닌 칸)에 세운 지도 — 문으로 가는 방향을 함께 돌려준다 */
export const buildFieldQaDoorMap = (field: FieldMapState, layout: FieldMapLayout): { field: FieldMapState; toward: FieldDirection } | null => {
    const door = getFieldDoorIndex(layout);
    if (door === null) return null;
    const reserved = new Set([...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
    const opposite: Record<FieldDirection, FieldDirection> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    for (const direction of DIRECTIONS) {
        const beside = getFieldNeighbor(layout, door, direction);
        if (beside === null || reserved.has(beside)) continue;
        return { field: { ...field, pos: beside, danger: 0, visited: withVisited(field, [beside]) }, toward: opposite[direction] };
    }
    return null;
};

/** 위험한 칸이 하나(열지 않은 상자 옆)만 남은 지도 — 그 칸 바로 옆에 선다. 상자 옆에서 시작하지 않는다. */
export const buildFieldQaWalkChestMap = (field: FieldMapState, layout: FieldMapLayout): FieldMapState | null => {
    const chestCells = new Set(layout.chests.map((chest) => chest.index));
    const exitCells = new Set(layout.exits.map((exit) => exit.index));
    const nearChest = (index: number) => neighborsOf(layout, index).some((next) => chestCells.has(next));
    for (const chest of layout.chests) {
        for (const target of neighborsOf(layout, chest.index)) {
            if (chestCells.has(target) || exitCells.has(target) || target === layout.entrance) continue;
            if (getFieldTileDanger(layout.tiles[target]) <= 0) continue;
            const start = neighborsOf(layout, target).find((index) => (
                layout.tiles[index] !== '#' && !chestCells.has(index) && !exitCells.has(index) && !nearChest(index)
            ));
            if (start === undefined) continue;
            const dangerous = [...layout.tiles].flatMap((char, index) => (getFieldTileDanger(char) > 0 && index !== target ? [index] : []));
            return { ...field, pos: start, danger: 0, visited: withVisited(field, [...dangerous, start]).filter((index) => index !== target) };
        }
    }
    return null;
};
