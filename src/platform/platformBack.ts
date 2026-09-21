import { GS } from '../reducers/gameStates';
import type { GameMode } from '../reducers/gameStates';

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
    gameState?: GameMode;
}

/**
 * 모드 → 뒤로가기 동작 **전수 표**.
 *
 * 2026-09 Wave 19 K1이 `event_pending`을 손으로 채워 넣어야 했던 자리다 —
 * 빠뜨리면 기본값(`close-app`)으로 떨어져 네이티브/Toss 뒤로가기가 **앱을 닫는다**.
 * Wave 20 L1: `Record<GameMode, …>`라 새 `GS` 멤버가 들어오면 그 누락이
 * **TS2741**이 된다(주석이 아니라 컴파일러가 짚는다).
 */
const MODE_BACK_ACTION: Record<GameMode, PlatformBackAction> = {
    // 이벤트 표면 — 준비 중(`event_pending`)도 같은 표면이다.
    [GS.EVENT]: 'dismiss-event',
    [GS.EVENT_PENDING]: 'dismiss-event',
    // 포커스 패널 — 뒤로가기는 패널을 닫고 idle로 돌아간다.
    [GS.SHOP]: 'close-focus-panel',
    [GS.QUEST_BOARD]: 'close-focus-panel',
    [GS.JOB_CHANGE]: 'close-focus-panel',
    [GS.CRAFTING]: 'close-focus-panel',
    // 나머지는 앱을 닫는다(전투 중에도 — 뒤로가기는 도주 판정이 아니다).
    [GS.IDLE]: 'close-app',
    [GS.COMBAT]: 'close-app',
    [GS.MOVING]: 'close-app',
    [GS.DEAD]: 'close-app',
    [GS.ASCENSION]: 'close-app',
    [GS.TRUE_ENDING]: 'close-app',
};

export const resolvePlatformBackAction = (state: PlatformBackState): PlatformBackAction => {
    // 오버레이는 모드보다 먼저 소비된다 — 모드 위에 겹쳐 뜨기 때문이다.
    if (state.premiumShopOpen) return 'close-premium';
    if (state.mirrorPanelOpen) return 'close-mirror';
    if (state.expeditionDebriefOpen) return 'close-debrief';
    if (state.postCombatOpen) return 'close-post-combat';
    return state.gameState ? MODE_BACK_ACTION[state.gameState] : 'close-app';
};
