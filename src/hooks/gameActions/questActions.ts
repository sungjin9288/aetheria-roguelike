import { DB } from '../../data/db';
import { BALANCE } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import { getGravesAtLoc, removeGravesAtLoc, resolveGraveRecovery } from '../../utils/graveUtils.js';
import { getUnmetQuestPrerequisite } from '../../utils/questPrerequisites.js';
import { createQuestProgressState } from '../../utils/questProgress.js';
import {
    appendExpeditionFocusQuest,
    getPreparedExpeditionFocusQuestIds,
    MAX_EXPEDITION_FOCUS_QUESTS,
    removeExpeditionFocusQuest,
} from '../../utils/expeditionMissionFocus.js';

export const createQuestActions = (deps: any, { emitUnlockedTitles }: any) => {
    const { player, grave, dispatch, addLog } = deps;
    return {
        acceptQuest: (qId: any) => {
            if (DB.MAPS[player.loc]?.type !== 'safe') return addLog('error', MSG.QUEST_TOWN_ONLY);
            if (player.quests.some((q: any) => q.id === qId)) return addLog('error', MSG.QUEST_ALREADY_ACCEPTED);
            const qData = DB.QUESTS.find((q: any) => q.id === qId);
            if (!qData) return;
            const claimedQuestIds = Array.isArray(player.stats?.claimedQuestIds)
                ? player.stats.claimedQuestIds
                : [];
            if (claimedQuestIds.includes(qId)) return addLog('info', MSG.QUEST_ALREADY_COMPLETED);
            if (player.level < (qData.minLv || 1)) return addLog('error', MSG.QUEST_LEVEL_REQUIRED(qData.minLv));
            const unmetPrerequisite = getUnmetQuestPrerequisite(qData, claimedQuestIds, DB.QUESTS);
            if (unmetPrerequisite) return addLog('info', MSG.QUEST_PREREQUISITE_REQUIRED(unmetPrerequisite.title));
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: any) => {
                    const acceptedQuest = createQuestProgressState(qData, p);
                    return appendExpeditionFocusQuest({ ...p, quests: [...p.quests, acceptedQuest] }, qId);
                }
            });
            addLog('event', MSG.QUEST_ACCEPTED(qData.title));
        },

        abandonQuest: (qId: any) => {
            if (DB.MAPS[player.loc]?.type !== 'safe') return addLog('error', MSG.QUEST_ABANDON_TOWN_ONLY);

            const activeQuest = player.quests.find((quest: any) => quest.id === qId);
            if (!activeQuest) return;

            const questData = activeQuest.isBounty
                ? activeQuest
                : DB.QUESTS.find((quest: any) => quest.id === qId);
            if (!questData) return;
            if (activeQuest.progress >= questData.goal) {
                return addLog('info', MSG.QUEST_ABANDON_REWARD_PENDING);
            }

            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: any) => removeExpeditionFocusQuest({
                    ...p,
                    quests: p.quests.filter((quest: any) => quest.id !== qId),
                }, qId)
            });
            addLog('event', activeQuest.isBounty
                ? MSG.BOUNTY_ABANDONED
                : MSG.QUEST_ABANDONED(questData.title));
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
            if (DB.MAPS[player.loc]?.type !== 'safe') return addLog('error', MSG.BOUNTY_TOWN_ONLY);
            if (player.quests.some((q: any) => q.isBounty)) return addLog('error', MSG.BOUNTY_ALREADY_ACTIVE);
            const today = new Date().toISOString().slice(0, 10);
            if (player.stats?.bountyDate === today && player.stats?.bountyIssued) {
                return addLog('error', MSG.BOUNTY_DAILY_LIMIT);
            }
            const validMonsters: string[] = [];
            (Object.values(DB.MAPS) as any[]).forEach((m: any) => {
                if (m.level !== 'infinite' && m.level <= player.level + 5 && m.level >= Math.max(1, player.level - 10) && !m.boss) {
                    validMonsters.push(...(m.monsters || []));
                }
            });
            if (!validMonsters.length) validMonsters.push('슬라임');
            const target = validMonsters[Math.floor(Math.random() * validMonsters.length)];
            const count = BALANCE.BOUNTY_MIN_COUNT + Math.floor(Math.random() * BALANCE.BOUNTY_COUNT_RANGE);
            const bId = `bounty_${Date.now()}`;
            const newBounty: Record<string, any> = {
                id: bId,
                title: `[현상수배] ${target} 토벌`,
                desc: `${target} ${count}마리를 처치하라.`,
                target, goal: count, progress: 0, isBounty: true,
                reward: {
                    exp: Math.floor(count * player.level * BALANCE.BOUNTY_EXP_MULT),
                    gold: Math.floor(count * player.level * BALANCE.BOUNTY_GOLD_MULT),
                }
            };
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: any) => appendExpeditionFocusQuest({
                    ...p,
                    quests: [...p.quests, newBounty],
                    stats: { ...(p.stats || {}), bountyDate: today, bountyIssued: true }
                }, bId)
            });
            addLog('event', MSG.BOUNTY_ACCEPTED_NEW(target, count));
        },

        toggleExpeditionFocusQuest: (qId: string | number) => {
            if (DB.MAPS[player.loc]?.type !== 'safe' || player.activeExpedition) {
                return addLog('error', MSG.EXPEDITION_FOCUS_TOWN_ONLY);
            }
            const questState = player.quests.find((quest: any) => String(quest.id) === String(qId));
            if (!questState) return;
            const questData = questState.isBounty
                ? questState
                : DB.QUESTS.find((quest: any) => String(quest.id) === String(qId));
            if (!questData) return;

            const selected = getPreparedExpeditionFocusQuestIds(player);
            const selectedIndex = selected.findIndex((id) => String(id) === String(qId));
            if (selectedIndex >= 0 && selected.length === 1) {
                return addLog('info', MSG.EXPEDITION_FOCUS_REQUIRED);
            }
            if (selectedIndex < 0 && selected.length >= MAX_EXPEDITION_FOCUS_QUESTS) {
                return addLog('info', MSG.EXPEDITION_FOCUS_LIMIT);
            }

            const next = selectedIndex >= 0
                ? selected.filter((id) => String(id) !== String(qId))
                : [...selected, qId];
            dispatch({ type: AT.SET_EXPEDITION_FOCUS, payload: next });
            addLog('system', selectedIndex >= 0
                ? MSG.EXPEDITION_FOCUS_REMOVED(questData.title)
                : MSG.EXPEDITION_FOCUS_ADDED(questData.title));
        },
    };
};
