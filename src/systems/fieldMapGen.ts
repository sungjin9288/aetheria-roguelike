import { BALANCE } from '../data/constants';
import { createSeededRandom, deriveSeed, type RandomSource } from '../utils/seededRandom';
import type { FieldChestSpot, FieldExit, FieldMapLayout, FieldTileChar } from '../types/fieldMap';

/**
 * 2026-11 지역 지도 생성(설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §2). 순수 함수 — 같은 지역 · 시드면 같은 지도다.
 * 게임 난수(`actionRng`)는 쓰지 않는다. 방 → 복도(주 루프 + 가지) → 출구 · 상자 순서로 만들고, 입구에서 모든 출구 · 상자에
 * 닿는지 BFS로 검사한다. 실패하면 다음 시드로 다시 만들고, 상한을 넘으면 고정 비상 지도다.
 */

interface Room {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface FieldMapSize {
    band: number;
    width: number;
    height: number;
}

const ROOM_MIN = 3;
const ROOM_MAX = 5;
const ROOM_TRIES_PER_ROOM = 30;
const MIN_ROOMS = 3;
const DEEP_ROOM_CHANCE = 0.3;
const CHEST_FAR_SHARE = 0.5;
const LAYOUT_CACHE_LIMIT = 8;

const randInt = (rng: RandomSource, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** 지역 선언 레벨 — 범위([최소, 최대])면 최소, `'infinite'`는 대상 밖이라 0 구간으로 읽는다. */
export type FieldMapLevel = number | readonly number[] | string | undefined;

export const getFieldMapBand = (level: FieldMapLevel): number => {
    const numeric = Number(Array.isArray(level) ? level[0] : level);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.min(BALANCE.FIELD_MAP_SIZE_MAX_BAND, Math.floor(numeric / 10));
};

export const getFieldMapSize = (level: FieldMapLevel): FieldMapSize => {
    const band = getFieldMapBand(level);
    return {
        band,
        width: BALANCE.FIELD_MAP_WIDTH_BASE + BALANCE.FIELD_MAP_SIZE_STEP * band,
        height: BALANCE.FIELD_MAP_HEIGHT_BASE + BALANCE.FIELD_MAP_SIZE_STEP * band,
    };
};

/** 상자 수 범위 — [최소, 최대] */
export const getFieldChestCountRange = (level: FieldMapLevel): [number, number] => {
    const base = BALANCE.FIELD_CHEST_BASE + Math.floor(getFieldMapBand(level) / 2);
    return [base, base + BALANCE.FIELD_CHEST_EXTRA_MAX];
};

export const toIndex = (width: number, x: number, y: number) => y * width + x;
export const toCoord = (width: number, index: number) => ({ x: index % width, y: Math.floor(index / width) });

const roomCenter = (room: Room) => ({
    x: room.x + Math.floor(room.w / 2),
    y: room.y + Math.floor(room.h / 2),
});

const overlaps = (a: Room, b: Room) => (
    a.x - 1 <= b.x + b.w && b.x - 1 <= a.x + a.w && a.y - 1 <= b.y + b.h && b.y - 1 <= a.y + a.h
);

const placeRooms = (rng: RandomSource, width: number, height: number, band: number): Room[] => {
    const target = 4 + band;
    const rooms: Room[] = [];
    for (let tries = 0; tries < target * ROOM_TRIES_PER_ROOM && rooms.length < target; tries += 1) {
        const w = randInt(rng, ROOM_MIN, ROOM_MAX);
        const h = randInt(rng, ROOM_MIN, ROOM_MAX);
        // 바깥 두 줄은 벽 · 출구 자리로 남긴다
        const room = { x: randInt(rng, 2, width - w - 2), y: randInt(rng, 2, height - h - 2), w, h };
        if (rooms.every((other) => !overlaps(room, other))) rooms.push(room);
    }
    return rooms;
};

const carveCorridor = (grid: FieldTileChar[], width: number, from: { x: number; y: number }, to: { x: number; y: number }, horizontalFirst: boolean) => {
    const carve = (x: number, y: number) => {
        const index = toIndex(width, x, y);
        if (grid[index] === '#') grid[index] = '.';
    };
    let { x, y } = from;
    const stepX = () => { while (x !== to.x) { carve(x, y); x += Math.sign(to.x - x); } };
    const stepY = () => { while (y !== to.y) { carve(x, y); y += Math.sign(to.y - y); } };
    if (horizontalFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    carve(x, y);
};

/** 입구에서 각 칸까지의 걸음 수(벽 · 닿지 않는 칸은 -1) */
export const fieldDistances = (tiles: string, width: number, start: number): Int32Array => {
    const distance = new Int32Array(tiles.length).fill(-1);
    const queue = [start];
    distance[start] = 0;
    for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head];
        const { x, y } = toCoord(width, current);
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= width || ny >= tiles.length / width) continue;
            const next = toIndex(width, nx, ny);
            if (distance[next] !== -1 || tiles[next] === '#') continue;
            distance[next] = distance[current] + 1;
            queue.push(next);
        }
    }
    return distance;
};

