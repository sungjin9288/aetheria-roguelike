import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';

import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import CraftingPanel from '../src/components/tabs/CraftingPanel.tsx';
import BagCraftingSection from '../src/components/tabs/BagCraftingSection.tsx';
import ShopPanel from '../src/components/ShopPanel.tsx';
import PremiumShop from '../src/components/PremiumShop.tsx';
import MirrorPanel from '../src/components/MirrorPanel.tsx';
import OverlayCloseButton from '../src/components/OverlayCloseButton.tsx';
import FocusPanelHeader from '../src/components/FocusPanelHeader.tsx';
import { MSG } from '../src/data/messages.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 에테르 유리(wave 3 · 마을 시설) — 상점 · 제작소 · 임무 게시판 · 크리스탈 교환소 · 에테르 거울 ·
 * 집중 화면 머리의 디자인 계약. 모두 실제 렌더로 잰다(소스 정규식은 CSS 블록의 부재 불변식 하나뿐).
 *
 *   1. 금빛 주 행동(`data-variant="primary"`)은 화면마다 하나 이하다 — 임무 게시판은 첫 번째로 받을 수 있는
 *      추천 임무, 교환소 · 거울은 확정 단추, 제작소는 합성 시작이다(제작 · 구매처럼 줄마다 있는 행동은 유리).
 *   2. 임무 카드는 호박빛 유리(`ae-town-mission`)이고 이야기 임무는 같은 카드에 에테르 결(`is-story`)만 더한다.
 *   3. 전환 단추(상점 구매 · 판매 · 제작 방식)는 이름 있는 묶음 안의 44px 눌림 상태 단추다.
 *   4. 머리의 돌아가기 · 기록 열기와 오버레이 닫기는 같은 44px 알약(`ae-town-pill`)이다.
 *   5. 마을 CSS 블록은 색을 토큰으로만 쓴다(새 hex · rgba 숫자 0).
 */

const noopActions = new Proxy({}, { get: () => () => {} });

const openingTags = (html) => html.match(/<[a-z]+\b[^>]*>/g) || [];
const primaryTags = (html) => openingTags(html).filter((tag) => tag.includes('data-variant="primary"'));
const tagsWithTestId = (html, testId) => openingTags(html).filter((tag) => tag.includes(`data-testid="${testId}"`));

const renderQuestBoard = (player = makePlayerFixture()) => renderStatic(createElement(QuestBoardPanel, {
    player, actions: noopActions, setGameState: () => {}, onOpenArchiveConsole: () => {},
}));

test('임무 게시판: 금빛 주 행동은 첫 번째로 받을 수 있는 추천 임무 하나뿐이다', () => {
    const html = renderQuestBoard();
    const starts = tagsWithTestId(html, 'quest-board-start-operation');
    assert.ok(starts.length >= 2, '추천 임무가 여럿 그려진다(픽스처 전제)');

    const primaries = primaryTags(html);
    assert.equal(primaries.length, 1, '금빛 단추는 하나');
    assert.ok(primaries[0].includes('data-testid="quest-board-start-operation"'), '그 하나는 추천 임무 수락');
    assert.ok(primaries[0].includes('data-quest-action-state="ready"'), '잠긴 미리보기는 주 행동이 아니다');
    assert.ok(starts.slice(1).every((tag) => tag.includes('data-variant="glass"') || tag.includes('data-quest-action-state="locked"')),
        '나머지 추천 임무 수락은 유리 단추');
});

test('임무 게시판: 임무 카드는 호박빛 유리이고 루트는 마을 유리 한 장이다', () => {
    const html = renderQuestBoard();
    const rows = tagsWithTestId(html, 'quest-decision-row');
    assert.ok(rows.length > 0);
    assert.ok(rows.every((tag) => /class="[^"]*\bae-town-mission\b/.test(tag)), '모든 임무 카드가 ae-town-mission');
    const root = tagsWithTestId(html, 'quest-board-panel')[0];
    assert.match(root, /class="[^"]*\bae-town\b[^"]*\baether-focus-panel\b/);
    assert.ok(!html.includes('aether-choice-row'), '옛 선택 줄 표면은 쓰지 않는다');
});

test('임무 게시판: 이야기 임무 카드만 에테르 결을 더한다', async () => {
    const { getQuestBoardRecommendations } = await import('../src/utils/questOperations.js');
    const player = makePlayerFixture();
    const { featured } = getQuestBoardRecommendations(player);
    const html = renderQuestBoard(player);
    const rows = tagsWithTestId(html, 'quest-decision-row').slice(0, featured.length);
    featured.slice(0, rows.length).forEach((entry, index) => {
        const isStory = entry.lane === 'story';
        assert.equal(/\bis-story\b/.test(rows[index]), isStory, `${entry.quest.title}: 이야기 결 = 이야기 임무`);
    });
});

