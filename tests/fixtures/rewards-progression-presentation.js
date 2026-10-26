import React from 'react';
import { createRoot } from 'react-dom/client';
import { useEncounterBanner } from '../../src/hooks/useEncounterBanner.ts';
import { useRelicAcquisitionMoment } from '../../src/hooks/useRelicAcquisitionMoment.ts';
import { useClassChangeReadyLevel } from '../../src/hooks/useClassChangeReadyLevel.ts';
import { isLevelUpClassChangeReady } from '../../src/utils/classChangeReadiness.ts';
import MomentBanners from '../../src/components/MomentBanners.tsx';
import LevelUpBanner from '../../src/components/LevelUpBanner.tsx';
import PostCombatCard from '../../src/components/PostCombatCard.tsx';
import RelicChoicePanel from '../../src/components/RelicChoicePanel.tsx';

/**
 * 2026-10 감사 rewards-progression(GF-08 · GF-09 · GF-10 · UX-10 · UX-11 · CL-05) — 실제 표시 훅 · 컴포넌트를 Chromium에서 돌리는 하네스.
 * GameRoot가 쓰는 것과 같은 조합(레벨 상승 띠의 부제 = `isLevelUpClassChangeReady`)으로 그린다.
 */
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
window.IS_REACT_ACT_ENVIRONMENT = true;

let snapshot = null;
let calls = { close: 0, explore: 0, inventory: 0 };
let dispatched = [];
// 리듀서의 제안 객체처럼 같은 제안은 같은 참조로 넘긴다 — 평가 왕복은 매번 새 배열을 만든다.
let offer = null;
let ownedRelics = [];

// 앱의 useReducer dispatch처럼 참조가 바뀌지 않는다.
const recordDispatch = (action) => {
    dispatched.push({ type: action.type, id: action.payload?.id ?? action.payload?.relicId ?? null });
};

function Encounter({ enemy, epoch }) {
    snapshot = { banner: useEncounterBanner(enemy, epoch) };
    return null;
}

function RelicMoment({ epoch }) {
    snapshot = { moment: useRelicAcquisitionMoment(ownedRelics, epoch) };
    return null;
}

function ClassReady({ level, job, epoch, bannerLevel }) {
    const readyLevel = useClassChangeReadyLevel(level, job, epoch);
    snapshot = { readyLevel };
    return React.createElement(LevelUpBanner, {
        level: bannerLevel ?? null,
        classChangeReady: isLevelUpClassChangeReady(bannerLevel ?? null, readyLevel),
    });
}

function Moments({ enemy, epoch, belowLevelUp }) {
    return React.createElement(MomentBanners, { enemy, relics: ownedRelics, presentationEpoch: epoch, belowLevelUp });
}

function Card({ result, withExplore, cardKey }) {
    return React.createElement(PostCombatCard, {
        key: cardKey,
        result,
        onClose: () => { calls.close += 1; },
        onOpenInventory: () => { calls.inventory += 1; },
        onExplore: withExplore ? () => { calls.explore += 1; } : null,
    });
}

function Relics({ player }) {
    return React.createElement(RelicChoicePanel, { pendingRelics: offer, dispatch: recordDispatch, player, stats: null });
}

const VIEWS = { encounter: Encounter, relicMoment: RelicMoment, classReady: ClassReady, moments: Moments, card: Card, relics: Relics, none: () => null };

// 퇴장 중인 띠 · 카드(AnimatePresence)가 새 요소 앞에 남아 있을 수 있다 — 언제나 마지막(가장 새) 요소와 그 안을 읽는다.
const last = (selector, scope = document) => [...scope.querySelectorAll(selector)].at(-1) ?? null;
const textIn = (scope, selector) => last(selector, scope)?.textContent ?? null;

const readCard = (card) => {
    const primary = last('[data-testid="post-combat-primary-action"]', card);
    return {
        stage: card.getAttribute('data-reveal-stage'),
        inputReady: card.getAttribute('data-input-ready'),
        exp: textIn(card, '[data-testid="post-combat-reward-exp"]'),
        gold: textIn(card, '[data-testid="post-combat-reward-gold"]'),
        lootPending: Boolean(last('[data-testid="post-combat-loot"].aether-reveal-pending', card)),
        lootPopping: card.querySelectorAll('[data-testid="post-combat-loot"] .aether-reveal-pop').length,
        primaryKind: primary?.getAttribute('data-primary-kind') ?? null,
        primaryDisabled: primary?.disabled ?? null,
        continueDisabled: last('[data-testid="post-combat-continue"]', card)?.disabled ?? null,
    };
};

const readDom = () => {
    const card = last('[data-testid="post-combat-card"]');
    const relicMoment = last('[data-testid="relic-moment-banner"]');
    const encounter = last('[data-testid="encounter-banner"]');
    const levelUp = last('[data-testid="level-up-banner"]');
    return {
        card: card ? readCard(card) : null,
        relicCards: [...document.querySelectorAll('[data-testid^="relic-choice-"][data-relic-recommended]')]
            .map((relicCard) => relicCard.getAttribute('data-relic-confirming') === 'true'),
        relicMoment: relicMoment ? {
            kind: relicMoment.getAttribute('data-relic-moment'),
            text: relicMoment.textContent,
            drawback: textIn(relicMoment, '[data-testid="relic-moment-drawback"]'),
        } : null,
        encounter: encounter ? {
            kind: encounter.getAttribute('data-encounter-kind'),
            text: encounter.textContent,
        } : null,
        momentTop: last('[data-testid="moment-banners"]')?.className.match(/top-\[[^\]]+\]/)?.[0] ?? null,
        levelUp: levelUp ? {
            text: levelUp.textContent,
            classChangeReady: levelUp.getAttribute('data-class-change-ready'),
        } : null,
    };
};

const read = () => ({ snapshot, dom: readDom(), calls: { ...calls }, dispatched: [...dispatched] });

window.rewardsHarness = {
    async render(view, props = {}) {
        if (props.relics !== undefined) ownedRelics = props.relics;
        if (props.offer !== undefined) offer = props.offer;
        await React.act(async () => root.render(React.createElement(VIEWS[view], props)));
        return read();
    },
    /** 같은 유물 목록 · 제안을 그대로 둔 채 다시 그린다(참조 유지). */
    async rerender(view, props = {}) {
        await React.act(async () => root.render(React.createElement(VIEWS[view], props)));
        return read();
    },
    async click(selector) {
        await React.act(async () => {
            last(selector)?.click();
        });
        return read();
    },
    pending: null,
    /** 멈춘 가짜 시계 위에서 `ms`만큼 기다리는 act를 건다 — 시계는 테스트가 `clock.runFor`로 민다. */
    startTick(ms) {
        window.rewardsHarness.pending = React.act(() => new Promise((resolve) => {
            setTimeout(resolve, ms);
        }));
        return true;
    },
    finishTick: () => window.rewardsHarness.pending,
    read,
};
