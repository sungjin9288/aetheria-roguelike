import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import RelicChoicePanel from '../src/components/RelicChoicePanel.tsx';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { RELICS } from '../src/data/relics.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 27 N2 (D3) — 체인 완주 보상 유물도 보유 상한을 지킨다.
 *
 * main에는 경로가 둘이었다:
 *   - 리듀서 `RESOLVE_CHAIN_GOLD_CHOICE`(상인의 인장 구매)는 상한에서 `CHAIN_RELIC_SLOTS_FULL`로 거부.
 *   - 훅 `eventActions`의 완주 보상(`reward.type === 'relic'`)은 검사 없이 추가 → rank 0에서
 *     dragon_legacy 2단계가 5/5 → 6/5, 이어서 forgotten_commander 2단계가 6/5 → 7/5.
 *
 * 선택한 정책: 상한에서는 뽑힌 유물을 **기존 유물 선택 패널**(`pendingRelics`)로 제안하고,
 * 패널은 상한일 때 "보유 유물 하나와 교체"(`REPLACE_RELIC`) 또는 "고르지 않기"(`DECLINE_RELIC`)를 준다.
 * 체인 스텝은 그 자리에서 진행된다(스토리 차단 없음), 유물 수는 절대 늘지 않는다(상한 준수),
 * 보상은 조용히 사라지지 않는다(플레이어가 교체를 고를 수 있다). `ADD_RELIC` 자체도 상한을 지킨다.
 */

const RANK0_CAP = getPrestigeUnlocks(0).maxRelics;
const ownedAtCap = () => structuredClone(RELICS.slice(0, RANK0_CAP));

const chainStep = (chainId, step) => {
    const chain = EVENT_CHAINS.find((entry) => entry.id === chainId);
    return chain.steps.find((entry) => entry.step === step);
};

const chainState = (chainId, step, player = {}) => {
    const stepData = chainStep(chainId, step);
    return {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        logs: [],
        gameState: GS.EVENT,
        currentEvent: { ...structuredClone(stepData.event), _chainId: chainId, _chainStep: step },
        player: {
            ...structuredClone(INITIAL_STATE.player),
            name: '용사',
            job: '나이트',
            level: 40,
            loc: stepData.loc,
            eventChainProgress: { [chainId]: step },
            ...player,
        },
    };
};

