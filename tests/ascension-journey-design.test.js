import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { BALANCE } from '../src/data/constants.ts';
import { getAscensionOutcome, PRESTIGE_MILESTONES } from '../src/utils/ascensionPreview.ts';

test('ascension outcome keeps existing meta and calculates the exact next permanent growth', () => {
    const mirror = { start_gold: 2, revive: 1 };
    const storyMilestones = { seen: ['first_death'], pending: [] };
    const outcome = getAscensionOutcome({
        prestigeRank: 2,
        essence: 180,
        bonusAtk: 10,
        bonusHp: 50,
        bonusMp: 30,
        mirror,
        storyMilestones,
    });

    assert.equal(outcome.currentRank, 2);
    assert.equal(outcome.nextRank, 3);
    assert.equal(outcome.title, '심연의 탐험가');
    assert.equal(outcome.meta.essence, 180 + BALANCE.PRESTIGE_ESSENCE_REWARD);
    assert.equal(outcome.meta.bonusAtk, 10 + BALANCE.PRESTIGE_ATK_BONUS);
    assert.equal(outcome.meta.bonusHp, 50 + BALANCE.PRESTIGE_HP_BONUS);
    assert.equal(outcome.meta.bonusMp, 30 + BALANCE.PRESTIGE_MP_BONUS);
    assert.deepEqual(outcome.meta.mirror, mirror);
    assert.deepEqual(outcome.meta.storyMilestones, storyMilestones);
});

test('ascension outcome compares current and next world difficulty with matching balance constants', () => {
    const outcome = getAscensionOutcome({ prestigeRank: 2 });

    assert.equal(outcome.currentEnemyStatPercent, 10);
    assert.equal(outcome.nextEnemyStatPercent, 15);
    assert.equal(outcome.currentEnemyRewardPercent, 16);
    assert.equal(outcome.nextEnemyRewardPercent, 24);
});

test('ascension milestone ladder exposes only implemented ranks and the next long-term target', () => {
    assert.deepEqual(PRESTIGE_MILESTONES.map((entry) => entry.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const rankThree = getAscensionOutcome({ prestigeRank: 2 });
    assert.equal(rankThree.milestone?.name, '심연의 메아리');
    assert.equal(rankThree.upcomingMilestone?.rank, 4);

    const beyondLadder = getAscensionOutcome({ prestigeRank: 10 });
    assert.equal(beyondLadder.milestone, null);
    assert.equal(beyondLadder.upcomingMilestone, null);
});

test('ascension preview and confirmation share one outcome model', async () => {
    const [screen, action] = await Promise.all([
        readFile(new URL('../src/components/AscensionScreen.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/hooks/gameActions/ascensionActions.ts', import.meta.url), 'utf8'),
    ]);

    assert.match(screen, /getAscensionOutcome\(player\.meta\)/);
    assert.match(action, /getAscensionOutcome\(player\.meta\)/);
    assert.doesNotMatch(action, /essence:\s*\(meta\.essence\s*\|\|\s*0\)\s*\+\s*200/);
});

test('ascension screen keeps irreversible controls outside the scroll region', async () => {
    const source = await readFile(new URL('../src/components/AscensionScreen.tsx', import.meta.url), 'utf8');
    const scrollIndex = source.indexOf('data-testid="ascension-scroll-region"');
    const footerIndex = source.indexOf('<footer');
    const cancelIndex = source.indexOf('data-testid="ascension-cancel"');
    const confirmIndex = source.indexOf('data-testid="ascension-confirm"');

    assert.ok(scrollIndex >= 0);
    assert.ok(footerIndex > scrollIndex);
    assert.ok(cancelIndex > footerIndex);
    assert.ok(confirmIndex > footerIndex);
    assert.match(source, /새로 시작하는 것/);
    assert.match(source, /그대로 남는 것/);
});
