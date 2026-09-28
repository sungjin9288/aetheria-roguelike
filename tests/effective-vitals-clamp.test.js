import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { RELICS } from '../src/data/relics.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { resolveDailyProtocolProgress } from '../src/reducers/handlers/helpers.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { findItemByName, makeItem } from '../src/utils/gameUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-09 Wave 27 N2 (D8) — 유효 최대치가 줄어드는 전이에서 현재 생명/기력을 깎아 맞춘다.
 *
 * 감사 관측: MP 접두 보조장비를 벗는 교체 뒤 133/123, dragon_legacy 유물 획득 뒤 718/708.
 * 최대치는 저장값(`player.maxMp`)이 아니라 UI가 그리는 `calculateFullStats(player)`다 —
 * 유물이 빌드 성향을 바꾸면 성향 보너스(기력 +10)가 빠지고, 장비의 `mpBonus`/`hpBonus`가 빠진다.
 * 생명은 감사에서 넘친 적이 없지만 같은 전이(장비 `hpBonus` 방어구 교체, `fortress` 유물 교체)로
 * 넘칠 수 있으므로 함께 맞춘다. 올리는 방향으로는 절대 건드리지 않는다.
 */

let itemSequence = 0;
const item = (name) => {
    itemSequence += 1;
    return makeItem(findItemByName(name), () => 0.5, () => 1_700_000_000_000 + itemSequence);
};
const relic = (id) => structuredClone(RELICS.find((entry) => entry.id === id));

const stateFor = (player, overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    player: { ...structuredClone(INITIAL_STATE.player), name: '용사', ...player },
    ...overrides,
});

/** 현재 생명/기력을 유효 최대치로 채운다(UI가 "가득"으로 그리는 상태). */
const topUp = (state) => {
    const stats = calculateFullStats(state.player);
    return { ...state, player: { ...state.player, hp: stats.maxHp, mp: stats.maxMp } };
};

const effectiveMax = (player) => {
    const stats = calculateFullStats(player);
    return { hp: stats.maxHp, mp: stats.maxMp };
};

const equip = (state, name) => {
    const target = state.player.inv.find((entry) => entry.name === name);
    return gameReducer(state, { type: AT.USE_INVENTORY_ITEM, payload: { itemId: target.id } });
};

test('D8 기력 보너스 지팡이를 벗는 교체는 현재 기력을 새 최대치로 깎는다', () => {
    const before = topUp(stateFor({
        job: '대마법사',
        level: 60,
        inv: [item('천벌의 지팡이')],
        equip: { weapon: item('빙하의 지팡이'), armor: null, offhand: null },
    }));
    const after = equip(before, '천벌의 지팡이');
    const oldMax = effectiveMax(before.player);
    const newMax = effectiveMax(after.player);

    assert.equal(after.player.equip.weapon?.name, '천벌의 지팡이', '교체가 일어났다');
    assert.ok(newMax.mp < oldMax.mp, `전제: 유효 최대 기력이 줄었다 (${oldMax.mp} → ${newMax.mp})`);
    assert.equal(before.player.mp, oldMax.mp);
    assert.equal(after.player.mp, newMax.mp, '현재 기력 ≤ 유효 최대 기력');
});

test('D8 생명 보너스 방어구를 벗는 교체는 현재 생명을 새 최대치로 깎는다', () => {
    const before = topUp(stateFor({
        job: '전사',
        level: 60,
        inv: [item('천상의갑주')],
        equip: { weapon: item('롱소드'), armor: item('용비늘 갑주'), offhand: null },
    }));
    const after = equip(before, '천상의갑주');
    const oldMax = effectiveMax(before.player);
    const newMax = effectiveMax(after.player);

    assert.equal(after.player.equip.armor?.name, '천상의갑주');
    assert.ok(newMax.hp < oldMax.hp, `전제: 유효 최대 생명이 줄었다 (${oldMax.hp} → ${newMax.hp})`);
    assert.equal(after.player.hp, newMax.hp, '현재 생명 ≤ 유효 최대 생명');
});

test('D8 최대치 아래의 생명/기력은 교체에서 그대로다', () => {
    const before = stateFor({
        job: '대마법사',
        level: 60,
        hp: 37,
        mp: 11,
        inv: [item('천벌의 지팡이')],
        equip: { weapon: item('빙하의 지팡이'), armor: null, offhand: null },
    });
    const after = equip(before, '천벌의 지팡이');
    assert.equal(after.player.equip.weapon?.name, '천벌의 지팡이');
    assert.equal(after.player.hp, 37);
    assert.equal(after.player.mp, 11);
});

test('D8 유물 선택(ADD_RELIC)이 빌드 성향을 바꿔 최대 기력이 줄면 현재 기력도 맞춘다', () => {
    const candidate = relic('void_shard');
    const before = topUp(stateFor({
        job: '마법사', level: 40, maxHp: 800, maxMp: 300, relics: [],
    }, { pendingRelics: [candidate] }));
    const after = gameReducer(before, { type: AT.ADD_RELIC, payload: candidate });
    const oldMax = effectiveMax(before.player);
    const newMax = effectiveMax(after.player);

    assert.deepEqual(after.player.relics.map((entry) => entry.id), ['void_shard']);
    assert.ok(newMax.mp < oldMax.mp, `전제: 유효 최대 기력이 줄었다 (${oldMax.mp} → ${newMax.mp})`);
    assert.equal(after.player.mp, newMax.mp);
    assert.equal(after.player.hp, before.player.hp, '생명은 건드리지 않는다(최대치 불변)');
});

