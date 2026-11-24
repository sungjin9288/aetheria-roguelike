import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { MSG } from '../src/data/messages.ts';
import FieldTraitPanel from '../src/components/field/FieldTraitPanel.tsx';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { createFieldActions } from '../src/hooks/gameActions/fieldActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getFieldChestReward, isFieldChestMimic } from '../src/systems/fieldChest.ts';
import { fieldDistances } from '../src/systems/fieldMapGen.ts';
import { createFieldMapState, getFieldEncounterThreshold, getFieldMapLayout, getFieldNeighbor, isFieldMapRegion } from '../src/systems/fieldMapWalk.ts';
import {
    FIELD_OTHER_TRAITS,
    FIELD_TRAITS,
    applyFieldTraitToLayout,
    getActiveFieldTrait,
    getFieldTraitEffects,
    getFieldTraitOffer,
    isFieldTraitChoiceOpen,
    readFieldTrait,
} from '../src/systems/fieldTrait.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import { getScoutAvailability, shouldTriggerScout } from '../src/utils/scoutEvents.ts';
import { deriveSeed } from '../src/utils/seededRandom.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { renderStatic, sliceElementByTestId } from './helpers/render.ts';

// 2026-11 지도 갈래 — 명세 docs/PRE_PLAYTEST_FEATURES_2026-11.md §1.
//   클리어한 지역의 새 지도에서만 성격을 고르고, 고르지 않은 지도(plain)는 지금 지도와 같다. 새 추첨은 없다.

const clone = (value) => structuredClone(value);
const NOW = Date.UTC(2026, 10, 24, 3, 0, 0);
const REGIONS = BALANCE.FIELD_MAP_REGIONS.filter((loc) => isFieldMapRegion(loc, DB.MAPS[loc]));
const levelOf = (loc) => Number(Array.isArray(DB.MAPS[loc].level) ? DB.MAPS[loc].level[0] : DB.MAPS[loc].level);
const EARLY = REGIONS.find((loc) => levelOf(loc) <= BALANCE.EARLY_ELITE_LEVEL_CAP);
const LATE = REGIONS.find((loc) => levelOf(loc) >= 20 && !(DB.MAPS[loc].bossMonsters || []).length);

const playerAt = (loc, overrides = {}) => {
    const base = {
        ...clone(INITIAL_STATE.player),
        name: '걷는 사람', job: '전사', level: 40, loc, hp: 900, maxHp: 900, mp: 100, maxMp: 100, inv: [],
        fieldClearedRegions: [loc],
        ...overrides,
        stats: { ...clone(INITIAL_STATE.player.stats), firstChestRelic: true, ...(overrides.stats || {}) },
    };
    return { ...base, fieldMap: 'fieldMap' in overrides ? overrides.fieldMap : createFieldMapState(base, loc, DB.MAPS[loc]) };
};
const stateOf = (player, extra = {}) => ({ ...clone(INITIAL_STATE), bootStage: 'ready', gameState: GS.IDLE, player, ...extra });
const choose = (state, trait, seq = state.player.fieldMap.seq) => gameReducer(state, { type: AT.FIELD_CHOOSE_TRAIT, payload: { seq, trait, now: NOW } });
const withThrowingRandom = (run) => {
    const original = Math.random;
    Math.random = () => { throw new Error('지도 갈래는 Math.random을 쓰지 않는다'); };
    try { return run(); } finally { Math.random = original; }
};
/** 그 성격이 패에 있는 새 지도의 플레이어(순번을 올려 찾는다 — 해시라 결정론). */
const playerOffering = (loc, trait) => {
    for (let seq = 1; seq < 200; seq += 1) {
        const base = playerAt(loc);
        const fieldMap = { ...base.fieldMap, seq, seed: deriveSeed(seq, loc, 'trait-test') };
        const layout = getFieldMapLayout(fieldMap, DB.MAPS[loc]);
        const player = { ...base, fieldMap: { ...fieldMap, pos: layout.entrance, visited: [layout.entrance] } };
        if (getFieldTraitOffer(player, player.fieldMap, DB.MAPS[loc]).includes(trait)) return player;
    }
    throw new Error(`${loc}에서 ${trait} 패를 찾지 못했다`);
};

