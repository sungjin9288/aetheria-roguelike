import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('readability foundation uses Korean-friendly readable font stack', async () => {
    const css = await readSrc('src/index.css');
    const tailwind = await readSrc('tailwind.config.js');

    assert.match(css, /--aether-readable-font:/);
    assert.match(css, /Noto Sans KR|Apple SD Gothic Neo|Malgun Gothic/);
    assert.match(css, /body\s*\{[\s\S]*font-readable/);
    assert.match(tailwind, /readable:\s*\['var\(--aether-readable-font\)'\]/);
});

test('control panel exposes a first-screen map signal and route entry points', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');

    assert.match(source, /data-testid="control-map-signal"/);
    assert.match(source, /data-testid="control-map-open"/);
    assert.match(source, /onOpenArchiveConsole\?\.\('map'\)/);
    assert.match(source, /data-testid="control-route-open"/);
    assert.match(source, /setGameState\?\.\(GS\.MOVING\)/);
});

test('map navigator promotes current position and primary route above the route list', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');

    assert.match(source, /data-testid="map-current-location-card"/);
    assert.match(source, /Current Position/);
    assert.match(source, /data-testid="map-primary-route"/);
    assert.match(source, /Recommended Route/);
});

test('first viewport uses compact readable status and log surfaces', async () => {
    const css = await readSrc('src/index.css');
    const status = await readSrc('src/components/StatusBar.tsx');
    const terminal = await readSrc('src/components/TerminalView.tsx');

    assert.match(css, /\.aether-status-shell/);
    assert.match(css, /\.aether-status-metric/);
    assert.match(css, /\.aether-log-panel/);
    assert.match(css, /\.aether-log-row/);
    assert.match(status, /aether-status-shell/);
    assert.match(status, /aether-status-metric/);
    assert.match(terminal, /aether-log-panel/);
    assert.match(terminal, /data-log-type=\{log\.type \|\| 'default'\}/);
    assert.match(terminal, /font-readable/);
});

test('mission tracker is expressed as NEXT ROUTE REWARD RETURN decisions', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');

    assert.match(source, /aether-mission-strip/);
    assert.match(source, /decisionCells/);
    assert.match(source, /label:\s*'NEXT'/);
    assert.match(source, /label:\s*'ROUTE'/);
    assert.match(source, /label:\s*'REWARD'/);
    assert.match(source, /label:\s*'RETURN'/);
    assert.match(source, /tracker\.chips/);
});

test('quest board uses decision rows before heavy terminal cards', async () => {
    const css = await readSrc('src/index.css');
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');

    assert.match(css, /\.aether-choice-row/);
    assert.match(css, /\.aether-choice-cell/);
    assert.match(source, /data-testid=\{testId\}/);
    assert.match(source, /testId="quest-decision-row"/);
    assert.match(source, /data-quest-row-kind=\{kind\}/);
    assert.match(source, /QuestObjectiveLine/);
    assert.match(source, /OperationBriefRows brief=\{entry\.brief\}/);
    assert.match(source, /START OPERATION/);
    assert.match(source, /ACCEPT MISSION/);
});

test('shop buy rows expose comparable item state and readable blocked reasons', async () => {
    const css = await readSrc('src/index.css');
    const source = await readSrc('src/components/ShopPanel.tsx');

    assert.match(css, /\.aether-shop-row/);
    assert.match(css, /\.aether-shop-row\.is-blocked/);
    assert.match(css, /\.aether-shop-delta/);
    assert.match(source, /data-testid="shop-buy-item"/);
    assert.match(source, /data-shop-state=\{canBuy \? 'ready' : 'blocked'\}/);
    assert.match(source, /getBuyBlockReason/);
    assert.match(source, /comparisonText/);
    assert.match(source, /data-testid="shop-buy-inline"/);
});

test('readability mode is wired from saved player setting to app shell and system controls', async () => {
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
    // slice 21: regionTheme prop 추가 허용 — readability 배선 가드는 두 prop
    //   (visualEffect/readabilityMode) 전달 보존이 목적.
    assert.match(gameRoot, /<MainLayout visualEffect=\{engine\.visualEffect\} readabilityMode=\{readabilityMode\}[^>]*>/);
    assert.match(engine, /setReadabilityMode:/);
    assert.match(engine, /readabilityMode: val === 'high' \? 'high' : 'standard'/);
    assert.match(systemTab, /data-testid="readability-settings"/);
    assert.match(systemTab, /data-testid=\{`readability-mode-\$\{mode\}`\}/);
    assert.match(systemTab, /aria-pressed=\{active\}/);
    assert.match(systemTab, /READABILITY=\$\{qaContext\.readability\}/);
});
