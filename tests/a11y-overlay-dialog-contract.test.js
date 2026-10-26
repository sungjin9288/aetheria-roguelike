// 감사 A11Y-01 · 02 · 03 · 06 · GF-07 — 오버레이 대화상자 · 한 글자 단축키 · 전투 소식 · 화면 제목 · 전투 기록 요약.
//
// A11Y-01: 전체 화면 오버레이 11개가 대화상자라고 말하지 않았다 — 뒤 화면 단추가 Tab으로 닿았고(유물 선택 뒤의 공격 · 이동),
//          닫혀도 포커스가 문서 맨 앞으로 떨어졌다. 이제 오버레이 뿌리가 `useOverlayDialog`(role · aria-modal · 이름 · 포커스 범위)를 펼친다.
// A11Y-02: 전투 1 · 2 · 3 · 빠른 칸 Q · W · E가 대화상자 위 · 수정키 · 한글 조합 중에도 눌렸다(`key`로 읽어 한글 상태의 Q = 'ㅂ'는 안 됐다).
// A11Y-03: 전투 결과 · 생명 · 배너가 화면 낭독기에 말해지지 않았다 — 기록 줄을 더하지 않고 알림 칸에 그린다(Wave 111 · 드라이버 난수열).
// A11Y-06: 전투 · 이벤트 화면에 제목 · 본문 표지가 없었다.
// GF-07: 전투 기록 요약이 마지막 3줄이라 한 차례의 '내 행동'이 4줄 이상 차례에서 밀려났다 — 이제 마지막 차례 전체.
//
// 포커스 가두기 · 되돌리기 · inert는 실제 DOM이 필요해 e2e `overlay-dialog-focus.spec.ts`가 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.ts';
import { DB } from '../src/data/db.ts';
import { GS } from '../src/reducers/gameStates.ts';
import {
    collectInertTargets,
    compareStackingOrder,
    createsStackingContext,
    getWrappedFocusIndex,
    isModalFocusScopeOpen,
    resolveModalKeyIntent,
} from '../src/platform/modalFocus.ts';
import { resolveGlobalShortcut } from '../src/utils/keyboardShortcuts.ts';
import {
    getAmbientLogTexts,
    getCombatTurnKey,
    getInitialCombatFloorId,
    selectCombatLogSummary,
    selectLatestCombatTurn,
} from '../src/utils/combatLogSummary.ts';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import ExpeditionDebriefCard from '../src/components/ExpeditionDebriefCard.tsx';
import FocusPanelHeader from '../src/components/FocusPanelHeader.tsx';
import LegendaryDropOverlay from '../src/components/LegendaryDropOverlay.tsx';
import LevelUpBanner from '../src/components/LevelUpBanner.tsx';
import MilestoneStoryCard from '../src/components/MilestoneStoryCard.tsx';
import MirrorPanel from '../src/components/MirrorPanel.tsx';
import PhaseBanner from '../src/components/PhaseBanner.tsx';
import PremiumShop from '../src/components/PremiumShop.tsx';
import RelicChoicePanel from '../src/components/RelicChoicePanel.tsx';
import ReturnBriefingCard from '../src/components/ReturnBriefingCard.tsx';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import TerminalView from '../src/components/TerminalView.tsx';
import TrueEndingScreen from '../src/components/TrueEndingScreen.tsx';
import CodexDiscoveryOverlay from '../src/components/codex/CodexDiscoveryOverlay.tsx';
import CombatPanel from '../src/components/tabs/CombatPanel.tsx';
import MobileGameLayout from '../src/components/app/MobileGameLayout.tsx';
import { RELICS } from '../src/data/relics.ts';
import { buildRunSummary } from '../src/utils/gameUtils.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

// ---------------------------------------------------------------- 대화상자 포커스 범위(순수 판정)

const node = (tagName, children = []) => {
    const self = { tagName, parentElement: null, children };
    for (const child of children) child.parentElement = self;
    return self;
};

