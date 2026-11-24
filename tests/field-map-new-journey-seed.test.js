import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { isFieldChestMimic } from '../src/systems/fieldChest.ts';
import { createFieldMapState, getFieldMapLayout } from '../src/systems/fieldMapWalk.ts';
import { deriveSeed } from '../src/utils/seededRandom.ts';

// 2026-11-24 소유자 결정 "사망하면 새 지도"(원장 §189): 지도 씨앗은 평생 탐험 수 · 지역 · 순번에 여정(사망 수 · 계승 단계)을 더한다.
//   순번은 사망에서 1로 돌아가고 평생 탐험 수는 탐험 없이 상자로 걸어가 죽으면 그대로라, 여정을 넣지 않던 동안
//   다음 여정이 같은 지도 · 같은 미믹 상자를 받았다(드라이버: 고요한 숲 Lv1에서 약 27행동마다 같은 미믹에게 사망).

const LOC = BALANCE.FIELD_MAP_REGIONS[0];
const MAP = DB.MAPS[LOC];
const EXPLORES = 7;
const clone = (value) => structuredClone(value);

const journeyPlayer = (overrides = {}) => ({
    ...clone(INITIAL_STATE.player),
    name: '걷는 사람',
    loc: LOC,
    fieldMap: null,
    ...overrides,
    stats: { ...clone(INITIAL_STATE.player.stats), explores: EXPLORES, ...(overrides.stats || {}) },
});

const enterField = (player) => gameReducer(
    { ...clone(INITIAL_STATE), bootStage: 'ready', gameState: GS.IDLE, player },
    { type: AT.FIELD_ENTER },
).player.fieldMap;

/** 실제 사망 전이(`handleDefeat`) 뒤 같은 지역에 다시 들어선 지도. 평생 탐험 수는 그대로다. */
const dieAndReturn = (player) => {
    const { updatedPlayer } = CombatEngine.handleDefeat(player, INITIAL_STATE.player, () => 0.5, () => 0);
    assert.equal(updatedPlayer.stats.explores, player.stats.explores, '사망은 평생 탐험 수를 바꾸지 않는다');
    assert.equal(updatedPlayer.fieldMap ?? null, null, '사망은 지도를 넘기지 않는다(순번이 1로 돌아간다)');
    const next = { ...updatedPlayer, loc: LOC };
    return { player: next, field: enterField(next) };
};

const signature = (field) => {
    const layout = getFieldMapLayout(field, MAP);
    return JSON.stringify({ tiles: layout.tiles, chests: layout.chests.map((chest) => chest.index), mimics: layout.chests.filter((chest) => isFieldChestMimic(LOC, field.seed, chest.id)).map((chest) => chest.index) });
};

test('(a) 사망하고 다시 오면 같은 평생 탐험 수에서도 다른 지도다 — 20번 연속 사망이 모두 다른 지도', () => {
    let player = journeyPlayer();
    const first = enterField(player);
    assert.equal(first.seq, 1);
    const seen = new Set([signature(first)]);
    const seeds = new Set([first.seed]);
    player = { ...player, fieldMap: first };
    for (let death = 1; death <= 20; death += 1) {
        const { player: next, field } = dieAndReturn(player);
        assert.equal(field.seq, 1, '새 여정의 첫 지도는 순번 1');
        assert.equal(next.stats.deaths, death);
        seeds.add(field.seed);
        seen.add(signature(field));
        player = { ...next, fieldMap: field };
    }
    assert.equal(seeds.size, 21, '여정마다 씨앗이 다르다');
    assert.equal(seen.size, 21, '여정마다 지도(칸 · 상자 · 미믹)가 다르다');
});

test('(a) 계승한 새 여정도 다른 지도다 — 사망 수가 같아도 계승 단계가 씨앗에 든다', () => {
    const before = createFieldMapState(journeyPlayer({ stats: { deaths: 2 } }), LOC, MAP);
    const after = createFieldMapState(journeyPlayer({ stats: { deaths: 2 }, meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 1 } }), LOC, MAP);
    assert.notEqual(before.seed, after.seed);
    assert.notEqual(signature(before), signature(after));
});

test('(b) 같은 상태는 같은 지도다 — 다시 불러와도(직렬화 왕복) 다시 뽑히지 않는다', () => {
    const player = journeyPlayer({ stats: { deaths: 3 }, meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 2 } });
    const a = enterField(player);
    const b = enterField(JSON.parse(JSON.stringify(player)));
    assert.deepEqual(a, b);
    // 들어선 뒤의 지도는 저장된 씨앗을 읽는다 — 같은 지역에 다시 FIELD_ENTER해도 그대로다.
    const again = gameReducer(
        { ...clone(INITIAL_STATE), bootStage: 'ready', gameState: GS.IDLE, player: { ...player, fieldMap: a } },
        { type: AT.FIELD_ENTER },
    ).player.fieldMap;
    assert.equal(again, a);
});

test('(b) 첫 여정(사망 0 · 계승 0)의 지도는 이전 씨앗 그대로다 — 첫 여정 지도 · 시험 고정값이 움직이지 않는다', () => {
    const field = createFieldMapState(journeyPlayer(), LOC, MAP);
    assert.equal(field.seed, deriveSeed(EXPLORES, LOC, 'field-map', 1));
    const second = createFieldMapState({ ...journeyPlayer(), fieldMap: field }, LOC, MAP);
    assert.equal(second.seed, deriveSeed(EXPLORES, LOC, 'field-map', 2));
});

test('(c) 지도 씨앗은 난수를 쓰지 않는다 — Math.random을 막아도 같은 지도', () => {
    const original = Math.random;
    Math.random = () => { throw new Error('지도 씨앗이 Math.random을 불렀다'); };
    try {
        const player = journeyPlayer({ stats: { deaths: 5 } });
        const a = createFieldMapState(player, LOC, MAP);
        const b = enterField(player);
        assert.equal(a.seed, b.seed);
    } finally {
        Math.random = original;
    }
});
