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
import { soundManager } from '../../systems/SoundManager';

export const createCombatAttackActions = (deps: any, { emitDailyProtocolLogs, emitUnlockedTitles }: any, pendingRef: any) => {
    const { player, gameState, enemy, grave, dispatch, addLog, addStoryLog, getFullStats, liveConfig } = deps;

    return {
        combat: (type: any) => {
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
                            // cycle 353: getSelectedSkill 반환 shape 단순화 후 동기화 (index/total 제거).
                            selected = { skill: randomSkill };
                            addLog('warn', MSG.COMBAT_CHAOS_SKILL(randomSkill.name));
                        }
                    }
                    result = CombatEngine.performSkill(playerAtActionStart, enemyAtActionStart, stats, selected?.skill);
                    if (!result.success) return addLog('error', result.logs[0]?.text || MSG.SKILL_NO_MP);
                    // cycle 219: 스킬 발동 sensory cue — sweep tone (600→1800→900Hz) 정의 있으나
                    //   dispatch 0건이던 dead path. 스킬 사용을 일반 공격과 청각적으로 차별화.
                    soundManager.play('skill');
                    playerAfterAction = result.updatedPlayer;
                    dispatch({ type: AT.SET_PLAYER, payload: result.updatedPlayer });
                    if (result.forceEscape) {
                        result.logs.forEach((log: any) => addLog(log.type, log.text));
                        // cycle 89: 도주 스킬(escape_100) 코드 패스를 cycle 74-88 escape feedback
                        // chain에 합류. 이전엔 forceEscape 분기가 단순 SET_ENEMY=null + GS.IDLE만
                        // 처리해 stats.escapes 증분 / recentBattles record / escape 사운드를
                        // 모두 누락했음. '공허의 문'(시간술사) / '순간 이동'(차원술사) 사용자가
                        // 정상 도주 분기 사용자와 동일한 보상 체인을 받지 못하던 회귀 수정.
                        const escHpRatio = (playerAfterAction?.hp || player.hp || 0)
                            / Math.max(1, playerAfterAction?.maxHp || player.maxHp || 1);
                        dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({
                            ...p,
                            stats: {
                                ...pushBattleRecord(p.stats, makeBattleRecord('escape', escHpRatio)),
                                escapes: (p.stats?.escapes || 0) + 1,
                            },
                        }) });
                        dispatch({ type: AT.SET_ENEMY, payload: null });
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                        soundManager.play('escape');
                        return;
                    }
                } else {
                    result = CombatEngine.attack(playerAtActionStart, enemyAtActionStart, stats);
                    playerAfterAction = result.updatedPlayer;
                    dispatch({ type: AT.SET_PLAYER, payload: result.updatedPlayer });
                }

                result.logs.forEach((log: any) => addLog(log.type, log.text));
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
                        liveConfig,
                    });
                    if (earlyReturn) return;
                    return;
                }

                dispatch({ type: AT.SET_ENEMY, payload: result.updatedEnemy });

                // extraTurnGranted — 시간술사 효과 → 적 턴 스킵
                if (playerAfterAction.extraTurnGranted) {
                    dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, extraTurnGranted: false }) });
                    return;
                }

                pendingRef.current = setTimeout(() => {
                    pendingRef.current = null;
                    const turnTick = CombatEngine.tickCombatState(playerAfterAction);
                    turnTick.logs.forEach((log: any) => addLog(log.type, log.text));
                    const playerForEnemyTurn = turnTick.updatedPlayer;
                    dispatch({ type: AT.SET_PLAYER, payload: playerForEnemyTurn });

                    const counterResult = CombatEngine.enemyAttack(playerForEnemyTurn, result.updatedEnemy as any, stats);
                    counterResult.logs.forEach((log: any) => addLog(log.type, log.text));
                    dispatch({ type: AT.SET_ENEMY, payload: counterResult.updatedEnemy });
                    dispatch({ type: AT.SET_PLAYER, payload: counterResult.updatedPlayer });
                    dispatch({ type: AT.SET_VISUAL_EFFECT, payload: counterResult.isCrit ? 'shake' : null });

                    // cycle 273: phase2 transition 감지 → addStoryLog('bossPhase2', ...) — aiService
                    //   8 스토리 템플릿 중 dead였던 'bossPhase2' paired completion (cycle 272 패턴).
                    //   prev (result.updatedEnemy.phase2Triggered) → new (counterResult.updatedEnemy.phase2Triggered)
                    //   비교로 transition 검출.
                    if (
                        !result.updatedEnemy?.phase2Triggered
                        && counterResult.updatedEnemy?.phase2Triggered
                        && typeof addStoryLog === 'function'
                    ) {
                        addStoryLog('bossPhase2', { bossName: counterResult.updatedEnemy.name });
                    }

                    // DoT로 적 사망
                    if (counterResult.isEnemyDead) {
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                        dispatch({ type: AT.SET_ENEMY, payload: null });
                        addLog('success', MSG.COMBAT_DOT_KILL(result.updatedEnemy?.name));
                        handleVictoryOutcome({
                            playerAfterCombat: counterResult.updatedPlayer,
                            deadEnemy: result.updatedEnemy,
                            stats, dispatch, addLog, addStoryLog,
                            emitDailyProtocolLogs, emitUnlockedTitles,
                            extendedChecks: false,
                            liveConfig,
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
                        // cycle 218: 사망 sensory cue — descending tone (400→100Hz). cycle 217 lens 확장.
                        soundManager.play('death');
                        emitUnlockedTitles(deathRecordPlayer);
                        defeatResult.logs.forEach((log: any) => addLog(log.type, log.text));
                        addStoryLog('death', { loc: playerForEnemyTurn.loc });
                        // cycle 275: 사망 회상 narrative — story 템플릿 시리즈 마무리 (cycle 272-274 paired).
                        //   'death'는 즉각 모먼트, 'ruinRecap'은 retrospective + hopeful (level/name 포함).
                        if (typeof addStoryLog === 'function') {
                            addStoryLog('ruinRecap', { name: deadPlayer.name, level: deadPlayer.level });
                        }
                    }
                }, BALANCE.ENEMY_TURN_DELAY_MS);
                return;
            }

            if (type === 'escape') {
                const escapeResult = CombatEngine.attemptEscape(enemy, stats);
                escapeResult.logs.forEach((log: any) => addLog(log.type, log.text));
                if (escapeResult.success) {
                    const escHpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 1);
                    // cycle 74: stats.escapes 증분 — 성공한 도주 횟수 누적.
                    // 기존에는 recentBattles에만 기록되어 윈도우(50) 밖으로 밀려나면
                    // 사라졌고, achievement / quest target으로 쓸 수 없었음.
                    dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({
                        ...p,
                        stats: {
                            ...pushBattleRecord(p.stats, makeBattleRecord('escape', escHpRatio)),
                            escapes: (p.stats?.escapes || 0) + 1,
                        },
                    }) });
                    dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                    dispatch({ type: AT.SET_ENEMY, payload: null });
                    // cycle 88: 도주 성공 sensory cue — cycle 74-87 feedback chain의 마지막
                    // 채널. 'info' 로그는 useGameEngine의 sound 매핑에 없으므로 직접 호출
                    // (CombatPanel의 'attack'/'item' 패턴과 동일).
                    soundManager.play('escape');
                } else {
                    const protectionLogs: any[] = [];
                    const protectedResult = CombatEngine.applyFatalProtection(player, stats.relics || [], escapeResult.damage || 0, protectionLogs);
                    protectionLogs.forEach((log: any) => addLog(log.type, log.text));
                    if (protectedResult.isDead) {
                        const deadPlayer = { ...protectedResult.updatedPlayer, killStreak: 0 };
                        const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                        dispatch({ type: AT.SET_RUN_SUMMARY, payload: buildRunSummary(deadPlayer, deadPlayer.loc) });
                        dispatch({ type: AT.SET_GRAVE, payload: appendGrave(grave, defeatResult.graveData) });
                        dispatch({ type: AT.SET_PLAYER, payload: defeatResult.updatedPlayer });
                        dispatch({ type: AT.SET_GAME_STATE, payload: GS.DEAD });
                        dispatch({ type: AT.SET_ENEMY, payload: null });
                        // cycle 218: 도주 실패 후 사망 sensory cue — same death sound as combat death.
                        soundManager.play('death');
                        emitUnlockedTitles(defeatResult.updatedPlayer);
                        defeatResult.logs.forEach((log: any) => addLog(log.type, log.text));
                        addStoryLog('death', { loc: player.loc });
                        // cycle 275: 도주 실패 후 사망에도 'ruinRecap' 회상 narrative.
                        if (typeof addStoryLog === 'function') {
                            addStoryLog('ruinRecap', { name: deadPlayer.name, level: deadPlayer.level });
                        }
                    } else {
                        dispatch({ type: AT.SET_PLAYER, payload: protectedResult.updatedPlayer });
                    }
                }
            }
        },
    };
};
