import assert from 'node:assert/strict';
import test from 'node:test';

import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { createAscensionActions } from '../src/hooks/gameActions/ascensionActions.ts';
import { createGameStorage } from '../src/platform/gameStorage.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { migrateData } from '../src/utils/dataMigration.ts';

const endgameModule = await import('../src/hooks/combatActions/combatBossHandlers.js');
const resolveEndgameVictory = endgameModule.resolveEndgameVictory;

const playerWithEndgame = (primalShards, prestigeRank = 3) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '엔드게임 검증',
    atk: 100_000,
    meta: {
        ...structuredClone(INITIAL_STATE.player.meta),
        prestigeRank,
        endgame: {
            version: 1,
            primalShards,
            legacyInventoryMigrated: true,
            lastEndgameReceiptKey: null,
            trueEndingSeen: false,
        },
    },
});

const demonKing = {
    name: '마왕',
    baseName: '마왕',
    isBoss: true,
    level: 70,
    hp: 1,
    maxHp: 1,
    atk: 1,
    def: 0,
    exp: 0,
    gold: 0,
    pattern: { guardChance: 0, heavyChance: 0 },
};

const makeAsyncStorage = () => {
    const values = new Map();
    return {
        values,
        async getItem(key) { return values.get(key) ?? null; },
        async setItem(key, value) { values.set(key, value); },
        async removeItem(key) { values.delete(key); },
    };
};

test('endgame settlement exposes one pure resolver authority', () => {
    assert.equal(typeof resolveEndgameVictory, 'function');
});

test('rank three final shard roll spawns the true boss and consumes the canonical ledger', () => {
    if (typeof resolveEndgameVictory !== 'function') return;
    const result = resolveEndgameVictory({
        player: playerWithEndgame(2),
        deadEnemy: demonKing,
        receiptKey: '1:1000:7',
        rng: () => 0,
        now: 1_000,
    });

    assert.equal(result.outcome, 'true_boss');
    assert.equal(result.gameState, 'combat');
    assert.equal(result.enemy?.baseName, '원시의 신');
    assert.equal(result.player.meta.endgame.primalShards, 0);
    assert.equal(result.player.meta.endgame.lastEndgameReceiptKey, '1:1000:7');
    assert.equal(result.player.stats.demonKingSlain, 1);
});

test('only the canonical Demon King identity advances the permanent endgame ledger', () => {
    for (const name of ['마왕의 사도', '사슬 마왕', '차원 마왕', '미궁의 마왕']) {
        const player = playerWithEndgame(2);
        const result = resolveEndgameVictory({
            player,
            deadEnemy: { ...demonKing, name, baseName: name },
            receiptKey: `non-canonical:${name}`,
            rng: () => 0,
            now: 1_000,
        });

        assert.equal(result.outcome, 'none', name);
        assert.equal(result.player, player, name);
        assert.equal(result.player.meta.endgame.primalShards, 2, name);
        assert.equal(result.player.stats.demonKingSlain, 0, name);
    }
});

test('combat outcome reports Demon King victory only for the exact canonical identity', () => {
    for (const name of ['마왕의 사도', '사슬 마왕', '차원 마왕', '미궁의 마왕']) {
        const result = CombatEngine.handleVictory(
            playerWithEndgame(0, 0),
            { ...demonKing, name, baseName: name },
            {},
            {},
        );

        assert.equal(result.isDemonKingSlain, false, name);
    }

    const canonical = CombatEngine.handleVictory(
        playerWithEndgame(0, 0),
        demonKing,
        {},
        {},
    );
    assert.equal(canonical.isDemonKingSlain, true);
});

test('malformed true boss data keeps the earned shards and fails closed', () => {
    if (typeof resolveEndgameVictory !== 'function') return;
    const result = resolveEndgameVictory({
        player: playerWithEndgame(2),
        deadEnemy: demonKing,
        receiptKey: '1:1001:8',
        rng: () => 0,
        now: 1_001,
        monsterCatalog: {},
    });

    assert.equal(result.outcome, 'blocked');
    assert.equal(result.enemy, null);
    assert.equal(result.player.meta.endgame.primalShards, 3);
});

