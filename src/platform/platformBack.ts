export type PlatformBackAction =
    | 'close-premium'
    | 'close-mirror'
    | 'close-debrief'
    | 'close-post-combat'
    | 'dismiss-event'
    | 'close-focus-panel'
    | 'close-app';

interface PlatformBackState {
    premiumShopOpen?: boolean;
    mirrorPanelOpen?: boolean;
    expeditionDebriefOpen?: boolean;
    postCombatOpen?: boolean;
    gameState?: string;
}

const FOCUS_PANEL_STATES = new Set(['shop', 'quest_board', 'job_change', 'crafting']);

export const resolvePlatformBackAction = (state: PlatformBackState): PlatformBackAction => {
    if (state.premiumShopOpen) return 'close-premium';
    if (state.mirrorPanelOpen) return 'close-mirror';
    if (state.expeditionDebriefOpen) return 'close-debrief';
    if (state.postCombatOpen) return 'close-post-combat';
    // 2026-09 Wave 19 K1: 준비 중(`event_pending`)도 이벤트 표면이다 — 빠뜨리면
    //   아래 기본값으로 떨어져 Toss/네이티브 뒤로가기가 **앱을 닫는다**.
    if (state.gameState === 'event' || state.gameState === 'event_pending') return 'dismiss-event';
    if (state.gameState && FOCUS_PANEL_STATES.has(state.gameState)) return 'close-focus-panel';
    return 'close-app';
};