test('D8 최대치 아래의 기력은 유물 선택에서 그대로다', () => {
    const candidate = relic('void_shard');
    const before = stateFor({
        job: '마법사', level: 40, maxHp: 800, maxMp: 300, hp: 500, mp: 100, relics: [],
    }, { pendingRelics: [candidate] });
    const after = gameReducer(before, { type: AT.ADD_RELIC, payload: candidate });
    assert.equal(after.player.relics.length, 1);
    assert.equal(after.player.mp, 100);
    assert.equal(after.player.hp, 500);
});

test('D8 체인 완주 보상 유물(dragon_legacy 2단계)로 최대 기력이 줄면 현재 기력도 맞춘다', () => {
    const chain = EVENT_CHAINS.find((entry) => entry.id === 'dragon_legacy');
    const stepData = chain.steps.find((entry) => entry.step === 2);
    const baseRelics = ['soul_drain', 'bloodthirst', 'ancient_fury', 'iron_will'].map(relic);
    assert.ok(baseRelics.length < getPrestigeUnlocks(0).maxRelics, '전제: 상한 미만이라 직접 지급된다');
    let state = topUp(stateFor({
        job: '대마법사', level: 40, maxHp: 800, maxMp: 300, loc: stepData.loc,
        relics: baseRelics, eventChainProgress: { [chain.id]: 2 },
    }, {
        gameState: GS.EVENT,
        currentEvent: { ...structuredClone(stepData.event), _chainId: chain.id, _chainStep: 2 },
    }));
    const before = state;
    const dispatch = (action) => { state = gameReducer(state, action); };
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch,
        addLog: () => {},
        getFullStats: () => calculateFullStats(state.player),
        rng: () => 0.9,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);

    const oldMax = effectiveMax(before.player);
    const newMax = effectiveMax(state.player);
    assert.equal(state.player.eventChainProgress[chain.id], 3, '체인 스텝이 진행됐다');
    assert.equal(state.player.relics.length, baseRelics.length + 1, '보상 유물을 받았다');
    assert.ok(newMax.mp < oldMax.mp, `전제: 유효 최대 기력이 줄었다 (${oldMax.mp} → ${newMax.mp})`);
    assert.equal(state.player.mp, newMax.mp);
    assert.ok(state.player.hp <= newMax.hp);
});

test('D8 일일 임무 유물 파편이 변환한 유물로 최대 기력이 줄면 현재 기력도 맞춘다', () => {
    const shardsBefore = 4;
    const { player: basePlayer } = topUp(stateFor({
        job: '마법사',
        level: 40,
        maxHp: 800,
        maxMp: 300,
        relics: [],
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            dailyProtocol: {
                date: 'fixture-day',
                relicShards: shardsBefore,
                missions: [{ id: 'gold_n', type: 'goldSpend', goal: 10, progress: 9, done: false, reward: { relicShard: 1 } }],
            },
        },
    }));
    // 변환 후보는 "보유하지 않은 유물" 전체(여기서는 RELICS 그대로) — roll로 void_shard를 고른다.
    const targetIndex = RELICS.findIndex((entry) => entry.id === 'void_shard');
    const relicRoll = (targetIndex + 0.5) / RELICS.length;
    const { player: next, reward } = resolveDailyProtocolProgress(basePlayer, 'goldSpend', 1, relicRoll);
    const oldMax = effectiveMax(basePlayer);
    const newMax = effectiveMax(next);

    assert.equal(reward.convertedRelic?.id, 'void_shard', '파편 5개가 실제로 유물로 변환됐다');
    assert.equal(next.stats.dailyProtocol.relicShards, shardsBefore + 1 - 5);
    assert.ok(newMax.mp < oldMax.mp, `전제: 유효 최대 기력이 줄었다 (${oldMax.mp} → ${newMax.mp})`);
    assert.equal(next.mp, newMax.mp);

    const idle = resolveDailyProtocolProgress({ ...basePlayer, mp: 50 }, 'goldSpend', 1, relicRoll);
    assert.equal(idle.player.mp, 50, '최대치 아래의 기력은 그대로다');
});

test('D8 생명 배율 유물을 내려놓는 교체(REPLACE_RELIC)는 현재 생명을 새 최대치로 깎는다', () => {
    const cap = getPrestigeUnlocks(0).maxRelics;
    const owned = [relic('fortress'), ...RELICS.filter((entry) => entry.id !== 'fortress').slice(0, cap - 1).map((entry) => structuredClone(entry))];
    const offered = structuredClone(RELICS.find((entry) => !owned.some((own) => own.id === entry.id) && entry.effect !== 'fortress'));
    const before = topUp(stateFor({
        job: '전사', level: 40, maxHp: 800, maxMp: 100, relics: owned,
    }, { pendingRelics: [offered] }));
    const after = gameReducer(before, {
        type: AT.REPLACE_RELIC,
        payload: { relicId: offered.id, replaceRelicId: 'fortress' },
    });
    const oldMax = effectiveMax(before.player);
    const newMax = effectiveMax(after.player);

    assert.ok(!after.player.relics.some((entry) => entry.id === 'fortress'), '교체가 일어났다');
    assert.ok(newMax.hp < oldMax.hp, `전제: 유효 최대 생명이 줄었다 (${oldMax.hp} → ${newMax.hp})`);
    assert.equal(after.player.hp, newMax.hp);
    assert.ok(after.player.mp <= newMax.mp);
});
