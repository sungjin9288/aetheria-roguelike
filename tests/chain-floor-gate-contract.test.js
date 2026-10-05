import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { EVENT_CHAINS, getChainEventForLoc, isChainStepFloorReached } from '../src/data/eventChains.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';

/**
 * 2026-10 Wave 62 C17 (원장 §61.4 · 소유자 답 §61.6 "심연 신호 50층 조건").
 *
 * 심연의 신호는 "살아 있다. 50층."이라 말하고 2단계는 "50층에서 … 마주칩니다"인데, 체인 트리거는 위치만 봤다 —
 * 혼돈의 심연 1층에서 신호를 받은 바로 다음 탐험에 생존자가 나왔다. 이제 층 조건은 스텝 데이터(`minAbyssFloor`)가
 * 선언하고 트리거는 `isChainStepFloorReached` 하나로 판정한다. 층 번호는 Wave 35 규칙 그대로다: `stats.abyssFloor`는
 * 돌파한 층 수이고 지금 싸우는 층은 그 + 1이다 — 50층에 있으려면 49층까지 돌파해야 한다.
 */

const ABYSS = '혼돈의 심연';
const clone = (value) => structuredClone(value);
const abyssSignal = EVENT_CHAINS.find((chain) => chain.id === 'abyss_signal');
const stepOf = (index) => abyssSignal.steps.find((step) => step.step === index);

const abyssPlayer = (progressStep, clearedFloor) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base,
        name: '심연 탐험가',
        job: '모험가',
        loc: ABYSS,
        level: 60,
        hp: 5000,
        maxHp: 5000,
        mp: 300,
        maxMp: 300,
        atk: 400,
        def: 200,
        history: [],
        quests: [],
        titles: [],
        stats: {
            ...base.stats,
            abyssFloor: clearedFloor,
            abyssRecord: clearedFloor,
            explores: 3,
            exploreState: { ...base.stats.exploreState, sinceNarrativeEvent: 3 },
        },
        eventChainProgress: progressStep === null ? {} : { abyss_signal: progressStep },
        activeExpedition: undefined,
    };
};

/**
 * 실제 explore()를 한 번 돌린다. 난수는 0.99로 고정해 모닥불 · 정찰 · 서사 이벤트(AI) 롤을 모두 지나게 한다 —
 * 체인이 발동하지 않으면 explore는 평범한 탐험(전투 등)으로 이어진다.
 */
const exploreOnce = async (player) => {
    let state = { ...clone(INITIAL_STATE), gameState: GS.IDLE, player, logs: [] };
    const dispatch = (action) => { state = gameReducer(state, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { id: `chain-floor-${state.logs.length}`, type, text } });
    await createExploreActions({
        player: state.player,
        gameState: state.gameState,
        uid: null,
        dispatch,
        addLog,
        addStoryLog: () => {},
        getFullStats: () => calculateFullStats(state.player),
        rng: () => 0.99,
    }, makeSharedHelpers({ player: state.player, dispatch, addLog })).explore();
    return state;
};

const openedChainStep = (state) => (
    state.gameState === GS.EVENT && state.currentEvent?._chainId === 'abyss_signal'
        ? state.currentEvent._chainStep
        : null
);

test('데이터: 신호가 말한 층과 생존자 · 핵심 스텝의 층 조건이 같은 값이고, 신호 단계에는 조건이 없다', () => {
    const floor = stepOf(1).minAbyssFloor;
    assert.equal(floor, 50);
    assert.equal(stepOf(2).minAbyssFloor, floor, '핵심은 생존자가 안내하는 더 깊은 곳 — 같은 조건');
    assert.equal(stepOf(0).minAbyssFloor, undefined, '신호는 심연 어디서든 잡힌다');
    assert.ok(stepOf(0).event.desc.includes(`${floor}층`), '신호 문구가 그 층을 말한다');
    assert.ok(stepOf(1).event.desc.startsWith(`${floor}층에서`), '생존자 문구가 그 층을 말한다');
    // 층 조건을 가진 스텝은 혼돈의 심연에만 있다(층 번호는 그곳에서만 뜻이 있다).
    for (const chain of EVENT_CHAINS) {
        for (const step of chain.steps) {
            if (step.minAbyssFloor !== undefined) assert.equal(step.loc, ABYSS, `${chain.id}:${step.step}`);
        }
    }
});

test('판정: 지금 싸우는 층(돌파 층 + 1)이 조건 층 이상이어야 한다 — 돌파 48층(49층)은 아직, 49층(50층)부터', () => {
    const step = stepOf(1);
    assert.equal(isChainStepFloorReached(step, 0), false);
    assert.equal(isChainStepFloorReached(step, 48), false);
    assert.equal(isChainStepFloorReached(step, 49), true);
    assert.equal(isChainStepFloorReached(step, 120), true);
    assert.equal(isChainStepFloorReached(step, undefined), false, '기록이 없으면 1층');
    assert.equal(isChainStepFloorReached(step, Number.NaN), false);
    assert.equal(isChainStepFloorReached(stepOf(0), 0), true, '조건 없는 스텝은 언제나 통과');
});

test('[실제 탐험] 신호는 1층에서 잡힌다(층 조건 없음)', async () => {
    const state = await exploreOnce(abyssPlayer(null, 0));
    assert.equal(openedChainStep(state), 0);
});

for (const stepIndex of [1, 2]) {
    test(`[실제 탐험] ${stepIndex}단계: 49층(돌파 48)에서는 발동하지 않고 탐험이 평소대로 이어진다`, async () => {
        for (const cleared of [0, 1, 10, 48]) {
            const state = await exploreOnce(abyssPlayer(stepIndex, cleared));
            assert.equal(openedChainStep(state), null, `돌파 ${cleared}층: 체인 스텝이 열리면 안 된다`);
            assert.equal(state.player.eventChainProgress.abyss_signal, stepIndex, '진행도는 그대로');
            assert.notEqual(state.gameState, GS.IDLE, `돌파 ${cleared}층: 체인 대신 평소 탐험(전투 등)이 일어난다`);
        }
    });

    test(`[실제 탐험] ${stepIndex}단계: 50층(돌파 49) 이상에서 발동한다`, async () => {
        for (const cleared of [49, 50, 99]) {
            const state = await exploreOnce(abyssPlayer(stepIndex, cleared));
            assert.equal(openedChainStep(state), stepIndex, `돌파 ${cleared}층`);
            assert.equal(state.currentEvent.desc, stepOf(stepIndex).event.desc);
        }
    });
}

test('[트리거] 다른 지역 · 다른 체인 판정은 층과 무관하다', () => {
    for (const chain of EVENT_CHAINS) {
        if (chain.id === 'abyss_signal') continue;
        const first = chain.steps[0];
        assert.equal(getChainEventForLoc(first.loc, {}, undefined, 0)?.chain.id !== undefined, true, `${chain.id}: 0층에서도 첫 스텝이 잡힌다`);
    }
    // 층 조건 스텝이 막히면 null이지, 다른 체인으로 잘못 넘어가지 않는다(혼돈의 심연에 다른 체인 스텝은 없다).
    assert.equal(getChainEventForLoc(ABYSS, { abyss_signal: 1 }, undefined, 48), null);
    assert.equal(getChainEventForLoc(ABYSS, { abyss_signal: 1 }, undefined, 49)?.step.step, 1);
});
