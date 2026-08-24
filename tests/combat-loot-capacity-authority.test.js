import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DROP_TABLES } from '../src/data/dropTables.js';
import { MSG } from '../src/data/messages.js';
import { isSignatureItem } from '../src/data/signatureItems.js';
import { SEASON_XP } from '../src/data/seasonPass.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { admitCombatLoot } from '../src/systems/combatLootCapacity.ts';
import { getTraitLootHint, getTraitProfile } from '../src/utils/runProfileUtils.js';

const SIGNATURE = '성검 에테르니아';
const SECOND_SIGNATURE = '마왕의 대낫';
const NORMAL_A = '하급 체력 물약';
const NORMAL_B = '중급 체력 물약';
const BLOCKED_NORMAL = '강철 롱소드';
const PREFIXED_BLOCKED_NORMAL = '날카로운 강철 롱소드';
const BLOCKED_NORMAL_PREFIX = '날카로운';
const BLOCKED_NORMAL_UPGRADE_SUMMARY = '공격력 +11 / 치명타 +5%';
const TRAINING_NORMAL = 'Task3 capacity training normal';
const TRAINING_BOSS = 'Task3 capacity training boss';
const TRAINING_PREFIX = 'Task3 capacity training prefix';
const TRAINING_DOT = 'Task4 capacity training attack dot';
const TRAINING_ITEM = 'Task4 capacity training combat item';
const capacityBlockedMessage = (count) => MSG.COMBAT_LOOT_CAPACITY_BLOCKED(count);
const combatDigestPrefix = MSG.COMBAT_DIGEST('').trimEnd();

const originalDropTables = new Map();

const installDropTable = (enemyName, entries) => {
    if (!originalDropTables.has(enemyName)) originalDropTables.set(enemyName, DROP_TABLES[enemyName]);
    DROP_TABLES[enemyName] = entries;
};

afterEach(() => {
    for (const [enemyName, original] of originalDropTables) {
        if (original === undefined) delete DROP_TABLES[enemyName];
        else DROP_TABLES[enemyName] = original;
    }
    originalDropTables.clear();
});

const makeCandidate = (name, key) => ({
    item: {
        id: `loot-${key}`,
        name,
        type: name === SIGNATURE || name === SECOND_SIGNATURE ? 'weapon' : 'consumable',
        metadata: { source: `combat-${key}` },
    },
    logs: [{ type: 'loot', text: `unique-loot-log-${key}` }],
});

const makePlayer = (overrides = {}) => ({
    name: '테스트 플레이어',
    inv: [],
    ...overrides,
});

const makeCombatState = ({ enemyName, isBoss = false, inv, maxInv, signaturePity = 0, playerPatch = {} }) => {
    const initial = structuredClone(INITIAL_STATE);
    const inventory = inv || structuredClone(initial.player.inv);
    const basePlayer = {
        ...initial.player,
        name: 'Task3 테스트 플레이어',
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        atk: 500,
        def: 50,
        inv: inventory,
        maxInv: maxInv ?? inventory.length,
        stats: {
            ...initial.player.stats,
            signaturePity,
        },
    };
    return {
        ...initial,
        player: {
            ...basePlayer,
            ...playerPatch,
            stats: {
                ...basePlayer.stats,
                ...(playerPatch.stats || {}),
            },
        },
        gameState: 'combat',
        enemy: {
            name: enemyName,
            baseName: enemyName,
            level: isBoss ? 50 : 1,
            hp: 1,
            maxHp: 1,
            atk: 10,
            def: 0,
            exp: isBoss ? 500 : 8,
            gold: 10,
            isBoss,
            pattern: { guardChance: 0, heavyChance: 0 },
        },
        logs: [],
        combatTurn: 0,
        combatReceipt: null,
    };
};

const makeTraitFocusedState = ({ inv, maxInv }) => makeCombatState({
    enemyName: TRAINING_PREFIX,
    inv,
    maxInv,
    playerPatch: {
        job: '전사',
        equip: {
            ...structuredClone(INITIAL_STATE.player.equip),
            weapon: {
                ...structuredClone(INITIAL_STATE.player.equip.weapon),
                id: 'task3-strong-weapon',
                name: 'Task3 강한 양손검',
                val: 100,
                hands: 2,
                jobs: ['전사'],
            },
        },
    },
});

const resolveCombatActionVictory = (
    state,
    kind,
    seed = 1,
    now = 1_700_000_000_000,
) => makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION(
    state,
    {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind, expectedTurn: 0, seed, now },
    },
);