// ── ① 성격 표 ────────────────────────────────────────────────────────────

test('[표] 성격은 다섯이고, 보통 지도는 모든 값이 중립이며, 나머지는 얻는 것과 치르는 것이 하나씩 있다', () => {
    assert.deepEqual([...FIELD_TRAITS], ['plain', 'elite', 'chest', 'event', 'quiet']);
    assert.deepEqual(Object.keys(BALANCE.FIELD_TRAIT_EFFECTS).sort(), [...FIELD_TRAITS].sort());
    assert.deepEqual(getFieldTraitEffects('plain'), { encounterSteps: 1, chests: 0, eliteChance: 0, events: 1, chestGold: 1, chestMaterial: 0 });
    const gains = (fx) => [fx.encounterSteps > 1, fx.chests > 0, fx.events > 1, fx.chestGold > 1, fx.chestMaterial > 0].filter(Boolean).length;
    const costs = (fx) => [fx.encounterSteps < 1, fx.chests < 0, fx.eliteChance > 0].filter(Boolean).length;
    for (const trait of FIELD_OTHER_TRAITS) {
        const fx = getFieldTraitEffects(trait);
        assert.ok(gains(fx) >= 1, `${trait} 얻는 것`);
        assert.equal(costs(fx), 1, `${trait} 치르는 것`);
    }
});

test('[표] 저장된 값이 없거나 모르는 값이면 보통 지도다', () => {
    for (const value of [undefined, null, '', 'boss', 3, {}]) assert.equal(readFieldTrait({ trait: value }), 'plain');
    assert.equal(readFieldTrait(null), 'plain');
    const player = playerAt(LATE, { fieldMap: { ...playerAt(LATE).fieldMap, trait: 'chest' } });
    assert.equal(getActiveFieldTrait(player), 'chest');
    assert.equal(getActiveFieldTrait({ ...player, loc: CONSTANTS.START_LOCATION }), 'plain', '떠난 지역의 지도는 다른 지역에 남지 않는다');
});

// ── ② 패 ────────────────────────────────────────────────────────────────

test('[패] 언제나 보통 지도 1장 + 다른 성격 1 ~ 2장이고, 같은 씨앗이면 같은 패다 — 난수를 쓰지 않는다', () => withThrowingRandom(() => {
    const counts = new Map();
    const sizes = new Set();
    for (const loc of REGIONS) {
        const player = playerAt(loc);
        for (let seed = 1; seed <= 60; seed += 1) {
            const offer = getFieldTraitOffer(player, { loc, seed }, DB.MAPS[loc]);
            sizes.add(offer.length);
            assert.equal(offer[0], 'plain');
            assert.equal(new Set(offer).size, offer.length, '중복 없음');
            assert.ok(offer.length === 2 || offer.length === 3, `${loc} ${offer}`);
            assert.deepEqual(getFieldTraitOffer(player, { loc, seed }, DB.MAPS[loc]), offer);
            offer.forEach((trait) => counts.set(trait, (counts.get(trait) || 0) + 1));
        }
    }
    assert.deepEqual([...sizes].sort(), [2, 3]);
    for (const trait of FIELD_OTHER_TRAITS) assert.ok(counts.get(trait) > 100, `${trait}이 실제로 나온다: ${counts.get(trait)}`);
}));

test('[패] 정예 성격은 초반 구간 · 강적의 길 회차에 나오지 않는다(Wave 28 · 115)', () => {
    const early = REGIONS.filter((loc) => levelOf(loc) <= BALANCE.EARLY_ELITE_LEVEL_CAP);
    assert.ok(early.length > 0);
    for (let seed = 1; seed <= 300; seed += 1) {
        for (const loc of early) assert.ok(!getFieldTraitOffer(playerAt(loc), { loc, seed }, DB.MAPS[loc]).includes('elite'), loc);
        assert.ok(!getFieldTraitOffer(playerAt(LATE, { challengeModifiers: ['eliteOnly'] }), { loc: LATE, seed }, DB.MAPS[LATE]).includes('elite'));
    }
});

