// 2026-10 감사 UX-14 — 남은 이름 불일치와 구조 잔재.
//
// Wave 131(한 개념 한 이름) 밖에 남아 있던 것들이다.
//   ① 사망 화면 한 장이 다음 판을 '다음 시도' · '다음 시도 추천'과 '다음 여정에 남는 것'으로 함께 불렀고, 돌아보기 칸은
//      "연속 처치 운영 유효" · "보스권 도달" 같은 전보체 · 은어였다.
//   ② 설정 탭 '장기 성장'이 "모은 에테르를 필요한 곳에 사용합니다"라고 했다 — 그 아래 두 단추가 쓰는 재화는 계승 정수와 크리스탈이다.
//   ③ 기록 '설정' 탭의 아이콘이 전투 '기술' 단추와 같은 번개(Zap)였다.
//   ④ 묘비 탭에 누를 것 없는 탭 하나('내 유해')가 남아 화면 낭독기가 "탭 1/1"로 읽었다(Wave 70이 다른 탭을 지운 뒤).
// 모두 실제 렌더 · 실제 판정 함수로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.ts';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import Dashboard from '../src/components/Dashboard.tsx';
import GravePanel from '../src/components/GravePanel.tsx';
import { buildRunSummary } from '../src/utils/gameUtils.ts';
import { getRunSummaryAnalysis, getRunSummaryReflectionStrip } from '../src/utils/outcomeAnalysis.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const visibleText = (html) => html.replace(/<[^>]*>/gu, ' ').replace(/&#x27;|&quot;|&amp;/gu, ' ').replace(/\s+/gu, ' ');
const leaves = (value) => (typeof value === 'string' ? [value] : Object.values(value).flatMap(leaves));

// 돌아보기 칸의 갈래마다 하나씩 — 판정 순서(outcomeAnalysis.getRunSummaryReflectionStrip)를 그대로 따라 내려간다.
const BASE = { level: 25, kills: 200, bossKills: 1, relicsFound: 4, totalGold: 5000, escapes: 0, discoveries: 3, maxKillStreak: 5 };
const R = MSG.RUN_REFLECTION;
const BRANCHES = [
    ['escapes', { ...BASE, escapes: 6, bossKills: 0 }, R.escapes.cause],
    ['relics', { ...BASE, relicsFound: 1 }, R.relics.cause],
    ['bossGate', { ...BASE, bossKills: 0, level: 14 }, R.bossGate.cause],
    ['kills', { ...BASE, kills: 10 }, R.kills.cause],
    ['gold', { ...BASE, totalGold: 900 }, R.gold.cause],
    // 지역 발견 조언은 "…유물과 이벤트를 만날 기회를…"이라 말한다 — 유물을 넉넉히 얻은 여정에 "유물이 적었음"이라 하지 않는다.
    ['discovery', { ...BASE, discoveries: 1 }, R.discovery.cause],
    ['streakBroken', { ...BASE, maxKillStreak: 2 }, R.streakBroken.cause],
    ['breakthroughBoss', { ...BASE, bossKills: 3, relicsFound: 5 }, R.breakthrough.causeBoss],
    ['breakthroughStreak', { ...BASE, maxKillStreak: 12 }, R.breakthrough.causeStreak],
    ['breakthroughDiscovery', { ...BASE, discoveries: 6 }, R.breakthrough.causeDiscovery],
    ['growth', { ...BASE }, R.growth.cause],
    ['steady', { ...BASE, bossKills: 0, level: 8, kills: 40 }, R.steady.cause],
];

test('[판정] 사망 화면 돌아보기 칸은 모든 갈래에서 MSG의 플레이어 말이다 — 셋째 칸 이름은 "다음 여정"이다', () => {
    const allowed = new Set(leaves(MSG.RUN_REFLECTION));
    const seenTones = new Set();
    for (const [branch, summary, expectedCause] of BRANCHES) {
        const analysis = getRunSummaryAnalysis(summary);
        const strip = getRunSummaryReflectionStrip(summary, analysis);
        seenTones.add(strip.tone);
        assert.equal(strip.cells[0].value, expectedCause, branch);
        assert.deepEqual(
            strip.cells.map((cell) => cell.label),
            [MSG.RUN_REFLECTION_LABELS.result, MSG.RUN_REFLECTION_LABELS.lesson, MSG.RUN_REFLECTION_LABELS.next],
            branch,
        );
        assert.equal(strip.cells[2].label, '다음 여정', branch);
        for (const cell of strip.cells) {
            assert.ok(allowed.has(cell.value) || cell.value === analysis.headline, `${branch}: ${cell.value}`);
        }
    }
    // 비공허 가드: 네 가지 분위기를 모두 지났다.
    assert.deepEqual([...seenTones].sort(), ['breakthrough', 'growth', 'pressure', 'steady']);
    // 전보체 · 은어가 돌아오지 않는다(감사가 찾은 두 낱말 — "연속 처치 운영 유효").
    for (const text of [...allowed, MSG.RUN_SUMMARY_FOCUS_STRONG_STREAK]) {
        assert.doesNotMatch(text, /운영|유효/u, text);
    }
});

