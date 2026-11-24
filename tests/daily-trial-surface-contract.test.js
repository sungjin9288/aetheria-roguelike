import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ControlPanel from '../src/components/ControlPanel.tsx';
import Dashboard from '../src/components/Dashboard.tsx';
import DailyTrialResult from '../src/components/trial/DailyTrialResult.tsx';
import DailyTrialSheet from '../src/components/trial/DailyTrialSheet.tsx';
import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { buildDailyTrialPlayer, createDailyTrialField } from '../src/systems/dailyTrial.ts';
import { grantFieldChestReward, isFieldChestMimic } from '../src/systems/fieldChest.ts';
import { getFieldEncounterThreshold, getFieldMapLayout, getFieldNeighbor } from '../src/systems/fieldMapWalk.ts';
import { getDailyTrialView } from '../src/utils/dailyTrialView.ts';
import { getExpeditionHudChips } from '../src/utils/expeditionHud.ts';
import { getProtocolDayKey } from '../src/utils/protocolCycle.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { addSeasonXp } from '../src/reducers/handlers/helpers.ts';
import { AI_SERVICE } from '../src/services/aiService.ts';
import { recordEliteEncounter } from '../src/utils/eliteTitles.ts';
import { checkTitles } from '../src/utils/gameUtils.ts';
import { runNaturalPlay } from '../scripts/naturalPlay/driver.mjs';
import { makePlayerFixture, renderStatic, sliceElementByTestId } from './helpers/render.ts';

/** 2026-11 오늘의 시련 — 화면(입구 · 조작판 · 기록)과 시련 안의 규칙(미믹 없음 · 촘촘한 조우 · 정수 없음). 격리의 정본은 daily-trial-contract. */

const NOW = new Date(2026, 10, 24, 12, 0, 0).getTime();
const DAY_KEY = getProtocolDayKey(new Date(NOW));
const dayKeys = (count) => Array.from({ length: count }, (_, index) => getProtocolDayKey(new Date(NOW + index * 86_400_000)));
const OWNER = { name: '여행자', gender: 'female', settings: INITIAL_STATE.player.settings };
const trialPlayer = (dayKey = DAY_KEY) => buildDailyTrialPlayer(INITIAL_STATE.player, OWNER, dayKey);
const noop = () => {};
const CONTROLS = { begin: noop, dayKey: () => DAY_KEY, peek: () => null };

const renderPanel = (player) => renderStatic(createElement(ControlPanel, {
    gameState: GS.IDLE, player, enemy: null, actions: {}, setGameState: noop, onOpenMirror: noop, onOpenCrystalExchange: noop,
    onOpenDailyTrial: noop, shopItems: [], grave: null, isAiThinking: false, currentEvent: null,
    stats: calculateFullStats(player), onOpenArchiveConsole: noop,
}));

const goldButtons = (html) => (html.match(/data-variant="primary"/gu) ?? []).length;

test('입구는 첫 전직 뒤 마을 시설 한 칸이다', () => {
    const town = (job) => renderPanel(makePlayerFixture({ name: '여행자', job, loc: CONSTANTS.START_LOCATION, level: 8 }));
    assert.ok(!town(CONSTANTS.DEFAULT_JOB).includes('control-daily-trial'));
    const opened = town('전사');
    assert.ok(opened.includes('data-testid="control-daily-trial"'));
    assert.match(sliceElementByTestId(opened, 'control-daily-trial'), /오늘의 시련/u);
});

test('시련의 조작판에는 자동 걷기 · 가방뿐이다 — 이동 · 지도 · 정찰 · 탐험 · 마을 시설이 없다', () => {
    const html = renderPanel(trialPlayer());
    assert.ok(html.includes('data-testid="daily-trial-dock"'));
    assert.ok(html.includes('data-testid="field-walk-start"'));
    assert.ok(html.includes('data-testid="control-open-bag"'));
    for (const id of ['control-move', 'control-map-open', 'control-scout', 'control-explore', 'control-town-facilities', 'control-daily-trial', 'field-auto-start', 'control-quests']) {
        assert.ok(!html.includes(`data-testid="${id}"`), id);
    }
});

test('시련의 기록은 장비 · 가방 · 기술 · 상태 탭뿐이고, 다른 탭을 고른 채 들어와도 가방이 열린다', () => {
    const player = trialPlayer();
    const tabsOf = (target, sideTab) => {
        const html = renderStatic(createElement(Dashboard, {
            player: target, grave: null, sideTab, setSideTab: noop, actions: {}, stats: calculateFullStats(target), mobileFocused: true,
        }));
        return [...html.matchAll(/data-testid="archive-tab-([a-z]+)"(?=[^>]*)/gu)].map((match) => match[1])
            .filter((id) => id !== 'rail').sort();
    };
    assert.deepEqual([...new Set(tabsOf(player, 'quest'))], ['equipment', 'inventory', 'skills', 'stats']);
    // 판별: 여정의 기록에는 임무 · 설정 탭이 있다.
    const main = tabsOf(makePlayerFixture({ name: '여행자', job: '전사', loc: CONSTANTS.START_LOCATION }), 'quest');
    assert.ok(main.includes('quest') && main.includes('system'));
});