// ── ③ 고를 수 있는 때 ────────────────────────────────────────────────────

test('[때] 클리어한 지역의 새 지도 입구에서 고르기 전에만 열린다', () => {
    const player = playerAt(LATE);
    assert.equal(isFieldTraitChoiceOpen(player), true);
    const closed = {
        '클리어하지 않은 지역(첫 지도)': { ...player, fieldClearedRegions: [] },
        '다른 지역만 클리어': { ...player, fieldClearedRegions: [EARLY] },
        '다른 지역에 있다': { ...player, loc: CONSTANTS.START_LOCATION },
        '지도 없음': { ...player, fieldMap: null },
        '이미 고름': { ...player, fieldMap: { ...player.fieldMap, trait: 'plain' } },
        '자동 탐험의 지도': { ...player, fieldMap: { ...player.fieldMap, autoRun: true } },
        '한 걸음 걸음': { ...player, fieldMap: { ...player.fieldMap, visited: [...player.fieldMap.visited, player.fieldMap.pos + 1] } },
        '상자를 연 지도': { ...player, fieldMap: { ...player.fieldMap, openedChests: [0] } },
        '처리할 일이 남음': { ...player, fieldMap: { ...player.fieldMap, pending: { kind: 'encounter' } } },
    };
    for (const [label, value] of Object.entries(closed)) assert.equal(isFieldTraitChoiceOpen(value), false, label);
});

// ── ④ 리듀서 전이 ────────────────────────────────────────────────────────

test('[전이] 패에 있는 성격을 한 번 정한다 — 순번이 다르거나 패 밖이거나 걸을 수 없는 때면 동일 참조다', () => withThrowingRandom(() => {
    const player = playerOffering(LATE, 'chest');
    const state = stateOf(player);
    const chosen = choose(state, 'chest');
    assert.equal(chosen.player.fieldMap.trait, 'chest');
    assert.deepEqual({ ...chosen.player.fieldMap, trait: undefined }, { ...player.fieldMap, trait: undefined }, '지도의 나머지는 그대로다');
    assert.equal(chosen.logs.at(-1).text, MSG.FIELD_TRAIT_CHOSEN(MSG.FIELD_TRAIT_NAME.chest));
    assert.equal(choose(chosen, 'plain'), chosen, '두 번 고르지 못한다');
    const outside = FIELD_OTHER_TRAITS.find((trait) => !getFieldTraitOffer(player, player.fieldMap, DB.MAPS[LATE]).includes(trait));
    for (const [label, result] of Object.entries({
        '다른 순번': choose(state, 'chest', player.fieldMap.seq + 1),
        '패 밖': choose(state, outside),
        '모르는 성격': choose(state, 'boss'),
    })) assert.equal(result, state, label);
    for (const extra of [{ gameState: GS.COMBAT }, { pendingRelics: [{ id: 'x' }] }, { postCombatResult: {} }, { currentEvent: {} }]) {
        const blocked = stateOf(player, extra);
        assert.equal(choose(blocked, 'chest'), blocked, JSON.stringify(Object.keys(extra)));
    }
    const fresh = stateOf({ ...player, fieldClearedRegions: [] });
    assert.equal(choose(fresh, 'chest'), fresh, '첫 지도는 고르지 않는다');
}));

test('[전이] 닫기는 보통 지도다 — 기록 줄 없이 정해지고, 고르지 않고 걸어도 같은 지도 · 같은 걸음이다', () => {
    const state = stateOf(playerAt(LATE));
    const skipped = choose(state, 'plain');
    assert.equal(skipped.player.fieldMap.trait, 'plain');
    assert.equal(skipped.logs, state.logs);
    const walk = (start) => ['up', 'right', 'down', 'left', 'up', 'right'].reduce((current, direction) => (
        gameReducer(current, { type: AT.FIELD_STEP, payload: { direction, auto: false, now: NOW } })
    ), start);
    const a = walk(state).player.fieldMap;
    const b = walk(skipped).player.fieldMap;
    assert.equal(a.trait, undefined, '걷기를 막지 않는다');
    assert.deepEqual({ ...a, trait: 'plain' }, b);
    assert.equal(isFieldTraitChoiceOpen(walk(state).player), false, '걸으면 보통 지도로 닫힌다');
});

