import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DAILY_TRIAL_REGIONS } from '../src/data/dailyTrial.ts';
import { DB } from '../src/data/db.ts';
import { RELICS } from '../src/data/relics.ts';
import { gateDailyTrialActions } from '../src/hooks/dailyTrialActions.ts';
import { createCombatActions } from '../src/hooks/useCombatActions.ts';
import { createGameActions } from '../src/hooks/useGameActions.ts';
import { createInventoryActions } from '../src/hooks/useInventoryActions.ts';
import { DAILY_TRIAL_STORAGE_KEY, clearDailyTrialSave, loadDailyTrialSave, saveDailyTrial } from '../src/platform/dailyTrialStorage.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { buildDailyTrialSave, canBeginDailyTrial, getMainGameState } from '../src/reducers/dailyTrial.ts';
import { GAME_SAVE_PRIMARY_KEY, GAME_SAVE_STAGED_KEY, LEGACY_GAME_SNAPSHOT_KEY } from '../src/platform/gameStorage.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import {
    buildDailyTrialPlayer,
    compareDailyTrialRecords,
    createDailyTrialField,
    getDailyTrialPlan,
    isDailyTrialUnlocked,
    readDailyTrialLedger,
    recordDailyTrial,
} from '../src/systems/dailyTrial.ts';
import { getFieldDoor } from '../src/systems/fieldDoor.ts';
import { isFieldTraitChoiceOpen } from '../src/systems/fieldTrait.ts';
import { isFirstChestRelicOpen } from '../src/systems/firstChestRelic.ts';
import { getFieldMapLayout, getFieldNeighbor, isFieldMapRegion } from '../src/systems/fieldMapWalk.ts';
import { getAreaBossName } from '../src/utils/bossGauge.ts';
import { canEquip } from '../src/utils/equipmentValidation.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import { getProtocolDayKey } from '../src/utils/protocolCycle.ts';
import { createSeededRandom } from '../src/utils/seededRandom.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

/**
 * 2026-11 오늘의 시련(H8) — 같은 날 누구나 같은 조건의 짧은 판. 본편은 시련 동안 통째로 보관되고 기록 장부 하나만 남는다.
 */

const NOW = new Date(2026, 10, 24, 12, 0, 0).getTime();
const DAY_KEY = getProtocolDayKey(new Date(NOW));
const NEXT_DAY_KEY = getProtocolDayKey(new Date(NOW + 86_400_000));
const dayKeys = (count) => Array.from({ length: count }, (_, index) => getProtocolDayKey(new Date(NOW + index * 86_400_000)));

const makeMain = (over = {}) => {
    const initial = structuredClone(INITIAL_STATE);
    return {
        ...initial,
        bootStage: 'ready',
        uid: 'owner-uid',
        syncStatus: 'synced',
        logs: [{ id: 'main-log', type: 'system', text: '본편 기록' }],
        quickSlots: [null, null, null],
        ...over,
        player: {
            ...initial.player,
            name: '여행자',
            gender: 'female',
            job: '전사',
            level: 17,
            exp: 321,
            gold: 4_321,
            loc: CONSTANTS.START_LOCATION,
            inv: [{ id: 'own-potion', name: '하급 체력 물약', type: 'hp', val: 50, price: 50 }],
            premiumCurrency: 12,
            meta: { ...initial.player.meta, essence: 777, prestigeRank: 1 },
            quests: [{ id: 1, progress: 2 }],
            ...over.player,
            stats: { ...initial.player.stats, total_gold: 9_999, kills: 55, ...(over.player?.stats ?? {}) },
        },
    };
};

/** 화면의 엔진과 같은 조립 — 액션 팩토리 · 시련 게이트 · 리듀서. */
const makeEngine = (initial, { seed = 1, onDispatch } = {}) => {
    let state = initial;
    let logCounter = 0;
    const rng = createSeededRandom(seed);
    const dispatch = (action) => {
        const prev = state;
        state = gameReducer(state, action);
        onDispatch?.(prev, action, state);
    };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { id: `t-${logCounter++}`, type, text } });
    const actions = () => {
        const deps = {
            player: state.player, gameState: state.gameState, uid: state.uid, grave: state.grave, currentEvent: state.currentEvent,
            isAiThinking: state.isAiThinking, enemy: state.enemy, liveConfig: state.liveConfig, dispatch, addLog,
            addStoryLog: () => {}, getFullStats: (player) => calculateFullStats(player ?? state.player),
        };
        const combatDeps = {
            ...deps, clearPendingCombat: () => {}, schedulePendingCombat: () => {}, claimCombatItem: () => true,
            claimCombatAction: () => true, combatTurn: state.combatTurn,
        };
        const all = { ...createGameActions(deps), ...createCombatActions(combatDeps), ...createInventoryActions(deps), dispatch };
        return state.dailyTrial ? gateDailyTrialActions(all, addLog) : all;
    };
    return { get state() { return state; }, dispatch, actions, rng };
};

