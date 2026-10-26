import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import DesktopGameLayout from '../src/components/app/desktop/DesktopGameLayout.tsx';
import DesktopCharacterSheet from '../src/components/app/desktop/DesktopCharacterSheet.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import { DESKTOP_LAYOUT_MIN_WIDTH } from '../src/hooks/useDesktopLayout.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { MSG } from '../src/data/messages.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-10 데스크톱 배치(VD-04 · UX-12) — 화면 폭 1024px 이상은 세 칸이다:
 *   왼쪽 캐릭터(상태 카드 + 능력치 · 장비) · 가운데 무대(기록 + 조작판, 모드 화면은 가운데를 채운다) · 오른쪽 모험 기록.
 * 계약:
 *   1. 세 칸이 모두 있고 각 칸은 이름 있는 영역이다(A11Y-06).
 *   2. 전투 중에는 모험 기록이 잠긴다(모바일 독과 같은 조건) — 기록 탭으로 도주 판정을 건너뛰지 못한다(Wave 19 K2).
 *      상태 카드는 왼쪽 칸에서도 적 상태(enemy-status)를 그린다(스모크 스크립트가 persistent-status-bar 안에서 찾는다).
 *   3. 모드 화면(초점 상태)에서는 무대가 조작판 하나다 — 기록 창을 그리지 않는다.
 *   4. 대기 · 독이 보이는 상태에서는 모험 기록이 열린다.
 *   5. 한 배치만 그린다 — 같은 data-testid가 두 번 생기지 않는다.
 */

const NOOP_ACTIONS = new Proxy({}, { get: () => () => undefined });

const eliteEnemy = () => ({
    name: '정예 숲의 정령', baseName: '숲의 정령', level: 2, hp: 67, maxHp: 134, atk: 16, def: 5,
    exp: 24, gold: 18, isElite: true, isBoss: false, pattern: { heavyChance: 0.2, guardChance: 0.1 },
});

const makeEngine = (overrides = {}) => ({
    gameState: GS.IDLE,
    player: makePlayerFixture({ name: '시험 모험가' }),
    uid: 'u',
    grave: null,
    sideTab: 'inventory',
    actions: NOOP_ACTIONS,
    quickSlots: [],
    syncStatus: 'idle',
    isAiThinking: false,
    logs: [],
    handleCommand: () => {},
    enemy: null,
    shopItems: [],
    currentEvent: null,
    ...overrides,
});

const renderDesktop = (engine, props = {}) => renderStatic(createElement(DesktopGameLayout, {
    engine,
    fullStats: null,
    isPanelFocusState: false,
    mobileArchiveDockVisible: false,
    handleQuickSlotUse: () => {},
    damageFlash: false,
    healFlash: false,
    statusBar: createElement(StatusBar, {
        player: engine.player,
        gameState: engine.gameState,
        enemy: engine.enemy,
        placement: 'column',
    }),
    banners: null,
    mobileConsoleMode: 'log',
    setMobileConsoleMode: () => {},
    onOpenMirror: () => {},
    onOpenCrystalExchange: () => {},
    ...props,
}));

const columnSlice = (html, testId) => {
    const start = html.indexOf(`data-testid="${testId}"`);
    assert.ok(start >= 0, `${testId} 칸이 있다`);
    const nextColumns = ['desktop-character-column', 'desktop-stage-column', 'desktop-archive-column']
        .map((id) => html.indexOf(`data-testid="${id}"`, start + 1))
        .filter((idx) => idx > start);
    return html.slice(start, nextColumns.length ? Math.min(...nextColumns) : html.length);
};

// 한 화면에 하나만 있어야 하는 부품 — 목록 칸(기술 칩 · 예보 줄)처럼 원래 여러 개인 testid는 세지 않는다.
const SINGLETON_TEST_IDS = [
    'desktop-game-layout', 'desktop-character-column', 'desktop-stage-column', 'desktop-archive-column',
    'desktop-character-sheet', 'desktop-archive-locked', 'persistent-status-bar', 'enemy-status',
    'terminal-panel', 'combat-focus-panel', 'mobile-archive-console', 'archive-tab-rail',
];

const duplicateTestIds = (html) => SINGLETON_TEST_IDS.filter(
    (id) => html.split(`data-testid="${id}"`).length - 1 > 1,
);

test('데스크톱 기준 폭은 1024px이다', () => {
    assert.equal(DESKTOP_LAYOUT_MIN_WIDTH, 1024);
});