test('[전이] 화면 액션은 전이 하나를 부른다', () => {
    const dispatched = [];
    createFieldActions({ player: playerAt(LATE), gameState: GS.IDLE, dispatch: (action) => dispatched.push(action), addLog: () => assert.fail('기록은 리듀서 소유') })
        .fieldChooseTrait(3, 'quiet');
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, AT.FIELD_CHOOSE_TRAIT);
    assert.deepEqual({ seq: dispatched[0].payload.seq, trait: dispatched[0].payload.trait }, { seq: 3, trait: 'quiet' });
});

test('[범위] 성격은 지도와 함께 사라진다 — 새 지도 · 사망 · 계승 · 다시 시작에 넘어가지 않는다', () => {
    const player = playerAt(LATE, { fieldMap: { ...playerAt(LATE).fieldMap, trait: 'quiet' } });
    assert.equal(createFieldMapState(player, LATE, DB.MAPS[LATE]).trait, undefined);
    for (const kind of ['death', 'ascension']) {
        const kept = pickPermanentPlayerState(player, INITIAL_STATE.player, kind);
        assert.ok(!JSON.stringify(kept).includes('"quiet"'), kind);
    }
    const { updatedPlayer } = CombatEngine.handleDefeat(player, INITIAL_STATE.player, () => 0.5, () => 0);
    assert.equal(updatedPlayer.fieldMap ?? null, null);
    assert.equal(gameReducer(stateOf(player), { type: AT.RESET_GAME }).player.fieldMap ?? null, null);
});

test('[저장] 고른 성격은 세이브 봉투의 player 안이라 다시 불러와도 같다', () => {
    const chosen = choose(stateOf(playerOffering(LATE, 'chest')), 'chest');
    const loaded = gameReducer(clone(INITIAL_STATE), { type: AT.LOAD_DATA, payload: { player: JSON.parse(JSON.stringify(chosen.player)), gameState: GS.IDLE, enemy: null, quickSlots: [] } });
    assert.equal(loaded.player.fieldMap.trait, 'chest');
    assert.equal(isFieldTraitChoiceOpen(loaded.player), false);
});

// ── ⑤ 지도 ──────────────────────────────────────────────────────────────

test('[지도] 보통 지도는 같은 객체다 — 성격이 없는 지도와 바이트가 같다', () => {
    for (const loc of REGIONS) {
        const field = playerAt(loc).fieldMap;
        const layout = getFieldMapLayout(field, DB.MAPS[loc]);
        assert.equal(getFieldMapLayout({ ...field, trait: 'plain' }, DB.MAPS[loc]), layout);
        assert.equal(getFieldMapLayout({ ...field, trait: 'elite' }, DB.MAPS[loc]), layout);
        assert.equal(applyFieldTraitToLayout(layout, 'plain'), layout);
    }
});

test('[지도] 상자 수만 다르다 — 벽 · 입구 · 출구는 그대로이고 약속한 수만큼, 모두 걸어서 닿는다', () => withThrowingRandom(() => {
    for (const loc of REGIONS) {
        for (let seed = 1; seed <= 25; seed += 1) {
            const field = { ...playerAt(loc).fieldMap, seed };
            const plain = getFieldMapLayout(field, DB.MAPS[loc]);
            for (const trait of FIELD_OTHER_TRAITS) {
                const layout = getFieldMapLayout({ ...field, trait }, DB.MAPS[loc]);
                const delta = getFieldTraitEffects(trait).chests;
                assert.equal(layout.tiles, plain.tiles);
                assert.equal(layout.entrance, plain.entrance);
                assert.deepEqual(layout.exits, plain.exits);
                assert.equal(layout.chests.length, plain.chests.length + delta, `${loc}#${seed} ${trait}`);
                assert.ok(layout.chests.length >= 1);
                const shared = Math.min(layout.chests.length, plain.chests.length);
                assert.deepEqual(layout.chests.slice(0, shared), plain.chests.slice(0, shared), '보통 지도의 상자는 자리를 옮기지 않는다');
                assert.deepEqual(layout.chests.map((chest) => chest.id), layout.chests.map((_, index) => index));
                const cells = layout.chests.map((chest) => chest.index);
                assert.equal(new Set(cells).size, cells.length);
                const distance = fieldDistances(layout.tiles, layout.width, layout.entrance);
                const exits = new Set(layout.exits.map((exit) => exit.index));
                for (const index of cells) {
                    assert.ok(distance[index] > 0 && !exits.has(index), `${loc}#${seed} ${trait} 상자 ${index}`);
                }
                assert.equal(getFieldMapLayout({ ...field, trait }, DB.MAPS[loc]), layout, '같은 지도 · 성격은 같은 객체');
            }
        }
    }
}));