test('same endgame receipt replays as an exact player no-op', () => {
    if (typeof resolveEndgameVictory !== 'function') return;
    const first = resolveEndgameVictory({
        player: playerWithEndgame(2),
        deadEnemy: demonKing,
        receiptKey: '1:1002:9',
        rng: () => 0,
        now: 1_002,
    });
    const replayed = resolveEndgameVictory({
        player: first.player,
        deadEnemy: demonKing,
        receiptKey: '1:1002:9',
        rng: () => 0,
        now: 1_002,
    });

    assert.equal(replayed.outcome, 'replay');
    assert.equal(replayed.player, first.player);
});

test('true boss victory records one permanent ending and one deterministic heart', () => {
    if (typeof resolveEndgameVictory !== 'function') return;
    const player = playerWithEndgame(0);
    const result = resolveEndgameVictory({
        player,
        deadEnemy: {
            ...demonKing,
            name: '원시의 신',
            baseName: '원시의 신',
        },
        receiptKey: '2:2000:10',
        rng: () => 0,
        now: 2_000,
    });

    assert.equal(result.outcome, 'true_ending');
    assert.equal(result.gameState, 'true_ending');
    assert.equal(result.player.meta.endgame.trueEndingSeen, true);
    assert.equal(
        result.player.inv.filter((item) => item.name === '원시의 심장').length,
        1,
    );
});

test('combat reducer uses permanent shards and settles the true boss in the same transaction', () => {
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: playerWithEndgame(3),
        gameState: 'combat',
        enemy: structuredClone(demonKing),
        combatTurn: 0,
        combatReceipt: null,
    };
    const action = {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: {
            kind: 'attack',
            expectedTurn: 0,
            seed: 11,
            now: 3_000,
        },
    };

    const settled = actionMap.RESOLVE_COMBAT_ACTION(state, action);
    const replayed = actionMap.RESOLVE_COMBAT_ACTION(settled, action);

    assert.equal(settled.gameState, 'combat');
    assert.equal(settled.enemy?.baseName, '원시의 신');
    assert.equal(settled.player.meta.endgame.primalShards, 0);
    assert.equal(settled.player.stats.demonKingSlain, 1);
    assert.equal(replayed, settled);
});

test('combat item damage-over-time victory reaches the same endgame settlement authority', () => {
    const potion = {
        id: 'endgame-potion',
        name: '전투 회복 물약',
        type: 'hp',
        val: 10,
    };
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: {
            ...playerWithEndgame(3),
            hp: 50,
            inv: [potion],
        },
        gameState: 'combat',
        enemy: {
            ...structuredClone(demonKing),
            dots: ['poison'],
        },
        combatTurn: 0,
        combatReceipt: null,
    };
    const action = {
        type: AT.USE_COMBAT_ITEM,
        payload: {
            itemId: potion.id,
            expectedTurn: 0,
            seed: 12,
            now: 3_001,
        },
    };

    const settled = actionMap.USE_COMBAT_ITEM(state, action);
    const replayed = actionMap.USE_COMBAT_ITEM(settled, action);

    assert.equal(settled.gameState, 'combat');
    assert.equal(settled.enemy?.baseName, '원시의 신');
    assert.equal(settled.player.meta.endgame.primalShards, 0);
    assert.equal(settled.player.stats.demonKingSlain, 1);
    assert.equal(replayed, settled);
});

test('skill victory reaches the same endgame settlement authority', () => {
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: {
            ...playerWithEndgame(3),
            job: '전사',
            mp: 10_000,
            maxMp: 10_000,
        },
        gameState: 'combat',
        enemy: structuredClone(demonKing),
        combatTurn: 0,
        combatReceipt: null,
    };

    const settled = actionMap.RESOLVE_COMBAT_ACTION(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: {
            kind: 'skill',
            expectedTurn: 0,
            seed: 14,
            now: 3_003,
        },
    });

    assert.equal(settled.gameState, 'combat');
    assert.equal(settled.enemy?.baseName, '원시의 신');
    assert.equal(settled.player.meta.endgame.primalShards, 0);
});