const withRandom = async (seed, run) => {
    const real = Math.random;
    Math.random = createSeededRandom(seed);
    try { return await run(); } finally { Math.random = real; }
};

const begin = (engine, saved = null, now = NOW) => engine.dispatch({ type: AT.BEGIN_DAILY_TRIAL, payload: { now, saved } });

const DIRECTIONS = ['up', 'right', 'down', 'left'];

/** 목표 칸(상자 → 문 → 출구)으로 가는 다음 걸음 */
const nextStep = (state) => {
    const { player } = state;
    const mapData = DB.MAPS[player.loc];
    const field = player.fieldMap;
    const layout = getFieldMapLayout(field, mapData);
    const door = getFieldDoor(player, field.loc, mapData, layout);
    const chests = layout.chests.filter((chest) => !field.openedChests.includes(chest.id)).map((chest) => chest.index);
    const targets = new Set(chests.length ? chests : door !== null ? [door] : layout.exits.map((exit) => exit.index));
    const blocked = new Set([...layout.exits.map((exit) => exit.index), ...(door !== null ? [door] : [])].filter((index) => !targets.has(index)));
    if (targets.has(field.pos)) return DIRECTIONS.find((dir) => getFieldNeighbor(layout, field.pos, dir) !== null) ?? null;
    const first = new Map();
    const queue = [field.pos];
    const seen = new Set(queue);
    while (queue.length) {
        const here = queue.shift();
        if (targets.has(here)) return first.get(here);
        for (const dir of DIRECTIONS) {
            const next = getFieldNeighbor(layout, here, dir);
            if (next === null || seen.has(next) || blocked.has(next)) continue;
            seen.add(next);
            first.set(next, first.get(here) ?? dir);
            queue.push(next);
        }
    }
    return null;
};

/** 결과가 나올 때까지 실제 전이로 걷는다 — 조우 · 전투 · 사건 · 유물 · 물약 · 나가지 않는 손 정책. */
const playOut = async (engine, { maxTurns = 4_000, everyTurn } = {}) => {
    for (let turn = 0; turn < maxTurns && engine.state.gameState !== GS.TRIAL_RESULT; turn += 1) {
        everyTurn?.(turn);
        const { state } = engine;
        const actions = engine.actions();
        if (state.gameState === GS.TRIAL_RESULT) return;
        if (state.pendingRelics?.length) { engine.dispatch({ type: AT.ADD_RELIC, payload: state.pendingRelics[0] }); if (engine.state.pendingRelics) engine.dispatch({ type: AT.DECLINE_RELIC }); continue; }
        if (state.postCombatResult) { engine.dispatch({ type: AT.SET_POST_COMBAT_RESULT, payload: null }); continue; }
        if (state.gameState === GS.COMBAT) {
            const hurt = state.player.hp < calculateFullStats(state.player).maxHp * 0.4;
            const potion = hurt && turn % 3 === 0 ? state.player.inv.find((item) => item.type === 'hp') : null;
            if (potion) actions.combatUseItem(potion);
            else if (actions.getSelectedSkill()?.mult && turn % 2 === 0) actions.combat('skill');
            else actions.combat('attack');
            continue;
        }
        if (state.gameState === GS.EVENT) {
            actions.handleEventChoice(0);
            if (engine.state.gameState === GS.EVENT && engine.state.currentEvent?.choiceFeedback) engine.dispatch({ type: AT.LEAVE_EVENT });
            continue;
        }
        if (state.player.fieldMap?.pending) { await actions.processFieldPending(); continue; }
        const direction = nextStep(state);
        assert.ok(direction, '시련 지도에는 언제나 다음 걸음이 있다');
        engine.dispatch({ type: AT.FIELD_STEP, payload: { direction, auto: false, now: NOW + turn } });
    }
};

/** 본편에서 시련이 바꿔도 되는 것은 장부 · 저장 표시 · 화면 연출 · 기록 한 줄뿐이다. */
const comparableMain = (state) => {
    const { combatReceipt: _r, combatFeedback: _f, isAiThinking: _a, visualEffect: _v, presentationEpoch: _p, syncStatus: _s, logs: _l, dailyTrial: _d, player, ...rest } = state;
    const { dailyTrial: _ledger, ...stats } = player.stats;
    return JSON.stringify({ ...rest, player: { ...player, stats } });
};

