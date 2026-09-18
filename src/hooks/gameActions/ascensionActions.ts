import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { getAscensionOutcome } from '../../utils/ascensionPreview';
import { getClaimableQuestEntries } from '../../utils/questProgress';
import type { GameActionDeps } from '../actionDeps';
import type { Player } from '../../types/player';

// cycle 315: _shared?: any 미사용 2번째 파라미터 제거 — ascensionActions에서 shared 헬퍼 사용 0건.
//   useGameActions에서 createAscensionActions(deps, shared) 호출하지만 extra arg는 무시되어 동작 동일.
export const createAscensionActions = (deps: GameActionDeps) => {
    const { player, gameState, dispatch, addLog } = deps;
    let ascensionRequestInFlight = false;
    return {
        confirmAscension: () => {
            if (gameState === GS.TRUE_ENDING && getClaimableQuestEntries(player).length > 0) return;
            if (ascensionRequestInFlight) return;
            ascensionRequestInFlight = true;
            const outcome = getAscensionOutcome(player.meta);
            const projectedPlayer: Player = {
                ...player,
                meta: outcome.meta,
                titles: [...new Set([...(player.titles || []), outcome.title])],
                activeTitle: outcome.title,
            };
            const ascensionTitles = checkTitles(projectedPlayer);
            dispatch({
                type: AT.ASCEND,
                payload: {
                    expectedPrestigeRank: outcome.currentRank,
                    sourceReceiptKey: player.meta?.endgame?.lastEndgameReceiptKey ?? null,
                },
            });
            if (ascensionTitles.length > 0) {
                dispatch({ type: AT.UNLOCK_TITLES, payload: ascensionTitles });
                ascensionTitles.forEach((id) => addLog('system', MSG.TITLE_UNLOCKED(getTitleLabel(id))));
            }
            addLog('system', MSG.ASCEND_DONE(outcome.nextRank, outcome.title));
        },

        cancelAscension: () => {
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            addLog('info', MSG.ASCEND_CANCEL);
        },
    };
};
