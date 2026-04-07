import { DB } from '../../data/db';
import { CLASSES } from '../../data/classes';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getJobSkills } from '../../utils/gameUtils';
import { buildClassVitals } from './_shared';

export const createCharacterActions = (deps, { emitUnlockedTitles, emitDailyProtocolLogs }) => {
    const { player, gameState, dispatch, addLog, addStoryLog, getFullStats } = deps;
    return {
        start: (name, gender = 'male', jobId = CONSTANTS.DEFAULT_JOB, challengeModifiers = []) => {
            const trimmedName = String(name || '').trim().slice(0, 16);
            if (!trimmedName) return;
            const vitals = buildClassVitals(player.level || 1, jobId, player.meta || {});
            let maxHp = vitals.maxHp;
            let startGold = CONSTANTS.START_GOLD;
            const mods = Array.isArray(challengeModifiers) ? challengeModifiers : [];
            if (mods.includes('halfHp')) maxHp = Math.max(50, Math.floor(maxHp * 0.5));
            if (mods.includes('noGold')) startGold = 0;
            // Compute full starting HP/MP including passive skill bonuses for the chosen job
            const tempPlayer = { ...player, job: jobId, maxHp, maxMp: vitals.maxMp };
            const fullStartStats = getFullStats(tempPlayer);
            dispatch({ type: AT.SET_PLAYER, payload: {
                name: trimmedName, gender, job: jobId,
                maxHp, hp: fullStartStats.maxHp,
                maxMp: vitals.maxMp, mp: fullStartStats.maxMp,
                gold: startGold,
                challengeModifiers: mods,
                stats: { ...(player.stats || {}), visitedMaps: [CONSTANTS.START_LOCATION] }
            }});
            const cls = CLASSES[jobId] || CLASSES[CONSTANTS.DEFAULT_JOB];
            addLog('system', MSG.START_CALLSIGN(trimmedName));
            addLog('event', MSG.START_INITIAL_SKILL(cls.skills?.[0]?.name || '강타'));
            if (mods.length > 0) {
                const labels = mods.map(id => BALANCE.CHALLENGE_MODIFIERS.find(m => m.id === id)?.label || id);
                addLog('warn', MSG.CHALLENGE_START(labels));
            }
        },

        cycleSkill: (dir = 1) => {
            const skills = getJobSkills(player);
            if (!skills.length) return;
            const current = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout.selected : 0;
            const next = ((current + dir) % skills.length + skills.length) % skills.length;
            dispatch({
                type: AT.SET_PLAYER,
                payload: { skillLoadout: { selected: next, cooldowns: { ...(player.skillLoadout?.cooldowns || {}) } } }
            });
        },

        rest: () => {
            if (gameState !== 'idle') return;
            const mapData = DB.MAPS[player.loc];
            if (!mapData || mapData.type !== 'safe') return addLog('error', MSG.REST_SAFE_ONLY);
            const restCost = Math.floor(BALANCE.REST_COST * (1 + (player.level || 1) / 20));
            if (player.gold < restCost) return addLog('error', MSG.REST_GOLD_INSUFFICIENT(restCost));
            const stats = getFullStats();
            const updatedPlayer = {
                ...player,
                gold: player.gold - restCost,
                hp: stats.maxHp,
                mp: stats.maxMp,
                stats: { ...(player.stats || {}), rests: (player.stats?.rests || 0) + 1 }
            };
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: restCost } });
            emitDailyProtocolLogs('goldSpend', restCost);
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.REST_DONE_FULL(restCost));
            addStoryLog('rest', { loc: player.loc });
        },

        swapSkillChoice: (skillName, newChoice) => {
            if (gameState !== 'idle') return;
            const mapData = DB.MAPS[player.loc];
            if (!mapData || mapData.type !== 'safe') return addLog('error', MSG.SKILL_SWAP_SAFE_ONLY);
            const cost = BALANCE.SKILL_SWAP_COST || 50;
            if ((player.gold || 0) < cost) return addLog('error', MSG.SKILL_SWAP_GOLD_INSUFFICIENT(cost));
            const classData = CLASSES[player.job];
            const branches = classData?.skillBranches?.[skillName];
            if (!branches) return addLog('error', MSG.SKILL_NO_BRANCH);
            const branch = branches.find(b => b.choice === newChoice);
            if (!branch) return addLog('error', MSG.SKILL_INVALID_BRANCH);
            const oldChoice = player.skillChoices?.[skillName] || '기본';
            dispatch({
                type: AT.SET_PLAYER,
                payload: p => ({
                    ...p,
                    gold: (p.gold || 0) - cost,
                    skillChoices: { ...(p.skillChoices || {}), [skillName]: newChoice },
                }),
            });
            addLog('success', MSG.SKILL_SWAP(oldChoice, newChoice));
            addLog('info', MSG.SKILL_SWAP_COST(cost));
        },

        reset: () => {
            dispatch({ type: AT.RESET_GAME });
            addLog('system', MSG.INIT_RECORD_APPLIED);
        },

        jobChange: (jobName) => {
            const current = DB.CLASSES[player.job];
            if (!current?.next?.includes(jobName)) return addLog('error', MSG.JOB_CHANGE_INVALID);
            if (player.level < (DB.CLASSES[jobName]?.reqLv || 1)) return addLog('error', MSG.JOB_CHANGE_LEVEL);
            const vitals = buildClassVitals(player.level, jobName, player.meta || {});
            dispatch({
                type: AT.SET_PLAYER,
                payload: { job: jobName, maxHp: vitals.maxHp, hp: vitals.maxHp, maxMp: vitals.maxMp, mp: vitals.maxMp, skillLoadout: { selected: 0, cooldowns: {} } }
            });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            addLog('success', MSG.JOB_CHANGE_DONE(jobName));
        },
    };
};
