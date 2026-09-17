import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';

import MobileGameLayout from '../src/components/app/MobileGameLayout.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import CombatPanel from '../src/components/tabs/CombatPanel.tsx';
import TerminalView from '../src/components/TerminalView.tsx';
import { GS } from '../src/reducers/gameStates.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

/**
 * 원래 계약 (각 assert가 지키던 것, 소스 텍스트 정규식이었다):
 *   1. MobileGameLayout: 전투 중에는 최근 전투 기록(TerminalView)이 결정 영역
 *      (ControlPanel) 위쪽(order-1)에, 결정 영역은 아래(order-2)에 온다.
 *   2. StatusBar: 전투 모드(data-status-mode="combat")에서는 플레이어 자원(생명/기력)을
 *      압축 표시하고 적 아트(size=46, h-14 w-14)를 도드라지게 보여준다. "생명/기력/레벨/
 *      교전 대상" 라벨은 한국어.
 *   3. CombatPanel: 행동 버튼은 공격/기술/아이템/도주 순으로 노출되고 각각
 *      data-testid="combat-action-{key}"를 갖는다. 기술 사이클 버튼(combat-skill-cycle)이
 *      있다. 아이템 패널은 데스크톱(!mobile)에서는 항상, 모바일에서는 itemsOpen일 때만 열린다.
 *   4. TerminalView: 전투 로그는 기본 3줄 요약(SUMMARY_LOG_COUNT)으로 시작하고,
 *      combat-log-toggle로 펼칠 수 있다(aria-expanded/data-log-expanded로 상태 노출).
 *   5. CombatPanel: 보스 시그니처/카운터 힌트는 더 이상 데스크톱 전용이 아니라
 *      모바일에서도 노출된다.
 *   6. combat-focus e2e 스모크는 결정론적 시드 시나리오(seedCombatFocusScenario)와
 *      사용 가능한 아이템을 이용해 테스트한다.
 *
 * 1~5는 실제 컴포넌트를 renderStatic으로 렌더링해 markup/텍스트로 검증한다.
 * 6은 `useGameTestApi`가 풀 엔진(`engineRef.current.dispatch`)에 묶인 QA 시드 함수이고
 * e2e spec은 Playwright 브라우저 흐름이라 — 둘 다 컴포넌트 렌더 대상이 없다.
 * 구조 불변식(소스 텍스트)로 유지한다.
 */

test('MobileGameLayout: 전투 중에는 로그 영역이 order-1, 결정 영역이 order-2', () => {
    const player = makePlayerFixture();
    const baseProps = {
        fullStats: null,
        isPanelFocusState: false,
        mobileArchiveDockVisible: false,
        handleQuickSlotUse: () => {},
        damageFlash: false,
        healFlash: false,
        mobileConsoleMode: 'log',
        setMobileConsoleMode: () => {},
        onOpenMirror: () => {},
        onOpenCrystalExchange: () => {},
    };

    // GS.COMBAT: ControlPanel은 이 상태에서 CombatPanel로 즉시 분기하므로
    // (마을/탐험 안내 계산을 건드리지 않고) isCombat=true 케이스를 안전하게 렌더할 수 있다.
    const combatEngine = {
        gameState: GS.COMBAT,
        player,
        uid: 'test-uid',
        grave: null,
        sideTab: 'inventory',
        actions: { setSideTab: () => {}, setGameState: () => {}, getSelectedSkill: () => null, combat: () => {} },
        quickSlots: [],
        syncStatus: 'idle',
        isAiThinking: false,
        logs: [],
        handleCommand: () => {},
        enemy: null,
        shopItems: [],
        currentEvent: null,
    };
    const htmlCombat = renderStatic(createElement(MobileGameLayout, { engine: combatEngine, ...baseProps }));
    assert.match(htmlCombat, /class="[^"]*\border-1\b[^"]*min-h-\[132px\][^"]*"[^>]*>[\s\S]*?data-testid="terminal-panel"/, 'TerminalView 래퍼가 order-1 min-h-[132px]');
    assert.match(htmlCombat, /class="[^"]*\border-2\b[^"]*shrink-0[^"]*"[^>]*>[\s\S]*?data-testid="combat-focus-panel"/, 'ControlPanel(CombatPanel) 래퍼가 order-2 shrink-0');

    // GS.EVENT + isAiThinking=true: isCombat=false 이면서도 ControlPanel이
    // (마을 안내 계산 없이) 정적 로딩 문구만 반환하는 안전한 비-전투 경로.
    const eventEngine = { ...combatEngine, gameState: GS.EVENT, isAiThinking: true };
    const htmlEvent = renderStatic(createElement(MobileGameLayout, { engine: eventEngine, ...baseProps }));
    assert.doesNotMatch(htmlEvent, /order-1 min-h-\[132px\]/, '비전투 상태에는 order-1 클래스가 붙지 않음');
    assert.doesNotMatch(htmlEvent, /\border-2\b shrink-0/, '비전투 상태의 결정 영역은 order-2가 아니라 그냥 shrink-0');
    assert.match(htmlEvent, /min-h-\[240px\]/, '비전투 상태의 로그 영역은 기본 min-h 사용');
});

