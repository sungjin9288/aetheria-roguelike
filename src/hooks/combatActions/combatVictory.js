import { CombatEngine } from '../../systems/CombatEngine';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import { BALANCE } from '../../data/constants';
import { checkMilestones, grantGold, makeItem, registerCodex, registerLootToCodex } from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { getRunBuildProfile, getTraitLootHint, getTraitProfile } from '../../utils/runProfileUtils';
import { pushBattleRecord, makeBattleRecord } from '../../systems/DifficultyManager';
import { SEASON_XP } from '../../data/seasonPass';
import { addCombatDigestLogs, getLootUpgradeHint } from './_helpers';
import { applyAbyssFloorAdvance, handleDemonKingSlain } from './combatBossHandlers';

/**
 * 전투 승리 공통 후처리.
 * @param {object} opts
 * @param {object} opts.playerAfterCombat - 직접 승리 시점의 player (CombatEngine 결과)
 * @param {object} opts.deadEnemy - 처치된 적
 * @param {object} opts.stats - getFullStats() 결과
 * @param {boolean} opts.extendedChecks - attack/skill 직접 승리 시 true (시즌XP, 마왕, 진엔딩, story log)
 * @returns {{ earlyReturn: boolean }} earlyReturn이 true이면 호출자가 즉시 return
 */
export const handleVictoryOutcome = ({
    playerAfterCombat, deadEnemy, stats,
    dispatch, addLog, addStoryLog,
    emitDailyProtocolLogs, emitUnlockedTitles,
    extendedChecks = false,
}) => {
    const victoryResult = CombatEngine.handleVictory(playerAfterCombat, deadEnemy);
    let updatedPlayer = victoryResult.updatedPlayer;
    victoryResult.logs.forEach((log) => addLog(log.type, log.text));
    if (victoryResult.visualEffect) dispatch({ type: AT.SET_VISUAL_EFFECT, payload: victoryResult.visualEffect });

    const victoryStats = { ...stats, maxHp: updatedPlayer.maxHp, maxMp: updatedPlayer.maxMp };

    // buildWins
    const buildProfile = getRunBuildProfile(updatedPlayer, victoryStats);
    const buildWinsKey = buildProfile.primary.id;
    const prevBuildWins = updatedPlayer.stats?.buildWins || {};
    updatedPlayer = {
        ...updatedPlayer,
        stats: { ...updatedPlayer.stats, buildWins: { ...prevBuildWins, [buildWinsKey]: (prevBuildWins[buildWinsKey] || 0) + 1 } },
    };

    // questProgress
    const questResult = CombatEngine.updateQuestProgress(updatedPlayer, deadEnemy.baseName || deadEnemy.name);
    updatedPlayer = { ...updatedPlayer, quests: questResult.updatedQuests };
    if (questResult.completedCount > 0) addLog('system', `퀘스트 조건 달성: ${questResult.completedCount}개`);

    // loot
    const lootResult = CombatEngine.processLoot(deadEnemy, updatedPlayer);
    lootResult.logs.forEach((log) => addLog(log.type, log.text));
    if (lootResult.items.length > 0) {
        updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, ...lootResult.items] };
        updatedPlayer = registerLootToCodex(updatedPlayer, lootResult.items);
    }

    // codex
    const baseName = CombatEngine.resolveEnemyBaseName(deadEnemy);
    updatedPlayer = registerCodex(updatedPlayer, 'monsters', baseName);

    // milestone (attack/skill 직접 승리에만)
    if (extendedChecks) {
        const milestoneRewards = checkMilestones(updatedPlayer.stats?.killRegistry || {}, baseName);
        if (milestoneRewards.length > 0) {
            milestoneRewards.forEach((reward) => {
                addLog('event', reward.msg);
                if (reward.type === 'gold') updatedPlayer = grantGold(updatedPlayer, reward.val);
                else if (reward.type === 'item') updatedPlayer = addItemByName(updatedPlayer, reward.val);
                else if (reward.type === 'title') {
                    updatedPlayer = {
                        ...updatedPlayer,
                        titles: [...new Set([...(updatedPlayer.titles || []), reward.val])],
                        activeTitle: updatedPlayer.activeTitle || reward.val
                    };
                }
            });
        }
    }

    updatedPlayer = applyAbyssFloorAdvance(updatedPlayer, dispatch, addLog);

    // Kill Streak 갱신
    const prevStreak = updatedPlayer.killStreak || 0;
    const newStreak = prevStreak + 1;
    const tierThresholds = BALANCE.KILL_STREAK_TIERS;
    const hitNewTier = tierThresholds.includes(newStreak);
    if (hitNewTier) {
        const tierIdx = tierThresholds.indexOf(newStreak);
        const atkPct = Math.round(BALANCE.KILL_STREAK_ATK_BONUS[tierIdx] * 100);
        addLog('event', `🔥 ${newStreak}연속 처치! ATK +${atkPct}% 보너스 발동`);
    }
    updatedPlayer = { ...updatedPlayer, killStreak: newStreak };

    dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
    dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
    dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'kills' } });
    const isBossKill = deadEnemy?.isBoss || false;
    if (isBossKill) dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'bossKills' } });

    if (extendedChecks) {
        if (isBossKill && deadEnemy?.baseName) {
            dispatch({ type: AT.SET_PLAYER, payload: (p) => ({
                ...p,
                stats: { ...p.stats, areaBossDefeated: { ...(p.stats.areaBossDefeated || {}), [deadEnemy.baseName]: true } }
            })});
        }
        dispatch({ type: AT.ADD_SEASON_XP, payload: isBossKill ? SEASON_XP.bossKill : SEASON_XP.kill });
        const winHpRatio = (updatedPlayer.hp || 0) / Math.max(1, updatedPlayer.maxHp || 1);
        dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, stats: pushBattleRecord(p.stats, makeBattleRecord('win', winHpRatio)) }) });
    }

    emitDailyProtocolLogs('kills', 1);
    emitUnlockedTitles(updatedPlayer);

    if (extendedChecks) {
        if (victoryResult.isDemonKingSlain) {
            handleDemonKingSlain(updatedPlayer, dispatch, addLog);
            return { earlyReturn: true };
        }
        if (deadEnemy.baseName === '원시의 신' || deadEnemy.name?.includes('원시의 신') || deadEnemy.name?.includes('원초적 혼돈')) {
            const heartItem = makeItem({ name: '원시의 심장', type: 'key', price: 0, tier: 6, desc: '원시의 신의 심장.' });
            dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, inv: [...(p.inv || []), heartItem] }) });
            dispatch({ type: AT.TRIGGER_TRUE_ENDING });
            addLog('critical', MSG.TRUE_GOD_SLAIN);
            return { earlyReturn: true };
        }
        addStoryLog('victory', { name: deadEnemy.name });
    }

    const droppedItems = lootResult.items.map((i) => i.name);
    const traitProfile = getTraitProfile(updatedPlayer, victoryStats);
    const upgradeHint = getLootUpgradeHint(updatedPlayer.equip, lootResult.items);
    const traitHint = getTraitLootHint(lootResult.items, traitProfile, updatedPlayer);
    addCombatDigestLogs({
        addLog, enemyName: deadEnemy.name, victoryResult, droppedItems,
        upgradeHint, traitHint,
        bossRewardHint: victoryResult.bossClearBonus?.rewardHint || null,
        bossClearBonus: victoryResult.bossClearBonus?.goldBonus || 0,
    });
    dispatch({ type: AT.SET_POST_COMBAT_RESULT, payload: null });

    return { earlyReturn: false };
};