test('입구 시트의 조건은 실제 시작 플레이어와 같다 (60일)', () => {
    for (const dayKey of dayKeys(60)) {
        const start = trialPlayer(dayKey);
        const view = getDailyTrialView(INITIAL_STATE.player, makePlayerFixture({ ...OWNER, job: '전사' }), dayKey);
        const values = (key) => view.rows.find((row) => row.key === key).values;
        assert.deepEqual(values('region'), [start.loc]);
        assert.deepEqual(values('job'), [start.job, `레벨 ${start.level}`]);
        assert.equal(values('relics').length, start.relics.length);
        const gear = [start.equip.weapon, start.equip.armor, start.equip.offhand].filter(Boolean);
        assert.deepEqual(values('gear'), gear.map((item) => (item.enhance ? `${item.name} +${item.enhance}` : item.name)));
        const counted = values('supplies').reduce((sum, text) => sum + Number(text.match(/(\d+)개$/u)[1]), 0);
        assert.equal(counted, start.inv.length);
    }
});

test('시련의 입구 시트와 결과 화면의 금빛 주 행동은 하나다 (나가기 확인은 포털이라 e2e가 센다)', () => {
    const player = makePlayerFixture({ name: '여행자', job: '전사', loc: CONSTANTS.START_LOCATION });
    const main = { ...structuredClone(INITIAL_STATE), player };
    assert.equal(goldButtons(renderStatic(createElement(DailyTrialSheet, { player, controls: CONTROLS, onClose: noop }))), 1);
    for (const outcome of ['cleared', 'dead', 'left']) {
        const slot = { dayKey: DAY_KEY, main, actions: 12, result: { outcome, cleared: outcome === 'cleared', maps: outcome === 'cleared' ? 3 : 1, actions: 12 } };
        const html = renderStatic(createElement(DailyTrialResult, { slot, onReturn: noop }));
        assert.equal(goldButtons(html), 1, outcome);
        assert.equal(html.includes('daily-trial-result-best'), outcome !== 'left', `${outcome} 최고 기록`);
    }
});

test('시련에는 미믹이 없다 — 미믹이 될 상자도 보통 상자로 열린다 (본편에서는 깨어난다)', () => {
    let checked = 0;
    for (const dayKey of dayKeys(150)) {
        const field = createDailyTrialField(dayKey, 1);
        const mapData = DB.MAPS[field.loc];
        const layout = getFieldMapLayout(field, mapData);
        const chest = layout.chests.find((entry) => isFieldChestMimic(field.loc, field.seed, entry.id)
            && ['up', 'right', 'down', 'left'].some((direction) => getFieldNeighbor(layout, entry.index, direction) !== null));
        if (!chest) continue;
        const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
        const away = ['up', 'right', 'down', 'left'].find((direction) => {
            const index = getFieldNeighbor(layout, chest.index, direction);
            return index !== null && !layout.chests.some((entry) => entry.index === index) && !layout.exits.some((exit) => exit.index === index);
        });
        if (!away) continue;
        const pos = getFieldNeighbor(layout, chest.index, away);
        const begun = gameReducer({
            ...structuredClone(INITIAL_STATE), bootStage: 'ready',
            player: makePlayerFixture({ name: '여행자', job: '전사', level: 10, loc: CONSTANTS.START_LOCATION }),
        }, { type: AT.BEGIN_DAILY_TRIAL, payload: { now: new Date(`${dayKey}T12:00:00`).getTime(), saved: null } });
        const standing = { ...begun, player: { ...begun.player, fieldMap: { ...field, pos, visited: [pos], danger: 0 } } };
        const next = gameReducer(standing, { type: AT.FIELD_STEP, payload: { direction: opposite[away], now: NOW } });
        assert.ok(next.player.fieldMap.openedChests.includes(chest.id), `${dayKey} 상자`);
        assert.notEqual(next.player.fieldMap.pending?.kind, 'mimic', dayKey);
        checked += 1;
    }
    assert.ok(checked >= 10, `미믹 상자 ${checked}개`);
});

test('조우 문턱은 시련에서만 3 ~ 4이고 본편은 그대로다', () => {
    const player = trialPlayer();
    for (let explores = 0; explores < 200; explores += 1) {
        const stats = { ...player.stats, explores };
        const trial = getFieldEncounterThreshold({ ...player, stats }, player.loc);
        assert.ok(trial >= BALANCE.DAILY_TRIAL_ENCOUNTER_MIN && trial <= BALANCE.DAILY_TRIAL_ENCOUNTER_MAX);
        const main = getFieldEncounterThreshold({ stats }, player.loc);
        assert.ok(main >= BALANCE.FIELD_ENCOUNTER_MIN && main <= BALANCE.FIELD_ENCOUNTER_MAX);
    }
});

