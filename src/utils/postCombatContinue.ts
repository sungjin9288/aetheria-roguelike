import { DB } from '../data/db';
import { GS, type GameMode } from '../reducers/gameStates';
import { getTownExploreIntent } from './townActionPresentation';
import type { Player } from '../types/index.js';

/** 탐험 단추의 판정이 읽는 플레이어 필드 — 위치와 대기 중인 이야기 스텝. */
export type PostCombatExplorePlayer = Pick<Player, 'loc' | 'eventChainProgress' | 'deferredEventChainSteps' | 'stats'>;

/**
 * 전투 결과 카드의 '계속 탐험' — 2026-10 (감사 UX-10). 라벨은 탐험을 이어 간다고 말하는데 카드만 닫아서,
 *   승리할 때마다 닫기 · 탐험을 따로 눌러야 했다. 조작판에 탐험 단추가 있을 때와 같은 조건에서만 탐험을 바로 부른다:
 *   대기 모드이고, 안전지대 밖이거나 안전지대의 탐험 행동(`getTownExploreIntent` — 대기 중인 이야기 스텝 · 황금 왕국 조사)이 있을 때.
 *   탐험의 실제 게이트는 그대로 액션(`exploreActions.explore`)이 소유한다. 조건이 아니면 false — 카드는 '닫기'로 남는다.
 */
export const canContinueExploreAfterCombat = (
    gameState: GameMode | null | undefined,
    player: PostCombatExplorePlayer | null | undefined,
): boolean => {
    if (gameState !== GS.IDLE || !player?.loc) return false;
    const mapData = DB.MAPS[player.loc];
    if (!mapData) return false;
    return mapData.type !== 'safe' || getTownExploreIntent(player, mapData) !== null;
};

/** 결과 카드에 넘길 탐험 콜백 — 탐험할 수 없으면 null(카드가 '닫기'만 보인다). */
export const getPostCombatExploreAction = (
    gameState: GameMode | null | undefined,
    player: PostCombatExplorePlayer | null | undefined,
    explore: (() => unknown) | null | undefined,
): (() => void) | null => {
    if (typeof explore !== 'function' || !canContinueExploreAfterCombat(gameState, player)) return null;
    return () => {
        void explore();
    };
};
