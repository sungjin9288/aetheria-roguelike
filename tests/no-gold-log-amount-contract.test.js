import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.js';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.js';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.js';
import { BAG_RECIPES } from '../src/data/bagRecipes.js';
import { SEASON_TIER_XP, getSeasonRewards } from '../src/data/seasonPass.js';
import {
    getStructuredFallbackHiddenPoolEvent,
    getStructuredFallbackTransaction,
    STRUCTURED_FALLBACK_HIDDEN_EVENTS,
    STRUCTURED_FALLBACK_TRANSACTIONS,
} from '../src/data/structuredFallbackEvents.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { buildEventPackage } from '../src/utils/aiEventUtils.js';
import { buildBoundedEncounterEvent } from '../src/utils/boundedEncounterEvent.js';
import { getAdventureGuidance } from '../src/utils/adventureGuide.js';
import { getSellIncome, getSellPrice } from '../src/utils/equipmentUtils.js';
import { formatEventText, getEventChoicePreview } from '../src/utils/eventPresentation.js';
import { resolveGraveRecovery } from '../src/utils/graveUtils.js';
import { getCurrentWeeklyProtocol } from '../src/utils/protocolCycle.js';
import { getClaimableQuestEntries } from '../src/utils/questProgress.js';
import { createSeasonPassState } from '../src/utils/seasonPassPresentation.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getTraitProfile, getTraitQuestResonance } from '../src/utils/runProfileUtils.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { checkDiscoveryChains } from '../src/hooks/gameActions/exploreFlow.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';
import AchievementPanel from '../src/components/AchievementPanel.tsx';
import Codex from '../src/components/Codex.tsx';
import ControlPanel from '../src/components/ControlPanel.tsx';
import EventPanel from '../src/components/EventPanel.tsx';
import GravePanel from '../src/components/GravePanel.tsx';
import PendingQuestRewardList from '../src/components/PendingQuestRewardList.tsx';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import QuestTab from '../src/components/tabs/QuestTab.tsx';
import SeasonPassPanel from '../src/components/tabs/SeasonPassPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 62 (원장 §61.4 C16, 소유자 원칙 "화면 · 로그가 말하는 것 = 엔진이 하는 것") — '빈손의 시작'(`noGold`)은 모든 골드
 * 수입을 절반으로 만든다(`getGoldIncome`). 지급은 맞았지만 로그 · 미리보기 몇 곳이 명목(반감 전) 금액을 적어, 플레이어는 "골드 +500"을
 * 읽고 250을 받았다. 이 계약은 각 수입 경로를 실제 리듀서 · 액션 · 정적 렌더로 몰아, 적힌 금액 = 실제 골드 증가(와 누적 골드 증가)를 잰다.
 * 대조군(규칙 없음)은 명목 금액을 그대로 적는다 — 규칙이 없는 플레이어에게 문구는 바이트 그대로다.
 */

const NOW = 1_700_000_000_000;
const NO_GOLD = ['noGold'];
const CONTROL = [];
const HALF = (amount) => Math.floor(amount * BALANCE.NO_GOLD_MODIFIER_MULT);

const basePlayer = (extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '도전자', job: '전사', loc: '고요한 숲', level: 10, exp: 0, nextExp: 9_999_999,
    hp: 500, maxHp: 500, mp: 200, maxMp: 200, atk: 40, def: 20, gold: 0,
    equip: { weapon: null, armor: null, offhand: null }, relics: [], status: [], quests: [],
    ...extra,
});
const idleState = (player) => ({ ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, player, bootStage: 'ready', logs: [] });
const harness = (initial) => {
    let state = initial;
    return { get state() { return state; }, dispatch(action) { state = gameReducer(state, action); } };
};

const goldDelta = (before, after) => (after.player.gold || 0) - (before.player.gold || 0);
const totalGoldDelta = (before, after) => (after.player.stats?.total_gold || 0) - (before.player.stats?.total_gold || 0);
const newLogTexts = (before, after) => after.logs.slice(before.logs.length).map((entry) => entry.text);
/** 문구 속 "골드 N" · "골드 +N"의 금액들. */
const goldAmounts = (text) => [...String(text).matchAll(/골드 \+?([\d,]+)/g)].map((match) => Number(match[1].replace(/,/g, '')));
/**
 * 숫자 뒤 조사의 기대값(시험 쪽 독립 판정 — 엔진의 MSG.NUMBER_PARTICLE을 오라클로 쓰지 않는다). 숫자 읽기의 끝소리는 끝자리로 정해진다:
 * 0(십 · 백 · 천 · 만) · 1(일) · 3(삼) · 6(육) · 7(칠) · 8(팔)은 받침이 있다.
 */
