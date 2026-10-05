import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { MSG } from '../src/data/messages.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.ts';
import { buildEventPackage } from '../src/utils/aiEventUtils.ts';
import { buildCampfireEvent } from '../src/utils/campfireEvent.ts';
import { getEventChoicePreview } from '../src/utils/eventPresentation.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';
import EventPanel from '../src/components/EventPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 62 — 이야기 · 사건 미리보기가 엔진이 바뀐 보상을 그대로 말한다.
 *
 * C3  "전설의 유물"을 약속한 이야기 보상은 데이터가 등급을 선언한다(`reward.rarity === 'legendary'`) — 미리보기도 "전설 유물"이다.
 * C19 실제 전투를 여는 이야기 선택지(`outcome.combat`, 잃어버린 마법사 3단계)는 전투라고 말하고, 보상은 승리했을 때의 것이다.
 * C6  강화 칸은 더 센 쪽을 남긴다 — 지금 걸린 강화가 더 세면 미리보기가 "이 강화는 붙지 않음"을 말하고, 그 예측은 실제 정산과 같다.
 */

const clone = (value) => structuredClone(value);

const chainOutcomes = () => EVENT_CHAINS.flatMap((chain) => chain.steps.flatMap((step) => (
    step.event.outcomes.map((outcome, choiceIndex) => ({ chain, step, outcome, choiceIndex }))
)));
const chainEvent = (chainId, stepIndex) => ({
    ...clone(EVENT_CHAINS.find((chain) => chain.id === chainId).steps.find((step) => step.step === stepIndex).event),
    _chainId: chainId,
    _chainStep: stepIndex,
});

const renderedPreview = (event, choiceIndex, props = {}) => {
    const html = renderStatic(createElement(EventPanel, {
        currentEvent: event,
        actions: { handleEventChoice: () => {}, dismissEvent: () => {} },
        location: '천공 정원',
        ...props,
    }));
    const marker = `data-testid="event-choice-preview-${choiceIndex}"`;
    const start = html.indexOf(marker);
    assert.ok(start >= 0);
    return html.slice(html.indexOf('>', start) + 1, html.indexOf('</div>', start)).replace(/<[^>]+>/g, '');
};

// ── C3 ────────────────────────────────────────────────────────────────────

test('C3: 전설 등급을 선언한 이야기 유물 보상은 미리보기가 "전설 유물"이라 말하고, 등급 없는 유물은 말하지 않는다', () => {
    const relicRewards = chainOutcomes().filter(({ outcome }) => outcome.reward?.type === 'relic');
    const legendary = relicRewards.filter(({ outcome }) => outcome.reward.rarity === 'legendary');
    assert.ok(legendary.length >= 6, `전설의 유물 5곳 + 용의 유산: ${legendary.length}`);
    for (const { chain, step, outcome, choiceIndex } of relicRewards) {
        const preview = getEventChoicePreview(chainEvent(chain.id, step.step), choiceIndex);
        const label = `${chain.id}:${step.step}:${choiceIndex}`;
        if (outcome.reward.rarity === 'legendary') {
            assert.equal(preview.text, `${MSG.CHAIN_PREVIEW_PROGRESS} · ${MSG.CHAIN_PREVIEW_LEGENDARY_RELIC}`, label);
        } else {
            assert.ok(!preview.text.includes('전설'), `${label}: ${preview.text}`);
        }
    }
    // 이야기 문구가 "전설"을 말하는 유물 보상은 모두 등급을 선언한다.
    for (const { chain, step, outcome, choiceIndex } of relicRewards) {
        if (/전설/.test(outcome.log)) assert.equal(outcome.reward.rarity, 'legendary', `${chain.id}:${step.step}:${choiceIndex}`);
    }
    const dragon = chainEvent('dragon_legacy', 2);
    assert.ok(renderedPreview(dragon, 0).includes(MSG.CHAIN_PREVIEW_LEGENDARY_RELIC), 'EventPanel이 그리는 줄');
});

// ── C19 ───────────────────────────────────────────────────────────────────

