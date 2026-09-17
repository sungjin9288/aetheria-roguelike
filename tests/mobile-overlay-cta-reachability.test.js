import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';

import FocusPanelHeader from '../src/components/FocusPanelHeader.tsx';
import PostCombatCard from '../src/components/PostCombatCard.tsx';
import ControlPanel from '../src/components/ControlPanel.tsx';
import Dashboard from '../src/components/Dashboard.tsx';
import ClassCard from '../src/components/ClassCard.tsx';
import JobChangePanel from '../src/components/tabs/JobChangePanel.tsx';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import CraftingPanel from '../src/components/tabs/CraftingPanel.tsx';
import EventPanel from '../src/components/EventPanel.tsx';
import MobileGameLayout from '../src/components/app/MobileGameLayout.tsx';
import { GS } from '../src/reducers/gameStates.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const NOOP_ACTIONS = new Proxy({}, { get: () => () => undefined });

/**
 * 원래 계약 (각 assert가 지키던 것):
 *   1. scripts/smoke-gameplay.mjs의 verifyActionReachable 헬퍼가 뷰포트 도달 가능성
 *      (getBoundingClientRect/visibleRatio/scrollIntoViewIfNeeded/minHitHeight/
 *      pointerEvents)을 실제로 검사한다.
 *   2. 결정론적 오버레이 스모크가 주요 CTA(post-combat-continue/close, relic-choice-skip,
 *      run-summary-*, shop-buy-inline/close, mobile-console-*, control-*,
 *      menu-reset-cancel, job/quest/crafting/event 닫기 등)를 검사한다.
 *   3. 모바일 포커스 패널(FocusPanelHeader/PostCombatCard/ControlPanel/Dashboard/
 *      ClassCard/JobChangePanel/QuestBoardPanel/CraftingPanel/EventPanel)의 닫기·주요
 *      CTA는 명시적 testid와 44px 터치 타깃을 갖는다.
 *   4. MobileGameLayout: archive 콘솔이 열려 있을 때는(showArchiveConsole) 하단 컨트롤이
 *      숨겨진다.
 *   5. Dashboard 아카이브 탭 레일은 선택된 기록을 첫 화면에 보여준다(탭 rail이 콘텐츠보다
 *      먼저 온다, ArchiveTabButton이 접근성 속성을 갖는다).
 *
 * 1, 2는 Playwright 스모크 스크립트(.mjs, 브라우저 전용 API)라 렌더 대상이 없다 —
 * 구조 불변식(소스 텍스트)으로 유지한다.
 * 3은 각 컴포넌트를 renderStatic으로 렌더링해 실제 testid/클래스가 DOM에 있는지
 * 검증한다. 단 Dashboard의 'menu-reset-confirm'/'menu-reset-cancel'과 QuestBoardPanel의
 * 'quest-board-accept-mission'은 내부 useState(클릭 이후에만 열리는 확인 다이얼로그 /
 * backlog에 들어갈 만큼 진행한 플레이어)로만 도달하므로 정적 렌더로는 재현할 수 없어
 * 구조 불변식으로 남긴다.
 * 4는 실제로 두 gameState 조합을 렌더링해 하단 컨트롤 유무를 검증한다.
 * 5 중 스크롤 중앙 정렬 로직(offsetLeft/scrollLeft, useEffect+ref)은 JSDOM 없는
 * renderStatic으로는 실행되지 않는 진짜 DOM 동작이라 구조 불변식으로 남기고,
 * "탭 rail이 콘텐츠 영역보다 먼저 렌더링된다"와 정적 접근성 속성은 렌더로 검증한다.
 */

// 구조 불변식(소스 텍스트) — Playwright 스모크 스크립트, 렌더 대상 없음.
test('smoke helper verifies viewport reachability with scroll recovery', async () => {
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');

    assert.match(smoke, /async function verifyActionReachable/);
    assert.match(smoke, /getBoundingClientRect\(\)/);
    assert.match(smoke, /visibleRatio/);
    assert.match(smoke, /scrollIntoViewIfNeeded/);
    assert.match(smoke, /minHitHeight/);
    assert.match(smoke, /pointerEvents !== 'none'/);
    assert.match(smoke, /archiveOpenButton\.isVisible[\s\S]*control-map-open/);
});

// 구조 불변식(소스 텍스트) — Playwright 스모크 스크립트, 렌더 대상 없음.
test('deterministic overlay smoke checks reachable primary and close CTAs', async () => {
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');

    [
        'post-combat-continue',
        'post-combat-close',
        'relic-choice-skip',
        'run-summary-share',
        'run-summary-restart',
        'shop-buy-inline',
        'shop-close',
        'mobile-console-open-archive',
        'mobile-console-return-log',
        'control-class',
        'control-quests',
        'control-craft',
        'menu-reset-cancel',
        'job-change-close',
        'job-change-confirm',
        'quest-board-close',
        'crafting-close',
        'event-close',
        'event-choice-0',
    ].forEach((testId) => {
        assert.match(smoke, new RegExp(testId));
    });

    assert.match(smoke, /Post-combat continue CTA/);
    assert.match(smoke, /Relic choice recommended CTA/);
    assert.match(smoke, /Run summary restart CTA/);
    assert.match(smoke, /Shop close CTA/);
    assert.match(smoke, /first-scan decision area/);
});