const HAS_FINAL_CONSONANT = [true, true, false, true, false, false, true, true, true, false];
const PARTICLE_PAIRS = [['을', '를'], ['이', '가'], ['은', '는'], ['과', '와']];
const expectedParticle = (particle, amount) => {
    const pair = PARTICLE_PAIRS.find((entry) => entry.includes(particle));
    return HAS_FINAL_CONSONANT[amount % 10] ? pair[0] : pair[1];
};
/** 태그를 걷어 낸 화면 글자. */
const visibleText = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
/** `data-testid="<id>"`로 시작하는 구역의 화면 글자(닫는 태그 이름까지). */
const sectionText = (html, testId, closingTag) => {
    const start = html.indexOf(`data-testid="${testId}"`);
    assert.ok(start >= 0, `${testId} 구역이 그려진다`);
    return visibleText(html.slice(start, html.indexOf(`</${closingTag}>`, start)));
};

// ── 로그: 리듀서 ─────────────────────────────────────────────────────────────

test('판매 · 일괄 판매 로그의 골드 = 실제 골드 증가 = 상점 목록의 판매가(getSellIncome)', () => {
    const item = DB.ITEMS.consumables.find((entry) => getSellPrice(entry) > 2 && getSellPrice(entry) % 2 === 1);
    assert.ok(item, '홀수 판매가 소모품이 있다(반감의 내림이 보인다)');
    const sell = (mods) => {
        const probe = { ...structuredClone(item), id: 'sell-probe' };
        const before = { ...idleState(basePlayer({ challengeModifiers: mods, inv: [probe] })), gameState: GS.SHOP };
        const after = gameReducer(before, { type: AT.SELL_INVENTORY_ITEM, payload: { itemId: 'sell-probe' } });
        const line = newLogTexts(before, after).find((text) => text.startsWith(`${item.name} 판매`));
        assert.ok(line, '판매 로그가 남는다');
        return { logged: goldAmounts(line)[0], delta: goldDelta(before, after), total: totalGoldDelta(before, after), shown: getSellIncome(before.player, probe) };
    };
    const control = sell(CONTROL);
    assert.equal(control.logged, getSellPrice(item), '대조군은 판매가 그대로');
    assert.equal(control.delta, control.logged);
    const halved = sell(NO_GOLD);
    assert.equal(halved.logged, halved.delta, `판매 로그 ${halved.logged} = 증가 ${halved.delta}`);
    assert.equal(halved.total, halved.delta, '누적 골드도 같은 값');
    assert.equal(halved.shown, halved.delta, '상점 목록의 판매가 = 받은 골드');
    assert.equal(halved.logged, HALF(control.logged));

    const material = DB.ITEMS.materials.find((entry) => (entry.price || 0) <= BALANCE.INVENTORY_JUNK_MATERIAL_PRICE_MAX && getSellPrice(entry) > 0);
    const bulk = (mods) => {
        const inv = [0, 1, 2].map((index) => ({ ...structuredClone(material), id: `mat-${index}` }));
        const before = idleState(basePlayer({ challengeModifiers: mods, inv, bagTier: BAG_RECIPES.length }));
        const after = gameReducer(before, { type: AT.AUTO_SELL_MATERIALS });
        const line = newLogTexts(before, after).find((text) => text.startsWith('재료 3개 판매'));
        assert.ok(line, '일괄 판매 로그가 남는다');
        return { logged: goldAmounts(line)[0], delta: goldDelta(before, after), total: totalGoldDelta(before, after) };
    };
    const bulkControl = bulk(CONTROL);
    assert.equal(bulkControl.logged, getSellPrice(material) * 3);
    assert.equal(bulkControl.delta, bulkControl.logged);
    const bulkHalved = bulk(NO_GOLD);
    assert.equal(bulkHalved.logged, bulkHalved.delta, `일괄 판매 로그 ${bulkHalved.logged} = 증가 ${bulkHalved.delta}`);
    assert.equal(bulkHalved.total, bulkHalved.delta);
    assert.ok(bulkHalved.logged < bulkControl.logged);
});

test('임무 성향 공명 보너스 로그의 골드 = 실제로 더 받은 골드', () => {
    // 시험 플레이어의 성향과 공명하는(점수 6 이상) 골드 임무를 실제 판정으로 고른다 — 기본 보상에 보너스 골드가 붙는다.
    const probe = basePlayer();
    const trait = getTraitProfile(probe, { ...calculateFullStats(probe), maxHp: probe.maxHp, maxMp: probe.maxMp });
    const quest = DB.QUESTS.find((entry) => entry.buildTag && entry.reward?.gold && getTraitQuestResonance(entry, trait).score >= 6);
    assert.ok(quest, `성향 ${trait.id}과 공명하는 골드 임무가 있다`);
    const claim = (mods) => {
        const before = idleState(basePlayer({ challengeModifiers: mods, quests: [{ id: quest.id, progress: quest.goal }] }));
        const after = gameReducer(before, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: quest.id } });
        const line = newLogTexts(before, after).find((text) => text.includes('공명 보상'));
        assert.ok(line, '공명 보너스 로그가 남는다');
        return { bonus: goldAmounts(line)[0], delta: goldDelta(before, after), total: totalGoldDelta(before, after) };
    };
    const control = claim(CONTROL);
    const controlBase = control.delta - control.bonus;
    assert.equal(controlBase, quest.reward.gold, '대조군: 증가 = 기본 보상 + 적힌 보너스');
    const halved = claim(NO_GOLD);
    assert.equal(halved.bonus, HALF(control.bonus), `적힌 보너스 ${halved.bonus}`);
    assert.equal(halved.delta, HALF(controlBase) + halved.bonus, '증가 = 받은 기본 보상 + 적힌 보너스');
    assert.equal(halved.total, halved.delta);
});

