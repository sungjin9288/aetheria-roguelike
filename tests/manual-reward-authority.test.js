import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DB } from '../src/data/db.js';
import { SEASON_XP } from '../src/data/seasonPass.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const makeState = (playerPatch = {}) => ({
    ...INITIAL_STATE,
    player: {
        ...structuredClone(INITIAL_STATE.player),
        ...playerPatch,
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            ...(playerPatch.stats || {}),
        },
        seasonPass: {
            ...structuredClone(INITIAL_STATE.player.seasonPass),
            ...(playerPatch.seasonPass || {}),
        },
    },
    logs: [],
    syncStatus: 'synced',
});

test('일반 임무 보상은 canonical 정의를 최신 state에 한 번만 적용한다', () => {
    const quest = DB.QUESTS.find((entry) => entry.id === 1);
    const state = makeState({
        gold: 100,
        exp: 0,
        nextExp: 200,
        quests: [{ id: quest.id, progress: quest.goal, isBounty: false }],
        expeditionFocusQuestIds: [quest.id],
        stats: { total_gold: 0, claimedQuestIds: [] },
        seasonPass: { xp: 0, tier: 0, claimed: [] },
    });
    const action = {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: quest.id, reward: { gold: 999999, exp: 999999 } },
    };

    const claimed = gameReducer(state, action);
    const replayed = gameReducer(claimed, action);

    assert.equal(claimed.player.gold, 100 + quest.reward.gold);
    assert.equal(claimed.player.exp, quest.reward.exp);
    assert.equal(claimed.player.stats.total_gold, quest.reward.gold);
    assert.equal(claimed.player.quests.some((entry) => entry.id === quest.id), false);
    assert.deepEqual(claimed.player.expeditionFocusQuestIds, []);
    assert.deepEqual(claimed.player.stats.claimedQuestIds, [quest.id]);
    assert.equal(claimed.player.seasonPass.xp, SEASON_XP.questComplete);
    assert.equal(claimed.questClaimReceipt.questId, quest.id);
    assert.match(claimed.logs.at(-1).text, new RegExp(quest.title));
    assert.equal(replayed, claimed);
});

test('미완료·존재하지 않는 임무 보상 요청은 reducer에서 거부한다', () => {
    const quest = DB.QUESTS.find((entry) => entry.id === 1);
    const state = makeState({
        quests: [{ id: quest.id, progress: quest.goal - 1, isBounty: false }],
    });

    assert.equal(gameReducer(state, {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: quest.id },
    }), state);
    assert.equal(gameReducer(state, {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: 'forged-quest' },
    }), state);
});

test('현상수배 보상도 활성 임무의 값으로 한 번만 지급한다', () => {
    const bounty = {
        id: 'bounty-authority-test',
        title: '[현상수배] 물의 정령 토벌',
        target: '물의 정령',
        goal: 8,
        progress: 8,
        reward: { exp: 16, gold: 24 },
        isBounty: true,
    };
    const state = makeState({
        gold: 100,
        quests: [bounty],
        expeditionFocusQuestIds: [bounty.id],
        stats: { total_gold: 0, bountiesCompleted: 0, claimedQuestIds: [] },
    });
    const action = {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: bounty.id, reward: { gold: 999999 } },
    };

    const claimed = gameReducer(state, action);

    assert.equal(claimed.player.gold, 124);
    assert.equal(claimed.player.stats.total_gold, 24);
    assert.equal(claimed.player.stats.bountiesCompleted, 1);
    assert.deepEqual(claimed.player.stats.claimedQuestIds, []);
    assert.equal(gameReducer(claimed, action), claimed);
});