test('collectInertTargets: 대화상자에서 body까지 경로 밖의 형제만 고르고 스크립트 · 스타일은 건너뛴다', () => {
    const dialog = node('DIV');
    const main = node('MAIN');
    const overlayHost = node('DIV', [dialog]);
    const root = node('DIV', [main, overlayHost]);
    const toast = node('SECTION');
    const script = node('SCRIPT');
    const style = node('STYLE');
    const body = node('BODY', [root, toast, script, style]);
    node('HTML', [node('HEAD'), body]);

    const targets = collectInertTargets(dialog);
    assert.deepEqual(new Set(targets), new Set([main, toast]), '본문과 body 아래 다른 층만 inert 대상');
    assert.ok(!targets.includes(dialog) && !targets.includes(overlayHost) && !targets.includes(root), '대화상자와 그 조상은 살아 있다');
    assert.ok(!targets.some((target) => target.tagName === 'HEAD'), 'body 위(head)로는 올라가지 않는다');
});

// 쌓임 순서: 실제 GameRoot 모양 — MainLayout 안쪽 감싸개(relative z-10) 아래에 본문(relative z-10)과 오버레이들,
//   강화 확인만 body로 포털된다. 가짜 노드의 style이 getComputedStyle 결과다.
const box = (style, children = []) => {
    const self = { style: { position: 'static', zIndex: 'auto', display: 'block', ...style }, parentElement: null, children };
    for (const child of children) child.parentElement = self;
    return self;
};
const readFakeStyle = (fake) => fake.style;
const buildOverlayTree = () => {
    const premium = box({ position: 'fixed', zIndex: '200' });
    const main = box({ position: 'relative', zIndex: '10', display: 'flex' }, [box({}), premium]);
    const relic = box({ position: 'fixed', zIndex: '50' });
    const debrief = box({ position: 'fixed', zIndex: '70', opacity: '0.4' });
    const briefing = box({ position: 'fixed', zIndex: '50' });
    const ascension = box({ position: 'fixed', zIndex: '200' });
    const mirror = box({ position: 'fixed', zIndex: '200' });
    const wrapper = box({ position: 'relative', zIndex: '10', display: 'flex' }, [main, relic, debrief, briefing, ascension, mirror]);
    const layout = box({ position: 'relative', display: 'flex' }, [box({ position: 'absolute' }), wrapper]);
    const root = box({}, [layout]);
    const enhance = box({ position: 'fixed', zIndex: '76' });
    const body = box({}, [root, enhance]);
    return { premium, main, relic, debrief, briefing, ascension, mirror, enhance, body };
};

test('compareStackingOrder: 위에 그려지는 대화상자를 연 순서와 상관없이 고른다(z-index, 같으면 문서 순서)', () => {
    const t = buildOverlayTree();
    const above = (a, b, message) => {
        assert.ok(compareStackingOrder(a, b, readFakeStyle) > 0, message);
        assert.ok(compareStackingOrder(b, a, readFakeStyle) < 0, `${message}(뒤집어도 같다)`);
    };
    above(t.debrief, t.relic, '귀환 정리(z-70)는 늦게 읽힌 유물 선택(z-50) 위');
    above(t.briefing, t.relic, '같은 z-50이면 문서에서 뒤인 귀환 브리핑이 위');
    above(t.relic, t.premium, '본문(z-10) 안의 상점(z-200)은 본문 밖 유물 선택(z-50) 아래');
    above(t.mirror, t.ascension, '거울은 승천 화면과 같은 z-200이고 뒤에 그려진다');
    above(t.ascension, t.debrief, '승천(z-200)은 귀환 정리 위');
    above(t.enhance, t.mirror, 'body로 포털된 강화 확인(z-76)은 감싸개(z-10) 안의 z-200보다 위');
    above(t.premium, t.main, '안쪽 요소는 그 조상 위');
    assert.equal(compareStackingOrder(t.relic, t.relic, readFakeStyle), 0, '같은 요소');
    assert.equal(compareStackingOrder(t.relic, box({ position: 'fixed', zIndex: '999' }), readFakeStyle), 0, '공통 조상이 없으면 견줄 수 없다(연 순서로 고른다)');
});

