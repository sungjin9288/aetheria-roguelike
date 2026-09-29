import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { RELICS } from '../src/data/relics.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { resolveDailyProtocolProgress } from '../src/reducers/handlers/helpers.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-09 Wave 30 — 원장 §27.6이 "알고 남긴 것"으로 적은 결함 셋.
 *
 * ① 칭호 전환이 유효 최대치를 낮춰도 현재 생명/기력을 깎지 않았다(`SET_PLAYER {activeTitle}` — D8과 같은 클래스의
 *    마지막 전이). 칭호 전환은 이제 리듀서 전이 `SET_ACTIVE_TITLE`이 소유하고 `clampVitalsToEffectiveMax`로 끝난다.
 * ② 일일 파편 변환이 유물 상한을 `MAX_RELICS_PER_RUN`(5)으로 고정해 프레스티지 rank ≥2의 여섯 번째 칸을 무시했다 —
 *    5개를 가진 rank 2 플레이어의 파편은 칸이 비어 있는데도 변환되지 않고 쌓였다.
 * ③ 체인 완주 보상의 직접 지급이 `stats.relicCount`를 올리지 않았다(골드 선택·유물 선택·교체·파편 경로는 올린다) —
 *    유물 수집 업적(5 · 15 · 30)과 칭호(10 · 25)가 그만큼 덜 셌다.
 */

const stateFor = (player, overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    player: { ...structuredClone(INITIAL_STATE.player), name: '용사', job: '전사', level: 30, maxHp: 400, maxMp: 100, ...player },
    ...overrides,
});
const effectiveMax = (player) => {
    const stats = calculateFullStats(player);
    return { hp: stats.maxHp, mp: stats.maxMp };
};
const topUp = (state) => {
    const max = effectiveMax(state.player);
    return { ...state, player: { ...state.player, hp: max.hp, mp: max.mp } };
};
const relic = (id) => structuredClone(RELICS.find((entry) => entry.id === id));

// ── ① 칭호 전환 ─────────────────────────────────────────────────────────────

test('[① 칭호] 생명 칭호(legend, HP +40)를 해제하면 가득 찬 생명이 새 최대치로 깎인다', () => {
    const before = topUp(stateFor({ titles: ['legend', 'merchant'], activeTitle: 'legend' }));
    const after = gameReducer(before, { type: AT.SET_ACTIVE_TITLE, payload: null });
    assert.equal(after.player.activeTitle, null);
    const oldMax = effectiveMax(before.player);
    const newMax = effectiveMax(after.player);
    assert.equal(oldMax.hp - newMax.hp, 40, '전제: 칭호가 유효 최대 생명을 40 올리고 있었다');
    assert.equal(after.player.hp, newMax.hp);
});

test('[① 칭호] 칭호 교체(legend → merchant)는 넘친 생명만 깎고 기력은 올리지 않는다', () => {
    const before = topUp(stateFor({ titles: ['legend', 'merchant'], activeTitle: 'legend' }));
    const after = gameReducer(before, { type: AT.SET_ACTIVE_TITLE, payload: 'merchant' });
    const newMax = effectiveMax(after.player);
    assert.equal(after.player.activeTitle, 'merchant');
    assert.equal(after.player.hp, newMax.hp, '생명은 새 최대치로');
    assert.equal(after.player.mp, before.player.mp, '기력은 최대치가 올라도 채우지 않는다');
    assert.ok(newMax.mp > before.player.mp, '전제: merchant가 최대 기력을 올린다');
});

test('[① 칭호] 최대치 아래의 생명/기력은 칭호 전환에서 그대로다', () => {
    const before = stateFor({ titles: ['legend'], activeTitle: 'legend', hp: 100, mp: 20 });
    const after = gameReducer(before, { type: AT.SET_ACTIVE_TITLE, payload: null });
    assert.equal(after.player.activeTitle, null);
    assert.equal(after.player.hp, 100);
    assert.equal(after.player.mp, 20);
});