test('[지도] 더한 상자는 모든 출구 · 다른 상자로 가는 길을 막지 않는다(상자를 밟지 않고 걸어도 닿는다)', () => {
    for (const loc of REGIONS) {
        const field = { ...playerAt(loc).fieldMap, trait: 'chest' };
        const layout = getFieldMapLayout(field, DB.MAPS[loc]);
        const reached = new Set([layout.entrance]);
        const queue = [layout.entrance];
        while (queue.length > 0) {
            const index = queue.shift();
            for (const direction of ['up', 'down', 'left', 'right']) {
                const next = getFieldNeighbor(layout, index, direction);
                if (next !== null && !reached.has(next)) { reached.add(next); queue.push(next); }
            }
        }
        for (const exit of layout.exits) assert.ok(reached.has(exit.index), `${loc} 출구`);
        for (const chest of layout.chests) assert.ok(reached.has(chest.index), `${loc} 상자`);
    }
});

// ── ⑥ 조우 · 정예 · 사건 · 상자 ─────────────────────────────────────────

test('[조우] 문턱은 성격의 배율이다 — 상자가 많은 길은 짧고 고요한 길은 길다', () => {
    for (let explores = 0; explores < 40; explores += 1) {
        const base = playerAt(LATE, { stats: { explores } });
        const plain = getFieldEncounterThreshold(base, LATE);
        for (const trait of FIELD_TRAITS) {
            const player = { ...base, fieldMap: { ...base.fieldMap, trait } };
            const expected = Math.max(1, Math.round(plain * getFieldTraitEffects(trait).encounterSteps));
            assert.equal(getFieldEncounterThreshold(player, LATE), expected, trait);
        }
    }
    assert.ok(getFieldTraitEffects('chest').encounterSteps < 1);
    assert.ok(getFieldTraitEffects('quiet').encounterSteps > 1);
});

const spawnWith = (player, script) => {
    let draws = 0;
    const rng = () => { const value = script[draws] ?? 0.99; draws += 1; return value; };
    const { mStats } = spawnEnemy(DB.MAPS[player.loc], player, [], { addLog: () => {} }, { rng });
    return { mStats, draws };
};