test('createsStackingContext: 고정 · 위치+z-index · 플렉스 항목 z-index · 투명도 · 변형 · 격리', () => {
    const block = { display: 'block' };
    const flex = { display: 'flex' };
    const base = { position: 'static', zIndex: 'auto' };
    assert.equal(createsStackingContext({ ...base, position: 'fixed' }, block), true);
    assert.equal(createsStackingContext({ ...base, position: 'relative' }, block), false, 'z-index 없는 relative는 아니다');
    assert.equal(createsStackingContext({ ...base, position: 'relative', zIndex: '10' }, block), true);
    assert.equal(createsStackingContext({ ...base, zIndex: '5' }, block), false, '위치 없는 블록의 z-index는 무시된다');
    assert.equal(createsStackingContext({ ...base, zIndex: '5' }, flex), true, '플렉스 항목의 z-index');
    assert.equal(createsStackingContext({ ...base, opacity: '0.5' }, block), true);
    assert.equal(createsStackingContext({ ...base, opacity: '1' }, block), false);
    assert.equal(createsStackingContext({ ...base, transform: 'matrix(1, 0, 0, 1, 0, 0)' }, block), true);
    assert.equal(createsStackingContext({ ...base, transform: 'none', filter: 'none' }, block), false);
    assert.equal(createsStackingContext({ ...base, isolation: 'isolate' }, block), true);
    assert.equal(createsStackingContext({ ...base, willChange: 'opacity, transform' }, block), true);
    assert.equal(createsStackingContext({ ...base, willChange: 'auto' }, block), false);
});

test('getWrappedFocusIndex: Tab은 끝에서 처음으로, Shift+Tab은 처음에서 끝으로 돈다', () => {
    assert.equal(getWrappedFocusIndex(3, 0, false), 1);
    assert.equal(getWrappedFocusIndex(3, 2, false), 0, '마지막 다음은 처음');
    assert.equal(getWrappedFocusIndex(3, 0, true), 2, '처음 이전은 마지막');
    assert.equal(getWrappedFocusIndex(3, -1, false), 0, '대화상자 밖에서 들어오면 처음');
    assert.equal(getWrappedFocusIndex(3, -1, true), 2, '거꾸로 들어오면 마지막');
    assert.equal(getWrappedFocusIndex(0, 0, false), -1, '칸이 없으면 -1');
});

test('resolveModalKeyIntent: Tab · Shift+Tab · Escape만 가로채고 한글 조합 중 키는 건드리지 않는다', () => {
    assert.equal(resolveModalKeyIntent({ key: 'Tab' }), 'tab-forward');
    assert.equal(resolveModalKeyIntent({ key: 'Tab', shiftKey: true }), 'tab-backward');
    assert.equal(resolveModalKeyIntent({ key: 'Tab', ctrlKey: true }), null, 'Ctrl+Tab은 브라우저 탭 전환');
    assert.equal(resolveModalKeyIntent({ key: 'Escape' }), 'escape');
    assert.equal(resolveModalKeyIntent({ key: 'Esc' }), 'escape');
    assert.equal(resolveModalKeyIntent({ key: 'Escape', isComposing: true }), null, '조합 취소 Escape는 조합기의 것');
    assert.equal(resolveModalKeyIntent({ key: 'Process' }), null);
    assert.equal(resolveModalKeyIntent({ key: 'q' }), null);
});

test('isModalFocusScopeOpen: 열린 대화상자가 없으면(서버 렌더 포함) 거짓', () => {
    assert.equal(isModalFocusScopeOpen(), false);
});

// ---------------------------------------------------------------- 한 글자 단축키(A11Y-02)

const COMBAT = { inCombat: true, modalOpen: false };
const IDLE = { inCombat: false, modalOpen: false };

test('resolveGlobalShortcut: 전투 1 · 2 · 3과 빠른 칸 Q · W · E는 키 자리(code)로 읽는다', () => {
    assert.deepEqual(resolveGlobalShortcut({ key: '1', code: 'Digit1' }, COMBAT), { kind: 'combat', command: 'attack' });
    assert.deepEqual(resolveGlobalShortcut({ key: '2', code: 'Numpad2' }, COMBAT), { kind: 'combat', command: 'skill' });
    assert.deepEqual(resolveGlobalShortcut({ key: '3', code: 'Digit3' }, COMBAT), { kind: 'combat', command: 'escape' });
    assert.equal(resolveGlobalShortcut({ key: '1', code: 'Digit1' }, IDLE), null, '전투 밖 숫자는 단축키가 아니다');
    // 한글 입력 상태: Q 자리가 'ㅂ'를 돌려준다.
    assert.deepEqual(resolveGlobalShortcut({ key: 'ㅂ', code: 'KeyQ' }, IDLE), { kind: 'quickSlot', index: 0 });
    assert.deepEqual(resolveGlobalShortcut({ key: 'ㅈ', code: 'KeyW' }, COMBAT), { kind: 'quickSlot', index: 1 });
    assert.deepEqual(resolveGlobalShortcut({ key: 'E', code: 'KeyE', shiftKey: true }, IDLE), { kind: 'quickSlot', index: 2 }, '대문자 E도 빠른 칸(이전과 같다)');
    assert.deepEqual(resolveGlobalShortcut({ key: 'W', code: '' }, IDLE), { kind: 'quickSlot', index: 1 }, 'code가 없는 환경만 글자로 읽는다');
    assert.deepEqual(resolveGlobalShortcut({ key: '1', code: '' }, COMBAT), { kind: 'combat', command: 'attack' });
});

