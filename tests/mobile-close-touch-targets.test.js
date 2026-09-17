import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';

import ExpeditionDebriefCard from '../src/components/ExpeditionDebriefCard.tsx';
import MilestoneStoryCard from '../src/components/MilestoneStoryCard.tsx';
import ReturnBriefingCard from '../src/components/ReturnBriefingCard.tsx';
import { renderStatic } from './helpers/render.ts';

const read = (name) => readFile(new URL(`../src/components/${name}`, import.meta.url), 'utf8');

/**
 * 원래 계약 (release journey 오버레이 닫기 버튼은 44px 이상의 모바일 터치 타깃을 가진다):
 *   - ExpeditionDebriefCard  data-testid="expedition-debrief-close-icon"
 *   - MilestoneStoryCard     data-testid="milestone-story-close-icon"
 *   - EnhanceDecisionCard    data-testid="enhance-decision-close"
 *   - ReturnBriefingCard     data-testid="return-briefing-close-icon"
 * 기존 테스트는 각 파일을 텍스트로 읽어 testid부터 다음 `</button>`까지를 잘라내
 *   `h-11 w-11`(44px = 2.75rem) 또는 `min-h-[44px] ... min-w-[44px]` 정규식으로 검사했다 —
 *   실제로 버튼이 그 클래스를 받고 렌더링되는지가 아니라 소스 문자열 배치만 확인했다.
 *
 * 계약 재확인: 3개 카드(ExpeditionDebriefCard/MilestoneStoryCard/ReturnBriefingCard)는
 *   실제 renderStatic 렌더로 닫기 버튼 markup에 44px 타깃 클래스가 존재하는지 검사한다.
 *   EnhanceDecisionCard는 `createPortal(..., document.body)`로 반환하는데,
 *   ReactDOMServer(renderToStaticMarkup)는 포탈을 지원하지 않아
 *   ("Portals are not currently supported by the server renderer") 정적 렌더가
 *   불가능하다 — 이 한 곳만 구조 불변식(소스 텍스트)으로 유지한다.
 */

const extractButton = (html, testId) => {
    const marker = `data-testid="${testId}"`;
    const start = html.indexOf(marker);
    assert.ok(start >= 0, `${testId} 버튼이 렌더링되어야 함`);
    // 버튼은 항상 이 marker보다 앞에서 시작하는 <button 태그 안에 있다.
    const tagStart = html.lastIndexOf('<button', start);
    const tagEnd = html.indexOf('</button>', start);
    return html.slice(tagStart, tagEnd);
};

const has44pxTarget = (buttonHtml) => (
    /(?:h-11\s+w-11|min-h-\[44px\][^"]*min-w-\[44px\])/.test(buttonHtml)
    || (buttonHtml.includes('h-11') && buttonHtml.includes('w-11'))
);

test('ExpeditionDebriefCard 닫기 아이콘은 44px 터치 타깃 클래스로 렌더된다', () => {
    const summary = {
        battles: 3, explores: 5, expGained: 120, goldDelta: 40,
        destination: '고요한 숲', durationMs: 60_000,
        startLevel: 4, endLevel: 5,
        lowestHp: 10, lowestHpPercent: 20,
        newItems: [], lostItemCount: 0, completedQuests: [],
    };
    const recommendation = { detail: '다음 원정을 준비하세요', kind: 'continue', label: '계속하기' };
    const html = renderStatic(createElement(ExpeditionDebriefCard, {
        summary, recommendation, onClose: () => {}, onPrimaryAction: () => {},
    }));

    assert.ok(html.includes('data-testid="expedition-debrief-close-icon"'));
    assert.ok(has44pxTarget(extractButton(html, 'expedition-debrief-close-icon')), 'h-11 w-11 (44px) 클래스 보존');
});

test('MilestoneStoryCard 닫기 아이콘은 44px 터치 타깃 클래스로 렌더된다', () => {
    const story = { id: 'story-1', eyebrow: '이정표', title: '새로운 장', body: '본문', closing: '맺음말' };
    const html = renderStatic(createElement(MilestoneStoryCard, { story, onClose: () => {} }));

    assert.ok(html.includes('data-testid="milestone-story-close-icon"'));
    assert.ok(has44pxTarget(extractButton(html, 'milestone-story-close-icon')), 'h-11 w-11 (44px) 클래스 보존');
});

test('ReturnBriefingCard 닫기 아이콘은 44px 터치 타깃 클래스로 렌더된다', () => {
    const briefing = {
        maxHp: 100, hp: 80, claimableRewardCount: 0, awayHours: 5,
        loc: '시작의 마을', level: 3, dailyCompletedCount: 1, dailyMissionCount: 3,
        activeChainCount: 0,
    };
    const html = renderStatic(createElement(ReturnBriefingCard, {
        briefing, onClose: () => {}, onOpenGoals: () => {},
    }));

    assert.ok(html.includes('data-testid="return-briefing-close-icon"'));
    assert.ok(has44pxTarget(extractButton(html, 'return-briefing-close-icon')), 'min-h-[44px]/min-w-[44px] 클래스 보존');
});

// 구조 불변식(소스 텍스트) — createPortal(document.body) 사용으로 SSR 렌더 불가.
test('EnhanceDecisionCard 닫기 버튼은 소스 텍스트 기준 44px 터치 타깃을 유지한다 (createPortal이라 SSR 렌더 불가)', async () => {
    const source = await read('EnhanceDecisionCard.tsx');
    const start = source.indexOf('data-testid="enhance-decision-close"');
    const end = source.indexOf('</button>', start);
    const button = source.slice(start, end);
    assert.match(button, /(?:h-11\s+w-11|min-h-\[44px\].*min-w-\[44px\])/, 'EnhanceDecisionCard.tsx');
});
