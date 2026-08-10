import test from 'node:test';
import assert from 'node:assert/strict';

import { createCombatActions } from '../src/hooks/useCombatActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { getProtocolDayKey } from '../src/utils/protocolCycle.js';
import { DB } from '../src/data/db.js';
import { startExpedition } from '../src/utils/expeditionLedger.js';

const makeState = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        atk: 200,
        def: 20,
        weeklyProtocol: {
            ...structuredClone(INITIAL_STATE.player.weeklyProtocol),
            kills: 0,
            bossKills: 0,
        },
    },
    gameState: 'combat',
    enemy: {
        name: '훈련용 정령',
        baseName: '훈련용 정령',
        level: 1,
        hp: 1,
        maxHp: 1,
        atk: 10,
        def: 0,
        exp: 8,
        gold: 10,
        pattern: { guardChance: 0, heavyChance: 0 },
    },
    combatTurn: 0,
    combatReceipt: null,
    ...overrides,
});

const makeAction = (kind, seed, now = 1_700_000_000_000) => ({
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind, expectedTurn: 0, seed, now },
});

const actionMap = makeCombatActionMap(INITIAL_STATE.player);

test('attack victory commits rewards and replay protection in one reducer transition', () => {
    const state = makeState();
    const action = makeAction('attack', 1);

    const won = actionMap.RESOLVE_COMBAT_ACTION(state, action);
    const replayed = actionMap.RESOLVE_COMBAT_ACTION(won, action);

    assert.equal(won.gameState, 'idle');
    assert.equal(won.enemy, null);
    assert.equal(won.player.stats.kills, 1);
    assert.equal(won.player.gold, state.player.gold + 10);
    assert.equal(won.player.weeklyProtocol.kills, 1);
    assert.ok(won.player.seasonPass.xp > state.player.seasonPass.xp);
    assert.ok(won.logs.some((log) => log.type === 'success' && log.text.includes('승리')));
    assert.equal(won.combatTurn, 1);
    assert.equal(won.combatReceipt?.kind, 'victory');
    assert.equal(replayed, won);
});

test('boss victory commits one expedition boss and rejects the same reducer action replay', () => {
    const state = makeState();
    state.player = startExpedition({ ...state.player, job: '전사' }, '고요한 숲', 1_000, DB.QUESTS);
    state.enemy = {
        ...state.enemy,
        name: '분노한 숲의 군주',
        baseName: '숲의 군주',
        isBoss: true,
    };
    const action = makeAction('attack', 13, 1_500);

    const won = actionMap.RESOLVE_COMBAT_ACTION(state, action);
    const replayed = actionMap.RESOLVE_COMBAT_ACTION(won, action);

    assert.deepEqual(won.player.activeExpedition.bossNames, ['숲의 군주']);
    assert.equal(replayed, won);
});

test('victory reward logs are deterministic for the same state, seed, and time', () => {
    const now = 1_700_000_000_000;
    const state = makeState();
    state.player.stats.dailyProtocol = {
        date: getProtocolDayKey(new Date(now)),
        relicShards: 0,
        missions: [
            { id: 'kill_n', type: 'kills', goal: 1, reward: { essence: 5 }, progress: 0, done: false },
            { id: 'explore_n', type: 'explores', goal: 10, reward: { item: '중급 체력 물약' }, progress: 0, done: false },
            { id: 'gold_n', type: 'goldSpend', goal: 300, reward: { relicShard: 1 }, progress: 0, done: false },
        ],
    };
    const action = makeAction('attack', 91, now);

    const first = actionMap.RESOLVE_COMBAT_ACTION(structuredClone(state), action);
    const second = actionMap.RESOLVE_COMBAT_ACTION(structuredClone(state), action);

    assert.deepEqual(first, second);
    assert.ok(first.logs.some((log) => log.text.includes('에센스 +5')));
});

test('victory daily item reward is deterministic for the same state, seed, and time', () => {
    const now = 1_700_000_000_100;
    const state = makeState();
    state.player.stats.dailyProtocol = {
        date: getProtocolDayKey(new Date(now)),
        relicShards: 0,
        missions: [
            { id: 'kill_n', type: 'kills', goal: 1, reward: { item: '중급 체력 물약' }, progress: 0, done: false },
            { id: 'explore_n', type: 'explores', goal: 10, reward: { essence: 5 }, progress: 0, done: false },
            { id: 'gold_n', type: 'goldSpend', goal: 300, reward: { relicShard: 1 }, progress: 0, done: false },
        ],
    };
    const action = makeAction('attack', 92, now);

    const first = actionMap.RESOLVE_COMBAT_ACTION(structuredClone(state), action);
    const second = actionMap.RESOLVE_COMBAT_ACTION(structuredClone(state), action);

    assert.ok(first.player.inv.some((item) => item.name === '중급 체력 물약'));
    assert.deepEqual(first, second);
});

