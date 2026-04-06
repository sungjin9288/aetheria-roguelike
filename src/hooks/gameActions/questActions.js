import { DB } from '../../data/db';
import { BALANCE } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import { getGravesAtLoc, removeGravesAtLoc, resolveGraveRecovery } from '../../utils/graveUtils.js';

export const createQuestActions = (deps, { emitUnlockedTitles }) => {
    const { player, grave, dispatch, addLog } = deps;
    return {
        acceptQuest: (qId) => {
            if (DB.MAPS[player.loc]?.type !== 'safe') return addLog('error', MSG.QUEST_TOWN_ONLY);
            if (player.quests.some((q) => q.id === qId)) return addLog('error', MSG.QUEST_ALREADY_ACCEPTED);
            const qData = DB.QUESTS.find((q) => q.id === qId);
            if (!qData) return;
            if (player.level < (qData.minLv || 1)) return addLog('error', MSG.QUEST_LEVEL_REQUIRED(qData.minLv));
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p) => ({
                    ...p,
                    quests: [...p.quests, { id: qId, progress: qData.target === 'Level' ? p.level : 0 }]
                })
            });
            addLog('event', MSG.QUEST_ACCEPTED(qData.title));
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
            if (player.quests.some(q => q.isBounty)) return addLog('error', MSG.BOUNTY_ALREADY_ACTIVE);
            const today = new Date().toISOString().slice(0, 10);
            if (player.stats?.bountyDate === today && player.stats?.bountyIssued) {
                return addLog('error', MSG.BOUNTY_DAILY_LIMIT);
            }
            const validMonsters = [];
            Object.values(DB.MAPS).forEach(m => {
                if (m.level !== 'infinite' && m.level <= player.level + 5 && m.level >= Math.max(1, player.level - 10) && !m.boss) {
                    validMonsters.push(...(m.monsters || []));
                }
            });
            if (!validMonsters.length) validMonsters.push('슬라임');
            const target = validMonsters[Math.floor(Math.random() * validMonsters.length)];
            const count = BALANCE.BOUNTY_MIN_COUNT + Math.floor(Math.random() * BALANCE.BOUNTY_COUNT_RANGE);
            const bId = `bounty_${Date.now()}`;
            const newBounty = {
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
                payload: (p) => ({
                    ...p,
                    quests: [...p.quests, newBounty],
                    stats: { ...(p.stats || {}), bountyDate: today, bountyIssued: true }
                })
            });
            addLog('event', MSG.BOUNTY_ACCEPTED_NEW(target, count));
        },
    };
};
