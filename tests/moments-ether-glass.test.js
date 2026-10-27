// 2026-10 화면 디자인 3차(순간 · 결과 카드) — 전투 결과 · 원정 정리 · 이야기 장 · 귀환 브리핑 · 사망 기록 · 전설 획득 · 레벨 상승.
//
// 감사 VD-03 · VD-06 · VD-10 · VD-14 · A11Y-04를 렌더 결과로 지킨다:
//   1. 오버레이는 같은 셸(`ae-sheet`, 가림막 `ae-scrim`)이고 닫기는 같은 모양 · 같은 아이콘 크기 · 44px다.
//   2. 카드마다 금빛 주 행동(ActionButton primary)은 하나다 — 예전 `aether-cta`가 돌아오지 않는다.
//   3. 장식 패널(`ae-ornate`)은 화면마다 하나(이야기 장 · 원정 장면 · 사망 머리말 · 전설 획득).
//   4. 전설은 산호색 토큰(`ae-rarity-legendary`) 하나다 — 하드코딩 hex · 위험 장미색(rose)이 아니다.
//   5. 글자 색은 잉크 토큰이다 — 대비가 모자라던 slate 계열 · 하드코딩 hex가 렌더에 없다.
//   6. 전투 결과 카드는 하단 고정(`fixed`)이고 이 블록의 CSS는 위치를 덮지 않으며 무한 반복 움직임이 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.ts';
import { DB } from '../src/data/db.ts';
import { buildRunSummary } from '../src/utils/gameUtils.ts';
import PostCombatCard from '../src/components/PostCombatCard.tsx';
import ExpeditionDebriefCard from '../src/components/ExpeditionDebriefCard.tsx';
import MilestoneStoryCard from '../src/components/MilestoneStoryCard.tsx';
import ReturnBriefingCard from '../src/components/ReturnBriefingCard.tsx';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import LegendaryDropOverlay from '../src/components/LegendaryDropOverlay.tsx';
import LevelUpBanner from '../src/components/LevelUpBanner.tsx';
import { DeathBeat } from '../src/components/app/DeathScreen.tsx';
import { MOMENT_CLOSE_ICON_SIZE } from '../src/components/moments/MomentCloseButton.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sigWeapon = DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아');
const player = makePlayerFixture({ level: 17, loc: '고요한 숲' });
const runSummary = {
    ...buildRunSummary(player, player.loc),
    kills: 142, bossKills: 3, relicsFound: 5, totalGold: 1842, escapes: 2, discoveries: 4, maxKillStreak: 12,
    signaturesAcquired: 1, signatureNames: [sigWeapon.name],
};
const debrief = {
    battles: 3, explores: 5, expGained: 120, goldDelta: 40,
    destination: '고요한 숲', durationMs: 3_900_000, startLevel: 4, endLevel: 5,
    lowestHp: 10, lowestHpPercent: 20, newItems: [], lostItemCount: 2, completedQuests: [],
};
const story = { id: 'story-1', eyebrow: '이정표', title: '새로운 장', body: '본문', closing: '맺음말' };
const briefing = {
    maxHp: 100, hp: 80, claimableRewardCount: 2, awayHours: 5,
    loc: '시작의 마을', level: 3, dailyCompletedCount: 1, dailyMissionCount: 3, activeChainCount: 0,
};

const CARDS = {
    PostCombatCard: () => renderStatic(createElement(PostCombatCard, {
        result: { enemy: '마왕', items: [sigWeapon.name, DB.ITEMS.consumables[0].name], exp: 40, gold: 12, isBoss: true },
        onClose: () => {},
        onContinueExplore: () => {},
    })),
    ExpeditionDebriefCard: () => renderStatic(createElement(ExpeditionDebriefCard, {
        summary: debrief,
        recommendation: { detail: '다음 원정', kind: 'continue', label: '계속하기' },
        onClose: () => {},
        onPrimaryAction: () => {},
    })),
    MilestoneStoryCard: () => renderStatic(createElement(MilestoneStoryCard, { story, onClose: () => {} })),
    ReturnBriefingCard: () => renderStatic(createElement(ReturnBriefingCard, { briefing, onClose: () => {}, onOpenGoals: () => {} })),
    RunSummaryCard: () => renderStatic(createElement(RunSummaryCard, { runSummary, onRestart: () => {}, essence: 900, onOpenMirror: () => {} })),
};