test('시련의 상자 소모품은 골드로 바뀌지 않는다 (본편은 가진 종류면 골드다)', () => {
    const player = trialPlayer();
    const potion = player.inv[0].name;
    const reward = { gold: 10, items: [potion] };
    const trial = grantFieldChestReward(player, reward, () => 0.5, NOW);
    assert.equal(trial.player.inv.length, player.inv.length + 1);
    const main = grantFieldChestReward({ ...player, trialRun: undefined }, reward, () => 0.5, NOW);
    assert.equal(main.player.inv.length, player.inv.length);
});

test('시련의 승리에는 계승 정수가 없고 보스 접근 게이지 · 장 번호를 보이지 않는다', () => {
    const player = trialPlayer();
    const enemy = { name: '표적', baseName: '표적', level: 10, hp: 0, maxHp: 10, atk: 1, def: 0, exp: 400, gold: 10 };
    const win = (target) => CombatEngine.handleVictory(target, enemy, 1, {}, {}, [], () => 0.99);
    const trial = win(player);
    assert.equal(trial.updatedPlayer.meta?.essence ?? 0, player.meta?.essence ?? 0);
    assert.ok(!trial.logs.some((log) => /계승 정수/u.test(log.text)));
    const main = win({ ...player, trialRun: undefined });
    assert.ok((main.updatedPlayer.meta?.essence ?? 0) > (player.meta?.essence ?? 0));
    assert.deepEqual(getExpeditionHudChips(player).filter((chip) => chip.id === 'bossGauge'), []);
    assert.equal(getExpeditionHudChips({ ...player, trialRun: undefined }).filter((chip) => chip.id === 'bossGauge').length, 1);
});

test('드라이버의 시련 한 판은 결정론이고 실제로 끝난다 (같은 시드 = 같은 결과)', async () => {
    const run = () => runNaturalPlay({ seed: 2, jobPath: ['전사'], runs: 1, maxSteps: 4000, field: 'all', trialDay: '2026-12-01' });
    const first = await run();
    assert.ok(first.trial.result, '결과');
    assert.deepEqual((await run()).trial, first.trial);
});

test('시련의 획득은 장부를 남기지 않는다 — 시즌 경험 · 칭호 · 정예 목격 칭호 · 전설 각인 (본편 플레이어는 남긴다)', () => {
    const trial = trialPlayer();
    const main = { ...trial, trialRun: undefined };
    assert.equal(addSeasonXp(trial, 50), trial);
    assert.notEqual(addSeasonXp(main, 50), main);
    const veteran = (player) => ({ ...player, stats: { ...player.stats, kills: 99_999, bossKills: 999, explores: 99_999, deaths: 99 } });
    assert.deepEqual(checkTitles(veteran(trial)), []);
    assert.ok(checkTitles(veteran(main)).length > 0);
    assert.equal(recordEliteEncounter(trial, { isElite: true }).unlockedMap, null);
    assert.equal(recordEliteEncounter(main, { isElite: true }).unlockedMap, main.loc);

    const ragnarok = { ...DB.ITEMS.weapons.find((item) => item.name === '라그나로크'), id: 'surface-sig' };
    const base = { ...structuredClone(INITIAL_STATE), bootStage: 'ready', player: makePlayerFixture({ name: '여행자', job: '전사', level: 10, loc: CONSTANTS.START_LOCATION }) };
    const gain = (state) => gameReducer(state, { type: AT.SET_PLAYER, payload: (player) => ({ inv: [...player.inv, ragnarok] }) });
    assert.equal(gain(base).legendaryAcquisitions.length, 1);
    const begun = gameReducer(base, { type: AT.BEGIN_DAILY_TRIAL, payload: { now: NOW, saved: null } });
    assert.ok(begun.dailyTrial);
    assert.equal(gain(begun).legendaryAcquisitions.length, 0);
});

test('시련의 탐험은 AI를 부르지 않는다 (같은 굴림의 본편은 부른다)', async () => {
    const original = AI_SERVICE.generateEvent;
    let calls = 0;
    AI_SERVICE.generateEvent = async () => { calls += 1; return null; };
    const explore = async (trialRun) => {
        const player = {
            ...makePlayerFixture({ loc: '고요한 숲', hp: 80, mp: 20, eventChainProgress: { lost_wizard: 99 }, activeExpedition: undefined, trialRun }),
            stats: { ...structuredClone(INITIAL_STATE.player.stats), explores: 1, exploreState: { ...structuredClone(INITIAL_STATE.player.stats.exploreState), sinceNarrativeEvent: 1 } },
        };
        const rolls = [0.99, 0.99, 0, 0];
        await createExploreActions({
            player, gameState: GS.IDLE, uid: 'u', dispatch: noop, addLog: noop, addStoryLog: noop,
            getFullStats: () => ({ maxHp: 100, maxMp: 50 }), rng: () => rolls.shift() ?? 0.99,
        }, { commitExploreOutcome: noop }).explore();
    };
    try {
        await explore(undefined);
        assert.equal(calls, 1);
        await explore({ dayKey: DAY_KEY, map: 1 });
        assert.equal(calls, 1);
    } finally { AI_SERVICE.generateEvent = original; }
});
