import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { INITIAL_STATE } from '../../reducers/gameReducer';
import { getAscensionOutcome } from '../../utils/ascensionPreview';

// cycle 315: _shared?: any 미사용 2번째 파라미터 제거 — ascensionActions에서 shared 헬퍼 사용 0건.
//   useGameActions에서 createAscensionActions(deps, shared) 호출하지만 extra arg는 무시되어 동작 동일.
export const createAscensionActions = (deps: any) => {
    const { player, dispatch, addLog } = deps;
    return {
        confirmAscension: () => {
            const outcome = getAscensionOutcome(player.meta);
            const projectedPlayer: Record<string, any> = {
                ...INITIAL_STATE.player,
                name: player.name,
                gender: player.gender,
                meta: outcome.meta,
                titles: [...new Set([...(player.titles || []), outcome.title])],
                activeTitle: outcome.title,
                stats: {
                    ...INITIAL_STATE.player.stats,
                    kills: player.stats.kills,
                    bossKills: player.stats.bossKills,
                    deaths: player.stats.deaths,
                    total_gold: player.stats.total_gold,
                    relicCount: player.stats.relicCount,
                    abyssFloor: player.stats.abyssFloor,
                    abyssRecord: player.stats.abyssRecord || 0,
                    demonKingSlain: (player.stats.demonKingSlain || 0) + 1,
                    bountiesCompleted: player.stats.bountiesCompleted,
                    crafts: player.stats.crafts,
                }
            };
            const ascensionTitles = checkTitles(projectedPlayer);
            dispatch({ type: AT.ASCEND, payload: { meta: outcome.meta, newTitle: outcome.title } });
            if (ascensionTitles.length > 0) {
                dispatch({ type: AT.UNLOCK_TITLES, payload: ascensionTitles });
                ascensionTitles.forEach((id: any) => addLog('system', MSG.TITLE_UNLOCKED(getTitleLabel(id))));
            }
            addLog('system', MSG.ASCEND_DONE(outcome.nextRank, outcome.title));
        },

        cancelAscension: () => {
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            addLog('info', MSG.ASCEND_CANCEL);
        },
    };
};
