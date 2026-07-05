import { CombatEngine } from '../../systems/CombatEngine';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import { BALANCE } from '../../data/constants';
import { checkMilestones, grantGold, makeItem, registerCodex, registerLootToCodex, countNewCodexEntries } from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { getRunBuildProfile, getTraitLootHint, getTraitProfile } from '../../utils/runProfileUtils';
import { pushBattleRecord, makeBattleRecord } from '../../systems/DifficultyManager';
import { SEASON_XP } from '../../data/seasonPass';
import { addCombatDigestLogs, getLootUpgradeHint, applyScoutGuaranteedRelic, buildPassiveBonusWithScout } from './_helpers';
import { applyAbyssFloorAdvance, handleDemonKingSlain } from './combatBossHandlers';
import { getSignaturePityMultiplier } from '../../utils/signaturePity';
import { isSignatureItem } from '../../data/signatureItems.js';
import { soundManager } from '../../systems/SoundManager';

/**
 * 전투 승리 공통 후처리.
 * @param {object} opts
 * @param {object} opts.playerAfterCombat - 직접 승리 시점의 player (CombatEngine 결과)
 * @param {object} opts.deadEnemy - 처치된 적
 * @param {object} opts.stats - getFullStats() 결과
 * @param {boolean} opts.extendedChecks - attack/skill 직접 승리 시 true (시즌XP, 마왕, 진엔딩, story log)
 * @returns {{ earlyReturn: boolean }} earlyReturn이 true이면 호출자가 즉시 return
 */
// cycle 592: extendedChecks / liveConfig 2 defaults batch 제거 — 3 production
//   caller (combatAttack:81/131, combatItem:67) 모두 명시 전달이라 두 default
//   모두 도달 불가. cycle 265 liveConfig 4번째 인자 전달 보존. 청소 메가
//   시리즈 82번째.
export const handleVictoryOutcome = ({
    playerAfterCombat, deadEnemy, stats,
    dispatch, addLog, addStoryLog,
    emitDailyProtocolLogs, emitUnlockedTitles,
    extendedChecks,
    liveConfig,
}: any) => {
    // 탐험 스카우팅 "전투의 기척" 카드 — 해당 전투 한정 처치 보상(EXP/골드) 배율 보너스.
    const passiveBonus = buildPassiveBonusWithScout(stats, deadEnemy);
    const victoryResult = CombatEngine.handleVictory(playerAfterCombat, deadEnemy, passiveBonus, liveConfig);
    let updatedPlayer = victoryResult.updatedPlayer;
    victoryResult.logs.forEach((log: any) => addLog(log.type, log.text));
    if (victoryResult.visualEffect) dispatch({ type: AT.SET_VISUAL_EFFECT, payload: victoryResult.visualEffect });

    // cycle 274: 레벨업 시 addStoryLog('levelUp', ...) — aiService 8 스토리 템플릿 dead 시리즈
    //   (cycle 272-273 paired). visualEffect / sound (cycle 217) / log는 있지만 narrative cue 부재였음.
    if (victoryResult.leveledUp && typeof addStoryLog === 'function') {
        addStoryLog('levelUp', { level: updatedPlayer.level });
    }

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
    // cycle 193: 신규 codex 등록 수 추적 — SEASON_XP.codexDiscover dispatch용.
    const codexBefore = countNewCodexEntries(updatedPlayer);
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

    // cycle 193: 신규 codex 등록 수만큼 SEASON_XP.codexDiscover 적용. 기존엔 SEASON_XP.codexDiscover
    //   key 정의됐으나 dispatch 0건이던 dead config. loot/monster 모두 포함.
    const codexAfter = countNewCodexEntries(updatedPlayer);
    const newCodexCount = codexAfter - codexBefore;
    if (newCodexCount > 0) {
        dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.codexDiscover * newCodexCount });
    }

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
    // cycle 136: BALANCE.KILL_STREAK_DECAY_MS(30초) 기반 시간 감쇠 구현 — 기존엔
    // constant 정의만 있고 실제 decay 로직 없어 사망 외엔 streak가 영원히 누적되던 갭.
    // 마지막 킬 timestamp(lastKillAt)와 비교해 elapsed > DECAY_MS이면 새 streak 시작.
    const now = Date.now();
    const lastKillAt = (updatedPlayer as any).lastKillAt;
    const decayed = typeof lastKillAt === 'number' && (now - lastKillAt) > BALANCE.KILL_STREAK_DECAY_MS;
    const prevStreak = decayed ? 0 : (updatedPlayer.killStreak || 0);
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
    // cycle 136: lastKillAt 갱신 — 다음 킬에서 elapsed 비교하기 위해 now 저장.
    const prevMaxStreak = updatedPlayer.stats?.maxKillStreak || 0;
    updatedPlayer = {
        ...updatedPlayer,
        killStreak: newStreak,
        lastKillAt: now,
        stats: {
            ...(updatedPlayer.stats || {}),
            maxKillStreak: Math.max(prevMaxStreak, newStreak),
        },
    };

    dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
    dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
    dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'kills' } });
    const isBossKill = deadEnemy?.isBoss || false;
    if (isBossKill) {
        dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'bossKills' } });
        // cycle 218: 보스 처치 sensory cue — 5-tone arpeggio (C5→E5→G5→C6→E6) celebratory chord.
        //   cycle 217 lens 확장 — defined sound but never dispatched. 일반 몹은 무음 유지
        //   (큰 모먼트만 cue).
        soundManager.play('victory');
    }

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

    // 탐험 스카우팅 "정예의 흔적" 카드 — 승리 시 유물 발견 보장(고위험 베팅의 보상).
    applyScoutGuaranteedRelic(deadEnemy, updatedPlayer, { dispatch, addLog });

    return { earlyReturn: false };
};