const resolveAttackVictory = (state, seed = 1, now = 1_700_000_000_000) => (
    resolveCombatActionVictory(state, 'attack', seed, now)
);

const assertSingleVictoryReceipt = (state, { hasVictoryStory = false } = {}) => {
    assert.equal(state.combatReceipt?.kind, 'victory');
    assert.ok(state.combatReceipt?.key);
    if (hasVictoryStory) {
        assert.equal(
            state.combatReceipt?.stories.filter(({ type }) => type === 'victory').length,
            1,
        );
    }
};

test('admits signatures first and reports stable capacity accounting', () => {
    const normalA = makeCandidate(NORMAL_A, 'normal-a');
    const signature = makeCandidate(SIGNATURE, 'signature');
    const normalB = makeCandidate(NORMAL_B, 'normal-b');
    assert.equal(isSignatureItem(signature.item), true);
    assert.equal(isSignatureItem(normalA.item), false);

    const result = admitCombatLoot(
        { ...makePlayer(), maxInv: 3, inv: [{ id: 'occupied' }, { id: 'occupied-2' }] },
        [normalA, signature, normalB],
    );

    assert.equal(result.capacity, 3);
    assert.equal(result.occupied, 2);
    assert.equal(result.available, 1);
    assert.deepEqual(result.admitted.map(({ item }) => item.name), [SIGNATURE]);
    assert.deepEqual(result.blocked.map(({ item }) => item.name), [NORMAL_A, NORMAL_B]);
});

test('returns fresh empty outputs and honors an expanded inventory capacity', () => {
    const candidates = [makeCandidate(NORMAL_A, 'expanded-a'), makeCandidate(NORMAL_B, 'expanded-b')];
    const emptyCandidates = [];
    const empty = admitCombatLoot(makePlayer({ maxInv: 25 }), emptyCandidates);
    const expanded = admitCombatLoot(makePlayer({ maxInv: 25 }), candidates);

    assert.equal(empty.capacity, 25);
    assert.equal(empty.occupied, 0);
    assert.equal(empty.available, 25);
    assert.deepEqual(empty.admitted, []);
    assert.deepEqual(empty.blocked, []);
    assert.notEqual(empty.admitted, emptyCandidates);
    assert.notEqual(empty.blocked, emptyCandidates);

    assert.equal(expanded.capacity, 25);
    assert.equal(expanded.occupied, 0);
    assert.equal(expanded.available, 25);
    assert.deepEqual(expanded.admitted, candidates);
    assert.deepEqual(expanded.blocked, []);
    assert.notEqual(expanded.admitted, candidates);
    assert.notEqual(expanded.blocked, candidates);
});

test('falls back to BALANCE.INV_MAX_SIZE for malformed maxInv values without coercion', () => {
    const malformedValues = [
        undefined,
        Number.NaN,
        0,
        -1,
        1.5,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
        '20',
    ];

    for (const maxInv of malformedValues) {
        const result = admitCombatLoot(makePlayer({ maxInv }), []);
        assert.equal(result.capacity, BALANCE.INV_MAX_SIZE, `maxInv=${String(maxInv)}`);
        assert.equal(result.occupied, 0);
        assert.equal(result.available, BALANCE.INV_MAX_SIZE);
    }
});

test('rejects all candidates when inventory is full or already over capacity', () => {
    const candidates = [makeCandidate(SIGNATURE, 'full-signature'), makeCandidate(NORMAL_A, 'full-normal')];
    const existing = [{ id: 'existing-a' }, { id: 'existing-b' }];
    const full = admitCombatLoot(makePlayer({ maxInv: 2, inv: existing }), candidates);
    const overflowed = admitCombatLoot(makePlayer({ maxInv: 1, inv: existing }), candidates);

    for (const result of [full, overflowed]) {
        assert.equal(result.occupied, 2);
        assert.equal(result.available, 0);
        assert.deepEqual(result.admitted, []);
        assert.deepEqual(result.blocked, candidates);
    }
    assert.deepEqual(existing, [{ id: 'existing-a' }, { id: 'existing-b' }]);
});

