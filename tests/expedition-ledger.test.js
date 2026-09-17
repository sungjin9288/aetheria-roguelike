import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import { handleVictoryOutcome } from '../src/hooks/combatActions/combatVictory.js';
import { migrateData } from '../src/utils/gameUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { applyBoundedEncounterChoice } from '../src/utils/boundedEncounterSelector.js';
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
    const player = makePlayer({
        job: '전사',
        skillChoices: { 파워배시: 'A', 광폭화: 'Z', 마력탄: 'A' },
        equip: {
            weapon: { name: '강철 롱소드', type: 'weapon' },
            armor: { name: '기사의 흉갑', type: 'armor' },
            offhand: null,
        },
    });
    const started = startExpedition(player, '고요한 숲', 1_000, DB.QUESTS);

    assert.equal(started.activeExpedition.destination, '고요한 숲');
    assert.equal(started.activeExpedition.startExp, 40);
    assert.equal(started.activeExpedition.inventory.length, 2);
    assert.equal(started.activeExpedition.job, '전사');
    assert.deepEqual(started.activeExpedition.skillChoices, { 파워배시: 'A' });
    assert.deepEqual(started.activeExpedition.equipmentNames, ['강철 롱소드', '기사의 흉갑']);
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

test('원정 HP 기록은 장비를 포함한 최대 HP를 사용하고 시작 분모를 보존한다', () => {
    const player = makePlayer({
        hp: 178, maxHp: 150, job: '모험가', relics: [], activeTitle: null,
        skills: [], meta: {},
        equip: { weapon: null, armor: { name: 'HP 검증 갑옷', type: 'armor', hpBonus: 8 }, offhand: null },
    });
    assert.equal(calculateFullStats(player).maxHp, 178);
    const started = startExpedition(player, '고요한 숲', 1_000, DB.QUESTS);
    assert.equal(started.activeExpedition.maxHpAtStart, 178);
    const returned = { ...started, hp: 134 };
    const { summary } = finishExpedition(returned, '시작의 마을', 2_000, DB.QUESTS);
    assert.equal(summary.lowestHpPercent, 75);
    assert.equal(summary.maxHpAtReturn, 178);
    const unequipped = { ...returned, equip: { weapon: null, armor: null, offhand: null } };
    const changed = finishExpedition(unequipped, '시작의 마을', 2_000, DB.QUESTS).summary;
    assert.equal(changed.lowestHpPercent, 75);
    assert.equal(changed.maxHpAtReturn, 170);
    const legacy = { ...returned, activeExpedition: { ...started.activeExpedition, maxHpAtStart: 150 } };
    assert.equal(finishExpedition(legacy, '시작의 마을', 2_000, DB.QUESTS).summary.lowestHpPercent, 89);
    assert.equal(player.activeExpedition, INITIAL_STATE.player.activeExpedition);
});

test('공통 전투 승리 authority는 활성 원정의 canonical boss를 한 번만 기록한다', () => {
    const started = startExpedition(makePlayer({
        job: '전사',
        inv: [],
        quests: [],
    }), '고요한 숲', 1_000, DB.QUESTS);
    const deadEnemy = {
        name: '분노한 숲의 군주',
        baseName: '숲의 군주',
        isBoss: true,
        hp: 0,
        maxHp: 100,
        level: 1,
        exp: 0,
        gold: 0,
        drop: [],
    };
    let currentPlayer = started;
    const dispatch = (action) => {
        if (action.type !== AT.SET_PLAYER) return;
        const patch = typeof action.payload === 'function'
            ? action.payload(currentPlayer)
            : action.payload;
        currentPlayer = { ...currentPlayer, ...patch };
    };
    const resolveVictory = () => handleVictoryOutcome({
        playerAfterCombat: currentPlayer,
        deadEnemy,
        stats: calculateFullStats(currentPlayer),
        dispatch,
        addLog: () => {},
        addStoryLog: () => {},
        emitUnlockedTitles: () => {},
        extendedChecks: false,
        liveConfig: { eventMultiplier: 1 },
        rng: () => 0.5,
        now: () => 1_500,
    });

    resolveVictory();
    resolveVictory();

    assert.deepEqual(currentPlayer.activeExpedition.bossNames, ['숲의 군주']);
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
    // 기본 HP 180 + 모험가 패시브 20, 호환 장비 2피스 +5%.
    assert.equal(started.activeExpedition.maxHpAtStart, 210);
    assert.equal(summary.lowestHpPercent, 18);
    assert.equal(summary.reviewedAt, null);
    assert.deepEqual(summary.encounterDiscoveries, []);

    const duplicate = finishExpedition(result.player, '시작의 마을', 62_000, DB.QUESTS);
    assert.equal(duplicate.summary, null);
    assert.equal(duplicate.player.lastExpeditionSummary.id, summary.id);
});

