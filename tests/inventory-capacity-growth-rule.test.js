import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { checkDiscoveryChains } from '../src/hooks/gameActions/exploreFlow.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { admitCombatLoot } from '../src/systems/combatLootCapacity.js';
import { findItemByName, makeItem } from '../src/utils/gameUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-09 Wave 27 N2 (D2) — 가방 상한은 "증가"만 막는다.
 *
 * 정책(통합자 결정):
 *   ① 보상은 잃지 않는다 — 퀘스트·체인·처치 마일스톤·묘비 회수·발견 체인 보상은 상한을 넘겨도 들어온다.
 *   ② 상한 규칙은 증가만 막는다 — 어떤 조작이 가방을 상한과 **현재 크기 둘 다**보다 크게 만들 때만 거부한다.
 *
 * 결함(main 재현): 20/20 가방에 퀘스트 보상이 들어와 21/20이 되면 `equipmentHandlers`가
 * 교체 뒤 `inventory.length > cap`을 봐서 순증 0인 장비 교체까지 전부 `MSG.INV_FULL`로 거부했다.
 * 자연 플레이에서 대마법사는 체인 전설 지팡이를 Lv60~68 동안 장착하지 못했다.
 *
 * 과대 가방은 손으로 만든 배열이 아니라 **실제 보상 액션**(CLAIM_QUEST_REWARD · 체인 훅)이 만든다.
 */

const CAP = BALANCE.INV_MAX_SIZE;
// makeItem의 id는 (now, rng)에서 나온다 — 같은 값을 주면 id가 겹쳐 USE_INVENTORY_ITEM이 엉뚱한 칸을 집는다.
let itemSequence = 0;
const item = (name) => {
    itemSequence += 1;
    return makeItem(findItemByName(name), () => 0.5, () => 1_700_000_000_000 + itemSequence);
};
const potions = (count) => Array.from({ length: count }, () => item('하급 체력 물약'));

const baseState = (player, overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    player: { ...structuredClone(INITIAL_STATE.player), name: '용사', ...player },
    ...overrides,
});

const equip = (state, name) => {
    const target = state.player.inv.find((entry) => entry.name === name);
    assert.ok(target, `${name}이 가방에 있어야 한다`);
    return gameReducer(state, { type: AT.USE_INVENTORY_ITEM, payload: { itemId: target.id } });
};

/** 전사 Lv10 · 20/20 가방(물약 19 + 병사 갑옷) · 퀘스트 3(보상 강철 롱소드) 완료 대기. */
const warriorWithFullBag = (extra = {}) => baseState({
    job: '전사',
    level: 10,
    loc: '서쪽 평원',
    inv: [...potions(CAP - 1), item('병사 갑옷')],
    equip: { weapon: item('녹슨 도끼'), armor: item('가죽 갑옷'), offhand: null },
    quests: [{ id: 3, progress: 5 }],
    stats: { ...structuredClone(INITIAL_STATE.player.stats), claimedQuestIds: [] },
    ...extra,
});

/** 실제 보상 액션으로 21/20을 만든다 — 보상 소실 금지(①)의 증거이기도 하다. */
const claimQuestOverCap = (state) => {
    const before = state.player.inv.length;
    const next = gameReducer(state, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: 3 } });
    assert.equal(before, CAP, '전제: 가방이 정확히 상한이다');
    assert.equal(next.player.inv.length, CAP + 1, '퀘스트 보상은 상한을 넘겨도 들어온다(보상 소실 금지)');
    assert.ok(next.player.inv.some((entry) => entry.name === '강철 롱소드'));
    return next;
};

test('D2 과대 가방(퀘스트 보상 21/20)에서 순증 0 방어구 교체는 허용된다', () => {
    const over = claimQuestOverCap(warriorWithFullBag());
    const swapped = equip(over, '병사 갑옷');

    assert.equal(swapped.player.equip.armor?.name, '병사 갑옷', '교체가 실제로 일어났다');
    assert.equal(swapped.player.inv.length, CAP + 1, '교체는 가방 크기를 바꾸지 않는다');
    assert.ok(swapped.player.inv.some((entry) => entry.name === '가죽 갑옷'), '벗은 방어구는 가방으로 돌아온다');
    assert.ok(!swapped.logs.some((log) => log.text === MSG.INV_FULL), 'INV_FULL 거부가 없다');
});

