import test from 'node:test';
import assert from 'node:assert/strict';

import { EARLY_QUEST_EXP_CAPS, QUESTS } from '../src/data/quests.js';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { getPacedQuestClaimExp } from '../src/utils/progressionPacing.js';

const makePlayer = (overrides = {}) => ({
    level: 8,
    exp: 0,
    nextExp: 261,
    hp: 290,
    maxHp: 290,
    mp: 120,
    maxMp: 120,
    atk: 24,
    def: 12,
    gold: 0,
    ...overrides,
});

const applyExp = (player, exp) => CombatEngine.applyExpGain(player, exp).updatedPlayer;

const claimQuest = (player, questId) => {
    const quest = QUESTS.find((entry) => entry.id === questId);
    assert.ok(quest, `expected quest ${questId} to exist`);
    return applyExp(player, getPacedQuestClaimExp(player, quest.reward.exp));
};

const getQuest = (questId) => {
    const quest = QUESTS.find((entry) => entry.id === questId);
    assert.ok(quest, `expected quest ${questId} to exist`);
    return quest;
};

test('early quest rewards are capped by unlock level to prevent runaway leveling', () => {
    for (const quest of QUESTS) {
        const exp = Number(quest.reward?.exp || 0);
        const cap = EARLY_QUEST_EXP_CAPS[quest.minLv];
        if (!cap || exp <= 0) continue;

        assert.ok(
            exp <= cap,
            `${quest.title} expected exp <= ${cap}, got ${exp}`
        );
    }
});

test('large early operation quests no longer grant multiple levels from one completion', () => {
    const player = makePlayer({ exp: 250 });
    const quest = QUESTS.find((entry) => entry.id === 68);

    assert.equal(quest.reward.exp, EARLY_QUEST_EXP_CAPS[8]);

    const pacedExp = getPacedQuestClaimExp(player, quest.reward.exp);
    const result = CombatEngine.applyExpGain(player, pacedExp);

    assert.equal(result.levelUps, 1);
    assert.equal(result.updatedPlayer.level, 9);
});

test('level 10 milestone-style quests stay below a single early-level burst', () => {
    const player = makePlayer({ level: 10, exp: 0, nextExp: 345 });
    const quest = QUESTS.find((entry) => entry.id === 72);

    assert.equal(quest.reward.exp, EARLY_QUEST_EXP_CAPS[10]);

    const result = CombatEngine.applyExpGain(player, quest.reward.exp);

    assert.equal(result.levelUps, 1);
    assert.equal(result.updatedPlayer.level, 11);
});

test('quest claim pacing uses current exp to block double level-up bursts near threshold', () => {
    const player = makePlayer({ level: 10, exp: 344, nextExp: 345 });
    const quest = QUESTS.find((entry) => entry.id === 72);

    const pacedExp = getPacedQuestClaimExp(player, quest.reward.exp);
    const result = CombatEngine.applyExpGain(player, pacedExp);

    assert.equal(result.levelUps, 1);
    assert.equal(result.updatedPlayer.level, 11);
    assert.ok(result.updatedPlayer.exp < result.updatedPlayer.nextExp);
});

test('early route pacing keeps first visits and beginner quests below runaway leveling', () => {
    let player = makePlayer({
        level: 1,
        exp: 0,
        nextExp: CONSTANTS.START_NEXT_EXP,
        hp: CONSTANTS.START_HP,
        maxHp: CONSTANTS.START_HP,
        mp: CONSTANTS.START_MP,
        maxMp: CONSTANTS.START_MP,
        atk: 10,
        def: 5,
    });

    // slice 23: 첫 방문 EXP 절반(25/30) + START_NEXT_EXP 200 감속 반영 —
    //   같은 초반 콘텐츠를 전부 소비해도 전직 레벨(Lv5) 직전에서 멈춘다.
    player = applyExp(player, 25); // 고요한 숲 first-visit discovery.
    player = claimQuest(player, 80); // [스토리] 첫 번째 여정.
    player = applyExp(player, 60); // 슬라임 3회 처치.
    player = claimQuest(player, 1); // 슬라임 소탕.
    player = applyExp(player, 30); // 서쪽 평원 first-visit discovery.
    player = applyExp(player, 200); // 멧돼지 5회 처치.
    player = claimQuest(player, 2); // 멧돼지 사냥.
    player = applyExp(player, 200); // 거미떼 10회 처치.
    player = claimQuest(player, 110); // 거미떼 퇴치.

    assert.equal(player.level, 4);
    assert.equal(player.exp, 73);
    assert.equal(player.nextExp, 302);
});

test('late regional rewards rise with the actual route and encounter commitment', () => {
    const expectedRewards = new Map([
        [105, { exp: 14000, gold: 20000 }],
        [106, { exp: 14000, gold: 22000 }],
        [107, { exp: 16000, gold: 25000 }],
        [108, { exp: 18000, gold: 28000 }],
        [109, { exp: 30000, gold: 40000 }],
        [127, { exp: 7000, gold: 12000 }],
        [128, { exp: 8000, gold: 14000 }],
        [129, { exp: 14000, gold: 24000 }],
        [141, { exp: 4500, gold: 7500 }],
        [146, { exp: 9000, gold: 15000 }],
        [147, { exp: 11000, gold: 18000 }],
        [150, { exp: 40000, gold: 55000 }],
        [151, { exp: 50000, gold: 70000 }],
        [152, { exp: 0, gold: 40000 }],
        [153, { exp: 0, gold: 50000 }],
        [154, { exp: 100000, gold: 120000 }],
    ]);

    for (const [questId, reward] of expectedRewards) {
        const quest = getQuest(questId);
        assert.equal(quest.reward.exp, reward.exp, `quest ${questId} exp reward drifted`);
        assert.equal(quest.reward.gold, reward.gold, `quest ${questId} gold reward drifted`);
    }
});

test('late quest rewards contribute to growth without granting a full capped level', () => {
    const player = makePlayer({
        level: 70,
        exp: 0,
        nextExp: BALANCE.EXP_LEVEL_HARD_CAP,
    });
    const questIds = [105, 106, 107, 108, 109, 127, 128, 129, 141, 146, 147, 150, 151, 152, 153, 154];

    for (const questId of questIds) {
        const quest = getQuest(questId);
        const result = CombatEngine.applyExpGain(player, quest.reward.exp);

        assert.equal(result.levelUps, 0, `quest ${questId} should not grant a full capped level`);
        assert.ok(quest.reward.exp < BALANCE.EXP_LEVEL_HARD_CAP);
    }
});