test('resolveGlobalShortcut: 대화상자 · 수정키 · 한글 조합 · 입력 칸에서는 멈춘다', () => {
    const q = { key: 'q', code: 'KeyQ' };
    const one = { key: '1', code: 'Digit1' };
    assert.equal(resolveGlobalShortcut(q, { inCombat: false, modalOpen: true }), null, '대화상자 위의 Q');
    assert.equal(resolveGlobalShortcut(one, { inCombat: true, modalOpen: true }), null, '대화상자 위의 1');
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
        assert.equal(resolveGlobalShortcut({ ...q, [modifier]: true }, IDLE), null, `${modifier} + Q`);
        assert.equal(resolveGlobalShortcut({ ...one, [modifier]: true }, COMBAT), null, `${modifier} + 1`);
    }
    assert.equal(resolveGlobalShortcut({ key: '!', code: 'Digit1', shiftKey: true }, COMBAT), null, 'Shift+1은 기호 입력(이전과 같다)');
    assert.equal(resolveGlobalShortcut({ ...q, isComposing: true }, IDLE), null, '한글 조합 중');
    assert.equal(resolveGlobalShortcut({ key: 'Process', code: 'KeyQ' }, IDLE), null, '조합기가 가져간 키');
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) {
        assert.equal(resolveGlobalShortcut({ ...q, targetTagName: tag }, IDLE), null, `${tag}에 쓰는 중`);
    }
    assert.equal(resolveGlobalShortcut({ ...one, targetIsContentEditable: true }, COMBAT), null, '편집 가능한 칸');
    assert.equal(resolveGlobalShortcut({ key: 'a', code: 'KeyA' }, COMBAT), null, '다른 키');
});

// ---------------------------------------------------------------- 대화상자 표지(A11Y-01)

/** 렌더 결과에서 `data-overlay-dialog`를 든 여는 태그(하나여야 한다). */
const dialogTags = (html) => [...html.matchAll(/<[a-z]+\b[^>]*data-overlay-dialog="true"[^>]*>/gu)].map((match) => match[0]);

const assertDialog = (html, { label, role = 'dialog', testId }) => {
    const tags = dialogTags(html);
    assert.equal(tags.length, 1, `대화상자 뿌리는 하나 (${label})`);
    const [tag] = tags;
    assert.ok(tag.includes(`role="${role}"`), `${label}: role=${role}`);
    assert.ok(tag.includes('aria-modal="true"'), `${label}: aria-modal`);
    assert.ok(tag.includes(`aria-label="${label}"`), `${label}: 이름`);
    assert.ok(tag.includes('tabindex="-1"'), `${label}: 열릴 때 포커스를 받을 수 있다`);
    if (testId) {
        const at = html.indexOf(tag);
        assert.ok(html.indexOf(`data-testid="${testId}"`) >= at, `${label}: ${testId}는 대화상자 안(또는 뿌리)`);
    }
};

const relicsByName = Object.fromEntries(RELICS.map((relic) => [relic.name, relic]));

