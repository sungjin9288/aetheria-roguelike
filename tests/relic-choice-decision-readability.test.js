import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRelicChoiceDecisionStrip } from '../src/utils/relicChoiceDecision.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('relic choice decision strip favors strong synergy over rarity-only value', () => {
    const decision = getRelicChoiceDecisionStrip([
        {
            index: 0,
            relic: { id: 'epic_crit', name: '황혼의 파편', rarity: 'epic', effect: 'crit_mp_regen' },
            synergy: { score: 0, synergies: [] },
        },
        {
            index: 1,
            relic: { id: 'rare_skill', name: '균열의 서판', rarity: 'rare', effect: 'skill_mult' },
            synergy: { score: 80, label: '완벽한 시너지', synergies: ['심해의 매듭'] },
        },
    ]);

    assert.equal(decision.recommendedIndex, 1);
    assert.equal(decision.tone, 'synergy');
    assert.deepEqual(decision.cells.map((cell) => cell.label), ['추천', '이유', '성장 방향']);
    assert.equal(decision.cells[0].value, '균열의 서판');
    assert.equal(decision.cells[1].value, '강한 공명');
    assert.equal(decision.cells[2].value, '스킬 피해');
});

test('relic choice decision strip promotes legendary set completion first', () => {
    const decision = getRelicChoiceDecisionStrip([
        {
            index: 0,
            relic: { id: 'rare_drop', name: '탐욕의 주화', rarity: 'rare', effect: 'drop_rate' },
            synergy: { score: 80, label: '완벽한 시너지', synergies: ['황금 잔'] },
        },
        {
            index: 2,
            relic: { id: 'legend_piece', name: '별의 왕관', rarity: 'uncommon', effect: 'boss_hunter' },
            synergy: { score: 120, label: '전설 시너지 완성!', synergies: ['달의 검', '태양의 방패'], legendaryHint: '천체 군주' },
        },
    ]);

    assert.equal(decision.recommendedIndex, 2);
    assert.equal(decision.recommendedId, 'legend_piece');
    assert.equal(decision.tone, 'legendary');
    assert.equal(decision.cells[1].value, '전설 완성');
});

test('RelicChoicePanel renders Korean decision labels and recommended marker', async () => {
    const source = await readSrc('src/components/RelicChoicePanel.tsx');
    assert.match(source, /getRelicChoiceDecisionStrip/);
    assert.match(source, /data-testid="relic-choice-decision-strip"/);
    assert.match(source, /aria-label="유물 선택 추천 요약"/);
    assert.match(source, /data-relic-recommended=\{isRecommended \? 'true' : 'false'\}/);
    assert.match(source, /추천/);
    assert.match(source, /유물 선택/);
    assert.doesNotMatch(source, /Relic Archive|Legendary Synergy|Linked Relics|Near Legendary/);
});

test('smoke loop verifies relic choice decision strip with deterministic injection', async () => {
    const source = await readSrc('scripts/smoke-gameplay.mjs');
    assert.match(source, /verifyRelicChoiceDecisionStrip/);
    assert.match(source, /injectRelicChoice/);
    assert.match(source, /relic-choice-decision-strip/);
    assert.match(source, /02e-relic-choice-decision-strip/);
});

test('relic choice decision strip has high readability CSS coverage', async () => {
    const source = await readSrc('src/index.css');
    assert.match(source, /\.aether-relic-decision-strip/);
    assert.match(source, /\.aether-relic-decision-cell/);
    assert.match(source, /\.aether-relic-card-recommended/);
    assert.match(source, /\[data-readability-mode="high"\] \.aether-relic-decision-cell/);
    assert.match(source, /\[data-readability-mode="high"\] \.aether-relic-decision-strip/);
});
