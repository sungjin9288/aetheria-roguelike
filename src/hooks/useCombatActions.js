import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { CombatEngine } from '../systems/CombatEngine';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { getJobSkills, makeItem, findItemByName, checkMilestones, checkTitles, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold } from '../utils/gameUtils';

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
export const createCombatActions = ({ player, gameState, enemy, dispatch, addLog, addStoryLog, getFullStats }) => {
    let pendingEnemyTurn = null;
    const emitDailyProtocolLogs = (type, amount = 1) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission) => {
            addLog('system', `📋 일일 프로토콜 완료: ${formatDailyProtocolReward(mission.reward)}`);
        });
    };
    const emitUnlockedTitles = (updatedPlayer) => {
        const newTitles = checkTitles(updatedPlayer);
        if (newTitles.length > 0) {
            dispatch({ type: AT.UNLOCK_TITLES, payload: newTitles });
            newTitles.forEach((id) => addLog('system', `🏆 칭호 획득: [${id}]`));
        }
    };

    return {

    combat: (type) => {
        if (pendingEnemyTurn) { clearTimeout(pendingEnemyTurn); pendingEnemyTurn = null; }
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
                            updatedPlayer = grantGold(updatedPlayer, reward.val);
                        } else if (reward.type === 'item') {
                            const itemDef = findItemByName(reward.val);
                            if (itemDef) updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, makeItem(itemDef)] };
                        } else if (reward.type === 'title') {
                            updatedPlayer = {
                                ...updatedPlayer,
                                titles: [...new Set([...(updatedPlayer.titles || []), reward.val])]
                            };
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
                dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
                emitDailyProtocolLogs('kills', 1);
                emitUnlockedTitles(updatedPlayer);

                // 마왕 처치 → 에테르 환생
                if (victoryResult.isDemonKingSlain) {
                    dispatch({ type: 'SET_GAME_STATE', payload: 'ascension' });
                    addLog('system', '⚡ 마왕이 쓰러졌습니다. 에테르 환생의 문이 열렸습니다...');
                    return;
                }

                addStoryLog('victory', { name: enemyAtActionStart.name });

                // PostCombatCard 데이터 전달
                const droppedItems = lootResult.items.map((item) => item.name);
                const hpRatio = (updatedPlayer.hp || 0) / Math.max(1, updatedPlayer.maxHp || 1);
                const mpRatio = (updatedPlayer.mp || 0) / Math.max(1, updatedPlayer.maxMp || 1);

                dispatch({
                    type: 'SET_POST_COMBAT_RESULT', payload: {
                        enemy: enemyAtActionStart.name,
                        exp: victoryResult.expGained || 0,
                        gold: victoryResult.goldGained || 0,
                        items: droppedItems,
                        leveledUp: Boolean(victoryResult.leveledUp),
                        hpLow: hpRatio <= 0.35,
                        mpLow: mpRatio <= 0.3,
                        invFull: updatedPlayer.inv.length >= BALANCE.INV_MAX_SIZE,
                        playerHp: updatedPlayer.hp,
                        playerMaxHp: updatedPlayer.maxHp,
                        playerMp: updatedPlayer.mp,
                        playerMaxMp: updatedPlayer.maxMp,
                        playerInvCount: updatedPlayer.inv.length,
                    }
                });
                return;
            }

            dispatch({ type: 'SET_ENEMY', payload: result.updatedEnemy });

            pendingEnemyTurn = setTimeout(() => {
                pendingEnemyTurn = null;
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
                    const deadPlayer = counterResult.updatedPlayer;
                    const runSummary = {
                        level:        deadPlayer.level,
                        job:          deadPlayer.job || '모험가',
                        kills:        deadPlayer.stats?.kills || 0,
                        bossKills:    deadPlayer.stats?.bossKills || 0,
                        relicsFound:  deadPlayer.relics?.length || 0,
                        activeTitle:  deadPlayer.activeTitle || null,
                        loc:          playerForEnemyTurn.loc || '???',
                        prestigeRank: deadPlayer.meta?.prestigeRank || 0,
                        totalGold:    deadPlayer.stats?.total_gold || 0,
                    };
                    const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                    dispatch({ type: 'SET_RUN_SUMMARY', payload: runSummary });
                    dispatch({ type: 'SET_GRAVE', payload: defeatResult.graveData });
                    dispatch({ type: 'SET_PLAYER', payload: defeatResult.updatedPlayer });
                    dispatch({ type: 'SET_GAME_STATE', payload: 'dead' });
                    dispatch({ type: 'SET_ENEMY', payload: null });
                    emitUnlockedTitles(defeatResult.updatedPlayer);
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
                    const deadPlayer = { ...player, hp: escapedHp };
                    const runSummary = {
                        level:        deadPlayer.level,
                        job:          deadPlayer.job || '모험가',
                        kills:        deadPlayer.stats?.kills || 0,
                        bossKills:    deadPlayer.stats?.bossKills || 0,
                        relicsFound:  deadPlayer.relics?.length || 0,
                        activeTitle:  deadPlayer.activeTitle || null,
                        loc:          deadPlayer.loc || '???',
                        prestigeRank: deadPlayer.meta?.prestigeRank || 0,
                        totalGold:    deadPlayer.stats?.total_gold || 0,
                    };
                    const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                    dispatch({ type: 'SET_RUN_SUMMARY', payload: runSummary });
                    dispatch({ type: 'SET_GRAVE', payload: defeatResult.graveData });
                    dispatch({ type: 'SET_PLAYER', payload: defeatResult.updatedPlayer });
                    dispatch({ type: 'SET_GAME_STATE', payload: 'dead' });
                    dispatch({ type: 'SET_ENEMY', payload: null });
                    emitUnlockedTitles(defeatResult.updatedPlayer);
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
    };
};
