import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRelicChoiceDecisionStrip } from '../src/utils/relicChoiceDecision.ts';
import {
    getRecommendedRelicsForBuild,
    getRelicBuildFit,
    RELIC_EFFECTS_BY_BUILD,
} from '../src/utils/relicBuildFit.ts';
import { formatRelicText, getRelicDisplayName } from '../src/utils/relicPresentation.ts';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.ts';

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
    ], 'balanced');

    assert.equal(decision.recommendedIndex, 1);
    assert.equal(decision.tone, 'synergy');
    assert.deepEqual(decision.cells.map((cell) => cell.label), ['추천', '이유', '성장 방향']);
    assert.equal(decision.cells[0].value, '균열의 서판');
    assert.equal(decision.cells[1].value, '현재 유물과 잘 맞음');
    assert.equal(decision.cells[2].value, '기술 공격');
});

test('strong synergy remains ahead of a legendary build fit', () => {
    const decision = getRelicChoiceDecisionStrip([
        {
            index: 0,
            relic: { id: 'common_synergy', name: '연결된 검', rarity: 'common', effect: 'on_kill_heal' },
            synergy: { score: 80, label: '강한 조합', synergies: ['피의 서약'] },
        },
        {
            index: 1,
            relic: { id: 'legend_fit', name: '불멸의 성벽', rarity: 'legendary', effect: 'fortress' },
            synergy: { score: 0, synergies: [] },
        },
    ], 'fortress');

    assert.equal(decision.recommendedIndex, 0);
    assert.equal(decision.cells[1].value, '현재 유물과 잘 맞음');
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
    ], 'balanced');

    assert.equal(decision.recommendedIndex, 2);
    assert.equal(decision.recommendedId, 'legend_piece');
    assert.equal(decision.tone, 'legendary');
    assert.equal(decision.cells[1].value, '전설 조합 완성');
});

test('relic choice favors a strong build fit over rarity alone', () => {
    const decision = getRelicChoiceDecisionStrip([
        {
            index: 0,
            relic: { id: 'epic_crit', name: '황혼의 파편', rarity: 'epic', effect: 'crit_mp_regen' },
            synergy: { score: 0, synergies: [] },
        },
        {
            index: 1,
            relic: { id: 'healing_core', name: '재생 코어', rarity: 'uncommon', effect: 'battle_start_heal' },
            synergy: { score: 0, synergies: [] },
        },
    ], 'balanced');

    assert.equal(decision.recommendedIndex, 1);
    assert.equal(decision.cells[1].value, '현재 성장과 잘 맞음');
    assert.equal(decision.cells[2].value, '전투 회복');
});

test('relic build guidance uses one valid effect order for every archetype', () => {
    const catalogEffects = new Set(RELICS.map((relic) => relic.effect));

    for (const [buildId, effects] of Object.entries(RELIC_EFFECTS_BY_BUILD)) {
        assert.equal(effects.length, 5, `${buildId} should have five ordered effects`);
        effects.forEach((effect) => assert.ok(catalogEffects.has(effect), `${buildId}: ${effect} should exist`));
        assert.equal(getRelicBuildFit(buildId, effects[0]).score, 40);
    }

    const recommendations = getRecommendedRelicsForBuild(
        RELICS,
        'fortress',
        ['fortress'],
        4,
    );
    assert.equal(recommendations.length, 4);
    assert.ok(recommendations.every((relic) => relic.effect !== 'fortress'));
    assert.equal(recommendations[0].effect, 'reflect');
    assert.equal(new Set(recommendations.map((relic) => relic.effect)).size, recommendations.length);
    assert.deepEqual(getRecommendedRelicsForBuild(RELICS, 'balanced', [], 0), []);
});

test('relic language remains natural for current data and legacy saves', () => {
    assert.equal(getRelicDisplayName('EXP 증폭기'), '경험 증폭기');
    assert.equal(
        formatRelicText('저HP에서 ATK 증가, 스킬 사용 후 MP 회복, 크리 5%, CD 1턴 감소, 드롭률과 버프 시너지'),
        '생명이 낮을 때 공격력 증가, 기술 사용 후 기력 회복, 치명타 5%, 재사용 1턴 감소, 획득 확률과 강화 효과 조합',
    );

    const playerText = [
        ...RELICS.flatMap((relic) => [relic.name, relic.desc]),
        ...RELIC_SYNERGIES.map((synergy) => synergy.desc),
    ].join('\n');
    assert.doesNotMatch(playerText, /\b(?:ATK|DEF|HP|MP|EXP|CD)\b|저HP|킬 스택|스킬|쿨타임|쿨다운|크리(?:티컬)?\b/);
});

test('RelicChoicePanel renders Korean decision labels and recommended marker', async () => {
    const source = await readSrc('src/components/RelicChoicePanel.tsx');
    assert.match(source, /getRelicChoiceDecisionStrip/);
    assert.match(source, /getRunBuildProfile/);
    assert.match(source, /stats\?\.buildProfile \|\| getRunBuildProfile\(player \|\| \{\}, stats \|\| \{\}\)/);
    assert.match(source, /data-testid="relic-choice-decision-strip"/);
    assert.match(source, /data-testid="relic-choice-panel"/);
    assert.match(source, /data-testid="relic-choice-options"/);
    assert.match(source, /aria-label="유물 선택 추천 요약"/);
    assert.match(source, /data-relic-recommended=\{isRecommended \? 'true' : 'false'\}/);
    assert.match(source, /추천/);
    assert.match(source, /유물 선택/);
    assert.match(source, /getRelicDisplayName/);
    assert.match(source, /formatRelicText/);
    assert.match(source, /<RelicIcon relic=\{relic\}/);
    assert.match(source, /grid-cols-\[50px_minmax\(0,1fr\)_18px\]/);
    assert.match(source, /max-h-\[calc\(100dvh-1rem\)\]/);
    assert.doesNotMatch(source, /현재 보유 유물과 직접 공명하는 효과는 없습니다|전설까지 -1|★ 전설 시너지/);
    assert.doesNotMatch(source, /Relic Archive|Legendary Synergy|Linked Relics|Near Legendary/);
});

test('smoke loop verifies relic choice decision strip with deterministic injection', async () => {
    const source = await readSrc('scripts/smoke-gameplay.mjs');
    const testApiSource = await readSrc('src/hooks/useGameTestApi.ts');
    assert.match(source, /verifyRelicChoiceDecisionStrip/);
    assert.match(source, /injectRelicChoice/);
    assert.match(source, /relic-choice-decision-strip/);
    assert.match(source, /02e-relic-choice-decision-strip/);
    assert.match(testApiSource, /injectRelicChoice:[\s\S]*?job: '나이트'[\s\S]*?test_relic_build_weapon[\s\S]*?hands: 1[\s\S]*?offhand: null/);
    assert.match(testApiSource, /RELICS\.find\(\(relic: any\) => relic\.effect === 'fortress'\)/);
});

test('relic choice decision strip has high readability CSS coverage', async () => {
    const source = await readSrc('src/index.css');
    assert.match(source, /\.aether-relic-decision-strip/);
    assert.match(source, /\.aether-relic-decision-cell/);
    assert.match(source, /\.aether-relic-card-recommended/);
    assert.match(source, /\[data-readability-mode="high"\] \.aether-relic-decision-cell/);
    assert.match(source, /\[data-readability-mode="high"\] \.aether-relic-decision-strip/);
});