test('[렌더] 사망 화면은 다음 판을 한 이름("다음 여정")으로 부르고, 돌아보기 칸이 플레이어 말을 그린다', () => {
    const player = makePlayerFixture({ level: 17, loc: '북부 요새', meta: { prestigeRank: 2 } });
    // 감사 스크린숏(17-run-summary)과 같은 여정 — 보스 3 · 유물 5 · 최대 12연속.
    const summary = {
        ...buildRunSummary(player, player.loc),
        kills: 142, bossKills: 3, relicsFound: 5, totalGold: 1842, escapes: 2, discoveries: 16, maxKillStreak: 12,
    };
    const html = renderStatic(createElement(RunSummaryCard, { runSummary: summary, onRestart: () => {} }));
    const visible = visibleText(html);
    assert.ok(!visible.includes('다음 시도'), visible.slice(0, 200));
    assert.ok(visible.includes(MSG.RUN_SUMMARY_NEXT_JOURNEY_LABEL));
    assert.ok(visible.includes(MSG.RUN_REFLECTION_LABELS.next));
    assert.ok(visible.includes(MSG.RUN_REFLECTION.breakthrough.causeBoss));
    assert.ok(visible.includes(MSG.RUN_REFLECTION.breakthrough.lessonStreak));
    assert.ok(visible.includes(MSG.RUN_REFLECTION.breakthrough.nextBoss));
    assert.doesNotMatch(visible, /운영 유효|보스권/u);
    assert.ok(html.includes(`aria-label="${MSG.RUN_SUMMARY_REFLECTION_ARIA}"`));
    assert.ok(!MSG.RUN_SUMMARY_REFLECTION_ARIA.includes('시도'));
});

test('[렌더] 기록 탭 아이콘은 탭마다 다르고, 설정 탭은 전투 기술 단추의 번개(Zap)를 쓰지 않는다', () => {
    const html = renderStatic(createElement(Dashboard, {
        player: makePlayerFixture(), uid: 'u', grave: null, sideTab: 'system',
        setSideTab: () => {}, actions: {}, stats: null, quickSlots: [], runtime: null, onReturnToLog: () => {},
    }));
    const icons = {};
    for (const match of html.matchAll(/data-testid="archive-tab-([a-z]+)"[\s\S]*?class="lucide lucide-([a-z0-9-]+)/gu)) {
        icons[match[1]] = match[2];
    }
    assert.equal(Object.keys(icons).length, 11, JSON.stringify(icons));
    assert.equal(icons.system, 'settings');
    assert.ok(!Object.values(icons).includes('zap'), JSON.stringify(icons));
    assert.equal(new Set(Object.values(icons)).size, Object.keys(icons).length, JSON.stringify(icons));
});

test('[렌더] 묘비 탭은 탭 하나짜리 탭 목록이 아니라 제목을 그린다 — 회수 화면은 그대로다', () => {
    const grave = [
        { loc: '고요한 숲', gold: 30, items: [], timestamp: 2, level: 5 },
        { loc: '시작의 마을', gold: 24, items: [], timestamp: 1, level: 4 },
    ];
    for (const entry of [null, grave]) {
        const player = makePlayerFixture({ loc: '시작의 마을' });
        const html = renderStatic(createElement(GravePanel, { player, grave: entry, actions: {} }));
        assert.ok(!/role="tab(list)?"/u.test(html), 'tab · tablist 역할이 없다');
        assert.ok(!html.includes('aria-selected'), 'aria-selected가 없다');
        assert.match(html, new RegExp(`<h3[^>]*data-testid="grave-mine-heading"[^>]*>${MSG.GRAVE_MINE_HEADING}</h3>`, 'u'));
        assert.ok(html.includes('data-testid="grave-mine-view"'));
    }
    const html = renderStatic(createElement(GravePanel, { player: makePlayerFixture({ loc: '시작의 마을' }), grave, actions: {} }));
    assert.ok(html.includes('data-testid="grave-recovery-고요한 숲"'));
    assert.ok(html.includes('data-testid="grave-recovery-시작의 마을"'));
});