test('StatusBar: 전투 모드는 자원 압축 + 적 아트 확대 + 한국어 라벨', () => {
    const player = makePlayerFixture({ name: '테스트 모험가', hp: 40, mp: 10, level: 5 });
    const enemy = { name: '숲의 정령', hp: 30, maxHp: 60, isBoss: false };
    const html = renderStatic(createElement(StatusBar, { player, stats: null, enemy, enemyHitCrit: false }));

    assert.ok(html.includes('data-status-mode="combat"'));
    assert.ok(html.includes('aether-combat-player-status'));
    assert.match(html, /class="[^"]*\bh-14 w-14\b[^"]*"/, '적 초상 프레임이 h-14 w-14');
    assert.ok(html.includes('data-testid="enemy-portrait"'));
    // MonsterIcon size={46}
    assert.match(html, /width:46px/);
    for (const label of ['생명', '기력', '레벨', '교전 대상']) {
        assert.ok(html.includes(label), `"${label}" 라벨 노출`);
    }
});

test('CombatPanel: 행동 버튼은 공격/기술/아이템/도주 순서 + combat-skill-cycle 노출', () => {
    const player = makePlayerFixture({ mp: 20 });
    const enemy = { name: '정예 숲의 정령', hp: 100, maxHp: 100, isBoss: false };
    const actions = { getSelectedSkill: () => ({ name: '테스트 기술', mp: 5 }), cycleSkill: () => {}, combat: () => {} };
    const html = renderStatic(createElement(CombatPanel, {
        player, actions, enemy, stats: { atk: 10, def: 5, maxHp: 100, maxMp: 50 }, isAiThinking: false, mobile: false,
    }));

    const order = ['attack', 'skill', 'item', 'escape'].map((key) => html.indexOf(`data-testid="combat-action-${key}"`));
    assert.ok(order.every((idx) => idx >= 0), '4개 행동 버튼이 모두 렌더링됨');
    assert.deepEqual(order, [...order].sort((a, b) => a - b), '공격 → 기술 → 아이템 → 도주 순서로 등장');
    assert.ok(html.includes('data-testid="combat-skill-cycle"'), '선택한 기술이 있으면 기술 사이클 버튼 노출');
});

