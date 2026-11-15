import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import {
    buildFieldMimic,
    getFieldChestReward,
    isFieldChestMimic,
    settleFieldMimicVictory,
} from '../src/systems/fieldChest.ts';
import { generateFieldMap } from '../src/systems/fieldMapGen.ts';
import {
    createFieldMapState,
    getFieldMapLayout,
    getFieldNeighbor,
} from '../src/systems/fieldMapWalk.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { getProtocolDayKey } from '../src/utils/protocolCycle.ts';
import { createDomainRandom } from '../src/utils/seededRandom.ts';

// 2026-11 지역 지도 걷기 — 설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §9 계약 5 ~ 10(리듀서 전이 · 범위 · 미믹 · 자동 탐험).

const LOC = BALANCE.FIELD_MAP_REGIONS[0];
const MAP = DB.MAPS[LOC];
const NOW = Date.UTC(2026, 10, 13, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const clone = (value) => structuredClone(value);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const basePlayer = (overrides = {}) => {
    const player = {
        ...clone(INITIAL_STATE.player),
        name: '걷는 사람',
        job: '전사',
        level: 10,
        loc: LOC,
        hp: 500,
        maxHp: 500,
        mp: 100,
        maxMp: 100,
        inv: [],
        ...overrides,
    };
    return { ...player, fieldMap: overrides.fieldMap === undefined ? createFieldMapState(player, LOC, MAP) : overrides.fieldMap };
};

const stateOf = (player, extra = {}) => ({ ...clone(INITIAL_STATE), bootStage: 'ready', gameState: GS.IDLE, player, ...extra });

/** 상자 칸 옆 빈 칸에 세우고, 상자로 걸어갈 방향을 돌려준다. */
const besideChest = (field, layout, chest) => {
    for (const direction of ['up', 'down', 'left', 'right']) {
        const next = getFieldNeighbor(layout, chest.index, direction);
        if (next === null || layout.chests.some((other) => other.index === next) || layout.exits.some((exit) => exit.index === next)) continue;
        return { field: { ...field, pos: next, visited: [...new Set([...field.visited, next])].sort((a, b) => a - b) }, direction: OPPOSITE[direction] };
    }
    throw new Error('상자 옆에 설 칸이 없다');
};

/** 미믹 상자가 있는 지도 시드를 찾는다(해시라 결정론). */
const findMimicSeed = () => {
    for (let seed = 1; seed < 20000; seed += 1) {
        const layout = generateFieldMap(LOC, seed, MAP.level, MAP.exits ?? []);
        const chest = layout.chests.find((entry) => isFieldChestMimic(LOC, seed, entry.id));
        if (chest) return { seed, chest };
    }
    throw new Error('미믹 상자가 있는 시드가 없다');
};

const withThrowingRandom = (run) => {
    const original = Math.random;
    Math.random = () => { throw new Error('지도 판정은 Math.random을 쓰지 않는다'); };
    try {
        return run();
    } finally {
        Math.random = original;
    }
};

test('계약 5: 지도 · 처리할 일은 player 안이라 세이브 봉투로 복원된다(조우 · 미믹 처리할 일 포함)', () => {
    const { seed, chest } = findMimicSeed();
    const fresh = basePlayer();
    const player = basePlayer({ fieldMap: { ...fresh.fieldMap, seed, openedChests: [chest.id], pending: { kind: 'mimic', chestId: chest.id } } });
    const loaded = gameReducer(clone(INITIAL_STATE), {
        type: AT.LOAD_DATA,
        payload: { player: clone(player), gameState: GS.IDLE, enemy: null, quickSlots: [] },
    });
    assert.deepEqual(loaded.player.fieldMap, player.fieldMap, '지도는 그대로 돌아온다');
    assert.equal(loaded.gameState, GS.IDLE);
});

test('계약 6: 지도 · 클리어 기록은 여정 범위, 그날 쓴 자동 탐험 횟수는 계정 범위다', () => {
    const autoRuns = { day: getProtocolDayKey(new Date(NOW)), used: 2 };
    const player = basePlayer({
        fieldClearedRegions: [LOC],
        stats: { ...clone(INITIAL_STATE.player.stats), fieldAutoRuns: autoRuns },
        meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 0, endgame: { lastEndgameReceiptKey: 'k' } },
    });
    const died = CombatEngine.handleDefeat(clone(player), clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
    const reset = gameReducer(stateOf(clone(player)), { type: AT.RESET_GAME }).player;
    const ascended = gameReducer(
        stateOf(clone(player), { gameState: GS.ASCENSION }),
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: 'k', seed: 1, challengeModifiers: [] } },
    ).player;
    for (const [label, next] of [['사망', died], ['다시 시작', reset], ['계승', ascended]]) {
        assert.ok(!next.fieldMap, `${label}: 지도가 남지 않는다`);
        assert.deepEqual(next.fieldClearedRegions ?? [], [], `${label}: 클리어 기록이 남지 않는다`);
        assert.deepEqual(next.stats.fieldAutoRuns, autoRuns, `${label}: 그날 쓴 자동 탐험 횟수는 되돌아오지 않는다`);
    }
});