test('제작소: 제작 방식은 이름 있는 묶음의 44px 눌림 단추이고, 제작은 유리 단추다', () => {
    const html = renderStatic(createElement(CraftingPanel, {
        player: makePlayerFixture({ gold: 0, inv: [] }), actions: noopActions, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    assert.ok(html.includes(`role="group" aria-label="${MSG.CRAFTING_MODE_GROUP_ARIA}"`));
    for (const id of ['craft', 'synth', 'bag']) {
        const [tag] = tagsWithTestId(html, `crafting-mode-${id}`);
        assert.ok(tag.includes('type="button"') && tag.includes('min-h-11') && tag.includes('min-w-11'), `${id}: 44px 단추`);
        assert.ok(tag.includes(`aria-pressed="${id === 'craft'}"`), `${id}: 눌림 상태`);
    }
    const actions = tagsWithTestId(html, 'crafting-recipe-action');
    assert.ok(actions.length > 0);
    assert.ok(actions.every((tag) => tag.includes('data-variant="glass"')), '줄마다 있는 제작은 유리');
    assert.equal(primaryTags(html).length, 0, '제작 화면에는 금빛 단추가 없다(합성 시작이 제작소의 주 행동)');
});

test('제작소 가방 탭: 만들기는 유리 단추, 재료는 칩이다', () => {
    const html = renderStatic(createElement(BagCraftingSection, { player: makePlayerFixture(), onCraftBag: () => {} }));
    const [action] = tagsWithTestId(html, 'bag-craft-action');
    assert.ok(action.includes('data-variant="glass"'));
    assert.ok(html.includes('class="ae-chip'), '재료는 칩');
    assert.ok(!/orange-|red-\d/.test(html), '옛 주황 · 빨강 팔레트 0');
});

test('상점: 구매 · 판매 전환은 44px 눌림 단추이고 금빛 단추는 없다', () => {
    const html = renderStatic(createElement(ShopPanel, {
        player: makePlayerFixture({ level: 10, gold: 500 }), actions: noopActions, shopItems: [], setGameState: () => {}, stats: null, onOpenArchiveConsole: () => {},
    }));
    const root = tagsWithTestId(html, 'shop-panel')[0] ?? openingTags(html).find((tag) => tag.includes('aether-focus-panel'));
    assert.match(root, /\bae-town\b/);
    assert.ok(html.includes(`aria-label="${MSG.SHOP_MODE_GROUP_ARIA}"`));
    assert.equal(primaryTags(html).length, 0, '구매는 줄마다 있어 유리 단추다');
    assert.ok(!html.includes('✦'), '보호 배지에 장식 기호를 쓰지 않는다');
});

test('교환소 · 거울: 확정 단추 하나만 금빛이고 닫기는 한 곳의 44px 알약이다', () => {
    const player = makePlayerFixture({ premiumCurrency: 0 });
    const views = [
        ['crystal-exchange-confirm', renderStatic(createElement(PremiumShop, { player, onClose: () => {} }))],
        ['mirror-confirm', renderStatic(createElement(MirrorPanel, { player, onClose: () => {}, onPurchase: () => {} }))],
    ];
    for (const [confirmId, html] of views) {
        const primaries = primaryTags(html);
        assert.equal(primaries.length, 1, `${confirmId}: 금빛은 하나`);
        assert.ok(primaries[0].includes(`data-testid="${confirmId}"`));
        assert.ok(/class="[^"]*\bae-sheet\b[^"]*\bae-town-sheet\b/.test(html), `${confirmId}: 시트 한 장`);
        assert.ok(/class="[^"]*\bae-scrim\b/.test(html), `${confirmId}: 가림막`);
        assert.equal(html.split(`>${MSG.UI_CLOSE}<`).length - 1, 1, `${confirmId}: 닫기는 하나`);
        assert.ok(!/style="[^"]*background/.test(html), `${confirmId}: 인라인 배경색 0`);
    }
});

test('머리 · 닫기: 돌아가기 · 기록 열기 · 닫기는 같은 44px 알약이다', () => {
    const header = renderStatic(createElement(FocusPanelHeader, {
        title: '제목', eyebrow: '머리', onBack: () => {}, backLabel: MSG.UI_BACK, backTestId: 'b',
        onOpenArchive: () => {}, archiveLabel: '가방', archiveTestId: 'a',
    }));
    for (const id of ['a', 'b']) {
        const [tag] = tagsWithTestId(header, id);
        assert.ok(tag.includes('type="button"') && /\bae-town-pill\b/.test(tag) && tag.includes('min-h-[44px]'), `${id}: 알약`);
    }
    const close = renderStatic(createElement(OverlayCloseButton, { 'aria-label': '닫기 시험' }));
    assert.match(close, /^<button type="button"[^>]*class="ae-town-pill min-h-\[44px\] min-w-\[44px\]/);
});

test('마을 CSS 블록은 색을 토큰으로만 쓴다(부재 불변식)', async () => {
    const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
    const start = css.indexOf('/* === w3:town === */');
    const end = css.indexOf('/* === /w3:town === */');
    assert.ok(start >= 0 && end > start, '마을 블록이 있다');
    const block = css.slice(start, end);
    assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/, '새 hex 0');
    assert.doesNotMatch(block, /rgba?\(\s*\d/, '숫자로 쓴 rgb · rgba 0 — rgb(var(--aether-…-rgb) / a)만');
});
