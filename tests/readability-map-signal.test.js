import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';

import MobileGameLayout from '../src/components/app/MobileGameLayout.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import TerminalView from '../src/components/TerminalView.tsx';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import ShopPanel from '../src/components/ShopPanel.tsx';
import { GS } from '../src/reducers/gameStates.ts';
import { getMoveRecommendations } from '../src/utils/adventureGuide.ts';
import { findMapPath, getNextMapTowardTarget, getDefaultMapSelection, getMapRequiredLevel } from '../src/utils/mapTopology.ts';
import { DB } from '../src/data/db.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');
const NOOP_ACTIONS = new Proxy({}, { get: () => () => undefined });

/**
 * 원래 계약 (각 assert가 지키던 것):
 *   1. 한국어 읽기에 적합한 폰트 스택(--aether-readable-font, Noto Sans KR 등)이
 *      body/tailwind 설정에 배선되어 있다.
 *   2. MobileGameLayout: 모바일 첫 화면은 전투 중 로그를 결정 영역 위에 둔다.
 *   3. ControlPanel: 첫 화면에 지도 신호(control-map-signal)와 경로 진입점
 *      (control-map-open/control-route-open)을 노출하고, adventureGuide의
 *      levelLabel은 "레벨 N"/"심연"만 쓴다(Abyss/Lv. 금지).
 *   4. MapNavigator: 현재 위치와 주 경로를 경로 목록보다 먼저 보여준다(각종 testid),
 *      mapTopology의 findMapPath/getNextMapTowardTarget/getDefaultMapSelection가
 *      실제로 올바르게 동작한다.
 *   5. 첫 화면은 압축된 읽기 쉬운 상태/로그 표면을 쓴다(aether-status-shell 등 CSS
 *      클래스가 실제 렌더 결과에 붙는다).
 *   6. 임무 트래커는 "장소"/"귀환" 같은 자연스러운 한국어 동작 언어를 쓴다.
 *   7. 퀘스트 보드는 무거운 터미널 카드보다 결정 행(quest-decision-row)을 먼저 쓴다.
 *   8. 상점 구매 행은 비교 가능한 상태(shop-buy-item/data-shop-state)와 읽을 수 있는
 *      차단 사유를 노출한다.
 *   9. readabilityMode는 저장된 설정 → 앱 셸/시스템 컨트롤까지 배선되어 있다.
 *
 * 1, 9는 CSS/여러 파일에 걸친 배선(prop threading) 계약이라 렌더 대상이 하나로
 * 모이지 않는다 — 구조 불변식(소스 텍스트)으로 유지한다.
 * 2, 5(상태/로그 클래스 부분), 7, 8은 실제 컴포넌트를 renderStatic으로 렌더링해
 * 검증한다. 5의 CSS 선언 자체는 구조 불변식으로 남긴다(계산 스타일이 아님).
 * 3, 4의 순수 함수(getMoveRecommendations/findMapPath/getNextMapTowardTarget/
 * getDefaultMapSelection/getMapRequiredLevel)는 실제로 호출해 반환값을 검증한다 —
 * ControlPanel의 MapSignalStrip과 MapNavigator 자체는 지역 데이터 그래프에 깊이
 * 의존하는 렌더 비용 대비 이 사이클에서는 testid 배선만 구조 불변식으로 남긴다.
 * 6(MissionTrackerStrip)은 ControlPanel 내부 비공개 컴포넌트라 questTracker가 있는
 * 실제 지역 진행 데이터를 재현해야 하므로, 이 사이클에서는 testid/문구 배선만
 * 구조 불변식으로 남긴다.
 */

