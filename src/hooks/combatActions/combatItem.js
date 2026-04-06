import { CombatEngine } from '../../systems/CombatEngine';
import { INITIAL_STATE } from '../../reducers/gameReducer';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { toArray, buildRunSummary } from '../../utils/gameUtils';
import { pushBattleRecord, makeBattleRecord } from '../../systems/DifficultyManager';
import { appendGrave } from '../../utils/graveUtils.js';
import { handleVictoryOutcome } from './combatVictory';

export const createCombatItemActions = (deps, { emitDailyProtocolLogs, emitUnlockedTitles }, pendingRef) => {
    const { player, gameState, enemy, grave, dispatch, addLog, addStoryLog, getFullStats } = deps;

    return {
        combatUseItem: (item) => {
            if (pendingRef.current) { clearTimeout(pendingRef.current); pendingRef.current = null; }
            if (gameState !== GS.COMBAT || !enemy) return addLog('error', MSG.COMBAT_NOT_IN_BATTLE);

            const inventoryItem = player.inv.find((entry) => entry.id === item?.id);
            if (!inventoryItem) return addLog('error', MSG.COMBAT_ITEM_NOT_FOUND);
            if (!['hp', 'mp', 'cure', 'buff'].includes(inventoryItem.type)) {
                return addLog('error', MSG.COMBAT_CONSUMABLE_ONLY);
            }

            let updatedPlayer = player;
            const stats = getFullStats(player);

            if (inventoryItem.type === 'hp') {
                updatedPlayer = { ...player, hp: Math.min(stats.maxHp, player.hp + (inventoryItem.val || 0)), inv: player.inv.filter((e) => e.id !== inventoryItem.id) };
                addLog('success', `${inventoryItem.name} 사용.`);
            } else if (inventoryItem.type === 'mp') {
                updatedPlayer = { ...player, mp: Math.min(stats.maxMp, player.mp + (inventoryItem.val || 0)), inv: player.inv.filter((e) => e.id !== inventoryItem.id) };
                addLog('success', `${inventoryItem.name} 사용.`);
            } else if (inventoryItem.type === 'cure') {
                updatedPlayer = { ...player, status: toArray(player.status).filter((s) => s !== inventoryItem.effect), inv: player.inv.filter((e) => e.id !== inventoryItem.id) };
                addLog('success', `${inventoryItem.name} 사용: 상태이상 해제`);
            } else if (inventoryItem.type === 'buff') {
                updatedPlayer = {
                    ...player,
                    tempBuff: {
                        atk: inventoryItem.effect === 'atk_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                        def: inventoryItem.effect === 'def_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                        turn: inventoryItem.turn || 3, name: inventoryItem.name
                    },
                    inv: player.inv.filter((e) => e.id !== inventoryItem.id)
                };
                addLog('success', `${inventoryItem.name} 사용: 버프 활성화`);
            }

            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });

            const turnTick = CombatEngine.tickCombatState(updatedPlayer);
            turnTick.logs.forEach((log) => addLog(log.type, log.text));
            const playerForEnemyTurn = turnTick.updatedPlayer;
            dispatch({ type: AT.SET_PLAYER, payload: playerForEnemyTurn });

            const counterStats = getFullStats(playerForEnemyTurn);
            const counterResult = CombatEngine.enemyAttack(playerForEnemyTurn, enemy, counterStats);
            counterResult.logs.forEach((log) => addLog(log.type, log.text));

            if (counterResult.isEnemyDead) {
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                dispatch({ type: AT.SET_ENEMY, payload: null });
                addLog('success', `[지속 피해] ${enemy.name}이(가) 쓰러졌습니다!`);
                handleVictoryOutcome({
                    playerAfterCombat: counterResult.updatedPlayer,
                    deadEnemy: enemy,
                    stats: counterStats, dispatch, addLog, addStoryLog,
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
                return;
            }

            dispatch({ type: AT.SET_ENEMY, payload: counterResult.updatedEnemy });
            dispatch({ type: AT.SET_PLAYER, payload: counterResult.updatedPlayer });
            dispatch({ type: AT.SET_VISUAL_EFFECT, payload: counterResult.isCrit ? 'shake' : null });
        },
    };
};
