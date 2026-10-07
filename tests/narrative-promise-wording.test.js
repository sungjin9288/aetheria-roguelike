import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { MSG } from '../src/data/messages.ts';
import { MAPS } from '../src/data/maps.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { getEventChoicePreview } from '../src/utils/eventPresentation.ts';
import { getShopCatalog, getShopMaxTier } from '../src/utils/shopRotation.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';
import EventPanel from '../src/components/EventPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 62 — 강해지는 쪽 서사 문구 3건(원장 §61.4 · 소유자 답 §61.6 "서사는 문구").
 *
 * C2  이야기 능력치 보상은 '영구'라 했지만 이번 여정 범위다(`storyStatBonus` — 사망 · 계승에서 사라지고 체인은 다시 못 한다).
 *     → 2026-10 Wave 72 소유자 결정 "영구로 전환"이 대체했다: 체인은 계정당 한 번이라 런 범위이던 동안 한 번 죽으면 영원히 잃었다.
 *       이제 보상은 영구이고(사망 · 계승을 넘는다) 문구 · 미리보기도 '영구'라 말한다. 행동 계약은
 *       tests/permanent-stats-elite-titles-contract.test.js.
 * C13 기계 반란 2단계 "전투에서 도움을 받을 수 있게 됩니다" — 보상은 골드 3,000뿐이고 그 진행을 읽는 전투 도움은 없다.
 * C14 허공의 섬 "이곳에서만 구할 수 있는 희귀한 물건" — 독점 상품이 없다(재고는 판매 등급 규칙 그대로).
 */

const clone = (value) => structuredClone(value);
const chainById = (id) => EVENT_CHAINS.find((chain) => chain.id === id);
const chainEvent = (chainId, step) => ({
    ...clone(chainById(chainId).steps.find((entry) => entry.step === step).event),
    _chainId: chainId,
    _chainStep: step,
});

const chainOutcomes = () => EVENT_CHAINS.flatMap((chain) => chain.steps.flatMap((step) => (
    step.event.outcomes.map((outcome, choiceIndex) => ({ chain, step, outcome, choiceIndex }))
)));

const renderPreviewRow = (event, choiceIndex) => {
    const html = renderStatic(createElement(EventPanel, {
        currentEvent: event,
        actions: { handleEventChoice: () => {}, dismissEvent: () => {} },
        location: '마왕성',
    }));
    const marker = `data-testid="event-choice-preview-${choiceIndex}"`;
    const start = html.indexOf(marker);
    assert.ok(start >= 0);
    return html.slice(html.indexOf('>', start) + 1, html.indexOf('</div>', start)).replace(/<[^>]+>/g, '');
};

// ── C2 ────────────────────────────────────────────────────────────────────

test('C2 → Wave 72: 이야기 미리보기 · 문구는 능력치 보상을 "영구"라 말하고, 다른 보상은 "영구"를 약속하지 않는다', () => {
    for (const chain of EVENT_CHAINS) {
        for (const step of chain.steps) {
            const texts = [step.event.title, step.event.desc, ...step.event.choices,
                ...step.event.outcomes.filter((o) => o.reward?.type !== 'stat_bonus').map((o) => o.log)];
            for (const text of texts) assert.ok(!String(text || '').includes('영구'), `${chain.id}:${step.step}: ${text}`);
        }
    }
    const statRewards = chainOutcomes().filter(({ outcome }) => outcome.reward?.type === 'stat_bonus');
    assert.ok(statRewards.length >= 8, '능력치 보상 선택지가 표본에 있다');
    for (const { chain, step, outcome, choiceIndex } of statRewards) {
        if (outcome.type !== 'chain_advance') continue;
        const preview = getEventChoicePreview(chainEvent(chain.id, step.step), choiceIndex);
        assert.equal(preview.text, `${MSG.CHAIN_PREVIEW_PROGRESS} · ${MSG.CHAIN_PREVIEW_STAT_BONUS}`, `${chain.id}:${step.step}:${choiceIndex}`);
        assert.ok(preview.text.includes('영구'));
        assert.ok(!preview.text.includes('이번 여정'));
    }
    // 원장이 짚은 문구: 잊혀진 사령관 3단계 "영혼에게 안식을 권한다".
    const commander = chainEvent('forgotten_commander', 2);
    assert.match(commander.outcomes[1].log, /방어력과 생명이 영구히 강해집니다/);
    assert.ok(renderPreviewRow(commander, 1).includes(MSG.CHAIN_PREVIEW_STAT_BONUS), 'EventPanel이 그리는 줄');
});