test('attack-turn damage-over-time victory cannot bypass endgame settlement', () => {
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: {
            ...playerWithEndgame(3),
            atk: 0,
            status: ['freeze'],
        },
        gameState: 'combat',
        enemy: {
            ...structuredClone(demonKing),
            dots: ['poison'],
        },
        combatTurn: 0,
        combatReceipt: null,
    };

    const settled = actionMap.RESOLVE_COMBAT_ACTION(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: {
            kind: 'attack',
            expectedTurn: 0,
            seed: 15,
            now: 3_004,
        },
    });

    assert.equal(settled.gameState, 'combat');
    assert.equal(settled.enemy?.baseName, '원시의 신');
    assert.equal(settled.player.meta.endgame.primalShards, 0);
});

test('ascension preserves the accepted demon king count instead of incrementing it again', () => {
    if (typeof resolveEndgameVictory !== 'function') return;
    const settled = resolveEndgameVictory({
        player: playerWithEndgame(0, 1),
        deadEnemy: demonKing,
        receiptKey: '3:3002:13',
        rng: () => 1,
        now: 3_002,
    });
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: settled.player,
        gameState: 'ascension',
    };

    const action = {
        type: AT.ASCEND,
        payload: {
            expectedPrestigeRank: 1,
            sourceReceiptKey: '3:3002:13',
        },
    };
    const ascended = gameReducer(state, action);
    const replayed = gameReducer(ascended, action);

    assert.equal(settled.player.stats.demonKingSlain, 1);
    assert.equal(ascended.player.stats.demonKingSlain, 1);
    assert.equal(ascended.player.meta.prestigeRank, 2);
    assert.equal(replayed, ascended);
});

test('ascension rejects stale rank, mismatched receipt, and forged outcome payloads', () => {
    const state = {
        ...structuredClone(INITIAL_STATE),
        player: playerWithEndgame(1, 2),
        gameState: 'ascension',
    };
    state.player.meta.endgame.lastEndgameReceiptKey = 'accepted:receipt';

    const staleRank = gameReducer(state, {
        type: AT.ASCEND,
        payload: { expectedPrestigeRank: 1, sourceReceiptKey: 'accepted:receipt' },
    });
    const mismatchedReceipt = gameReducer(state, {
        type: AT.ASCEND,
        payload: { expectedPrestigeRank: 2, sourceReceiptKey: 'forged:receipt' },
    });
    const forgedLegacyPayload = gameReducer(state, {
        type: AT.ASCEND,
        payload: {
            meta: { ...state.player.meta, prestigeRank: 99, essence: 999_999 },
            newTitle: '위조된 칭호',
        },
    });

    assert.equal(staleRank, state);
    assert.equal(mismatchedReceipt, state);
    assert.equal(forgedLegacyPayload, state);
});

test('rapid ascension confirmation emits one accepted request and one completion log', () => {
    const dispatched = [];
    const logs = [];
    const player = playerWithEndgame(0, 1);
    const actions = createAscensionActions({
        player,
        dispatch: (action) => dispatched.push(action),
        addLog: (type, text) => logs.push({ type, text }),
    });

    actions.confirmAscension();
    const acceptedLogCount = logs.length;
    actions.confirmAscension();

    const requests = dispatched.filter((action) => action.type === AT.ASCEND);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].payload, {
        expectedPrestigeRank: 1,
        sourceReceiptKey: null,
    });
    assert.ok(acceptedLogCount > 0);
    assert.equal(logs.length, acceptedLogCount);
});