test('시즌 보상 수령 로그 · 보상 카드의 골드 = 실제 골드 증가 (무료 + 추가 트랙)', () => {
    const claim = (mods) => {
        const seasonPass = { ...createSeasonPassState(), xp: SEASON_TIER_XP, tier: 1, isPremium: true };
        const player = basePlayer({ challengeModifiers: mods, seasonPass });
        const before = idleState(player);
        const after = gameReducer(before, { type: AT.CLAIM_SEASON_REWARD, payload: { tier: 1 } });
        const line = newLogTexts(before, after).find((text) => text.startsWith('시즌 1단계 보상'));
        assert.ok(line);
        const card = sectionText(renderStatic(createElement(SeasonPassPanel, { player })), 'season-claimable', 'section');
        return { logged: goldAmounts(line), card: goldAmounts(card), delta: goldDelta(before, after), total: totalGoldDelta(before, after) };
    };
    const control = claim(CONTROL);
    assert.equal(control.logged[0], control.delta);
    const halved = claim(NO_GOLD);
    assert.deepEqual(halved.logged, [halved.delta], `수령 로그 ${halved.logged} = 증가 ${halved.delta}`);
    assert.equal(halved.total, halved.delta);
    assert.equal(halved.card.length, 2, '무료 · 추가 트랙 골드가 함께 보인다');
    assert.equal(halved.card[0] + halved.card[1], halved.delta, `카드 ${halved.card.join(' + ')} = 증가 ${halved.delta}`);
    assert.ok(halved.delta < control.delta);
});

test('시즌 보상 카드는 트랙마다 반감한다 — 두 트랙이 모두 홀수 골드인 단계가 없어서 트랙별 합 = 합계의 반감(시즌 1 ~ 30)', () => {
    for (let ordinal = 1; ordinal <= 30; ordinal += 1) {
        for (const row of getSeasonRewards(ordinal)) {
            const free = row.free?.gold || 0;
            const premium = row.premium?.gold || 0;
            assert.equal(HALF(free) + HALF(premium), HALF(free + premium), `시즌 ${ordinal} · ${row.tier}단계 ${free} + ${premium}`);
        }
    }
});

test('도감 보상 수령 로그 · 도감 카드의 골드 = 실제 골드 증가', () => {
    const recipes = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((key) => [`제작법-${key}`, { discovered: true }]));
    const claim = (mods) => {
        const stats = { ...structuredClone(INITIAL_STATE.player.stats), codex: { recipes }, codexClaimed: [] };
        const player = basePlayer({ challengeModifiers: mods, stats });
        const before = idleState(player);
        const after = gameReducer(before, { type: AT.CLAIM_CODEX_REWARD, payload: { milestoneId: 'recipes_5' } });
        const line = newLogTexts(before, after).find((text) => text.startsWith('도감 보상'));
        assert.ok(line);
        const card = sectionText(renderStatic(createElement(Codex, { player })), 'codex-claimable', 'section');
        return { logged: goldAmounts(line), card: goldAmounts(card), delta: goldDelta(before, after), total: totalGoldDelta(before, after) };
    };
    const control = claim(CONTROL);
    assert.deepEqual(control.logged, [control.delta]);
    assert.deepEqual(control.card, [control.delta]);
    const halved = claim(NO_GOLD);
    assert.deepEqual(halved.logged, [halved.delta], `수령 로그 ${halved.logged} = 증가 ${halved.delta}`);
    assert.deepEqual(halved.card, [halved.delta], `도감 카드 ${halved.card} = 증가 ${halved.delta}`);
    assert.equal(halved.total, halved.delta);
    assert.equal(halved.delta, HALF(control.delta));
});

test('주간 임무 수령 로그 · 주간 임무 줄의 골드 = 실제 골드 증가', () => {
    const mission = BALANCE.WEEKLY_MISSIONS.find((entry) => entry.id === 'weeklyKills');
    const claim = (mods) => {
        const weeklyProtocol = { ...getCurrentWeeklyProtocol(undefined, new Date()), kills: mission.target };
        const before = idleState(basePlayer({ challengeModifiers: mods, weeklyProtocol }));
        const after = gameReducer(before, { type: AT.CLAIM_WEEKLY_MISSION, payload: { missionId: mission.id } });
        const line = newLogTexts(before, after).find((text) => text.startsWith('주간 보상'));
        assert.ok(line);
        // 아직 달성 전인 주간 임무 줄은 보상 금액을 그린다(달성하면 '수령' 버튼이 그 자리를 차지한다).
        const pending = basePlayer({ challengeModifiers: mods, weeklyProtocol: { ...weeklyProtocol, kills: 0 } });
        const row = visibleText(renderStatic(createElement(QuestTab, { player: pending, isInSafeZone: true })));
        const shown = row.match(new RegExp(`${mission.label} \\(0/${mission.target}\\) 골드 \\+(\\d+)`));
        assert.ok(shown, '주간 임무 줄이 보상 골드를 그린다');
        return { logged: goldAmounts(line), shown: Number(shown[1]), delta: goldDelta(before, after), total: totalGoldDelta(before, after) };
    };
    const control = claim(CONTROL);
    assert.deepEqual(control.logged, [mission.reward.gold]);
    assert.equal(control.shown, mission.reward.gold);
    const halved = claim(NO_GOLD);
    assert.deepEqual(halved.logged, [halved.delta], `수령 로그 ${halved.logged} = 증가 ${halved.delta}`);
    assert.equal(halved.shown, halved.delta, `주간 임무 줄 ${halved.shown} = 증가 ${halved.delta}`);
    assert.equal(halved.total, halved.delta);
    assert.equal(halved.delta, HALF(mission.reward.gold));
});