type Edge = 'top' | 'left' | 'right' | 'bottom';
const EXIT_EDGES: Edge[] = ['top', 'left', 'right', 'bottom'];

const edgePoint = (edge: Edge, along: number, width: number, height: number) => {
    if (edge === 'top') return { x: along, y: 0, inner: { x: along, y: 1 } };
    if (edge === 'bottom') return { x: along, y: height - 1, inner: { x: along, y: height - 2 } };
    if (edge === 'left') return { x: 0, y: along, inner: { x: 1, y: along } };
    return { x: width - 1, y: along, inner: { x: width - 2, y: along } };
};

const nearestRoomCenter = (rooms: Room[], point: { x: number; y: number }) => rooms
    .map(roomCenter)
    .reduce((best, center) => (
        Math.abs(center.x - point.x) + Math.abs(center.y - point.y) < Math.abs(best.x - point.x) + Math.abs(best.y - point.y) ? center : best
    ));

const pickEdgeSpot = (rng: RandomSource, edge: Edge, width: number, height: number, taken: Array<{ x: number; y: number }>) => {
    const span = edge === 'top' || edge === 'bottom' ? width : height;
    for (let tries = 0; tries < 40; tries += 1) {
        const along = randInt(rng, 2, span - 3);
        const point = edgePoint(edge, along, width, height);
        if (taken.every((other) => Math.abs(other.x - point.x) + Math.abs(other.y - point.y) > 2)) return point;
    }
    return null;
};

const placeChests = (
    rng: RandomSource,
    tiles: string,
    width: number,
    entrance: number,
    reserved: Set<number>,
    count: number,
): FieldChestSpot[] => {
    const distance = fieldDistances(tiles, width, entrance);
    // 방 칸(풀숲 · 깊은 곳)만 후보이고, 입구에서 먼 쪽 절반을 먼저 고른다(설계 §5 "막다른 길 · 가지 끝 우선")
    const candidates = [...tiles].flatMap((tile, index) => (
        (tile === ',' || tile === ';') && distance[index] > 0 && !reserved.has(index) ? [index] : []
    )).sort((a, b) => distance[b] - distance[a] || a - b);
    const farCount = Math.max(count, Math.ceil(candidates.length * CHEST_FAR_SHARE));
    const pools = [candidates.slice(0, farCount), candidates.slice(farCount)];
    const chosen: number[] = [];
    const spaced = (index: number) => chosen.every((other) => {
        const a = toCoord(width, index);
        const b = toCoord(width, other);
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= BALANCE.FIELD_CHEST_MIN_SPACING;
    });
    for (const pool of pools) {
        const bag = [...pool];
        while (chosen.length < count && bag.length > 0) {
            const pick = bag.splice(Math.floor(rng() * bag.length), 1)[0];
            if (spaced(pick)) chosen.push(pick);
        }
    }
    return chosen.map((index, id) => ({ id, index }));
};

const isReachable = (layout: Omit<FieldMapLayout, 'emergency'>) => {
    const distance = fieldDistances(layout.tiles, layout.width, layout.entrance);
    return [...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]
        .every((index) => distance[index] > 0);
};

