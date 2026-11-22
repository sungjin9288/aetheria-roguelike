import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.ts';
import { generateFieldMap } from '../src/systems/fieldMapGen.ts';
import { getFieldNeighbor, isFieldMapRegion, resolveFieldStep } from '../src/systems/fieldMapWalk.ts';
import { canRepeatFieldStep, planFieldTapStep } from '../src/systems/fieldTapWalk.ts';

/**
 * 칸 눌러 걷기(2026-11 화면 B안)의 다음 걸음 — 어긋남 점검 결함 1 · 2 · 7(2026-11-22).
 * 1. 가는 길의 열지 않은 상자를 밟지 않는다(자동 걷기와 같은 판단 — 상자 · 미믹은 플레이어 몫, Wave 88). 점검 전에는 상자가 아닌 칸을
 *    누른 걸음의 12.7%가 가는 길에 상자를 열었다.
 * 2. 목표를 밟는 걸음은 `arrives`다 — 화면은 그 걸음을 보내고 목표를 지운다(들어갈 수 없는 출구에서 리듀서가 걸음을 거부해도 다시
 *    끌려가지 않는다).
 * 7. 방향 패드 반복은 열지 않은 상자 앞에서 멈춘다.
 */

const SEEDS = Array.from({ length: 4 }, (_, index) => index * 7919 + 11);
const REGIONS = Object.entries(DB.MAPS).filter(([loc, map]) => isFieldMapRegion(loc, map)).map(([loc]) => loc);
const NO_ENCOUNTER = Number.POSITIVE_INFINITY;

const layoutOf = (loc, seed) => {
    const map = DB.MAPS[loc];
    return generateFieldMap(loc, seed, map.level, map.exits ?? []);
};

const floorTiles = (layout) => [...layout.tiles].flatMap((char, index) => (char === '#' ? [] : [index]));

const freshState = (layout, visited) => ({
    loc: layout.loc, seq: 0, seed: layout.seed, pos: layout.entrance, visited, openedChests: [], danger: 0, pending: null,
});

/** 칸 눌러 걷기를 끝까지 — 걸음마다 화면이 하듯 다음 걸음을 다시 묻는다. 목표를 밟는 걸음을 보내면 멈춘다. */
const tapWalk = (start, layout, target) => {
    let field = start;
    const outcomes = [];
    for (let guard = 0; guard < layout.tiles.length; guard += 1) {
        const step = planFieldTapStep(field, layout, target, null);
        if (!step) return { field, outcomes, arrived: false };
        const result = resolveFieldStep(field, layout, step.direction, NO_ENCOUNTER, null);
        assert.equal(step.arrives, result.state.pos === target, `${layout.loc}: arrives는 이 걸음이 목표를 밟는지다`);
        outcomes.push({ kind: result.outcome.kind, pos: result.state.pos });
        field = { ...result.state, pending: null };
        if (step.arrives) return { field, outcomes, arrived: true };
    }
    assert.fail(`${layout.loc}: 칸 눌러 걷기가 끝나지 않는다`);
};

test('계약 1: 상자가 아닌 칸을 누르면 가는 길의 열지 않은 상자를 열지 않는다 — 사냥 지역 전부 × 시드 4 × 칸 셋 중 하나', () => {
    let walks = 0;
    let detoured = 0;
    for (const loc of REGIONS) {
        for (const seed of SEEDS) {
            const layout = layoutOf(loc, seed);
            const chestTiles = new Set(layout.chests.map((chest) => chest.index));
            const exitTiles = new Set(layout.exits.map((exit) => exit.index));
            const start = freshState(layout, floorTiles(layout)); // 지도가 다 밝혀졌다 — 길 선택이 가장 넓다
            for (const [order, target] of floorTiles(layout).entries()) {
                if (order % 3 !== seed % 3 || target === start.pos || chestTiles.has(target) || exitTiles.has(target)) continue;
                const { outcomes, arrived } = tapWalk(start, layout, target);
                walks += 1;
                assert.ok(outcomes.every((entry) => entry.kind !== 'chest'), `${loc}#${seed}: ${target}으로 가는 길에 상자를 열었다`);
                if (!arrived) detoured += 1;
            }
        }
    }
    assert.ok(walks > 3_000, `표본이 충분하다 (${walks})`);
    // 상자가 유일한 길을 막는 칸은 상자 앞에서 멈춘다 — 드물어야 한다(대부분은 돌아간다).
    assert.ok(detoured / walks < 0.05, `상자 앞에서 멈춘 걸음 ${detoured}/${walks}`);
});