test('전체 화면 오버레이는 이름 있는 모달 대화상자다(SSR로 그릴 수 있는 10개)', () => {
    const player = makePlayerFixture({ meta: { prestigeRank: 1 }, quests: [] });
    const debrief = {
        battles: 3, explores: 5, expGained: 120, goldDelta: 40,
        destination: '고요한 숲', durationMs: 60_000, startLevel: 4, endLevel: 5,
        lowestHp: 10, lowestHpPercent: 20, newItems: [], lostItemCount: 0, completedQuests: [],
    };
    const story = { id: 'story-1', eyebrow: '이정표', title: '새로운 장', body: '본문', closing: '맺음말' };
    const briefing = {
        maxHp: 100, hp: 80, claimableRewardCount: 0, awayHours: 5,
        loc: '시작의 마을', level: 3, dailyCompletedCount: 1, dailyMissionCount: 3, activeChainCount: 0,
    };
    const relicOffer = RELICS.slice(0, 3);
    const legendary = { id: 'sig', name: '라그나로크', type: 'weapon', rarity: 'legendary', tier: 6 };
    const cases = [
        { name: 'ExpeditionDebriefCard', html: renderStatic(createElement(ExpeditionDebriefCard, { summary: debrief, recommendation: { detail: '다음 원정', kind: 'continue', label: '계속하기' }, onClose: () => {}, onPrimaryAction: () => {} })), label: MSG.A11Y_DIALOG_EXPEDITION_DEBRIEF },
        { name: 'MilestoneStoryCard', html: renderStatic(createElement(MilestoneStoryCard, { story, onClose: () => {} })), label: story.title, testId: 'milestone-story-close-icon' },
        { name: 'ReturnBriefingCard', html: renderStatic(createElement(ReturnBriefingCard, { briefing, onClose: () => {}, onOpenGoals: () => {} })), label: MSG.RETURN_BRIEFING_TITLE, testId: 'return-briefing-card' },
        { name: 'RelicChoicePanel', html: renderStatic(createElement(RelicChoicePanel, { pendingRelics: relicOffer, dispatch: () => {}, player: makePlayerFixture(), stats: null })), label: MSG.RELIC_CHOICE_TITLE, testId: 'relic-choice-panel' },
        { name: 'MirrorPanel', html: renderStatic(createElement(MirrorPanel, { player, onClose: () => {}, onPurchase: () => {} })), label: MSG.A11Y_DIALOG_MIRROR, testId: 'mirror-panel' },
        { name: 'PremiumShop', html: renderStatic(createElement(PremiumShop, { player, onClose: () => {} })), label: MSG.A11Y_DIALOG_PREMIUM_SHOP },
        { name: 'AscensionScreen', html: renderStatic(createElement(AscensionScreen, { player })), label: MSG.A11Y_DIALOG_ASCENSION, testId: 'ascension-screen' },
        { name: 'RunSummaryCard', html: renderStatic(createElement(RunSummaryCard, { runSummary: buildRunSummary(player, player.loc), onRestart: () => {} })), label: MSG.RUN_SUMMARY_EYEBROW },
        { name: 'TrueEndingScreen', html: renderStatic(createElement(TrueEndingScreen, { player })), label: MSG.TRUE_ENDING_TITLE, testId: 'true-ending-screen' },
        { name: 'LegendaryDropOverlay', html: renderStatic(createElement(LegendaryDropOverlay, { item: legendary, onDismiss: () => {} })), label: MSG.A11Y_DIALOG_LEGENDARY(legendary.name), role: 'alertdialog' },
    ];
    for (const { name, html, ...expected } of cases) {
        assert.ok(html.length > 0, `${name} 렌더`);
        assertDialog(html, expected);
    }
    assert.ok(relicsByName[relicOffer[0].name], '유물 시나리오는 실제 유물');
});

test('닫힌 오버레이는 대화상자를 남기지 않는다(유물 제안 없음 · 전설 아이템 없음)', () => {
    assert.deepEqual(dialogTags(renderStatic(createElement(RelicChoicePanel, { pendingRelics: [], dispatch: () => {}, player: makePlayerFixture(), stats: null }))), []);
    assert.deepEqual(dialogTags(renderStatic(createElement(LegendaryDropOverlay, { item: null, onDismiss: () => {} }))), []);
});

// ---------------------------------------------------------------- 제목 · 영역(A11Y-06)

test('전투 화면 배치: 행동 · 기록 영역은 제목을 든다', () => {
    const engine = {
        gameState: GS.COMBAT,
        player: makePlayerFixture(),
        uid: 'test-uid', grave: null, sideTab: 'inventory',
        actions: { setSideTab: () => {}, setGameState: () => {}, getSelectedSkill: () => null, combat: () => {} },
        quickSlots: [], syncStatus: 'idle', isAiThinking: false, logs: [], handleCommand: () => {},
        enemy: null, shopItems: [], currentEvent: null,
    };
    const html = renderStatic(createElement(MobileGameLayout, {
        engine, fullStats: null, isPanelFocusState: false, mobileArchiveDockVisible: false,
        handleQuickSlotUse: () => {}, damageFlash: false, healFlash: false, mobileConsoleMode: 'log',
        setMobileConsoleMode: () => {}, onOpenMirror: () => {}, onOpenCrystalExchange: () => {},
    }));
    // MobileGameLayout은 GameRoot의 <main id=MAIN_CONTENT_ID> 안에 그려진다(본문 표지는 e2e가 본다).
    assert.ok(html.includes(`<h2 id="combat-actions-heading" class="sr-only">${MSG.A11Y_COMBAT_ACTIONS_HEADING}</h2>`), '전투 행동 제목');
    assert.ok(html.includes(`<h2 id="terminal-log-heading"`), '전투 기록 제목');
});