test('같은 날짜는 같은 시작 상태이고 다른 날짜는 다르다 — 본편에서 가져오는 것은 이름 · 성별 · 설정뿐이다', () => {
    const rich = makeMain({ player: { level: 60, gold: 1_000_000, job: '대마법사', meta: { bonusAtk: 500, bonusHp: 3_000, prestigeRank: 7, essence: 10 } } });
    const poor = makeMain({ player: { level: 5, gold: 0 } });
    const strip = (player) => JSON.stringify({ ...player, name: '', gender: '', settings: {} });
    const build = (state, dayKey) => buildDailyTrialPlayer(INITIAL_STATE.player, state.player, dayKey);
    assert.equal(strip(build(rich, DAY_KEY)), strip(build(poor, DAY_KEY)));
    assert.equal(JSON.stringify(build(rich, DAY_KEY)), JSON.stringify(build(rich, DAY_KEY)));
    assert.equal(build(rich, DAY_KEY).name, '여행자');

    const starts = new Set(dayKeys(60).map((dayKey) => strip(build(poor, dayKey))));
    assert.equal(starts.size, 60, '날짜마다 시작 상태가 다르다');
    const plans = dayKeys(120).map(getDailyTrialPlan);
    assert.equal(new Set(plans.flatMap((plan) => plan.mapSeeds)).size, 360, '날짜 · 지도마다 지도 씨앗이 다르다');
    assert.ok(new Set(plans.map((plan) => plan.region)).size >= 8, '지역이 고르게 바뀐다');
    assert.ok(new Set(plans.map((plan) => plan.job)).size >= 6, '직업이 고르게 바뀐다');
});

test('고르기는 게임 난수를 쓰지 않는다', () => {
    const real = Math.random;
    let draws = 0;
    Math.random = () => { draws += 1; return 0.5; };
    try {
        buildDailyTrialPlayer(INITIAL_STATE.player, makeMain().player, DAY_KEY);
        getDailyTrialPlan(DAY_KEY);
        createDailyTrialField(DAY_KEY, 2);
        const engine = makeEngine(makeMain());
        begin(engine);
        assert.ok(engine.state.dailyTrial);
    } finally { Math.random = real; }
    assert.equal(draws, 0);
});

test('시작 조건은 그 레벨에서 실제로 쓸 수 있는 것이다 (지역 표 전부 × 120일)', () => {
    for (const { region } of DAILY_TRIAL_REGIONS) {
        assert.ok(isFieldMapRegion(region, DB.MAPS[region]), `${region}은 지도를 걷는 사냥 지역`);
        assert.ok(getAreaBossName(DB.MAPS[region]), `${region}의 구역 보스`);
    }
    for (const dayKey of dayKeys(120)) {
        const plan = getDailyTrialPlan(dayKey);
        const player = buildDailyTrialPlayer(INITIAL_STATE.player, makeMain().player, dayKey);
        const job = DB.CLASSES[plan.job];
        assert.ok(job.tier === 1 || job.tier === 2, `${plan.job} tier ${job.tier}`);
        assert.ok((job.reqLv || 1) <= plan.level);
        assert.equal(player.level, plan.level);
        assert.equal(player.relics.length, BALANCE.DAILY_TRIAL_RELICS);
        assert.ok(player.relics.every((relic) => RELICS.some((entry) => entry.id === relic.id)));
        assert.equal(new Set(player.relics.map((relic) => relic.id)).size, player.relics.length);
        assert.ok(player.equip.weapon && player.equip.armor, `${dayKey} ${plan.job} 무기 · 방어구`);
        for (const item of Object.values(player.equip).filter(Boolean)) {
            assert.ok(canEquip(item, player, {}).ok, `${dayKey} ${plan.job} ${item.name}`);
        }
        const full = calculateFullStats(player);
        assert.equal(player.hp, full.maxHp);
        assert.equal(player.mp, full.maxMp);
        assert.equal(new Set(plan.mapSeeds).size, BALANCE.DAILY_TRIAL_MAPS, '지도 세 장의 씨앗이 다르다');
    }
});

test('입구는 첫 전직 뒤 안전지대의 대기 상태에서만 열린다', () => {
    assert.equal(isDailyTrialUnlocked({ job: CONSTANTS.DEFAULT_JOB }), false);
    assert.equal(isDailyTrialUnlocked({ job: '전사' }), true);
    assert.equal(canBeginDailyTrial(makeMain()), true);
    const refused = [
        makeMain({ player: { job: CONSTANTS.DEFAULT_JOB } }),
        makeMain({ player: { loc: '고요한 숲' } }),
        ...Object.values(GS).filter((mode) => mode !== GS.IDLE).map((gameState) => makeMain({ gameState })),
        makeMain({ isAiThinking: true }),
        makeMain({ pendingRelics: [RELICS[0]] }),
        makeMain({ postCombatResult: { enemy: 'x' } }),
        makeMain({ currentEvent: { title: 'x', desc: 'y', choices: [] } }),
    ];
    for (const state of refused) {
        assert.equal(canBeginDailyTrial(state), false);
        assert.equal(gameReducer(state, { type: AT.BEGIN_DAILY_TRIAL, payload: { now: NOW } }), state, '거부는 동일 참조');
    }
});