/** 실제 훅(`createEventActions`) + 실제 리듀서로 체인 선택지를 해소한다. */
const resolveChainChoice = (state, choiceIndex, rng = () => 0.5) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    createEventActions({
        player: current.player,
        currentEvent: current.currentEvent,
        dispatch,
        addLog,
        getFullStats: () => calculateFullStats(current.player),
        rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return current;
};

const ids = (relics) => (relics || []).map((relic) => relic.id);

const assertOfferAtCap = (chainId, step, choiceIndex, owned) => {
    const before = chainState(chainId, step, { relics: owned });
    assert.equal(chainStep(chainId, step).event.outcomes[choiceIndex].reward?.type, 'relic', '전제: 유물 완주 보상');
    const after = resolveChainChoice(before, choiceIndex);

    // 비공허 가드: 스텝이 실제로 진행됐고 이벤트는 닫혔다.
    assert.equal(after.player.eventChainProgress[chainId], step + 1, '체인 스텝이 진행됐다(스토리 차단 없음)');
    assert.equal(after.gameState, GS.IDLE);
    assert.equal(after.currentEvent, null);

    // 상한: 유물 수는 늘지 않는다.
    assert.deepEqual(ids(after.player.relics), ids(owned), '보유 유물은 그대로다');

    // 보상 소실 없음: 뽑힌 유물이 교체 제안으로 남는다.
    assert.ok(Array.isArray(after.pendingRelics), '교체 제안이 유물 선택 패널에 올라왔다');
    assert.equal(after.pendingRelics.length, 1);
    const [offered] = after.pendingRelics;
    assert.ok(RELICS.some((relic) => relic.id === offered.id), '제안은 실제 유물 카탈로그의 항목이다');
    assert.ok(!ids(owned).includes(offered.id), '제안은 아직 보유하지 않은 유물이다');
    assert.ok(after.logs.some((log) => log.text === MSG.CHAIN_REWARD_RELIC_REPLACE_OFFER(offered.name)));
    return { after, offered };
};

test('D3 dragon_legacy 2단계 완주 보상은 5/5에서 6/5가 되지 않고 교체 제안으로 남는다', () => {
    for (const choiceIndex of [0, 1]) {
        assertOfferAtCap('dragon_legacy', 2, choiceIndex, ownedAtCap());
    }
});

test('D3 forgotten_commander 2단계 완주 보상도 5/5에서 늘지 않는다', () => {
    assertOfferAtCap('forgotten_commander', 2, 0, ownedAtCap());
});

test('D3 감사 순서(dragon_legacy → forgotten_commander)는 7/5가 아니라 5/5로 끝난다', () => {
    const first = assertOfferAtCap('dragon_legacy', 2, 0, ownedAtCap());
    const declined = gameReducer(first.after, { type: AT.DECLINE_RELIC });
    assert.equal(declined.pendingRelics, null);
    const second = resolveChainChoice({
        ...chainState('forgotten_commander', 2, {
            relics: declined.player.relics,
            eventChainProgress: { ...declined.player.eventChainProgress, forgotten_commander: 2 },
        }),
    }, 0);
    assert.equal(second.player.relics.length, RANK0_CAP);
    assert.equal(second.player.eventChainProgress.forgotten_commander, 3);
    assert.equal(second.player.eventChainProgress.dragon_legacy, 3);
});

test('D3 이미 상한을 넘은 구세이브(6/5)도 완주 보상으로 더 늘지 않는다', () => {
    const legacyOverCap = structuredClone(RELICS.slice(0, RANK0_CAP + 1));
    assertOfferAtCap('forgotten_commander', 2, 0, legacyOverCap);
});

test('D3 교체를 고르면 5/5를 유지한 채 보상 유물을 받는다', () => {
    const owned = ownedAtCap();
    const { after, offered } = assertOfferAtCap('dragon_legacy', 2, 0, owned);
    const released = owned[2];
    const relicCountBefore = after.player.stats?.relicCount || 0;
    const replaced = gameReducer(after, {
        type: AT.REPLACE_RELIC,
        payload: { relicId: offered.id, replaceRelicId: released.id },
    });

    assert.equal(replaced.pendingRelics, null);
    assert.equal(replaced.player.relics.length, RANK0_CAP);
    assert.ok(ids(replaced.player.relics).includes(offered.id));
    assert.ok(!ids(replaced.player.relics).includes(released.id));
    assert.equal(replaced.player.relics[2].id, offered.id, '내려놓은 자리에 들어간다');
    assert.equal(replaced.player.stats.relicCount, relicCountBefore + 1, '획득 누계는 1 오른다');
    assert.equal(replaced.logs.at(-1)?.text, MSG.RELIC_REPLACED(released.name, offered.name));
});

test('D3 REPLACE_RELIC은 제안에 없는 유물·보유하지 않은 교체 대상·이미 보유한 유물을 거부한다', () => {
    const owned = ownedAtCap();
    const { after, offered } = assertOfferAtCap('dragon_legacy', 2, 0, owned);
    const notPending = RELICS.find((relic) => relic.id !== offered.id && !ids(owned).includes(relic.id));
    const reject = (payload) => gameReducer(after, { type: AT.REPLACE_RELIC, payload });

    assert.equal(reject({ relicId: notPending.id, replaceRelicId: owned[0].id }), after);
    assert.equal(reject({ relicId: offered.id, replaceRelicId: notPending.id }), after);
    const alreadyOwned = { ...after, pendingRelics: [owned[1]] };
    assert.equal(gameReducer(alreadyOwned, {
        type: AT.REPLACE_RELIC,
        payload: { relicId: owned[1].id, replaceRelicId: owned[0].id },
    }), alreadyOwned);
});

test('D3 ADD_RELIC은 상한에서 유물을 늘리지 않고 제안을 남겨 둔다', () => {
    const owned = ownedAtCap();
    const { after, offered } = assertOfferAtCap('dragon_legacy', 2, 0, owned);
    const added = gameReducer(after, { type: AT.ADD_RELIC, payload: offered });

    assert.deepEqual(ids(added.player.relics), ids(owned), '상한에서 추가 거부');
    assert.deepEqual(ids(added.pendingRelics), [offered.id], '교체/넘기기를 고를 수 있게 제안은 남는다');
    assert.equal(added.logs.at(-1)?.text, MSG.RELIC_SLOTS_FULL_REPLACE);
});

test('D3 상한 미만에서는 ADD_RELIC과 체인 완주 보상이 그대로 유물을 준다', () => {
    const owned = structuredClone(RELICS.slice(0, RANK0_CAP - 1));
    const after = resolveChainChoice(chainState('dragon_legacy', 2, { relics: owned }), 0);
    assert.equal(after.player.eventChainProgress.dragon_legacy, 3);
    assert.equal(after.player.relics.length, RANK0_CAP, '4/5 → 5/5 직접 지급');
    assert.equal(after.pendingRelics, null);
    const gained = after.player.relics.at(-1);
    assert.ok(after.logs.some((log) => log.text === MSG.CHAIN_REWARD_RELIC(gained.name)));

    const candidate = RELICS[RANK0_CAP + 3];
    const addState = { ...chainState('dragon_legacy', 2, { relics: owned }), gameState: GS.IDLE, currentEvent: null, pendingRelics: [candidate] };
    const added = gameReducer(addState, { type: AT.ADD_RELIC, payload: candidate });
    assert.equal(added.player.relics.length, RANK0_CAP);
    assert.equal(added.pendingRelics, null);
});

test('D3 프레스티지 rank 2(상한 6)는 5개에서 완주 보상을 직접 받는다', () => {
    const owned = ownedAtCap();
    const after = resolveChainChoice(chainState('dragon_legacy', 2, {
        relics: owned,
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2 },
    }), 0);
    assert.equal(getPrestigeUnlocks(2).maxRelics, RANK0_CAP + 1);
    assert.equal(after.player.relics.length, RANK0_CAP + 1);
    assert.equal(after.pendingRelics, null);
});