test('전투 화면: 행동 · 내 상태 · 교전 대상 · 기록이 제목 있는 영역이다', () => {
    const player = makePlayerFixture({ name: '테스트 모험가', hp: 40, mp: 10, level: 5 });
    const enemy = { name: '숲의 정령', hp: 30, maxHp: 60, isBoss: false };
    const panel = renderStatic(createElement(CombatPanel, {
        player, actions: { getSelectedSkill: () => null, combat: () => {} }, enemy,
        stats: { atk: 10, def: 5, maxHp: 100, maxMp: 50 }, isAiThinking: false, mobile: true,
    }));
    assert.ok(panel.includes(`<h2 id="combat-actions-heading" class="sr-only">${MSG.A11Y_COMBAT_ACTIONS_HEADING}</h2>`));
    assert.match(panel, /<div[^>]*role="region"[^>]*aria-labelledby="combat-actions-heading"[^>]*data-testid="combat-focus-panel"/u);

    const status = renderStatic(createElement(StatusBar, { player, stats: null, enemy, enemyHitCrit: false }));
    assert.ok(status.includes(`<h2 id="combat-player-status-heading" class="sr-only">${MSG.A11Y_PLAYER_STATUS_HEADING}</h2>`), '내 상태 제목');
    assert.match(status, /role="region" aria-labelledby="combat-player-status-heading"/u);
    assert.match(status, /<h2 id="combat-enemy-status-heading" data-testid="enemy-status-label"[^>]*>교전 대상<\/h2>/u, '교전 대상 제목(보이는 글자 그대로)');
    assert.match(status, /role="region" aria-labelledby="combat-enemy-status-heading"/u);
});

test('집중 화면 머리(이벤트 · 상점 · 기록): 화면 이름은 h2 제목이다', () => {
    const html = renderStatic(createElement(FocusPanelHeader, { eyebrow: '이벤트', title: '수상한 상자' }));
    assert.match(html, /<h2 class="[^"]*">수상한 상자<\/h2>/u);
});

// ---------------------------------------------------------------- 상태 알림(A11Y-03)

test('배너는 늘 있는 상태 알림 칸 안에 나타난다 — 칸은 배너가 없을 때도 그려진다', () => {
    for (const [name, element, testId] of [
        ['LevelUpBanner', createElement(LevelUpBanner, { level: 12 }), 'level-up-banner'],
        ['PhaseBanner', createElement(PhaseBanner, { phase: { n: 2, name: '분노한 수호자' } }), 'phase-banner'],
        ['CodexDiscoveryOverlay', createElement(CodexDiscoveryOverlay, { entry: { name: '숲의 정령', category: '몬스터' } }), null],
    ]) {
        const html = renderStatic(element);
        assert.ok(html.startsWith('<div role="status"'), `${name}: 상태 알림 칸이 뿌리`);
        if (testId) assert.ok(html.includes(`data-testid="${testId}"`), `${name}: 배너는 칸 안`);
    }
    const empty = renderStatic(createElement(PhaseBanner, { phase: null }));
    assert.ok(empty.startsWith('<div role="status"'), '배너가 없어도 칸은 남는다(나중에 들어온 배너가 읽힌다)');
    assert.ok(!empty.includes('data-testid="phase-banner"'));
});

// ---------------------------------------------------------------- 전투 기록 요약(GF-07) · 차례 알림(A11Y-03)

const turnLines = (now, seed, entries) => entries.map(([type, text], index) => ({ id: `combat-item-${now}-${seed}-${index}`, type, text }));

