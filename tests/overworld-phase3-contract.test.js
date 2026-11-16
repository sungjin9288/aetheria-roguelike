import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { MSG } from '../src/data/messages.ts';
import { RELICS } from '../src/data/relics.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { createFieldActions } from '../src/hooks/gameActions/fieldActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { planFieldAutoWalk } from '../src/systems/fieldAutoWalk.ts';
import { FIELD_BIOMES, getFieldBiome } from '../src/systems/fieldBiome.ts';
import { getFieldDoor, getFieldDoorIndex, isFieldDoorOpen } from '../src/systems/fieldDoor.ts';
import { fieldDistances, generateFieldMap } from '../src/systems/fieldMapGen.ts';
import {
    createFieldMapState,
    getFieldMapLayout,
    getFieldNeighbor,
    getFieldTileDanger,
    isFieldMapRegion,
    planFieldAutoStep,
    resolveFieldStep,
} from '../src/systems/fieldMapWalk.ts';
import { buildAreaBossChallengeCard } from '../src/utils/bossChallengeCard.ts';
import { getAreaBossName, getBossGaugeValue, isAreaBossChallengeable, markBossGaugeEvaded } from '../src/utils/bossGauge.ts';
import { getFieldWalkStopText, isFieldAutoWalkUnlocked, planPlayerFieldAutoWalk } from '../src/utils/fieldAuto.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

/**
 * 2026-11 오버월드 3단계(설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §11 · 소유자 결정 2026-11-16) — 모든 사냥 지역의 지도 ·
 * 바이옴 8종 · 보스 문 · 자동 걷기. 지도 생성기의 지역 × 시드 계약(크기 · 상자 · 도달)은 field-map-contract 계약 3이 모든 사냥
 * 지역으로 지킨다 — 여기서는 3단계가 더한 규칙을 실제 모듈로 잰다.
 */

const SEEDS = Array.from({ length: 24 }, (_, index) => index * 7919 + 11);
const FIELD_REGIONS = Object.entries(DB.MAPS).filter(([loc, map]) => isFieldMapRegion(loc, map)).map(([loc]) => loc);
const DOOR_LOC = '신성한 호수';
const DOOR_MAP = DB.MAPS[DOOR_LOC];
const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');
const HIGH = () => 0.99;

const layoutOf = (loc, seed) => {
    const map = DB.MAPS[loc];
    return generateFieldMap(loc, seed, map.level, map.exits ?? []);
};

const withThrowingRandom = (run) => {
    const original = Math.random;
    Math.random = () => { throw new Error('3단계 판정은 Math.random을 쓰지 않는다'); };
    try {
        return run();
    } finally {
        Math.random = original;
    }
};

const doorPlayer = (statsExtra = {}, overrides = {}) => {
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: '문지기', job: '나이트', level: 14, hp: 5_000, maxHp: 5_000, mp: 300, maxMp: 300, loc: DOOR_LOC,
        relics: [structuredClone(HARMLESS_RELIC)],
        eventChainProgress: { ...ALL_CHAINS_DONE },
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            visitedMaps: ['시작의 마을', DOOR_LOC],
            bossGauge: { [DOOR_LOC]: 1 },
            exploresByLocation: { [DOOR_LOC]: 10 },
            ...statsExtra,
        },
        ...overrides,
    };
    return { ...player, fieldMap: createFieldMapState(player, DOOR_LOC, DOOR_MAP) };
};

const stateOf = (player, extra = {}) => ({
    ...structuredClone(INITIAL_STATE), bootStage: 'ready', logs: [], gameState: GS.IDLE, player, ...extra,
});

const harness = (state) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    return { get: () => current, dispatch, addLog };
};

const depsOf = (state, h, rng = HIGH) => ({
    player: state.player,
    gameState: state.gameState,
    currentEvent: state.currentEvent,
    uid: 'test-user',
    dispatch: h.dispatch,
    addLog: h.addLog,
    addStoryLog: () => {},
    getFullStats: () => calculateFullStats(h.get().player),
    rng,
});

const processPending = async (state) => {
    const h = harness(state);
    const deps = depsOf(state, h);
    await createFieldActions(deps, { explore: () => undefined, move: () => undefined }).processFieldPending();
    return h.get();
};

const choose = (state, index) => {
    const h = harness(state);
    createEventActions(depsOf(state, h), { emitUnlockedTitles: () => {} }).handleEventChoice(index);
    return h.get();
};

