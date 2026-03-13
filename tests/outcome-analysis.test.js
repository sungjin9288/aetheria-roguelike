import test from 'node:test';
import assert from 'node:assert/strict';

import { getPostCombatAnalysis, getRunSummaryAnalysis } from '../src/utils/outcomeAnalysis.js';

test('post combat analysis flags risky wins and recovery actions', () => {
    const analysis = getPostCombatAnalysis({
        enemy: '재앙의 망령',
        enemyTier: 'ELITE',
        difficultyLabel: '열세',
        primaryBuild: '광전 도박',
        playerHp: 28,
        playerMaxHp: 180,
        playerMp: 12,
        playerMaxMp: 80,
        invFull: true,
        items: ['검은 수정'],
    });

    assert.equal(analysis.grade, '붕괴 직전');
    assert.equal(analysis.rewardMood, '강적 제압');
    assert.ok(analysis.notes.some((note) => note.includes('엘리트')));
    assert.ok(analysis.actions.some((action) => action.includes('회복')));
    assert.ok(analysis.actions.some((action) => action.includes('인벤토리')));
    assert.ok(analysis.rewardHighlights.some((entry) => entry.includes('ELITE')));
});

test('run summary analysis recommends a next-run focus from weak runs', () => {
    const analysis = getRunSummaryAnalysis({
        level: 9,
        kills: 18,
        bossKills: 0,
        relicsFound: 1,
        totalGold: 900,
        primaryBuild: '균형형 런',
        difficultyLabel: '위기',
        recentWinRate: 42,
    });

    assert.equal(analysis.headline, '초반 안정화가 필요한 런');
    assert.ok(analysis.notes.some((note) => note.includes('균형형 런')));
    assert.ok(analysis.focus.some((focus) => focus.includes('유물')));
});
