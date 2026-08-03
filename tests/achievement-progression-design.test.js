import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DB } from '../src/data/db.js';
import {
    ACHIEVEMENT_CATEGORIES,
    buildAchievementJourneys,
    getRecommendedAchievementGoals,
} from '../src/utils/achievementPresentation.js';
import { formatRewardParts } from '../src/utils/gameUtils.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const buildProgress = (currentByTarget = {}, claimed = []) => DB.ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    id: achievement.id,
    title: achievement.title,
    desc: achievement.desc,
    target: achievement.target,
    goal: achievement.goal,
    current: currentByTarget[achievement.target] || 0,
    rewardText: formatRewardParts(achievement.reward || {}).join(' · '),
    unlocked: (currentByTarget[achievement.target] || 0) >= achievement.goal,
    claimed: claimed.includes(achievement.id),
}));

test('73개 업적은 누락 없이 20개 여정과 5개 분야로 묶인다', () => {
    const achievements = buildProgress();
    const journeys = buildAchievementJourneys(achievements);
    const categoryTargets = ACHIEVEMENT_CATEGORIES.flatMap((category) => category.targets);

    assert.equal(achievements.length, 73);
    assert.equal(journeys.length, 20);
    assert.equal(journeys.reduce((sum, journey) => sum + journey.milestones.length, 0), 73);
    assert.equal(new Set(categoryTargets).size, 20);
    assert.deepEqual(new Set(journeys.map((journey) => journey.target)), new Set(categoryTargets));
});

test('다음 목표는 가까운 여정을 분야별로 하나씩 추천한다', () => {
    const achievements = buildProgress({ discoveries: 1, level: 1 });
    const recommended = getRecommendedAchievementGoals(buildAchievementJourneys(achievements));

    assert.equal(recommended.length, 3);
    assert.deepEqual(recommended.map((achievement) => achievement.target), ['discoveries', 'level', 'kills']);
    assert.deepEqual(recommended.map((achievement) => achievement.title), ['호기심 많은 여행자', '성장의 기쁨', '첫 번째 피']);
});

test('보상을 받은 단계 다음에 같은 여정의 다음 목표가 이어진다', () => {
    const achievements = buildProgress({ kills: 12 }, ['ach_first_blood', 'ach_kill_10']);
    const killJourney = buildAchievementJourneys(achievements).find((journey) => journey.target === 'kills');

    assert.ok(killJourney);
    assert.equal(killJourney.claimedCount, 2);
    assert.equal(killJourney.nextMilestone.id, 'ach_kill_50');
    assert.equal(killJourney.nextMilestone.title, '학살자');
});

test('업적 보상에는 에테르 크리스탈도 빠짐없이 표시된다', () => {
    assert.deepEqual(formatRewardParts({ gold: 300000, premiumCurrency: 50 }), [
        '골드 300000',
        '에테르 크리스탈 50',
    ]);
});

test('업적 화면은 다음 목표와 여정별 펼치기를 사용하고 영문 상태 문구를 노출하지 않는다', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/AchievementPanel.tsx'), 'utf8');

    assert.match(source, /data-testid="achievement-next-goals"/);
    assert.match(source, /achievement-category-\$\{entry\.id\}/);
    assert.match(source, /achievement-journey-\$\{journey\.target\}/);
    assert.match(source, /<details/);
    assert.doesNotMatch(source, /['"](?:Achievement Ledger|Locked Records|Unlocked|Claimed|claim)['"]/);
});