test('production GameStorage preserves endgame, journey, and settings through reload and New Game+', async () => {
    const backend = makeAsyncStorage();
    let now = 10_000;
    const storage = createGameStorage({ backend, now: () => now, saveVersion: 5 });
    const classJourney = {
        version: 1,
        sequence: 1,
        byJob: {
            전사: {
                expeditionIds: ['endgame-expedition'],
                skillBranches: ['파워배시:A'],
                signatureItems: ['성검 에테르니아'],
                bossNames: ['마왕'],
                regions: ['마왕성'],
                representativeExpeditionId: 'endgame-expedition',
                lastPlayedAt: 9_000,
            },
        },
    };
    const checkpoint = {
        ...structuredClone(INITIAL_STATE),
        version: 5,
        player: {
            ...playerWithEndgame(2),
            settings: { readabilityMode: 'high', equipmentDetailMode: 'full' },
            classJourney,
        },
        gameState: 'combat',
        enemy: structuredClone(demonKing),
        combatTurn: 0,
        combatReceipt: null,
    };

    await storage.save(checkpoint);
    const loadedCheckpoint = migrateData((await storage.load()).payload);
    assert.equal(loadedCheckpoint.player.meta.endgame.primalShards, 2);
    assert.deepEqual(loadedCheckpoint.player.classJourney, classJourney);
    assert.deepEqual(loadedCheckpoint.player.settings, checkpoint.player.settings);

    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const trueBossState = actionMap.RESOLVE_COMBAT_ACTION(loadedCheckpoint, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 0, seed: 1, now: 5_000 },
    });
    assert.equal(trueBossState.enemy?.baseName, '원시의 신');
    assert.equal(trueBossState.player.meta.endgame.primalShards, 0);

    now += 1;
    await storage.save({ ...trueBossState, version: 5 });
    const reloadedBoss = migrateData((await storage.load()).payload);
    assert.equal(reloadedBoss.player.meta.endgame.primalShards, 0);
    assert.deepEqual(reloadedBoss.player.classJourney, classJourney);
    assert.deepEqual(reloadedBoss.player.settings, checkpoint.player.settings);

    const defeated = CombatEngine.handleDefeat(
        reloadedBoss.player,
        INITIAL_STATE.player,
        () => 0.9,
        () => 10_001,
    ).updatedPlayer;
    const reset = gameReducer({ ...reloadedBoss, gameState: 'idle' }, { type: AT.RESET_GAME });
    const ascendedBranch = gameReducer({ ...reloadedBoss, gameState: 'ascension' }, {
        type: AT.ASCEND,
        payload: {
            expectedPrestigeRank: 3,
            sourceReceiptKey: reloadedBoss.player.meta.endgame.lastEndgameReceiptKey,
        },
    });
    for (const player of [defeated, reset.player, ascendedBranch.player]) {
        assert.equal(player.meta.endgame.primalShards, 0);
        assert.deepEqual(player.classJourney, classJourney);
        assert.deepEqual(player.settings, checkpoint.player.settings);
    }

    const trueEndingState = actionMap.RESOLVE_COMBAT_ACTION({
        ...reloadedBoss,
        player: { ...reloadedBoss.player, atk: 100_000 },
        enemy: { ...reloadedBoss.enemy, hp: 1, maxHp: 1 },
    }, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 1, seed: 2, now: 5_001 },
    });
    assert.equal(trueEndingState.gameState, 'true_ending');
    assert.equal(trueEndingState.player.meta.endgame.trueEndingSeen, true);
    assert.equal(trueEndingState.player.inv.filter((item) => item.name === '원시의 심장').length, 1);

    now += 1;
    await storage.save({ ...trueEndingState, version: 5 });
    const reloadedEnding = migrateData((await storage.load()).payload);
    const newGamePlusAction = {
        type: AT.ASCEND,
        payload: {
            expectedPrestigeRank: 3,
            sourceReceiptKey: reloadedEnding.player.meta.endgame.lastEndgameReceiptKey,
        },
    };
    const newGamePlus = gameReducer(reloadedEnding, newGamePlusAction);
    const replayedNewGamePlus = gameReducer(newGamePlus, newGamePlusAction);

    assert.equal(newGamePlus.player.meta.prestigeRank, 4);
    assert.equal(newGamePlus.player.meta.endgame.trueEndingSeen, true);
    assert.equal(newGamePlus.player.meta.endgame.primalShards, 0);
    assert.equal(newGamePlus.player.inv.filter((item) => item.name === '원시의 심장').length, 0);
    assert.equal(newGamePlus.player.titles.filter((title) => title === newGamePlus.player.activeTitle).length, 1);
    assert.deepEqual(newGamePlus.player.classJourney, classJourney);
    assert.equal(replayedNewGamePlus, newGamePlus);

    now += 1;
    await storage.save({ ...newGamePlus, version: 5 });
    const finalReload = migrateData((await storage.load()).payload);
    assert.equal(finalReload.player.meta.prestigeRank, 4);
    assert.equal(finalReload.player.meta.endgame.trueEndingSeen, true);
    assert.deepEqual(finalReload.player.classJourney, classJourney);
});