test('계약 7: 걷기 · 상자 · 미믹 판정은 게임 난수를 쓰지 않고 탐험 수 · 기세를 바꾸지 않는다', () => {
    const player = basePlayer();
    const layout = getFieldMapLayout(player.fieldMap, MAP);
    const state = stateOf(player);
    let current = state;
    withThrowingRandom(() => {
        for (const direction of ['up', 'up', 'left', 'right', 'down', 'up', 'up', 'up']) {
            current = gameReducer(current, { type: AT.FIELD_STEP, payload: { direction, auto: false, now: NOW } });
        }
        const chest = layout.chests[0];
        const placed = besideChest(current.player.fieldMap, layout, chest);
        current = gameReducer(
            { ...current, player: { ...current.player, fieldMap: { ...placed.field, pending: null } } },
            { type: AT.FIELD_STEP, payload: { direction: placed.direction, auto: false, now: NOW } },
        );
    });
    assert.equal(current.player.stats.explores, state.player.stats.explores, '걷기는 탐험 수를 세지 않는다(조우 = explore()가 센다)');
    assert.deepEqual(current.player.stats.difficultyNotice, state.player.stats.difficultyNotice);
    // 같은 지도 · 상자는 언제나 같은 미믹 여부 · 보상이다(다시 불러와 바꿀 수 없다).
    for (const chest of layout.chests) {
        assert.equal(isFieldChestMimic(LOC, player.fieldMap.seed, chest.id), isFieldChestMimic(LOC, player.fieldMap.seed, chest.id));
        assert.deepEqual(
            getFieldChestReward(LOC, MAP, player.fieldMap.seed, chest.id),
            getFieldChestReward(LOC, MAP, player.fieldMap.seed, chest.id),
        );
    }
});

test('계약 7: 미믹 비율은 상자의 약 5%다(해시 분포)', () => {
    let mimics = 0;
    const samples = 20000;
    for (let index = 0; index < samples; index += 1) {
        if (isFieldChestMimic(LOC, index * 7919 + 3, index % 7)) mimics += 1;
    }
    const rate = mimics / samples;
    assert.ok(Math.abs(rate - BALANCE.FIELD_MIMIC_CHANCE) < 0.01, `미믹 비율 ${rate}`);
});

test('계약 8: 손으로 연 미믹 상자는 미믹 처리할 일, 자동 탐험이 연 같은 상자는 보통 상자다', () => {
    const { seed, chest } = findMimicSeed();
    const fresh = basePlayer();
    const field = { ...fresh.fieldMap, seed };
    const layout = getFieldMapLayout(field, MAP);
    const placed = besideChest(field, layout, chest);
    const player = basePlayer({ fieldMap: placed.field });

    const manual = gameReducer(stateOf(player), { type: AT.FIELD_STEP, payload: { direction: placed.direction, auto: false, now: NOW } });
    assert.deepEqual(manual.player.fieldMap.pending, { kind: 'mimic', chestId: chest.id });
    assert.equal(manual.player.gold, player.gold, '미믹 상자는 열 때 보상을 주지 않는다');

    const auto = gameReducer(stateOf(player), { type: AT.FIELD_STEP, payload: { direction: placed.direction, auto: true, now: NOW } });
    assert.equal(auto.player.fieldMap.pending, null, '자동 탐험에는 미믹이 없다');
    assert.ok(auto.player.fieldMap.openedChests.includes(chest.id));
    assert.ok(auto.player.gold > player.gold, '보통 상자 보상을 받는다');

    const cleared = gameReducer(manual, { type: AT.FIELD_CLEAR_PENDING, payload: { kind: 'mimic' } });
    assert.equal(cleared.player.fieldMap.pending, null);
    const wrongKind = gameReducer(manual, { type: AT.FIELD_CLEAR_PENDING, payload: { kind: 'encounter' } });
    assert.equal(wrongKind, manual, '다른 종류는 지우지 않는다(동일 참조)');
});

test('처리할 일이 남아 있거나 대기 상태가 아니면 걷지 않는다(동일 참조)', () => {
    const player = basePlayer();
    const pending = stateOf(basePlayer({ fieldMap: { ...player.fieldMap, pending: { kind: 'encounter' } } }));
    for (const direction of ['up', 'down', 'left', 'right']) {
        assert.equal(gameReducer(pending, { type: AT.FIELD_STEP, payload: { direction, now: NOW } }), pending);
    }
    const combat = stateOf(player, { gameState: GS.COMBAT });
    assert.equal(gameReducer(combat, { type: AT.FIELD_STEP, payload: { direction: 'up', now: NOW } }), combat);
    const elsewhere = stateOf({ ...player, loc: CONSTANTS.START_LOCATION });
    assert.equal(gameReducer(elsewhere, { type: AT.FIELD_STEP, payload: { direction: 'up', now: NOW } }), elsewhere);
});