test('getCombatTurnKey: 턴 해석 · 승리 정산 줄은 같은 차례 열쇠를 갖는다', () => {
    assert.equal(getCombatTurnKey('combat-item-1700-42-3'), '1700-42');
    assert.equal(getCombatTurnKey('combat-1700-42-0'), '1700-42', '승리 정산 줄도 같은 차례');
    assert.equal(getCombatTurnKey('l0'), null);
    assert.equal(getCombatTurnKey('combat-item-abc'), null);
    assert.equal(getCombatTurnKey('explore-1700-42-0'), null);
});

test('getInitialCombatFloorId: 기록 창이 전투 도중에 그려지면 마지막 차례 묶음 앞이 경계다', () => {
    assert.equal(getInitialCombatFloorId([]), null);
    assert.equal(getInitialCombatFloorId([{ id: 'l0' }, { id: 'l1' }]), 'l1', '차례가 없으면 마지막 줄 뒤');
    const turnA = turnLines(1, 1, [['combat', 'a'], ['combat', 'b']]);
    const turnB = turnLines(2, 2, [['combat', 'c'], ['combat', 'd']]);
    assert.equal(getInitialCombatFloorId([{ id: 'l0' }, ...turnA]), 'l0');
    assert.equal(getInitialCombatFloorId(turnA), null, '기록이 차례로 시작하면 처음부터');
    assert.equal(getInitialCombatFloorId([{ id: 'l0' }, ...turnA, ...turnB]), turnA[1].id, '마지막 차례만 지금 전투');
});

test('selectCombatLogSummary: 마지막 차례를 통째로 · 뒤에 붙은 요약 줄 포함 · 경계 앞 차례는 보지 않는다', () => {
    const types = new Set(['combat', 'warning', 'heal', 'success', 'info']);
    const previous = turnLines(1, 1, [['combat', '지난 차례']]);
    const latest = turnLines(2, 9, [['combat', '내 공격'], ['warning', '적 반격'], ['heal', '흡혈'], ['info', '출혈 피해'], ['success', '처치']]);
    const logs = [{ id: 'l0', type: 'info', text: '전투 시작' }, ...previous, ...latest, { id: 'l9', type: 'success', text: '뒤에 붙은 줄' }, { id: 'l10', type: 'story', text: '요약 밖 종류' }];

    const summary = selectCombatLogSummary(logs, { types, fallbackCount: 3, floorId: previous[0].id });
    assert.equal(summary.turnKey, '2-9');
    assert.deepEqual(summary.entries.map((log) => log.text), ['내 공격', '적 반격', '흡혈', '출혈 피해', '처치', '뒤에 붙은 줄'], '다섯 줄 차례의 첫 줄 "내 공격"이 남는다');

    const beforeFloor = selectCombatLogSummary(logs, { types, fallbackCount: 3, floorId: 'l9' });
    assert.equal(beforeFloor.turnKey, null, '경계 뒤에 차례가 없으면 최근 줄');
    assert.deepEqual(beforeFloor.entries.map((log) => log.text), ['출혈 피해', '처치', '뒤에 붙은 줄']);

    const latestOnly = selectLatestCombatTurn(logs, previous[0].id);
    assert.deepEqual(latestOnly.entries.map((log) => log.text), ['내 공격', '적 반격', '흡혈', '출혈 피해', '처치'], '알림 칸은 차례 줄만');
    assert.deepEqual(selectLatestCombatTurn(logs, 'l10'), { entries: [], turnKey: null });
});

test('selectCombatLogSummary: 지역 분위기 문장은 요약에서 빠진다(차례가 없을 때도)', () => {
    const [loc, map] = Object.entries(DB.MAPS).find(([, value]) => value?.desc && value?.lore);
    const ambient = getAmbientLogTexts(map, [MSG.MOVE_AREA_DESC_BLIND]);
    assert.ok(ambient.has(map.desc) && ambient.has(map.lore) && ambient.has(MSG.MOVE_AREA_DESC_BLIND), `${loc}: 설명 · 처음 방문 이야기 · 가린 지역 설명`);
    const types = new Set(['info', 'combat', 'system']);
    const logs = [
        { id: 'a', type: 'combat', text: '적 등장' },
        { id: 'b', type: 'system', text: map.desc },
        { id: 'c', type: 'info', text: map.lore },
        { id: 'd', type: 'combat', text: '위협 줄' },
    ];
    const summary = selectCombatLogSummary(logs, { types, fallbackCount: 3, ambientTexts: ambient });
    assert.deepEqual(summary.entries.map((log) => log.text), ['적 등장', '위협 줄']);
    assert.deepEqual(getAmbientLogTexts(null).size, 0);
});

