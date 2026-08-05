import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { handleVictoryOutcome } from '../src/hooks/combatActions/combatVictory.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { finishExpedition, startExpedition } from '../src/utils/expeditionLedger.js';
import { migrateData } from '../src/utils/gameUtils.js';
import {
    acknowledgeMilestoneStoryBeat,
    getPendingMilestoneStoryBeat,
    normalizeMilestoneStoryState,
    queueMilestoneStoryBeat,
} from '../src/utils/milestoneStory.js';

const makePlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '기록자',
    loc: '시작의 마을',
    ...overrides,
});

test('손상되거나 중복된 milestone save를 알려진 id의 unique queue로 정규화한다', () => {
    const normalized = normalizeMilestoneStoryState({
        seen: ['first_safe_return', 'first_safe_return', 'unknown'],
        pending: ['first_safe_return', 'first_job_change', 'first_job_change', null],
    });

    assert.deepEqual(normalized.seen, ['first_safe_return']);
    assert.deepEqual(normalized.pending, ['first_job_change']);
    assert.deepEqual(normalizeMilestoneStoryState(null), { seen: [], pending: [] });
});

test('같은 milestone은 queue와 acknowledge 경계에서 한 번만 처리한다', () => {
    const queued = queueMilestoneStoryBeat(makePlayer(), 'first_job_change');
    const duplicate = queueMilestoneStoryBeat(queued, 'first_job_change');
    const story = getPendingMilestoneStoryBeat(duplicate);
    const acknowledged = acknowledgeMilestoneStoryBeat(duplicate, 'first_job_change');
    const repeated = acknowledgeMilestoneStoryBeat(acknowledged, 'first_job_change');

    assert.equal(duplicate, queued);
    assert.equal(story.id, 'first_job_change');
    assert.deepEqual(acknowledged.meta.storyMilestones, {
        seen: ['first_job_change'],
        pending: [],
    });
    assert.equal(repeated, acknowledged);
});

test('첫 정상 귀환은 이야기 beat를 queue하고 이후 귀환에서는 반복하지 않는다', () => {
    const started = startExpedition(makePlayer(), '고요한 숲', 1_000, DB.QUESTS);
    const firstReturn = finishExpedition({ ...started, loc: '고요한 숲' }, '시작의 마을', 2_000, DB.QUESTS).player;
    assert.equal(getPendingMilestoneStoryBeat(firstReturn).id, 'first_safe_return');

    const acknowledged = acknowledgeMilestoneStoryBeat(firstReturn, 'first_safe_return');
    const nextStarted = startExpedition(acknowledged, '고요한 숲', 3_000, DB.QUESTS);
    const nextReturn = finishExpedition({ ...nextStarted, loc: '고요한 숲' }, '시작의 마을', 4_000, DB.QUESTS).player;

    assert.equal(getPendingMilestoneStoryBeat(nextReturn), null);
    assert.deepEqual(nextReturn.meta.storyMilestones.seen, ['first_safe_return']);
});

test('첫 사망 story queue는 기존 영구 성장 보상과 함께 보존된다', () => {
    const player = makePlayer({
        hp: 0,
        stats: { ...INITIAL_STATE.player.stats, deaths: 0 },
    });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);

    assert.equal(getPendingMilestoneStoryBeat(result.updatedPlayer).id, 'first_death');
    assert.ok(result.updatedPlayer.meta.bonusAtk > player.meta.bonusAtk);
    assert.ok(result.updatedPlayer.meta.bonusHp > player.meta.bonusHp);
});

test('RESET_GAME은 확인 전과 확인 후 story ledger를 모두 보존한다', () => {
    const player = queueMilestoneStoryBeat(makePlayer(), 'first_death');
    const state = {
        ...INITIAL_STATE,
        player,
        bootStage: 'ready',
    };
    const resetPending = gameReducer(state, { type: 'RESET_GAME' });
    assert.deepEqual(resetPending.player.meta.storyMilestones.pending, ['first_death']);

    const acknowledged = acknowledgeMilestoneStoryBeat(player, 'first_death');
    const resetSeen = gameReducer({ ...state, player: acknowledged }, { type: 'RESET_GAME' });
    assert.deepEqual(resetSeen.player.meta.storyMilestones.seen, ['first_death']);
});

test('구세이브 migration은 story ledger를 추가하고 unknown entry를 제거한다', () => {
    const oldSave = migrateData({
        player: makePlayer({
            meta: {
                ...INITIAL_STATE.player.meta,
                storyMilestones: { seen: ['first_safe_return', 'unknown'], pending: ['first_job_change'] },
            },
        }),
    });

    assert.deepEqual(oldSave.player.meta.storyMilestones, {
        seen: ['first_safe_return'],
        pending: ['first_job_change'],
    });
});

test('첫 전직 action은 직업 변경과 함께 story beat를 queue한다', () => {
    const player = makePlayer({ level: 5, job: '모험가' });
    const dispatches = [];
    const actions = createCharacterActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatches.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: (candidate = player) => calculateFullStats(candidate),
    }, {
        emitUnlockedTitles: () => {},
    });

    actions.jobChange('전사');
    const playerAction = dispatches.find((action) => action.type === 'SET_PLAYER');
    const changedPlayer = playerAction.payload(player);

    assert.equal(changedPlayer.job, '전사');
    assert.equal(getPendingMilestoneStoryBeat(changedPlayer).id, 'first_job_change');
    const changedStats = calculateFullStats(changedPlayer);
    assert.equal(changedPlayer.hp, changedStats.maxHp);
    assert.equal(changedPlayer.mp, changedStats.maxMp);
});

test('실제 현재 지역의 첫 구역 보스 승리는 area boss story beat를 queue한다', () => {
    const location = '신성한 호수';
    const bossName = DB.MAPS[location].boss;
    const player = makePlayer({
        loc: location,
        level: 15,
        hp: 300,
        maxHp: 300,
        mp: 100,
        maxMp: 100,
        inv: [],
        quests: [],
        stats: {
            ...INITIAL_STATE.player.stats,
            kills: 0,
            bossKills: 0,
            areaBossDefeated: {},
        },
    });
    const deadEnemy = {
        ...DB.MONSTERS[bossName],
        name: bossName,
        baseName: bossName,
        isBoss: true,
        hp: 0,
        maxHp: 500,
        exp: 0,
        gold: 0,
        drop: [],
    };
    let currentPlayer = player;
    const dispatch = (action) => {
        if (action.type !== 'SET_PLAYER') return;
        const patch = typeof action.payload === 'function'
            ? action.payload(currentPlayer)
            : action.payload;
        currentPlayer = { ...currentPlayer, ...patch };
    };

    handleVictoryOutcome({
        playerAfterCombat: player,
        deadEnemy,
        stats: calculateFullStats(player),
        dispatch,
        addLog: () => {},
        addStoryLog: () => {},
        emitUnlockedTitles: () => {},
        extendedChecks: true,
        liveConfig: { eventMultiplier: 1 },
    });

    assert.equal(currentPlayer.stats.areaBossDefeated[bossName], true);
    assert.equal(getPendingMilestoneStoryBeat(currentPlayer).id, 'first_area_boss');
});