test('시련 시작 → 온갖 행동 → 끝: 걷는 동안 보관한 본편은 같은 참조이고, 끝나면 기록 장부만 다르다 (실제 전이 12판)', async () => {
    const outcomes = new Set();
    let fights = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
        const main = makeMain();
        const before = comparableMain(main);
        const engine = makeEngine(main, {
            seed,
            onDispatch: (prev, action, next) => {
                if (!prev.dailyTrial || action.type === AT.END_DAILY_TRIAL) return;
                if (prev.gameState !== GS.COMBAT && next.gameState === GS.COMBAT) fights += 1;
                assert.equal(getMainGameState(next), getMainGameState(prev), `${action.type}이 보관한 본편을 바꿨다`);
                if (next.dailyTrial) assert.deepEqual(next.combatReceipt?.stories ?? [], [], '서사 호출(AI)의 재료가 없다');
            },
        });
        begin(engine, null, NOW + seed * 86_400_000);
        assert.equal(getMainGameState(engine.state), main, '본편은 통째로 보관된다');
        await withRandom(seed, () => playOut(engine, {
            everyTurn: (turn) => {
                // 시련 화면이 부를 수 있는 온갖 행동 — 가방 · 빠른 칸 · 설정 · 기록 탭 · 강화 · 막힌 본편 액션.
                if (turn % 17 !== 3) return;
                const actions = engine.actions();
                for (const key of ['move', 'explore', 'rest', 'openShop', 'acceptQuest', 'requestBounty', 'claimAchievement', 'claimSeasonReward',
                    'market', 'craft', 'purchaseMirrorNode', 'confirmAscension', 'reset', 'lootGrave', 'setActiveTitle', 'purchaseRevive']) actions[key]?.(1);
                engine.dispatch({ type: AT.SET_SIDE_TAB, payload: 'inventory' });
                engine.dispatch({ type: AT.SET_QUICK_SLOT, payload: { index: 0, item: engine.state.player.inv[0] ?? null } });
                engine.dispatch({ type: AT.SET_PLAYER, payload: (player) => ({ settings: { ...player.settings, combatSpeed: 'fast' } }) });
                if (engine.state.player.equip.weapon?.id) engine.dispatch({ type: AT.ENHANCE_ITEM, payload: { itemId: engine.state.player.equip.weapon.id, roll: 0 } });
                engine.dispatch({ type: AT.CLAIM_WEEKLY_MISSION, payload: { missionId: 'x' } });
                engine.dispatch({ type: AT.ADD_SEASON_XP, payload: 9_999 });
                engine.dispatch({ type: AT.SET_GAME_STATE, payload: GS.SHOP });
                engine.dispatch({ type: AT.SET_GAME_STATE, payload: GS.ASCENSION });
                assert.ok([GS.IDLE, GS.COMBAT, GS.EVENT, GS.TRIAL_RESULT].includes(engine.state.gameState), engine.state.gameState);
            },
        }));
        if (engine.state.gameState !== GS.TRIAL_RESULT) engine.dispatch({ type: AT.ABANDON_DAILY_TRIAL });
        assert.equal(engine.state.gameState, GS.TRIAL_RESULT);
        assert.notEqual(engine.state.dailyTrial.result.outcome, 'left', `${seed}: ${JSON.stringify({ map: engine.state.player.trialRun, pos: engine.state.player.fieldMap?.pos, pending: engine.state.player.fieldMap?.pending, loc: engine.state.player.loc, logs: engine.state.logs.slice(-8).map((l) => l.text) })}`);
        outcomes.add(engine.state.dailyTrial.result.outcome);
        const { result, dayKey } = engine.state.dailyTrial;
        engine.dispatch({ type: AT.END_DAILY_TRIAL, payload: { now: NOW } });
        assert.equal(engine.state.dailyTrial, null);
        assert.equal(comparableMain(engine.state), before, '본편은 바이트 동일하다(기록 장부 제외)');
        const day = engine.state.player.stats.dailyTrial.days.find((entry) => entry.day === dayKey);
        assert.equal(day.tries, 1);
        assert.deepEqual(day.best, { cleared: result.cleared, maps: result.maps, actions: result.actions });
        assert.ok(result.actions > 0);
        assert.equal(JSON.stringify(engine.state.player.stats.dailyTrial).includes('undefined'), false);
    }
    assert.ok(fights > 30, `실제로 싸웠다(${fights})`);
    assert.ok(outcomes.has('dead') || outcomes.has('cleared'), [...outcomes].join());
});