test('C2 → Wave 72: 문구가 맞다 — 이야기 능력치(`storyStatBonus`)는 사망 · 계승 뒤로 넘어간다', () => {
    const player = { ...clone(INITIAL_STATE.player), storyStatBonus: { def: 12, hp: 100 } };
    const carried = pickPermanentPlayerState(player, clone(INITIAL_STATE.player));
    assert.deepEqual(carried.storyStatBonus, { atk: 0, def: 12, hp: 100, mp: 0 }, '영구 상태 선별에 들어간다');
});

// ── C13 ───────────────────────────────────────────────────────────────────

test('C13: 기계 반란 2단계 동맹 선택은 골드 3,000만 약속하고 그만큼만 준다 (실제 handleEventChoice)', () => {
    const event = chainEvent('machine_uprising', 1);
    const outcome = event.outcomes[0];
    assert.deepEqual(outcome.reward, { type: 'gold', amount: 3000 });
    assert.ok(!/전투|도움/.test(outcome.log), `문구가 전투 도움을 약속하지 않는다: ${outcome.log}`);

    const base = clone(INITIAL_STATE.player);
    let state = {
        ...clone(INITIAL_STATE),
        gameState: GS.EVENT,
        currentEvent: event,
        player: { ...base, loc: '몰락한 전초기지', gold: 100, eventChainProgress: { machine_uprising: 1 } },
        logs: [],
    };
    const before = state.player;
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch: (action) => { state = gameReducer(state, action); },
        addLog: () => {},
        getFullStats: () => calculateFullStats(before),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);
    assert.equal(state.player.gold, before.gold + 3000);
    assert.equal(state.player.eventChainProgress.machine_uprising, 2);
    assert.deepEqual(state.player.tempBuff ?? null, before.tempBuff ?? null, '전투 강화가 걸리지 않는다');
    assert.deepEqual(state.player.storyStatBonus ?? null, before.storyStatBonus ?? null, '능력치도 그대로다');
});

// ── C14 · C20 문구 ─────────────────────────────────────────────────────────

test('C14: "이곳에서만 구할 수 있다"는 상점은 실제로 다른 상점에 없는 물건이 있어야 한다 — 허공의 섬은 독점을 말하지 않는다', () => {
    const shops = Object.entries(MAPS).filter(([, map]) => map.type === 'safe').map(([name]) => name);
    const catalogs = new Map(shops.map((name) => [name, new Set(getShopCatalog(name).map((item) => item.name))]));
    for (const [name, map] of Object.entries(MAPS)) {
        const text = `${map.desc || ''} ${map.lore || ''}`;
        if (!/이곳에서만|독점/.test(text)) continue;
        const elsewhere = new Set(shops.filter((other) => other !== name).flatMap((other) => [...catalogs.get(other)]));
        const exclusive = [...(catalogs.get(name) || [])].filter((item) => !elsewhere.has(item));
        assert.ok(exclusive.length > 0, `${name}: 독점을 말하지만 독점 상품이 없다`);
    }
    const island = MAPS['허공의 섬'];
    assert.ok(!/이곳에서만|독점/.test(`${island.desc} ${island.lore}`));
    // 남은 약속("최상급 장비까지")은 판매 등급 규칙이 지킨다.
    assert.match(island.lore, /최상급 장비/);
    assert.equal(getShopMaxTier('허공의 섬'), 6);
    assert.ok(getShopCatalog('허공의 섬').some((item) => (item.tier || 1) === 6));
});

test('C20 문구: 북부 요새 설명은 판매 등급 3 상점이고, "최고 등급 장비"를 말하지 않는다', () => {
    const fortress = MAPS['북부 요새'];
    assert.match(fortress.desc, /판매 등급 3 상점/);
    assert.ok(!/Tier/.test(fortress.desc), '상점 화면과 같은 말(판매 등급)을 쓴다');
    assert.ok(!/최고 등급/.test(fortress.lore), fortress.lore);
});