const explore = async (state) => {
    const h = harness(state);
    const deps = depsOf(state, h);
    await createExploreActions(deps, makeSharedHelpers({ player: state.player, dispatch: h.dispatch, addLog: h.addLog })).explore();
    return h.get();
};

/** 문 옆 칸에 세우고 문으로 걸어갈 방향을 돌려준다(위험을 비워 조우가 끼지 않게). */
const besideDoor = (player) => {
    const layout = getFieldMapLayout(player.fieldMap, DOOR_MAP);
    const door = getFieldDoorIndex(layout);
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    for (const direction of ['up', 'down', 'left', 'right']) {
        const next = getFieldNeighbor(layout, door, direction);
        if (next === null || layout.chests.some((chest) => chest.index === next) || layout.exits.some((exit) => exit.index === next)) continue;
        const field = { ...player.fieldMap, pos: next, danger: 0, visited: [...new Set([...player.fieldMap.visited, next])].sort((a, b) => a - b) };
        return { player: { ...player, fieldMap: field }, direction: opposite[direction], door, layout };
    }
    throw new Error('문 옆에 설 칸이 없다');
};

// ── 지역 · 바이옴 ─────────────────────────────────────────────────────────────

test('바이옴: 지도 지역마다 8종 중 하나이고 8종 모두 쓰인다 — 길 잃은 여행은 폐허, 첫 숲은 2단계 그대로 숲', () => {
    const used = new Set();
    for (const loc of FIELD_REGIONS) {
        const biome = getFieldBiome(loc, DB.MAPS[loc]);
        assert.ok(FIELD_BIOMES.includes(biome), `${loc}: ${biome}`);
        used.add(biome);
        assert.equal(getFieldBiome(loc, DB.MAPS[loc], true), 'ruin', `${loc}: 길 잃은 여행이면 중립`);
    }
    assert.deepEqual([...used].sort(), [...FIELD_BIOMES].sort(), '바이옴 8종이 모두 어느 지역에 쓰인다');
    assert.equal(getFieldBiome('고요한 숲', DB.MAPS['고요한 숲']), 'forest');
});

// ── 보스 문 ──────────────────────────────────────────────────────────────────