test('[정예] 같은 추첨의 문턱만 올린다 — 추첨 수 · 보통 지도의 결과는 그대로이고 초반 구간에서는 바뀌지 않는다', () => {
    const bonus = getFieldTraitEffects('elite').eliteChance;
    const base = playerAt(LATE);
    const withTrait = (player, trait) => ({ ...player, fieldMap: { ...player.fieldMap, trait } });
    // 추첨 자리를 찾는다 — 그 자리의 값만 바꿨을 때 정예 지도에서만 정예가 되는 자리가 정확히 하나다.
    const length = spawnWith(base, []).draws;
    const inside = bonus - 1e-6;
    const flips = [];
    for (let index = 0; index < length; index += 1) {
        const script = Array.from({ length }, (_, i) => (i === index ? inside : 0.99));
        const plain = spawnWith(withTrait(base, 'plain'), script);
        const none = spawnWith(base, script);
        const elite = spawnWith(withTrait(base, 'elite'), script);
        assert.deepEqual(plain.mStats, none.mStats, '성격 없음 = 보통 지도');
        for (const other of ['chest', 'event', 'quiet']) assert.deepEqual(spawnWith(withTrait(base, other), script).mStats, plain.mStats, other);
        if (JSON.stringify(elite.mStats) !== JSON.stringify(plain.mStats)) flips.push({ index, elite, plain });
    }
    assert.equal(flips.length, 1, '바뀌는 추첨은 하나다');
    assert.equal(Boolean(flips[0].plain.mStats.isElite), false);
    const just = Array.from({ length }, (_, i) => (i === flips[0].index ? bonus : 0.99));
    assert.deepEqual(spawnWith(withTrait(base, 'elite'), just).mStats, spawnWith(base, just).mStats, '문턱 바로 위는 보통 지도와 같다');
    assert.equal(spawnWith(withTrait(base, 'elite'), []).draws, length, '정예가 아니면 추첨 수가 같다');
    // 정예가 된 개체의 접두어 추첨은 프레스티지 정예와 같은 길이다(접두어 추첨 하나).
    const rankThree = { ...base, meta: { ...base.meta, prestigeRank: 3 } };
    assert.equal(flips[0].elite.draws, spawnWith(rankThree, Array.from({ length }, (_, i) => (i === flips[0].index ? 0 : 0.99))).draws);

    const early = playerAt(EARLY, { level: 3 });
    for (let k = 0; k < 400; k += 1) {
        const script = Array.from({ length: 20 }, (_, i) => ((k * 7919 + i * 104729) % 1000) / 1000);
        assert.deepEqual(spawnWith(withTrait(early, 'elite'), script).mStats, spawnWith(early, script).mStats, '초반 구간');
    }
});