test('D2 과대 가방에서 줄어드는 장착(한손 무기 → 기존 무기는 보조손으로)도 허용된다', () => {
    const over = claimQuestOverCap(warriorWithFullBag());
    const shifted = equip(over, '강철 롱소드');

    assert.equal(shifted.player.equip.weapon?.name, '강철 롱소드');
    assert.equal(shifted.player.equip.offhand?.name, '녹슨 도끼', '기존 한손 무기는 보조손으로 옮겨진다');
    assert.equal(shifted.player.inv.length, CAP, '가방은 21 → 20으로 줄어든다');
});

test('D2 체인 전설 보상(lost_wizard 2단계)으로 21/20이 된 대마법사는 그 지팡이를 장착할 수 있다', () => {
    const chain = EVENT_CHAINS.find((entry) => entry.id === 'lost_wizard');
    const stepData = chain.steps.find((entry) => entry.step === 2);
    const choiceIndex = stepData.event.outcomes.findIndex((outcome) => outcome.reward?.type === 'legendary_item');
    const rewardName = stepData.event.outcomes[choiceIndex].reward.name;
    let state = baseState({
        job: '대마법사',
        level: 60,
        loc: stepData.loc,
        inv: potions(CAP),
        equip: { weapon: item('빙하의 지팡이'), armor: null, offhand: null },
        eventChainProgress: { [chain.id]: 2 },
    }, {
        gameState: GS.EVENT,
        currentEvent: { ...structuredClone(stepData.event), _chainId: chain.id, _chainStep: 2 },
    });
    const dispatch = (action) => { state = gameReducer(state, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch,
        addLog,
        getFullStats: () => calculateFullStats(state.player),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);

    assert.equal(state.player.eventChainProgress[chain.id], 3, '체인 스텝이 실제로 진행됐다');
    assert.equal(state.player.inv.length, CAP + 1, '체인 전설 보상은 상한을 넘겨도 들어온다');
    const swapped = equip(state, rewardName);
    assert.equal(swapped.player.equip.weapon?.name, rewardName, '보상 지팡이를 장착했다');
    assert.equal(swapped.player.inv.length, CAP + 1, '순증 0');
    assert.ok(swapped.player.inv.some((entry) => entry.name === '빙하의 지팡이'));
});

test('D2 과대 가방을 더 키우는 교체(양손 무기로 무기+방패 둘 다 반환)는 여전히 거부된다', () => {
    const over = claimQuestOverCap(warriorWithFullBag({
        inv: [...potions(CAP - 1), item('양손검')],
        equip: { weapon: item('녹슨 도끼'), armor: item('가죽 갑옷'), offhand: item('목재 방패') },
    }));
    const attempted = equip(over, '양손검');

    assert.equal(attempted.player, over.player, '플레이어 상태는 동일 참조로 남는다');
    assert.equal(attempted.logs.at(-1)?.text, MSG.INV_FULL);
});

test('D2 정확히 상한인 가방에서도 증가 교체는 거부되고 순증 0 교체는 허용된다', () => {
    const atCap = warriorWithFullBag({
        inv: [...potions(CAP - 2), item('양손검'), item('병사 갑옷')],
        equip: { weapon: item('녹슨 도끼'), armor: item('가죽 갑옷'), offhand: item('목재 방패') },
    });
    assert.equal(atCap.player.inv.length, CAP);

    const grow = equip(atCap, '양손검');
    assert.equal(grow.player, atCap.player, '20 → 21 증가 교체 거부');
    assert.equal(grow.logs.at(-1)?.text, MSG.INV_FULL);

    const swap = equip(atCap, '병사 갑옷');
    assert.equal(swap.player.equip.armor?.name, '병사 갑옷');
    assert.equal(swap.player.inv.length, CAP);
});

test('D2 상한 미만 가방에서 상한까지 커지는 교체는 허용된다(19 → 20)', () => {
    const below = warriorWithFullBag({
        inv: [...potions(CAP - 2), item('양손검')],
        equip: { weapon: item('녹슨 도끼'), armor: item('가죽 갑옷'), offhand: item('목재 방패') },
    });
    assert.equal(below.player.inv.length, CAP - 1);
    const grown = equip(below, '양손검');
    assert.equal(grown.player.equip.weapon?.name, '양손검');
    assert.equal(grown.player.equip.offhand, null);
    assert.equal(grown.player.inv.length, CAP);
});

const buyPotion = (state) => gameReducer({
    ...state,
    gameState: GS.SHOP,
    player: { ...state.player, loc: '시작의 마을', gold: 999 },
}, {
    type: AT.BUY_SHOP_ITEM,
    payload: {
        source: 'stock',
        itemName: '하급 체력 물약',
        expectedGold: 999,
        expectedInventorySize: state.player.inv.length,
        relicRoll: 0.5,
    },
});

test('D2 구매는 상한에서도, 과대 가방에서도 거부되고 상한 미만에서는 들어온다', () => {
    const over = claimQuestOverCap(warriorWithFullBag());
    const overBuy = buyPotion(over);
    assert.equal(overBuy.player.inv.length, CAP + 1, '21/20에서 구매 거부');
    assert.equal(overBuy.logs.at(-1)?.text, MSG.INV_FULL);

    const atCap = warriorWithFullBag();
    const atCapBuy = buyPotion(atCap);
    assert.equal(atCapBuy.player.inv.length, CAP, '20/20에서 구매 거부');
    assert.equal(atCapBuy.logs.at(-1)?.text, MSG.INV_FULL);

    const below = warriorWithFullBag({ inv: potions(CAP - 1) });
    const belowBuy = buyPotion(below);
    assert.equal(belowBuy.player.inv.length, CAP, '19/20에서 구매 허용');
    assert.equal(belowBuy.logs.at(-1)?.text, MSG.SHOP_BUY_DONE('하급 체력 물약'));
});

test('D2 전리품은 과대 가방에서 한 개도 들어오지 않는다(증가 차단 유지)', () => {
    const over = claimQuestOverCap(warriorWithFullBag());
    const candidates = [
        { item: item('롱소드'), logs: [] },
        { item: item('하급 체력 물약'), logs: [] },
    ];
    const admission = admitCombatLoot(over.player, candidates);
    assert.equal(admission.capacity, CAP);
    assert.equal(admission.available, 0);
    assert.equal(admission.admitted.length, 0);
    assert.equal(admission.blocked.length, candidates.length);

    const atCap = admitCombatLoot(warriorWithFullBag().player, candidates);
    assert.equal(atCap.admitted.length, 0, '20/20에서도 차단');
});

test('D2 발견 체인 아이템 보상은 가득 찬 가방에서도 사라지지 않는다', () => {
    const chain = BALANCE.DISCOVERY_CHAINS.find((entry) => entry.reward.item);
    assert.ok(chain, '아이템 보상이 있는 발견 체인이 있다');
    const [lastLoc, ...visited] = [...chain.locations].reverse();
    let state = warriorWithFullBag({
        inv: potions(CAP),
        stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: visited, discoveryChains: [] },
    });
    const dispatch = (action) => { state = gameReducer(state, action); };
    checkDiscoveryChains(state.player, lastLoc, { dispatch, addLog: () => {} });

    assert.ok(state.player.stats.discoveryChains.includes(chain.id), '발견 체인이 실제로 완료 처리됐다');
    assert.equal(state.player.inv.length, CAP + 1, '보상 아이템이 상한을 넘겨 들어온다');
    assert.ok(state.player.inv.some((entry) => entry.name === chain.reward.item));
});
