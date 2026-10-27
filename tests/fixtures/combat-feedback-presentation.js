import React from 'react';
import { createRoot } from 'react-dom/client';
import { useCombatFeedbackBeats } from '../../src/hooks/useCombatFeedbackBeats.ts';
import { useDamageFlash } from '../../src/hooks/useDamageFlash.ts';
import { useLegendaryDropDetector } from '../../src/hooks/useLegendaryDropDetector.ts';
import { useLevelUpCelebration } from '../../src/hooks/useLevelUpCelebration.ts';
import { getCombatStageView, getCounterStagger } from '../../src/utils/combatPresentation.ts';
import StatusBar from '../../src/components/StatusBar.tsx';
import CritPulse from '../../src/components/CritPulse.tsx';
import DamageNumber from '../../src/components/DamageNumber.tsx';

/**
 * 게임 필 감사 GF-01 · 02 · 06 · 11 · 12 · 13 — 실제 표시 훅 · 컴포넌트를 Chromium에서 돌리는 하네스.
 * GameRoot · App이 쓰는 것과 같은 조합(`getCombatStageView` · `getCounterStagger`)으로 그린다.
 */
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
window.IS_REACT_ACT_ENVIRONMENT = true;

let snapshot = null;
let dispatched = [];
let dismissDrop = () => {};

function Stage({ feedback, epoch, liveEnemy, player }) {
    const beats = useCombatFeedbackBeats(feedback, epoch);
    const stage = getCombatStageView(liveEnemy, beats.defeatedEnemy);
    snapshot = { ...beats, holdResultCards: stage.holdResultCards };
    return React.createElement(React.Fragment, null,
        React.createElement(StatusBar, {
            player,
            stats: null,
            enemy: stage.enemy,
            enemyDefeated: stage.enemyDefeated,
            enemyHitCrit: beats.hitCrit,
        }),
        React.createElement(CritPulse, { active: beats.critPulse }),
        React.createElement(CritPulse, { active: beats.heavyPulse, tone: 'heavy' }),
    );
}

function Damage({ hp, epoch, feedback, reducedMotion }) {
    const flash = useDamageFlash(hp, epoch, getCounterStagger(feedback, reducedMotion));
    snapshot = flash;
    return flash.damageAmount ? React.createElement(DamageNumber, { amount: flash.damageAmount }) : null;
}

// 2026-10-26 D33: 전설 획득 화면은 리듀서의 획득 목록만 읽는다 — dispatch가 없다(원장은 획득 전이가 남긴다).
function Legendary({ acquisitions, epoch }) {
    const { currentDrop, dismissDrop: dismiss } = useLegendaryDropDetector(acquisitions, epoch);
    dismissDrop = dismiss;
    snapshot = { current: currentDrop?.name ?? null };
    return null;
}

function Level({ level, epoch }) {
    snapshot = { banner: useLevelUpCelebration(level, epoch) };
    return null;
}

const VIEWS = { stage: Stage, damage: Damage, legendary: Legendary, level: Level };

const readDom = () => {
    const number = document.querySelector('[data-testid="enemy-damage-number"]');
    const playerNumber = document.querySelector('[data-testid="damage-number"]');
    const status = document.querySelector('[data-testid="enemy-status"]');
    return {
        enemyStatus: Boolean(status),
        // 이름 줄은 '교전 대상' 머리 바로 다음 줄의 첫 칸이다 — 이름 칸의 모양(말줄임 · 줄 넘김)과 무관하게 읽는다.
        enemyName: status?.querySelector('[data-testid="enemy-status-label"]')?.nextElementSibling?.firstElementChild?.textContent ?? null,
        defeated: status?.getAttribute('data-defeated') ?? null,
        stamp: document.querySelector('[data-testid="enemy-defeated-stamp"]')?.textContent ?? null,
        enemyNumber: number?.textContent ?? null,
        enemyNumberCrit: number?.getAttribute('data-crit') ?? null,
        enemyNumberOpacity: number ? getComputedStyle(number).opacity : null,
        playerNumber: playerNumber?.textContent ?? null,
        playerNumberOpacity: playerNumber ? getComputedStyle(playerNumber).opacity : null,
        critPulse: Boolean(document.querySelector('[data-testid="crit-pulse"]')),
        heavyPulse: Boolean(document.querySelector('[data-testid="heavy-hit-pulse"]')),
        statusText: document.querySelector('[data-testid="persistent-status-bar"]')?.textContent ?? '',
    };
};

window.presentationHarness = {
    async render(view, props) {
        await React.act(async () => root.render(React.createElement(VIEWS[view], props)));
        return { snapshot, dom: readDom(), dispatched: [...dispatched] };
    },
    pending: null,
    /** 멈춘 가짜 시계 위에서 `ms`만큼 기다리는 act를 건다 — 시계는 테스트가 `clock.runFor`로 민다. */
    startTick(ms) {
        window.presentationHarness.pending = React.act(() => new Promise((resolve) => {
            setTimeout(resolve, ms);
        }));
        return true;
    },
    finishTick: () => window.presentationHarness.pending,
    async dismiss() {
        await React.act(async () => dismissDrop());
        return { snapshot, dom: readDom(), dispatched: [...dispatched] };
    },
    read: () => ({ snapshot, dom: readDom(), dispatched: [...dispatched] }),
};
