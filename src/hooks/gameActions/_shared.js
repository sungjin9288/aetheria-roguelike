import { BALANCE, CONSTANTS } from '../../data/constants';
import { CLASSES } from '../../data/classes';
import { getDailyProtocolCompletions, formatDailyProtocolReward, makeEmitTitles } from '../../utils/gameUtils';
import { MSG } from '../../data/messages';
import { AT } from '../../reducers/actionTypes';
import { advanceExploreState } from '../../utils/explorationPacing';
import { SEASON_XP } from '../../data/seasonPass';
import { resetDailyProtocolIfNeeded, resetWeeklyProtocolIfNeeded } from '../../utils/exploreUtils';

/**
 * 클래스 기반 HP/MP 최대치 계산
 */
export const buildClassVitals = (level, jobId, meta = {}) => {
    const cls = CLASSES[jobId] || CLASSES[CONSTANTS.DEFAULT_JOB];
    const maxHp = Math.floor(CONSTANTS.START_HP * cls.hpMod) + Math.max(0, level - 1) * BALANCE.HP_PER_LEVEL + (meta.bonusHp || 0);
    const maxMp = Math.floor(CONSTANTS.START_MP * cls.mpMod) + Math.max(0, level - 1) * BALANCE.MP_PER_LEVEL + (meta.bonusMp || 0);
    return { maxHp, maxMp };
};

/**
 * 공유 헬퍼 팩토리 — emitUnlockedTitles, emitDailyProtocolLogs, commitExploreOutcome
 */
export const makeSharedHelpers = ({ player, dispatch, addLog }) => {
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);

    const emitDailyProtocolLogs = (type, amount = 1) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission) => {
            addLog('system', MSG.DAILY_PROTOCOL_DONE(formatDailyProtocolReward(mission.reward)));
        });
    };

    const commitExploreOutcome = (outcome, transformPlayer = null) => {
        resetDailyProtocolIfNeeded(player, dispatch);
        resetWeeklyProtocolIfNeeded(player, dispatch);
        dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'explores' } });
        dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'explores' } });
        emitDailyProtocolLogs('explores', 1);
        dispatch({ type: 'ADD_SEASON_XP', payload: SEASON_XP.explore });
        dispatch({
            type: 'SET_PLAYER',
            payload: (currentPlayer) => {
                let nextPlayer = {
                    ...currentPlayer,
                    stats: {
                        ...(currentPlayer.stats || {}),
                        explores: (currentPlayer.stats?.explores || 0) + 1,
                        discoveries: ['narrative_event', 'relic_found', 'anomaly', 'key_event'].includes(outcome)
                            ? (currentPlayer.stats?.discoveries || 0) + 1
                            : (currentPlayer.stats?.discoveries || 0),
                        exploreState: advanceExploreState(currentPlayer.stats, outcome),
                    }
                };
                if (typeof transformPlayer === 'function') {
                    nextPlayer = transformPlayer(nextPlayer) || nextPlayer;
                }
                return nextPlayer;
            }
        });
    };

    return { emitUnlockedTitles, emitDailyProtocolLogs, commitExploreOutcome };
};
