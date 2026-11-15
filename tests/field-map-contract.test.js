import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import {
    fieldDistances,
    generateFieldMap,
    getFieldChestCountRange,
    getFieldMapBand,
    getFieldMapSize,
} from '../src/systems/fieldMapGen.js';
import {
    createFieldMapState,
    getFieldDangerSignal,
    getFieldEncounterThreshold,
    getFieldMapLayout,
    getFieldNeighbor,
    getFieldRevealed,
    isFieldMapRegion,
    planFieldAutoStep,
    resolveFieldStep,
} from '../src/systems/fieldMapWalk.js';
import { isFieldAutoResumable } from '../src/utils/fieldAuto.js';

// 2026-11 지역 지도 걷기 — 설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §2 · §3 · §9 계약 2 · 3 · 4.

const HUNTING_REGIONS = Object.entries(DB.MAPS)
    .filter(([, map]) => map.type !== 'safe' && map.level !== 'infinite');

const SEEDS_PER_REGION = 12;

test('계약 3: 크기 구간 표 — 13 × 19에서 10레벨마다 +2칸, 7구간에서 멈춘다', () => {
    const expected = [[1, 13, 19], [15, 15, 21], [25, 17, 23], [35, 19, 25], [45, 21, 27], [55, 23, 29], [65, 25, 31], [75, 27, 33], [99, 27, 33]];
    for (const [level, width, height] of expected) {
        const size = getFieldMapSize(level);
        assert.deepEqual([size.width, size.height], [width, height], `Lv${level}`);
    }
    assert.deepEqual(getFieldChestCountRange(1), [3, 4]);
    assert.deepEqual(getFieldChestCountRange(25), [4, 5]);
    assert.deepEqual(getFieldChestCountRange(45), [5, 6]);
    assert.deepEqual(getFieldChestCountRange(75), [6, 7]);
    assert.equal(getFieldMapBand([12, 18]), 1, '범위 레벨은 최소값으로 읽는다');
});

test('계약 3: 모든 사냥 지역 × 시드 — 크기 · 상자 수가 표와 같고 입구에서 모든 출구 · 상자에 닿는다', () => {
    const bands = new Set();
    for (const [loc, map] of HUNTING_REGIONS) {
        const exits = map.exits ?? [];
        const size = getFieldMapSize(map.level);
        const [chestMin, chestMax] = getFieldChestCountRange(map.level);
        bands.add(size.band);
        for (let index = 0; index < SEEDS_PER_REGION; index += 1) {
            const layout = generateFieldMap(loc, index * 104729 + 17, map.level, exits);
            assert.equal(layout.width, size.width, loc);
            assert.equal(layout.height, size.height, loc);
            assert.equal(layout.tiles.length, size.width * size.height, loc);
            assert.equal(layout.emergency, false, `${loc} 시드 ${index}: 비상 지도로 떨어졌다`);
            assert.ok(layout.chests.length >= chestMin && layout.chests.length <= chestMax, `${loc} 상자 ${layout.chests.length}`);
            assert.deepEqual(layout.exits.map((exit) => exit.to), exits, `${loc} 출구는 지역 exits와 같다`);
            const distance = fieldDistances(layout.tiles, layout.width, layout.entrance);
            for (const spot of [...layout.exits, ...layout.chests]) {
                assert.ok(distance[spot.index] > 0, `${loc} 칸 ${spot.index}에 닿지 못한다`);
            }
            const occupied = [layout.entrance, ...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)];
            assert.equal(new Set(occupied).size, occupied.length, `${loc} 입구 · 출구 · 상자가 겹친다`);
        }
    }
    assert.equal(bands.size, 8, '사냥 지역이 8개 크기 구간을 모두 덮는다');
});

test('계약 2: 같은 지역 · 시드는 같은 지도, 다른 시드는 다른 지도', () => {
    const map = DB.MAPS['고요한 숲'];
    const a = generateFieldMap('고요한 숲', 4242, map.level, map.exits);
    const b = generateFieldMap('고요한 숲', 4242, map.level, [...map.exits]);
    const c = generateFieldMap('고요한 숲', 4243, map.level, map.exits);
    assert.deepEqual(a, b);
    assert.notEqual(a.tiles + a.chests.map((chest) => chest.index).join(), c.tiles + c.chests.map((chest) => chest.index).join());
});

test('새 지도는 방문마다 다르고, 위험은 이전 지도에서 이어진다', () => {
    const map = DB.MAPS['고요한 숲'];
    const player = { stats: { explores: 30 }, fieldMap: null };
    const first = createFieldMapState(player, '고요한 숲', map);
    const second = createFieldMapState({ ...player, fieldMap: { ...first, danger: 4.5 } }, '고요한 숲', map);
    assert.equal(first.seq, 1);
    assert.equal(second.seq, 2);
    assert.notEqual(first.seed, second.seed);
    assert.equal(second.danger, 4.5);
    assert.deepEqual(second.openedChests, []);
    const layout = getFieldMapLayout(first, map);
    assert.equal(first.pos, layout.entrance);
    assert.deepEqual(first.visited, [layout.entrance]);
});