test('D3 골드 선택 리듀서 경로(RESOLVE_CHAIN_GOLD_CHOICE)의 상한 정책은 그대로다', () => {
    const goldState = (relics) => ({
        ...chainState('shadow_guild', 1, { relics, gold: 5000 }),
        logs: [],
    });
    const payload = { chainId: 'shadow_guild', step: 1, choiceIndex: 0 };

    const full = goldState(ownedAtCap());
    const rejected = gameReducer(full, { type: AT.RESOLVE_CHAIN_GOLD_CHOICE, payload });
    assert.equal(rejected.player, full.player, '상한에서는 거부(골드·유물·진행 모두 그대로)');
    assert.equal(rejected.gameState, GS.EVENT);
    assert.equal(rejected.logs.at(-1)?.text, MSG.CHAIN_RELIC_SLOTS_FULL);

    const open = goldState(structuredClone(RELICS.slice(0, RANK0_CAP - 1)));
    const bought = gameReducer(open, { type: AT.RESOLVE_CHAIN_GOLD_CHOICE, payload });
    assert.equal(bought.player.gold, 3000);
    assert.ok(ids(bought.player.relics).includes('merchant_seal'));
    assert.equal(bought.player.eventChainProgress.shadow_guild, 2);
});

test('D3 유물 선택 패널은 상한에서 교체 대상(보유 유물)을 보여 주고, 상한 미만에서는 보이지 않는다', () => {
    const owned = ownedAtCap();
    const offered = RELICS.find((relic) => !ids(owned).includes(relic.id));
    const player = { ...structuredClone(INITIAL_STATE.player), job: '나이트', relics: owned };
    const atCap = renderStatic(createElement(RelicChoicePanel, {
        pendingRelics: [offered],
        dispatch: () => {},
        player,
        stats: calculateFullStats(player),
    }));
    assert.match(atCap, /data-testid="relic-choice-capacity-notice"/);
    owned.forEach((_, index) => {
        assert.match(atCap, new RegExp(`data-testid="relic-replace-${index}"`), `보유 유물 ${index}번을 교체 대상으로 고를 수 있다`);
    });
    assert.match(atCap, /data-testid="relic-choice-skip"/, '넘기기는 그대로 있다');

    const belowPlayer = { ...player, relics: owned.slice(0, RANK0_CAP - 1) };
    const below = renderStatic(createElement(RelicChoicePanel, {
        pendingRelics: [offered],
        dispatch: () => {},
        player: belowPlayer,
        stats: calculateFullStats(belowPlayer),
    }));
    assert.doesNotMatch(below, /relic-replace-|relic-choice-capacity-notice/);
    assert.match(below, /data-testid="relic-choice-0"/);
});
