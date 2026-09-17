import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_CHAINS, getChainEventForLoc } from '../src/data/eventChains.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { getEventChoicePreview } from '../src/utils/eventPresentation.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { DB } from '../src/data/db.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

const cases = EVENT_CHAINS.flatMap(chain => chain.steps.flatMap(step =>
    step.event.outcomes.flatMap((outcome, choiceIndex) => outcome.type === 'nothing'
        ? [{ chainId: chain.id, step: step.step, choiceIndex, data: step }] : [])));
const wizard = cases.find(entry => entry.chainId === 'lost_wizard' && entry.step === 0);
const buildState = (entry = wizard) => ({
    ...structuredClone(INITIAL_STATE), gameState: 'event',
    player: { ...structuredClone(INITIAL_STATE.player), name: '이야기 검증',
        loc: entry.data.loc, level: 75, job: '전사',
        eventChainProgress: { [entry.chainId]: entry.step } },
    currentEvent: { ...structuredClone(entry.data.event), _chainId: entry.chainId, _chainStep: entry.step },
});
const actionFor = ({ chainId, step, choiceIndex } = wizard, expectedExploreCount = 0) => ({
    type: 'DEFER_CHAIN_EVENT', payload: { chainId, step, choiceIndex, expectedExploreCount },
});
const restore = (state) => gameReducer(INITIAL_STATE, {
    type: 'LOAD_DATA', payload: migrateData(JSON.parse(JSON.stringify({ ...state, version: 5 }))),
});

test('미루기 대상은 8개 이야기의 보상 없는 nothing 선택 14개다', () => {
    assert.equal(cases.length, 14);
    assert.equal(new Set(cases.map(entry => entry.chainId)).size, 8);
    for (const entry of cases) assert.equal(entry.data.event.outcomes[entry.choiceIndex].reward, null);
});

for (const entry of cases) {
    test(`${entry.chainId}:${entry.step}:${entry.choiceIndex}는 진행·보상 없이 현재 원정에서만 미룬다`, () => {
        let state = buildState(entry);
        const before = structuredClone(state.player);
        const dispatched = [];
        const choose = createEventActions({
            player: state.player, currentEvent: state.currentEvent,
            dispatch(action) { dispatched.push(action); state = gameReducer(state, action); },
            addLog() { assert.fail('reducer owns the settled log'); },
            getFullStats() { assert.fail('deferral does not inspect combat stats'); },
            rng() { assert.fail('deferral consumes no random roll'); },
        }, {}).handleEventChoice;
        choose(entry.choiceIndex);
        assert.deepEqual(dispatched, [actionFor(entry)]);
        assert.deepEqual(state.player, { ...before, deferredEventChainSteps: { [entry.chainId]: entry.step } });
        assert.equal(state.gameState, 'idle');
        assert.equal(state.currentEvent, null);
        assert.match(state.logs.at(-1).text, /이번 원정/);
        assert.notEqual(getChainEventForLoc(entry.data.loc, state.player.eventChainProgress,
            state.player.deferredEventChainSteps)?.chain.id, entry.chainId);
        assert.match(getEventChoicePreview(buildState(entry).currentEvent, entry.choiceIndex).text, /이번 원정에서 미룸/);
        const settled = state;
        choose(entry.choiceIndex);
        assert.equal(state, settled, 'stale callback is an exact no-op');
        assert.equal(gameReducer(state, actionFor(entry)), state);
    });
}

test('위조·stale·잘못된 선택은 state/log/save를 전혀 바꾸지 않는다', () => {
    const state = buildState();
    const action = actionFor();
    for (const payload of [null, [], {}, { ...action.payload, step: -1 },
        { ...action.payload, choiceIndex: 0 }, { ...action.payload, choiceIndex: 99 },
        { ...action.payload, reward: 999 }, { ...action.payload, chainId: 'missing' },
        { ...action.payload, expectedExploreCount: undefined }, { ...action.payload, expectedExploreCount: -1 },
        { ...action.payload, expectedExploreCount: '0' }, { ...action.payload, expectedExploreCount: 1 }]) {
        assert.equal(gameReducer(state, { ...action, payload }), state);
    }
    for (const invalid of [
        { ...state, gameState: 'combat' },
        { ...state, currentEvent: { ...state.currentEvent, desc: '위조' } },
        { ...state, player: { ...state.player, eventChainProgress: { lost_wizard: 1 } } },
        { ...state, player: { ...state.player, deferredEventChainSteps: { lost_wizard: 0 } } },
    ]) assert.equal(gameReducer(invalid, action), invalid);
});

