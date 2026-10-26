import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ControlPanel from '../src/components/ControlPanel.tsx';
import TerminalView from '../src/components/TerminalView.tsx';
import { GS } from '../src/reducers/gameStates.ts';
import { MSG } from '../src/data/messages.ts';
import { CONSTANTS } from '../src/data/constants.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 에테르 유리(시안 mock-expedition) — 원정 도크 · 기록 창 장면 머리의 행동 계약. 실제 렌더로 잰다.
 *   ① 도크: 탐험이 유일한 금빛 주 단추이고 보조 줄에 지금 지역 이름을 든다(길 잃은 여행이면 가린다)
 *   ② 도크: 지도 단추는 기록을 열 수 있을 때만 눌린다 · 정찰은 비용을 숫자로 말한다
 *   ③ 장면 머리: 대기 중에만 지금 지역 이름 · 종류를 그리고, 길 잃은 여행이면 이름 · 그림을 가린다
 */

const noopActions = new Proxy({}, { get: () => () => {} });

const renderControl = (overrides = {}) => renderStatic(createElement(ControlPanel, {
    gameState: GS.IDLE,
    player: makePlayerFixture({ name: '용사', loc: '고요한 숲', level: 3, gold: 500 }),
    enemy: null,
    actions: noopActions,
    setGameState: () => {},
    shopItems: [],
    grave: null,
    isAiThinking: false,
    currentEvent: null,
    stats: null,
    onOpenArchiveConsole: () => {},
    onOpenMirror: () => {},
    ...overrides,
}));

const renderTerminal = (player, gameState = GS.IDLE) => renderStatic(createElement(TerminalView, {
    logs: [{ id: 'l1', type: 'system', text: '기록' }],
    gameState,
    player,
    quickSlots: [],
    onQuickSlotUse: () => {},
}));

const sliceButton = (html, testId) => {
    const at = html.indexOf(`data-testid="${testId}"`);
    assert.ok(at >= 0, `${testId}가 그려진다`);
    return html.slice(html.lastIndexOf('<', at), html.indexOf('</button>', at));
};

test('① 원정 도크: 탐험은 하나뿐인 주 단추이고 지금 지역 이름을 보조 줄로 든다', () => {
    const html = renderControl();
    assert.equal(html.split('data-variant="primary"').length - 1, 1, '주 단추는 하나다');
    const explore = sliceButton(html, 'control-explore');
    assert.match(explore, /data-variant="primary"/);
    assert.match(explore, /class="ae-btn-sublabel">고요한 숲</);
});

test('① 길 잃은 여행: 도크의 보조 줄은 지역 이름을 가린다', () => {
    const player = makePlayerFixture({ name: '용사', loc: '고요한 숲', level: 3, challengeModifiers: ['blindMap'] });
    const explore = sliceButton(renderControl({ player }), 'control-explore');
    assert.ok(explore.includes(`>${MSG.BLIND_MAP_LOCATION}<`));
    assert.ok(!explore.includes('고요한 숲'));
});

test('② 지도 단추는 기록을 열 수 있을 때만 눌리고, 정찰은 비용을 숫자로 말한다', () => {
    assert.doesNotMatch(sliceButton(renderControl(), 'control-map-open'), /disabled=""/);
    assert.match(sliceButton(renderControl({ onOpenArchiveConsole: undefined }), 'control-map-open'), /disabled=""/);

    const scout = sliceButton(renderControl(), 'control-scout');
    assert.match(scout, /data-testid="control-scout-cost" class="font-fira tabular-nums"/);
});

test('② 마을: 원정 준비 카드의 출발이 화면의 하나뿐인 주 단추다', () => {
    const town = makePlayerFixture({ name: '용사', loc: CONSTANTS.START_LOCATION, level: 1 });
    const html = renderControl({ player: town });
    assert.equal(html.split('data-variant="primary"').length - 1, 1);
    const primaryAt = html.indexOf('data-variant="primary"');
    assert.ok(primaryAt > html.indexOf('data-testid="control-town-primary"'), '주 단추는 원정 준비 카드 안이다');
    assert.ok(!html.includes('data-testid="control-field-actions"'), '마을에는 원정 도크가 없다');
});

test('③ 장면 머리: 대기 중 지역 이름 · 종류를 그리고, 전투 중에는 그리지 않는다', () => {
    const field = renderTerminal(makePlayerFixture({ name: '용사', loc: '고요한 숲', level: 3 }));
    assert.match(field, /data-testid="terminal-scene"/);
    assert.ok(field.includes('>고요한 숲<'));
    assert.ok(field.includes(`>${MSG.FIELD_REGION_KIND.field}<`));
    assert.match(field, /data-testid="terminal-location-visual"/);

    const safe = renderTerminal(makePlayerFixture({ name: '용사', loc: '여행자의 쉼터', level: 10 }));
    assert.ok(safe.includes(`>${MSG.FIELD_REGION_KIND.safe}<`));

    const combat = renderTerminal(makePlayerFixture({ name: '용사', loc: '고요한 숲', level: 3 }), GS.COMBAT);
    assert.doesNotMatch(combat, /data-testid="terminal-scene"/);
});

test('③ 길 잃은 여행: 장면 머리는 지역 이름 · 그림을 가린다', () => {
    const blind = renderTerminal(makePlayerFixture({ name: '용사', loc: '고요한 숲', level: 3, challengeModifiers: ['blindMap'] }));
    assert.match(blind, /data-testid="terminal-scene"/);
    assert.ok(blind.includes(`>${MSG.BLIND_MAP_LOCATION}<`));
    assert.ok(!blind.includes('고요한 숲'));
    assert.doesNotMatch(blind, /data-testid="terminal-location-visual"/);
});