test('귀환은 시작 직업과 새 signature를 summary와 직업 여정에 한 번 확정한다', () => {
    const started = startExpedition(makePlayer({
        job: '전사',
        skillChoices: { 파워배시: 'A', 광폭화: 'B' },
        equip: {
            weapon: { name: '강철 롱소드', type: 'weapon' },
            armor: { name: '기사의 흉갑', type: 'armor' },
            offhand: null,
        },
    }), '고요한 숲', 1_000, DB.QUESTS);
    const fieldPlayer = {
        ...started,
        loc: '신성한 호수',
        inv: [
            ...started.inv,
            { id: 'signature-1', name: '라그나로크', type: 'weapon' },
        ],
        activeExpedition: {
            ...started.activeExpedition,
            bossNames: ['숲의 군주'],
        },
    };

    const firstReturn = finishExpedition(fieldPlayer, '시작의 마을', 4_000, DB.QUESTS);
    const summary = firstReturn.summary;

    assert.equal(summary.job, '전사');
    assert.deepEqual(summary.skillChoices, { 파워배시: 'A', 광폭화: 'B' });
    assert.deepEqual(summary.equipmentNames, ['강철 롱소드', '기사의 흉갑']);
    assert.deepEqual(summary.bossNames, ['숲의 군주']);
    assert.deepEqual(summary.signatureItems, ['라그나로크']);
    assert.equal(firstReturn.player.classJourney.sequence, 1);
    assert.deepEqual(firstReturn.player.classJourney.byJob['전사'], {
        expeditionIds: [started.activeExpedition.id],
        skillBranches: ['파워배시:A', '광폭화:B'],
        signatureItems: ['라그나로크'],
        bossNames: ['숲의 군주'],
        regions: ['고요한 숲', '신성한 호수'],
        encounterDiscoveries: [],
        representativeExpeditionId: started.activeExpedition.id,
        lastPlayedAt: 4_000,
    });

    const replay = finishExpedition(firstReturn.player, '시작의 마을', 5_000, DB.QUESTS);
    assert.equal(replay.summary, null);
    assert.equal(replay.player.classJourney, firstReturn.player.classJourney);
    assert.equal(replay.player.classJourney.sequence, 1);
});

const rootEncounter = () => BOUNDED_ENCOUNTERS.find(
    ({ id }) => id === 'forest-root-resonance',
);

const startDiscoveryExpedition = () => startExpedition(makePlayer({
    job: '전사',
    mp: 100,
    maxMp: 100,
    inv: [],
    maxInv: 20,
}), '고요한 숲', 1_000, DB.QUESTS);

test('정상 귀환은 실제 bounded choice receipt를 summary와 Class Journey에 함께 확정한다', () => {
    const started = startDiscoveryExpedition();
    const encounter = rootEncounter();
    const settled = applyBoundedEncounterChoice(started, encounter, 'anchor-root-ward', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 1,
    });
    assert.equal(settled.applied, true);

    const returned = finishExpedition(settled.player, '시작의 마을', 2_000, DB.QUESTS);
    const expected = [{
        encounterId: encounter.id,
        encounterVersion: encounter.version,
        choiceId: 'anchor-root-ward',
        family: encounter.family,
        choiceLabel: '결계의 흐름을 이어 둔다',
    }];
    assert.deepEqual(returned.summary.encounterDiscoveries, expected);
    assert.deepEqual(
        returned.player.classJourney.byJob['전사'].encounterDiscoveries,
        expected,
    );
});

