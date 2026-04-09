import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.js';
import {
    resetDailyProtocolIfNeeded,
    resetWeeklyProtocolIfNeeded,
    applyBattleStartRelics,
    spawnEnemy,
} from '../src/utils/exploreUtils.js';

// ─── Mock dispatch/addLog helpers ────────────────────────────────────────
const makeDispatchSpy = () => {
    const calls = [];
    const dispatch = (action) => {
        calls.push(action);
    };
    return { dispatch, calls };
};

const makeAddLogSpy = () => {
    const entries = [];
    const addLog = (type, text) => {
        entries.push({ type, text });
    };
    return { addLog, entries };
};

// ─── resetDailyProtocolIfNeeded ──────────────────────────────────────────
test('resetDailyProtocolIfNeeded dispatches SET_DAILY_PROTOCOL on a new day', () => {
    const player = {
        level: 5,
        stats: { dailyProtocol: { date: '2000-01-01', missions: [] } },
    };
    const { dispatch, calls } = makeDispatchSpy();

    resetDailyProtocolIfNeeded(player, dispatch);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, AT.SET_DAILY_PROTOCOL);
    assert.ok(Array.isArray(calls[0].payload.missions));
    assert.equal(calls[0].payload.missions.length, 3);
    // missions scale with player level
    const killsMission = calls[0].payload.missions.find((m) => m.type === 'kills');
    assert.ok(killsMission);
    assert.ok(killsMission.goal >= 10);
});

test('resetDailyProtocolIfNeeded is a no-op when dailyProtocol is already today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const player = {
        level: 5,
        stats: { dailyProtocol: { date: today, missions: [] } },
    };
    const { dispatch, calls } = makeDispatchSpy();

    resetDailyProtocolIfNeeded(player, dispatch);
    assert.equal(calls.length, 0);
});

test('resetDailyProtocolIfNeeded initializes missions when player has no protocol yet', () => {
    const player = { level: 1, stats: {} };
    const { dispatch, calls } = makeDispatchSpy();

    resetDailyProtocolIfNeeded(player, dispatch);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, AT.SET_DAILY_PROTOCOL);
});

// ─── resetWeeklyProtocolIfNeeded ─────────────────────────────────────────
test('resetWeeklyProtocolIfNeeded resets when the stored week is stale', () => {
    const player = {
        weeklyProtocol: { kills: 5, explores: 2, bossKills: 0, lastResetWeek: 1, claimed: ['a'] },
    };
    const { dispatch, calls } = makeDispatchSpy();

    resetWeeklyProtocolIfNeeded(player, dispatch);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, AT.SET_PLAYER);
    assert.equal(typeof calls[0].payload, 'function');

    const next = calls[0].payload({ weeklyProtocol: player.weeklyProtocol });
    assert.equal(next.weeklyProtocol.kills, 0);
    assert.equal(next.weeklyProtocol.explores, 0);
    assert.equal(next.weeklyProtocol.bossKills, 0);
    assert.deepEqual(next.weeklyProtocol.claimed, []);
});

test('resetWeeklyProtocolIfNeeded is a no-op when the stored week matches', () => {
    // Compute ISO week number to simulate "current week"
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const currentWeek = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    const player = {
        weeklyProtocol: { kills: 3, explores: 1, bossKills: 0, lastResetWeek: currentWeek, claimed: [] },
    };
    const { dispatch, calls } = makeDispatchSpy();

    resetWeeklyProtocolIfNeeded(player, dispatch);
    assert.equal(calls.length, 0);
});

// ─── applyBattleStartRelics ──────────────────────────────────────────────
test('applyBattleStartRelics resets combatFlags and preserves existing voidHeart state', () => {
    const player = {
        hp: 50, maxHp: 100,
        combatFlags: { voidHeartUsed: true, voidHeartArmed: false },
    };
    const { addLog } = makeAddLogSpy();

    const next = applyBattleStartRelics(player, [], { maxHp: 100 }, { addLog });

    assert.equal(next.combatFlags.comboCount, 0);
    assert.equal(next.combatFlags.deathSaveUsed, false);
    assert.equal(next.combatFlags.voidHeartUsed, true);
    assert.equal(next.combatFlags.voidHeartArmed, false);
});

test('applyBattleStartRelics heals on a battle_start_heal relic', () => {
    const player = { hp: 50, maxHp: 100, combatFlags: {} };
    const relic = { effect: 'battle_start_heal', val: 0.25 };
    const { addLog, entries } = makeAddLogSpy();

    const next = applyBattleStartRelics(player, [relic], { maxHp: 100 }, { addLog });

    assert.equal(next.hp, 75); // 50 + 25% of 100
    assert.ok(entries.some((entry) => entry.type === 'heal'));
});

test('applyBattleStartRelics clamps heal at maxHp', () => {
    const player = { hp: 95, maxHp: 100, combatFlags: {} };
    const relic = { effect: 'battle_start_heal', val: 0.5 };
    const { addLog } = makeAddLogSpy();

    const next = applyBattleStartRelics(player, [relic], { maxHp: 100 }, { addLog });

    assert.equal(next.hp, 100);
});

test('applyBattleStartRelics deducts hp on a cursed_power relic but never below 1', () => {
    const player = { hp: 20, maxHp: 100, combatFlags: {} };
    const relic = { effect: 'cursed_power', val: { hp_cost: 0.5 } };
    const { addLog } = makeAddLogSpy();

    const next = applyBattleStartRelics(player, [relic], { maxHp: 100 }, { addLog });

    assert.ok(next.hp >= 1);
    assert.ok(next.hp < player.hp);
});

// ─── spawnEnemy ──────────────────────────────────────────────────────────
test('spawnEnemy produces a monster with stats scaled by map level', () => {
    const mapData = {
        name: '초원',
        level: 3,
        monsters: ['슬라임'],
        bossMonsters: [],
    };
    const player = { job: '모험가', level: 3, stats: {}, challengeModifiers: [] };
    const { addLog } = makeAddLogSpy();

    const { mStats, baseName } = spawnEnemy(mapData, player, [], { addLog });

    assert.equal(baseName, '슬라임');
    assert.ok(mStats.hp > 0);
    assert.ok(mStats.atk > 0);
    assert.equal(mStats.maxHp, mStats.hp);
    assert.ok(Number.isFinite(mStats.exp));
});

test('spawnEnemy marks boss monsters with isBoss flag', () => {
    const mapData = {
        name: '보스방',
        level: 10,
        monsters: ['철갑 거인'],
        bossMonsters: ['철갑 거인'],
    };
    const player = { job: '모험가', level: 10, stats: {}, challengeModifiers: [] };
    const { addLog } = makeAddLogSpy();

    const { mStats } = spawnEnemy(mapData, player, [], { addLog });
    assert.equal(mStats.isBoss, true);
});

test('spawnEnemy level caps at "infinite" using player abyssFloor', () => {
    const mapData = {
        name: '심연 50',
        level: 'infinite',
        monsters: ['슬라임'],
        bossMonsters: [],
    };
    const player = {
        job: '모험가',
        level: 50,
        stats: { abyssFloor: 20 },
        challengeModifiers: [],
    };
    const { addLog } = makeAddLogSpy();

    const { mStats, baseName } = spawnEnemy(mapData, player, [], { addLog });
    assert.ok(mStats.name.startsWith('[20층]') || mStats.name.includes(baseName));
    assert.ok(mStats.hp > 0);
});