test('임무 · 업적 보상 줄(임무 탭 · 게시판 · 업적 · 계승 화면의 남은 보상)의 골드 = 수령 때 실제 골드 증가', () => {
    const quest = DB.QUESTS.find((entry) => entry.id === 1);
    const questClaim = (mods) => {
        const before = idleState(basePlayer({ challengeModifiers: mods, quests: [{ id: 1, progress: quest.goal }] }));
        return goldDelta(before, gameReducer(before, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: 1 } }));
    };
    const achievementClaim = (mods) => {
        const before = idleState(basePlayer({ challengeModifiers: mods, stats: { ...structuredClone(INITIAL_STATE.player.stats), kills: 10 } }));
        return goldDelta(before, gameReducer(before, { type: AT.CLAIM_ACHIEVEMENT_REWARD, payload: { achievementId: 'ach_kill_10' } }));
    };
    for (const mods of [CONTROL, NO_GOLD]) {
        const label = mods.length ? '빈손의 시작' : '대조군';
        const questGold = questClaim(mods);
        const active = basePlayer({ challengeModifiers: mods, quests: [{ id: 1, progress: 0 }] });
        // 임무 탭: 진행 중인 임무 카드(제목 ~ 진행도) 안의 보상 칩.
        const tab = visibleText(renderStatic(createElement(QuestTab, { player: active, isInSafeZone: true })));
        const card = tab.slice(tab.indexOf(quest.title), tab.indexOf(`0/${quest.goal}`, tab.indexOf(quest.title)));
        assert.deepEqual(goldAmounts(card), [questGold], `${label}: 임무 탭 보상 칩 "${card}" = 받는 골드 ${questGold}`);
        // 게시판: 진행 중인 임무 줄의 '보상' 칸.
        const boardHtml = renderStatic(createElement(QuestBoardPanel, { player: active }));
        const rowStart = boardHtml.indexOf('data-testid="quest-active-row"');
        assert.ok(rowStart >= 0, `${label}: 게시판에 진행 중인 임무 줄이 있다`);
        const row = visibleText(boardHtml.slice(rowStart, boardHtml.indexOf('data-testid="quest-board-abandon-mission"', rowStart)));
        assert.deepEqual(goldAmounts(row), [questGold], `${label}: 게시판 보상 줄 "${row}" = 받는 골드 ${questGold}`);

        const claimable = basePlayer({ challengeModifiers: mods, quests: [{ id: 1, progress: quest.goal }] });
        const pending = visibleText(renderStatic(createElement(PendingQuestRewardList, {
            entries: getClaimableQuestEntries(claimable), testIdPrefix: 'ascension', player: claimable,
        })));
        assert.deepEqual(goldAmounts(pending), [questGold], `${label}: 계승 화면의 남은 임무 보상`);

        const achievementGold = achievementClaim(mods);
        const achiever = basePlayer({ challengeModifiers: mods, stats: { ...structuredClone(INITIAL_STATE.player.stats), kills: 10 } });
        const panel = sectionText(renderStatic(createElement(AchievementPanel, { player: achiever })), 'achievement-claimable', 'section');
        assert.ok(goldAmounts(panel).includes(achievementGold), `${label}: 업적 보상 줄 ${goldAmounts(panel)} ∋ 받는 골드 ${achievementGold}`);
        assert.equal(achievementGold, mods.length ? HALF(200) : 200);
    }
});

// ── 로그: 이벤트 · 탐험 액션 ────────────────────────────────────────────────

