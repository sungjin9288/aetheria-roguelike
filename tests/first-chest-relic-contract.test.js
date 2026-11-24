import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { RELICS } from '../src/data/relics.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getFieldChestReward, isFieldChestMimic } from '../src/systems/fieldChest.ts';
import { createFieldMapState, getFieldMapLayout, getFieldNeighbor } from '../src/systems/fieldMapWalk.ts';
import { getFirstChestRelicOffer, isFirstChestRelicOpen } from '../src/systems/firstChestRelic.ts';
import { migrateData } from '../src/utils/dataMigration.ts';
import { getMapAccess } from '../src/utils/mapAccess.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';

// 2026-11 첫 여정의 첫 상자 — 명세 docs/PRE_PLAYTEST_FEATURES_2026-11.md §2.
//   계정의 첫 여정에서 처음 여는 상자는 미믹이 아니고 보통 보상에 더해 유물 3장 중 하나를 고르게 한다. 계정당 한 번이다.

const LOC = BALANCE.FIELD_MAP_REGIONS[0];
const MAP = DB.MAPS[LOC];
const NOW = Date.UTC(2026, 10, 24, 3, 0, 0);
const STARTED_AT = 1_790_000_000_000;
const clone = (value) => structuredClone(value);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DIRECTIONS = ['up', 'down', 'left', 'right'];

const freshPlayer = (overrides = {}) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base, name: '첫 걸음', loc: LOC, inv: [], fieldMap: null, ...overrides,
        stats: { ...base.stats, currentRun: { ...base.stats.currentRun, startedAt: STARTED_AT }, ...(overrides.stats || {}) },
    };
};
const stateOf = (player, extra = {}) => ({ ...clone(INITIAL_STATE), bootStage: 'ready', gameState: GS.IDLE, player, ...extra });
const withThrowingRandom = (run) => {
    const original = Math.random;
    Math.random = () => { throw new Error('첫 상자는 Math.random을 쓰지 않는다'); };
    try { return run(); } finally { Math.random = original; }
};

/** 상자 옆에 세운 상태와 상자로 가는 방향 — `pick`은 고를 상자 */
const besideChest = (player, seed, pick = () => true) => {
    const fresh = { ...createFieldMapState(player, LOC, MAP), seed };
    const layout = getFieldMapLayout(fresh, MAP);
    for (const chest of layout.chests.filter(pick)) {
        for (const direction of DIRECTIONS) {
            const pos = getFieldNeighbor(layout, chest.index, direction);
            if (pos === null || layout.chests.some((other) => other.index === pos) || layout.exits.some((exit) => exit.index === pos)) continue;
            return { chest, direction: OPPOSITE[direction], player: { ...player, fieldMap: { ...fresh, pos, visited: [...new Set([layout.entrance, pos])].sort((a, b) => a - b) } } };
        }
    }
    return null;
};
const step = (player, direction, extra = {}) => gameReducer(stateOf(player, extra), { type: AT.FIELD_STEP, payload: { direction, auto: false, now: NOW } });
const openChest = (player, seed = 11, pick) => {
    const spot = besideChest(player, seed, pick);
    assert.ok(spot, '상자 옆에 설 칸');
    return { ...spot, seed, state: step(spot.player, spot.direction) };
};
const findMimic = () => {
    for (let seed = 1; seed < 20_000; seed += 1) {
        const spot = besideChest(freshPlayer(), seed, (chest) => isFieldChestMimic(LOC, seed, chest.id));
        if (spot) return { seed, chestId: spot.chest.id };
    }
    throw new Error('미믹 상자를 찾지 못했다');
};

test('[자격] 사망 0 · 계승 0 · 받은 적 없음 · 유물을 얻은 적 없음일 때만 열린다', () => {
    assert.equal(isFirstChestRelicOpen(freshPlayer()), true);
    const closed = {
        '이미 받음': freshPlayer({ stats: { firstChestRelic: true } }),
        '사망한 계정': freshPlayer({ stats: { deaths: 1 } }),
        '계승한 계정': freshPlayer({ meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 1 } }),
        '유물을 가진 진행 중 세이브': freshPlayer({ relics: [clone(RELICS[0])] }),
        '유물을 얻은 적이 있는 세이브': freshPlayer({ stats: { relicCount: 2 } }),
    };
    for (const [label, player] of Object.entries(closed)) {
        assert.equal(isFirstChestRelicOpen(player), false, label);
        const { state } = openChest(player);
        assert.equal(state.pendingRelics, null, label);
    }
    assert.equal(isFirstChestRelicOpen(null), false);
});

