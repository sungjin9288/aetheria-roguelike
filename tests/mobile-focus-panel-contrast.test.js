import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';

import ClassCard from '../src/components/ClassCard.tsx';
import CraftingPanel from '../src/components/tabs/CraftingPanel.tsx';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import ShopPanel from '../src/components/ShopPanel.tsx';
import EventPanel from '../src/components/EventPanel.tsx';
import JobChangePanel from '../src/components/tabs/JobChangePanel.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

// 어떤 액션이 호출되어도 조용히 no-op을 반환하는 스텁 — 정적 렌더에서는
// onClick 핸들러가 실제로 실행되지 않으므로 각 컴포넌트가 참조하는 액션 이름을
// 일일이 나열할 필요가 없다.
const NOOP_ACTIONS = new Proxy({}, { get: () => () => undefined });

/**
 * 원래 계약 (각 assert가 지키던 것):
 *   1. src/index.css가 공유 대비 계약(.aether-focus-panel/.aether-event-choice/
 *      .aether-craft-row/.aether-locked-row/.aether-lock-note, disabled:opacity:1,
 *      [data-readability-mode="high"] 오버라이드)을 정의한다.
 *   2. 잠기거나 비활성화된 포커스 패널 콘텐츠는 opacity-35/opacity-30/opacity-60/
 *      opacity-65 같은 페이드 대신 aether-locked-row/aether-lock-note/
 *      aether-disabled-action 클래스로 표시된다 (읽기 가능성 유지).
 *   3. EventPanel/CraftingPanel/QuestBoardPanel/JobChangePanel/ShopPanel은 모두
 *      표준 모드에서 더 강한 대비의 aether-focus-panel(+ EventPanel은
 *      aether-event-choice)로 렌더링된다.
 *
 * 1은 CSS 파일 자체(계산된 스타일이 아니라 선언)라 렌더 대상이 없다 — 구조
 * 불변식(소스 텍스트)으로 유지한다. 2, 3은 실제로 그 클래스가 렌더링된 DOM에
 * 붙는지를 renderStatic으로 검증한다 — "소스에 문자열이 있다"가 아니라
 * "실제로 그 노드에 그 클래스가 있다"를 확인하므로 더 강한 회귀 가드다.
 */

// 구조 불변식(소스 텍스트) — index.css는 계산 스타일이 아닌 선언 자체를 검사해야
// 하고, jsdom 없는 renderStatic으로는 CSS 캐스케이드를 확인할 수 없다.
test('mobile focus panels expose a shared contrast contract (index.css declarations)', async () => {
    const css = await readSrc('src/index.css');

    assert.match(css, /\.aether-focus-panel\s*\{/);
    assert.match(css, /\.aether-event-choice\s*\{/);
    assert.match(css, /\.aether-craft-row\s*\{/);
    assert.match(css, /\.aether-locked-row\s*\{/);
    assert.match(css, /\.aether-lock-note\s*\{/);
    assert.match(css, /\.aether-disabled-action:disabled[\s\S]*opacity:\s*1/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-focus-panel/);
    assert.match(css, /\[data-readability-mode="high"\]\s+\.aether-lock-note/);
});

test('ClassCard: 잠긴 전직 카드는 aether-locked-row/aether-lock-note를 렌더링하고 opacity-35는 쓰지 않는다', () => {
    const htmlLocked = renderStatic(createElement(ClassCard, {
        jobName: '전사', onSelect: () => {}, disabled: true, selected: false,
    }));
    assert.ok(htmlLocked.includes('aether-locked-row'));
    assert.ok(htmlLocked.includes('aether-lock-note'));
    assert.ok(!htmlLocked.includes('opacity-35'));

    const htmlUnlocked = renderStatic(createElement(ClassCard, {
        jobName: '전사', onSelect: () => {}, disabled: false, selected: false,
    }));
    assert.ok(!htmlUnlocked.includes('opacity-35'));
});

test('CraftingPanel: 제작 불가 레시피 행은 aether-locked-row/aether-lock-note/aether-disabled-action을 쓰고 disabled:opacity-30은 쓰지 않는다', () => {
    const player = makePlayerFixture({ inv: [], gold: 0 });
    const html = renderStatic(createElement(CraftingPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));

    assert.ok(html.includes('data-craft-state="locked"'), '재료/골드가 없는 레시피는 locked 상태');
    assert.ok(html.includes('aether-lock-note') || html.includes('aether-locked-row'), '잠금 표시가 aether 클래스로 렌더링됨');
    assert.ok(html.includes('aether-disabled-action'));
    assert.ok(!html.includes('disabled:opacity-30'));
});

test('QuestBoardPanel: 잠긴/비활성 임무 행은 aether-locked-row/aether-disabled-action을 쓰고 disabled:opacity-60은 쓰지 않는다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(QuestBoardPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));

    assert.ok(html.includes('aether-locked-row') || html.includes('aether-disabled-action'), '잠금/비활성 임무 표시가 aether 클래스로 렌더링됨');
    assert.ok(!html.includes('disabled:opacity-60'));
});

test('ShopPanel: 구매 불가 상품 행은 aether-disabled-action을 쓰고 disabled:opacity-30/65는 쓰지 않는다', () => {
    const player = makePlayerFixture({ level: 40, gold: 0, job: '전사' });
    const html = renderStatic(createElement(ShopPanel, {
        player, actions: NOOP_ACTIONS, shopItems: [], setGameState: () => {}, stats: null, onOpenArchiveConsole: () => {},
    }));

    assert.ok(html.includes('aether-disabled-action'));
    assert.ok(!html.includes('disabled:opacity-30'));
    assert.ok(!html.includes('disabled:opacity-65'));
});

test('EventPanel/CraftingPanel/QuestBoardPanel/JobChangePanel/ShopPanel은 표준 모드에서 aether-focus-panel(강한 대비)로 렌더링된다', () => {
    const player = makePlayerFixture();

    const eventHtml = renderStatic(createElement(EventPanel, {
        currentEvent: { desc: '테스트 상황', choices: ['첫 번째 선택', '두 번째 선택'] },
        actions: NOOP_ACTIONS, location: '시작의 마을',
    }));
    assert.ok(eventHtml.includes('aether-focus-panel'));
    assert.ok(eventHtml.includes('aether-event-choice'));

    const craftingHtml = renderStatic(createElement(CraftingPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.ok(craftingHtml.includes('aether-focus-panel'));

    const questHtml = renderStatic(createElement(QuestBoardPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.ok(questHtml.includes('aether-focus-panel'));

    const jobHtml = renderStatic(createElement(JobChangePanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.ok(jobHtml.includes('aether-focus-panel'));

    const shopHtml = renderStatic(createElement(ShopPanel, {
        player: makePlayerFixture({ level: 40 }), actions: NOOP_ACTIONS, shopItems: [], setGameState: () => {}, stats: null, onOpenArchiveConsole: () => {},
    }));
    assert.ok(shopHtml.includes('aether-focus-panel'));
});