test('CombatPanel: 모바일에서는 itemsOpen 이전엔 소모품 패널이 닫혀 있고, 데스크톱에서는 항상 열려있다', () => {
    const player = makePlayerFixture({ inv: [{ id: 'p1', name: '회복 물약', type: 'hp', val: 30 }] });
    const enemy = { name: '정예 숲의 정령', hp: 100, maxHp: 100, isBoss: false };
    const actions = { getSelectedSkill: () => null, combat: () => {} };
    const stats = { atk: 10, def: 5, maxHp: 100, maxMp: 50 };

    const htmlMobile = renderStatic(createElement(CombatPanel, { player, actions, enemy, stats, isAiThinking: false, mobile: true }));
    assert.ok(!htmlMobile.includes('combat-consumable-p1'), '모바일 초기 상태(itemsOpen=false)에는 소모품 패널이 접혀 있음');

    const htmlDesktop = renderStatic(createElement(CombatPanel, { player, actions, enemy, stats, isAiThinking: false, mobile: false }));
    assert.ok(htmlDesktop.includes('combat-consumable-p1'), '데스크톱(!mobile)에서는 소모품 패널이 항상 열려 있음');
});

test('TerminalView: 전투 로그는 기본 3줄 요약 + combat-log-toggle로 펼침 상태 노출', () => {
    // 숫자를 쓰면 renderLogText가 숫자만 <strong>으로 분리해 굵게 표시하므로
    // (예: "전투 로그 3" → "전투 로그 " + <strong>3</strong>) 문자열 포함 검사가
    // 어긋난다. 순서 판별용으로 알파벳 마커를 쓴다.
    const markers = ['가', '나', '다', '라', '마', '바'];
    const logs = markers.map((marker, i) => ({ id: `l${i}`, type: 'combat', text: `전투 로그 ${marker}` }));
    const html = renderStatic(createElement(TerminalView, {
        logs, gameState: GS.COMBAT, onCommand: () => {}, player: null, quickSlots: [], onQuickSlotUse: () => {},
    }));

    assert.ok(html.includes('data-testid="combat-log-toggle"'));
    assert.ok(html.includes('aria-expanded="false"'), '기본값은 접힌 상태(logExpanded=false)');
    assert.ok(html.includes('data-log-expanded="false"'));
    for (const marker of markers.slice(3)) {
        assert.ok(html.includes(`전투 로그 ${marker}`), `최근 3개(로그 ${marker})는 표시됨`);
    }
    for (const marker of markers.slice(0, 3)) {
        assert.ok(!html.includes(`전투 로그 ${marker}`), `그보다 오래된 로그(${marker})는 요약 모드에서 숨겨짐`);
    }
});

test('CombatPanel: 보스 시그니처/카운터 힌트는 모바일에서도 노출된다', () => {
    const player = makePlayerFixture();
    const actions = { getSelectedSkill: () => null, combat: () => {} };
    const stats = { atk: 10, def: 5, maxHp: 100, maxMp: 50 };
    // 실제 보스 이름을 써서 getEnemyTacticalProfile이 signature/counterHint를 채우게 한다.
    const enemy = { name: '마왕', baseName: '마왕', isBoss: true, hp: 500, maxHp: 500 };
    const html = renderStatic(createElement(CombatPanel, { player, actions, enemy, stats, isAiThinking: false, mobile: true }));

    const hasSignature = html.includes('data-testid="combat-boss-signature"');
    const hasCounter = html.includes('data-testid="combat-boss-counter"');
    assert.ok(hasSignature || hasCounter, '모바일(mobile=true)에서도 보스 기믹/대응 힌트 중 하나 이상 노출');
});

// 구조 불변식(소스 텍스트) — useGameTestApi의 seedCombatFocusScenario는 풀 엔진
// (engineRef.current.dispatch)에 묶여 있어 컴포넌트 렌더로는 검증할 수 없고,
// combat-focus.spec.ts는 Playwright 브라우저 시나리오라 렌더 대상이 없다.
test('combat focus E2E uses a deterministic encounter with a usable item', async () => {
    const testApi = await readSrc('src/hooks/useGameTestApi.ts');
    const e2e = await readSrc('tests/e2e/combat-focus.spec.ts');

    assert.match(testApi, /seedCombatFocusScenario/);
    assert.match(testApi, /type: AT\.SET_ENEMY/);
    assert.match(testApi, /type: AT\.SET_GAME_STATE, payload: GS\.COMBAT/);
    assert.match(e2e, /combat-action-item/);
    assert.match(e2e, /combat-log-toggle/);
});