test('[상자] 처음 여는 상자는 보통 보상에 유물 제안 · 장부를 같은 전이로 더한다', () => withThrowingRandom(() => {
    const before = freshPlayer();
    const { state, chest, seed } = openChest(before);
    const plain = openChest(freshPlayer({ stats: { firstChestRelic: true } }), seed);
    const reward = getFieldChestReward(LOC, MAP, seed, chest.id);
    assert.equal(state.player.gold - before.gold, reward.gold);
    assert.deepEqual(state.player.inv.map((item) => item.name), plain.state.player.inv.map((item) => item.name), '보통 상자와 같은 보상');
    assert.equal(state.player.gold, plain.state.player.gold);
    assert.equal(state.player.stats.firstChestRelic, true);
    assert.equal(state.pendingRelics.length, BALANCE.FIRST_CHEST_RELIC_CHOICES);
    assert.equal(new Set(state.pendingRelics.map((relic) => relic.id)).size, BALANCE.FIRST_CHEST_RELIC_CHOICES);
    for (const relic of state.pendingRelics) assert.ok(RELICS.some((entry) => entry.id === relic.id));
    assert.equal(state.player.relics.length, 0, '고르기 전에는 유물이 없다');
    assert.ok(state.logs.some((line) => line.text === MSG.FIRST_CHEST_RELIC_FOUND));
    assert.ok(plain.state.logs.every((line) => line.text !== MSG.FIRST_CHEST_RELIC_FOUND));
}));

test('[상자] 처음 여는 상자는 미믹이 아니고, 그 다음 미믹 상자는 그대로 미믹이다', () => {
    const { seed, chestId } = findMimic();
    const isIt = (chest) => chest.id === chestId;
    const first = openChest(freshPlayer(), seed, isIt);
    assert.equal(first.state.player.fieldMap.pending, null);
    assert.ok(first.state.player.fieldMap.openedChests.includes(chestId));
    assert.equal(first.state.pendingRelics.length, BALANCE.FIRST_CHEST_RELIC_CHOICES);
    const later = openChest(freshPlayer({ stats: { firstChestRelic: true } }), seed, isIt);
    assert.equal(later.state.player.fieldMap.pending.kind, 'mimic');
    assert.equal(later.state.pendingRelics, null);
});

test('[상자] 둘째 상자는 보통 상자다 — 고르든 넘기든 다시 열리지 않는다', () => {
    const { state, seed, chest } = openChest(freshPlayer());
    const resolve = {
        고르기: { type: AT.ADD_RELIC, payload: state.pendingRelics[0] },
        넘기기: { type: AT.DECLINE_RELIC },
    };
    for (const [label, action] of Object.entries(resolve)) {
        const after = gameReducer(state, action);
        assert.equal(after.pendingRelics, null, label);
        assert.equal(after.player.relics.length, label === '고르기' ? 1 : 0);
        const spot = besideChest(after.player, seed, (entry) => entry.id !== chest.id && !isFieldChestMimic(LOC, seed, entry.id));
        const next = step({ ...spot.player, fieldMap: { ...spot.player.fieldMap, openedChests: [chest.id] } }, spot.direction);
        assert.ok(next.player.fieldMap.openedChests.includes(spot.chest.id), label);
        assert.equal(next.pendingRelics, null, label);
    }
});

test('[후보] 기존 제안 생성기 · 지도 씨앗에서 나온다 — 같은 세이브면 같은 세 장이고 여정이 다르면 달라진다', () => withThrowingRandom(() => {
    const player = freshPlayer();
    const ref = { loc: LOC, seed: 11, chestId: 0 };
    const offer = getFirstChestRelicOffer(player, ref).map((relic) => relic.id);
    assert.deepEqual(getFirstChestRelicOffer(JSON.parse(JSON.stringify(player)), ref).map((relic) => relic.id), offer);
    const variants = new Set();
    for (let k = 0; k < 40; k += 1) {
        const other = freshPlayer({ stats: { currentRun: { ...player.stats.currentRun, startedAt: STARTED_AT + k } } });
        variants.add(getFirstChestRelicOffer(other, ref).map((relic) => relic.id).join('|'));
    }
    assert.ok(variants.size > 30, `새 계정마다 다른 패: ${variants.size}/40`);
    assert.notDeepEqual(getFirstChestRelicOffer(player, { ...ref, seed: 12 }).map((relic) => relic.id), offer, '지도 씨앗이 든다');
}));

