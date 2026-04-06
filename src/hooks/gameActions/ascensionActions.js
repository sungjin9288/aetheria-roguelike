import { BALANCE } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { PRESTIGE_TITLES } from '../../data/titles';
import { INITIAL_STATE } from '../../reducers/gameReducer';

export const createAscensionActions = (deps, { emitUnlockedTitles: _emitUnlockedTitles }) => {
    const { player, dispatch, addLog } = deps;
    return {
        confirmAscension: () => {
            const meta = player.meta || {};
            const rank = (meta.prestigeRank || 0) + 1;
            const newMeta = {
                ...meta,
                prestigeRank: rank,
                essence: (meta.essence || 0) + 200,
                bonusAtk:  (meta.bonusAtk  || 0) + BALANCE.PRESTIGE_ATK_BONUS,
                bonusHp:   (meta.bonusHp   || 0) + BALANCE.PRESTIGE_HP_BONUS,
                bonusMp:   (meta.bonusMp   || 0) + BALANCE.PRESTIGE_MP_BONUS,
                totalPrestigeAtk: (meta.totalPrestigeAtk || 0) + BALANCE.PRESTIGE_ATK_BONUS,
                totalPrestigeHp:  (meta.totalPrestigeHp  || 0) + BALANCE.PRESTIGE_HP_BONUS,
                totalPrestigeMp:  (meta.totalPrestigeMp  || 0) + BALANCE.PRESTIGE_MP_BONUS,
            };
            const title = PRESTIGE_TITLES[Math.min(rank - 1, PRESTIGE_TITLES.length - 1)];
            const projectedPlayer = {
                ...INITIAL_STATE.player,
                name: player.name,
                gender: player.gender,
                meta: newMeta,
                titles: [...new Set([...(player.titles || []), title])],
                activeTitle: title,
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
            dispatch({ type: AT.ASCEND, payload: { meta: newMeta, newTitle: title } });
            if (ascensionTitles.length > 0) {
                dispatch({ type: AT.UNLOCK_TITLES, payload: ascensionTitles });
                ascensionTitles.forEach((id) => addLog('system', MSG.TITLE_UNLOCKED(getTitleLabel(id))));
            }
            addLog('system', MSG.ASCEND_DONE(rank, title));
        },

        cancelAscension: () => {
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            addLog('info', MSG.ASCEND_CANCEL);
        },
    };
};
