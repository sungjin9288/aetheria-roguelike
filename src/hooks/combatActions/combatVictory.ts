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
import { getSignaturePityMultiplier } from '../../utils/signaturePity';
import { isSignatureItem } from '../../data/signatureItems.js';

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
}: any) => {
    const passiveBonus = { goldMult: stats?.passiveGoldMult || 0, expMult: stats?.passiveExpMult || 0 };
    const victoryResult = CombatEngine.handleVictory(playerAfterCombat, deadEnemy, passiveBonus);
    let updatedPlayer = victoryResult.updatedPlayer;
    victoryResult.logs.forEach((log: any) => addLog(log.type, log.text));
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
    if (questResult.completedCount > 0) addLog('system', MSG.QUEST_CONDITION_MET(questResult.completedCount));

    // loot — signature pity 배율 적용 (bad-luck 보호막)
    const signaturePityMult = getSignaturePityMultiplier(updatedPlayer.stats?.signaturePity);
    const lootResult = CombatEngine.processLoot(deadEnemy, updatedPlayer, signaturePityMult);
    lootResult.logs.forEach((log: any) => addLog(log.type, log.text));
    if (lootResult.items.length > 0) {
        updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, ...lootResult.items] };
        updatedPlayer = registerLootToCodex(updatedPlayer, lootResult.items);
    }

    // signature pity bookkeeping:
    //  - signature 하나라도 드롭 → pity = 0
    //  - 보스 토벌 + signature 미획득 → pity += 1
    //  - 일반 몹은 pity 영향 없음
    const signatureDropped = lootResult.items.some((it: any) => isSignatureItem(it));
    const prevPity = updatedPlayer.stats?.signaturePity || 0;
    if (signatureDropped) {
        if (prevPity > 0) {
            updatedPlayer = {
                ...updatedPlayer,
                stats: { ...updatedPlayer.stats, signaturePity: 0 },
            };
        }
    } else if (deadEnemy?.isBoss) {
        updatedPlayer = {
            ...updatedPlayer,
            stats: { ...updatedPlayer.stats, signaturePity: prevPity + 1 },
        };
    }

    // codex
    const baseName = CombatEngine.resolveEnemyBaseName(deadEnemy);
    updatedPlayer = registerCodex(updatedPlayer, 'monsters', baseName);

    // milestone (attack/skill 직접 승리에만)
    if (extendedChecks) {
        const milestoneRewards = checkMilestones(updatedPlayer.stats?.killRegistry || {}, baseName);
        if (milestoneRewards.length > 0) {
            milestoneRewards.forEach((reward: any) => {
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
        addLog('event', MSG.KILL_STREAK_BONUS(newStreak, atkPct));
    }
    // cycle 95: max-ever 연속 처치 누적 — killStreak는 비전투 30초 / 사망 / 도주 시
    // 0으로 리셋되는 휘발성 카운터라 reflection / 보상 surface에 잡히지 않음. 영구
    // 보존되는 stats.maxKillStreak를 유지해 ach_streak_5/10/20 + berserker(광전사)
    // 칭호의 1급 시민 시그널로 사용.
    const prevMaxStreak = updatedPlayer.stats?.maxKillStreak || 0;
    updatedPlayer = {
        ...updatedPlayer,
        killStreak: newStreak,
        stats: {
            ...(updatedPlayer.stats || {}),
            maxKillStreak: Math.max(prevMaxStreak, newStreak),
        },
    };

    dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
    dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
    dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'kills' } });
    const isBossKill = deadEnemy?.isBoss || false;
    if (isBossKill) dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'bossKills' } });

    if (extendedChecks) {
        if (isBossKill && deadEnemy?.baseName) {
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({
                ...p,
                stats: { ...p.stats, areaBossDefeated: { ...(p.stats.areaBossDefeated || {}), [deadEnemy.baseName]: true } }
            })});
        }
        dispatch({ type: AT.ADD_SEASON_XP, payload: isBossKill ? SEASON_XP.bossKill : SEASON_XP.kill });
        const winHpRatio = (updatedPlayer.hp || 0) / Math.max(1, updatedPlayer.maxHp || 1);
        dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, stats: pushBattleRecord(p.stats, makeBattleRecord('win', winHpRatio)) }) });
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
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, inv: [...(p.inv || []), heartItem] }) });
            dispatch({ type: AT.TRIGGER_TRUE_ENDING });
            addLog('critical', MSG.TRUE_GOD_SLAIN);
            return { earlyReturn: true };
        }
        if (deadEnemy.baseName === '공허의 신' || deadEnemy.name?.includes('공허의 신') || deadEnemy.name?.includes('절대 공허')) {
            const voidCore = makeItem({ name: '공허의 핵심', type: 'key', price: 0, tier: 6, desc: '심연 100층을 정복한 자에게만 허락된 공허의 본질. 세상의 어떤 힘도 이것을 무너뜨릴 수 없다.' });
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({
                ...p,
                inv: [...(p.inv || []), voidCore],
                titles: [...new Set([...(p.titles || []), '허무의 정복자'])],
                activeTitle: p.activeTitle || '허무의 정복자',
                stats: { ...(p.stats || {}), abyssRecord: Math.max(p.stats?.abyssRecord || 0, p.stats?.abyssFloor || 100) },
            })});
            addLog('critical', MSG.VOID_GOD_SLAIN);
            return { earlyReturn: false };
        }
        addStoryLog('victory', { name: deadEnemy.name });
    }

    const droppedItems = lootResult.items.map((i: any) => i.name);
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
