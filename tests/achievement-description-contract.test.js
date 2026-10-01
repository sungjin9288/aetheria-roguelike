import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { getAchievementCurrentValue, isAchievementUnlocked } from '../src/utils/gameUtils.js';
import { getProtocolWeekKey } from '../src/utils/protocolCycle.js';
import { buildCampfireEvent } from '../src/utils/campfireEvent.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';

/**
 * 2026-10 Wave 58 — 업적 설명대로(소유자 결정 "전부 설명대로").
 *   "합성 N회 성공" · "새 지역 N곳 발견" · "혼돈의 심연 N층 도달" · "전설 각인 25종 전부 발견" · "누적 골드" · "N번 휴식"
 *   이 실제 판정과 같아야 하고, 계승 · 사망 재시작에서 줄어드는 값(레벨 · 방문 지역)이 수령 전 업적을 다시 잠그지 않는다.
 */

const achievement = (id) => {
    const found = DB.ACHIEVEMENTS.find((entry) => entry.id === id);
    assert.ok(found, id);
    return found;
};
const makeState = (gameState, playerOverrides = {}, stateOverrides = {}) => {
    const base = structuredClone(INITIAL_STATE);
    return {
        ...base,
        ...stateOverrides,
        gameState,
        player: {
            ...base.player,
            name: '시험자',
            ...playerOverrides,
            stats: { ...base.player.stats, ...(playerOverrides.stats || {}) },
        },
    };
};

test('합성 업적은 성공만 센다 — 실패한 합성은 stats.syntheses를 올리지 않는다', () => {
    const template = DB.ITEMS.weapons.find((entry) => entry.tier === 3 && !SIGNATURE_ITEM_REGISTRY[entry.name]);
    assert.ok(template);
    assert.ok(BALANCE.SYNTHESIS_SUCCESS_RATES[3] < 1, '실패가 가능한 등급');
    const inputs = ['s-a', 's-b', 's-c'].map((id) => ({ ...template, id }));
    const state = makeState(GS.CRAFTING, { gold: 1_000_000, inv: inputs, stats: { syntheses: 4 } });
    const action = (successRoll) => ({
        type: AT.SYNTHESIZE_ITEMS,
        payload: { itemIds: inputs.map((item) => item.id), useProtect: false, successRoll, outputRoll: 0 },
    });

    const failed = gameReducer(state, action(0.999));
    assert.ok(failed.logs.some((log) => log.text === MSG.SYNTHESIS_FAIL));
    assert.equal(failed.player.stats.syntheses, 4, '실패는 세지 않는다');
    assert.equal(isAchievementUnlocked(achievement('ach_synth_5'), failed.player), false);

    const succeeded = gameReducer(state, action(0));
    assert.equal(succeeded.player.stats.syntheses, 5);
    assert.equal(isAchievementUnlocked(achievement('ach_synth_5'), succeeded.player), true);
});

test('"새 지역 N곳 발견"은 시작 마을을 세지 않는다', () => {
    const discover5 = achievement('ach_discover_5');
    const maps = Object.keys(DB.MAPS).filter((name) => name !== CONSTANTS.START_LOCATION);
    const player = (count) => ({
        ...structuredClone(INITIAL_STATE.player),
        stats: { visitedMaps: [CONSTANTS.START_LOCATION, ...maps.slice(0, count)] },
    });
    assert.equal(getAchievementCurrentValue(discover5, player(4)), 4);
    assert.equal(isAchievementUnlocked(discover5, player(4)), false, '시작 마을 + 새 지역 4곳은 5곳이 아니다');
    assert.equal(isAchievementUnlocked(discover5, player(5)), true);
});

test('"혼돈의 심연 N층 도달" — 돌파 N-1층이면 N층에 도달한 것이다', () => {
    const abyss10 = achievement('ach_abyss_10');
    const player = (record, floor = record) => ({
        ...structuredClone(INITIAL_STATE.player),
        stats: { abyssRecord: record, abyssFloor: floor },
    });
    assert.equal(getAchievementCurrentValue(abyss10, player(0)), 0, '심연 기록이 없으면 0');
    assert.equal(getAchievementCurrentValue(abyss10, player(9)), 10, '9층을 돌파하면 10층에서 싸운다');
    assert.equal(isAchievementUnlocked(abyss10, player(9)), true);
    assert.equal(isAchievementUnlocked(abyss10, player(8)), false);
});

test('"전부" 업적의 목표는 등록된 전설 각인 수다 — 문구 숫자와 목표가 같다', () => {
    const registered = Object.keys(SIGNATURE_ITEM_REGISTRY).length;
    const all = achievement('ach_sig_20');
    assert.equal(all.goal, registered);
    assert.ok(all.desc.includes(`${registered}종 전부`), all.desc);
    for (const entry of DB.ACHIEVEMENTS) {
        const match = /(\d+)종/.exec(entry.desc || '');
        if (match && entry.target === 'signaturesDiscovered') assert.equal(Number(match[1]), entry.goal, entry.id);
        assert.doesNotMatch(entry.desc || '', /signature/i, `${entry.id} 문구는 한국어다`);
    }
});

test('계승은 수령하지 않은 달성 업적을 다시 잠그지 않는다', () => {
    const lv30 = achievement('ach_lv_30');
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: '시험자', level: 50, quests: [],
        meta: { prestigeRank: 0, endgame: { lastEndgameReceiptKey: 'k' } },
    };
    assert.equal(isAchievementUnlocked(lv30, player), true);
    const ascended = gameReducer(
        { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, player },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: 'k', seed: 1 } },
    );
    assert.equal(ascended.player.level, 1);
    assert.ok(ascended.player.stats.achievedAchievements.includes('ach_lv_30'));
    assert.equal(isAchievementUnlocked(lv30, ascended.player), true);
    assert.equal(getAchievementCurrentValue(lv30, ascended.player), lv30.goal, '진행 표시도 목표에 머문다');

    const claimed = gameReducer(ascended, { type: AT.CLAIM_ACHIEVEMENT_REWARD, payload: { achievementId: 'ach_lv_30' } });
    assert.notEqual(claimed, ascended, '수령이 받아들여진다');
    assert.ok(claimed.player.stats.claimedAchievements.includes('ach_lv_30'));
});

