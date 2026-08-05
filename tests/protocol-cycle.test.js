import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import {
    getCurrentDailyProtocol,
    getProtocolDayKey,
    getProtocolWeekKey,
} from '../src/utils/protocolCycle.js';

const buildState = (playerOverrides = {}) => ({
    ...INITIAL_STATE,
    player: {
        ...INITIAL_STATE.player,
        stats: { ...INITIAL_STATE.player.stats },
        ...playerOverrides,
    },
});

test('protocol cycle keys distinguish local days and same-numbered weeks across years', () => {
    const date = new Date(2026, 7, 5, 23, 30);
    const expectedDay = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');

    assert.equal(getProtocolDayKey(date), expectedDay);
    assert.equal(getProtocolWeekKey(new Date(2025, 0, 2)), '2025-W01');
    assert.equal(getProtocolWeekKey(new Date(2026, 0, 1)), '2026-W01');
});

test('first combat action of a new day starts and advances the current daily protocol', () => {
    const state = buildState({
        level: 5,
        stats: {
            ...INITIAL_STATE.player.stats,
            dailyProtocol: {
                date: '2000-01-01',
                relicShards: 3,
                missions: [
                    { id: 'old', type: 'kills', goal: 1, progress: 0, done: false, reward: { essence: 9999 } },
                ],
            },
        },
    });

    const next = gameReducer(state, {
        type: AT.UPDATE_DAILY_PROTOCOL,
        payload: { type: 'kills', amount: 999999 },
    });
    const protocol = next.player.stats.dailyProtocol;
    const killMission = protocol.missions.find((mission) => mission.type === 'kills');

    assert.equal(protocol.date, getProtocolDayKey(new Date()));
    assert.equal(protocol.relicShards, 3);
    assert.equal(killMission.progress, 1);
    assert.equal(killMission.done, false);
    assert.equal(next.player.meta.essence, 0);
});

test('current daily protocol exposes today goals before the first action without changing the save', () => {
    const player = buildState().player;
    const protocol = getCurrentDailyProtocol(player, new Date());

    assert.equal(protocol.date, getProtocolDayKey(new Date()));
    assert.deepEqual(protocol.missions.map((mission) => mission.type), ['kills', 'explores', 'goldSpend']);
    assert.equal(player.stats.dailyProtocol, null);
});

test('daily mission completion records the essence amount actually granted by the reducer', () => {
    const player = buildState({ level: 2 }).player;
    const dailyProtocol = getCurrentDailyProtocol(player, new Date());
    dailyProtocol.missions = dailyProtocol.missions.map((mission) => (
        mission.type === 'kills'
            ? { ...mission, progress: mission.goal - 1 }
            : mission
    ));
    const state = buildState({
        level: 2,
        meta: {
            ...INITIAL_STATE.player.meta,
            prestigeRank: 1,
        },
        stats: {
            ...INITIAL_STATE.player.stats,
            dailyProtocol,
        },
    });

    const next = gameReducer(state, {
        type: AT.UPDATE_DAILY_PROTOCOL,
        payload: { type: 'kills' },
    });

    assert.equal(next.player.meta.essence, 11);
    assert.equal(next.logs.length, 1);
    assert.equal(next.logs[0].type, 'success');
    assert.equal(next.logs[0].text, '오늘의 임무 완료 · 에센스 +11');
});

test('daily relic shard completion names the relic created from five shards', () => {
    const player = buildState().player;
    const dailyProtocol = getCurrentDailyProtocol(player, new Date());
    dailyProtocol.relicShards = 4;
    dailyProtocol.missions = dailyProtocol.missions.map((mission) => (
        mission.type === 'goldSpend'
            ? { ...mission, progress: mission.goal - 1 }
            : mission
    ));
    const state = buildState({
        relics: [],
        stats: {
            ...INITIAL_STATE.player.stats,
            dailyProtocol,
        },
    });
    const originalRandom = Math.random;
    Math.random = () => 0;

    try {
        const next = gameReducer(state, {
            type: AT.UPDATE_DAILY_PROTOCOL,
            payload: { type: 'goldSpend', amount: 1 },
        });
        const relicName = next.player.relics[0].name;

        assert.equal(next.player.stats.dailyProtocol.relicShards, 0);
        assert.deepEqual(next.logs.map((log) => log.text), [
            '오늘의 임무 완료 · 유물 파편 +1',
            `유물 파편 완성 · ${relicName} 획득`,
        ]);
    } finally {
        Math.random = originalRandom;
    }
});

test('daily mission progress does not add a reward log before completion', () => {
    const player = buildState().player;
    const dailyProtocol = getCurrentDailyProtocol(player, new Date());
    const state = buildState({
        stats: {
            ...INITIAL_STATE.player.stats,
            dailyProtocol,
        },
    });

    const next = gameReducer(state, {
        type: AT.UPDATE_DAILY_PROTOCOL,
        payload: { type: 'kills' },
    });

    assert.equal(next.player.stats.dailyProtocol.missions.find((mission) => mission.type === 'kills').progress, 1);
    assert.deepEqual(next.logs, []);
});

test('first combat action of a new weekly cycle resets stale progress before counting', () => {
    const state = buildState({
        weeklyProtocol: {
            kills: 49,
            explores: 19,
            bossKills: 2,
            lastResetWeek: 32,
            claimed: ['weeklyKills'],
        },
    });

    const next = gameReducer(state, {
        type: AT.UPDATE_WEEKLY_PROTOCOL,
        payload: { type: 'kills', amount: 999999 },
    });

    assert.deepEqual(next.player.weeklyProtocol, {
        kills: 1,
        explores: 0,
        bossKills: 0,
        lastResetWeek: getProtocolWeekKey(new Date()),
        claimed: [],
    });
});

test('weekly rewards require canonical completion and ignore payload reward data', () => {
    const mission = BALANCE.WEEKLY_MISSIONS.find((entry) => entry.id === 'weeklyKills');
    const state = buildState({
        gold: 100,
        premiumCurrency: 2,
        weeklyProtocol: {
            kills: mission.target - 1,
            explores: 0,
            bossKills: 0,
            lastResetWeek: getProtocolWeekKey(new Date()),
            claimed: [],
        },
    });
    const forgedAction = {
        type: AT.CLAIM_WEEKLY_MISSION,
        payload: {
            missionId: mission.id,
            reward: { gold: 999999, premiumCurrency: 999999 },
        },
    };

    const rejected = gameReducer(state, forgedAction);
    assert.equal(rejected, state);

    const completeState = {
        ...state,
        player: {
            ...state.player,
            weeklyProtocol: { ...state.player.weeklyProtocol, kills: mission.target },
        },
    };
    const claimed = gameReducer(completeState, forgedAction);

    assert.equal(claimed.player.gold, 100 + mission.reward.gold);
    assert.equal(claimed.player.premiumCurrency, 2 + mission.reward.premiumCurrency);
    assert.deepEqual(claimed.player.weeklyProtocol.claimed, [mission.id]);

    assert.equal(gameReducer(claimed, forgedAction), claimed);
    assert.equal(gameReducer(completeState, {
        type: AT.CLAIM_WEEKLY_MISSION,
        payload: { missionId: 'unknown-weekly-mission', reward: forgedAction.payload.reward },
    }), completeState);
});