test('FocusPanelHeader: 뒤로/보관함 버튼은 44px 터치 타깃으로 렌더링된다', () => {
    const html = renderStatic(createElement(FocusPanelHeader, {
        eyebrow: '테스트', title: '제목',
        onBack: () => {}, backLabel: '복귀', backTestId: 'test-close',
        onOpenArchive: () => {}, archiveLabel: '가방', archiveTestId: 'test-open-archive',
    }));
    assert.ok(html.includes('data-testid="test-close"'));
    assert.ok(html.includes('data-testid="test-open-archive"'));
    assert.match(html, /min-h-\[44px\]/);
});

test('PostCombatCard: post-combat-close는 44px 정사각 터치 타깃으로 렌더링된다', () => {
    const result = { enemy: '숲의 정령', playerHp: 60, playerMaxHp: 100, items: [] };
    const html = renderStatic(createElement(PostCombatCard, {
        result, onClose: () => {}, onOpenInventory: () => {}, onResolveChoice: () => {},
    }));
    const start = html.indexOf('data-testid="post-combat-close"');
    assert.ok(start >= 0);
    const tagStart = html.lastIndexOf('<button', start);
    const tagEnd = html.indexOf('</button>', start);
    assert.match(html.slice(tagStart, tagEnd), /min-h-\[44px\] min-w-\[44px\]/);
});

test('ControlPanel: mobile-console-open-archive / control-class / control-craft가 44px 타깃으로 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(ControlPanel, {
        gameState: GS.IDLE, player, enemy: null, actions: NOOP_ACTIONS, setGameState: () => {},
        shopItems: [], grave: null, isAiThinking: false, currentEvent: null, stats: null,
        onOpenArchiveConsole: () => {},
    }));

    const archiveStart = html.indexOf('data-testid="mobile-console-open-archive"');
    assert.ok(archiveStart >= 0, '가방/도감 진입 버튼 렌더링됨');
    const archiveTagEnd = html.indexOf('</button>', archiveStart);
    assert.match(html.slice(html.lastIndexOf('<button', archiveStart), archiveTagEnd), /min-h-\[44px\]/);

    assert.ok(html.includes('data-testid="control-class"'));
    assert.ok(html.includes('data-testid="control-craft"'));
});

test('Dashboard: mobile-console-return-log / menu-reset은 44px 타깃으로, system 탭에서 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(Dashboard, {
        player, uid: 'test-uid', grave: null, sideTab: 'system', setSideTab: () => {},
        actions: NOOP_ACTIONS, stats: null, quickSlots: [], runtime: {}, onReturnToLog: () => {},
    }));

    const returnLogStart = html.indexOf('data-testid="mobile-console-return-log"');
    assert.ok(returnLogStart >= 0);
    assert.match(html.slice(returnLogStart, html.indexOf('</button>', returnLogStart)), /min-h-\[44px\]/);

    const resetStart = html.indexOf('data-testid="menu-reset"');
    assert.ok(resetStart >= 0);
    assert.match(html.slice(html.lastIndexOf('<button', resetStart), html.indexOf('</button>', resetStart)), /min-h-\[44px\]/);
    assert.ok(html.includes('data-testid="system-reset-section"'));
});

test('ClassCard: job-change-option testid로 렌더링된다', () => {
    const html = renderStatic(createElement(ClassCard, { jobName: '전사', onSelect: () => {}, disabled: false, selected: false }));
    assert.ok(html.includes('data-testid="job-change-option"'));
});

test('JobChangePanel: job-change-close / job-change-confirm이 실제로 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(JobChangePanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.ok(html.includes('data-testid="job-change-close"'), '전제: 기본 직업(모험가)에는 전직 가능한 다음 직업이 있어야 함');
    assert.ok(html.includes('data-testid="job-change-confirm"'));
});

test('QuestBoardPanel: quest-board-close / quest-board-start-operation이 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(QuestBoardPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.ok(html.includes('data-testid="quest-board-close"'));
    assert.ok(html.includes('data-testid="quest-board-start-operation"'), '전제: 신규 플레이어도 추천/잠금 임무 미리보기가 최소 1개 존재해야 함');
});

test('CraftingPanel: crafting-close / crafting-recipe-action이 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(CraftingPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.ok(html.includes('data-testid="crafting-close"'));
    assert.ok(html.includes('data-testid="crafting-recipe-action"'));
});

test('EventPanel: event-close / event-choice-0이 렌더링된다', () => {
    const html = renderStatic(createElement(EventPanel, {
        currentEvent: { desc: '상황', choices: ['첫 선택', '두 번째 선택'] },
        actions: NOOP_ACTIONS, location: '시작의 마을',
    }));
    assert.ok(html.includes('data-testid="event-close"'));
    assert.ok(html.includes('data-testid="event-choice-0"'));
});

