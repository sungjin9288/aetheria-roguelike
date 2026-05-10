import { DB } from '../../data/db';
import { CLASSES } from '../../data/classes';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getJobSkills } from '../../utils/gameUtils';
import { soundManager } from '../../systems/SoundManager';
import { buildClassVitals } from './_shared';

export const createCharacterActions = (deps: any, { emitUnlockedTitles, emitDailyProtocolLogs }: any) => {
    const { player, gameState, dispatch, addLog, addStoryLog, getFullStats } = deps;
    return {
        // cycle 566: gender / jobId / challengeModifiers 3 defaults 제거 —
        //   1 production caller (IntroScreen:49 onStart?.(selectedName, 'male',
        //   '모험가', selectedChallenges)) 4 args 명시 전달이라 모든 default
        //   도달 불가. body의 Array.isArray(challengeModifiers) defensive
        //   guard 보존. 청소 메가 시리즈 59번째 single-cycle 3-default batch.
        start: (name: any, gender: any, jobId: any, challengeModifiers: any) => {
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
                const labels = mods.map((id: any) => BALANCE.CHALLENGE_MODIFIERS.find((m: any) => m.id === id)?.label || id);
                addLog('warn', MSG.CHALLENGE_START(labels));
            }
        },

        // cycle 535: dir default 1 제거 — 2 callsite (commandParser:80,
        //   CombatPanel:113) 모두 1 명시 전달이라 default 도달 불가. util
        //   /component/hook default 청소 메가 시리즈 31번째 (cycle 502-534).
        cycleSkill: (dir: any) => {
            const skills = getJobSkills(player);
            if (!skills.length) return;
            const current = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout.selected : 0;
            const next = ((current + dir) % skills.length + skills.length) % skills.length;
            dispatch({
                type: AT.SET_PLAYER,
                payload: { skillLoadout: { selected: next, cooldowns: { ...(player.skillLoadout?.cooldowns || {}) } } }
            });
        },

        // cycle 56: 직접 skill 이름으로 선택 (UI에서 카드 탭 → 즉시 활성).
        selectSkill: (skillName: any) => {
            const skills = getJobSkills(player);
            if (!skills.length) return;
            const idx = skills.findIndex((s: any) => s.name === skillName);
            if (idx < 0) return;
            dispatch({
                type: AT.SET_PLAYER,
                payload: { skillLoadout: { selected: idx, cooldowns: { ...(player.skillLoadout?.cooldowns || {}) } } }
            });
        },

        rest: () => {
            if (gameState !== 'idle') return;
            const mapData = DB.MAPS[player.loc];
            if (!mapData || mapData.type !== 'safe') return addLog('error', MSG.REST_SAFE_ONLY);
            const restCost = Math.floor(BALANCE.REST_COST * (1 + (player.level || 1) / 20));
            if (player.gold < restCost) return addLog('error', MSG.REST_GOLD_INSUFFICIENT(restCost));
            const stats = getFullStats();
            // cycle 112: rest 시 player.status 정리 — cycle 106-110에서 활성화된 5종 status
            // (bleed/freeze/stun/curse/blind/fear)를 안전지대 휴식으로 해소. 며칠간의 회복
            // 자연스러운 의미 + cure item이 없는 status(bleed/blind/fear/stun)에 대한
            // UX 안전망. tempBuff은 turn-based라 그대로 유지.
            const updatedPlayer: Record<string, any> = {
                ...player,
                gold: player.gold - restCost,
                hp: stats.maxHp,
                mp: stats.maxMp,
                status: [],
                stats: { ...(player.stats || {}), rests: (player.stats?.rests || 0) + 1 }
            };
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: restCost } });
            emitDailyProtocolLogs('goldSpend', restCost);
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.REST_DONE_FULL(restCost));
            // cycle 219: rest 회복 sensory cue — ascending arpeggio (C5→E5→G5) 정의 있으나
            //   dispatch 0건이던 dead path. 안전지대 휴식 모먼트의 audio reflection.
            soundManager.play('heal');
            addStoryLog('rest', { loc: player.loc });
        },

        swapSkillChoice: (skillName: any, newChoice: any) => {
            if (gameState !== 'idle') return;
            const mapData = DB.MAPS[player.loc];
            if (!mapData || mapData.type !== 'safe') return addLog('error', MSG.SKILL_SWAP_SAFE_ONLY);
            const cost = BALANCE.SKILL_SWAP_COST || 50;
            if ((player.gold || 0) < cost) return addLog('error', MSG.SKILL_SWAP_GOLD_INSUFFICIENT(cost));
            const classData = CLASSES[player.job];
            const branches = classData?.skillBranches?.[skillName];
            if (!branches) return addLog('error', MSG.SKILL_NO_BRANCH);
            const branch = branches.find((b: any) => b.choice === newChoice);
            if (!branch) return addLog('error', MSG.SKILL_INVALID_BRANCH);
            const oldChoice = player.skillChoices?.[skillName] || '기본';
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: any) => ({
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

        jobChange: (jobName: any) => {
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