const renderTerminal = (props) => renderStatic(createElement(TerminalView, {
    onCommand: () => {}, quickSlots: [], onQuickSlotUse: () => {}, ...props,
}));

const liveRegionOf = (html) => {
    const start = html.indexOf('data-testid="combat-live-region"');
    assert.ok(start >= 0, '알림 칸이 그려진다');
    const open = html.lastIndexOf('<div', start);
    return html.slice(open, html.indexOf('</div>', start) + '</div>'.length);
};

test('TerminalView 요약: 4줄 이상 차례도 첫 줄(내 행동)부터 통째로 보인다', () => {
    // 숫자는 renderLogText가 <strong>으로 쪼개므로 글자 표지를 쓴다.
    const previous = turnLines(10, 1, [['combat', '지난 공격 가'], ['warning', '지난 반격 나']]);
    const latest = turnLines(20, 2, [['combat', '내 공격 다'], ['warning', '적 반격 라'], ['heal', '흡혈 마'], ['info', '출혈 바']]);
    const logs = [{ id: 'l0', type: 'info', text: '전투 시작 사' }, ...previous, ...latest];
    const html = renderTerminal({ logs, gameState: GS.COMBAT, player: makePlayerFixture({ hp: 40 }), maxHp: 120 });

    // 알림 칸(sr-only)에도 같은 줄이 있으므로 보이는 기록 칸만 본다.
    const visible = html.slice(0, html.indexOf('data-testid="combat-live-region"'));
    for (const text of ['내 공격 다', '적 반격 라', '흡혈 마', '출혈 바']) assert.ok(visible.includes(text), `"${text}" 보임`);
    for (const text of ['지난 공격 가', '지난 반격 나', '전투 시작 사']) assert.ok(!visible.includes(text), `"${text}"는 요약에서 숨김`);
    assert.match(html, /<h2 id="terminal-log-heading"[^>]*>최근 전투<\/h2>/u, '요약 칸 제목');
    assert.match(html, /role="region" aria-labelledby="terminal-log-heading"/u);
});

test('TerminalView 알림 칸: 마지막 차례 줄 + 실효 최대 생명으로 읽는 생명 한 줄, 기록 줄은 늘지 않는다', () => {
    const latest = turnLines(20, 2, [['combat', '내 공격'], ['warning', '적 반격']]);
    const logs = [{ id: 'l0', type: 'info', text: '전투 시작' }, ...latest];
    const html = renderTerminal({ logs, gameState: GS.COMBAT, player: makePlayerFixture({ hp: 40, maxHp: 100 }), maxHp: 120 });
    const live = liveRegionOf(html);
    assert.match(live, /role="log"/u);
    assert.match(live, /aria-live="polite"/u);
    assert.match(live, /aria-relevant="additions"/u);
    assert.match(live, /class="sr-only"/u);
    assert.ok(live.includes('<p>내 공격</p><p>적 반격</p>'), '차례 줄 그대로');
    assert.ok(live.includes(`<p>${MSG.A11Y_COMBAT_HP(40, 120)}</p>`), '생명 40/120(상태 표시줄과 같은 실효 최대치)');
    assert.ok(!live.includes('전투 시작'), '차례가 아닌 줄은 알리지 않는다');
    assert.equal(logs.length, 3, '기록은 그대로');
});

test('TerminalView 알림 칸: 차례가 없으면 비어 있다(탐험 · 이동 기록은 알리지 않는다)', () => {
    const logs = ['가', '나', '다', '라'].map((marker, index) => ({ id: `l${index}`, type: 'combat', text: `전투 로그 ${marker}` }));
    for (const gameState of [GS.COMBAT, GS.IDLE]) {
        const live = liveRegionOf(renderTerminal({ logs, gameState, player: makePlayerFixture() }));
        assert.ok(!live.includes('<p>'), `${gameState}: 알림 없음`);
    }
    const idle = renderTerminal({ logs, gameState: GS.IDLE, player: makePlayerFixture() });
    assert.ok(idle.includes(`<h2 id="terminal-log-heading" class="sr-only">${MSG.A11Y_LOG_HEADING}</h2>`), '전투 밖 기록 제목');
});