test('[장부] 사망 · 다시 시작 · 계승이 장부를 넘긴다 — 다시 받지 못한다', () => {
    const { state } = openChest(freshPlayer());
    const player = gameReducer(state, { type: AT.DECLINE_RELIC }).player;
    for (const kind of ['death', 'ascension']) {
        assert.equal(pickPermanentPlayerState(player, INITIAL_STATE.player, kind).stats.firstChestRelic, true, kind);
    }
    const { updatedPlayer } = CombatEngine.handleDefeat(player, INITIAL_STATE.player, () => 0.5, () => 0);
    assert.equal(updatedPlayer.stats.firstChestRelic, true, '전투 패배');
    const reset = gameReducer(stateOf(player), { type: AT.RESET_GAME });
    assert.equal(reset.player.stats.firstChestRelic, true, '다시 시작');
    // 사망 수가 0이어도(다시 시작은 사망을 세지 않을 수 있다) 장부가 막는다.
    const replay = openChest({ ...freshPlayer(), stats: { ...freshPlayer().stats, ...reset.player.stats, deaths: 0, relicCount: 0 } });
    assert.equal(replay.state.pendingRelics, null);
    // 받지 않은 계정의 장부는 넘어간 뒤에도 비어 있다(없던 것이 생기지 않는다).
    assert.ok(!pickPermanentPlayerState(freshPlayer(), INITIAL_STATE.player, 'death').stats.firstChestRelic);
});

test('[저장] 유물 선택 중 다시 불러와도 같은 제안이 남고 장부가 남는다(봉투는 그대로)', () => {
    const { state } = openChest(freshPlayer());
    const envelope = JSON.parse(JSON.stringify({ player: state.player, gameState: state.gameState, enemy: null, pendingRelics: state.pendingRelics, version: CONSTANTS.DATA_VERSION }));
    const loaded = gameReducer({ ...clone(INITIAL_STATE), bootStage: 'booting' }, { type: AT.LOAD_DATA, payload: migrateData(envelope, { now: NOW }) });
    assert.deepEqual(loaded.pendingRelics.map((relic) => relic.id), state.pendingRelics.map((relic) => relic.id));
    assert.equal(loaded.player.stats.firstChestRelic, true);
    // 고르는 동안은 걷지 못한다 — 제안을 덮지 않는다.
    assert.equal(step(loaded.player, 'up', { pendingRelics: loaded.pendingRelics }).pendingRelics, loaded.pendingRelics);
});

test('[지도] 첫 여정이 들어갈 수 있는 지역의 지도마다 출구를 밟지 않고 걸어서 닿는 상자가 하나 이상이다', () => {
    const start = CONSTANTS.START_LOCATION;
    const firstRegions = BALANCE.FIELD_MAP_REGIONS.filter((loc) => (DB.MAPS[start].exits || []).includes(loc) && !getMapAccess(DB.MAPS, start, loc, 1, false).reason);
    assert.ok(firstRegions.includes(LOC), `첫 지도: ${firstRegions}`);
    for (const loc of firstRegions) {
        for (let explores = 0; explores < 300; explores += 1) {
            const player = freshPlayer({ loc, stats: { explores } });
            const field = createFieldMapState(player, loc, DB.MAPS[loc]);
            const layout = getFieldMapLayout(field, DB.MAPS[loc]);
            const exits = new Set(layout.exits.map((exit) => exit.index));
            const reached = new Set([field.pos]);
            const queue = [field.pos];
            while (queue.length > 0) {
                const index = queue.shift();
                for (const direction of DIRECTIONS) {
                    const next = getFieldNeighbor(layout, index, direction);
                    if (next === null || reached.has(next) || exits.has(next)) continue;
                    reached.add(next);
                    queue.push(next);
                }
            }
            assert.ok(layout.chests.some((chest) => reached.has(chest.index)), `${loc} 탐험 ${explores}`);
        }
    }
});