test('C19: 전투를 여는 이야기 선택지는 전투라고 말하고, 보상은 승리했을 때의 것이라고 말한다', () => {
    const combats = chainOutcomes().filter(({ outcome }) => outcome.combat);
    assert.ok(combats.length >= 1, '잃어버린 마법사 3단계');
    for (const { chain, step, outcome, choiceIndex } of combats) {
        const preview = getEventChoicePreview(chainEvent(chain.id, step.step), choiceIndex);
        assert.equal(preview.tone, 'danger');
        assert.match(preview.text, /전투/);
        assert.match(preview.text, /승리하면/);
        assert.ok(!preview.text.startsWith(MSG.CHAIN_PREVIEW_PROGRESS), `${chain.id}: 진행 확정처럼 보이지 않는다`);
        if (outcome.reward?.type === 'legendary_item') assert.ok(preview.text.includes('특별 장비 보상'));
    }
    const wizard = chainEvent('lost_wizard', 2);
    assert.ok(wizard.outcomes[0].combat, '잃어버린 마법사 3단계 첫 선택은 전투다');
    assert.equal(getEventChoicePreview(wizard, 0).text, MSG.CHAIN_PREVIEW_COMBAT('특별 장비 보상'));
    assert.ok(renderedPreview(wizard, 0).includes('승리하면 특별 장비 보상'));
});

