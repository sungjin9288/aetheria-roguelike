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
    if (state.gameState === 'event') return 'dismiss-event';
    if (state.gameState && FOCUS_PANEL_STATES.has(state.gameState)) return 'close-focus-panel';
    return 'close-app';
};