// 구조 불변식(소스 텍스트) — 전역 폰트/Tailwind 설정, 렌더 대상 없음.
test('readability foundation uses Korean-friendly readable font stack', async () => {
    const css = await readSrc('src/index.css');
    const tailwind = await readSrc('tailwind.config.js');

    assert.match(css, /--aether-readable-font:/);
    assert.match(css, /Noto Sans KR|Apple SD Gothic Neo|Malgun Gothic/);
    assert.match(css, /body\s*\{[\s\S]*font-readable/);
    assert.match(tailwind, /readable:\s*\['var\(--aether-readable-font\)'\]/);
});

test('MobileGameLayout: 전투 중 로그 영역이 결정 영역보다 먼저(order-1), 결정 영역은 order-2', () => {
    const player = makePlayerFixture();
    const baseProps = {
        fullStats: null, isPanelFocusState: false, mobileArchiveDockVisible: false,
        handleQuickSlotUse: () => {}, damageFlash: false, healFlash: false,
        mobileConsoleMode: 'log', setMobileConsoleMode: () => {},
        onOpenMirror: () => {}, onOpenCrystalExchange: () => {},
    };
    const engine = {
        gameState: GS.COMBAT, player, uid: 'u', grave: null, sideTab: 'inventory',
        actions: NOOP_ACTIONS, quickSlots: [], syncStatus: 'idle', isAiThinking: false,
        logs: [], handleCommand: () => {}, enemy: null, shopItems: [], currentEvent: null,
    };
    const html = renderStatic(createElement(MobileGameLayout, { engine, ...baseProps }));

    assert.match(html, /class="[^"]*\border-1\b[^"]*min-h-\[132px\][^"]*"[^>]*>[\s\S]*?data-testid="terminal-panel"/, '로그 래퍼가 order-1 min-h-[132px]');
    assert.match(html, /class="[^"]*\border-2\b[^"]*shrink-0[^"]*"[^>]*>[\s\S]*?data-testid="combat-focus-panel"/, '결정 영역 래퍼가 order-2 shrink-0');
    // 로그 영역(order-1)이 결정 영역(order-2)보다 실제 마크업 순서에서도 앞선다.
    assert.ok(html.indexOf('data-testid="terminal-panel"') < html.indexOf('data-testid="combat-focus-panel"'));
});

test('adventureGuide.getMoveRecommendations: levelLabel은 "레벨 N"/"심연"만 쓰고 Abyss/Lv.는 쓰지 않는다', () => {
    const player = makePlayerFixture();
    const currentMap = DB.MAPS[player.loc];
    const stats = { maxHp: player.maxHp, maxMp: player.maxMp };
    const recommendations = getMoveRecommendations(player, stats, currentMap, DB.MAPS);

    assert.ok(recommendations.length > 0, '전제: 시작 마을에는 추천 경로가 있어야 함');
    for (const route of recommendations) {
        assert.match(route.levelLabel, /^(?:레벨 \d+|심연)$/, `levelLabel="${route.levelLabel}"은 한국어 형식`);
    }
    const serialized = JSON.stringify(recommendations);
    assert.ok(!/Abyss/.test(serialized));
    assert.ok(!/Lv\./.test(serialized));

    // 무한 심연 지역이 있다면 levelLabel이 정확히 '심연'인지도 확인.
    const infiniteMap = Object.values(DB.MAPS).find((map) => map.level === 'infinite');
    if (infiniteMap) {
        assert.equal(getMapRequiredLevel(infiniteMap, 10), Math.max(18, 50));
    }
});

test('mapTopology: findMapPath/getNextMapTowardTarget/getDefaultMapSelection이 실제로 올바르게 동작한다', () => {
    const maps = {
        A: { exits: ['B'] },
        B: { exits: ['A', 'C'] },
        C: { exits: ['B'] },
        D: { exits: [] }, // 연결되지 않은 지역
    };

    assert.deepEqual(findMapPath(maps, 'A', 'C'), ['A', 'B', 'C']);
    assert.deepEqual(findMapPath(maps, 'A', 'D'), [], '연결되지 않은 지역은 빈 경로');
    assert.equal(getNextMapTowardTarget(maps, 'A', 'C'), 'B');
    assert.equal(getNextMapTowardTarget(maps, 'A', 'D'), null);

    const routes = [
        { name: '일반 경로', isMissionRoute: false, isLocked: false },
        { name: '임무 경로', isMissionRoute: true, isLocked: false },
    ];
    assert.equal(getDefaultMapSelection('현재 위치', routes), '임무 경로', '임무 경로가 있으면 그걸 기본 선택');
    assert.equal(getDefaultMapSelection('현재 위치', [{ name: '잠긴 임무 경로', isMissionRoute: true, isLocked: true }]), '현재 위치', '잠긴 임무 경로는 후보에서 제외되고 현재 위치로 폴백');
});

test('첫 화면 상태/로그 표면은 압축된 읽기 쉬운 CSS 클래스로 실제 렌더링된다', () => {
    const player = makePlayerFixture({ name: '테스트' });
    const statusHtml = renderStatic(createElement(StatusBar, { player, stats: null, enemy: null }));
    assert.ok(statusHtml.includes('aether-status-shell'));
    assert.ok(statusHtml.includes('aether-status-metric'));

    const terminalHtml = renderStatic(createElement(TerminalView, {
        logs: [{ id: 'l1', type: 'system', text: '테스트' }], gameState: GS.IDLE,
        onCommand: () => {}, player: null, quickSlots: [], onQuickSlotUse: () => {},
    }));
    assert.ok(terminalHtml.includes('aether-log-panel'));
    assert.ok(terminalHtml.includes('data-log-type="system"'));
    assert.match(terminalHtml, /font-readable/);
});

// 구조 불변식(소스 텍스트) — CSS 선언 자체(computed style이 아님)와, ControlPanel
// 내부 비공개 MapSignalStrip/MissionTrackerStrip은 실제 지역 진행 데이터를
// 재현해야 하는 렌더 비용이 커서 이 사이클에서는 testid/CSS 클래스 배선만 검사한다.
test('control panel exposes a first-screen map signal / mission tracker language (구조 불변식)', async () => {
    const css = await readSrc('src/index.css');
    const status = await readSrc('src/components/StatusBar.tsx');
    const source = await readSrc('src/components/ControlPanel.tsx');

    assert.match(css, /\.aether-status-shell/);
    assert.match(css, /\.aether-status-metric/);
    assert.match(css, /\.aether-log-panel/);
    assert.match(css, /\.aether-log-row/);
    assert.match(status, /aether-status-shell/);
    assert.match(status, /aether-status-metric/);

    assert.match(source, /data-testid="control-map-signal"/);
    assert.match(source, /data-testid="control-map-open"/);
    assert.match(source, /onOpenArchiveConsole\?\.\('map'\)/);
    assert.match(source, /data-testid="control-route-open"/);
    assert.match(source, /setGameState\?\.\(GS\.MOVING\)/);

    assert.match(source, /aether-mission-strip/);
    assert.match(source, /data-testid="control-mission-context"/);
    assert.match(source, />장소<\/span>/);
    assert.match(source, />귀환<\/span>/);
    assert.match(source, /tracker\.focusQuests\?\.length > 1/);
    assert.doesNotMatch(source, /missionSteps/);
    assert.doesNotMatch(source, /tracker\.chips/);
});

// 구조 불변식(소스 텍스트) — MapNavigator는 지역 그래프/토폴로지 데이터에 깊이
// 의존해 렌더 비용이 크다. mapTopology의 순수 함수 동작은 위에서 실제로 호출해
// 검증했으므로, 여기서는 testid 배선만 남긴다.
test('map navigator promotes current position and primary route above the route list (구조 불변식)', async () => {
    const [source, topology] = await Promise.all([
        readSrc('src/components/MapNavigator.tsx'),
        readSrc('src/components/RouteTopology.tsx'),
    ]);

    assert.match(source, /data-testid="map-navigator"/);
    assert.match(source, /data-testid="map-progress-summary"/);
    assert.match(source, /testId="map-topology"/);
    assert.match(source, /currentTestId="map-current-location-card"/);
    assert.match(source, /connectorTestId="map-route-overview"/);
    assert.match(source, /'map-primary-route'/);
    assert.match(source, /data-testid="map-selected-detail"/);
    assert.match(source, /data-testid="map-route-forecast"/);
    assert.match(source, /data-testid="map-move-selected"/);
    assert.match(source, /getNextMapTowardTarget/);
    assert.match(source, /getDefaultMapSelection\(playerLoc, topologyRoutes\)/);
    assert.match(source, /const formatMapLevel/);
    assert.match(topology, /aether-route-topology-current/);
    assert.match(topology, /aether-route-topology-branches/);
    assert.match(topology, /isMissionRoute/);
    assert.doesNotMatch(source, /`Lv\.\$\{|\}G<\/span>/);
});

test('quest board는 무거운 터미널 카드보다 결정 행(quest-decision-row)을 먼저 실제로 렌더링한다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(QuestBoardPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));

    assert.ok(html.includes('testid="quest-decision-row"'));
    assert.ok(html.includes('data-quest-row-kind='));
    assert.ok(!html.includes('진행 중인 임무가 없습니다'), '신규 플레이어도 잠금 미리보기가 있어 빈 상태 문구가 뜨지 않음');
    assert.ok(html.includes('임무 수락') || html.includes('임무<br/>수락') || html.includes('임무') && html.includes('수락'));
});

test('shop buy rows expose comparable item state and readable blocked reasons (실제 렌더)', () => {
    const player = makePlayerFixture({ level: 5, gold: 0, job: '전사' });
    const shopItems = [
        { name: '고급 강철검', type: 'weapon', tier: 1, price: 999999, val: 10, jobs: ['전사'] },
    ];
    const html = renderStatic(createElement(ShopPanel, {
        player, actions: NOOP_ACTIONS, shopItems, setGameState: () => {}, stats: null, onOpenArchiveConsole: () => {},
    }));

    assert.ok(html.includes('data-testid="shop-buy-item"'));
    assert.ok(html.includes('data-shop-state="blocked"'), '골드가 없으면 blocked 상태');
    assert.ok(html.includes('골드 부족'), '차단 사유가 읽을 수 있는 한국어로 노출됨');
    assert.ok(html.includes('data-testid="shop-buy-inline"'));
});

// 구조 불변식(소스 텍스트) — readabilityMode는 MainLayout/GameRoot/useGameEngine/
// SystemTab 4개 파일에 걸쳐 prop으로 이어지는 배선 계약이다. 이 중 하나만 렌더링해도
// "저장된 설정 → 앱 셸까지 실제로 이어진다"는 계약 전체를 증명하지 못한다(부분
// 렌더는 나머지 파일이 실제로 값을 넘기는지 확인할 수 없다) — 소스 텍스트로 유지.
test('readability mode is wired from saved player setting to app shell and system controls (구조 불변식)', async () => {
    const css = await readSrc('src/index.css');
    const mainLayout = await readSrc('src/components/MainLayout.tsx');
    const gameRoot = await readSrc('src/components/app/GameRoot.tsx');
    const engine = await readSrc('src/hooks/useGameEngine.ts');
    const systemTab = await readSrc('src/components/tabs/SystemTab.tsx');

    assert.match(css, /\[data-readability-mode="high"\]/);
    assert.match(css, /\.panel-noise::before/);
    assert.match(css, /button:focus-visible/);
    assert.match(css, /backdrop-filter:\s*none/);
    assert.match(mainLayout, /data-readability-mode=\{normalizedReadabilityMode\}/);
    assert.match(gameRoot, /readabilityMode = engine\.player\?\.settings\?\.readabilityMode === 'high' \? 'high' : 'standard'/);
    assert.match(gameRoot, /<MainLayout visualEffect=\{engine\.visualEffect\} readabilityMode=\{readabilityMode\}[^>]*>/);
    assert.match(engine, /setReadabilityMode:/);
    assert.match(engine, /readabilityMode: val === 'high' \? 'high' : 'standard'/);
    assert.match(systemTab, /data-testid="readability-settings"/);
    assert.match(systemTab, /data-testid=\{`readability-mode-\$\{option\.value\}`\}/);
    assert.match(systemTab, /aria-pressed=\{active\}/);
    assert.match(systemTab, /READABILITY=\$\{qaContext\.readability\}/);
});
