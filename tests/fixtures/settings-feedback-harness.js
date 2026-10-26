import React from 'react';
import { createRoot } from 'react-dom/client';
import { useGameFeedbackHaptics, usePresentationHaptic } from '../../src/hooks/useHapticFeedback.ts';
import TerminalView from '../../src/components/TerminalView.tsx';
import LegendaryDropOverlay from '../../src/components/LegendaryDropOverlay.tsx';

/**
 * 2026-10-26 소유자 결정 D3 · D23 · D24 — 실제 표시 훅 · 컴포넌트를 Chromium에서 돌리는 하네스.
 *   haptics: 진동 계기 훅(울린 계기를 기록한다 — 실제 포트 대신)
 *   presentation: 전설 획득 화면이 새 대상으로 뜰 때의 진동
 *   terminal: 실제 TerminalView의 문서 keydown 처리기(한 글자 단축키 설정)
 *   legendary: 전설 획득 화면 — 초점을 옮기지 않는 상태 알림
 */
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
window.IS_REACT_ACT_ENVIRONMENT = true;

let played = [];
let commands = [];
let quickSlotUses = [];
let dismissed = 0;
const recordPlay = (cue) => played.push(cue);
const recordCommand = (command) => commands.push(command);
const recordQuickSlot = (item, index) => quickSlotUses.push(index);
const recordDismiss = () => { dismissed += 1; };

function Haptics(props) {
    useGameFeedbackHaptics(props, recordPlay);
    return null;
}

function Presentation({ presentedKey, enabled }) {
    usePresentationHaptic('legendary', presentedKey, enabled, recordPlay);
    return null;
}

function Terminal({ gameState, player, quickSlots }) {
    return React.createElement(TerminalView, {
        logs: [],
        gameState,
        player,
        onCommand: recordCommand,
        quickSlots,
        onQuickSlotUse: recordQuickSlot,
        maxHp: player?.maxHp,
    });
}

function Legendary({ item }) {
    return React.createElement(React.Fragment, null,
        React.createElement('button', { type: 'button', 'data-testid': 'focus-anchor' }, '자리'),
        React.createElement(LegendaryDropOverlay, { item, onDismiss: recordDismiss }),
    );
}

const VIEWS = { haptics: Haptics, presentation: Presentation, terminal: Terminal, legendary: Legendary };

const read = () => {
    const status = document.querySelector('[data-testid="legendary-drop-status"]');
    const overlay = document.querySelector('[data-testid="legendary-drop-overlay"]');
    return {
        played: [...played],
        commands: [...commands],
        quickSlotUses: [...quickSlotUses],
        dismissed,
        activeTestId: document.activeElement?.getAttribute('data-testid') ?? null,
        status: status ? {
            role: status.getAttribute('role'),
            live: status.getAttribute('aria-live'),
            text: status.textContent,
        } : null,
        overlay: overlay ? {
            ariaHidden: overlay.getAttribute('aria-hidden'),
            role: overlay.getAttribute('role'),
            ariaModal: overlay.getAttribute('aria-modal'),
            inDialog: Boolean(overlay.closest('[data-overlay-dialog="true"]')),
        } : null,
        inertCount: document.querySelectorAll('[inert]').length,
        dialogCount: document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length,
    };
};

window.settingsFeedbackHarness = {
    async render(view, props) {
        await React.act(async () => root.render(React.createElement(VIEWS[view], props)));
        return read();
    },
    focus(testId) {
        document.querySelector(`[data-testid="${testId}"]`)?.focus();
        return read();
    },
    pending: null,
    startTick(ms) {
        window.settingsFeedbackHarness.pending = React.act(() => new Promise((resolve) => {
            setTimeout(resolve, ms);
        }));
        return true;
    },
    finishTick: () => window.settingsFeedbackHarness.pending,
    read,
};
