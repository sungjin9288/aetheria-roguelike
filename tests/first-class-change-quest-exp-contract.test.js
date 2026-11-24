import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { EARLY_QUEST_EXP_CAPS, FIRST_STORY_QUEST_ID, QUESTS } from '../src/data/quests.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { getFirstVisitReward } from '../src/utils/exploreUtils.js';
import { getPacedCombatExp, getPacedQuestClaimExp } from '../src/utils/progressionPacing.js';
import { makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-11 E4 — 첫 전직까지의 속도(소유자 결정 2026-11-24 "절반으로 줄임").
 *
 * 레버는 하나다: Lv1 · 2에 받는 임무(unlock 레벨 1 · 2)의 보상 경험. 상한표 `EARLY_QUEST_EXP_CAPS`의 1 · 2단이
 * 그 값을 소유하고(40 · 60 → 150 · 300), 원래 경험이 상한보다 작던 임무(80 · 1 · 2 · 8 · 14)는 상한까지 올렸다.
 * 적 경험 · 경험 곡선 · 초반 전투 경험 60% · 임무 수령 완화(한 번에 한 레벨 + 85%)는 그대로다(Wave 53 · 60).
 * 자연 플레이(`--field all`, 드라이버 v4)에서 첫 전직 중앙값이 줄어든 측정은 원장 §185.
 */

const MAIN_ROUTE_QUESTS = Object.freeze({ story: FIRST_STORY_QUEST_ID, slime: 1, boar: 2 });
const UNLOCK_TIER_1_QUESTS = Object.freeze([FIRST_STORY_QUEST_ID, 1, 110]);
const UNLOCK_TIER_2_QUESTS = Object.freeze([2, 8, 14]);
const UNCHANGED_TIERS = Object.freeze({ 3: 80, 4: 105, 5: 140, 6: 180, 7: 225, 8: 280, 9: 350, 10: 440 });

const getQuest = (id) => {
    const quest = QUESTS.find((entry) => entry.id === id);
    assert.ok(quest, `임무 ${id}가 있다`);
    return quest;
};

const noLog = { addLog: () => {} };
const killExp = (player, loc) => {
    const enemy = spawnEnemy(DB.MAPS[loc], { ...player, loc }, [], noLog, { rng: () => 0.99 }).mStats;
    assert.ok(enemy, `${loc}에서 적이 나온다`);
    return getPacedCombatExp(player, enemy.exp);
};

const freshPlayer = () => makePlayerFixture({
    level: 1,
    exp: 0,
    nextExp: CONSTANTS.START_NEXT_EXP,
    stats: { ...makePlayerFixture().stats, explores: 0, visitedMaps: ['시작의 마을'] },
});

const applyExp = (player, exp) => CombatEngine.applyExpGain(player, exp).updatedPlayer;
const claim = (player, id) => applyExp(player, getPacedQuestClaimExp(player, getQuest(id).reward.exp));
const visit = (player, loc) => applyExp(player, getFirstVisitReward(loc, { stats: { visitedMaps: [] } }).exp);

/**
 * 초반 길(드라이버가 실제로 받는 순서): 고요한 숲 첫 방문 → 첫 이야기 임무 → 숲에서 슬라임 3마리 → 슬라임 임무 →
 * 서쪽 평원 첫 방문 → 평원에서 멧돼지 5마리 → 멧돼지 임무, 그 뒤로는 Lv5까지 싸운다. Lv1 · 2는 숲, Lv3부터 평원.
 * `withQuests`가 false면 임무 보상 없이 같은 길을 걷는다(같은 처치 경험).
 */
const killsToLevel5 = ({ withQuests }) => {
    let player = visit(freshPlayer(), '고요한 숲');
    if (withQuests) player = claim(player, MAIN_ROUTE_QUESTS.story);
    let kills = 0;
    let visitedPlains = false;
    const fight = () => {
        const loc = player.level <= 2 ? '고요한 숲' : '서쪽 평원';
        if (loc === '서쪽 평원' && !visitedPlains) { player = visit(player, loc); visitedPlains = true; }
        player = applyExp(player, killExp(player, loc));
        kills += 1;
    };
    for (let i = 0; i < 3; i += 1) fight();
    if (withQuests) player = claim(player, MAIN_ROUTE_QUESTS.slime);
    while (player.level < 2) fight();
    for (let i = 0; i < 5; i += 1) fight();
    if (withQuests) player = claim(player, MAIN_ROUTE_QUESTS.boar);
    for (let guard = 0; player.level < 5 && guard < 500; guard += 1) fight();
    assert.equal(player.level >= 5, true, 'Lv5에 닿는다');
    return kills;
};

test('E4: 레버는 임무 보상 경험 하나다 — 경험 곡선 · 초반 전투 경험 · 적 경험은 그대로', () => {
    assert.equal(CONSTANTS.START_NEXT_EXP, 200);
    assert.equal(BALANCE.EXP_SCALE_RATE, 1.15);
    assert.equal(getPacedCombatExp({ level: 1 }, 20), 12, 'Lv1 ~ 4 전투 경험 60%');
    assert.equal(getPacedCombatExp({ level: 5 }, 60), 60, 'Lv5부터 원래 전투 경험');
    const lv1 = freshPlayer();
    assert.equal(spawnEnemy(DB.MAPS['고요한 숲'], { ...lv1, loc: '고요한 숲' }, [], noLog, { rng: () => 0.99 }).mStats.exp, 20, '고요한 숲 적 경험');
    assert.equal(spawnEnemy(DB.MAPS['서쪽 평원'], { ...lv1, loc: '서쪽 평원' }, [], noLog, { rng: () => 0.99 }).mStats.exp, 40, '서쪽 평원 적 경험');
});

test('E4: Lv1 · 2에 받는 임무의 경험은 상한표 1 · 2단(150 · 300)이고 3단부터는 그대로다', () => {
    assert.equal(EARLY_QUEST_EXP_CAPS[1], 150);
    assert.equal(EARLY_QUEST_EXP_CAPS[2], 300);
    for (const [tier, cap] of Object.entries(UNCHANGED_TIERS)) assert.equal(EARLY_QUEST_EXP_CAPS[tier], cap, `${tier}단 상한 불변`);
    for (const id of UNLOCK_TIER_1_QUESTS) {
        assert.equal(getQuest(id).minLv, 1);
        assert.equal(getQuest(id).reward.exp, EARLY_QUEST_EXP_CAPS[1], `임무 ${id}`);
    }
    for (const id of UNLOCK_TIER_2_QUESTS) {
        assert.equal(getQuest(id).minLv, 2);
        assert.equal(getQuest(id).reward.exp, EARLY_QUEST_EXP_CAPS[2], `임무 ${id}`);
    }
    // 1 · 2단 임무는 모두 상한값을 준다 — 같은 단의 임무가 서로 다른 경험을 주지 않는다.
    for (const quest of QUESTS.filter((entry) => entry.minLv === 1 || entry.minLv === 2)) {
        assert.equal(quest.reward.exp, EARLY_QUEST_EXP_CAPS[quest.minLv], `${quest.id} ${quest.title}`);
    }
});

test('E4: 첫 이야기 · 슬라임 · 멧돼지 임무로 Lv5까지 처치 수가 임무 없이 걷는 길의 절반 아래다', () => {
    const without = killsToLevel5({ withQuests: false });
    const withQuests = killsToLevel5({ withQuests: true });
    assert.ok(withQuests <= 22, `임무를 받으면 Lv5까지 22마리 이하 (실제 ${withQuests})`);
    assert.ok(withQuests * 2 <= without, `임무 없이 ${without}마리 — 임무가 절반 이상을 대신한다 (실제 ${withQuests})`);
});

test('E4: 임무 한 번의 수령은 여전히 한 레벨 + 다음 요구량의 85%를 넘지 않는다', () => {
    const player = freshPlayer();
    const story = claim(player, MAIN_ROUTE_QUESTS.story);
    assert.equal(story.level, 1, '첫 이야기 임무만으로는 Lv2가 아니다 (150 < 200)');
    const nearLevel = { ...freshPlayer(), level: 4, exp: 290, nextExp: 303 };
    const boar = CombatEngine.applyExpGain(nearLevel, getPacedQuestClaimExp(nearLevel, getQuest(2).reward.exp));
    assert.equal(boar.levelUps, 1, '멧돼지 임무 한 번에 두 레벨을 넘지 않는다');
});