test('같은 원정의 복원은 유지하고 다른 이야기·다음 단계는 막지 않는다', () => {
    const settled = gameReducer(buildState(), actionFor());
    const loaded = restore(settled);
    assert.deepEqual(loaded.player.deferredEventChainSteps, { lost_wizard: 0 });
    assert.deepEqual(restore(loaded).player.deferredEventChainSteps, { lost_wizard: 0 });
    assert.equal(getChainEventForLoc('수정 동굴', { lost_wizard: 1 }, { lost_wizard: 0 })?.chain.id, 'lost_wizard');
    assert.equal(getChainEventForLoc('서쪽 평원', {}, { lost_wizard: 0 })?.chain.id, 'last_hero');
    const resumedEvent = restore(buildState());
    assert.deepEqual(gameReducer(resumedEvent, actionFor()).player.deferredEventChainSteps, { lost_wizard: 0 });
});

test('정규화는 알 수 없는 이야기·완료·실패·지난 step·잘못된 값을 버린다', () => {
    const original = buildState();
    for (const value of [null, [], 'lost_wizard', { lost_wizard: '0' },
        { lost_wizard: -1 }, { lost_wizard: 99 }, { unknown: 0 }, { water_apostle: 0 }]) {
        const loaded = restore({ ...original, player: { ...original.player, deferredEventChainSteps: value } });
        assert.equal(loaded.player.deferredEventChainSteps, undefined);
    }
    for (const progress of [1, 3, 'failed']) {
        const loaded = restore({ ...original, player: { ...original.player,
            eventChainProgress: { lost_wizard: progress }, deferredEventChainSteps: { lost_wizard: 0 } } });
        assert.equal(loaded.player.deferredEventChainSteps, undefined);
    }
    const partial = restore({ ...original, player: { ...original.player,
        deferredEventChainSteps: { lost_wizard: 0, unknown: 4, ancient_prophecy: '0' } } });
    assert.deepEqual(partial.player.deferredEventChainSteps, { lost_wizard: 0 });
    const legacy = gameReducer(partial, { type: 'LOAD_DATA', payload: { player: original.player } });
    assert.equal(legacy.player.deferredEventChainSteps, undefined, 'legacy save must not inherit an old session marker');
});

test('위험 지역 이동은 유지하고 안전 귀환 후 다시 제안한다', () => {
    let state = gameReducer(buildState(), actionFor());
    const move = loc => createMoveActions({ player: state.player, gameState: state.gameState,
        liveConfig: {}, dispatch(action) { state = gameReducer(state, action); }, addLog() {} }).move(loc);
    const danger = DB.MAPS[state.player.loc].exits.find(loc => DB.MAPS[loc].type !== 'safe');
    move(danger);
    assert.equal(state.player.loc, danger);
    assert.deepEqual(state.player.deferredEventChainSteps, { lost_wizard: 0 });
    move(wizard.data.loc);
    move('시작의 마을');
    assert.equal(state.player.loc, '시작의 마을');
    assert.equal(state.player.deferredEventChainSteps, undefined);
    move(wizard.data.loc);
    assert.equal(getChainEventForLoc(state.player.loc, state.player.eventChainProgress,
        state.player.deferredEventChainSteps)?.chain.id, 'lost_wizard');
});

test('사망·RESET·ASCEND와 안전/사망 저장 복원은 미루기를 다음 원정에 넘기지 않는다', () => {
    const settled = gameReducer(buildState(), actionFor());
    for (const mode of ['idle', 'dead']) {
        const loaded = restore({ ...settled, gameState: mode, player: { ...settled.player,
            loc: mode === 'idle' ? '시작의 마을' : wizard.data.loc } });
        assert.equal(loaded.player.deferredEventChainSteps, undefined);
    }
    assert.equal(gameReducer(settled, { type: 'RESET_GAME' }).player.deferredEventChainSteps, undefined);
    const ascended = gameReducer({ ...settled, gameState: 'ascension' }, {
        type: 'ASCEND', payload: { expectedPrestigeRank: 0, sourceReceiptKey: null },
    });
    assert.equal(ascended.gameState, 'idle');
    assert.equal(ascended.player.deferredEventChainSteps, undefined);
    const dying = { ...settled, gameState: 'combat', combatTurn: 0,
        player: { ...settled.player, hp: 1, def: 0, relics: [] },
        enemy: { name: '정령', hp: 999, maxHp: 999, atk: 10000, def: 0, level: 1,
            pattern: { guardChance: 0, heavyChance: 0 }, exp: 0, gold: 0 } };
    const dead = makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION(dying, {
        type: 'RESOLVE_COMBAT_ACTION', payload: { kind: 'escape', expectedTurn: 0, seed: 7, now: 1000 },
    });
    assert.equal(dead.gameState, 'dead');
    assert.equal(dead.player.deferredEventChainSteps, undefined);
});