test('계약 1: 상자를 누르면 그 상자까지 걸어가 연다', () => {
    let opened = 0;
    for (const loc of REGIONS.slice(0, 8)) {
        const layout = layoutOf(loc, SEEDS[0]);
        const start = freshState(layout, floorTiles(layout));
        for (const chest of layout.chests) {
            const { outcomes, arrived } = tapWalk(start, layout, chest.index);
            if (!arrived) continue; // 다른 상자가 유일한 길을 막는다
            assert.deepEqual(outcomes.filter((entry) => entry.kind === 'chest').map((entry) => entry.pos), [chest.index]);
            opened += 1;
        }
    }
    assert.ok(opened > 0);
});

test('계약 1: 상자가 유일한 길을 막으면 상자 바로 앞까지 걷고 멈춘다', () => {
    // # # # # # # #
    // # E . C . T #     E 입구(1,1) · C 상자(3,1) · T 목표(5,1)
    // # # # # # # #
    const layout = {
        loc: '시험', seed: 1, width: 7, height: 3,
        tiles: '#######' + '#.....#' + '#######',
        entrance: 8, exits: [], chests: [{ id: 0, index: 10 }], emergency: false,
    };
    const start = freshState(layout, [8, 9, 10, 11, 12]);
    const { field, outcomes, arrived } = tapWalk(start, layout, 12);
    assert.equal(arrived, false);
    assert.equal(field.pos, 9, '상자 바로 앞');
    assert.deepEqual(outcomes.map((entry) => entry.kind), ['moved']);
    // 상자를 열면 같은 목표로 끝까지 간다
    const afterChest = { ...field, openedChests: [0] };
    assert.equal(tapWalk(afterChest, layout, 12).arrived, true);
});

test('계약 2: 들어갈 수 없는 출구를 목표로 해도 마지막 걸음이 arrives다 — 화면은 그 걸음 뒤 목표를 지운다', () => {
    let checked = 0;
    for (const loc of REGIONS) {
        const layout = layoutOf(loc, SEEDS[1]);
        const start = freshState(layout, floorTiles(layout));
        for (const exit of layout.exits) {
            let field = start;
            let last = null;
            for (let guard = 0; guard < layout.tiles.length; guard += 1) {
                last = planFieldTapStep(field, layout, exit.index, null);
                if (!last || last.arrives) break;
                field = { ...resolveFieldStep(field, layout, last.direction, NO_ENCOUNTER, null).state, pending: null };
            }
            if (!last) continue; // 상자가 유일한 길을 막아 상자 앞에서 멈췄다(계약 1)
            assert.equal(last.arrives, true, `${loc}: ${exit.to} 출구로 가는 마지막 걸음`);
            assert.equal(getFieldNeighbor(layout, field.pos, last.direction), exit.index);
            checked += 1;
        }
    }
    assert.ok(checked > REGIONS.length, `출구 ${checked}곳`);
});

test('계약 2: 목표가 아닌 출구 · 보스 문은 밟지 않는다', () => {
    for (const loc of REGIONS.slice(0, 10)) {
        const layout = layoutOf(loc, SEEDS[2]);
        const start = freshState(layout, floorTiles(layout));
        const exitTiles = new Set(layout.exits.map((exit) => exit.index));
        const chestTiles = new Set(layout.chests.map((chest) => chest.index));
        const candidates = floorTiles(layout).filter((index) => !exitTiles.has(index) && !chestTiles.has(index) && index !== start.pos);
        const door = candidates[Math.floor(candidates.length / 2)];
        for (const target of candidates) {
            if (target === door) continue;
            let field = start;
            for (let guard = 0; guard < layout.tiles.length; guard += 1) {
                const step = planFieldTapStep(field, layout, target, door);
                if (!step) break;
                const next = getFieldNeighbor(layout, field.pos, step.direction);
                assert.ok(!exitTiles.has(next) && next !== door, `${loc}: ${target}으로 가며 출구 · 문을 밟았다`);
                if (step.arrives) break;
                field = { ...resolveFieldStep(field, layout, step.direction, NO_ENCOUNTER, null).state, pending: null };
            }
        }
    }
});

test('계약 7: 방향 패드 반복은 열지 않은 상자 앞에서 멈추고, 연 상자 · 빈 칸 · 벽 쪽은 이어 간다', () => {
    const layout = {
        loc: '시험', seed: 1, width: 5, height: 3,
        tiles: '#####' + '#...#' + '#####',
        entrance: 6, exits: [], chests: [{ id: 3, index: 7 }], emergency: false,
    };
    const field = { pos: 6, openedChests: [] };
    assert.equal(canRepeatFieldStep(field, layout, 'right'), false, '다음 칸이 열지 않은 상자');
    assert.equal(canRepeatFieldStep({ ...field, openedChests: [3] }, layout, 'right'), true, '연 상자');
    assert.equal(canRepeatFieldStep(field, layout, 'up'), true, '벽 — 리듀서가 거부한다');
    assert.equal(canRepeatFieldStep({ pos: 7, openedChests: [] }, layout, 'right'), true, '빈 칸');
});
