/**
 * 2026-10 에테르 유리 — 선택 카드 화면(유물 선택 · 전직 · 계승 · 진 엔딩) 디자인 계약.
 *
 * 렌더 결과로 확인한다(소스 정규식은 마지막 부재 불변식 하나뿐):
 *   1. 금빛 주 행동은 화면마다 하나 이하 — 전직은 확정 하나, 유물 선택은 카드가 선택이라 없다.
 *   2. 계승 · 진 엔딩의 계승 / 계속은 같은 무게의 한 쌍이다(VD-03 소유자 결정 — 둘 다 유리 버튼).
 *   3. 금빛 장식(`.ae-ornate`)은 계승 · 진 엔딩 화면에 하나씩(VD-09).
 *   4. 유물 계열 색 · 직업 단계 색은 토큰 채널이다(VD-07 · VD-13) — 전설은 등급 토큰, 위험 색이 아니다.
 *   5. 회차 규칙의 측정 두 줄은 고른 쪽만 밝힌다(추천 색 없음), 잠긴 비틀기는 칩으로 보인다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';

import { RELICS } from '../src/data/relics.ts';
import { MSG } from '../src/data/messages.ts';
import { getRelicVisual } from '../src/utils/relicVisuals.ts';
import { getAscensionRulePreview } from '../src/utils/ascensionRuleView.ts';
import { ASCENSION_RULES } from '../src/data/ascensionRules.ts';
import RelicChoicePanel from '../src/components/RelicChoicePanel.tsx';
import JobChangePanel from '../src/components/tabs/JobChangePanel.tsx';
import ClassCard from '../src/components/ClassCard.tsx';
import ClassIcon from '../src/components/icons/ClassIcon.tsx';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import TrueEndingScreen from '../src/components/TrueEndingScreen.tsx';
import ChallengeModifierPicker from '../src/components/ChallengeModifierPicker.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

const count = (html, needle) => html.split(needle).length - 1;
const HEX = /#[0-9a-f]{3,8}\b/iu;
const openTag = (html, testId) => {
    const match = html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`, 'u'));
    assert.ok(match, `${testId} 렌더`);
    return match[0];
};

test('유물 계열 색은 토큰 채널이고 전설은 전설 등급 토큰이다', () => {
    for (const relic of RELICS) {
        const visual = getRelicVisual(relic);
        assert.match(visual.tone, /^var\(--aether-[a-z0-9-]+-rgb\)$/u, `${relic.name}: 토큰 채널`);
        assert.ok(!HEX.test(`${visual.color} ${visual.glow}`), `${relic.name}: 하드코딩 색 없음`);
    }
    const legendary = getRelicVisual(RELICS[0], true);
    assert.equal(legendary.category, 'legendary');
    assert.equal(legendary.tone, 'var(--aether-rarity-legendary-rgb)');
    assert.ok(!/threat|life/u.test(legendary.tone), '전설은 위험 · 생명 색이 아니다');
});

test('유물 선택: 금빛 주 행동이 없고 카드는 육각 메달 · 추천 카드는 하나다', () => {
    const offered = RELICS.slice(0, 3);
    const html = renderStatic(createElement(RelicChoicePanel, {
        pendingRelics: offered, dispatch: () => {}, player: makePlayerFixture({ relics: [] }), stats: null,
    }));
    assert.equal(count(html, 'ae-btn-primary'), 0, '카드를 누르는 것이 선택이다');
    assert.equal(count(html, 'data-relic-recommended="true"'), 1, '추천은 한 장');
    assert.equal(count(html, 'class="ae-relic-medal"'), offered.length, '카드마다 메달 하나');
    assert.match(openTag(html, 'relic-choice-skip'), /data-variant="ghost"/u, '넘기기는 낮은 행동');
    assert.ok(!HEX.test(html.replace(/<img[^>]*>/gu, '')), '하드코딩 색 없음');
});

test('전직: 확정 하나만 금빛이고, 잠긴 카드는 잠금 표시를 쓴다', () => {
    const html = renderStatic(createElement(JobChangePanel, {
        player: makePlayerFixture(), actions: { jobChange: () => {} }, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.equal(count(html, 'ae-btn-primary'), 1, '금빛 주 행동은 하나');
    assert.match(openTag(html, 'job-change-confirm'), /ae-btn-primary/u);
    assert.ok(!/\btruncate\b/u.test(html), '정보를 말줄임으로 숨기지 않는다');
    assert.match(html, /class="[^"]*\bae-job-panel\b[^"]*\baether-focus-panel\b/u, '작업 패널 껍데기는 그대로');

    const locked = renderStatic(createElement(ClassCard, { jobName: '팔라딘', onSelect: () => {}, disabled: true, selected: false }));
    assert.match(locked, /aether-locked-row/u);
    assert.match(locked, /aether-lock-note/u);
    assert.ok(locked.includes(MSG.JOB_CHANGE_LEVEL_SHORT(45)), '잠금 레벨');
    assert.ok(!/lucide-chevron-right/u.test(locked), '넘김 화살표 없음(UX-11)');
});

test('직업 단계 색은 토큰 채널이다', () => {
    for (const tier of [0, 1, 2, 3]) {
        const html = renderStatic(createElement(ClassIcon, { className: '전사', size: 28, tier }));
        assert.match(html, /--ae-class-tone:var\(--aether-[a-z0-9-]+-rgb\)/u, `단계 ${tier}`);
        assert.ok(!HEX.test(html), `단계 ${tier}: 하드코딩 색 없음`);
    }
});

test('계승: 금빛 장식 하나, 계승 · 계속은 같은 무게(유리), 금빛 주 행동 없음', () => {
    const html = renderStatic(createElement(AscensionScreen, { player: makePlayerFixture(), onOpenMirror: () => {} }));
    assert.equal(count(html, 'ae-ornate'), 1, '장식은 계승 보상 칸 하나');
    assert.match(openTag(html, 'ascension-primary-reward'), /ae-ornate/u);
    assert.equal(count(html, 'ae-btn-primary'), 0);
    assert.match(openTag(html, 'ascension-confirm'), /data-variant="glass"/u);
    assert.match(openTag(html, 'ascension-cancel'), /data-variant="glass"/u);
    assert.ok(!html.includes('✦'), '이모지 글리프 없음(VD-13)');
    assert.match(html, /class="ae-scrim"/u, '덮개는 공용 덮개');
});

test('진 엔딩: 제목 칸 하나만 금빛 장식이고 제목은 대문자 자간을 쓰지 않는다', () => {
    const html = renderStatic(createElement(TrueEndingScreen, { player: makePlayerFixture() }));
    assert.equal(count(html, 'ae-ornate'), 1);
    const title = html.match(/<h1 class="([^"]*)">([^<]*)<\/h1>/u);
    assert.ok(title, '제목');
    assert.equal(title[2], MSG.TRUE_ENDING_TITLE);
    assert.ok(!/uppercase|tracking-/u.test(title[1]), '한국어 제목에 대문자 · 자간 없음');
    assert.match(openTag(html, 'true-ending-skip'), /min-h-\[44px\]/u);
});

test('회차 규칙: 측정 두 줄은 고른 쪽만 밝히고, 잠긴 비틀기는 칩으로 보인다', () => {
    const optional = ASCENSION_RULES.find((rule) => rule.optional);
    assert.ok(optional, '선택형 규칙이 있다');
    const rank = ASCENSION_RULES.indexOf(optional) + 1;
    const preview = getAscensionRulePreview({ prestigeRank: rank });
    const render = (ruleDeclined) => renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: preview, ruleDeclined,
    }));
    const accepted = render(false);
    assert.match(openTag(accepted, 'probe-ascension-rule-outlook-accepted'), /data-selected="true"/u);
    assert.match(openTag(accepted, 'probe-ascension-rule-outlook-declined'), /data-selected="false"/u);
    assert.ok(!/orange|rose|emerald|amber/u.test(openTag(accepted, 'probe-ascension-rule-outlook')), '추천 색 없음');
    assert.match(accepted, /data-testid="probe-ascension-rule-locked"/u);
    assert.match(accepted, /class="ae-chip ae-chip-gold/u);

    const declined = render(true);
    assert.match(openTag(declined, 'probe-ascension-rule-outlook-declined'), /data-selected="true"/u);
    assert.match(openTag(declined, 'probe-ascension-rule-outlook-accepted'), /data-selected="false"[^>]*text-ae-ink-3/u, '고르지 않은 쪽은 낮춘다');
    assert.ok(!declined.includes('probe-ascension-rule-locked'), '거절하면 잠긴 비틀기가 없다');
});

test('부재 불변식: 선택 카드 화면 소스에 옛 색 · 임의 모서리 · 옛 행동 버튼 클래스가 없다', async () => {
    const files = [
        'src/components/RelicChoicePanel.tsx', 'src/components/tabs/JobChangePanel.tsx', 'src/components/ClassCard.tsx',
        'src/components/ClassJourneySummary.tsx', 'src/components/ChallengeModifierPicker.tsx', 'src/components/AscensionScreen.tsx',
        'src/components/AscensionGrowthTable.tsx', 'src/components/AscensionCycleSummary.tsx', 'src/components/PendingQuestRewardList.tsx',
        'src/components/TrueEndingScreen.tsx', 'src/components/EndgameJourney.tsx', 'src/components/icons/ClassIcon.tsx',
        'src/components/icons/RelicIcon.tsx', 'src/utils/relicVisuals.ts',
    ];
    for (const file of files) {
        const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
        const code = source.replace(/\/\/.*$/gmu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
        assert.ok(!/text-slate-|bg-slate-|text-white\b|border-white\/|bg-black\//u.test(code), `${file}: 옛 회색 · 흰색 클래스`);
        assert.ok(!/rounded-\[/u.test(code), `${file}: 임의 모서리`);
        assert.ok(!/aether-cta-|aether-action-button|panel-noise/u.test(code), `${file}: 옛 행동 버튼 · 패널`);
        assert.ok(!/['"`]#[0-9a-f]{3,8}\b/iu.test(code) && !/\[#[0-9a-f]{3,8}\]/iu.test(code), `${file}: 하드코딩 색`);
    }
});
