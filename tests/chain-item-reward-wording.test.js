import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { EVENT_CHAINS, isChainEventStep } from '../src/data/eventChains.js';
import { applyChainCombatVictory } from '../src/hooks/combatActions/_helpers.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { findItemByName } from '../src/utils/gameUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-10 감사 GP-01 — 이야기의 아이템 보상은 기록이 말한 아이템 그대로 가방에 들어온다.
 *
 * '최후의 영웅' 1단계 기록이 "기사의 검을 획득했습니다"였는데 가방에 들어오는 것은 '심판자의 검'(4등급 빛)이었다.
 * '기사의 검'은 별개의 일반 장비(2등급)라 플레이어는 가방에서 없는 아이템을 찾았다. 아이템 보상 경로(`reward.type === 'item'`)는
 * 전리품 줄을 따로 남기지 않으므로 이야기 기록 한 줄이 받은 것을 알리는 유일한 문장이다.
 *
 * 실제 훅(`createEventActions`) + 실제 리듀서로 모든 아이템 보상 선택지를 해소하고, 새로 남은 기록이
 *   ① 실제로 가방에 들어온 아이템 이름을 말하고 ② 들어오지 않은 다른 카탈로그 아이템 이름을 말하지 않는지 본다.
 * 그 단계의 이벤트 제목도 다른 카탈로그 아이템 이름이 아니다(제목이 아이템 이름처럼 보이면 같은 혼동이다).
 */

const CATALOG_NAMES = [
    ...DB.ITEMS.consumables,
    ...DB.ITEMS.weapons,
    ...DB.ITEMS.armors,
    ...DB.ITEMS.materials,
].map((item) => item.name).filter((name) => typeof name === 'string' && name.length >= 2);

const otherCatalogNames = (text, grantedNames) => {
    const stripped = grantedNames.reduce((rest, name) => rest.split(name).join(' '), String(text || ''));
    return [...new Set(CATALOG_NAMES.filter((name) => !grantedNames.includes(name) && stripped.includes(name)))];
};

const ITEM_REWARD_CASES = EVENT_CHAINS.flatMap((chain) => chain.steps
    .filter(isChainEventStep)
    .flatMap((step) => step.event.outcomes.flatMap((outcome, choiceIndex) => (
        outcome.reward && ['item', 'legendary_item'].includes(outcome.reward.type)
            ? [{ chainId: chain.id, step, choiceIndex, outcome }]
            : []
    ))));

const chainState = (chainId, step) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    gameState: GS.EVENT,
    currentEvent: { ...structuredClone(step.event), _chainId: chainId, _chainStep: step.step },
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '용사',
        job: '나이트',
        level: 40,
        loc: step.loc,
        inv: [],
        eventChainProgress: { [chainId]: step.step },
    },
});

/**
 * 실제 훅 + 실제 리듀서로 이야기 선택지를 해소한다. 전투를 약속한 선택지(`combat`)는 그 전투의 승리 정산
 * (`applyChainCombatVictory` — 보상과 기록을 주는 유일한 곳)까지 간다.
 */
const resolveChainChoice = (state, choiceIndex, outcome) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    if (outcome.combat) {
        const { _chainId: chainId, _chainStep: step } = current.currentEvent;
        dispatch({ type: AT.SET_EVENT, payload: null });
        applyChainCombatVictory({ chainCombat: { chainId, step, choiceIndex } }, current.player, { dispatch, addLog });
        return current;
    }
    createEventActions({
        player: current.player,
        currentEvent: current.currentEvent,
        dispatch,
        addLog,
        getFullStats: () => calculateFullStats(current.player),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return current;
};

test('이야기의 아이템 보상 선택지가 있다 — 최후의 영웅 1단계(심판자의 검)를 포함한다', () => {
    assert.ok(ITEM_REWARD_CASES.length >= 8, String(ITEM_REWARD_CASES.length));
    const lastHero = ITEM_REWARD_CASES.find(({ chainId, step }) => chainId === 'last_hero' && step.step === 1);
    assert.ok(lastHero, 'last_hero 1단계 아이템 보상');
    assert.equal(lastHero.outcome.reward.name, '심판자의 검');
    for (const { outcome } of ITEM_REWARD_CASES) {
        assert.ok(findItemByName(outcome.reward.name), `카탈로그에 있는 보상: ${outcome.reward.name}`);
    }
});

test('[실제 경로] 이야기 아이템 보상의 기록은 가방에 들어온 아이템 이름을 말하고, 받지 않은 아이템 이름을 말하지 않는다', () => {
    for (const { chainId, step, choiceIndex, outcome } of ITEM_REWARD_CASES) {
        const where = `${chainId}:${step.step}:${choiceIndex}`;
        const before = chainState(chainId, step);
        const after = resolveChainChoice(before, choiceIndex, outcome);

        // 비공허 가드: 선택이 실제로 해소됐고 아이템이 들어왔다.
        assert.equal(after.currentEvent, null, `${where} 이벤트가 닫혔다`);
        const granted = [...new Set((after.player.inv || []).map((item) => item.name))];
        assert.deepEqual(granted, [outcome.reward.name], `${where} 가방에 들어온 아이템`);

        const newLines = after.logs.map((log) => log.text);
        assert.ok(newLines.length > 0, `${where} 기록이 남았다`);
        assert.ok(
            newLines.some((text) => text.includes(outcome.reward.name)),
            `${where} 기록이 받은 아이템(${outcome.reward.name})을 말한다: ${newLines.join(' / ')}`,
        );
        for (const text of newLines) {
            assert.deepEqual(otherCatalogNames(text, granted), [], `${where} 받지 않은 아이템 이름: ${text}`);
        }
        assert.deepEqual(otherCatalogNames(step.event.title, granted), [], `${where} 이벤트 제목: ${step.event.title}`);
    }
});
