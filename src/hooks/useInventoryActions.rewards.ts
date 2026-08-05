import { AT } from '../reducers/actionTypes';
import { getCurrentWeeklyProtocol, getWeeklyMissionRows } from '../utils/protocolCycle';

/**
 * createRewardActions — 보상 수령 도메인 (퀘스트/업적/주간/시즌패스).
 *   UI는 수령할 식별자만 전달하고, 실제 검증과 지급은 reducer가 최신 state에서 처리한다.
 */
export const createRewardActions = (ctx: any) => {
    const { player, dispatch } = ctx;

    return ({

        completeQuest: (qId: any) => {
            dispatch({ type: AT.CLAIM_QUEST_REWARD, payload: { questId: qId } });
        },

        claimAchievement: (achId: any) => {
            dispatch({ type: AT.CLAIM_ACHIEVEMENT_REWARD, payload: { achievementId: achId } });
        },

        // ── 주간 미션 수령 ────────────────────────────────────────────────
        claimWeeklyMission: (missionId: any) => {
            const weeklyProtocol = getCurrentWeeklyProtocol(player.weeklyProtocol, new Date());
            const mission = getWeeklyMissionRows(weeklyProtocol).find((entry: any) => entry.id === missionId);
            if (!mission?.done || mission.claimed) return;

            dispatch({ type: AT.CLAIM_WEEKLY_MISSION, payload: { missionId } });
        },

        // ── 시즌 여정 수령 ──────────────────────────────────────────────
        claimSeasonReward: (tier: any) => {
            dispatch({ type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
        },
    });
};