test('preserves signature order followed by normal order through stable partitioning', () => {
    const normalA = makeCandidate(NORMAL_A, 'order-normal-a');
    const signatureA = makeCandidate(SIGNATURE, 'order-signature-a');
    const normalB = makeCandidate(NORMAL_B, 'order-normal-b');
    const signatureB = makeCandidate(SECOND_SIGNATURE, 'order-signature-b');
    const normalC = makeCandidate('상급 체력 물약', 'order-normal-c');
    const candidates = [normalA, signatureA, normalB, signatureB, normalC];

    const result = admitCombatLoot(makePlayer({ maxInv: 5 }), candidates);

    assert.deepEqual(result.admitted, [signatureA, signatureB, normalA, normalB, normalC]);
    assert.deepEqual(result.blocked, []);
});

test('does not mutate the player, inventory, candidates, items, or logs', () => {
    const inventory = [{ id: 'occupied', metadata: { source: 'save' } }];
    const player = makePlayer({
        maxInv: 3,
        inv: inventory,
        stats: { lootAudit: { attempts: 2 } },
    });
    const candidates = [makeCandidate(NORMAL_A, 'immutability-normal'), makeCandidate(SIGNATURE, 'immutability-signature')];
    const playerBefore = structuredClone(player);
    const candidatesBefore = structuredClone(candidates);

    admitCombatLoot(player, candidates);

    assert.deepEqual(player, playerBefore);
    assert.deepEqual(player.inv, inventory);
    assert.deepEqual(candidates, candidatesBefore);
    assert.deepEqual(candidates[0].item, candidatesBefore[0].item);
    assert.deepEqual(candidates[0].logs, candidatesBefore[0].logs);
});

test('returns original candidate identities in fresh mutable arrays', () => {
    const signature = makeCandidate(SIGNATURE, 'identity-signature');
    const normal = makeCandidate(NORMAL_A, 'identity-normal');
    const candidates = [normal, signature];
    const result = admitCombatLoot(makePlayer({ maxInv: 1 }), candidates);

    assert.equal(result.admitted[0], signature);
    assert.equal(result.blocked[0], normal);
    assert.notEqual(result.admitted, candidates);
    assert.notEqual(result.blocked, candidates);

    result.admitted.push(normal);
    result.blocked.pop();
    assert.deepEqual(result.admitted, [signature, normal]);
    assert.deepEqual(result.blocked, []);
    assert.deepEqual(candidates, [normal, signature]);
});