test('모든 액션 종류가 시련 중 보관한 본편을 바꾸지 않는다 — 세션 전이만 본편에 닿는다', () => {
    const SESSION = new Set([AT.SET_BOOT_STAGE, AT.SET_UID, AT.LOAD_DATA, AT.SET_LIVE_CONFIG, AT.SET_LEADERBOARD, AT.SET_SYNC_STATUS]);
    for (const type of Object.values(AT)) {
        if (SESSION.has(type) || type === AT.END_DAILY_TRIAL) continue;
        const engine = makeEngine(makeMain());
        begin(engine);
        const before = getMainGameState(engine.state);
        for (const payload of [undefined, null, 1, 'x', {}, { id: 1, itemId: 'x', now: NOW, seed: 1 }]) {
            let next;
            try { next = gameReducer(engine.state, { type, payload }); } catch { continue; }
            assert.equal(getMainGameState(next), before, type);
        }
    }
});

test('세션 전이(동기화 · 로그인 · 순위표)는 보관한 본편에 적용되고, 운영 설정은 시련에 비치지 않는다', () => {
    const engine = makeEngine(makeMain());
    begin(engine);
    engine.dispatch({ type: AT.SET_SYNC_STATUS, payload: 'syncing' });
    assert.equal(getMainGameState(engine.state).syncStatus, 'syncing');
    assert.equal(engine.state.syncStatus, 'syncing', '저장 배지는 본편의 것을 비춘다');
    engine.dispatch({ type: AT.SET_LIVE_CONFIG, payload: { seasonEvent: { active: true, name: 'x', expMult: 9, goldMult: 9 } } });
    assert.equal(getMainGameState(engine.state).liveConfig.seasonEvent.active, true);
    assert.deepEqual(engine.state.liveConfig, INITIAL_STATE.liveConfig, '같은 날 누구나 같은 조건');
    assert.ok(engine.state.dailyTrial, '시련은 이어진다');
    engine.dispatch({ type: AT.ABANDON_DAILY_TRIAL });
    engine.dispatch({ type: AT.END_DAILY_TRIAL, payload: { now: NOW } });
    assert.equal(engine.state.liveConfig.seasonEvent.active, true);
});

test('쓰러지면 묘비 · 여정 요약 · 영구 상태 선별이 본편에 닿지 않는다', () => {
    const main = makeMain();
    const engine = makeEngine(main);
    begin(engine);
    const deaths = getMainGameState(engine.state).player.stats.deaths ?? 0;
    engine.dispatch({ type: AT.SET_GAME_STATE, payload: GS.DEAD });
    assert.equal(engine.state.gameState, GS.TRIAL_RESULT);
    assert.equal(engine.state.dailyTrial.result.outcome, 'dead');
    assert.equal(engine.state.grave, null);
    assert.equal(engine.state.runSummary, null);
    engine.dispatch({ type: AT.END_DAILY_TRIAL, payload: { now: NOW } });
    assert.equal(engine.state.player.stats.deaths ?? 0, deaths);
    assert.equal(engine.state.grave, main.grave);
    assert.equal(engine.state.player.level, 17);
});

test('시련 안의 도감 · 전설 각인 · 시즌 · 업적 · 칭호 · 정수는 본편에 남지 않는다 — 시련에서 실제로 얻은 뒤 되돌린다', async () => {
    const main = makeMain();
    const engine = makeEngine(main);
    begin(engine);
    const signature = DB.ITEMS.weapons.find((item) => item.name === '라그나로크');
    assert.ok(signature);
    engine.dispatch({ type: AT.SET_PLAYER, payload: (player) => ({ inv: [...player.inv, { ...signature, id: 'trial-sig' }] }) });
    await withRandom(3, () => playOut(engine, { maxTurns: 300 }));
    const trialStats = engine.state.player.stats;
    assert.ok(trialStats.kills > 0 && Object.keys(trialStats.killRegistry).length > 0, '시련 안에서는 처치 · 도감 정산이 돈다');
    assert.ok(engine.state.player.inv.some((item) => item.id === 'trial-sig'), '시련 안에서 각인을 실제로 가졌다');
    engine.dispatch({ type: AT.ABANDON_DAILY_TRIAL });
    engine.dispatch({ type: AT.END_DAILY_TRIAL, payload: { now: NOW } });
    const { player } = engine.state;
    assert.deepEqual(player.stats.codex, main.player.stats.codex);
    assert.deepEqual(player.stats.signatureLedger, main.player.stats.signatureLedger);
    assert.deepEqual(player.seasonPass, main.player.seasonPass);
    assert.deepEqual(player.titles, main.player.titles);
    assert.deepEqual(player.meta, main.player.meta);
    assert.equal(player.premiumCurrency, main.player.premiumCurrency);
    assert.equal(player.stats.kills, main.player.stats.kills);
    assert.equal(player.stats.total_gold, main.player.stats.total_gold);
    assert.deepEqual(engine.state.legendaryAcquisitions, main.legendaryAcquisitions, '전설 획득 화면도 본편의 것이다');
});

