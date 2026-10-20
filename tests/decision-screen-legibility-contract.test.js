// 2026-10 Wave 132(원장 §145, 소유자 결정 "두 화면 모두") — 고르는 화면 · 돌아보는 화면도 11px 하한 안이다.
//
// 통합 수용 6차(§144)가 문서 전체를 재다가 유물 선택 화면의 판단 칸 이름("추천" · "이유" · "성장 방향" 9px) · 조합 줄 10px,
// 사망 화면의 수치 칩 · 결과 분석 머리말 · 메모 10px을 찾았다. 가독성 계약(`mobile-legibility`)이 재지 않는 자리였다.
// 11px로 올려도 가로 넘침 · 잘림은 0이고 높이는 +3 ~ 21px였다(375 · 390 · 430 실측).
//
// e2e는 시나리오가 그리는 줄만 잰다 — 조합 완성 · 1개 남음 · 조합 시작 · 함께 쓰기 · 대가 · 교체 모드 · 부분 집계 안내는
// 갈래마다 다르게 나온다. 이 계약은 그 갈래를 모두 렌더해 글자 크기 클래스와 말줄임을 본다(실제 크기는 e2e가 잰다).
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { MSG } from '../src/data/messages.ts';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.ts';
import { getRelicSynergyScore } from '../src/utils/relicSynergyHint.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';
import { buildRunSummary } from '../src/utils/gameUtils.ts';
import RelicChoicePanel from '../src/components/RelicChoicePanel.tsx';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

const FLOOR_PX = 11;
const BY_NAME = Object.fromEntries(RELICS.map((relic) => [relic.name, relic]));
const FILLERS = RELICS.filter((relic) => relic.rarity === 'common'
    && !RELIC_SYNERGIES.some((syn) => syn.requires.includes(relic.name)));

/** 렌더 결과의 글자 크기 클래스 중 하한보다 작은 것(`text-[10px]` · `sm:text-[0.6rem]` …). */
const undersizedClasses = (html) => {
    const found = [];
    for (const [, classes] of html.matchAll(/class="([^"]*)"/gu)) {
        for (const token of classes.split(/\s+/u)) {
            const match = token.match(/(?:^|:)text-\[(\d*\.?\d+)(px|rem)\]$/u);
            if (!match) continue;
            const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
            if (px < FLOOR_PX) found.push(token);
        }
    }
    return found;
};

const renderChoice = (pendingRelics, relics, meta = {}) => renderStatic(React.createElement(RelicChoicePanel, {
    pendingRelics,
    dispatch: () => {},
    player: makePlayerFixture({ relics, meta }),
    stats: null,
}));

/** 카드 줄의 모든 갈래 — 조합마다 완성 · 1개 남음 · 시작, 효과 짝 하나, 교체 모드. */
const choiceRenders = () => {
    const renders = [];
    for (const syn of RELIC_SYNERGIES) {
        const pieces = syn.requires.map((name) => BY_NAME[name]);
        const last = pieces[pieces.length - 1];
        renders.push({ kind: 'complete', html: renderChoice([last, FILLERS[0], FILLERS[1]], pieces.slice(0, -1)) });
        if (pieces.length === 3) renders.push({ kind: 'near', html: renderChoice([pieces[1], FILLERS[0], FILLERS[1]], [pieces[0]]) });
        renders.push({ kind: 'start', html: renderChoice([pieces[0], FILLERS[0], FILLERS[1]], []) });
    }
    // 효과 짝("함께 쓰기") — 조합 줄이 아닌 짝 점수만 있는 실제 한 쌍을 찾는다.
    const pairEffect = RELICS.flatMap((owner) => RELICS.filter((candidate) => candidate.id !== owner.id).map((candidate) => ({ owner, candidate })))
        .find(({ owner, candidate }) => {
            const score = getRelicSynergyScore(candidate, [owner]);
            return score.score > 0 && score.synergies.length > 0 && !score.legendaryHint && !score.completesPair && !score.nearLegendary && !score.startsCombo;
        });
    assert.ok(pairEffect, '효과 짝 사례');
    renders.push({ kind: 'pair-effect', html: renderChoice([pairEffect.candidate, FILLERS[0], FILLERS[1]], [pairEffect.owner]) });
    const capacity = getPrestigeUnlocks(0).maxRelics;
    const owned = RELICS.slice(0, capacity);
    const offered = RELICS.find((relic) => !owned.some((entry) => entry.id === relic.id));
    renders.push({ kind: 'replace', html: renderChoice([offered], owned) });
    return renders;
};

test('[유물 선택] 모든 카드 줄 갈래 · 교체 모드에 11px 미만 글자 크기가 없고 말줄임도 없다', () => {
    const renders = choiceRenders();
    const all = renders.map(({ html }) => html).join('\n');
    // 갈래가 실제로 그려졌다(빈 렌더로 통과하지 않게).
    assert.ok(all.includes('data-testid="relic-choice-decision-strip"'));
    assert.ok(/data-testid="relic-choice-\d-pair"/u.test(all), '두 조각 완성 줄');
    assert.ok(/data-testid="relic-choice-\d-start"/u.test(all), '조합 시작 줄');
    assert.ok(/data-testid="relic-choice-\d-drawback"/u.test(all), '조합 대가 줄');
    assert.ok(all.includes('까지 1개 남음'), '세 조각 진행 줄');
    assert.ok(all.includes('함께 쓰기'), '효과 짝 줄');
    assert.ok(renders.find(({ kind }) => kind === 'replace').html.includes('data-testid="relic-replace-options"'), '교체 모드');
    for (const { kind, html } of renders) {
        assert.deepEqual(undersizedClasses(html), [], kind);
        // 함께 쓰기 좋은 유물 이름 · 교체할 유물의 효과는 고를 근거다 — 말줄임으로 숨기지 않는다(Wave 67 규칙).
        assert.doesNotMatch(html, /class="[^"]*\btruncate\b/u, kind);
    }
});

test('[사망 화면] 부분 집계 안내 · 수치 칩 · 머리말 · 메모 · 각인 줄까지 11px 미만이 없고, 정보 줄은 말줄임 대신 줄을 넘긴다', () => {
    const player = makePlayerFixture({
        level: 52,
        loc: '에테르 관문',
        activeTitle: 'stacked_rule_conqueror_6',
        meta: { prestigeRank: 3 },
        stats: { escapes: 2, kills: 142, bossKills: 3 },
    });
    const runSummary = {
        ...buildRunSummary(player, player.loc),
        runTrackingComplete: false,
        escapes: 2,
        discoveries: 16,
        maxKillStreak: 12,
        prestigeRank: 3,
    };
    const html = renderStatic(React.createElement(RunSummaryCard, { runSummary, onRestart: () => {} }));
    assert.ok(html.includes(MSG.RUN_SUMMARY_PARTIAL_TRACKING), '부분 집계 안내');
    assert.ok(html.includes('data-testid="run-summary-extras"'), '수치 칩');
    assert.ok(html.includes('data-testid="run-summary-notes"'), '메모');
    assert.ok(html.includes('data-testid="run-summary-headline"'), '머리말');
    assert.deepEqual(undersizedClasses(html), []);
    for (const id of ['run-summary-headline', 'run-summary-ended-at']) {
        const tag = html.match(new RegExp(`<[^>]*data-testid="${id}"[^>]*>`, 'u'))?.[0] || '';
        assert.ok(tag, id);
        assert.doesNotMatch(tag, /\btruncate\b/u, id);
    }
});