test('[① 칭호 배선] 훅은 칭호를 SET_PLAYER 패치로 바꾸지 않는다(부재 불변식)', () => {
    // 행동은 위 리듀서 행이 고정한다. 여기서는 되돌리기 — 훅이 다시 `SET_PLAYER`로 `activeTitle`을 쓰면
    // 클램프를 우회하는 두 번째 경로가 생긴다.
    const source = readFileSync(new URL('../src/hooks/useGameEngine.ts', import.meta.url), 'utf8');
    const offenders = source.split('\n').filter((line) => line.includes('SET_PLAYER') && line.includes('activeTitle'));
    assert.deepEqual(offenders, []);
    assert.ok(source.includes('AT.SET_ACTIVE_TITLE'), '훅의 칭호 설정은 SET_ACTIVE_TITLE을 보낸다');
});

// ── ② 일일 파편 변환의 유물 상한 ──────────────────────────────────────────────

const shardPlayer = (rank, relicCount) => {
    const owned = RELICS.slice(0, relicCount).map((entry) => structuredClone(entry));
    return {
        ...structuredClone(INITIAL_STATE.player),
        job: '전사',
        level: 30,
        relics: owned,
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank },
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            relicCount,
            dailyProtocol: {
                date: 'fixture-day',
                relicShards: 4,
                missions: [{ id: 'gold_n', type: 'goldSpend', goal: 10, progress: 9, done: false, reward: { relicShard: 1 } }],
            },
        },
    };
};

test('[② 파편] 프레스티지 rank 2(상한 6)는 유물 5개에서 파편 5개를 여섯 번째 유물로 변환한다', () => {
    assert.equal(getPrestigeUnlocks(2).maxRelics, 6, '전제: rank 2 상한은 6');
    const { player, reward } = resolveDailyProtocolProgress(shardPlayer(2, 5), 'goldSpend', 1, 0.5);
    assert.ok(reward.convertedRelic, '변환된다');
    assert.equal(player.relics.length, 6);
    assert.equal(player.stats.dailyProtocol.relicShards, 0);
    assert.equal(player.stats.relicCount, 6);
});

test('[② 파편] rank 0(상한 5)은 유물 5개에서 변환하지 않고 파편을 보존한다(기존 동작)', () => {
    const { player, reward } = resolveDailyProtocolProgress(shardPlayer(0, 5), 'goldSpend', 1, 0.5);
    assert.equal(reward.convertedRelic, null);
    assert.equal(player.relics.length, 5);
    assert.equal(player.stats.dailyProtocol.relicShards, 5);
});

test('[② 파편] rank 2도 유물 6개(상한)에서는 변환하지 않는다', () => {
    const { player, reward } = resolveDailyProtocolProgress(shardPlayer(2, 6), 'goldSpend', 1, 0.5);
    assert.equal(reward.convertedRelic, null);
    assert.equal(player.relics.length, 6);
    assert.equal(player.stats.dailyProtocol.relicShards, 5);
});

// ── ③ 체인 완주 보상의 유물 수집 계수 ─────────────────────────────────────────

test('[③ relicCount] 체인 완주 보상 유물을 직접 받으면 유물 수집 계수가 1 오른다', () => {
    const chain = EVENT_CHAINS.find((entry) => entry.id === 'dragon_legacy');
    const stepData = chain.steps.find((entry) => entry.step === 2);
    const baseRelics = ['soul_drain', 'bloodthirst'].map(relic);
    let state = stateFor({
        job: '나이트', level: 40, loc: stepData.loc, relics: baseRelics,
        eventChainProgress: { [chain.id]: 2 },
        stats: { ...structuredClone(INITIAL_STATE.player.stats), relicCount: 7 },
    }, {
        gameState: GS.EVENT,
        currentEvent: { ...structuredClone(stepData.event), _chainId: chain.id, _chainStep: 2 },
    });
    assert.equal(stepData.event.outcomes[0].reward?.type, 'relic', '전제: 첫 선택지가 유물 완주 보상');
    const dispatch = (action) => { state = gameReducer(state, action); };
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch,
        addLog: () => {},
        getFullStats: () => calculateFullStats(state.player),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);

    assert.equal(state.player.eventChainProgress[chain.id], 3, '비공허: 스텝이 진행됐다');
    assert.equal(state.player.relics.length, baseRelics.length + 1, '비공허: 유물을 직접 받았다');
    assert.equal(state.player.stats.relicCount, 8);
});