test('MobileGameLayout: 아카이브 콘솔이 열려 있으면 하단 컨트롤이 숨겨진다', () => {
    const player = makePlayerFixture();
    const baseProps = {
        fullStats: null, handleQuickSlotUse: () => {}, damageFlash: false, healFlash: false,
        setMobileConsoleMode: () => {}, onOpenMirror: () => {}, onOpenCrystalExchange: () => {},
    };
    const engine = {
        gameState: GS.IDLE, player, uid: 'u', grave: null, sideTab: 'inventory',
        actions: NOOP_ACTIONS, quickSlots: [], syncStatus: 'idle', isAiThinking: false,
        logs: [], handleCommand: () => {}, enemy: null, shopItems: [], currentEvent: null,
    };

    const htmlArchiveOpen = renderStatic(createElement(MobileGameLayout, {
        engine, ...baseProps, isPanelFocusState: false, mobileArchiveDockVisible: true, mobileConsoleMode: 'archive',
    }));
    assert.ok(!htmlArchiveOpen.includes('data-testid="control-map-signal"'), '아카이브 콘솔이 열려 있으면 하단 ControlPanel 자체가 숨겨짐');

    const htmlArchiveClosed = renderStatic(createElement(MobileGameLayout, {
        engine, ...baseProps, isPanelFocusState: false, mobileArchiveDockVisible: true, mobileConsoleMode: 'log',
    }));
    assert.ok(htmlArchiveClosed.includes('data-testid="control-map-signal"'), '로그 모드에서는 하단 컨트롤(ControlPanel)이 보임');
});

test('Dashboard: archive-tab-rail이 콘텐츠 영역보다 먼저 렌더링되고 ArchiveTabButton이 접근성 속성을 갖는다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(Dashboard, {
        player, uid: 'u', grave: null, sideTab: 'inventory', setSideTab: () => {},
        actions: NOOP_ACTIONS, stats: null, quickSlots: [], runtime: {}, onReturnToLog: () => {},
    }));
    assert.ok(html.includes('archive-tab-rail'));
    assert.ok(html.includes('mobile-archive-console-content'));
    assert.ok(
        html.indexOf('archive-tab-rail') < html.indexOf('mobile-archive-console-content'),
        '탭 레일이 선택된 기록 콘텐츠보다 먼저 온다',
    );
    assert.match(html, /aria-current="page"/, '활성 탭에 aria-current="page"');
    assert.match(html, /aria-pressed="true"/, '활성 탭에 aria-pressed="true"');
});

// 구조 불변식(소스 텍스트) — archive-tab-rail의 선택 탭 스크롤 중앙 정렬은
// useEffect + ref(offsetLeft/clientWidth/scrollLeft)로 계산되는 실제 DOM 동작이라
// jsdom 없는 renderStatic으로는 실행/관찰할 수 없다.
test('Dashboard: 아카이브 탭 스크롤 중앙 정렬 로직은 실제 DOM 동작이라 소스로만 검증한다', async () => {
    const dashboard = await readSrc('src/components/Dashboard.tsx');
    const archiveTab = await readSrc('src/components/ArchiveTabButton.tsx');

    assert.match(dashboard, /const selectedCenter = selectedTab\.offsetLeft \+ \(selectedTab\.offsetWidth \/ 2\)/);
    assert.match(dashboard, /rail\.scrollLeft = Math\.max\(0, selectedCenter - \(rail\.clientWidth \/ 2\)\)/);
    assert.doesNotMatch(dashboard, /selectedTab\?\.scrollIntoView/);
    assert.doesNotMatch(dashboard, /TOWN_MENU_ACTIONS|menu-town-|mobileArchiveExpanded|mobile-archive-sheet/);
    assert.match(archiveTab, /min-h-\[44px\]/);
});

// 구조 불변식(소스 텍스트) — 내부 useState로만 열리는 확인 다이얼로그(클릭
// 이후에만 존재)와, 진행한 플레이어에게만 나타나는 backlog 임무 수락 버튼은
// 정적 렌더로 재현할 수 없다.
test('클릭으로만 열리는 CTA는 소스 텍스트로 계약을 보존한다 (menu-reset-confirm/cancel, quest-board-accept-mission)', async () => {
    const dashboard = await readSrc('src/components/Dashboard.tsx');
    const quest = await readSrc('src/components/tabs/QuestBoardPanel.tsx');

    assert.match(dashboard, /data-testid="menu-reset-confirm"[\s\S]*min-h-\[44px\]/);
    assert.match(dashboard, /data-testid="menu-reset-cancel"[\s\S]*min-h-\[44px\]/);
    assert.match(quest, /data-testid="quest-board-accept-mission"/);
    assert.match(quest, /backlogQuestEntries\.length > 0 &&/);
});