test('계약 9: 자동 탐험은 클리어한 지역에서만, 하루 3번, 같은 지도의 이어 가기는 횟수를 쓰지 않는다', () => {
    const start = (state, now = NOW) => gameReducer(state, { type: AT.FIELD_AUTO_START, payload: { now } });
    const uncleared = stateOf(basePlayer());
    assert.equal(start(uncleared), uncleared, '클리어하지 않은 지역은 거부한다');

    let state = stateOf(basePlayer({ fieldClearedRegions: [LOC] }));
    const firstSeq = state.player.fieldMap.seq;
    state = start(state);
    assert.equal(state.player.fieldMap.autoRun, true);
    assert.equal(state.player.fieldMap.seq, firstSeq + 1, '새 지도에서 시작한다');
    assert.equal(state.player.stats.fieldAutoRuns.used, 1);

    const resumed = start(state);
    assert.equal(resumed, state, '상자가 남은 자동 탐험 지도에서는 다시 켜도 횟수를 쓰지 않는다');

    const finish = (s) => ({ ...s, player: { ...s.player, fieldMap: { ...s.player.fieldMap, openedChests: getFieldMapLayout(s.player.fieldMap, MAP).chests.map((c) => c.id) } } });
    state = start(finish(state));
    assert.equal(state.player.stats.fieldAutoRuns.used, 2);
    state = start(finish(state));
    assert.equal(state.player.stats.fieldAutoRuns.used, 3);
    const exhausted = finish(state);
    assert.equal(start(exhausted), exhausted, '그날 네 번째는 거부한다');

    const nextDay = start(exhausted, NOW + DAY);
    assert.equal(nextDay.player.stats.fieldAutoRuns.used, 1, '다음 날 다시 3번');
    assert.equal(nextDay.player.stats.fieldAutoRuns.day, getProtocolDayKey(new Date(NOW + DAY)));
});

test('계약 10: 미믹은 초반 지역 ×1.4 · 그 위 ×2.5이고 정예 목격 칭호를 남기지 않는다', () => {
    const player = basePlayer();
    const ref = { loc: LOC, seed: 42, chestId: 1 };
    const cases = [
        [LOC, BALANCE.FIELD_MIMIC_EARLY_MULT],
        [Object.keys(DB.MAPS).find((name) => {
            const map = DB.MAPS[name];
            const level = Array.isArray(map.level) ? map.level[0] : map.level;
            return map.type !== 'safe' && typeof level === 'number' && level > BALANCE.EARLY_ELITE_LEVEL_CAP + 10;
        }), BALANCE.FIELD_MIMIC_MULT],
    ];
    for (const [loc, mult] of cases) {
        const mapData = DB.MAPS[loc];
        const mimic = buildFieldMimic(player, mapData, { ...ref, loc });
        assert.ok(mimic, loc);
        // 바탕 개체 — buildFieldMimic과 같은 상자 도메인 난수로 만든 그 지역 '미믹'
        const base = spawnEnemy(mapData, player, [], { addLog: () => undefined }, {
            storyMonster: '미믹',
            rng: createDomainRandom(ref.seed, loc, ref.chestId, 'mimic-spawn'),
        }).mStats;
        assert.ok(base, loc);
        assert.equal(mimic.maxHp, Math.floor(base.maxHp * mult), `${loc}: 생명 ×${mult}`);
        assert.equal(mimic.atk, Math.floor(base.atk * mult), `${loc}: 공격력 ×${mult}`);
        assert.equal(mimic.gold, Math.floor(base.gold * mult), `${loc}: 골드 ×${mult}`);
        assert.ok(!mimic.isElite, `${loc}: 정예 목격 칭호를 남기지 않는다`);
        assert.ok(mimic.phase2, `${loc}: 정예처럼 격노한다`);
        assert.deepEqual(mimic.fieldMimic, { ...ref, loc });
        assert.deepEqual(buildFieldMimic(player, mapData, { ...ref, loc }), mimic, '같은 상자는 같은 미믹이다');
    }
});

test('계약 10: 미믹 승리 보상은 상자 보상의 골드 2배 · 지역 재료 확정이고 전투 난수와 무관하다', () => {
    const player = basePlayer({ gold: 0 });
    const ref = { loc: LOC, seed: 4242, chestId: 2 };
    const plain = getFieldChestReward(LOC, MAP, ref.seed, ref.chestId);
    const mimicReward = getFieldChestReward(LOC, MAP, ref.seed, ref.chestId, true);
    assert.equal(mimicReward.gold, plain.gold * BALANCE.FIELD_MIMIC_GOLD_MULT);
    const settled = settleFieldMimicVictory(player, { fieldMimic: ref }, NOW);
    assert.equal(settled.player.gold, mimicReward.gold);
    assert.equal(settled.player.inv.length, mimicReward.items.length);
    assert.equal(settleFieldMimicVictory(player, { fieldMimic: ref }, NOW).player.gold, settled.player.gold);
    assert.equal(settleFieldMimicVictory(player, null, NOW).player, player, '미믹이 아니면 그대로다');
});
