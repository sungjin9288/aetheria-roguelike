import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { CombatEngine } from '../systems/CombatEngine';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { GS } from '../reducers/gameStates';
import { getJobSkills, makeItem, findItemByName, checkMilestones, checkTitles, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, getTitleLabel, buildRunSummary } from '../utils/gameUtils';
import { getEquipmentProfile, getNextEquipmentState } from '../utils/equipmentUtils';
import { pushBattleRecord, makeBattleRecord } from '../systems/DifficultyManager';
import { getRunBuildProfile, getTraitLootHint, getTraitProfile } from '../utils/runProfileUtils';

const getSelectedSkill = (player) => {
    const skills = getJobSkills(player);
    if (!skills.length) return null;
    const selected = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout.selected : 0;
    const index = ((selected % skills.length) + skills.length) % skills.length;
    return { skill: skills[index], index, total: skills.length };
};

const getLootUpgradeHint = (equip = {}, lootItems = []) => {
    const equipmentDrops = (lootItems || []).filter((item) => ['weapon', 'armor', 'shield'].includes(item?.type));
    if (!equipmentDrops.length) return null;

    const currentProfile = getEquipmentProfile(equip);
    const currentAtk = currentProfile.mainAttack + currentProfile.offhandAttack;
    const currentDef = (equip.armor?.val || 0) + currentProfile.shieldDef;

    let bestHint = null;

    equipmentDrops.forEach((item) => {
        const nextEquip = getNextEquipmentState(equip, item);
        const nextProfile = getEquipmentProfile(nextEquip);
        const nextAtk = nextProfile.mainAttack + nextProfile.offhandAttack;
        const nextDef = (nextEquip.armor?.val || 0) + nextProfile.shieldDef;
        const critDelta = Math.round((nextProfile.critBonus - currentProfile.critBonus) * 100);
        const mpDelta = nextProfile.mpBonus - currentProfile.mpBonus;
        const atkDelta = nextAtk - currentAtk;
        const defDelta = nextDef - currentDef;
        const score = atkDelta + defDelta + (critDelta * 2) + Math.floor(mpDelta / 5);

        if (score <= 0) return;

        const summaryParts = [];
        if (atkDelta > 0) summaryParts.push(`ATK +${atkDelta}`);
        if (defDelta > 0) summaryParts.push(`DEF +${defDelta}`);
        if (critDelta > 0) summaryParts.push(`CRIT +${critDelta}%`);
        if (mpDelta > 0) summaryParts.push(`MP +${mpDelta}`);

        const candidate = {
            name: item.name,
            score,
            summary: summaryParts.join(' / ') || '장비 효율 상승',
        };

        if (!bestHint || candidate.score > bestHint.score) {
            bestHint = candidate;
        }
    });

    return bestHint;
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
            newTitles.forEach((id) => addLog('system', `🏆 칭호 획득: [${getTitleLabel(id)}]`));
        }
    };

    return {

    combat: (type) => {
        if (pendingEnemyTurn) { clearTimeout(pendingEnemyTurn); pendingEnemyTurn = null; }
        if (gameState !== GS.COMBAT || !enemy) return addLog('error', '전투 상태가 아닙니다.');
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
                playerAfterAction = result.updatedPlayer;
                dispatch({ type: 'SET_PLAYER', payload: result.updatedPlayer });
            }

            result.logs.forEach((log) => addLog(log.type, log.text));
            dispatch({ type: 'SET_VISUAL_EFFECT', payload: null });

            if (result.isVictory) {
                dispatch({ type: 'SET_ENEMY', payload: null });
                dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });

                const victoryResult = CombatEngine.handleVictory(playerAfterAction, enemyAtActionStart);
                let updatedPlayer = victoryResult.updatedPlayer;
                victoryResult.logs.forEach((log) => addLog(log.type, log.text));
                if (victoryResult.visualEffect) dispatch({ type: 'SET_VISUAL_EFFECT', payload: victoryResult.visualEffect });

                const questResult = CombatEngine.updateQuestProgress(updatedPlayer, enemyAtActionStart.baseName || enemyAtActionStart.name);
                updatedPlayer = { ...updatedPlayer, quests: questResult.updatedQuests };
                if (questResult.completedCount > 0) {
                    addLog('system', `퀘스트 조건 달성: ${questResult.completedCount}개`);
                }

                const lootResult = CombatEngine.processLoot(enemyAtActionStart, updatedPlayer);
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
                                titles: [...new Set([...(updatedPlayer.titles || []), reward.val])],
                                activeTitle: updatedPlayer.activeTitle || reward.val
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

                // Stage 3: 승리 전투 결과 기록
                const winHpRatio = (updatedPlayer.hp || 0) / Math.max(1, updatedPlayer.maxHp || 1);
                dispatch({
                    type: 'SET_PLAYER',
                    payload: (p) => ({
                        ...p,
                        stats: pushBattleRecord(p.stats, makeBattleRecord('win', winHpRatio))
                    })
                });

                // 마왕 처치 → 에테르 환생
                if (victoryResult.isDemonKingSlain) {
                    dispatch({ type: 'SET_GAME_STATE', payload: GS.ASCENSION });
                    addLog('system', '⚡ 마왕이 쓰러졌습니다. 에테르 환생의 문이 열렸습니다...');
                    return;
                }

                addStoryLog('victory', { name: enemyAtActionStart.name });

                // PostCombatCard 데이터 전달
                const droppedItems = lootResult.items.map((item) => item.name);
                const hpRatio = (updatedPlayer.hp || 0) / Math.max(1, updatedPlayer.maxHp || 1);
                const mpRatio = (updatedPlayer.mp || 0) / Math.max(1, updatedPlayer.maxMp || 1);
                const buildProfile = getRunBuildProfile(updatedPlayer, {
                    ...stats,
                    maxHp: updatedPlayer.maxHp,
                    maxMp: updatedPlayer.maxMp,
                });
                const traitProfile = getTraitProfile(updatedPlayer, {
                    ...stats,
                    maxHp: updatedPlayer.maxHp,
                    maxMp: updatedPlayer.maxMp,
                });
                const lootUpgradeHint = getLootUpgradeHint(updatedPlayer.equip, lootResult.items);
                const traitLootHint = getTraitLootHint(lootResult.items, traitProfile, updatedPlayer);

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
                        enemyTier: enemyAtActionStart.isBoss ? 'BOSS' : enemyAtActionStart.isElite ? 'ELITE' : 'NORMAL',
                        enemyWeakness: enemyAtActionStart.weakness || null,
                        enemyResistance: enemyAtActionStart.resistance || null,
                        difficultyLabel: enemyAtActionStart._diffLabel || null,
                        primaryBuild: buildProfile.primary.name,
                        buildTags: buildProfile.tags.map((tag) => tag.name).slice(0, 4),
                        upgradeHint: lootUpgradeHint,
                        traitHint: traitLootHint,
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
                dispatch({ type: 'SET_VISUAL_EFFECT', payload: counterResult.isCrit ? 'shake' : null });

                // DoT로 적이 사망한 경우 → 전투 승리 처리
                if (counterResult.isEnemyDead) {
                    dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
                    dispatch({ type: 'SET_ENEMY', payload: null });
                    addLog('success', `[지속 피해] ${result.updatedEnemy.name}이(가) 쓰러졌습니다!`);
                    const victoryResult = CombatEngine.handleVictory(counterResult.updatedPlayer, result.updatedEnemy);
                    victoryResult.logs.forEach((log) => addLog(log.type, log.text));
                    dispatch({ type: 'SET_PLAYER', payload: victoryResult.updatedPlayer });
                    dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
                    return;
                }

                if (counterResult.isDead) {
                    const deadPlayer = counterResult.updatedPlayer;
                    const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                    // Stage 3: 적 반격 사망 전투 결과 기록
                    const deathRecordPlayer = { ...defeatResult.updatedPlayer, stats: pushBattleRecord(defeatResult.updatedPlayer.stats, makeBattleRecord('death', 0)) };
                    dispatch({ type: AT.SET_RUN_SUMMARY, payload: buildRunSummary(deadPlayer, playerForEnemyTurn.loc) });
                    dispatch({ type: AT.SET_GRAVE, payload: defeatResult.graveData });
                    dispatch({ type: AT.SET_PLAYER, payload: deathRecordPlayer });
                    dispatch({ type: AT.SET_GAME_STATE, payload: GS.DEAD });
                    dispatch({ type: AT.SET_ENEMY, payload: null });
                    emitUnlockedTitles(deathRecordPlayer);
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
                // Stage 3: 도주 성공 전투 결과 기록
                const escHpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 1);
                dispatch({
                    type: 'SET_PLAYER',
                    payload: (p) => ({
                        ...p,
                        stats: pushBattleRecord(p.stats, makeBattleRecord('escape', escHpRatio))
                    })
                });
                dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
                dispatch({ type: 'SET_ENEMY', payload: null });
            } else {
                const protectionLogs = [];
                const protectedResult = CombatEngine.applyFatalProtection(player, stats.relics || [], escapeResult.damage || 0, protectionLogs);
                protectionLogs.forEach((log) => addLog(log.type, log.text));
                if (protectedResult.isDead) {
                    const deadPlayer = protectedResult.updatedPlayer;
                    const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                    dispatch({ type: AT.SET_RUN_SUMMARY, payload: buildRunSummary(deadPlayer, deadPlayer.loc) });
                    dispatch({ type: AT.SET_GRAVE, payload: defeatResult.graveData });
                    dispatch({ type: AT.SET_PLAYER, payload: defeatResult.updatedPlayer });
                    dispatch({ type: AT.SET_GAME_STATE, payload: GS.DEAD });
                    dispatch({ type: AT.SET_ENEMY, payload: null });
                    emitUnlockedTitles(defeatResult.updatedPlayer);
                    defeatResult.logs.forEach((log) => addLog(log.type, log.text));
                    addStoryLog('death', { loc: player.loc });
                } else {
                    dispatch({
                        type: 'SET_PLAYER',
                        payload: protectedResult.updatedPlayer
                    });
                }
            }
        }
    },

    getSelectedSkill: () => getSelectedSkill(player)?.skill || null
    };
};
