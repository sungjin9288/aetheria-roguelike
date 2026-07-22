import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import { migrateData } from '../src/utils/gameUtils.js';
import {
    calculateExpeditionExpGain,
    finishExpedition,
    startExpedition,
} from '../src/utils/expeditionLedger.js';

const makePlayer = (overrides = {}) => ({
    ...INITIAL_STATE.player,
    level: 1,
    exp: 40,
    nextExp: 200,
    gold: 200,
    hp: 180,
    maxHp: 180,
    loc: '시작의 마을',
    inv: [
        { id: 'potion-1', name: '초급 회복 물약', type: 'consumable' },
        { name: '강화 재료', type: 'mat' },
    ],
    quests: [{ id: 1, progress: 1 }],
    stats: {
        ...INITIAL_STATE.player.stats,
        kills: 2,
        bossKills: 0,
        explores: 3,
        claimedQuestIds: [],
    },
    ...overrides,
});

test('원정 시작은 저장 가능한 baseline을 만들고 이미 진행 중이면 중복 생성하지 않는다', () => {
    const player = makePlayer();
    const started = startExpedition(player, '고요한 숲', 1_000, DB.QUESTS);

    assert.equal(started.activeExpedition.destination, '고요한 숲');
    assert.equal(started.activeExpedition.startExp, 40);
    assert.equal(started.activeExpedition.inventory.length, 2);
    assert.deepEqual(started.activeExpedition.quests[0], {
        id: 1,
        title: '슬라임 소탕',
        progress: 1,
        goal: 3,
    });

    const repeated = startExpedition(started, '신성한 호수', 2_000, DB.QUESTS);
    assert.equal(repeated.activeExpedition.id, started.activeExpedition.id);
    assert.equal(repeated.activeExpedition.destination, '고요한 숲');
});

test('레벨업으로 current EXP가 wrap되어도 원정 성장 EXP를 복원한다', () => {
    const started = startExpedition(makePlayer(), '고요한 숲', 1_000, DB.QUESTS);
    assert.equal(calculateExpeditionExpGain(started.activeExpedition, { level: 1, exp: 90 }), 50);
    assert.equal(calculateExpeditionExpGain(started.activeExpedition, { level: 2, exp: 25 }), 185);
    assert.equal(calculateExpeditionExpGain(started.activeExpedition, { level: 3, exp: 10 }), 399);
});

test('정상 귀환은 전투/탐험/재화/아이템/임무/최저 HP delta를 한 번 확정한다', () => {
    const started = startExpedition(makePlayer(), '고요한 숲', 1_000, DB.QUESTS);
    const fieldPlayer = {
        ...started,
        loc: '고요한 숲',
        level: 2,
        exp: 25,
        nextExp: 230,
        gold: 165,
        hp: 72,
        inv: [
            { name: '강화 재료', type: 'mat' },
            { id: 'forest-bow', name: '숲지기 활', type: 'weapon' },
        ],
        quests: [{ id: 1, progress: 3 }],
        stats: {
            ...started.stats,
            kills: 5,
            bossKills: 1,
            explores: 7,
        },
        activeExpedition: { ...started.activeExpedition, lowestHp: 38 },
    };

    const result = finishExpedition(fieldPlayer, '시작의 마을', 61_000, DB.QUESTS);
    const summary = result.summary;
    assert.equal(result.player.activeExpedition, null);
    assert.equal(result.player.lastExpeditionSummary.id, started.activeExpedition.id);
    assert.equal(summary.durationMs, 60_000);
    assert.equal(summary.expGained, 185);
    assert.equal(summary.goldDelta, -35);
    assert.equal(summary.battles, 3);
    assert.equal(summary.bossBattles, 1);
    assert.equal(summary.explores, 4);
    assert.deepEqual(summary.newItems, ['숲지기 활']);
    assert.equal(summary.lostItemCount, 1);
    assert.deepEqual(summary.completedQuests, ['슬라임 소탕']);
    assert.equal(summary.lowestHp, 38);
    assert.equal(summary.lowestHpPercent, 21);
    assert.equal(summary.reviewedAt, null);

    const duplicate = finishExpedition(result.player, '시작의 마을', 62_000, DB.QUESTS);
    assert.equal(duplicate.summary, null);
    assert.equal(duplicate.player.lastExpeditionSummary.id, summary.id);
});

test('SET_PLAYER 중앙 경로가 원정 중 최저 HP만 단조 감소로 추적한다', () => {
    const started = startExpedition(makePlayer(), '고요한 숲', 1_000, DB.QUESTS);
    const state = { ...INITIAL_STATE, player: started };
    const damaged = gameReducer(state, { type: AT.SET_PLAYER, payload: { hp: 75 } });
    const healed = gameReducer(damaged, { type: AT.SET_PLAYER, payload: { hp: 130 } });

    assert.equal(damaged.player.activeExpedition.lowestHp, 75);
    assert.equal(healed.player.activeExpedition.lowestHp, 75);
});

test('migration은 구세이브 누락/손상 원정 상태를 null로 만들고 정상 요약을 보존한다', () => {
    const oldSave = migrateData({ version: 5, player: { equip: {}, stats: {} } });
    assert.equal(oldSave.player.activeExpedition, null);
    assert.equal(oldSave.player.lastExpeditionSummary, null);

    const started = startExpedition(makePlayer(), '고요한 숲', 1_000, DB.QUESTS);
    const completed = finishExpedition({ ...started, loc: '고요한 숲' }, '시작의 마을', 2_000, DB.QUESTS);
    const migrated = migrateData({
        version: 5,
        player: {
            ...completed.player,
            equip: {},
            activeExpedition: { broken: true },
            lastExpeditionSummary: { ...completed.summary, reviewedAt: 2_500 },
        },
    });
    assert.equal(migrated.player.activeExpedition, null);
    assert.equal(migrated.player.lastExpeditionSummary.id, completed.summary.id);
    assert.equal(migrated.player.lastExpeditionSummary.reviewedAt, 2_500);
});

test('moveActions 마을→던전→마을 사이클이 snapshot과 debrief open을 연결한다', () => {
    let player = makePlayer({ stats: { ...makePlayer().stats, visitedMaps: ['시작의 마을', '고요한 숲'] } });
    const dispatches = [];
    const dispatch = (action) => {
        dispatches.push(action);
        if (action.type === AT.SET_PLAYER) {
            const payload = typeof action.payload === 'function' ? action.payload(player) : action.payload;
            player = { ...player, ...payload };
        }
    };
    const makeActions = () => createMoveActions({
        player,
        gameState: 'idle',
        grave: [],
        isAiThinking: false,
        liveConfig: {},
        dispatch,
        addLog: () => {},
    });

    makeActions().move('고요한 숲');
    assert.equal(player.loc, '고요한 숲');
    assert.equal(player.activeExpedition.destination, '고요한 숲');

    player = {
        ...player,
        hp: 90,
        stats: { ...player.stats, kills: player.stats.kills + 2, explores: player.stats.explores + 3 },
    };
    makeActions().move('시작의 마을');

    assert.equal(player.loc, '시작의 마을');
    assert.equal(player.activeExpedition, null);
    assert.equal(player.lastExpeditionSummary.battles, 2);
    assert.equal(player.lastExpeditionSummary.explores, 3);
    assert.ok(dispatches.some((action) => action.type === AT.SET_EXPEDITION_DEBRIEF_OPEN && action.payload === true));
});