/** 실제 handleEventChoice — 리듀서에 dispatch하고 로그를 모은다. */
const chooseEvent = (player, event, choiceIndex, rng = () => 0.5) => {
    let state = { ...idleState(player), gameState: GS.EVENT, currentEvent: event };
    const before = state;
    const logs = [];
    createEventActions({
        player,
        currentEvent: event,
        dispatch: (action) => { state = gameReducer(state, action); },
        addLog: (type, text) => logs.push({ type, text }),
        getFullStats: () => calculateFullStats(player),
        rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return { before, after: state, logs };
};

test('사건 성공 골드(결과 칸이 없는 선택) 로그 = 실제 골드 증가', () => {
    const event = { title: '시험', desc: '시험 사건', choices: ['살핀다', '지나친다'], outcomes: [] };
    const run = (mods) => {
        const { before, after, logs } = chooseEvent(basePlayer({ challengeModifiers: mods }), event, 0);
        const line = logs.find((entry) => entry.text.startsWith('선택에 성공했습니다'));
        assert.ok(line, '성공 로그(굴림 0.5 > 0.4)');
        return { logged: goldAmounts(line.text), delta: goldDelta(before, after), total: totalGoldDelta(before, after) };
    };
    const control = run(CONTROL);
    assert.deepEqual(control.logged, [control.delta]);
    const halved = run(NO_GOLD);
    assert.deepEqual(halved.logged, [halved.delta], `성공 로그 ${halved.logged} = 증가 ${halved.delta}`);
    assert.equal(halved.total, halved.delta);
    assert.equal(halved.delta, HALF(control.delta));
});

test('사건 결과 문구의 "(+NG)"는 실제로 받은 골드다 — 폴백 사건 · 결과를 숨기는 암호 상자', () => {
    // 거래(리듀서 정산 — 아래 별도 시험)가 아닌 일반 폴백 사건 중 결과 문구에 "+NG"를 적는 것.
    const transactionDescs = new Set(STRUCTURED_FALLBACK_TRANSACTIONS.map((transaction) => transaction.event.desc));
    const entry = Object.values(FALLBACK_EVENT_POOL).flat()
        .find((candidate) => !transactionDescs.has(candidate.desc)
            && (candidate.outcomes || []).some((outcome) => outcome.gold > 0 && /\+\d+G/.test(outcome.log || '')
                && !outcome.elite && !outcome.relic && !outcome.status));
    assert.ok(entry, '결과 문구에 골드를 적는 폴백 사건이 있다');
    const pkg = buildEventPackage({ ...entry, source: 'fallback' }, { location: '고요한 숲', source: 'fallback' });
    const outcome = pkg.outcomes.find((candidate) => candidate.gold > 0 && /골드|G/.test(candidate.log || ''));
    const cipher = { ...getStructuredFallbackHiddenPoolEvent('fallback:treasure-chest-cipher:v1'), source: 'fallback' };
    const cipherGold = STRUCTURED_FALLBACK_HIDDEN_EVENTS.find((hidden) => hidden.id === 'fallback:treasure-chest-cipher:v1')
        .event.outcomes[2].gold;

    for (const [label, event, choiceIndex, nominal] of [
        ['폴백 사건', pkg, outcome.choiceIndex, outcome.gold],
        ['암호 상자 정답', cipher, 2, cipherGold],
    ]) {
        const run = (mods) => {
            const { before, after, logs } = chooseEvent(basePlayer({ challengeModifiers: mods }), structuredClone(event), choiceIndex);
            const line = logs.find((log) => log.type === 'event' && goldAmounts(log.text).length > 0);
            assert.ok(line, `${label}: 결과 줄이 골드를 적는다`);
            return { logged: goldAmounts(line.text), delta: goldDelta(before, after), total: totalGoldDelta(before, after), text: line.text };
        };
        const control = run(CONTROL);
        assert.deepEqual(control.logged, [nominal], `${label}: 대조군은 명목 금액`);
        assert.equal(control.delta, nominal);
        const halved = run(NO_GOLD);
        assert.deepEqual(halved.logged, [halved.delta], `${label}: 결과 줄 ${halved.text} = 증가 ${halved.delta}`);
        assert.equal(halved.total, halved.delta);
        assert.equal(halved.delta, HALF(nominal));
        // 금액 말고는 같은 문장이다.
        assert.equal(halved.text.replace(/골드 \+\d+/, '골드 +N'), control.text.replace(/골드 \+\d+/, '골드 +N'));
    }
});

test('폴백 거래 결과 줄: 받은 골드(지급액)와 순수익이 실제 값이다 — 행상인 · 내기 승리', () => {
    const transact = (mods, id, roll) => {
        const transaction = getStructuredFallbackTransaction(id);
        const potion = { ...structuredClone(DB.ITEMS.consumables.find((item) => item.type === 'hp')), id: 'potion-probe' };
        const player = basePlayer({ challengeModifiers: mods, history: [], inv: [potion], gold: 5_000 });
        const before = { ...idleState(player), gameState: GS.EVENT,
            currentEvent: { ...structuredClone(transaction.event), source: 'fallback', fallbackTransactionId: id } };
        const after = gameReducer(before, {
            type: AT.RESOLVE_FALLBACK_EVENT_TRANSACTION,
            payload: { transactionId: id, choiceIndex: transaction.choiceIndex, ...(transaction.chance ? { roll } : {}) },
        });
        assert.equal(after.gameState, GS.IDLE, '거래가 성립했다');
        const line = newLogTexts(before, after).find((text) => text === after.player.history.at(-1).outcome);
        assert.ok(line);
        return { transaction, line, delta: goldDelta(before, after), total: totalGoldDelta(before, after) };
    };

    // 행상인: 비용은 물약이라 골드 증가 = 받은 골드 = 순수익. 결과 줄 "(+200G)"가 그 값이다.
    const merchantId = 'fallback:wounded-merchant:v1';
    const merchantControl = transact(CONTROL, merchantId);
    assert.equal(merchantControl.line, formatEventText(merchantControl.transaction.event.outcomes[0].log), '대조군 문구는 그대로');
    const merchant = transact(NO_GOLD, merchantId);
    assert.deepEqual(goldAmounts(merchant.line), [merchant.delta], `${merchant.line} = 증가 ${merchant.delta}`);
    assert.equal(merchant.total, merchant.delta);
    assert.equal(merchant.delta, HALF(merchantControl.delta));

    // 내기 승리: 판돈을 내고 지급액을 받는다 — 부호 없는 "골드 N"은 받은 골드(= 증가 + 판돈), "골드 +N"은 순수익(= 증가).
    const wagerId = 'fallback:suspicious-merchant-wager:v1';
    const wagerControl = transact(CONTROL, wagerId, 0.1);
    assert.equal(wagerControl.line, formatEventText(wagerControl.transaction.event.outcomes[0].log), '대조군 문구는 그대로');
    const wager = transact(NO_GOLD, wagerId, 0.1);
    const stake = wager.transaction.cost.amount;
    const [received, net] = [...wager.line.matchAll(/골드 (\+?)(\d+)/g)].map((match) => ({ signed: match[1] === '+', amount: Number(match[2]) }));
    assert.deepEqual(received, { signed: false, amount: wager.delta + stake }, `${wager.line}: 받은 골드`);
    assert.deepEqual(net, { signed: true, amount: wager.delta }, `${wager.line}: 순수익`);
    assert.equal(wager.total, wager.delta, '누적 골드는 순수익');
    assert.match(wager.line, new RegExp(`골드 ${wager.delta + stake}${expectedParticle('을', wager.delta + stake)} `), '조사도 금액에 맞춘다');
});

test('처치 수 마일스톤: 로그는 골드 금액을 말하지 않고, 승리 줄의 골드 + 마일스톤 지급 = 실제 골드 증가', () => {
    const settle = (mods) => {
        const stats = { ...structuredClone(INITIAL_STATE.player.stats), killRegistry: { 슬라임: 9 } };
        const enemy = { name: '슬라임', baseName: '슬라임', level: 10, hp: 1, maxHp: 50, atk: 1, def: 0, exp: 10, gold: 40,
            pattern: { guardChance: 0, heavyChance: 0 } };
        let state = { ...idleState(basePlayer({ challengeModifiers: mods, atk: 5_000, stats })) };
        state = gameReducer(state, { type: AT.SET_ENEMY, payload: enemy });
        state = gameReducer(state, { type: AT.SET_GAME_STATE, payload: GS.COMBAT });
        const after = gameReducer(state, { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'attack', expectedTurn: 0, seed: 7, now: NOW } });
        assert.equal(after.enemy, null, '처치했다');
        const lines = newLogTexts(state, after);
        const milestone = lines.find((text) => text.includes('사냥꾼 (10마리 처치)'));
        assert.ok(milestone, '처치 수 마일스톤이 열렸다');
        const victory = lines.find((text) => text.startsWith('승리했습니다'));
        return { milestone, victoryGold: goldAmounts(victory)[0], card: after.postCombatResult?.gold, delta: goldDelta(state, after) };
    };
    for (const mods of [CONTROL, NO_GOLD]) {
        const result = settle(mods);
        assert.deepEqual(goldAmounts(result.milestone), [], '마일스톤 줄은 금액을 적지 않는다(적을 것이 없으니 어긋날 것도 없다)');
        assert.equal(result.card, result.victoryGold, '결과 카드 = 승리 줄');
        // 마일스톤 지급(100)은 수입 규칙을 거친다 — 승리 줄이 적은 금액을 뺀 나머지가 그 지급이다.
        assert.equal(result.delta - result.victoryGold, mods.length ? HALF(100) : 100);
    }
});

test('발견 여정 완료 로그의 골드 = 실제 골드 증가', () => {
    const chain = BALANCE.DISCOVERY_CHAINS.find((entry) => entry.reward.gold > 0);
    const complete = (mods) => {
        const last = chain.locations.at(-1);
        const stats = { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: chain.locations.slice(0, -1), discoveryChains: [] };
        const h = harness(idleState(basePlayer({ challengeModifiers: mods, level: 60, stats })));
        const before = h.state;
        const logs = [];
        checkDiscoveryChains(h.state.player, last, { dispatch: h.dispatch, addLog: (type, text) => logs.push(text) });
        const line = logs.find((text) => text.includes(chain.label));
        assert.ok(line);
        return { logged: Number(line.match(/보상: (\d+)G/)?.[1]), delta: goldDelta(before, h.state), total: totalGoldDelta(before, h.state) };
    };
    const control = complete(CONTROL);
    assert.equal(control.logged, chain.reward.gold);
    assert.equal(control.delta, chain.reward.gold);
    const halved = complete(NO_GOLD);
    assert.equal(halved.logged, halved.delta, `발견 여정 로그 ${halved.logged} = 증가 ${halved.delta}`);
    assert.equal(halved.total, halved.delta);
    assert.equal(halved.delta, HALF(chain.reward.gold));
});

// ── 한정 조우: 결과 줄 · 미리보기 ───────────────────────────────────────────

const boundedGoldChoices = BOUNDED_ENCOUNTERS.flatMap((encounter) => encounter.choices
    .filter((choice) => Number(choice.outcome.gold) > 0)
    .map((choice) => ({ encounter, choice })));

const renderedPreview = (event, choiceIndex, challengeModifiers) => {
    const html = renderStatic(createElement(EventPanel, {
        currentEvent: event,
        actions: { handleEventChoice: () => {}, dismissEvent: () => {} },
        location: '고요한 숲',
        challengeModifiers,
    }));
    const marker = `data-testid="event-choice-preview-${choiceIndex}"`;
    const start = html.indexOf(marker);
    assert.ok(start >= 0);
    return visibleText(html.slice(html.indexOf('>', start) + 1, html.indexOf('</div>', start))).trim();
};

test('한정 조우: 결과 줄 · 선택 미리보기의 골드 = 실제 골드 증가, 조사도 금액에 맞춘다', () => {
    assert.ok(boundedGoldChoices.length >= 5, `골드를 주는 한정 조우 선택지: ${boundedGoldChoices.length}`);
    let particleFixed = 0;
    for (const { encounter, choice } of boundedGoldChoices) {
        const label = `${encounter.id}:${choice.id}`;
        const run = (mods) => {
            const player = basePlayer({
                challengeModifiers: mods, loc: encounter.region, hp: 300, mp: 200,
                stats: { ...structuredClone(INITIAL_STATE.player.stats), explores: 1 },
                activeExpedition: { id: 'expedition-gold-probe', explores: 0 },
            });
            const event = buildBoundedEncounterEvent(encounter, player.stats.explores);
            const before = { ...idleState(player), gameState: GS.EVENT, currentEvent: event };
            const after = gameReducer(before, {
                type: AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE,
                payload: { encounterId: encounter.id, choiceId: choice.id, expeditionId: 'expedition-gold-probe', occurrenceSequence: 1 },
            });
            assert.equal(after.gameState, GS.IDLE, `${label}: 정산됐다`);
            const choiceIndex = event.outcomes.findIndex((outcome) => outcome.choiceId === choice.id);
            return {
                line: newLogTexts(before, after).at(-1),
                preview: renderedPreview(event, choiceIndex, mods),
                delta: goldDelta(before, after),
                total: totalGoldDelta(before, after),
            };
        };
        const control = run(CONTROL);
        assert.equal(control.line, choice.outcome.result, `${label}: 대조군 결과 줄은 데이터 그대로`);
        assert.ok(control.preview.endsWith(formatEventText(choice.tradeoff)), `${label}: 대조군 미리보기는 데이터 그대로`);
        assert.deepEqual(goldAmounts(control.line), [control.delta]);

        const halved = run(NO_GOLD);
        assert.deepEqual(goldAmounts(halved.line), [halved.delta], `${label}: 결과 줄 "${halved.line}" = 증가 ${halved.delta}`);
        assert.deepEqual(goldAmounts(halved.preview), [halved.delta], `${label}: 미리보기 "${halved.preview}" = 증가 ${halved.delta}`);
        assert.equal(halved.total, halved.delta);
        assert.equal(halved.delta, HALF(choice.outcome.gold));
        // "골드 70을" → "골드 35를": 조사가 받침에 맞는다.
        for (const text of [halved.line, halved.preview]) {
            const match = text.match(/골드 (\d+)([을를과와이가은는])/);
            if (!match) continue;
            assert.equal(match[2], expectedParticle(match[2], Number(match[1])), `${label}: "${match[0]}"`);
            if (control.line.includes(`골드 ${choice.outcome.gold}${match[2]}`) === false) particleFixed += 1;
        }
    }
    assert.ok(particleFixed > 0, '조사가 바뀌는 금액(70 → 35)이 표본에 있다');
});

// ── 미리보기: 사건 화면 ─────────────────────────────────────────────────────

test('사건 미리보기: 폴백 거래 · 결과를 숨기는 사건의 골드는 받는 금액이고, 판돈(비용)은 그대로다', () => {
    const eventPanelPreview = (event, choiceIndex, mods) => {
        // 실제 조작판이 이벤트 화면에 넘기는 도전 조건으로 그린다.
        const html = renderStatic(createElement(ControlPanel, {
            gameState: GS.EVENT, player: basePlayer({ challengeModifiers: mods }), enemy: null,
            actions: new Proxy({}, { get: () => () => {} }), setGameState: () => {},
            shopItems: [], grave: null, isAiThinking: false, currentEvent: event, stats: null, onOpenArchiveConsole: () => {},
        }));
        const marker = `data-testid="event-choice-preview-${choiceIndex}"`;
        const start = html.indexOf(marker);
        assert.ok(start >= 0);
        return visibleText(html.slice(html.indexOf('>', start) + 1, html.indexOf('</div>', start))).trim();
    };

    for (const transaction of STRUCTURED_FALLBACK_TRANSACTIONS) {
        const event = { ...structuredClone(transaction.event), source: 'fallback', fallbackTransactionId: transaction.id };
        const control = eventPanelPreview(event, transaction.choiceIndex, CONTROL);
        assert.ok(control.endsWith(transaction.preview), `${transaction.id}: 대조군 미리보기는 원장 그대로`);
        const halved = eventPanelPreview(event, transaction.choiceIndex, NO_GOLD);
        const amounts = goldAmounts(halved);
        assert.ok(amounts.includes(HALF(transaction.grossGold)), `${transaction.id}: "${halved}"에 받는 골드 ${HALF(transaction.grossGold)}`);
        assert.ok(!amounts.includes(transaction.grossGold), `${transaction.id}: 명목 지급액 ${transaction.grossGold}을 적지 않는다`);
        if (transaction.cost.type === 'gold') assert.ok(amounts.includes(transaction.cost.amount), `${transaction.id}: 판돈은 그대로`);
        assert.equal(getEventChoicePreview(event, transaction.choiceIndex, { player: { challengeModifiers: NO_GOLD } }).text,
            halved.replace(/^예상 결과 · /, ''), '화면 줄 = 미리보기 함수');
    }

    for (const hidden of STRUCTURED_FALLBACK_HIDDEN_EVENTS) {
        const goldSlots = hidden.event.outcomes.filter((slot) => slot.gold > 0);
        if (goldSlots.length === 0) continue;
        const event = { ...getStructuredFallbackHiddenPoolEvent(hidden.id), source: 'fallback' };
        assert.ok(eventPanelPreview(event, 0, CONTROL).endsWith(hidden.preview), `${hidden.id}: 대조군 미리보기는 원장 그대로`);
        const halved = eventPanelPreview(event, 0, NO_GOLD);
        for (const slot of goldSlots) {
            assert.ok(goldAmounts(halved).includes(HALF(slot.gold)), `${hidden.id}: "${halved}"에 받는 골드 ${HALF(slot.gold)}`);
            assert.ok(!goldAmounts(halved).includes(slot.gold), `${hidden.id}: 명목 금액 ${slot.gold}을 적지 않는다`);
        }
    }
});

// ── 미리보기: 묘비 · 첫 출발 안내 ───────────────────────────────────────────

test('묘비 화면의 회수 골드 = 회수할 때 실제 골드 증가', () => {
    const grave = [
        { loc: '고요한 숲', gold: 777, items: [], timestamp: 2, level: 5 },
        { loc: '고요한 숲', gold: 100, items: [], timestamp: 1, level: 4 },
    ];
    for (const mods of [CONTROL, NO_GOLD]) {
        const player = basePlayer({ challengeModifiers: mods, gold: 0 });
        const recovered = resolveGraveRecovery(player, grave).updatedPlayer.gold;
        const html = visibleText(renderStatic(createElement(GravePanel, { player, uid: 'u', grave, actions: {} })));
        assert.ok(html.includes(`${recovered.toLocaleString('ko-KR')} 골드`), `회수 묶음 ${recovered} 골드`);
        assert.equal(recovered, mods.length ? HALF(877) : 877);
        if (mods.length) assert.ok(!html.includes('877'), '명목 금액을 적지 않는다');
    }
});

test('첫 출발 안내가 약속한 첫 방문 골드 = 첫 지역에 들어설 때 실제 골드 증가 (대조군 문구는 그대로)', () => {
    const town = CONSTANTS.START_LOCATION;
    const firstArea = DB.MAPS[town].exits[0];
    const guide = (mods) => getAdventureGuidance(
        basePlayer({ challengeModifiers: mods, loc: town, level: 1 }), { maxHp: 500, maxMp: 200 }, DB.MAPS[town], 'idle',
    );
    const visit = (mods) => {
        const h = harness(idleState(basePlayer({ challengeModifiers: mods, loc: town, level: 60 })));
        const before = h.state;
        createMoveActions({ player: h.state.player, gameState: GS.IDLE, grave: [], isAiThinking: false, liveConfig: {},
            dispatch: h.dispatch, addLog: () => {} }).move(firstArea);
        return goldDelta(before, h.state);
    };
    assert.equal(guide(CONTROL).detail, '추천 경로의 첫 지역으로 이동하세요. 첫 방문 보상으로 골드 100과 경험 25를 얻습니다.');
    assert.deepEqual(goldAmounts(guide(CONTROL).detail), [visit(CONTROL)]);
    const halvedDetail = guide(NO_GOLD).detail;
    assert.deepEqual(goldAmounts(halvedDetail), [visit(NO_GOLD)], `안내 "${halvedDetail}" = 첫 방문 증가 ${visit(NO_GOLD)}`);
    assert.equal(visit(NO_GOLD), HALF(visit(CONTROL)));
});
