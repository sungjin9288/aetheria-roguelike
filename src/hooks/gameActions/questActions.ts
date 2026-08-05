import { AT } from '../../reducers/actionTypes';
import { getGravesAtLoc, removeGravesAtLoc, resolveGraveRecovery } from '../../utils/graveUtils.js';
import { getPreparedExpeditionFocusQuestIds } from '../../utils/expeditionMissionFocus.js';

export const createQuestActions = (deps: any, { emitUnlockedTitles }: any) => {
    const { player, grave, dispatch, addLog } = deps;
    return {
        acceptQuest: (qId: any) => {
            dispatch({ type: AT.ACCEPT_QUEST, payload: { questId: qId } });
        },

        abandonQuest: (qId: any) => {
            dispatch({ type: AT.ABANDON_QUEST, payload: { questId: qId } });
        },

        lootGrave: () => {
            const gravesAtLoc = getGravesAtLoc(grave, player.loc);
            if (gravesAtLoc.length === 0) return;
            const { updatedPlayer, logMsg } = resolveGraveRecovery(player, gravesAtLoc);
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            dispatch({ type: AT.SET_GRAVE, payload: removeGravesAtLoc(grave, player.loc) });
            addLog('success', logMsg);
        },

        requestBounty: () => {
            dispatch({
                type: AT.REQUEST_BOUNTY,
                payload: { requestedAt: Date.now(), seed: Math.random() },
            });
        },

        toggleExpeditionFocusQuest: (qId: string | number) => {
            const selected = getPreparedExpeditionFocusQuestIds(player);
            const isSelected = selected.some((id) => String(id) === String(qId));
            dispatch({
                type: AT.UPDATE_EXPEDITION_FOCUS_QUEST,
                payload: { questId: qId, selected: !isSelected },
            });
        },
    };
};
