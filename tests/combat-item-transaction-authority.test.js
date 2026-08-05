import test from 'node:test';
import assert from 'node:assert/strict';

import { createCombatActions } from '../src/hooks/useCombatActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { resolveCombatItemTurn } from '../src/systems/combatItemTurn.js';

const potion = {
    id: 'combat-potion',
    name: '전투 회복 물약',
    type: 'hp',
    val: 50,
};

const makeState = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        hp: 40,
        inv: [potion],
    },
    gameState: 'combat',
    enemy: {
        name: '훈련용 정령',
        baseName: '훈련용 정령',
        level: 1,
        hp: 100,
        maxHp: 100,
        atk: 10,
        def: 0,
        exp: 1,
        gold: 1,
        pattern: { guardChance: 1, heavyChance: 0 },
    },
    quickSlots: [potion, null, null],
    ...overrides,
});

const actionMap = makeCombatActionMap(INITIAL_STATE.player);

test('combat item turn consumes one item and replay is an exact no-op', () => {
    const state = makeState();
    const action = {
        type: AT.USE_COMBAT_ITEM,
        payload: { itemId: potion.id, seed: 1234, now: 1_700_000_000_000 },
    };

    const consumed = actionMap.USE_COMBAT_ITEM(state, action);
    const replayed = actionMap.USE_COMBAT_ITEM(consumed, action);

    assert.equal(consumed.player.inv.length, 0);
    assert.equal(consumed.player.hp, 90);
    assert.equal(consumed.quickSlots[0], null);
    assert.equal(consumed.gameState, 'combat');
    assert.equal(consumed.logs.filter((log) => log.text.includes('전투 회복 물약')).length, 1);
    assert.equal(replayed, consumed);
});

test('combat item turn commits defeat and grave data in the same state transition', () => {
    const state = makeState({
        player: {
            ...makeState().player,
            hp: 1,
            inv: [{ ...potion, val: 0 }],
        },
        enemy: {
            ...makeState().enemy,
            atk: 10_000,
            pattern: { guardChance: 0, heavyChance: 0 },
        },
    });

    const defeated = actionMap.USE_COMBAT_ITEM(state, {
        type: AT.USE_COMBAT_ITEM,
        payload: { itemId: potion.id, seed: 7, now: 1_700_000_000_123 },
    });

    assert.equal(defeated.gameState, 'dead');
    assert.equal(defeated.enemy, null);
    assert.equal(defeated.player.stats.deaths, 1);
    assert.ok(defeated.grave);
    assert.ok(defeated.runSummary);
    assert.ok(defeated.logs.some((log) => log.type === 'error' && /패배|쓰러/.test(log.text)));
});

test('a damage-over-time kill closes combat once before victory rewards resolve', () => {
    const state = makeState({
        enemy: {
            ...makeState().enemy,
            hp: 1,
            dots: ['poison'],
        },
    });
    const action = {
        type: AT.USE_COMBAT_ITEM,
        payload: { itemId: potion.id, seed: 99, now: 1_700_000_000_456 },
    };

    const won = actionMap.USE_COMBAT_ITEM(state, action);
    const replayed = actionMap.USE_COMBAT_ITEM(won, action);

    assert.equal(won.gameState, 'idle');
    assert.equal(won.enemy, null);
    assert.equal(won.player.inv.length, 0);
    assert.ok(won.logs.some((log) => log.text.includes('지속 피해')));
    assert.equal(replayed, won);
});

test('combat item resolver is deterministic for the same identity, seed, and time', () => {
    const state = makeState({
        enemy: {
            ...makeState().enemy,
            pattern: { guardChance: 0.2, heavyChance: 0.5 },
        },
    });
    const input = {
        player: state.player,
        enemy: state.enemy,
        item: potion,
        initialPlayer: INITIAL_STATE.player,
        seed: 20260805,
        now: 1_700_000_000_789,
    };

    assert.deepEqual(resolveCombatItemTurn(input), resolveCombatItemTurn(input));
});

test('combat hook sends identity and entropy once for rapid repeated input', () => {
    const state = makeState();
    const dispatched = [];
    const combatItemLocks = new Set();
    const actions = createCombatActions({
        player: state.player,
        gameState: state.gameState,
        enemy: state.enemy,
        grave: state.grave,
        liveConfig: state.liveConfig,
        dispatch: (action) => dispatched.push(action),
        addLog: () => {},
        addStoryLog: async () => {},
        getFullStats: () => ({}),
        clearPendingCombat: () => {},
        schedulePendingCombat: () => {},
        claimCombatItem: (itemId) => {
            if (combatItemLocks.has(itemId)) return false;
            combatItemLocks.add(itemId);
            return true;
        },
    });

    actions.combatUseItem(potion);
    actions.combatUseItem(potion);

    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, AT.USE_COMBAT_ITEM);
    assert.equal(dispatched[0].payload.itemId, potion.id);
    assert.equal(typeof dispatched[0].payload.seed, 'number');
    assert.equal(typeof dispatched[0].payload.now, 'number');
    assert.equal('player' in dispatched[0].payload, false);
});