test('임무의 아이템·칭호·레벨업 결과를 reducer 이동 뒤에도 보존한다', () => {
    const itemQuest = DB.QUESTS.find((entry) => entry.id === 3);
    const itemState = makeState({
        inv: [],
        quests: [{ id: itemQuest.id, progress: itemQuest.goal, isBounty: false }],
    });
    const itemClaimed = gameReducer(itemState, {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: itemQuest.id },
    });
    assert.deepEqual(itemClaimed.player.inv.map((item) => item.name), [itemQuest.reward.item]);

    const titleQuest = DB.QUESTS.find((entry) => entry.id === 152);
    const titleState = makeState({
        titles: [],
        activeTitle: null,
        quests: [{ id: titleQuest.id, progress: titleQuest.goal, isBounty: false }],
    });
    const titleClaimed = gameReducer(titleState, {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: titleQuest.id },
    });
    assert.ok(titleClaimed.player.titles.includes(titleQuest.reward.title));
    assert.equal(titleClaimed.player.activeTitle, titleQuest.reward.title);

    const levelQuest = DB.QUESTS.find((entry) => entry.id === 1);
    const levelState = makeState({
        level: 1,
        exp: 190,
        nextExp: 200,
        quests: [{ id: levelQuest.id, progress: levelQuest.goal, isBounty: false }],
    });
    const levelClaimed = gameReducer(levelState, {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: levelQuest.id },
    });
    assert.equal(levelClaimed.player.level, 2);
    assert.equal(levelClaimed.player.exp, 30);
    assert.equal(levelClaimed.visualEffect, 'levelUp');
    assert.equal(levelClaimed.logs.filter((log) => log.text.includes('레벨 2')).length, 1);
});

test('업적 보상은 달성 여부와 canonical 보상을 reducer에서 검증하고 재수령을 막는다', () => {
    const achievement = DB.ACHIEVEMENTS.find((entry) => entry.id === 'ach_kill_100');
    const state = makeState({
        gold: 100,
        inv: [],
        stats: { kills: achievement.goal, total_gold: 0, claimedAchievements: [] },
    });
    const action = {
        type: AT.CLAIM_ACHIEVEMENT_REWARD,
        payload: {
            achievementId: achievement.id,
            reward: { gold: 999999, premiumCurrency: 999999 },
        },
    };

    const claimed = gameReducer(state, action);

    assert.equal(claimed.player.gold, 100 + achievement.reward.gold);
    assert.equal(claimed.player.premiumCurrency, 0);
    assert.equal(claimed.player.stats.total_gold, achievement.reward.gold);
    assert.deepEqual(claimed.player.stats.claimedAchievements, [achievement.id]);
    assert.deepEqual(claimed.player.inv.map((item) => item.name), [achievement.reward.item]);
    assert.match(claimed.logs.at(-1).text, new RegExp(achievement.title));
    assert.equal(gameReducer(claimed, action), claimed);

    const locked = makeState({ stats: { kills: achievement.goal - 1, claimedAchievements: [] } });
    assert.equal(gameReducer(locked, action), locked);
});

test('업적의 에테르 크리스탈 보상도 canonical 값으로 지급한다', () => {
    const achievement = DB.ACHIEVEMENTS.find((entry) => entry.id === 'ach_abyss_200');
    const state = makeState({
        gold: 0,
        premiumCurrency: 3,
        stats: { abyssRecord: achievement.goal, claimedAchievements: [] },
    });

    const claimed = gameReducer(state, {
        type: AT.CLAIM_ACHIEVEMENT_REWARD,
        payload: { achievementId: achievement.id, premiumCurrency: 999999 },
    });

    assert.equal(claimed.player.gold, achievement.reward.gold);
    assert.equal(claimed.player.premiumCurrency, 3 + achievement.reward.premiumCurrency);
});

test('수령 hook은 보상 객체를 만들지 않고 식별자만 reducer에 전달한다', async () => {
    const source = await readFile(path.join(ROOT, 'src/hooks/useInventoryActions.rewards.ts'), 'utf8');

    assert.match(source, /dispatch\(\{ type: AT\.CLAIM_QUEST_REWARD, payload: \{ questId: qId \} \}\)/);
    assert.match(source, /dispatch\(\{ type: AT\.CLAIM_ACHIEVEMENT_REWARD, payload: \{ achievementId: achId \} \}\)/);
    assert.doesNotMatch(source, /dispatch\(\{ type: AT\.SET_PLAYER/);
    assert.doesNotMatch(source, /grantGold|addItemByName|CombatEngine\.applyExpGain/);
});