test('시제품은 고요한 숲 하나만 지도를 쓴다', () => {
    assert.deepEqual([...BALANCE.FIELD_MAP_REGIONS], ['고요한 숲']);
    assert.equal(isFieldMapRegion('고요한 숲', DB.MAPS['고요한 숲']), true);
    assert.equal(isFieldMapRegion('서쪽 평원', DB.MAPS['서쪽 평원']), false);
    assert.equal(isFieldMapRegion('시작의 마을', DB.MAPS['시작의 마을']), false);
});

test('조우 문턱은 [6, 14] 안이고 탐험 수 · 지역의 해시다', () => {
    const seen = new Set();
    for (let explores = 0; explores < 400; explores += 1) {
        const threshold = getFieldEncounterThreshold({ stats: { explores } }, '고요한 숲');
        assert.ok(threshold >= BALANCE.FIELD_ENCOUNTER_MIN && threshold <= BALANCE.FIELD_ENCOUNTER_MAX);
        seen.add(threshold);
    }
    assert.equal(seen.size, BALANCE.FIELD_ENCOUNTER_MAX - BALANCE.FIELD_ENCOUNTER_MIN + 1, '문턱 범위 전체가 나온다');
    assert.equal(getFieldEncounterThreshold({ stats: { explores: 9 } }, '고요한 숲'), getFieldEncounterThreshold({ stats: { explores: 9 } }, '고요한 숲'));
});

/** 상자 · 출구 · 벽이 아닌 풀숲 칸과 그 이웃 방향을 찾는다 */
const findGrassStep = (layout, state) => {
    const reserved = new Set([...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index), layout.entrance]);
    for (let index = 0; index < layout.tiles.length; index += 1) {
        if (layout.tiles[index] !== ',' || reserved.has(index)) continue;
        for (const direction of ['up', 'down', 'left', 'right']) {
            const next = getFieldNeighbor(layout, index, direction);
            if (next !== null && layout.tiles[next] === ',' && !reserved.has(next)) {
                return { from: index, direction, to: next, state: { ...state, pos: index, visited: [index] } };
            }
        }
    }
    throw new Error('풀숲 두 칸을 찾지 못했다');
};

test('계약 4: 처음 밟는 풀숲은 위험 1, 이미 밟은 칸은 0, 벽은 막힌다', () => {
    const map = DB.MAPS['고요한 숲'];
    const state = createFieldMapState({ stats: { explores: 0 } }, '고요한 숲', map);
    const layout = getFieldMapLayout(state, map);
    const grass = findGrassStep(layout, state);
    const first = resolveFieldStep({ ...grass.state, danger: 0 }, layout, grass.direction, 99);
    assert.equal(first.outcome.kind, 'moved');
    assert.equal(first.state.danger, BALANCE.FIELD_DANGER_GRASS);
    assert.equal(first.state.pos, grass.to);
    const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[grass.direction];
    const returned = resolveFieldStep(first.state, layout, back, 99);
    assert.equal(returned.state.danger, BALANCE.FIELD_DANGER_GRASS, '이미 밟은 칸은 위험을 더하지 않는다');
    const again = resolveFieldStep(returned.state, layout, grass.direction, 99);
    assert.equal(again.state.danger, BALANCE.FIELD_DANGER_GRASS);
});

test('문턱에 닿으면 조우가 남고, 처리하기 전에는 걷지 않는다', () => {
    const map = DB.MAPS['고요한 숲'];
    const state = createFieldMapState({ stats: { explores: 0 } }, '고요한 숲', map);
    const layout = getFieldMapLayout(state, map);
    const grass = findGrassStep(layout, state);
    const hit = resolveFieldStep({ ...grass.state, danger: 5 }, layout, grass.direction, 6);
    assert.equal(hit.outcome.kind, 'encounter');
    assert.equal(hit.state.danger, 0);
    assert.deepEqual(hit.state.pending, { kind: 'encounter' });
    const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[grass.direction];
    const blocked = resolveFieldStep(hit.state, layout, back, 6);
    assert.equal(blocked.outcome.kind, 'blocked');
    assert.equal(blocked.state, hit.state, '처리할 일이 남아 있으면 같은 상태를 돌려준다');
});