test('skill combat action is deterministic for the same state, seed, and time', () => {
    const state = makeState({
        enemy: {
            ...makeState().enemy,
            hp: 500,
            maxHp: 500,
            atk: 15,
        },
    });
    const action = makeAction('skill', 20260805, 1_700_000_000_111);

    const first = actionMap.RESOLVE_COMBAT_ACTION(structuredClone(state), action);
    const second = actionMap.RESOLVE_COMBAT_ACTION(structuredClone(state), action);

    assert.deepEqual(first, second);
    assert.equal(first.combatTurn, 1);
    assert.ok(first.player.mp < state.player.mp);
    assert.ok(first.enemy.hp < state.enemy.hp);
});

test('failed escape defeat commits death, grave, and run summary atomically', () => {
    const state = makeState({
        player: {
            ...makeState().player,
            hp: 1,
        },
        enemy: {
            ...makeState().enemy,
            hp: 100,
            maxHp: 100,
            atk: 10_000,
        },
    });

    const defeated = actionMap.RESOLVE_COMBAT_ACTION(
        state,
        makeAction('escape', 7, 1_700_000_000_222),
    );

    assert.equal(defeated.gameState, 'dead');
    assert.equal(defeated.enemy, null);
    assert.equal(defeated.player.stats.deaths, 1);
    assert.ok(defeated.grave);
    assert.ok(defeated.runSummary);
    assert.equal(defeated.combatReceipt?.kind, 'defeat');
});

test('combat hook claims one action for rapid repeated input', () => {
    const state = makeState({
        enemy: {
            ...makeState().enemy,
            hp: 500,
            maxHp: 500,
        },
    });
    const dispatched = [];
    const claimed = new Set();
    const actions = createCombatActions({
        player: state.player,
        gameState: state.gameState,
        enemy: state.enemy,
        grave: state.grave,
        liveConfig: state.liveConfig,
        combatTurn: state.combatTurn,
        dispatch: (action) => dispatched.push(action),
        addLog: () => {},
        addStoryLog: async () => {},
        getFullStats: () => ({ atk: 200, def: 20, maxHp: 100, maxMp: 50 }),
        clearPendingCombat: () => {},
        schedulePendingCombat: () => {},
        claimCombatAction: (key) => {
            if (claimed.has(key)) return false;
            claimed.add(key);
            return true;
        },
    });

    actions.combat('attack');
    actions.combat('attack');

    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, AT.RESOLVE_COMBAT_ACTION);
    assert.deepEqual(
        Object.keys(dispatched[0].payload).sort(),
        ['expectedTurn', 'kind', 'now', 'seed'],
    );
});

test('combat receipt consumer narrates each key once and leaves empty stories inert', async () => {
    const engineModule = await import('../src/hooks/useGameEngine.js');
    assert.equal(
        typeof engineModule.consumeCombatReceiptStories,
        'function',
        'useGameEngine must expose the receipt consumer used by its effect guard',
    );

    const narrated = [];
    let consumedKey = null;
    const firstReceipt = {
        key: 'combat:1',
        stories: [{ type: 'victory', data: { name: '훈련용 정령' } }],
    };
    const secondReceipt = {
        key: 'combat:2',
        stories: [{ type: 'bossPhase2', data: { bossName: '훈련용 군주' } }],
    };

    const consume = (receipt) => {
        const consumption = engineModule.consumeCombatReceiptStories(receipt, consumedKey);
        consumedKey = consumption.consumedKey;
        narrated.push(...consumption.stories);
    };

    consume(firstReceipt);
    consume(firstReceipt);
    consume(secondReceipt);
    consume({ key: 'combat:3', stories: [] });

    assert.deepEqual(narrated, [
        { type: 'victory', data: { name: '훈련용 정령' } },
        { type: 'bossPhase2', data: { bossName: '훈련용 군주' } },
    ]);
    assert.equal(consumedKey, 'combat:3');
});