test('같은 사건 선택의 여러 occurrence는 정상 귀환에서 한 발견으로 합친다', () => {
    const started = startDiscoveryExpedition();
    const encounter = rootEncounter();
    const first = applyBoundedEncounterChoice(started, encounter, 'anchor-root-ward', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 1,
    });
    const second = applyBoundedEncounterChoice(first.player, encounter, 'anchor-root-ward', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 2,
    });

    const returned = finishExpedition(second.player, '시작의 마을', 2_000, DB.QUESTS);
    assert.equal(returned.summary.encounterDiscoveries.length, 1);
    assert.equal(returned.player.classJourney.byJob['전사'].encounterDiscoveries.length, 1);
});

test('같은 사건의 서로 다른 선택은 occurrence 순서대로 각각 발견된다', () => {
    const started = startDiscoveryExpedition();
    const encounter = rootEncounter();
    const first = applyBoundedEncounterChoice(started, encounter, 'anchor-root-ward', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 1,
    });
    const second = applyBoundedEncounterChoice(first.player, encounter, 'gather-root-crystal', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 2,
    });

    const returned = finishExpedition(second.player, '시작의 마을', 2_000, DB.QUESTS);
    assert.deepEqual(
        returned.summary.encounterDiscoveries.map(({ choiceId }) => choiceId),
        ['anchor-root-ward', 'gather-root-crystal'],
    );
});

test('foreign·malformed receipt는 버리고 같은 ledger의 유효한 발견은 보존한다', () => {
    const started = startDiscoveryExpedition();
    const encounter = rootEncounter();
    const settled = applyBoundedEncounterChoice(started, encounter, 'anchor-root-ward', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 1,
    });
    const player = {
        ...settled.player,
        eventChainProgress: {
            ...settled.player.eventChainProgress,
            boundedEncounterReceipts: {
                ...settled.player.eventChainProgress.boundedEncounterReceipts,
                'expedition-foreign-1:forest-root-resonance:1': {
                    encounterId: encounter.id,
                    choiceId: 'gather-root-crystal',
                },
                [`${started.activeExpedition.id}:forest-root-resonance:not-a-sequence`]: {
                    encounterId: encounter.id,
                    choiceId: 'gather-root-crystal',
                },
            },
        },
    };

    const returned = finishExpedition(player, '시작의 마을', 2_000, DB.QUESTS);
    assert.deepEqual(
        returned.summary.encounterDiscoveries.map(({ choiceId }) => choiceId),
        ['anchor-root-ward'],
    );
});

test('시작 직업이 없어도 summary 발견은 남지만 Class Journey는 생성하지 않는다', () => {
    const started = startDiscoveryExpedition();
    const encounter = rootEncounter();
    const settled = applyBoundedEncounterChoice(started, encounter, 'anchor-root-ward', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 1,
    });
    const withoutJob = {
        ...settled.player,
        activeExpedition: { ...settled.player.activeExpedition, job: undefined },
    };

    const returned = finishExpedition(withoutJob, '시작의 마을', 2_000, DB.QUESTS);
    assert.equal(returned.summary.encounterDiscoveries.length, 1);
    assert.equal(returned.player.classJourney, undefined);
});