test('지도 세 장: 출구는 다음 지도이고, 마지막 지도는 출구 없이 보스 문이 열려 있다', async () => {
    const engine = makeEngine(makeMain());
    begin(engine);
    const plan = getDailyTrialPlan(DAY_KEY);
    for (let map = 1; map <= BALANCE.DAILY_TRIAL_MAPS; map += 1) {
        const { player } = engine.state;
        assert.equal(player.loc, plan.region);
        assert.equal(player.trialRun.map, map);
        assert.equal(player.fieldMap.seed, plan.mapSeeds[map - 1]);
        const layout = getFieldMapLayout(player.fieldMap, DB.MAPS[plan.region]);
        const door = getFieldDoor(player, plan.region, DB.MAPS[plan.region], layout);
        if (map < BALANCE.DAILY_TRIAL_MAPS) {
            assert.equal(door, null, '앞 지도에는 문이 없다');
            assert.equal(layout.exits.length, 1);
            // 위험 걸음을 지우고 출구까지 곧장 걷는다 — 출구 전이만 본다.
            for (let guard = 0; guard < 2_000 && engine.state.player.trialRun.map === map; guard += 1) {
                engine.dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ fieldMap: { ...p.fieldMap, danger: 0, pending: null, openedChests: layout.chests.map((chest) => chest.id) } }) });
                engine.dispatch({ type: AT.FIELD_STEP, payload: { direction: nextStep(engine.state), auto: false, now: NOW + guard } });
            }
        } else {
            assert.equal(layout.exits.length, 0, '마지막 지도는 나갈 출구가 없다');
            assert.notEqual(door, null, '보스 문이 처음부터 열려 있다');
        }
    }
});

test('보스를 쓰러뜨리면 완주다 — 깬 지도는 셋이고 본편의 구역 보스 기록은 그대로다', () => {
    const main = makeMain();
    const engine = makeEngine(main);
    begin(engine);
    const plan = getDailyTrialPlan(DAY_KEY);
    engine.dispatch({ type: AT.SET_PLAYER, payload: (player) => ({
        trialRun: { dayKey: DAY_KEY, map: 3 },
        stats: { ...player.stats, areaBossDefeated: { [plan.bossName]: true } },
    }) });
    assert.deepEqual(engine.state.dailyTrial.result, { outcome: 'cleared', cleared: true, maps: 3, actions: 0 });
    const frozen = engine.state;
    for (const action of [
        { type: AT.SET_GAME_STATE, payload: GS.IDLE },
        { type: AT.ABANDON_DAILY_TRIAL },
        { type: AT.FIELD_STEP, payload: { direction: 'up', now: NOW } },
    ]) assert.equal(gameReducer(frozen, action), frozen, '결과가 나온 판은 더 걷지 않는다');
    engine.dispatch({ type: AT.END_DAILY_TRIAL, payload: { now: NOW } });
    assert.deepEqual(engine.state.player.stats.areaBossDefeated, main.player.stats.areaBossDefeated);
    assert.equal(engine.state.player.stats.dailyTrial.days[0].best.cleared, true);
});

test('끝은 결과가 나온 판만 본편으로 돌아간다', () => {
    const engine = makeEngine(makeMain());
    begin(engine);
    const walking = engine.state;
    assert.equal(gameReducer(walking, { type: AT.END_DAILY_TRIAL, payload: { now: NOW } }), walking);
    const main = makeMain();
    assert.equal(gameReducer(main, { type: AT.END_DAILY_TRIAL, payload: { now: NOW } }), main, '본편에는 끝낼 시련이 없다');
    assert.equal(gameReducer(main, { type: AT.ABANDON_DAILY_TRIAL }), main);
});

// ── 기록 ────────────────────────────────────────────────────────────────