test('전투: 세 칸 · 이름 있는 영역 · 모험 기록 잠김 · 왼쪽 상태 카드가 적 상태를 그린다', () => {
    const engine = makeEngine({ gameState: GS.COMBAT, enemy: eliteEnemy() });
    const html = renderDesktop(engine, { mobileArchiveDockVisible: false });

    const character = columnSlice(html, 'desktop-character-column');
    const stage = columnSlice(html, 'desktop-stage-column');
    const archive = columnSlice(html, 'desktop-archive-column');

    assert.match(character, new RegExp(`aria-label="${MSG.SHELL_DESKTOP_CHARACTER_REGION}"`));
    assert.match(archive, new RegExp(`aria-label="${MSG.SHELL_DESKTOP_ARCHIVE_REGION}"`));

    assert.ok(character.includes('data-testid="persistent-status-bar"'), '상태 카드는 왼쪽 칸에 있다');
    assert.ok(character.includes('data-status-placement="column"'), '왼쪽 칸 배치로 그린다');
    assert.ok(character.includes('data-testid="enemy-status"'), '전투 중 적 상태는 왼쪽 상태 카드 안에 있다');
    assert.ok(character.includes('data-testid="desktop-character-sheet"'), '능력치 · 장비 카드');

    assert.ok(stage.includes('data-testid="combat-focus-panel"'), '전투 조작판은 가운데 무대에 있다');
    assert.ok(stage.includes('data-testid="terminal-panel"'), '전투 기록도 무대에 있다');

    assert.ok(archive.includes('data-archive-available="false"'));
    assert.ok(archive.includes('data-testid="desktop-archive-locked"'), '전투 중 모험 기록은 잠긴다');
    assert.ok(!html.includes('archive-tab-rail'), '잠긴 동안 기록 탭이 없다');

    assert.deepEqual(duplicateTestIds(html), [], '같은 data-testid가 두 번 생기지 않는다');
});

test('모드 화면: 무대는 조작판 하나다 — 기록 창이 없다', () => {
    const engine = makeEngine({ gameState: GS.COMBAT, enemy: eliteEnemy() });
    const html = renderDesktop(engine, { isPanelFocusState: true, mobileArchiveDockVisible: true });
    const stage = columnSlice(html, 'desktop-stage-column');

    assert.ok(stage.includes('data-testid="combat-focus-panel"'));
    assert.ok(!html.includes('data-testid="terminal-panel"'), '모드 화면에서는 기록 창을 그리지 않는다');
    assert.ok(html.includes('data-testid="desktop-archive-locked"'), '모드 화면에서 모험 기록은 잠긴다');
    assert.deepEqual(duplicateTestIds(html), []);
});

test('대기 · 독이 보이는 상태: 모험 기록이 열린다(잠긴 칸이 아니다)', () => {
    const engine = makeEngine();
    const html = renderDesktop(engine, { mobileArchiveDockVisible: true });
    const archive = columnSlice(html, 'desktop-archive-column');

    assert.ok(archive.includes('data-archive-available="true"'));
    assert.ok(!archive.includes('data-testid="desktop-archive-locked"'), '열린 상태에서는 잠긴 칸을 그리지 않는다');
    assert.ok(columnSlice(html, 'desktop-stage-column').includes('data-testid="terminal-panel"'));
    assert.ok(!html.includes('data-testid="enemy-status"'), '대기 중에는 적 상태가 없다');
    assert.deepEqual(duplicateTestIds(html), []);
});

test('캐릭터 카드: 공격력 · 방어력과 세 장비 칸 — 양손 무기는 보조 칸을 함께 쓴다', () => {
    const player = makePlayerFixture({
        equip: {
            weapon: { name: '시험용 대검', type: 'weapon', hands: 2, val: 10, tier: 1, enhance: 3 },
            armor: null,
            offhand: null,
        },
    });
    const html = renderStatic(createElement(DesktopCharacterSheet, { player, stats: { atk: 42, def: 7 } }));

    assert.match(html, /data-testid="desktop-fact-atk"[\s\S]*?>42</);
    assert.match(html, /data-testid="desktop-fact-def"[\s\S]*?>7</);
    for (const slot of ['weapon', 'armor', 'offhand']) {
        assert.ok(html.includes(`data-testid="desktop-equip-${slot}"`), `${slot} 칸`);
    }
    assert.match(html, /data-testid="desktop-equip-weapon"[\s\S]*?시험용 대검[\s\S]*?\+3/);
    assert.match(html, new RegExp(`data-testid="desktop-equip-armor"[\\s\\S]*?${MSG.SHELL_EQUIP_EMPTY}`));
    assert.ok(html.includes(MSG.OUTFIT_SET_TWO_HAND_SLOT), '양손 무기면 보조 칸은 함께 쓴다고 말한다');
});

test('전투 상태 카드: 내 생명 · 기력 글은 조작판 막대와 겹치지 않게 화면 낭독기에만 — 처치 순간에는 보인다', () => {
    const player = makePlayerFixture({ name: '시험 모험가' });
    const fighting = renderStatic(createElement(StatusBar, { player, enemy: eliteEnemy(), placement: 'bar' }));
    assert.match(fighting, /data-testid="status-combat-vitals" data-vitals-visible="false" class="sr-only"/);
    assert.ok(fighting.includes('기력'), '낭독기용 글은 남는다');

    const defeated = renderStatic(createElement(StatusBar, { player, enemy: { ...eliteEnemy(), hp: 0 }, enemyDefeated: true, placement: 'bar' }));
    assert.match(defeated, /data-testid="status-combat-vitals" data-vitals-visible="true" class="mt-1 /);
});