const tryGenerate = (loc: string, seed: number, level: FieldMapLevel, exitsTo: string[]): FieldMapLayout | null => {
    const rng = createSeededRandom(seed);
    const { band, width, height } = getFieldMapSize(level);
    const rooms = placeRooms(rng, width, height, band);
    if (rooms.length < MIN_ROOMS) return null;

    const grid: FieldTileChar[] = new Array(width * height).fill('#');
    rooms.forEach((room, roomIndex) => {
        const deep = roomIndex > 0 && rng() < DEEP_ROOM_CHANCE;
        for (let y = room.y; y < room.y + room.h; y += 1) {
            for (let x = room.x; x < room.x + room.w; x += 1) grid[toIndex(width, x, y)] = deep ? ';' : ',';
        }
    });
    // 주 루프: 방 중심을 각도 순으로 이어 한 바퀴, 가지: 무작위 방 쌍 몇 개
    const centers = rooms.map(roomCenter);
    const mid = { x: width / 2, y: height / 2 };
    const loop = centers
        .map((center, index) => ({ index, angle: Math.atan2(center.y - mid.y, center.x - mid.x) }))
        .sort((a, b) => a.angle - b.angle)
        .map((entry) => centers[entry.index]);
    loop.forEach((center, index) => {
        carveCorridor(grid, width, center, loop[(index + 1) % loop.length], rng() < 0.5);
    });
    const branches = 1 + Math.floor(band / 2);
    for (let branch = 0; branch < branches; branch += 1) {
        carveCorridor(grid, width, centers[randInt(rng, 0, centers.length - 1)], centers[randInt(rng, 0, centers.length - 1)], rng() < 0.5);
    }

    // 입구는 아래 가장자리, 출구는 위 · 왼쪽 · 오른쪽 · 아래 순으로 돌아가며 놓는다
    const taken: Array<{ x: number; y: number }> = [];
    const entrancePoint = pickEdgeSpot(rng, 'bottom', width, height, taken);
    if (!entrancePoint) return null;
    taken.push(entrancePoint);
    carveCorridor(grid, width, entrancePoint.inner, nearestRoomCenter(rooms, entrancePoint.inner), rng() < 0.5);
    grid[toIndex(width, entrancePoint.x, entrancePoint.y)] = '.';

    const exits: FieldExit[] = [];
    for (let exitIndex = 0; exitIndex < exitsTo.length; exitIndex += 1) {
        const spot = pickEdgeSpot(rng, EXIT_EDGES[exitIndex % EXIT_EDGES.length], width, height, taken);
        if (!spot) return null;
        taken.push(spot);
        carveCorridor(grid, width, spot.inner, nearestRoomCenter(rooms, spot.inner), rng() < 0.5);
        grid[toIndex(width, spot.x, spot.y)] = '.';
        exits.push({ index: toIndex(width, spot.x, spot.y), to: exitsTo[exitIndex] });
    }

    const tiles = grid.join('');
    const entrance = toIndex(width, entrancePoint.x, entrancePoint.y);
    const [chestMin] = getFieldChestCountRange(level);
    const chestCount = chestMin + randInt(rng, 0, BALANCE.FIELD_CHEST_EXTRA_MAX);
    const reserved = new Set([entrance, ...exits.map((exit) => exit.index)]);
    const chests = placeChests(rng, tiles, width, entrance, reserved, chestCount);
    if (chests.length !== chestCount) return null;

    const layout = { loc, seed, width, height, tiles, entrance, exits, chests };
    return isReachable(layout) ? { ...layout, emergency: false } : null;
};

/** 고정 비상 지도 — 테두리 벽 안이 모두 풀숲이고 가운데 십자 길이 있다. 언제나 모든 출구 · 상자에 닿는다. */
const buildEmergencyLayout = (loc: string, seed: number, level: FieldMapLevel, exitsTo: string[]): FieldMapLayout => {
    const { width, height } = getFieldMapSize(level);
    const grid: FieldTileChar[] = new Array(width * height).fill('#');
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) grid[toIndex(width, x, y)] = x === cx || y === cy ? '.' : ',';
    }
    const entrance = toIndex(width, cx, height - 1);
    grid[entrance] = '.';
    const exitSpots = [toIndex(width, cx, 0), toIndex(width, 0, cy), toIndex(width, width - 1, cy), toIndex(width, 2, height - 1),
        toIndex(width, width - 3, height - 1), toIndex(width, 2, 0), toIndex(width, width - 3, 0)];
    const exits = exitsTo.slice(0, exitSpots.length).map((to, index) => {
        grid[exitSpots[index]] = '.';
        return { index: exitSpots[index], to };
    });
    const [chestMin] = getFieldChestCountRange(level);
    const corners = [toIndex(width, 1, 1), toIndex(width, width - 2, 1), toIndex(width, 1, height - 2), toIndex(width, width - 2, height - 2),
        toIndex(width, 1, cy - 2), toIndex(width, width - 2, cy - 2), toIndex(width, 1, cy + 2)];
    const chests = corners.slice(0, chestMin).map((index, id) => ({ id, index }));
    return { loc, seed, width, height, tiles: grid.join(''), entrance, exits, chests, emergency: true };
};

const layoutCache = new Map<string, FieldMapLayout>();

/** 지도 하나 — 결과는 시드로 결정된다(같은 입력 = 같은 지도, 캐시는 성능용). */
export const generateFieldMap = (loc: string, seed: number, level: FieldMapLevel, exitsTo: string[]): FieldMapLayout => {
    const key = `${loc}|${seed}|${level}|${exitsTo.join(',')}`;
    const cached = layoutCache.get(key);
    if (cached) return cached;
    let layout: FieldMapLayout | null = null;
    for (let attempt = 0; attempt < BALANCE.FIELD_MAP_GEN_ATTEMPTS && !layout; attempt += 1) {
        layout = tryGenerate(loc, attempt === 0 ? seed : deriveSeed(seed, 'retry', attempt), level, exitsTo);
    }
    const result = layout ? { ...layout, seed } : buildEmergencyLayout(loc, seed, level, exitsTo);
    if (layoutCache.size >= LAYOUT_CACHE_LIMIT) layoutCache.delete(layoutCache.keys().next().value as string);
    layoutCache.set(key, result);
    return result;
};
