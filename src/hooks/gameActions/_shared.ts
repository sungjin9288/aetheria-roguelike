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
export const buildClassVitals = (level: any, jobId: any, meta: any = {}) => {
    const cls = CLASSES[jobId] || CLASSES[CONSTANTS.DEFAULT_JOB];
    const maxHp = Math.floor(CONSTANTS.START_HP * cls.hpMod) + Math.max(0, level - 1) * BALANCE.HP_PER_LEVEL + (meta.bonusHp || 0);
    const maxMp = Math.floor(CONSTANTS.START_MP * cls.mpMod) + Math.max(0, level - 1) * BALANCE.MP_PER_LEVEL + (meta.bonusMp || 0);
    return { maxHp, maxMp };
};

/**
 * 공유 헬퍼 팩토리 — emitUnlockedTitles, emitDailyProtocolLogs, commitExploreOutcome
 */
export const makeSharedHelpers = ({ player, dispatch, addLog }: any) => {
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);

    const emitDailyProtocolLogs = (type: any, amount: any = 1) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission: any) => {
            addLog('system', MSG.DAILY_PROTOCOL_DONE(formatDailyProtocolReward(mission.reward)));
        });
    };

    const commitExploreOutcome = (outcome: any, transformPlayer: any = null) => {
        resetDailyProtocolIfNeeded(player, dispatch);
        resetWeeklyProtocolIfNeeded(player, dispatch);
        dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'explores' } });
        dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'explores' } });
        emitDailyProtocolLogs('explores', 1);
        dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.explore });
        dispatch({
            type: AT.SET_PLAYER,
            payload: (currentPlayer: any) => {
                // cycle 84: stats.discoveries 누적 제거 — cycle 83에서 'discoveries' 시맨틱이
                // visitedMaps.length(맵 발견 수)로 통일되면서 이 이벤트 카운터는 어디서도
                // 읽히지 않는 dead write가 되었음. 안전하게 제거 (Firebase save에 잔존하는
                // discoveries 필드는 무시되므로 forward-compatible).
                let nextPlayer = {
                    ...currentPlayer,
                    stats: {
                        ...(currentPlayer.stats || {}),
                        explores: (currentPlayer.stats?.explores || 0) + 1,
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