test('상자는 한 번만 열리고, 출구는 그 지역을 처리할 일로 남긴다', () => {
    const map = DB.MAPS['고요한 숲'];
    const state = createFieldMapState({ stats: { explores: 3 } }, '고요한 숲', map);
    const layout = getFieldMapLayout(state, map);
    const chest = layout.chests[0];
    const neighbor = ['up', 'down', 'left', 'right']
        .map((direction) => ({ direction, from: getFieldNeighbor(layout, chest.index, direction) }))
        .find((entry) => entry.from !== null);
    const toward = { up: 'down', down: 'up', left: 'right', right: 'left' }[neighbor.direction];
    const opened = resolveFieldStep({ ...state, pos: neighbor.from }, layout, toward, 99);
    assert.deepEqual(opened.outcome, { kind: 'chest', chestId: chest.id });
    assert.deepEqual(opened.state.openedChests, [chest.id]);
    const away = resolveFieldStep(opened.state, layout, neighbor.direction, 99);
    const reopened = resolveFieldStep(away.state, layout, toward, 99);
    assert.equal(reopened.outcome.kind, 'moved');

    const exit = layout.exits[0];
    const exitNeighbor = ['up', 'down', 'left', 'right']
        .map((direction) => ({ direction, from: getFieldNeighbor(layout, exit.index, direction) }))
        .find((entry) => entry.from !== null);
    const exitToward = { up: 'down', down: 'up', left: 'right', right: 'left' }[exitNeighbor.direction];
    const left = resolveFieldStep({ ...state, pos: exitNeighbor.from }, layout, exitToward, 99);
    assert.deepEqual(left.outcome, { kind: 'exit', to: exit.to });
    assert.deepEqual(left.state.pending, { kind: 'exit', to: exit.to });
});

test('구슬은 문턱 대비 45 · 60 · 75%에서 단계가 오른다', () => {
    assert.equal(getFieldDangerSignal(0, 10), 0);
    assert.equal(getFieldDangerSignal(4.4, 10), 0);
    assert.equal(getFieldDangerSignal(4.5, 10), 1);
    assert.equal(getFieldDangerSignal(6, 10), 2);
    assert.equal(getFieldDangerSignal(7.5, 10), 3);
});

test('안개: 밟은 칸 주변 2칸이 밝혀진다', () => {
    const map = DB.MAPS['고요한 숲'];
    const state = createFieldMapState({ stats: { explores: 0 } }, '고요한 숲', map);
    const layout = getFieldMapLayout(state, map);
    const revealed = getFieldRevealed(layout, [layout.entrance]);
    // 입구는 아래 가장자리라 가로 5칸 × 세로 3칸
    assert.equal(revealed.size, 15);
    assert.ok(revealed.has(layout.entrance));
});

test('자동 경로는 상자를 모두 열고 출구를 밟지 않고 입구로 돌아온다(위험은 무시한 순수 경로)', () => {
    const map = DB.MAPS['고요한 숲'];
    for (let explores = 0; explores < 20; explores += 1) {
        let state = createFieldMapState({ stats: { explores } }, '고요한 숲', map);
        const layout = getFieldMapLayout(state, map);
        let steps = 0;
        for (let direction = planFieldAutoStep(state, layout); direction; direction = planFieldAutoStep(state, layout)) {
            const result = resolveFieldStep(state, layout, direction, Number.POSITIVE_INFINITY);
            assert.notEqual(result.outcome.kind, 'exit');
            assert.notEqual(result.outcome.kind, 'blocked');
            state = result.state;
            steps += 1;
            assert.ok(steps < 2000, '경로가 끝나지 않는다');
        }
        assert.equal(state.openedChests.length, layout.chests.length);
        assert.equal(state.pos, layout.entrance);
    }
});

test('자동 탐험은 입구로 돌아올 때까지 이어 가기다 — 돌아가는 길에 멈춰도 다시 켜면 횟수를 쓰지 않는다(설계 §7)', () => {
    const map = DB.MAPS['고요한 숲'];
    const start = { ...createFieldMapState({ stats: { explores: 7 } }, '고요한 숲', map), autoRun: true };
    const layout = getFieldMapLayout(start, map);
    assert.equal(isFieldAutoResumable(start, layout), true, '시작한 지도');
    const allOpened = layout.chests.map((chest) => chest.id);
    const away = layout.chests.find((chest) => chest.index !== layout.entrance).index;
    assert.equal(isFieldAutoResumable({ ...start, openedChests: allOpened, pos: away }, layout), true, '상자는 다 열었고 입구로 돌아가는 중');
    assert.equal(isFieldAutoResumable({ ...start, openedChests: allOpened, pos: layout.entrance }, layout), false, '입구에 돌아오면 끝');
    assert.equal(isFieldAutoResumable({ ...start, autoRun: false }, layout), false, '손으로 걷는 지도');
});