test('기록은 완주 여부 → 깬 지도 수 → 행동 수 순서이고, 하루의 최고만 남는다', () => {
    const order = [
        { cleared: true, maps: 3, actions: 100 },
        { cleared: true, maps: 3, actions: 180 },
        { cleared: false, maps: 2, actions: 20 },
        { cleared: false, maps: 2, actions: 90 },
        { cleared: false, maps: 1, actions: 5 },
    ];
    for (let left = 0; left < order.length; left += 1) {
        for (let right = left + 1; right < order.length; right += 1) assert.ok(compareDailyTrialRecords(order[left], order[right]) < 0);
    }
    let ledger = { days: [] };
    ledger = recordDailyTrial(ledger, DAY_KEY, { outcome: 'dead', ...order[3] });
    ledger = recordDailyTrial(ledger, DAY_KEY, { outcome: 'cleared', ...order[1] });
    ledger = recordDailyTrial(ledger, DAY_KEY, { outcome: 'dead', ...order[2] });
    ledger = recordDailyTrial(ledger, DAY_KEY, { outcome: 'left', cleared: false, maps: 2, actions: 1 });
    assert.deepEqual(ledger.days, [{ day: DAY_KEY, tries: 4, best: order[1] }]);
    ledger = recordDailyTrial(ledger, NEXT_DAY_KEY, { outcome: 'left', cleared: false, maps: 0, actions: 3 });
    assert.deepEqual(ledger.days[1], { day: NEXT_DAY_KEY, tries: 1, best: null }, '포기한 판은 최고에 들지 않는다');
    for (const dayKey of dayKeys(BALANCE.DAILY_TRIAL_LEDGER_DAYS + 5)) ledger = recordDailyTrial(ledger, dayKey, { outcome: 'dead', ...order[4] });
    assert.equal(ledger.days.length, BALANCE.DAILY_TRIAL_LEDGER_DAYS);
});

test('장부는 계정 범위다 — 사망 · 계승을 넘고, 알아볼 수 없는 줄은 버린다', () => {
    const ledger = { days: [{ day: DAY_KEY, tries: 2, best: { cleared: true, maps: 3, actions: 120 } }] };
    const main = makeMain({ player: { stats: { dailyTrial: ledger } } });
    for (const kind of ['death', 'ascension']) {
        assert.deepEqual(pickPermanentPlayerState(main.player, INITIAL_STATE.player, kind).stats.dailyTrial, ledger, kind);
    }
    assert.equal('trialRun' in pickPermanentPlayerState({ ...main.player, trialRun: { dayKey: DAY_KEY, map: 1 } }, INITIAL_STATE.player, 'death'), false);
    assert.deepEqual(readDailyTrialLedger({ dailyTrial: { days: [{ day: 'x' }, null, { day: DAY_KEY, tries: -3, best: 'y' }] } }).days, [{ day: DAY_KEY, tries: 0, best: null }]);
    assert.deepEqual(readDailyTrialLedger(undefined), { days: [] });
});

// ── 저장 칸 ──────────────────────────────────────────────────────────────

const makeStorage = () => {
    const map = new Map();
    const writes = [];
    return {
        writes, map,
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => { writes.push(key); map.set(key, String(value)); },
        removeItem: (key) => { writes.push(`-${key}`); map.delete(key); },
    };
};

test('시련은 자기 칸에만 쓰고, 다시 열면 그 판을 그대로 잇는다', async () => {
    const storage = makeStorage();
    const engine = makeEngine(makeMain(), { seed: 5 });
    begin(engine);
    await withRandom(5, () => playOut(engine, { maxTurns: 120 }));
    assert.notEqual(engine.state.gameState, GS.TRIAL_RESULT, '아직 걷는 판');
    const paused = engine.state;
    assert.equal(saveDailyTrial(buildDailyTrialSave(paused), storage), true);
    assert.deepEqual([...new Set(storage.writes)], [DAILY_TRIAL_STORAGE_KEY]);
    assert.ok(![GAME_SAVE_PRIMARY_KEY, GAME_SAVE_STAGED_KEY, LEGACY_GAME_SNAPSHOT_KEY].includes(DAILY_TRIAL_STORAGE_KEY), '본편 저장 칸과 다른 칸이다');
    assert.equal(JSON.stringify([...storage.map.values()]).includes('own-potion'), false, '본편 상태는 칸에 싣지 않는다');

    const saved = loadDailyTrialSave(DAY_KEY, storage);
    // 앱을 다시 열었다 — 본편은 정상 부팅하고(시련을 모른다) 입구에서 잇는다.
    const reopened = makeEngine(makeMain({ player: { name: '새 이름' } }));
    begin(reopened, saved);
    const { state } = reopened;
    assert.equal(state.dailyTrial.actions, paused.dailyTrial.actions);
    assert.equal(state.gameState, paused.gameState);
    assert.deepEqual(state.player.trialRun, paused.player.trialRun);
    assert.deepEqual(state.player.fieldMap, paused.player.fieldMap);
    assert.equal(state.player.hp, paused.player.hp);
    // 본편 불러오기와 같은 정규화(강화 단계 0을 채운다)를 거친다.
    const normalized = (item) => (item ? { ...item, enhance: item.enhance ?? 0 } : item);
    assert.deepEqual(state.player.inv.map(normalized), paused.player.inv.map(normalized));
    assert.deepEqual(Object.values(state.player.equip).map(normalized), Object.values(paused.player.equip).map(normalized));
    assert.deepEqual(state.player.relics.map((relic) => relic.id), paused.player.relics.map((relic) => relic.id));
    assert.equal(state.player.name, '새 이름', '이름은 지금 본편의 것이다');
    await withRandom(6, () => playOut(reopened));
    assert.equal(reopened.state.gameState, GS.TRIAL_RESULT, '이은 판도 끝까지 걷는다');
});