test('C19: 미리보기가 맞다 — 그 선택은 실제 전투를 열고, 보상 · 진행은 아직 주지 않는다 (실제 handleEventChoice)', () => {
    const event = chainEvent('lost_wizard', 2);
    const reward = event.outcomes[0].reward;
    const base = clone(INITIAL_STATE.player);
    let state = {
        ...clone(INITIAL_STATE),
        gameState: GS.EVENT,
        currentEvent: event,
        player: { ...base, loc: '천공 정원', level: 40, eventChainProgress: { lost_wizard: 2 } },
        logs: [],
    };
    const before = state.player;
    createEventActions({
        player: before,
        currentEvent: event,
        dispatch: (action) => { state = gameReducer(state, action); },
        addLog: () => {},
        getFullStats: () => calculateFullStats(before),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);
    assert.equal(state.gameState, GS.COMBAT, '전투가 열린다');
    assert.ok(state.enemy, '적이 선다');
    assert.equal(state.player.eventChainProgress.lost_wizard, 2, '진행은 승리 전까지 그대로');
    assert.ok(!(state.player.inv || []).some((item) => item.name === reward.name), '보상은 승리 전까지 없다');
});

// ── C6 ────────────────────────────────────────────────────────────────────

const ACTIVE_BUFFS = [
    { label: '강화 없음', buff: null },
    { label: '약한 강화', buff: { atk: 0.05, def: 0, turn: 1, name: '약한 기세' } },
    { label: '센 강화', buff: { atk: 2, def: 0, turn: 10, name: '광폭화' } },
];

/** 강화를 거는 선택지들 — 모닥불 단련 · 이야기 전투 보너스 · 폴백 사건 강화. */
const buffChoices = () => {
    const cases = [];
    const campfire = buildCampfireEvent({ maxHp: 300, maxMp: 100 });
    campfire.outcomes.forEach((outcome, choiceIndex) => {
        if (outcome.buff) cases.push({ label: `모닥불:${choiceIndex}`, event: campfire, choiceIndex, progress: {} });
    });
    for (const { chain, step, outcome, choiceIndex } of chainOutcomes()) {
        if (outcome.reward?.type !== 'combat_bonus' || outcome.type !== 'chain_advance') continue;
        cases.push({
            label: `${chain.id}:${step.step}:${choiceIndex}`,
            event: chainEvent(chain.id, step.step),
            choiceIndex,
            progress: { [chain.id]: step.step },
        });
    }
    for (const entry of Object.values(FALLBACK_EVENT_POOL).flat()) {
        if (!(entry.outcomes || []).some((outcome) => outcome.buff)) continue;
        const pkg = buildEventPackage({ ...entry, source: 'fallback' }, { location: '고요한 숲', source: 'fallback' });
        if (!pkg) continue;
        pkg.outcomes.forEach((outcome) => {
            if (outcome.buff?.turns && !outcome.elite && !outcome.relic) {
                cases.push({ label: `폴백:${entry.desc.slice(0, 12)}:${outcome.choiceIndex}`, event: pkg, choiceIndex: outcome.choiceIndex, progress: {} });
            }
        });
    }
    return cases;
};

const settleWithBuff = (event, choiceIndex, activeBuff, progress) => {
    const base = clone(INITIAL_STATE.player);
    let state = {
        ...clone(INITIAL_STATE),
        gameState: GS.EVENT,
        currentEvent: clone(event),
        player: { ...base, loc: '고요한 숲', level: 20, hp: 200, maxHp: 300, eventChainProgress: progress, tempBuff: clone(activeBuff) ?? undefined },
        logs: [],
    };
    const before = state.player;
    createEventActions({
        player: before,
        currentEvent: state.currentEvent,
        dispatch: (action) => { state = gameReducer(state, action); },
        addLog: () => {},
        getFullStats: () => calculateFullStats(before),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return state.player.tempBuff ?? null;
};

test('C6: 미리보기의 "이 강화는 붙지 않음"은 실제 정산과 같다 — 모닥불 · 이야기 전투 보너스 · 사건 강화 × 지금 강화 3종', () => {
    const cases = buffChoices();
    const kinds = new Set(cases.map((entry) => entry.label.split(':')[0]));
    assert.ok(kinds.has('모닥불') && kinds.size >= 3, [...kinds].join(', '));
    let kept = 0;
    let applied = 0;
    for (const { label, event, choiceIndex, progress } of cases) {
        for (const active of ACTIVE_BUFFS) {
            const preview = getEventChoicePreview(event, choiceIndex, { activeBuff: active.buff });
            const predictedKept = preview.text.includes(MSG.EVENT_PREVIEW_BUFF_KEPT);
            const after = settleWithBuff(event, choiceIndex, active.buff, progress);
            const actuallyKept = active.buff !== null && JSON.stringify(after) === JSON.stringify(active.buff);
            assert.equal(predictedKept, actuallyKept, `${label} · ${active.label}: 미리보기 ${predictedKept} / 정산 ${actuallyKept}`);
            if (predictedKept) {
                kept += 1;
                assert.notEqual(preview.tone, 'reward', '붙지 않는 강화를 보상처럼 보이지 않는다');
            } else if (active.buff !== null) {
                applied += 1;
            }
        }
    }
    assert.ok(kept > 0 && applied > 0, `두 갈래가 모두 표본에 있다 (유지 ${kept} · 교체 ${applied})`);
});

test('C6: 이벤트 화면은 지금 강화를 미리보기에 넘긴다 — 지금 강화가 없으면 문구는 그대로다', () => {
    const campfire = buildCampfireEvent({ maxHp: 300, maxMp: 100 });
    const forge = campfire.outcomes.findIndex((outcome) => outcome.buff);
    assert.ok(forge >= 0);
    const strong = ACTIVE_BUFFS[2].buff;
    assert.ok(renderedPreview(campfire, forge, { activeBuff: strong }).includes(MSG.EVENT_PREVIEW_BUFF_KEPT));
    assert.ok(!renderedPreview(campfire, forge, { activeBuff: null }).includes(MSG.EVENT_PREVIEW_BUFF_KEPT));
    assert.deepEqual(getEventChoicePreview(campfire, forge), getEventChoicePreview(campfire, forge, { activeBuff: null }));
});

test('C6: 강화를 걸지 않는 선택(휴식 · 골드 · 유물)에는 지금 강화가 세도 문구를 붙이지 않는다', () => {
    const strong = ACTIVE_BUFFS[2].buff;
    const campfire = buildCampfireEvent({ maxHp: 300, maxMp: 100 });
    campfire.outcomes.forEach((outcome, choiceIndex) => {
        if (outcome.buff) return;
        assert.ok(!getEventChoicePreview(campfire, choiceIndex, { activeBuff: strong }).text.includes(MSG.EVENT_PREVIEW_BUFF_KEPT));
    });
    for (const { chain, step, outcome, choiceIndex } of chainOutcomes()) {
        if (outcome.reward?.type === 'combat_bonus') continue;
        const preview = getEventChoicePreview(chainEvent(chain.id, step.step), choiceIndex, { activeBuff: strong });
        assert.ok(!preview.text.includes(MSG.EVENT_PREVIEW_BUFF_KEPT), `${chain.id}:${step.step}:${choiceIndex}`);
    }
});
