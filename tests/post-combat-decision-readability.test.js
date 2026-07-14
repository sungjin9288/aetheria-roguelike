import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getPostCombatDecisionStrip } from '../src/utils/outcomeAnalysis.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('post combat decision strip prioritizes recovery when HP is low', () => {
    const strip = getPostCombatDecisionStrip({
        enemy: '테스트 적',
        exp: 24,
        gold: 12,
        items: ['녹슨 검'],
        playerHp: 20,
        playerMaxHp: 100,
        playerMp: 40,
        playerMaxMp: 60,
    });

    assert.equal(strip.tone, 'pressure');
    assert.deepEqual(strip.cells, [
        { label: '상태', value: 'HP 회복' },
        { label: '보상', value: '전리품 1개' },
        { label: '다음 행동', value: '휴식' },
    ]);
});

test('post combat decision strip promotes signature rewards without altering loot', () => {
    const strip = getPostCombatDecisionStrip(
        {
            enemy: '테스트 보스',
            enemyTier: 'BOSS',
            exp: 140,
            gold: 220,
            items: ['전설 각인', '강철 롱소드'],
            playerHp: 90,
            playerMaxHp: 100,
            playerMp: 42,
            playerMaxMp: 60,
            upgradeHint: { name: '강철 롱소드', summary: 'ATK +4' },
        },
        { signatureLootCount: 1, nonSignatureLootCount: 1 }
    );

    assert.equal(strip.tone, 'reward');
    assert.deepEqual(strip.cells, [
        { label: '상태', value: '정비 권장' },
        { label: '보상', value: '전설 1개' },
        { label: '다음 행동', value: '장비 확인' },
    ]);
});

test('PostCombatCard renders direct Korean decision labels', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');

    assert.match(source, /getPostCombatDecisionStrip/);
    assert.match(source, /data-testid="post-combat-decision-strip"/);
    assert.match(source, /data-result-tone=\{decisionStrip\.tone\}/);
    assert.match(source, /aria-label="전투 결과 판단 요약"/);
});

test('smoke loop verifies the post combat decision strip after victory', async () => {
    const source = await readSrc('scripts/smoke-gameplay.mjs');

    assert.match(source, /verifyPostCombatDecisionStrip/);
    assert.match(source, /post-combat-decision-strip/);
    assert.match(source, /상태/);
    assert.match(source, /보상/);
    assert.match(source, /다음 행동/);
});

test('post combat decision strip has high readability CSS coverage', async () => {
    const css = await readSrc('src/index.css');

    assert.match(css, /\.aether-result-strip/);
    assert.match(css, /\.aether-result-cell/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-result-strip/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-result-cell/);
});