test('실제 Explore → 무시 → Explore는 같은 이야기가 아니라 전투로 이어진다', async () => {
    let state = { ...buildState(), gameState: 'idle', currentEvent: null };
    const explore = async () => {
        const deps = { player: state.player, gameState: state.gameState, rng: () => 0.99,
            dispatch(action) { state = gameReducer(state, action); }, addLog() {}, addStoryLog() {},
            getFullStats: () => calculateFullStats(state.player) };
        await createExploreActions(deps, makeSharedHelpers(deps)).explore();
    };
    await explore();
    assert.equal(state.currentEvent._chainId, 'lost_wizard');
    const progress = structuredClone(state.player.eventChainProgress);
    state = gameReducer(state, actionFor(wizard, state.player.stats.explores));
    await explore();
    assert.equal(state.gameState, 'combat');
    assert.ok(state.enemy?.hp > 0);
    assert.equal(state.player.stats.explores, 2);
    assert.deepEqual(state.player.eventChainProgress, progress);
    assert.deepEqual(state.player.deferredEventChainSteps, { lost_wizard: 0 });
});

test('이전 원정의 늦은 선택은 다시 열린 같은 step을 닫지 못한다', async () => {
    let state = { ...buildState(), gameState: 'idle', currentEvent: null };
    const dispatch = action => { state = gameReducer(state, action); };
    const explore = async () => {
        const deps = { player: state.player, gameState: state.gameState, rng: () => 0.99,
            dispatch, addLog() {}, addStoryLog() {}, getFullStats: () => calculateFullStats(state.player) };
        await createExploreActions(deps, makeSharedHelpers(deps)).explore();
    };
    await explore();
    const stale = actionFor(wizard, state.player.stats.explores);
    dispatch(stale);
    const move = loc => createMoveActions({ player: state.player, gameState: state.gameState,
        liveConfig: {}, dispatch, addLog() {} }).move(loc);
    move('시작의 마을');
    move(wizard.data.loc);
    await explore();
    assert.equal(state.currentEvent._chainId, wizard.chainId);
    const fresh = state;
    dispatch(stale);
    assert.equal(state, fresh);
    dispatch(actionFor(wizard, state.player.stats.explores));
    assert.equal(state.gameState, 'idle');
    assert.deepEqual(state.player.deferredEventChainSteps, { lost_wizard: 0 });
});

for (const route of ['scout', 'boss']) {
    test(`미룬 이야기 이후 ${route} 선택도 production Explore에서 도달한다`, async () => {
        const entry = route === 'boss' ? cases.find(entry => entry.chainId === 'lost_wizard' && entry.step === 2) : wizard;
        let state = gameReducer(buildState(entry), actionFor(entry));
        state.player = { ...state.player, activeExpedition: undefined, stats: { ...state.player.stats,
            explores: 10, exploreState: { sinceNarrativeEvent: 10 },
            bossGauge: { [state.player.loc]: route === 'boss' ? 1 : 0 } } };
        let rolls = 0;
        const deps = { player: state.player, gameState: state.gameState,
            rng: () => route === 'scout' && rolls++ > 0 ? 0 : 0.99,
            dispatch(action) { state = gameReducer(state, action); }, addLog() {}, addStoryLog() {},
            getFullStats: () => calculateFullStats(state.player) };
        await createExploreActions(deps, makeSharedHelpers(deps)).explore();
        assert.equal(state.gameState, 'event');
        assert.equal(state.currentEvent[route === 'scout' ? 'isScout' : 'isBossGaugeChallenge'], true);
        assert.equal(state.player.stats.explores, 11);
        assert.equal(state.player.eventChainProgress.lost_wizard, entry.step);
    });
}
