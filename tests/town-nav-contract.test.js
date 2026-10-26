import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ControlPanel from '../src/components/ControlPanel.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import RouteTopology from '../src/components/RouteTopology.tsx';
import { QuickSlotAssigner } from '../src/components/QuickSlot.tsx';
import MirrorPanel from '../src/components/MirrorPanel.tsx';
import PremiumShop from '../src/components/PremiumShop.tsx';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { MSG } from '../src/data/messages.ts';
import { CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { getEventPanelCopy } from '../src/utils/eventPresentation.ts';
import { getPreferredScrollBehavior } from '../src/utils/scrollBehavior.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 통합 감사(town-nav) — 마을 · 원정 조작판 길찾기 계약. 모두 실제 렌더 · 실제 리듀서로 잰다.
 *   UX-03 원정 조작판의 이동은 하나이고 탐험이 주 행동이다 · UX-07 원정 중 가방으로 가는 이름 있는 단추
 *   UX-09 같은 동작(이전으로)은 한 이름 · 선택 없이 떠난 이벤트는 기록에 남는다 · UX-02 경로 노드 이름은 칩과 한 줄을 다투지 않는다
 *   A11Y-05 상점 전환 · 할인 구매 · 크리스탈 · 퀵슬롯 배치 단추의 이름 · 선택 상태 · CL-02 마을 시설의 에테르 거울
 */

const noopActions = new Proxy({}, { get: () => () => {} });

const renderControlPanel = (overrides = {}) => renderStatic(createElement(ControlPanel, {
    gameState: GS.IDLE,
    player: makePlayerFixture({ name: '용사', loc: '고요한 숲', level: 3 }),
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

const countTestId = (html, testId) => html.split(`data-testid="${testId}"`).length - 1;

const openingTag = (html, testId) => {
    const at = html.indexOf(`data-testid="${testId}"`);
    assert.ok(at >= 0, `${testId}가 그려진다`);
    const start = html.lastIndexOf('<', at);
    return html.slice(start, html.indexOf('>', at) + 1);
};

test('UX-03 · UX-07: 원정 조작판은 이동 단추 하나 · 가방 단추 · 주 행동 탐험을 그린다', () => {
    const html = renderControlPanel();

    assert.equal(countTestId(html, 'control-move'), 1, '이동은 하나다');
    assert.equal(countTestId(html, 'control-route-open'), 0, '지도 신호 줄의 두 번째 이동은 없다');
    assert.equal(countTestId(html, 'control-explore'), 1);
    // 2026-10 에테르 유리: 탐험은 화면의 유일한 금빛 주 단추(ActionButton primary)다.
    assert.match(openingTag(html, 'control-explore'), /data-variant="primary"/, '탐험이 주 행동 모양이다');
    assert.equal(html.split('data-variant="primary"').length - 1, 1, '주 단추는 하나다');

    const bag = openingTag(html, 'control-open-bag');
    assert.doesNotMatch(bag, /disabled=""/, '기록을 열 수 있으면 가방 단추가 눌린다');
    const bagAt = html.indexOf('data-testid="control-open-bag"');
    const bagEnd = html.indexOf('</button>', bagAt);
    assert.ok(html.slice(bagAt, bagEnd).includes(`>${MSG.FIELD_ACTION_BAG}<`), '가방 단추는 이름을 글자로 보인다');

    const row = openingTag(html, 'control-field-actions');
    // 2026-10 에테르 유리: 도크는 탐험(한 줄 전체, 좁은 폭) 아래 이동 · 지도 · 정찰 · 가방이 한 줄이다 — 넓은 폭은 컨테이너 질의로 한 줄.
    assert.match(row, /ae-field-dock/);
    const rowAt = html.indexOf('data-testid="control-field-actions"');
    const rowHtml = html.slice(rowAt, html.indexOf('data-testid="control-open-bag"', rowAt) + 'data-testid="control-open-bag"'.length);
    assert.deepEqual(
        [...rowHtml.matchAll(/data-testid="(control-[a-z-]+)"/g)].map((match) => match[1]),
        ['control-field-actions', 'control-explore', 'control-move', 'control-map-open', 'control-scout', 'control-scout-cost', 'control-open-bag'],
    );
});

test('UX-03: 기록을 열 수 없는 화면에서는 가방 단추가 눌리지 않는다', () => {
    const html = renderControlPanel({ onOpenArchiveConsole: undefined });
    assert.match(openingTag(html, 'control-open-bag'), /disabled=""/);
});

test('CL-02: 마을 시설에는 에테르 거울이 있고, 거울을 열 수 있을 때만 눌린다', () => {
    const town = makePlayerFixture({ name: '용사', loc: CONSTANTS.START_LOCATION, level: 1 });
    const html = renderControlPanel({ player: town });
    const facilities = html.slice(html.indexOf('data-testid="control-town-facilities"'));
    assert.ok(facilities.includes('data-testid="control-mirror"'), '마을 시설 안에 거울 단추가 있다');
    assert.ok(facilities.includes(`>${MSG.TOWN_FACILITIES_TITLE}<`));
    assert.doesNotMatch(openingTag(html, 'control-mirror'), /disabled=""/);

    const withoutMirror = renderControlPanel({ player: town, onOpenMirror: undefined });
    assert.match(openingTag(withoutMirror, 'control-mirror'), /disabled=""/);
});

test('UX-09: 화면을 바꾸는 패널의 이전으로 단추는 모두 MSG.UI_BACK이다', () => {
    const town = makePlayerFixture({ name: '용사', loc: CONSTANTS.START_LOCATION, level: 1 });
    const campfire = { isCampfire: true, title: '모닥불', desc: '불', choices: ['쉰다'], outcomes: [{ choiceIndex: 0, hp: 10 }] };
    const surfaces = {
        event: renderControlPanel({ gameState: GS.EVENT, currentEvent: campfire }),
        shop: renderControlPanel({ gameState: GS.SHOP, player: town }),
        quests: renderControlPanel({ gameState: GS.QUEST_BOARD, player: town }),
        craft: renderControlPanel({ gameState: GS.CRAFTING, player: town }),
        jobChange: renderControlPanel({ gameState: GS.JOB_CHANGE, player: { ...town, level: 10 } }),
    };
    for (const [name, html] of Object.entries(surfaces)) {
        assert.ok(html.includes(`>${MSG.UI_BACK}<`), `${name}: 이전으로 단추 이름이 ${MSG.UI_BACK}이다`);
        assert.ok(!html.includes('>복귀<'), `${name}: 옛 이름 '복귀'가 남지 않는다`);
    }
});

test('UX-09: 덮는 화면(에테르 거울 · 에테르 교환소)의 닫기는 머리글 하나이고 보이는 이름이 MSG.UI_CLOSE다', () => {
    const player = makePlayerFixture({ name: '용사', loc: CONSTANTS.START_LOCATION, premiumCurrency: 5 });
    const overlays = {
        'mirror-panel-close': { html: renderStatic(createElement(MirrorPanel, { player, onClose: () => {}, onPurchase: () => {} })), name: '에테르 거울 닫기' },
        'premium-shop-close': { html: renderStatic(createElement(PremiumShop, { player, onClose: () => {} })), name: '에테르 교환소 닫기' },
    };
    for (const [testId, { html, name }] of Object.entries(overlays)) {
        assert.equal(countTestId(html, testId), 1);
        const tag = openingTag(html, testId);
        assert.match(tag, /^<button type="button"/);
        assert.ok(tag.includes(`aria-label="${name}"`), `${testId}: 무엇을 닫는지 이름이 말한다`);
        const closeAt = html.indexOf(`data-testid="${testId}"`);
        const closeHtml = html.slice(closeAt, html.indexOf('</button>', closeAt) + '</button>'.length);
        assert.ok(closeHtml.includes(`>${MSG.UI_CLOSE}<`), `${testId}: 보이는 이름이 있다`);
        assert.equal(html.split(`>${MSG.UI_CLOSE}<`).length - 1, 1, `${testId}: 닫기는 하나다`);
        assert.ok(!html.includes('돌아가기'), `${testId}: 바닥의 두 번째 닫기('돌아가기')가 없다`);
    }
});

test('UX-09: 선택 없이 떠난 이벤트는 기록에 한 줄 남고, 대기로 돌아간다', () => {
    const campfire = { isCampfire: true, title: '모닥불', choices: ['쉰다'], outcomes: [] };
    const state = { ...INITIAL_STATE, gameState: GS.EVENT, currentEvent: campfire, logs: [] };
    const next = gameReducer(state, { type: AT.LEAVE_EVENT });

    assert.equal(next.gameState, GS.IDLE);
    assert.equal(next.currentEvent, null);
    const expected = MSG.EVENT_LEAVE_LOG(getEventPanelCopy(campfire).title);
    assert.deepEqual(next.logs.map(({ type, text }) => ({ type, text })), [{ type: 'system', text: expected }]);
    assert.equal(state.logs.length, 0, '이전 상태를 바꾸지 않는다');

    // 같은 상태에서 다시 떠나면 같은 줄(결정론 — 기록 id에 난수를 쓰지 않는다).
    const again = gameReducer(state, { type: AT.LEAVE_EVENT });
    assert.equal(again.logs[0].id.split('-').at(-2), next.logs[0].id.split('-').at(-2));
});

test('UX-09: 행상인 만남을 떠날 때는 이벤트를 지나쳤다는 줄을 겹쳐 쓰지 않는다', () => {
    const merchant = { isWanderingMerchant: true, title: '떠돌이 행상인', choices: [], outcomes: [] };
    const state = { ...INITIAL_STATE, gameState: GS.EVENT, currentEvent: merchant, logs: [] };
    const next = gameReducer(state, { type: AT.LEAVE_EVENT });
    assert.equal(next.gameState, GS.IDLE);
    assert.equal(next.currentEvent, null);
    assert.ok(next.logs.every((log) => log.text !== MSG.EVENT_LEAVE_LOG(getEventPanelCopy(merchant).title)));
});

test('UX-02: 경로 노드 이름은 최소 폭을 지키고, 칩은 줄을 넘겨 다음 줄로 내려간다', () => {
    const html = renderStatic(createElement(RouteTopology, {
        testId: 'route',
        currentName: CONSTANTS.START_LOCATION,
        routes: [{ name: '고요한 숲', isMissionRoute: true, levelLabel: '레벨 1' }],
        routeTestId: () => 'route-node',
    }));
    const nameAt = html.indexOf('aether-route-topology-name');
    assert.ok(nameAt >= 0);
    const nameTag = html.slice(html.lastIndexOf('<', nameAt), html.indexOf('>', nameAt) + 1);
    assert.match(nameTag, /min-w-\[min\(4\.5rem,100%\)\]/, '이름은 4.5rem(칸이 더 좁으면 칸 전체) 아래로 줄지 않는다');
    const rowTag = html.slice(html.lastIndexOf('<span', html.lastIndexOf('<', nameAt) - 1), html.lastIndexOf('<', nameAt));
    assert.match(rowTag, /flex-wrap/, '이름 줄은 칩을 다음 줄로 넘긴다');
    assert.ok(html.includes('임무 경로'));
});

test('A11Y-05: 상점 구매 · 판매 전환은 이름 있는 묶음이고 고른 쪽을 aria-pressed로 알린다', () => {
    const town = makePlayerFixture({ name: '용사', loc: CONSTANTS.START_LOCATION, level: 1 });
    const html = renderControlPanel({ gameState: GS.SHOP, player: town, shopItems: DB.ITEMS.consumables.slice(0, 3) });
    assert.ok(html.includes(`role="group" aria-label="${MSG.SHOP_MODE_GROUP_ARIA}"`));
    const buy = openingTag(html, 'shop-mode-buy');
    const sell = openingTag(html, 'shop-mode-sell');
    assert.match(buy, /aria-pressed="true"/);
    assert.match(sell, /aria-pressed="false"/);
    for (const tag of [buy, sell]) {
        assert.match(tag, /type="button"/);
        assert.match(tag, /min-h-11/);
        assert.match(tag, /min-w-11/);
    }
    // 오늘의 할인 · 목록의 구매 단추도 44px 폭이다('구매' 두 글자 단추가 41px였다).
    for (const testId of ['shop-daily-buy', 'shop-buy-inline']) {
        const tags = [...html.matchAll(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`, 'g'))].map((match) => match[0]);
        assert.ok(tags.length > 0, `${testId}를 그렸다`);
        for (const tag of tags) {
            assert.match(tag, /type="button"/);
            assert.match(tag, /min-h-\[44px\]/);
            assert.match(tag, /min-w-11/);
        }
    }
});

test('A11Y-05: 상태 표시줄 크리스탈은 이름 있는 단추이고, 열 곳이 없으면 단추가 아니다', () => {
    const player = makePlayerFixture({ name: '용사', loc: CONSTANTS.START_LOCATION, premiumCurrency: 7 });
    const clickable = renderStatic(createElement(StatusBar, { player, onCrystalClick: () => {} }));
    const crystal = openingTag(clickable, 'status-crystal');
    assert.match(crystal, /^<button/);
    assert.ok(crystal.includes(`aria-label="${MSG.STATUS_CRYSTAL_ARIA(7)}"`));
    assert.match(crystal, /min-h-11/);
    assert.match(crystal, /min-w-11/);

    const passive = renderStatic(createElement(StatusBar, { player, onCrystalClick: null }));
    assert.equal(countTestId(passive, 'status-crystal'), 0);
    // 2026-10 에테르 유리 3차(shell · VD-13): 보석은 이모지가 아니라 선 아이콘이다 — 수는 그대로 보인다.
    assert.match(passive, /data-testid="status-crystal-passive"[^>]*>[\s\S]*?<svg[\s\S]*?<\/svg>7<\/span>/);
    assert.ok(!passive.includes('💎'));
});

test('A11Y-05: 퀵슬롯 배치 단추는 숫자가 아니라 하는 일을 이름으로 말한다', () => {
    const potion = { id: 'p1', name: '하급 체력 물약', type: 'hp', val: 50 };
    const other = { id: 'p2', name: '하급 마나 물약', type: 'mp', val: 30 };
    const html = renderStatic(createElement(QuickSlotAssigner, {
        item: potion, onAssign: () => {}, currentSlots: [potion, other, null],
    }));
    assert.match(openingTag(html, 'quick-slot-assign-0'), new RegExp(`aria-label="${MSG.QUICK_SLOT_ASSIGN_ARIA(1, potion.name)}"[^>]*aria-pressed="true"`));
    assert.match(openingTag(html, 'quick-slot-assign-1'), /aria-pressed="false"/);
    assert.ok(openingTag(html, 'quick-slot-assign-2').includes(`aria-label="${MSG.QUICK_SLOT_ASSIGN_ARIA(3)}"`));
    assert.ok(openingTag(html, 'quick-slot-unassign').includes(`aria-label="${MSG.QUICK_SLOT_UNASSIGN}"`));
});

test('UX-01 · UX-08: 시설 펼침 · 탭 레일 넘김의 스크롤은 모션을 줄인 사용자에게 즉시 옮긴다', () => {
    const hadWindow = Object.hasOwn(globalThis, 'window');
    const previous = globalThis.window;
    const withMedia = (matches) => {
        globalThis.window = { matchMedia: (query) => ({ matches: matches && query === '(prefers-reduced-motion: reduce)' }) };
        return getPreferredScrollBehavior();
    };
    try {
        assert.equal(withMedia(true), 'auto');
        assert.equal(withMedia(false), 'smooth');
        globalThis.window = {};
        assert.equal(getPreferredScrollBehavior(), 'smooth');
    } finally {
        if (hadWindow) globalThis.window = previous;
        else delete globalThis.window;
    }
});