const CLOSE_IDS = {
    PostCombatCard: 'post-combat-close',
    ExpeditionDebriefCard: 'expedition-debrief-close-icon',
    MilestoneStoryCard: 'milestone-story-close-icon',
    ReturnBriefingCard: 'return-briefing-close-icon',
};

const PRIMARY_IDS = {
    PostCombatCard: 'post-combat-primary-action',
    ExpeditionDebriefCard: 'expedition-debrief-primary-action',
    MilestoneStoryCard: 'milestone-story-close',
    ReturnBriefingCard: 'return-briefing-primary',
    RunSummaryCard: 'run-summary-restart',
};

const tagOf = (html, testId) => html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`, 'u'))?.[0] || '';
const buttonOf = (html, testId) => {
    const at = html.indexOf(`data-testid="${testId}"`);
    if (at < 0) return '';
    return html.slice(html.lastIndexOf('<button', at), html.indexOf('</button>', at));
};
const count = (html, needle) => html.split(needle).length - 1;
const classTokens = (html) => [...html.matchAll(/class="([^"]*)"/gu)].flatMap((m) => m[1].split(/\s+/u)).filter(Boolean);

test('[렌더] 순간 카드는 한 셸(ae-sheet)이고, 가운데 카드는 가림막(ae-scrim)을 깐다', () => {
    for (const [name, render] of Object.entries(CARDS)) {
        const html = render();
        assert.ok(classTokens(html).includes('ae-sheet'), `${name}: ae-sheet`);
        if (name !== 'PostCombatCard') assert.ok(classTokens(html).includes('ae-scrim'), `${name}: ae-scrim`);
        assert.ok(!classTokens(html).includes('aether-overlay'), `${name}: 예전 가림막이 돌아오지 않는다`);
        assert.ok(!classTokens(html).includes('panel-noise'), `${name}: 예전 패널이 돌아오지 않는다`);
    }
});

test('[렌더] 닫기는 모든 카드가 같은 단추다 — 44px · 같은 아이콘 크기 · 이름 있음', () => {
    for (const [name, testId] of Object.entries(CLOSE_IDS)) {
        const button = buttonOf(CARDS[name](), testId);
        assert.ok(button, `${name}: ${testId}`);
        assert.match(button, /\bae-moment-close\b/u, `${name}: 같은 모양`);
        assert.match(button, /min-h-\[44px\] min-w-\[44px\]/u, `${name}: 44px`);
        assert.match(button, new RegExp(`width="${MOMENT_CLOSE_ICON_SIZE}"`, 'u'), `${name}: 같은 아이콘 크기`);
        assert.match(button, /aria-label="[^"]+"/u, `${name}: 이름`);
    }
});

test('[렌더] 카드마다 금빛 주 행동은 하나이고, 그것이 정해진 단추다(VD-03)', () => {
    for (const [name, render] of Object.entries(CARDS)) {
        const html = render();
        assert.equal(count(html, 'data-variant="primary"'), 1, `${name}: 주 행동 하나`);
        assert.match(tagOf(html, PRIMARY_IDS[name]), /data-variant="primary"/u, `${name}: ${PRIMARY_IDS[name]}`);
        assert.ok(!/aether-cta/u.test(html), `${name}: 예전 aether-cta가 돌아오지 않는다`);
    }
});

test('[렌더] 장식 패널(ae-ornate)은 이야기 장 · 원정 장면 · 사망 머리말 · 전설 획득에 하나씩이다', () => {
    for (const name of ['ExpeditionDebriefCard', 'MilestoneStoryCard', 'RunSummaryCard']) {
        assert.equal(classTokens(CARDS[name]()).filter((c) => c === 'ae-ornate').length, 1, name);
    }
    for (const name of ['PostCombatCard', 'ReturnBriefingCard']) {
        assert.equal(classTokens(CARDS[name]()).filter((c) => c === 'ae-ornate').length, 0, `${name}: 장식 패널 없음`);
    }
    const legendary = renderStatic(createElement(LegendaryDropOverlay, { item: sigWeapon, onDismiss: () => {} }));
    const tokens = classTokens(legendary);
    assert.equal(tokens.filter((c) => c === 'ae-ornate').length, 1, '전설 획득');
    assert.ok(tokens.includes('ae-moment-ornate-legendary'), '전설 장식은 산호색');
    assert.ok(tokens.includes('text-ae-rarity-legendary'), '머리말은 전설 등급 토큰');
    assert.doesNotMatch(legendary, /role="(alert)?dialog"/u, 'D24(2026-10-26): 대화상자가 아니라 상태 알림');
    assert.match(legendary, /role="status"/u);
    assert.ok(legendary.includes(sigWeapon.name));
});

test('[렌더] 전설은 산호색 토큰 하나다 — 결과 카드 전리품 줄 · 사망 기록 각인 줄', () => {
    const post = CARDS.PostCombatCard();
    assert.match(tagOf(post, 'post-combat-legendary'), /\bae-moment-legendary\b/u);
    const run = CARDS.RunSummaryCard();
    assert.match(tagOf(run, 'run-summary-signatures'), /\bae-moment-legendary\b/u);
    assert.ok(run.includes(MSG.RUN_SUMMARY_SIGNATURES(1)));
    for (const html of [post, run]) {
        assert.ok(html.includes('text-ae-rarity-legendary'));
        assert.ok(!classTokens(html).some((c) => /(?:^|:)(?:text|bg|border)-rose-/u.test(c)), '전설에 위험 장미색을 쓰지 않는다');
    }
});

test('[렌더] 글자 · 바탕 색은 토큰이다 — slate · 하드코딩 hex · 임의 둥글기가 렌더에 없다(A11Y-04 · VD-06)', () => {
    const renders = {
        ...Object.fromEntries(Object.entries(CARDS).map(([name, render]) => [name, render()])),
        LegendaryDropOverlay: renderStatic(createElement(LegendaryDropOverlay, { item: sigWeapon, onDismiss: () => {} })),
        LevelUpBanner: renderStatic(createElement(LevelUpBanner, { level: 12, classChangeReady: true })),
        DeathBeat: renderStatic(createElement(DeathBeat, { killerName: '리치 왕', onDone: () => {} })),
    };
    for (const [name, html] of Object.entries(renders)) {
        const tokens = classTokens(html);
        assert.deepEqual(tokens.filter((c) => /(?:^|:)(?:text|bg|border)-slate-/u.test(c)), [], `${name}: slate`);
        assert.deepEqual(tokens.filter((c) => /#[0-9a-f]{3,8}/iu.test(c)), [], `${name}: 하드코딩 hex 클래스`);
        assert.deepEqual(tokens.filter((c) => /^rounded-\[/u.test(c)), [], `${name}: 임의 둥글기`);
        // 아이템 그림(ItemIcon)은 이 화면 밖의 공용 부품이라 인라인 색은 전설 획득에서 빛 값만 본다.
        if (name !== 'LegendaryDropOverlay') assert.ok(!/style="[^"]*#[0-9a-f]{6}/iu.test(html), `${name}: 인라인 hex`);
    }
    const glowStyles = [...renders.LegendaryDropOverlay.matchAll(/style="((?:background:radial-gradient\(circle, |background-color:)[^"]*)"/gu)].map((m) => m[1]);
    assert.ok(glowStyles.length > 0, '원소 빛을 실제로 그렸다');
    for (const style of glowStyles) {
        assert.match(style, /rgb\(var\(--aether-[a-z-]+-rgb\)/u, '원소 빛은 토큰 색 채널');
        assert.doesNotMatch(style, /#[0-9a-f]{6}|rgba\(\d/iu, '원소 빛에 hex · 숫자 rgba 없음');
    }
});

test('[렌더] 원정 정리는 지나온 지역 그림을 그리고, 사망 기록 · 귀환 브리핑의 머리말은 대비 있는 잉크다', () => {
    const debriefHtml = CARDS.ExpeditionDebriefCard();
    assert.match(tagOf(debriefHtml, 'moment-region-art'), /data-location-visual="[^"]+"/u, '지역 그림');
    assert.ok(debriefHtml.includes(MSG.EXPEDITION_DEBRIEF_HOURS(1, 5)), '1시간 5분');
    assert.ok(debriefHtml.includes(MSG.EXPEDITION_DEBRIEF_USED_ITEMS(2)));
    assert.match(debriefHtml, /role="meter"/u, '가장 위험했던 순간은 생명 게이지');

    const blind = renderStatic(createElement(RunSummaryCard, { runSummary: { ...runSummary, loc: '???' }, onRestart: () => {} }));
    assert.ok(!blind.includes('moment-region-art'), '가려진 위치(길 잃은 여행)는 그림을 그리지 않는다');

    const run = CARDS.RunSummaryCard();
    const eyebrowAt = run.indexOf(`>${MSG.RUN_SUMMARY_EYEBROW}<`) + 1;
    assert.ok(eyebrowAt > 0);
    assert.match(run.slice(run.lastIndexOf('<div', eyebrowAt), eyebrowAt), /text-ae-ink-2/u, '이번 여정 기록 머리말');
    const nextAt = run.indexOf(MSG.RUN_SUMMARY_NEXT_JOURNEY_LABEL);
    assert.ok(nextAt > 0);
    assert.match(run.slice(run.lastIndexOf('<span', nextAt), nextAt), /text-ae-ether-hi/u, '다음 여정 머리말');

    const brief = CARDS.ReturnBriefingCard();
    const greetAt = brief.indexOf('다시 만난 모험가에게');
    assert.match(brief.slice(brief.lastIndexOf('<div', greetAt), greetAt), /\bae-eyebrow\b/u);
    assert.ok(brief.includes(MSG.RETURN_BRIEFING_OPEN_REWARDS), '받을 보상이 있으면 주 행동이 보상 열기');
});

test('[렌더] 레벨 상승은 금빛 불투명 알약 · 단발 광채이고, 쓰러진 순간은 토큰 바탕이다', () => {
    const banner = renderStatic(createElement(LevelUpBanner, { level: 12 }));
    const pill = classTokens(banner);
    for (const c of ['ae-moment-pill', 'is-gold', 'ae-moment-glow-once']) assert.ok(pill.includes(c), c);
    assert.ok(!pill.includes('animate-levelup'), '반복 광채 없음');
    assert.ok(banner.includes('top-[calc(var(--aether-safe-area-top)+0.5rem)]'));

    const beat = renderStatic(createElement(DeathBeat, { killerName: '리치 왕', onDone: () => {} }));
    assert.match(tagOf(beat, 'death-beat'), /\bae-moment-death-beat\b/u);
    assert.ok(beat.includes('text-ae-threat'));
});

test('[렌더] 전투 결과 카드는 하단 고정 유리 시트다 — 위치를 덮는 클래스가 없다', () => {
    const root = tagOf(CARDS.PostCombatCard(), 'post-combat-card');
    const tokens = (root.match(/class="([^"]*)"/u)?.[1] || '').split(/\s+/u);
    assert.ok(tokens.includes('fixed'), 'fixed');
    assert.ok(tokens.includes('ae-sheet'));
    assert.ok(!tokens.includes('relative') && !tokens.includes('panel-noise'), '위치를 relative로 덮는 클래스 없음');
    assert.ok(tokens.includes('aether-post-combat-boss'), '보스 처치 표시는 남는다');
});

test('[CSS] 순간 블록은 위치를 쓰지 않고, 무한 반복 움직임이 없고, 움직임 줄이기에서 멈춘다', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
    const start = css.indexOf('/* === w3:moments === */');
    const end = css.indexOf('/* === /w3:moments === */');
    assert.ok(start >= 0 && end > start);
    const block = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//gu, '');
    assert.ok(block.length > 2_000, '블록을 실제로 읽었다');
    assert.doesNotMatch(block, /(?:^|[;{\s])position\s*:/u, '위치 속성 없음(고정 카드의 fixed를 덮지 않는다)');
    assert.doesNotMatch(block, /\binfinite\b/u, '무한 반복 없음');
    assert.match(block, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/u);
    for (const keyframe of block.matchAll(/@keyframes\s+([A-Za-z]+)/gu)) {
        assert.match(keyframe[1], /^aeMoment/u, '이 블록의 키프레임은 자기 이름을 쓴다');
    }
});