test('문 자리: 모든 지도 지역 × 시드 — 걸을 수 있고 입구 · 출구 · 상자가 아니며, 길목이 아닌(막아도 다른 모든 칸에 닿는) 칸 중 입구에서 가장 멀다', () => {
    withThrowingRandom(() => {
        for (const loc of FIELD_REGIONS) {
            for (const seed of SEEDS) {
                const layout = layoutOf(loc, seed);
                const door = getFieldDoorIndex(layout);
                assert.notEqual(door, null, `${loc} #${seed}: 문 자리가 있다`);
                const distance = fieldDistances(layout.tiles, layout.width, layout.entrance);
                assert.ok(distance[door] > 0, `${loc} #${seed}: 입구에서 닿는다`);
                assert.notEqual(layout.tiles[door], '#');
                assert.notEqual(door, layout.entrance);
                assert.ok(!layout.exits.some((exit) => exit.index === door) && !layout.chests.some((chest) => chest.index === door));
                const blocked = `${layout.tiles.slice(0, door)}#${layout.tiles.slice(door + 1)}`;
                const without = fieldDistances(blocked, layout.width, layout.entrance);
                // 문 너머에 갇힌 칸이 없다 — 게이지가 어디서 차든 문을 밟지 않고 지도의 모든 칸 · 출구 · 상자로 갈 수 있다.
                for (let index = 0; index < blocked.length; index += 1) {
                    if (blocked[index] === '#' || index === layout.entrance) continue;
                    assert.ok(without[index] > 0, `${loc} #${seed}: 문이 칸 ${index}로 가는 유일한 길을 막지 않는다`);
                }
                // 가장 멀다 — 길목이 아닌 후보 중 문보다 먼 칸은 없다.
                const reserved = new Set([layout.entrance, ...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
                for (let index = 0; index < distance.length; index += 1) {
                    if (distance[index] <= distance[door] || reserved.has(index)) continue;
                    const cut = `${layout.tiles.slice(0, index)}#${layout.tiles.slice(index + 1)}`;
                    const reach = fieldDistances(cut, layout.width, layout.entrance);
                    const isCut = [...cut].some((char, other) => char !== '#' && other !== layout.entrance && reach[other] <= 0);
                    assert.ok(isCut, `${loc} #${seed}: 문(${distance[door]})보다 먼 칸 ${index}(${distance[index]})는 길목이다`);
                }
                assert.equal(getFieldDoorIndex(layoutOf(loc, seed)), door, '같은 지도 = 같은 문 자리');
            }
        }
    });
});

test('문은 구역 보스에 도전할 수 있고 게이지가 찼을 때만 보인다 — 회피 기록은 문을 숨기지 않는다', () => {
    const player = doorPlayer();
    const layout = getFieldMapLayout(player.fieldMap, DOOR_MAP);
    assert.equal(isAreaBossChallengeable(DOOR_MAP, player), true);
    assert.equal(getFieldDoor(player, DOOR_LOC, DOOR_MAP, layout), getFieldDoorIndex(layout));
    const notFull = doorPlayer({ bossGauge: { [DOOR_LOC]: 0.6 } });
    assert.equal(isFieldDoorOpen(notFull, DOOR_LOC, DOOR_MAP), false, '게이지가 차지 않았다');
    const defeated = doorPlayer({ areaBossDefeated: { [DOOR_MAP.boss]: true } });
    assert.equal(isAreaBossChallengeable(DOOR_MAP, defeated), false);
    assert.equal(isFieldDoorOpen(defeated, DOOR_LOC, DOOR_MAP), false, '이미 잡은 구역 보스(임무가 부르지 않음)');
    const evaded = { ...player, stats: markBossGaugeEvaded(player, DOOR_LOC) };
    assert.equal(isFieldDoorOpen(evaded, DOOR_LOC, DOOR_MAP), true, '회피 기록(탐험 카드의 억제)은 문을 숨기지 않는다');
    const noBoss = FIELD_REGIONS.find((loc) => !getAreaBossName(DB.MAPS[loc]));
    if (noBoss) assert.equal(isFieldDoorOpen({ ...player, loc: noBoss }, noBoss, DB.MAPS[noBoss]), false, `${noBoss}: 구역 보스 없음`);
});

test('문을 밟으면 처리할 일이 남고(위험 · 탐험 수 그대로), 닫혀 있으면 보통 칸이다 — 난수 없음', () => {
    const { player, direction, door } = besideDoor(doorPlayer());
    const state = stateOf(player);
    const stepped = withThrowingRandom(() => gameReducer(state, { type: AT.FIELD_STEP, payload: { direction, auto: false, now: 1 } }));
    assert.equal(stepped.player.fieldMap.pos, door);
    assert.deepEqual(stepped.player.fieldMap.pending, { kind: 'door' });
    assert.equal(stepped.player.fieldMap.danger, player.fieldMap.danger, '문 칸은 위험을 더하지 않는다');
    assert.equal(stepped.player.stats.explores, player.stats.explores);

    const closed = stateOf({ ...player, stats: { ...player.stats, bossGauge: { [DOOR_LOC]: 0.5 } } });
    const plain = gameReducer(closed, { type: AT.FIELD_STEP, payload: { direction, auto: false, now: 1 } });
    assert.equal(plain.player.fieldMap.pos, door);
    assert.notDeepEqual(plain.player.fieldMap.pending, { kind: 'door' }, '닫힌 문 자리는 보통 칸');
});

test('문의 처리할 일은 탐험의 카드와 같은 카드를 열고, 도전은 같은 구역 보스 전투다', async () => {
    const { player, direction } = besideDoor(doorPlayer());
    const stepped = gameReducer(stateOf(player), { type: AT.FIELD_STEP, payload: { direction, auto: false, now: 1 } });
    const opened = await processPending(stepped);
    assert.equal(opened.gameState, GS.EVENT);
    assert.equal(opened.player.fieldMap.pending, null, '처리할 일은 지운 뒤 넘긴다');
    const expected = buildAreaBossChallengeCard(stepped.player, DOOR_MAP, { door: true });
    assert.deepEqual(opened.currentEvent, expected);
    assert.equal(opened.currentEvent.isBossGaugeChallenge, true);
    assert.equal(opened.currentEvent.bossName, DOOR_MAP.boss);
    // 문 카드와 탐험 카드는 물러남 문구만 다르다(위협 · 보스 · 도전 선택지 같다).
    const exploreCard = buildAreaBossChallengeCard(stepped.player, DOOR_MAP);
    assert.equal(opened.currentEvent.desc, exploreCard.desc);
    assert.deepEqual(opened.currentEvent.choices[0], exploreCard.choices[0]);
    assert.equal(opened.player.stats.explores, player.stats.explores, '문은 탐험이 아니다');

    const fought = choose(opened, 0);
    assert.equal(fought.gameState, GS.COMBAT);
    assert.equal(fought.enemy?.isBoss, true);
    assert.equal(fought.enemy?.baseName, DOOR_MAP.boss, '카드의 보스와 같은 구역 보스');
    assert.equal(getBossGaugeValue(fought.player, DOOR_LOC), 0, '도전하면 게이지가 비워진다(문이 닫힌다)');
});

test('문 앞에서 물러나면 지도로 돌아간다 — 게이지 · 문 그대로, 회피 기록 · 이어지는 탐험 롤 없음, 난수 없음', async () => {
    const { player, direction } = besideDoor(doorPlayer());
    const stepped = gameReducer(stateOf(player), { type: AT.FIELD_STEP, payload: { direction, auto: false, now: 1 } });
    const opened = await processPending(stepped);
    const avoided = withThrowingRandom(() => choose(opened, 1));
    assert.equal(avoided.gameState, GS.IDLE);
    assert.equal(avoided.currentEvent, null);
    assert.equal(avoided.enemy, null);
    assert.equal(getBossGaugeValue(avoided.player, DOOR_LOC), 1);
    assert.equal(avoided.player.stats.bossGaugeEvadedAt?.[DOOR_LOC], undefined, '회피 기록을 남기지 않는다');
    assert.ok(avoided.logs.some((log) => log.text === MSG.FIELD_DOOR_AVOID_LOG));
    assert.equal(isFieldDoorOpen(avoided.player, DOOR_LOC, DOOR_MAP), true, '문은 남는다');
});

test('지도 지역의 탐험(조우)은 카드를 띄우지 않는다 — 게이지가 차 있어도 다음 분기로 간다', async () => {
    const player = doorPlayer();
    const after = await explore(stateOf(player));
    assert.notEqual(after.currentEvent?.isBossGaugeChallenge, true);
    assert.equal(after.player.stats.explores, player.stats.explores + 1);
});

test('자동 탐험(하루 횟수)의 걸음도 문을 밟지 않는다', () => {
    const player = doorPlayer();
    const layout = getFieldMapLayout(player.fieldMap, DOOR_MAP);
    const door = getFieldDoorIndex(layout);
    let field = { ...player.fieldMap, danger: 0 };
    for (let step = 0; step < layout.width * layout.height * 2; step += 1) {
        const direction = planFieldAutoStep(field, layout, door);
        if (!direction) break;
        const next = resolveFieldStep({ ...field, danger: 0 }, layout, direction, 1_000, door);
        assert.notEqual(next.state.pos, door, '자동 탐험은 문 칸을 피한다');
        field = { ...next.state, pending: null };
    }
});

// ── 자동 걷기 ─────────────────────────────────────────────────────────────────

/** 자동 걷기를 끝까지 — 멈추면 상자를 열어 준(사람이 연 것처럼) 뒤 다시 켠다. 조우는 문턱을 크게 두어 끼지 않게 한다. */
const runAutoWalk = (loc, seed, door) => {
    const layout = layoutOf(loc, seed);
    let field = { loc, seq: 1, seed, pos: layout.entrance, visited: [layout.entrance], openedChests: [], danger: 0, pending: null };
    const acknowledged = [];
    const exits = layout.exits.map((exit) => exit.index);
    const stops = [];
    const limit = layout.width * layout.height * 6;
    for (let step = 0; step < limit; step += 1) {
        const plan = planFieldAutoWalk(field, layout, { door, exits, acknowledgedChests: acknowledged });
        if (plan.kind === 'stop') {
            stops.push(plan);
            if (plan.reason !== 'chest') return { field, layout, stops, steps: step };
            const chest = layout.chests.find((entry) => entry.id === plan.chestId);
            const around = ['up', 'down', 'left', 'right'].map((d) => getFieldNeighbor(layout, field.pos, d));
            assert.ok(around.includes(chest.index), `${loc} #${seed}: 상자 옆에서 멈춘다`);
            acknowledged.push(plan.chestId);
            continue;
        }
        const next = resolveFieldStep({ ...field, danger: 0 }, layout, plan.direction, 1_000, door);
        assert.equal(next.state.pos !== field.pos, true, `${loc} #${seed}: 걸음은 언제나 움직인다`);
        const chestAt = layout.chests.find((chest) => chest.index === next.state.pos);
        assert.ok(!chestAt, `${loc} #${seed}: 자동 걷기는 상자를 열지 않는다(칸 ${next.state.pos})`);
        assert.ok(!layout.exits.some((exit) => exit.index === next.state.pos), '지역을 스스로 떠나지 않는다');
        assert.notEqual(next.state.pos, door, '보스에 스스로 도전하지 않는다');
        field = { ...next.state, pending: null };
    }
    throw new Error(`${loc} #${seed}: 자동 걷기가 ${limit}걸음 안에 끝나지 않았다`);
};

test('자동 걷기: 모든 지도 지역 × 시드 — 상자를 열지 않고 상자마다 한 번 멈추며, 위험한 칸을 다 밟고 출구 옆에서 끝난다(난수 없음)', () => {
    withThrowingRandom(() => {
        for (const loc of FIELD_REGIONS) {
            for (const seed of SEEDS.slice(0, 8)) {
                const { field, layout, stops } = runAutoWalk(loc, seed, null);
                const final = stops[stops.length - 1];
                assert.ok(['exit', 'stuck'].includes(final.reason), `${loc} #${seed}: ${final.reason}`);
                const chestStops = stops.filter((stop) => stop.reason === 'chest').map((stop) => stop.chestId);
                assert.equal(new Set(chestStops).size, chestStops.length, '같은 상자에서 두 번 멈추지 않는다');
                // 닿을 수 있는 위험한 칸(상자 · 출구를 지나지 않고)은 모두 밟았다.
                const blocked = new Set([...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
                const seen = new Set([layout.entrance]);
                const queue = [layout.entrance];
                while (queue.length > 0) {
                    const current = queue.shift();
                    for (const direction of ['up', 'down', 'left', 'right']) {
                        const next = getFieldNeighbor(layout, current, direction);
                        if (next === null || seen.has(next) || blocked.has(next)) continue;
                        seen.add(next);
                        queue.push(next);
                    }
                }
                for (const index of seen) {
                    if (getFieldTileDanger(layout.tiles[index]) > 0) assert.ok(field.visited.includes(index), `${loc} #${seed}: 칸 ${index}`);
                }
            }
        }
    });
});

test('자동 걷기: 문이 보이면 출구가 아니라 문 옆에서 멈춘다', () => {
    const player = doorPlayer();
    const layout = getFieldMapLayout(player.fieldMap, DOOR_MAP);
    const door = getFieldDoorIndex(layout);
    const { field, stops } = runAutoWalk(DOOR_LOC, player.fieldMap.seed, door);
    assert.equal(stops[stops.length - 1].reason, 'door');
    const around = ['up', 'down', 'left', 'right'].map((d) => getFieldNeighbor(layout, field.pos, d));
    assert.ok(around.includes(door));
});

test('자동 걷기: 첫 전직 뒤에만 쓰고, 지금 레벨로 들어갈 수 없는 출구는 목표로 삼지 않으며, 멈춤 문구는 행동을 권하지 않는다', () => {
    assert.equal(isFieldAutoWalkUnlocked({ job: '모험가' }), false);
    assert.equal(isFieldAutoWalkUnlocked({ job: '전사' }), true);
    const player = doorPlayer({}, { level: 1 });
    const layout = getFieldMapLayout(player.fieldMap, DOOR_MAP);
    const plan = withThrowingRandom(() => planPlayerFieldAutoWalk(player, { ...player.fieldMap, visited: layout.tiles.split('').map((_, index) => index) }, layout));
    assert.equal(plan.kind, 'step', '레벨 1에서도 문(보이는)으로 걸어간다');
    for (const reason of ['chest', 'door', 'exit', 'stuck']) {
        assert.equal(getFieldWalkStopText(reason, player), MSG.FIELD_WALK_STOPPED(MSG.FIELD_WALK_STOP_REASON[reason]));
    }
    assert.equal(getFieldWalkStopText('manual', player), MSG.FIELD_WALK_STOPPED_MANUAL);
    assert.equal(getFieldWalkStopText('boss', player), MSG.FIELD_WALK_STOPPED(MSG.FIELD_AUTO_STOP_REASON.boss));
    assert.ok(BALANCE.FIELD_AUTO_WALK_STEP_MS > 0);
});
