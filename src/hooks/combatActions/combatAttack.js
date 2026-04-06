import { CombatEngine } from '../../systems/CombatEngine';
import { INITIAL_STATE } from '../../reducers/gameReducer';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { BALANCE } from '../../data/constants';
import { getJobSkills, buildRunSummary } from '../../utils/gameUtils';
import { pushBattleRecord, makeBattleRecord } from '../../systems/DifficultyManager';
import { appendGrave } from '../../utils/graveUtils.js';
import { getSelectedSkill } from './_helpers';
import { handleVictoryOutcome } from './combatVictory';

export const createCombatAttackActions = (deps, { emitDailyProtocolLogs, emitUnlockedTitles }, pendingRef) => {
    const { player, gameState, enemy, grave, dispatch, addLog, addStoryLog, getFullStats } = deps;

    return {
        combat: (type) => {
            if (pendingRef.current) { clearTimeout(pendingRef.current); pendingRef.current = null; }
            if (gameState !== GS.COMBAT || !enemy) return addLog('error', MSG.COMBAT_NOT_IN_BATTLE);

            const stats = getFullStats();
            const playerAtActionStart = player;
            const enemyAtActionStart = enemy;

            if (type === 'attack' || type === 'skill') {
                let result;
                let playerAfterAction = playerAtActionStart;

                if (type === 'skill') {
                    let selected = getSelectedSkill(playerAtActionStart);
                    if (playerAtActionStart.challengeModifiers?.includes('randomSkills')) {
                        const allSkills = getJobSkills(playerAtActionStart);
                        if (allSkills.length > 0) {
                            const randomSkill = allSkills[Math.floor(Math.random() * allSkills.length)];
                            selected = { skill: randomSkill, index: 0, total: allSkills.length };
                            addLog('warn', `혼돈의 기술: [${randomSkill.name}] 발동!`);
                        }
                    }
                    result = CombatEngine.performSkill(playerAtActionStart, enemyAtActionStart, stats, selected?.skill);
                    if (!result.success) return addLog('error', result.logs[0]?.text || MSG.SKILL_NO_MP);
                    playerAfterAction = result.updatedPlayer;
                    dispatch({ type: AT.SET_PLAYER, payload: result.updatedPlayer });
                    if (result.forceEscape) {
                        result.logs.forEach((log) => addLog(log.type, log.text));
                        dispatch({ type: AT.SET_ENEMY, payload: null });
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                        return;
                    }
                } else {
                    result = CombatEngine.attack(playerAtActionStart, enemyAtActionStart, stats);
                    playerAfterAction = result.updatedPlayer;
                    dispatch({ type: AT.SET_PLAYER, payload: result.updatedPlayer });
                }

                result.logs.forEach((log) => addLog(log.type, log.text));
                dispatch({ type: AT.SET_VISUAL_EFFECT, payload: null });

                if (result.isVictory) {
                    dispatch({ type: AT.SET_ENEMY, payload: null });
                    dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                    const { earlyReturn } = handleVictoryOutcome({
                        playerAfterCombat: playerAfterAction,
                        deadEnemy: enemyAtActionStart,
                        stats, dispatch, addLog, addStoryLog,
                        emitDailyProtocolLogs, emitUnlockedTitles,
                        extendedChecks: true,
                    });
                    if (earlyReturn) return;
                    return;
                }

                dispatch({ type: AT.SET_ENEMY, payload: result.updatedEnemy });

                // extraTurnGranted — 시간술사 효과 → 적 턴 스킵
                if (playerAfterAction.extraTurnGranted) {
                    dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, extraTurnGranted: false }) });
                    return;
                }

                pendingRef.current = setTimeout(() => {
                    pendingRef.current = null;
                    const turnTick = CombatEngine.tickCombatState(playerAfterAction);
                    turnTick.logs.forEach((log) => addLog(log.type, log.text));
                    const playerForEnemyTurn = turnTick.updatedPlayer;
                    dispatch({ type: AT.SET_PLAYER, payload: playerForEnemyTurn });

                    const counterResult = CombatEngine.enemyAttack(playerForEnemyTurn, result.updatedEnemy, stats);
                    counterResult.logs.forEach((log) => addLog(log.type, log.text));
                    dispatch({ type: AT.SET_ENEMY, payload: counterResult.updatedEnemy });
                    dispatch({ type: AT.SET_PLAYER, payload: counterResult.updatedPlayer });
                    dispatch({ type: AT.SET_VISUAL_EFFECT, payload: counterResult.isCrit ? 'shake' : null });

                    // DoT로 적 사망
                    if (counterResult.isEnemyDead) {
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                        dispatch({ type: AT.SET_ENEMY, payload: null });
                        addLog('success', `[지속 피해] ${result.updatedEnemy.name}이(가) 쓰러졌습니다!`);
                        handleVictoryOutcome({
                            playerAfterCombat: counterResult.updatedPlayer,
                            deadEnemy: result.updatedEnemy,
                            stats, dispatch, addLog, addStoryLog,
                            emitDailyProtocolLogs, emitUnlockedTitles,
                            extendedChecks: false,
                        });
                        return;
                    }

                    if (counterResult.isDead) {
                        const deadPlayer = { ...counterResult.updatedPlayer, killStreak: 0 };
                        const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                        const deathRecordPlayer = { ...defeatResult.updatedPlayer, stats: pushBattleRecord(defeatResult.updatedPlayer.stats, makeBattleRecord('death', 0)) };
                        dispatch({ type: AT.SET_RUN_SUMMARY, payload: buildRunSummary(deadPlayer, playerForEnemyTurn.loc) });
                        dispatch({ type: AT.SET_GRAVE, payload: appendGrave(grave, defeatResult.graveData) });
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
                    const escHpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 1);
                    dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, stats: pushBattleRecord(p.stats, makeBattleRecord('escape', escHpRatio)) }) });
                    dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                    dispatch({ type: AT.SET_ENEMY, payload: null });
                } else {
                    const protectionLogs = [];
                    const protectedResult = CombatEngine.applyFatalProtection(player, stats.relics || [], escapeResult.damage || 0, protectionLogs);
                    protectionLogs.forEach((log) => addLog(log.type, log.text));
                    if (protectedResult.isDead) {
                        const deadPlayer = { ...protectedResult.updatedPlayer, killStreak: 0 };
                        const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                        dispatch({ type: AT.SET_RUN_SUMMARY, payload: buildRunSummary(deadPlayer, deadPlayer.loc) });
                        dispatch({ type: AT.SET_GRAVE, payload: appendGrave(grave, defeatResult.graveData) });
                        dispatch({ type: AT.SET_PLAYER, payload: defeatResult.updatedPlayer });
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.DEAD });
                        dispatch({ type: AT.SET_ENEMY, payload: null });
                        emitUnlockedTitles(defeatResult.updatedPlayer);
                        defeatResult.logs.forEach((log) => addLog(log.type, log.text));
                        addStoryLog('death', { loc: player.loc });
                    } else {
                        dispatch({ type: AT.SET_PLAYER, payload: protectedResult.updatedPlayer });
                    }
                }
            }
        },
    };
};
