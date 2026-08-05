import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SEASON_REWARDS } from '../src/data/seasonPass.js';
import { AT } from '../src/reducers/actionTypes.js';
import { rewardActionMap } from '../src/reducers/handlers/rewardHandlers.js';
import {
    buildSeasonChapters,
    formatSeasonRewardParts,
    getClaimableSeasonRewards,
    getNextSeasonRewards,
    getSeasonProgress,
    normalizeClaimedSeasonTiers,
    SEASON_MAX_XP,
} from '../src/utils/seasonPassPresentation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const makeState = ({ tier = 3, xp = 650, claimed = [1, 2], isPremium = false } = {}) => ({
    player: {
        gold: 100,
        premiumCurrency: 0,
        inv: [],
        titles: [],
        seasonPass: { tier, xp, claimed, isPremium, seasonId: 'S1' },
    },
    logs: [],
    syncStatus: 'synced',
});

test('30개 시즌 보상은 누락 없이 10단계씩 세 구간으로 묶인다', () => {
    const chapters = buildSeasonChapters(SEASON_REWARDS);

    assert.equal(chapters.length, 3);
    assert.deepEqual(chapters.map((chapter) => chapter.rewards.length), [10, 10, 10]);
    assert.deepEqual(chapters.flatMap((chapter) => chapter.rewards.map((row) => row.tier)),
        Array.from({ length: 30 }, (_, index) => index + 1));
});

test('시즌 진행은 가까운 보상과 받을 보상을 분리한다', () => {
    assert.deepEqual(getClaimableSeasonRewards(SEASON_REWARDS, 3, [1, 2]).map((row) => row.tier), [3]);
    assert.deepEqual(getNextSeasonRewards(SEASON_REWARDS, 3).map((row) => row.tier), [4, 5, 6]);
    assert.deepEqual(formatSeasonRewardParts({ gold: 2000, title: '시즌 선구자' }), [
        '골드 2,000',
        '칭호 시즌 선구자',
    ]);
    assert.deepEqual(getSeasonProgress(650, 0), {
        tier: 3,
        totalXp: 650,
        currentXp: 50,
        remainingXp: 150,
        completed: false,
        percent: 25,
    });
});

test('이전 저장의 시즌 보상 식별자도 중복 수령으로 이어지지 않는다', () => {
    assert.deepEqual(normalizeClaimedSeasonTiers(['s1_t1', '2', 3, 'broken']), [1, 2, 3]);

    const state = makeState({ claimed: ['s1_t3'] });
    const replayed = rewardActionMap.CLAIM_SEASON_REWARD(state, {
        type: AT.CLAIM_SEASON_REWARD,
        payload: { tier: 3 },
    });
    assert.equal(replayed, state);
});

test('잠긴 시즌 보상은 reducer 권한 경계에서 거부된다', () => {
    const state = makeState();
    const lockedClaim = rewardActionMap.CLAIM_SEASON_REWARD(state, {
        type: AT.CLAIM_SEASON_REWARD,
        payload: { tier: 30 },
    });

    assert.equal(lockedClaim, state);
    assert.equal(lockedClaim.player.gold, 100);
});

test('해금된 시즌 보상은 한 번만 지급되고 기존 프리미엄 저장도 보존한다', () => {
    const freeState = makeState();
    const action = { type: AT.CLAIM_SEASON_REWARD, payload: { tier: 3 } };
    const claimed = rewardActionMap.CLAIM_SEASON_REWARD(freeState, action);
    const replayed = rewardActionMap.CLAIM_SEASON_REWARD(claimed, action);

    assert.equal(claimed.player.gold, 900);
    assert.deepEqual(claimed.player.seasonPass.claimed, [1, 2, 3]);
    assert.deepEqual(claimed.logs.map((log) => log.text), ['시즌 3단계 보상 · 골드 800']);
    assert.equal(replayed, claimed);

    const premiumState = makeState({ isPremium: true });
    const premiumClaimed = rewardActionMap.CLAIM_SEASON_REWARD(premiumState, action);
    assert.equal(premiumClaimed.player.gold, 900);
    assert.equal(premiumClaimed.player.premiumCurrency, 5);
    assert.deepEqual(premiumClaimed.logs.map((log) => log.text), [
        '시즌 3단계 보상 · 골드 800 · 에테르 크리스탈 5',
    ]);
});

test('시즌 경험은 양수만 반영하고 마지막 단계에서 고정된다', () => {
    const state = makeState({ tier: 29, xp: SEASON_MAX_XP - 10, claimed: [] });
    const invalid = rewardActionMap.ADD_SEASON_XP(state, { type: AT.ADD_SEASON_XP, payload: -50 });
    const completed = rewardActionMap.ADD_SEASON_XP(state, { type: AT.ADD_SEASON_XP, payload: 100 });
    const overflow = rewardActionMap.ADD_SEASON_XP(completed, { type: AT.ADD_SEASON_XP, payload: 100 });

    assert.equal(invalid, state);
    assert.equal(completed.player.seasonPass.xp, SEASON_MAX_XP);
    assert.equal(completed.player.seasonPass.tier, 30);
    assert.equal(overflow, completed);
    assert.deepEqual(getSeasonProgress(SEASON_MAX_XP + 500, 30), {
        tier: 30,
        totalXp: SEASON_MAX_XP,
        currentXp: 200,
        remainingXp: 0,
        completed: true,
        percent: 100,
    });
});

test('시즌 화면은 현재 진행과 세 구간 여정을 우선하고 가짜 프리미엄 안내를 제거한다', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/tabs/SeasonPassPanel.tsx'), 'utf8');

    assert.match(source, /data-testid="season-journey-panel"/);
    assert.match(source, /data-testid="season-next-rewards"/);
    assert.match(source, /season-chapter-\$\{chapter\.id\}/);
    assert.match(source, /<details/);
    assert.doesNotMatch(source, /text-\[(?:8|9|10)px\]|max-h-\[360px\]|overflow-y-auto/);
    assert.doesNotMatch(source, /SEASON PASS|PREMIUM|FREE|추후 업데이트 예정/);
});