test('settles only the signature candidate when one inventory slot remains', () => {
    installDropTable(TRAINING_NORMAL, [
        { item: BLOCKED_NORMAL, rate: 1 },
        { item: SIGNATURE, rate: 1 },
    ]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const state = makeCombatState({
        enemyName: TRAINING_NORMAL,
        inv: initialInventory,
        maxInv: initialInventory.length + 1,
    });

    const won = resolveAttackVictory(state, 1);
    const blockedNames = won.logs.filter(({ text }) => text.includes(BLOCKED_NORMAL));
    const digestOrHintLogs = won.logs.filter(({ text }) => (
        text.startsWith('전투 정리:')
        || text.startsWith('장비 갱신:')
        || text.startsWith('성향 공명:')
    ));
    const acquisitionIndex = won.logs.findIndex(({ text }) => text === MSG.LOOT_GET(SIGNATURE));
    const blockedSummaryIndex = won.logs.findIndex(({ text }) => text === capacityBlockedMessage(1));
    const digestIndex = won.logs.findIndex(({ text }) => text.startsWith(combatDigestPrefix));

    assert.equal(won.player.inv.length, won.player.maxInv);
    assert.ok(won.player.inv.some(({ name }) => name === SIGNATURE));
    assert.ok(!won.player.inv.some(({ name }) => String(name).includes(BLOCKED_NORMAL)));
    assert.equal(won.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
    assert.deepEqual(blockedNames, []);
    assert.ok(digestOrHintLogs.length > 0);
    assert.ok(digestOrHintLogs.every(({ text }) => !text.includes(BLOCKED_NORMAL)));
    assert.ok(acquisitionIndex >= 0);
    assert.ok(blockedSummaryIndex > acquisitionIndex);
    assert.ok(digestIndex > blockedSummaryIndex);
    assert.equal(won.player.stats.codex.weapons[SIGNATURE]?.discovered, true);
    assert.equal(won.player.stats.codex.weapons[BLOCKED_NORMAL], undefined);
    assert.equal(
        won.player.seasonPass.xp - state.player.seasonPass.xp,
        SEASON_XP.kill + (SEASON_XP.codexDiscover * 2),
    );
    assertSingleVictoryReceipt(won, { hasVictoryStory: true });
    const replayed = resolveAttackVictory(won, 1);
    assert.equal(replayed, won);
});

test('skill victory uses capacity settlement once and replays as an exact no-op', () => {
    installDropTable(TRAINING_NORMAL, [
        { item: BLOCKED_NORMAL, rate: 1 },
        { item: SIGNATURE, rate: 1 },
    ]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const state = makeCombatState({
        enemyName: TRAINING_NORMAL,
        inv: initialInventory,
        maxInv: initialInventory.length + 1,
    });

    const won = resolveCombatActionVictory(state, 'skill', 2, 1_700_000_000_002);

    assert.equal(won.player.inv.length, won.player.maxInv);
    assert.ok(won.player.inv.some(({ name }) => name === SIGNATURE));
    assert.ok(!won.player.inv.some(({ name }) => name === BLOCKED_NORMAL));
    assert.equal(won.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
    assertSingleVictoryReceipt(won, { hasVictoryStory: true });

    const replayed = resolveCombatActionVictory(won, 'skill', 2, 1_700_000_000_002);
    assert.equal(replayed, won);
});

test('admitted prefixed equipment is a positive control for the full-capacity suppression', () => {
    installDropTable(TRAINING_PREFIX, [{ item: BLOCKED_NORMAL, rate: 1 }]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const admitted = resolveAttackVictory(makeCombatState({
        enemyName: TRAINING_PREFIX,
        inv: initialInventory,
        maxInv: initialInventory.length + 1,
    }), 13);
    const admittedItem = admitted.player.inv.find(({ name }) => name === PREFIXED_BLOCKED_NORMAL);
    const admittedLootLog = MSG.LOOT_GET(admittedItem?.name);
    const admittedPrefixLog = MSG.LOOT_PREFIX(admittedItem?.prefixName);
    const admittedUpgradeHint = MSG.COMBAT_DIGEST_EQUIP_UPGRADE(
        admittedItem?.name,
        BLOCKED_NORMAL_UPGRADE_SUMMARY,
    );

    assert.equal(admittedItem?.name, PREFIXED_BLOCKED_NORMAL);
    assert.equal(admittedItem?.prefixName, BLOCKED_NORMAL_PREFIX);
    assert.ok(admitted.logs.some(({ text }) => text === admittedLootLog));
    assert.ok(admitted.logs.some(({ text }) => text === admittedPrefixLog));
    assert.ok(admitted.logs.some(({ text }) => text === admittedUpgradeHint));

    const blocked = resolveAttackVictory(makeCombatState({
        enemyName: TRAINING_PREFIX,
        inv: initialInventory,
        maxInv: initialInventory.length,
    }), 13);

    // Seed 13 deterministically enriches 강철 롱소드 as 날카로운 강철 롱소드.
    // The paired positive control proves these exact acquisition and upgrade
    // messages are real production output before the full-capacity assertion.
    // The negative side catches any downstream consumer that still reads raw
    // lootResult.items/logs: it would leak the blocked candidate's acquisition,
    // prefix, or upgrade hint.

    assert.equal(blocked.player.inv.length, blocked.player.maxInv);
    assert.equal(blocked.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
    assert.ok(!blocked.logs.some(({ text }) => text === admittedLootLog));
    assert.ok(!blocked.logs.some(({ text }) => text === admittedPrefixLog));
    assert.ok(!blocked.logs.some(({ text }) => text === admittedUpgradeHint));
});

test('admitted trait resonance is a positive control for full-capacity trait suppression', () => {
    installDropTable(TRAINING_PREFIX, [{ item: BLOCKED_NORMAL, rate: 1 }]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const admitted = resolveAttackVictory(makeTraitFocusedState({
        inv: initialInventory,
        maxInv: initialInventory.length + 1,
    }), 13);
    const admittedItem = admitted.player.inv.find(({ name }) => name === PREFIXED_BLOCKED_NORMAL);
    const traitHint = getTraitLootHint(
        [admittedItem],
        getTraitProfile(admitted.player, { maxHp: admitted.player.maxHp, maxMp: admitted.player.maxMp }),
        admitted.player,
    );
    assert.ok(admittedItem);
    assert.equal(admittedItem.name, PREFIXED_BLOCKED_NORMAL);
    assert.equal(traitHint?.name, PREFIXED_BLOCKED_NORMAL);
    assert.ok(traitHint?.summary);
    const admittedTraitLog = MSG.COMBAT_DIGEST_TRAIT_HINT(traitHint.name, traitHint.summary);

    // The stronger equipped weapon makes the production upgrade helper return
    // no upgrade path, so this exact trait message is the only build hint.
    assert.ok(!admitted.logs.some(({ text }) => text.startsWith('장비 갱신:')));
    assert.ok(admitted.logs.some(({ text }) => text === admittedTraitLog));

    const blocked = resolveAttackVictory(makeTraitFocusedState({
        inv: initialInventory,
        maxInv: initialInventory.length,
    }), 13);

    // The positive control derives the exact trait summary from production
    // authority; the full-capacity run must not leak it through raw loot data.
    assert.equal(blocked.player.inv.length, blocked.player.maxInv);
    assert.equal(blocked.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
    assert.ok(!blocked.logs.some(({ text }) => text === admittedTraitLog));
});

test('a full boss inventory blocks its signature and increments pity once', () => {
    installDropTable(TRAINING_BOSS, [{ item: SIGNATURE, rate: 1 }]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const state = makeCombatState({
        enemyName: TRAINING_BOSS,
        isBoss: true,
        inv: initialInventory,
        maxInv: initialInventory.length,
        signaturePity: 4,
    });

    const won = resolveAttackVictory(state, 1);

    assert.equal(won.player.inv.length, won.player.maxInv);
    assert.equal(won.player.stats.signaturePity, 5);
    assert.ok(!won.player.inv.some(({ name }) => String(name).includes(SIGNATURE)));
    assert.ok(!won.logs.some(({ text }) => text.includes(SIGNATURE)));
    assert.equal(won.player.stats.codex.weapons[SIGNATURE], undefined);
    assert.equal(won.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
    assert.equal(
        won.player.seasonPass.xp - state.player.seasonPass.xp,
        SEASON_XP.bossKill + SEASON_XP.codexDiscover,
    );
    assertSingleVictoryReceipt(won);
    const replayed = resolveAttackVictory(won, 1);
    assert.equal(replayed, won);
});

test('a one-slot boss admission resets pity only after the signature is acquired', () => {
    installDropTable(TRAINING_BOSS, [{ item: SIGNATURE, rate: 1 }]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const state = makeCombatState({
        enemyName: TRAINING_BOSS,
        isBoss: true,
        inv: initialInventory,
        maxInv: initialInventory.length + 1,
        signaturePity: 4,
    });

    const won = resolveAttackVictory(state, 1);

    assert.equal(won.player.inv.length, won.player.maxInv);
    assert.ok(won.player.inv.some(({ name }) => name === SIGNATURE));
    assert.equal(won.player.stats.signaturePity, 0);
    assert.equal(won.player.stats.codex.weapons[SIGNATURE]?.discovered, true);
    assert.ok(won.logs.some(({ text }) => text.includes(SIGNATURE)));
    assert.equal(won.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 0);
});

test('a full normal-monster inventory leaves blocked signature pity unchanged', () => {
    installDropTable(TRAINING_NORMAL, [{ item: SIGNATURE, rate: 1 }]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const state = makeCombatState({
        enemyName: TRAINING_NORMAL,
        inv: initialInventory,
        maxInv: initialInventory.length,
        signaturePity: 4,
    });

    const won = resolveAttackVictory(state, 1);

    assert.equal(won.player.inv.length, won.player.maxInv);
    assert.equal(won.player.stats.signaturePity, 4);
    assert.ok(!won.player.inv.some(({ name }) => String(name).includes(SIGNATURE)));
    assert.ok(!won.logs.some(({ text }) => text.includes(SIGNATURE)));
    assert.equal(won.player.stats.codex.weapons[SIGNATURE], undefined);
    assert.equal(won.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
});

test('attack-turn DOT victory uses the same capacity settlement and replay receipt', () => {
    installDropTable(TRAINING_DOT, [
        { item: BLOCKED_NORMAL, rate: 1 },
        { item: SIGNATURE, rate: 1 },
    ]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const state = makeCombatState({
        enemyName: TRAINING_DOT,
        inv: initialInventory,
        maxInv: initialInventory.length + 1,
    });
    state.player = { ...state.player, atk: 1 };
    state.enemy = { ...state.enemy, hp: 10, maxHp: 100, dots: ['poison'] };

    const won = resolveAttackVictory(state, 3, 1_700_000_000_003);

    assert.equal(won.gameState, 'idle');
    assert.ok(won.logs.some(({ text }) => text.includes('지속 피해')));
    assert.equal(won.player.inv.length, won.player.maxInv);
    assert.ok(won.player.inv.some(({ name }) => name === SIGNATURE));
    assert.ok(!won.player.inv.some(({ name }) => name === BLOCKED_NORMAL));
    assert.equal(won.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
    assertSingleVictoryReceipt(won);

    const replayed = resolveAttackVictory(won, 3, 1_700_000_000_003);
    assert.equal(replayed, won);
});

test('combat-item DOT victory settles only post-consumption capacity and replays exactly', () => {
    installDropTable(TRAINING_ITEM, [
        { item: BLOCKED_NORMAL, rate: 1 },
        { item: SIGNATURE, rate: 1 },
    ]);
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const consumedItem = initialInventory[0];
    const state = makeCombatState({
        enemyName: TRAINING_ITEM,
        inv: initialInventory,
        maxInv: initialInventory.length,
        playerPatch: { hp: 40 },
    });
    state.enemy = { ...state.enemy, hp: 4, maxHp: 100, dots: ['poison'] };
    const postConsumptionOccupied = state.player.inv.length - 1;
    const postConsumptionAvailable = state.player.maxInv - postConsumptionOccupied;
    assert.equal(state.player.inv.length, state.player.maxInv);
    assert.equal(postConsumptionAvailable, 1);
    const action = {
        type: AT.USE_COMBAT_ITEM,
        payload: {
            itemId: consumedItem.id,
            expectedTurn: 0,
            seed: 4,
            now: 1_700_000_000_004,
        },
    };
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);

    const won = actionMap.USE_COMBAT_ITEM(state, action);

    assert.equal(won.gameState, 'idle');
    assert.ok(won.logs.some(({ text }) => text.includes('지속 피해')));
    assert.ok(!won.player.inv.some(({ id }) => id === consumedItem.id));
    assert.equal(won.player.inv.length, won.player.maxInv);
    assert.equal(won.player.inv.length - postConsumptionOccupied, postConsumptionAvailable);
    assert.ok(won.player.inv.some(({ name }) => name === SIGNATURE));
    assert.ok(!won.player.inv.some(({ name }) => name === BLOCKED_NORMAL));
    assert.equal(won.logs.filter(({ text }) => text === capacityBlockedMessage(1)).length, 1);
    assertSingleVictoryReceipt(won);

    const replayed = actionMap.USE_COMBAT_ITEM(won, action);
    assert.equal(replayed, won);
});

test('stale expected turn preserves inventory, pity, Codex, logs and RNG-observable state exactly', () => {
    const initialInventory = structuredClone(INITIAL_STATE.player.inv);
    const state = makeCombatState({
        enemyName: TRAINING_DOT,
        inv: initialInventory,
        maxInv: initialInventory.length + 1,
        signaturePity: 4,
    });
    state.combatTurn = 1;
    state.logs = [{ id: 'before-stale', type: 'info', text: '기존 로그' }];
    state.combatReceipt = {
        key: 'before-stale-receipt',
        kind: 'continue',
        stories: [],
    };
    const action = {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: {
            kind: 'attack',
            expectedTurn: 0,
            seed: 99,
            now: 1_700_000_000_099,
        },
    };
    const before = {
        inv: structuredClone(state.player.inv),
        pity: state.player.stats.signaturePity,
        codex: structuredClone(state.player.stats.codex),
        logs: structuredClone(state.logs),
        rngObservable: {
            combatTurn: state.combatTurn,
            combatReceipt: structuredClone(state.combatReceipt),
            combatFlags: structuredClone(state.player.combatFlags),
            skillLoadout: structuredClone(state.player.skillLoadout),
            enemy: structuredClone(state.enemy),
            lastEndgameReceiptKey: state.player.meta?.endgame?.lastEndgameReceiptKey,
        },
    };

    const stale = makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION(state, action);

    assert.equal(stale, state);
    assert.deepEqual(stale.player.inv, before.inv);
    assert.equal(stale.player.stats.signaturePity, before.pity);
    assert.deepEqual(stale.player.stats.codex, before.codex);
    assert.deepEqual(stale.logs, before.logs);
    assert.deepEqual({
        combatTurn: stale.combatTurn,
        combatReceipt: stale.combatReceipt,
        combatFlags: stale.player.combatFlags,
        skillLoadout: stale.player.skillLoadout,
        enemy: stale.enemy,
        lastEndgameReceiptKey: stale.player.meta?.endgame?.lastEndgameReceiptKey,
    }, before.rngObservable);
});
