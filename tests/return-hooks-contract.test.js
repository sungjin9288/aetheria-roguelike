/**
 * 2026-11 고도화 묶음 A — 다시 손이 가는 자리 세 곳(docs/ENHANCEMENT_DESIGN_2026-11.md).
 *
 * E1 복귀 브리핑 "멈춘 자리": 저장된 상태에서 도출한 사실만, 본편 장 → 토벌 의뢰 → 구역 보스 게이지 → 다음 가방 순서로
 *    해당하는 줄만 최대 `RETURN_BRIEFING_RESUME_LINES`줄. 갈 곳 · 할 일을 권하지 않는다.
 * E2 오늘의 임무 한 줄: 마을 조작판 · 원정 결산이 `getDailyMissionSummary` 하나를 읽는다.
 * E3 사망 화면 "다음 갈래": 직업 여정에 기록이 없는 첫 전직 갈래 — 장부 ∪ 방금 끝난 여정의 직업.
 *
 * 셋 다 화면만 바꾼다 — 게임 판정 · 난수 · 세이브 봉투는 그대로다(자연 플레이 바이트 동일로 확인).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { CLASSES } from '../src/data/classes.js';
import { BAG_RECIPES } from '../src/data/bagRecipes.js';
import { HUNT_CONTRACTS } from '../src/data/huntContracts.js';
import { getBriefingResumeLines, buildReturnBriefing } from '../src/utils/returnBriefing.js';
import { getDailyMissionSummary, getProtocolDayKey } from '../src/utils/protocolCycle.js';
import { getUnrecordedClassBranches } from '../src/utils/classJourney.js';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';
import ReturnBriefingCard from '../src/components/ReturnBriefingCard.tsx';
import ExpeditionPrepStrip from '../src/components/control/ExpeditionPrepStrip.tsx';
import { getExpeditionPreparation } from '../src/utils/adventureGuide.js';
import ExpeditionDebriefCard from '../src/components/ExpeditionDebriefCard.tsx';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import { buildRunSummary } from '../src/utils/gameUtils.js';

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date(2026, 10, 2, 12).getTime();

const STORY_QUEST = DB.QUESTS.find((quest) => quest.id === 81);
const AREA_BOSS_MAP = Object.entries(DB.MAPS)
    .find(([, map]) => typeof map.boss === 'string' && typeof map.level === 'number' && map.level <= 20)?.[0];
const HUNT_MAP = HUNT_CONTRACTS[0].map;
const HUNT_MAP_LEVEL = DB.MAPS[HUNT_MAP].level;

const playerAt = (overrides = {}) => makePlayerFixture({
    loc: CONSTANTS.START_LOCATION,
    level: 12,
    hp: 100,
    maxHp: 100,
    quests: [],
    inv: [],
    bagTier: 0,
    eventChainProgress: {},
    ...overrides,
    stats: { lastSeenAt: NOW - (HOUR_MS * 10), ...(overrides.stats || {}) },
});

const bagInput = (index) => BAG_RECIPES[0].inputs[index];
const bagItem = (name) => ({ id: `bag-${name}`, name, type: 'mat', price: 1 });

// ---- E1 ------------------------------------------------------------------------------------------

test('E1: 해당하는 상태가 없으면 "멈춘 자리"는 비어 있다', () => {
    assert.deepEqual(getBriefingResumeLines(playerAt()), []);
    assert.deepEqual(buildReturnBriefing(playerAt(), NOW).resumeLines, []);
});

test('E1: 수락했고 끝나지 않은 본편 장은 제목과 진행을 말한다 — 끝난 장은 보상 칸이 센다', () => {
    assert.ok(STORY_QUEST, 'story quest 81 exists');
    const open = getBriefingResumeLines(playerAt({ quests: [{ id: 81, progress: 3 }] }));
    assert.deepEqual(open, [{ kind: 'story', text: MSG.RETURN_BRIEFING_RESUME_STORY(STORY_QUEST.title, 3, STORY_QUEST.goal) }]);
    assert.ok(open[0].text.includes(`3/${STORY_QUEST.goal}`));

    const done = getBriefingResumeLines(playerAt({ quests: [{ id: 81, progress: STORY_QUEST.goal }] }));
    assert.deepEqual(done, []);

    // 본편이 아닌 임무는 이 줄이 아니다.
    const side = getBriefingResumeLines(playerAt({ quests: [{ id: 1, progress: 1 }] }));
    assert.deepEqual(side, []);
});

test('E1: 시작한 토벌 의뢰는 임무 탭과 같은 상태 줄을 말하고, 시작하지 않은 의뢰는 말하지 않는다', () => {
    const level = HUNT_MAP_LEVEL;
    const untouched = getBriefingResumeLines(playerAt({ level }));
    assert.equal(untouched.some((line) => line.kind === 'hunt'), false);

    const started = getBriefingResumeLines(playerAt({ level, huntContracts: { [HUNT_MAP]: { stage: 0, progress: 7, round: 1 } } }));
    const hunt = started.find((line) => line.kind === 'hunt');
    assert.ok(hunt, 'hunt line present');
    assert.ok(hunt.text.includes(HUNT_MAP));
    assert.ok(hunt.text.includes(`7/${BALANCE.HUNT_CONTRACT_KILL_GOAL}`));

    const finished = getBriefingResumeLines(playerAt({ level, huntContracts: { [HUNT_MAP]: { stage: 3, progress: 0, round: BALANCE.HUNT_CONTRACT_MAX_ROUNDS } } }));
    assert.equal(finished.some((line) => line.kind === 'hunt'), false);
});

test('E1: 길 잃은 여행이면 토벌 의뢰 줄도 지역 이름을 숨긴다', () => {
    const lines = getBriefingResumeLines(playerAt({
        level: HUNT_MAP_LEVEL,
        challengeModifiers: ['blindMap'],
        huntContracts: { [HUNT_MAP]: { stage: 0, progress: 7, round: 1 } },
    }));
    const hunt = lines.find((line) => line.kind === 'hunt');
    assert.ok(hunt);
    assert.equal(hunt.text.includes(HUNT_MAP), false);
    assert.ok(hunt.text.includes(MSG.BLIND_MAP_LOCATION));
});

test('E1: 지금 지역의 구역 보스 게이지는 차기 시작했을 때만, 원정 칩과 같은 문구로 말한다', () => {
    assert.ok(AREA_BOSS_MAP, 'a map with a named area boss exists');
    const empty = getBriefingResumeLines(playerAt({ loc: AREA_BOSS_MAP }));
    assert.equal(empty.some((line) => line.kind === 'bossGauge'), false);

    const filling = getBriefingResumeLines(playerAt({ loc: AREA_BOSS_MAP, stats: { bossGauge: { [AREA_BOSS_MAP]: 0.4 } } }));
    const gauge = filling.find((line) => line.kind === 'bossGauge');
    assert.ok(gauge);
    assert.ok(gauge.text.startsWith(MSG.RETURN_BRIEFING_RESUME_BOSS('')));

    const blind = getBriefingResumeLines(playerAt({
        loc: AREA_BOSS_MAP,
        challengeModifiers: ['blindMap'],
        stats: { bossGauge: { [AREA_BOSS_MAP]: 0.4 } },
    }));
    assert.equal(blind.some((line) => line.kind === 'bossGauge'), false, '길 잃은 여행은 게이지 칩이 없다');

    const defeated = getBriefingResumeLines(playerAt({
        loc: AREA_BOSS_MAP,
        stats: { bossGauge: { [AREA_BOSS_MAP]: 0.4 }, areaBossDefeated: { [DB.MAPS[AREA_BOSS_MAP].boss]: true } },
    }));
    assert.equal(defeated.some((line) => line.kind === 'bossGauge'), false, '도전할 수 없는 보스는 말하지 않는다');
});

test('E1: 다음 가방 재료는 모으기 시작했을 때만, 필요한 수까지만 센다', () => {
    const recipe = BAG_RECIPES[0];
    const total = recipe.inputs.reduce((sum, input) => sum + input.qty, 0);
    assert.deepEqual(getBriefingResumeLines(playerAt()).filter((line) => line.kind === 'bag'), []);

    const extra = Array.from({ length: bagInput(0).qty + 5 }, () => bagItem(bagInput(0).name));
    const lines = getBriefingResumeLines(playerAt({ inv: extra }));
    assert.deepEqual(lines, [{ kind: 'bag', text: MSG.RETURN_BRIEFING_RESUME_BAG(recipe.name, bagInput(0).qty, total) }]);

    const allBags = getBriefingResumeLines(playerAt({ inv: extra, bagTier: BAG_RECIPES.length }));
    assert.deepEqual(allBags, []);
});

test('E1: 줄은 정해진 순서로 최대 RETURN_BRIEFING_RESUME_LINES줄이다', () => {
    const lines = getBriefingResumeLines(playerAt({
        loc: AREA_BOSS_MAP,
        level: Math.max(HUNT_MAP_LEVEL, 12),
        quests: [{ id: 81, progress: 1 }],
        huntContracts: { [HUNT_MAP]: { stage: 1, progress: 2, round: 1 } },
        inv: [bagItem(bagInput(0).name)],
        stats: { bossGauge: { [AREA_BOSS_MAP]: 0.4 } },
    }));
    assert.equal(lines.length, BALANCE.RETURN_BRIEFING_RESUME_LINES);
    assert.deepEqual(lines.map((line) => line.kind), ['story', 'hunt', 'bossGauge']);
});

test('E1: 브리핑 카드는 "멈춘 자리"를 줄이 있을 때만 그린다', () => {
    const base = buildReturnBriefing(playerAt(), NOW);
    const noop = () => {};
    const without = renderStatic(React.createElement(ReturnBriefingCard, { briefing: base, onClose: noop, onOpenGoals: noop }));
    assert.equal(without.includes('data-testid="return-briefing-resume"'), false);

    const withLines = buildReturnBriefing(playerAt({ quests: [{ id: 81, progress: 3 }] }), NOW);
    const html = renderStatic(React.createElement(ReturnBriefingCard, { briefing: withLines, onClose: noop, onOpenGoals: noop }));
    assert.ok(html.includes('data-testid="return-briefing-resume"'));
    assert.ok(html.includes(MSG.RETURN_BRIEFING_RESUME_LABEL));
    assert.ok(html.includes('data-resume-kind="story"'));
});

// ---- E2 ------------------------------------------------------------------------------------------

test('E2: 오늘의 임무 요약은 오늘 날짜의 완료 수이고, 날짜가 지났으면 새 날의 0이다', () => {
    const today = new Date(NOW);
    const missions = (doneFlags) => doneFlags.map((done, index) => ({ id: `m${index}`, type: 'kills', goal: 1, progress: done ? 1 : 0, done, reward: {} }));
    const player = playerAt({ stats: { dailyProtocol: { date: getProtocolDayKey(today), relicShards: 0, missions: missions([true, false, true]) } } });
    assert.deepEqual(getDailyMissionSummary(player, today), { done: 2, total: 3 });

    const tomorrow = new Date(NOW + 24 * HOUR_MS);
    assert.deepEqual(getDailyMissionSummary(player, tomorrow), { done: 0, total: 3 });

    // 복귀 브리핑의 오늘의 진행 칸도 같은 값이다.
    const briefing = buildReturnBriefing(player, NOW);
    assert.equal(briefing.dailyCompletedCount, 2);
    assert.equal(briefing.dailyMissionCount, 3);
});

test('E2: 원정 준비 카드와 원정 결산이 오늘의 임무 한 줄을 그린다', () => {
    // 오늘의 임무 줄은 원정 준비 카드 머리 줄에 있다 — 마을 조작판에 줄을 새로 쓰면 기록 창이 줄어 이야기 기록이 잘렸다(원장 §159).
    const player = makePlayerFixture();
    const preparation = getExpeditionPreparation(player, null, DB.MAPS[player.loc], DB.MAPS);
    const town = renderStatic(React.createElement(ExpeditionPrepStrip, {
        preparation,
        primary: { kind: 'open_quest_board', testId: 'control-town-quest-board', label: '임무 고르기', disabled: false },
        onPrimaryAction: () => {},
        onEditFocus: () => {},
        onOpenArchive: () => {},
        dailyLine: MSG.DAILY_MISSION_LINE(1, 3),
        dailyComplete: false,
    }));
    assert.ok(town.includes('data-testid="control-town-daily"'));
    assert.ok(town.includes(MSG.DAILY_MISSION_LINE(1, 3)));
    assert.equal(MSG.DAILY_MISSION_LINE(3, 3).endsWith('완료'), true);

    const summary = {
        id: 'exp-1', destination: '고요한 숲', startedAt: 0, endedAt: 60_000, durationMs: 60_000,
        startLevel: 3, endLevel: 4, battles: 2, explores: 5, expGained: 120, goldDelta: 30,
        newItems: [], lostItemCount: 0, completedQuests: [], lowestHp: 40, lowestHpPercent: 40,
        returnHp: 80, maxHpAtReturn: 100, reviewedAt: null,
    };
    const recommendation = { kind: 'continue', label: '계속', detail: '' };
    const debrief = renderStatic(React.createElement(ExpeditionDebriefCard, {
        summary, recommendation, onClose: () => {}, onPrimaryAction: () => {}, daily: { done: 2, total: 3 },
    }));
    assert.ok(debrief.includes('data-testid="expedition-debrief-daily"'));
    assert.ok(debrief.includes(MSG.DAILY_MISSION_PROGRESS(2, 3)));

    const noDaily = renderStatic(React.createElement(ExpeditionDebriefCard, {
        summary, recommendation, onClose: () => {}, onPrimaryAction: () => {},
    }));
    assert.equal(noDaily.includes('data-testid="expedition-debrief-daily"'), false);
});

// ---- E3 ------------------------------------------------------------------------------------------

const FIRST_BRANCHES = CLASSES[CONSTANTS.DEFAULT_JOB].next;
const ledgerOf = (...jobs) => ({ version: 2, sequence: jobs.length, byJob: Object.fromEntries(jobs.map((job) => [job, {}])) });

test('E3: 기록이 없으면 첫 전직 갈래 전부, 갈래의 어느 직업이든 기록되면 그 갈래는 빠진다', () => {
    assert.ok(FIRST_BRANCHES.length >= 2);
    assert.deepEqual(getUnrecordedClassBranches(null, null), FIRST_BRANCHES);
    assert.deepEqual(getUnrecordedClassBranches(ledgerOf(CONSTANTS.DEFAULT_JOB), CONSTANTS.DEFAULT_JOB), FIRST_BRANCHES);

    const [first, ...rest] = FIRST_BRANCHES;
    assert.deepEqual(getUnrecordedClassBranches(ledgerOf(first), null), rest);

    // 깊은 전직(첫 갈래의 다음 직업)도 그 갈래를 걸은 것이다.
    const deep = CLASSES[first].next[0];
    assert.ok(deep);
    assert.deepEqual(getUnrecordedClassBranches(ledgerOf(deep), null), rest);
});

test('E3: 방금 끝난 여정의 직업은 장부에 없어도 센다 — 모두 기록되면 비어 있다', () => {
    const [first, second, ...rest] = FIRST_BRANCHES;
    assert.deepEqual(getUnrecordedClassBranches(ledgerOf(first), second), rest);
    assert.deepEqual(getUnrecordedClassBranches(ledgerOf(...FIRST_BRANCHES), null), []);
});

test('E3: 사망 화면은 갈래가 있을 때만 한 줄을 그린다(11px 하한 안)', () => {
    const player = makePlayerFixture({ name: '테스트', job: FIRST_BRANCHES[0], level: 12, loc: CONSTANTS.START_LOCATION });
    const runSummary = buildRunSummary(player);
    const branches = getUnrecordedClassBranches(ledgerOf(), runSummary.job);
    const html = renderStatic(React.createElement(RunSummaryCard, { runSummary, unrecordedBranches: branches }));
    assert.ok(html.includes('data-testid="run-summary-unrecorded-branches"'));
    assert.ok(html.includes(MSG.RUN_SUMMARY_UNRECORDED_BRANCHES(branches)));
    assert.equal(html.includes(FIRST_BRANCHES[0] + ' ·'), false, '방금 끝난 직업의 갈래는 없다');

    const none = renderStatic(React.createElement(RunSummaryCard, { runSummary, unrecordedBranches: [] }));
    assert.equal(none.includes('data-testid="run-summary-unrecorded-branches"'), false);
});