test('결과가 나온 채 닫은 판은 결과 화면에서 이어진다 — 다시 걸어 결과를 바꿀 수 없다', () => {
    const storage = makeStorage();
    const engine = makeEngine(makeMain());
    begin(engine);
    engine.dispatch({ type: AT.SET_GAME_STATE, payload: GS.DEAD });
    saveDailyTrial(buildDailyTrialSave(engine.state), storage);
    const reopened = makeEngine(makeMain());
    begin(reopened, loadDailyTrialSave(DAY_KEY, storage));
    assert.equal(reopened.state.gameState, GS.TRIAL_RESULT);
    assert.deepEqual(reopened.state.dailyTrial.result, engine.state.dailyTrial.result);
});

test('다른 날짜 · 깨진 칸 · 막힌 저장소는 이어 하기가 없을 뿐이다', () => {
    const storage = makeStorage();
    const engine = makeEngine(makeMain());
    begin(engine);
    saveDailyTrial(buildDailyTrialSave(engine.state), storage);
    assert.equal(loadDailyTrialSave(NEXT_DAY_KEY, storage), null);
    storage.map.set(DAILY_TRIAL_STORAGE_KEY, '{not json');
    assert.equal(loadDailyTrialSave(DAY_KEY, storage), null);
    const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    assert.equal(loadDailyTrialSave(DAY_KEY, throwing), null);
    assert.equal(saveDailyTrial(buildDailyTrialSave(engine.state), throwing), false);
    assert.doesNotThrow(() => clearDailyTrialSave(throwing));
    // 다른 날짜의 칸을 억지로 넘겨도 오늘의 새 판이다.
    const fresh = makeEngine(makeMain());
    begin(fresh, { ...buildDailyTrialSave(engine.state), dayKey: NEXT_DAY_KEY, actions: 99 });
    assert.equal(fresh.state.dailyTrial.actions, 0);
    assert.equal(buildDailyTrialSave(makeMain()), null, '본편에는 시련 봉투가 없다');
});

test('저장 · 업로드 · 텔레메트리는 시련 상태를 받지 않는다 (부재 불변식)', () => {
    const engine = readFileSync(new URL('../src/hooks/useGameEngine.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(engine, /useFirebaseSync\(\s*state\b/);
    assert.doesNotMatch(engine, /useProductTelemetry\(\s*state\b/);
    assert.doesNotMatch(engine, /useDimensionGravePool\(\s*uid\b/);
});

test('시련에서는 지도 갈래 · 첫 여정 첫 상자의 유물이 열리지 않는다 — 조건이 맞는 시련 플레이어도 같다 (본편은 열린다)', () => {
    const main = makeMain();
    const trial = gameReducer(main, { type: AT.BEGIN_DAILY_TRIAL, payload: { now: NOW, saved: null } });
    const { player } = trial;
    // 자격의 나머지 조건을 모두 맞춘 시련 플레이어 — 시련 표시 하나만 다르다.
    const eligible = { ...player, relics: [], fieldClearedRegions: [player.loc] };
    const { trialRun, ...asMain } = eligible;
    assert.ok(trialRun);
    assert.equal(isFieldTraitChoiceOpen(asMain), true, '본편이면 고를 수 있는 상태여야 비교가 된다');
    assert.equal(isFieldTraitChoiceOpen(eligible), false);
    assert.equal(isFirstChestRelicOpen(asMain), true, '본편이면 열리는 상태여야 비교가 된다');
    assert.equal(isFirstChestRelicOpen(eligible), false);

    const forced = { ...trial, player: eligible };
    for (const trait of ['plain', 'elite', 'chest', 'event', 'quiet']) {
        assert.equal(gameReducer(forced, { type: AT.FIELD_CHOOSE_TRAIT, payload: { seq: player.fieldMap.seq, trait, now: NOW } }), forced);
    }
});