const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
const exploreWith = async (trait, script) => {
    const player = playerAt(LATE, {
        eventChainProgress: ALL_CHAINS_DONE,
        stats: { visitedMaps: [LATE], explores: 5, exploreState: { sinceNarrativeEvent: 3 } },
    });
    let current = stateOf({ ...player, fieldMap: { ...player.fieldMap, trait }, activeExpedition: undefined });
    let draws = 0;
    const rng = () => { const value = script[draws] ?? 0.99; draws += 1; return value; };
    const dispatched = [];
    const dispatch = (action) => { dispatched.push(action.type); current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    await createExploreActions({
        player: current.player, gameState: current.gameState, uid: 'me', dispatch, addLog, addStoryLog: () => {},
        getFullStats: () => calculateFullStats(current.player), rng, liveConfig: null,
    }, makeSharedHelpers({ player: current.player, dispatch, addLog })).explore();
    const kind = dispatched.includes(AT.BEGIN_AI_EVENT) ? 'narrative'
        : current.gameState === GS.EVENT ? (current.currentEvent?.isScout || String(current.currentEvent?.id ?? '').includes('scout') ? 'scout' : 'event')
            : current.gameState;
    return { kind, draws };
};

test('[사건] 사건 · 정찰 문턱만 성격의 배율이다 — 걸리지 않으면 추첨 수가 같다', async () => {
    const mult = getFieldTraitEffects('event').events;
    const quiet = await exploreWith('plain', []);
    const same = await exploreWith('event', []);
    assert.equal(quiet.draws, same.draws, '걸리지 않은 탐험의 추첨 수');
    assert.equal(quiet.kind, same.kind);
    const changed = [];
    for (let index = 0; index < quiet.draws; index += 1) {
        // 정찰 문턱(0.15) 바로 위 · 배율을 곱한 문턱 아래의 값, 사건 문턱 근처의 값을 그 자리에만 넣는다.
        for (const value of [0.02, 0.05, 0.1, BALANCE.SCOUT_CHANCE + 0.01, 0.2, 0.25]) {
            const script = Array.from({ length: quiet.draws }, (_, i) => (i === index ? value : 0.99));
            const plain = await exploreWith('plain', script);
            const none = await exploreWith(undefined, script);
            const event = await exploreWith('event', script);
            assert.deepEqual(none, plain, '성격 없음 = 보통 지도');
            for (const other of ['elite', 'chest', 'quiet']) {
                if (other !== 'elite') assert.deepEqual(await exploreWith(other, script), plain, other);
            }
            if (event.kind !== plain.kind) changed.push({ index, value, from: plain.kind, to: event.kind });
        }
    }
    assert.ok(changed.length > 0, '배율이 실제로 결과를 바꾼다');
    assert.ok(changed.every((entry) => entry.to === 'narrative' || entry.to === 'event' || entry.to === 'scout'), JSON.stringify(changed));
    assert.ok(changed.some((entry) => entry.to === 'narrative') && changed.some((entry) => entry.to !== 'narrative'), `사건 · 정찰이 둘 다 움직인다: ${JSON.stringify(changed)}`);
    assert.equal(new Set(changed.map((entry) => entry.index)).size, 2, `바뀌는 추첨은 사건 · 정찰 둘뿐이다: ${JSON.stringify(changed)}`);

    const mapData = DB.MAPS[LATE];
    assert.equal(shouldTriggerScout(mapData, () => BALANCE.SCOUT_CHANCE * mult - 1e-9, mult), true);
    assert.equal(shouldTriggerScout(mapData, () => BALANCE.SCOUT_CHANCE * mult, mult), false);
    assert.equal(shouldTriggerScout(mapData, () => BALANCE.SCOUT_CHANCE), false, '기본은 배율 1');
    const player = playerAt(LATE);
    assert.deepEqual(
        getScoutAvailability({ ...player, fieldMap: { ...player.fieldMap, trait: 'event' } }, mapData, true),
        getScoutAvailability(player, mapData, true),
        '직접 부르는 정찰은 바뀌지 않는다',
    );
});

test('[상자] 정예 성격만 보통 상자의 골드 · 재료를 올린다 — 같은 추첨이고 미믹 판정 · 미믹 보상은 그대로다', () => {
    const fx = getFieldTraitEffects('elite');
    let more = 0;
    for (const loc of REGIONS) {
        for (let seed = 1; seed <= 40; seed += 1) {
            for (const chestId of [0, 1]) {
                const base = getFieldChestReward(loc, DB.MAPS[loc], seed, chestId);
                for (const trait of ['plain', 'chest', 'event', 'quiet']) assert.deepEqual(getFieldChestReward(loc, DB.MAPS[loc], seed, chestId, false, trait), base, trait);
                const elite = getFieldChestReward(loc, DB.MAPS[loc], seed, chestId, false, 'elite');
                assert.equal(elite.gold, Math.floor(base.gold * fx.chestGold));
                assert.deepEqual(elite.items.slice(0, base.items.length), base.items, '원래 나오던 것은 그대로다');
                assert.ok(elite.items.length - base.items.length <= 1);
                more += elite.items.length - base.items.length;
                assert.deepEqual(getFieldChestReward(loc, DB.MAPS[loc], seed, chestId, true, 'elite'), getFieldChestReward(loc, DB.MAPS[loc], seed, chestId, true), '미믹');
            }
        }
    }
    assert.ok(more > 0);
    assert.equal(isFieldChestMimic.length, 3, '미믹 판정은 성격을 받지 않는다');
});

test('[상자] 실제 걸음이 지도의 성격으로 보상을 준다', () => {
    const player = playerOffering(LATE, 'elite');
    const layout = getFieldMapLayout(player.fieldMap, DB.MAPS[LATE]);
    const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const chest = layout.chests.find((entry) => !isFieldChestMimic(LATE, player.fieldMap.seed, entry.id));
    const direction = ['up', 'down', 'left', 'right'].find((dir) => {
        const next = getFieldNeighbor(layout, chest.index, dir);
        return next !== null && !layout.chests.some((other) => other.index === next) && !layout.exits.some((exit) => exit.index === next);
    });
    const pos = getFieldNeighbor(layout, chest.index, direction);
    const open = (trait) => {
        const start = stateOf({ ...player, gold: 0, fieldMap: { ...player.fieldMap, trait, pos, visited: [layout.entrance, pos] } });
        return gameReducer(start, { type: AT.FIELD_STEP, payload: { direction: OPPOSITE[direction], auto: false, now: NOW } }).player.gold;
    };
    const plain = open('plain');
    assert.ok(plain > 0);
    assert.ok(open('elite') >= Math.floor(getFieldChestReward(LATE, DB.MAPS[LATE], player.fieldMap.seed, chest.id, false, 'elite').gold));
    assert.ok(open('elite') > plain);
});

// ── ⑦ 화면 ──────────────────────────────────────────────────────────────

test('[화면] 카드는 패 그대로이고 얻는 것 · 치르는 것 한 줄씩, 기본 선택 없이 금빛 단추는 하나다', () => {
    const player = playerOffering(LATE, 'elite');
    const offer = getFieldTraitOffer(player, player.fieldMap, DB.MAPS[LATE]);
    const html = renderStatic(createElement(FieldTraitPanel, { player, onChoose: () => {} }));
    for (const trait of FIELD_TRAITS) {
        const card = sliceElementByTestId(html, `field-trait-card-${trait}`);
        assert.equal(card !== '', offer.includes(trait), trait);
        if (card === '') continue;
        const fx = getFieldTraitEffects(trait);
        assert.ok(card.includes(MSG.FIELD_TRAIT_NAME[trait]));
        assert.ok(card.includes(MSG.FIELD_TRAIT_GAIN_LINE(MSG.FIELD_TRAIT_GAIN[trait](fx))), trait);
        assert.ok(card.includes(MSG.FIELD_TRAIT_COST_LINE(MSG.FIELD_TRAIT_COST[trait](fx))), trait);
    }
    assert.equal((html.match(/aria-pressed="true"/gu) || []).length, 0, '기본 선택 없음');
    assert.match(html, /data-testid="field-trait-confirm"[^>]*disabled|disabled[^>]*data-testid="field-trait-confirm"/u);
    assert.equal((html.match(/ae-btn-primary/gu) || []).length <= 1, true);
    assert.equal(renderStatic(createElement(FieldTraitPanel, { player: { ...player, fieldMap: null }, onChoose: () => {} })), '');
});

test('[문구] 수치는 BALANCE의 값이고 권하지 않는다(Wave 88) · 플레이어 언어다', () => {
    const text = FIELD_TRAITS.flatMap((trait) => {
        const fx = getFieldTraitEffects(trait);
        return [MSG.FIELD_TRAIT_NAME[trait], MSG.FIELD_TRAIT_GAIN[trait](fx), MSG.FIELD_TRAIT_COST[trait](fx)];
    }).concat(MSG.FIELD_TRAIT_TITLE, MSG.FIELD_TRAIT_BODY, MSG.FIELD_TRAIT_EYEBROW, MSG.FIELD_TRAIT_CONFIRM, MSG.FIELD_TRAIT_SKIP, MSG.FIRST_CHEST_RELIC_FOUND);
    for (const line of text) {
        assert.doesNotMatch(line, /추천|권장|좋습니다|하세요|유리|노려|조심|[A-Za-z]/u, line);
    }
    const pct = (value) => `${Math.round(value * 100)}%`;
    assert.ok(MSG.FIELD_TRAIT_COST.elite(getFieldTraitEffects('elite')).includes(pct(getFieldTraitEffects('elite').eliteChance)));
    assert.ok(MSG.FIELD_TRAIT_GAIN.elite(getFieldTraitEffects('elite')).includes(`${getFieldTraitEffects('elite').chestGold}배`));
    assert.ok(MSG.FIELD_TRAIT_GAIN.chest(getFieldTraitEffects('chest')).includes(`${getFieldTraitEffects('chest').chests}개`));
    assert.ok(MSG.FIELD_TRAIT_GAIN.event(getFieldTraitEffects('event')).includes(`${getFieldTraitEffects('event').events}배`));
    assert.ok(MSG.FIELD_TRAIT_GAIN.quiet(getFieldTraitEffects('quiet')).includes(pct(getFieldTraitEffects('quiet').encounterSteps - 1)));
});