test('사망 재시작도 달성 기록을 남긴다 — 방문 지역이 줄어도 발견 업적은 유지된다', () => {
    const discover15 = achievement('ach_discover_15');
    const maps = Object.keys(DB.MAPS).filter((name) => name !== CONSTANTS.START_LOCATION).slice(0, 15);
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: '시험자', level: 20,
        stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: [CONSTANTS.START_LOCATION, ...maps], deaths: 1 },
    };
    const defeated = CombatEngine.handleDefeat(player, structuredClone(INITIAL_STATE.player), () => 0.5, () => 1);
    const afterDeath = defeated.updatedPlayer;
    assert.ok(afterDeath.stats.achievedAchievements.includes('ach_discover_15'));

    // 사망 재시작 화면의 새 여정(start)은 방문 지역을 시작 마을로 되돌린다.
    const dispatched = [];
    createCharacterActions({
        player: { ...afterDeath, name: '' }, gameState: GS.IDLE, dispatch: (entry) => dispatched.push(entry),
        addLog: () => {}, addStoryLog: () => {}, getFullStats: (p) => calculateFullStats(p ?? afterDeath),
    }, { emitUnlockedTitles: () => {} }).start('시험자', 'male', '모험가', []);
    const restarted = { ...afterDeath, ...dispatched.find((entry) => entry.type === AT.SET_PLAYER).payload };
    assert.deepEqual(restarted.stats.visitedMaps, [CONSTANTS.START_LOCATION]);
    assert.equal(isAchievementUnlocked(discover15, restarted), true);
});

test('누적 골드는 보상 골드도 센다 — 시즌 · 도감 · 주간 · 레벨 이정표', () => {
    const now = new Date();
    const season = gameReducer(makeState(GS.IDLE, {
        gold: 0, stats: { total_gold: 0 },
        seasonPass: { ...structuredClone(INITIAL_STATE.player.seasonPass), xp: 1_000_000, tier: 30, claimed: [] },
    }), { type: AT.CLAIM_SEASON_REWARD, payload: { tier: 1 } });
    assert.ok(season.player.gold > 0, '시즌 1티어 무료 보상은 골드다');
    assert.equal(season.player.stats.total_gold, season.player.gold);

    const recipes = Object.fromEntries(DB.ITEMS.recipes.slice(0, 5).map((recipe) => [recipe.id, { discovered: true }]));
    const codex = gameReducer(makeState(GS.IDLE, {
        gold: 0, stats: { total_gold: 0, codex: { ...structuredClone(INITIAL_STATE.player.stats.codex), recipes } },
    }), { type: AT.CLAIM_CODEX_REWARD, payload: { milestoneId: 'recipes_5' } });
    assert.ok(codex.player.gold > 0);
    assert.equal(codex.player.stats.total_gold, codex.player.gold);

    const weekly = gameReducer(makeState(GS.IDLE, {
        gold: 0, stats: { total_gold: 0 },
        weeklyProtocol: { kills: 50, explores: 0, bossKills: 0, lastResetWeek: getProtocolWeekKey(now), claimed: [] },
    }), { type: AT.CLAIM_WEEKLY_MISSION, payload: { missionId: 'weeklyKills' } });
    assert.equal(weekly.player.gold, BALANCE.WEEKLY_MISSIONS[0].reward.gold);
    assert.equal(weekly.player.stats.total_gold, weekly.player.gold);

    // 레벨 이정표 골드(작은 이정표): 레벨업으로 얻는 골드도 누적 골드다.
    const minorLevel = Array.from({ length: 40 }, (_, i) => i + 2)
        .find((level) => level % BALANCE.LEVEL_MILESTONE_EVERY === 0 && level % BALANCE.LEVEL_MAJOR_MILESTONE_EVERY !== 0);
    const before = { ...structuredClone(INITIAL_STATE.player), level: minorLevel - 1, exp: 0, nextExp: 10, gold: 0, stats: { total_gold: 0 } };
    const leveled = CombatEngine.applyExpGain(before, 10).updatedPlayer;
    assert.equal(leveled.level, minorLevel);
    assert.ok(leveled.gold > 0);
    assert.equal(leveled.stats.total_gold, leveled.gold);
});

test('모닥불 "휴식"은 휴식 횟수에 센다 — "단련"은 세지 않는다', () => {
    const player = { ...structuredClone(INITIAL_STATE.player), name: '시험자', loc: '고요한 숲', hp: 10, stats: { rests: 9 } };
    const run = (choice) => {
        const event = buildCampfireEvent(calculateFullStats(player));
        let state = { ...structuredClone(INITIAL_STATE), gameState: GS.EVENT, currentEvent: event, player };
        createEventActions({
            player, currentEvent: event, gameState: GS.EVENT,
            dispatch: (entry) => { state = gameReducer(state, entry); },
            addLog: () => {}, addStoryLog: () => {}, getFullStats: (p) => calculateFullStats(p ?? player), rng: () => 0.5,
        }, { emitUnlockedTitles: () => {} }).handleEventChoice(choice);
        return state.player;
    };
    const rested = run(0);
    assert.equal(rested.stats.rests, 10);
    assert.equal(isAchievementUnlocked(achievement('ach_rest_10'), rested), true);
    assert.equal(run(1).stats.rests, 9);
});
