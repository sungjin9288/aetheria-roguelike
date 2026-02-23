import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { CombatEngine } from '../systems/CombatEngine';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { getJobSkills, makeItem, findItemByName } from '../utils/gameUtils';
import { checkMilestones } from '../utils/gameUtils';

const getSelectedSkill = (player) => {
    const skills = getJobSkills(player);
    if (!skills.length) return null;
    const selected = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout.selected : 0;
    const index = ((selected % skills.length) + skills.length) % skills.length;
    return { skill: skills[index], index, total: skills.length };
};

/**
 * createCombatActions — 전투 로직 (공격, 스킬, 도주)
 */
export const createCombatActions = ({ player, gameState, enemy, dispatch, addLog, addStoryLog, getFullStats }) => ({

    combat: (type) => {
        if (gameState !== 'combat' || !enemy) return addLog('error', '전투 상태가 아닙니다.');
        const stats = getFullStats();
        const playerAtActionStart = player;
        const enemyAtActionStart = enemy;

        if (type === 'attack' || type === 'skill') {
            let result;
            let playerAfterAction = playerAtActionStart;

            if (type === 'skill') {
                const selected = getSelectedSkill(playerAtActionStart);
                result = CombatEngine.performSkill(playerAtActionStart, enemyAtActionStart, stats, selected?.skill);
                if (!result.success) return addLog('error', result.logs[0]?.text || '스킬 사용 실패');
                playerAfterAction = result.updatedPlayer;
                dispatch({ type: 'SET_PLAYER', payload: result.updatedPlayer });
            } else {
                result = CombatEngine.attack(playerAtActionStart, enemyAtActionStart, stats);
            }

            result.logs.forEach((log) => addLog(log.type, log.text));
            dispatch({ type: 'SET_VISUAL_EFFECT', payload: result.isCrit ? 'shake' : null });

            if (result.isVictory) {
                dispatch({ type: 'SET_ENEMY', payload: null });
                dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });

                const victoryResult = CombatEngine.handleVictory(playerAfterAction, enemyAtActionStart);
                let updatedPlayer = victoryResult.updatedPlayer;
                victoryResult.logs.forEach((log) => addLog(log.type, log.text));
                if (victoryResult.visualEffect) dispatch({ type: 'SET_VISUAL_EFFECT', payload: victoryResult.visualEffect });

                const questResult = CombatEngine.updateQuestProgress(updatedPlayer, enemyAtActionStart.baseName || enemyAtActionStart.name);
                updatedPlayer = { ...updatedPlayer, quests: questResult.updatedQuests };
                if (questResult.completedCount > 0) {
                    addLog('system', `퀘스트 조건 달성: ${questResult.completedCount}개`);
                }

                const lootResult = CombatEngine.processLoot(enemyAtActionStart);
                lootResult.logs.forEach((log) => addLog(log.type, log.text));
                if (lootResult.items.length > 0) {
                    updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, ...lootResult.items] };
                }

                // 마일스톤 보상 처리 (checkMilestones 연결)
                const baseName = CombatEngine.resolveEnemyBaseName(enemyAtActionStart);
                const milestoneRewards = checkMilestones(
                    updatedPlayer.stats?.killRegistry || {},
                    baseName
                );
                if (milestoneRewards.length > 0) {
                    milestoneRewards.forEach((reward) => {
                        addLog('event', reward.msg);
                        if (reward.type === 'gold') {
                            updatedPlayer = { ...updatedPlayer, gold: updatedPlayer.gold + reward.val };
                        } else if (reward.type === 'item') {
                            const itemDef = findItemByName(reward.val);
                            if (itemDef) updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, makeItem(itemDef)] };
                        }
                    });
                }

                if (updatedPlayer.loc === '혼돈의 심연') {
                    const currentDepth = updatedPlayer.stats?.abyssFloor || 1;
                    updatedPlayer = {
                        ...updatedPlayer,
                        stats: {
                            ...(updatedPlayer.stats || {}),
                            abyssFloor: currentDepth + 1
                        }
                    };
                    addLog('system', `심연의 더 깊은 곳으로 진입했습니다. (현재: ${currentDepth + 1}층)`);
                }

                dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
                addStoryLog('victory', { name: enemyAtActionStart.name });

                // PostCombatCard 데이터 전달
                dispatch({
                    type: 'SET_POST_COMBAT_RESULT', payload: {
                        enemy: enemyAtActionStart.name,
                        exp: victoryResult.expGained || 0,
                        gold: victoryResult.goldGained || 0,
                        loot: lootResult.items.map(i => i.name),
                        playerHp: updatedPlayer.hp,
                        playerMaxHp: updatedPlayer.maxHp,
                        playerInvCount: updatedPlayer.inv.length,
                    }
                });
                return;
            }

            dispatch({ type: 'SET_ENEMY', payload: result.updatedEnemy });

            setTimeout(() => {
                const turnTick = CombatEngine.tickCombatState(playerAfterAction);
                turnTick.logs.forEach((log) => addLog(log.type, log.text));
                const playerForEnemyTurn = turnTick.updatedPlayer;
                dispatch({ type: 'SET_PLAYER', payload: playerForEnemyTurn });

                const counterResult = CombatEngine.enemyAttack(playerForEnemyTurn, result.updatedEnemy, stats);
                counterResult.logs.forEach((log) => addLog(log.type, log.text));
                dispatch({ type: 'SET_ENEMY', payload: counterResult.updatedEnemy });
                dispatch({ type: 'SET_PLAYER', payload: counterResult.updatedPlayer });
                dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });

                if (counterResult.isDead) {
                    const defeatResult = CombatEngine.handleDefeat(counterResult.updatedPlayer, INITIAL_STATE.player);
                    dispatch({ type: 'SET_GRAVE', payload: defeatResult.graveData });
                    dispatch({ type: 'SET_PLAYER', payload: defeatResult.updatedPlayer });
                    dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
                    dispatch({ type: 'SET_ENEMY', payload: null });
                    defeatResult.logs.forEach((log) => addLog(log.type, log.text));
                    addStoryLog('death', { loc: playerForEnemyTurn.loc });
                }
            }, BALANCE.ENEMY_TURN_DELAY_MS);
            return;
        }

        if (type === 'escape') {
            const escapeResult = CombatEngine.attemptEscape(enemy, stats);
            escapeResult.logs.forEach((log) => addLog(log.type, log.text));
            if (escapeResult.success) {
                dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
                dispatch({ type: 'SET_ENEMY', payload: null });
            } else {
                const escapedHp = Math.max(0, player.hp - (escapeResult.damage || 0));
                if (escapedHp <= 0) {
                    const defeatResult = CombatEngine.handleDefeat({ ...player, hp: escapedHp }, INITIAL_STATE.player);
                    dispatch({ type: 'SET_GRAVE', payload: defeatResult.graveData });
                    dispatch({ type: 'SET_PLAYER', payload: defeatResult.updatedPlayer });
                    dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
                    dispatch({ type: 'SET_ENEMY', payload: null });
                    defeatResult.logs.forEach((log) => addLog(log.type, log.text));
                    addStoryLog('death', { loc: player.loc });
                } else {
                    dispatch({
                        type: 'SET_PLAYER',
                        payload: (p) => ({ ...p, hp: escapedHp })
                    });
                }
            }
        }
    },

    getSelectedSkill: () => getSelectedSkill(player)?.skill || null
});