test('receipt를 얻었어도 정상 귀환 전에는 영구 발견이 없고 귀환 replay는 exact no-op이다', () => {
    const started = startDiscoveryExpedition();
    const encounter = rootEncounter();
    const settled = applyBoundedEncounterChoice(started, encounter, 'anchor-root-ward', {
        expeditionId: started.activeExpedition.id,
        occurrenceSequence: 1,
    });
    assert.equal(settled.player.classJourney, undefined);

    const returned = finishExpedition(settled.player, '시작의 마을', 2_000, DB.QUESTS);
    const replayed = finishExpedition(returned.player, '시작의 마을', 3_000, DB.QUESTS);
    assert.equal(replayed.summary, null);
    assert.equal(replayed.player.classJourney, returned.player.classJourney);
    assert.equal(replayed.player.classJourney.sequence, 1);
});

test('원정 중 얻어 바로 장착한 접두 signature는 canonical 이름으로 남긴다', () => {
    const started = startExpedition(makePlayer({
        job: '전사',
        equip: {
            weapon: { name: '강철 롱소드', type: 'weapon' },
            armor: { name: '기사의 흉갑', type: 'armor' },
            offhand: null,
        },
    }), '고요한 숲', 1_000, DB.QUESTS);
    const fieldPlayer = {
        ...started,
        inv: [
            ...started.inv,
            { id: 'old-weapon', name: '강철 롱소드', type: 'weapon' },
        ],
        equip: {
            ...started.equip,
            weapon: {
                id: 'signature-prefixed',
                name: '날카로운 라그나로크',
                type: 'weapon',
                prefixed: true,
                prefixName: '날카로운',
            },
        },
    };

    const result = finishExpedition(fieldPlayer, '시작의 마을', 4_000, DB.QUESTS);

    assert.deepEqual(result.summary.signatureItems, ['라그나로크']);
    assert.deepEqual(result.player.classJourney.byJob['전사'].signatureItems, ['라그나로크']);
});

test('원정 전부터 보유한 signature를 inventory에서 장비로 옮겨도 새 획득이 아니다', () => {
    const signature = {
        id: 'signature-existing',
        name: '날카로운 라그나로크',
        type: 'weapon',
        prefixed: true,
        prefixName: '날카로운',
    };
    const started = startExpedition(makePlayer({
        job: '전사',
        inv: [signature],
        equip: {
            weapon: { name: '강철 롱소드', type: 'weapon' },
            armor: { name: '기사의 흉갑', type: 'armor' },
            offhand: null,
        },
    }), '고요한 숲', 1_000, DB.QUESTS);
    const fieldPlayer = {
        ...started,
        inv: [{ id: 'old-weapon', name: '강철 롱소드', type: 'weapon' }],
        equip: { ...started.equip, weapon: signature },
    };

    const result = finishExpedition(fieldPlayer, '시작의 마을', 4_000, DB.QUESTS);

    assert.deepEqual(result.summary.signatureItems, []);
    assert.deepEqual(result.player.classJourney.byJob['전사'].signatureItems, []);
});

test('SET_PLAYER 중앙 경로가 원정 중 최저 HP만 단조 감소로 추적한다', () => {
    const started = startExpedition(makePlayer({
        job: '전사',
        skillChoices: { 파워배시: 'A' },
        inv: [{ id: 'signature-existing', name: '라그나로크', type: 'weapon' }],
        equip: {
            weapon: { name: '강철 롱소드', type: 'weapon' },
            armor: { name: '기사의 흉갑', type: 'armor' },
            offhand: null,
        },
    }), '고요한 숲', 1_000, DB.QUESTS);
    const player = {
        ...started,
        activeExpedition: { ...started.activeExpedition, bossNames: ['숲의 군주'] },
    };
    const state = { ...INITIAL_STATE, player };
    const damaged = gameReducer(state, { type: AT.SET_PLAYER, payload: { hp: 75 } });
    const healed = gameReducer(damaged, { type: AT.SET_PLAYER, payload: { hp: 130 } });

    assert.equal(damaged.player.activeExpedition.lowestHp, 75);
    assert.equal(healed.player.activeExpedition.lowestHp, 75);
    for (const field of ['job', 'skillChoices', 'equipmentNames', 'bossNames', 'signatureItems']) {
        assert.deepEqual(healed.player.activeExpedition[field], player.activeExpedition[field]);
    }
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
