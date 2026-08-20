import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS, getChainEventForLoc } from '../src/data/eventChains.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { buildChainJournal } from '../src/utils/chainJournal.js';

const CANONICAL_FAILURES = [
    {
        chainId: 'last_hero',
        step: 0,
        loc: '서쪽 평원',
        title: '죽어가는 기사',
        choiceIndex: 1,
        choice: '어쩔 수 없다, 지나친다',
        log: '기사를 두고 지나쳤습니다. 기사의 검은 다시 찾을 수 없을 것입니다.',
        reward: null,
    },
    {
        chainId: 'forgotten_god',
        step: 1,
        loc: '에테르 관문',
        title: '차원 너머의 목소리',
        choiceIndex: 1,
        choice: '귀를 막고 관문을 봉인한다',
        log: '관문을 봉인했습니다. 목소리가 사라집니다. 무언가 잃은 것 같습니다.',
        reward: null,
    },
    {
        chainId: 'machine_uprising',
        step: 1,
        loc: '몰락한 전초기지',
        title: '기계 집단의 본거지',
        choiceIndex: 1,
        choice: '당국에 신고하겠다고 협박한다',
        log: '협박이 역효과를 냈습니다. 기계들이 적대적으로 돌아섰습니다.',
        reward: null,
    },
    {
        chainId: 'forgotten_commander',
        step: 0,
        loc: '잊혀진 폐허',
        title: '녹슨 갑옷',
        choiceIndex: 1,
        choice: '갑옷에 경의를 표하고 떠난다',
        log: '갑옷에 경의를 표한 뒤 떠났습니다. 작은 보상이 마음을 채웁니다.',
        reward: { type: 'gold', amount: 500 },
    },
    {
        chainId: 'forgotten_commander',
        step: 1,
        loc: '몰락한 전초기지',
        title: '사령관의 일지',
        choiceIndex: 1,
        choice: '위험을 무릅쓰지 않는다',
        log: '일지를 그대로 두고 떠났습니다.',
        reward: null,
    },
    {
        chainId: 'water_apostle',
        step: 0,
        loc: '호수의 신전',
        title: '신관의 일기',
        choiceIndex: 1,
        choice: '신성한 일기를 그 자리에 두고 떠난다',
        log: '일기는 본래 자리에 두고 떠났습니다. 신전이 작은 축복을 보내옵니다.',
        reward: { type: 'gold', amount: 800 },
    },
    {
        chainId: 'water_apostle',
        step: 1,
        loc: '사막 오아시스',
        title: '메마른 우물',
        choiceIndex: 1,
        choice: '망토 조각만 챙기고 떠난다',
        log: '망토 조각만 챙기고 다음 길은 포기했습니다.',
        reward: { type: 'gold', amount: 1500 },
    },
];

const getCanonicalStep = (chainId, step) => {
    const chain = EVENT_CHAINS.find((candidate) => candidate.id === chainId);
    return { chain, stepData: chain?.steps.find((candidate) => candidate.step === step) };
};

const settleCanonicalChoice = ({ chainId, step }, choiceIndex) => {
    const { stepData } = getCanonicalStep(chainId, step);
    const startingGold = 10_000;
    let state = {
        ...structuredClone(INITIAL_STATE),
        player: {
            ...structuredClone(INITIAL_STATE.player),
            gold: startingGold,
            eventChainProgress: { [chainId]: step },
        },
        gameState: GS.EVENT,
        currentEvent: {
            ...structuredClone(stepData.event),
            _chainId: chainId,
            _chainStep: step,
        },
    };
    const dispatches = [];
    const logs = [];
    const player = state.player;
    const currentEvent = state.currentEvent;

    createEventActions({
        player,
        currentEvent,
        dispatch: (action) => {
            dispatches.push(action);
            state = gameReducer(state, action);
        },
        addLog: (type, text) => logs.push({ type, text }),
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
        rng: () => 0,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);

    return { dispatches, logs, startingGold, state };
};

test('canonical chain_advance_fail census is exactly the seven terminal outcomes', () => {
    const actual = EVENT_CHAINS.flatMap((chain) => chain.steps.flatMap((stepData) => (
        stepData.event.outcomes.flatMap((outcome, choiceIndex) => (
            outcome.type === 'chain_advance_fail'
                ? [{
                    chainId: chain.id,
                    step: stepData.step,
                    loc: stepData.loc,
                    title: stepData.event.title,
                    choiceIndex,
                    choice: stepData.event.choices[choiceIndex],
                    log: outcome.log,
                    reward: outcome.reward,
                }]
                : []
        ))
    )));

    assert.deepEqual(actual, CANONICAL_FAILURES);
});

for (const failure of CANONICAL_FAILURES) {
    test(`${failure.chainId} step ${failure.step} failure settles the chain terminally`, () => {
        const { chain, stepData } = getCanonicalStep(failure.chainId, failure.step);
        const outcome = stepData.event.outcomes[failure.choiceIndex];
        assert.equal(outcome.type, 'chain_advance_fail');

        const result = settleCanonicalChoice(failure, failure.choiceIndex);
        assert.deepEqual(
            result.dispatches.find((action) => action.type === AT.UPDATE_EVENT_CHAIN),
            { type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: failure.chainId, step: 'failed' } },
        );
        assert.deepEqual(
            result.dispatches.map((action) => action.type),
            [AT.SET_PLAYER, AT.UPDATE_EVENT_CHAIN, AT.SET_EVENT, AT.SET_GAME_STATE],
        );
        assert.equal(result.state.player.eventChainProgress[failure.chainId], 'failed');
        assert.equal(result.state.player.gold, result.startingGold + (failure.reward?.amount ?? 0));
        assert.deepEqual(result.logs, [{ type: 'event', text: failure.log }]);
        assert.equal(result.state.currentEvent, null);
        assert.equal(result.state.gameState, GS.IDLE);

        for (const laterStep of chain.steps.filter((candidate) => candidate.step > failure.step)) {
            const nextEvent = getChainEventForLoc(laterStep.loc, result.state.player.eventChainProgress);
            assert.notEqual(nextEvent?.chain.id, failure.chainId);
        }
        assert.equal(
            buildChainJournal(result.state.player.eventChainProgress)
                .some((entry) => entry.chainId === failure.chainId),
            false,
        );
    });
}

test('canonical chain_advance still increments the numeric current step', () => {
    const progress = { chainId: 'shadow_guild', step: 0 };
    const result = settleCanonicalChoice(progress, 0);

    assert.deepEqual(
        result.dispatches.find((action) => action.type === AT.UPDATE_EVENT_CHAIN),
        { type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: 'shadow_guild', step: 1 } },
    );
    assert.equal(result.state.player.eventChainProgress.shadow_guild, 1);
    assert.equal(result.state.currentEvent, null);
    assert.equal(result.state.gameState, GS.IDLE);
});

test('canonical nothing outcome does not update chain progress', () => {
    const progress = { chainId: 'ancient_prophecy', step: 0 };
    const result = settleCanonicalChoice(progress, 1);

    assert.equal(result.dispatches.some((action) => action.type === AT.UPDATE_EVENT_CHAIN), false);
    assert.equal(result.state.player.eventChainProgress.ancient_prophecy, 0);
    assert.equal(result.state.currentEvent, null);
    assert.equal(result.state.gameState, GS.IDLE);
});
