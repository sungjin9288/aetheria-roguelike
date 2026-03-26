import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { CombatEngine } from '../systems/CombatEngine';
import { INITIAL_STATE } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { SEASON_XP } from '../data/seasonPass';
import { GS } from '../reducers/gameStates';
import { getJobSkills, makeItem, findItemByName, checkMilestones, checkTitles, getDailyProtocolCompletions, formatDailyProtocolReward, grantGold, getTitleLabel, buildRunSummary, toArray, registerCodex, registerLootToCodex } from '../utils/gameUtils';
import { getEquipmentProfile, getNextEquipmentState } from '../utils/equipmentUtils';
import { pushBattleRecord, makeBattleRecord } from '../systems/DifficultyManager';
import { getRunBuildProfile, getTraitLootHint, getTraitProfile } from '../utils/runProfileUtils';
import { appendGrave } from '../utils/graveUtils.js';
import { RELICS, pickWeightedRelics, MAX_RELICS_PER_RUN } from '../data/relics';
import { MSG } from '../data/messages';

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

const addCombatDigestLogs = ({
    addLog,
    enemyName,
    victoryResult,
    droppedItems = [],
    upgradeHint = null,
    traitHint = null,
    bossRewardHint = null,
    bossClearBonus = 0,
}) => {
    const summaryParts = [
        `${enemyName} 처치`,
        `EXP +${victoryResult.expGained || 0}`,
        `Gold +${victoryResult.goldGained || 0}`,
    ];
    if (droppedItems.length > 0) {
        summaryParts.push(`전리품 ${droppedItems.slice(0, 2).join(' · ')}${droppedItems.length > 2 ? ` 외 ${droppedItems.length - 2}` : ''}`);
    }
    addLog('system', `전투 정리: ${summaryParts.join(' · ')}`);

    if (bossRewardHint) {
        addLog('info', `보스 보상: ${bossClearBonus > 0 ? `초회 토벌 +${bossClearBonus}G` : '보스 전리품'} · ${bossRewardHint}`);
        return;
    }

    if (upgradeHint) {
        addLog('info', `장비 갱신: ${upgradeHint.name} · ${upgradeHint.summary}`);
        return;
    }

    if (traitHint) {
        addLog('info', `성향 공명: ${traitHint.name} · ${traitHint.summary}`);
    }
};

/**
 * createCombatActions — 전투 로직 (공격, 스킬, 도주)
 */
const applyAbyssFloorAdvance = (p, dispatch, addLog) => {
    if (p.loc !== '혼돈의 심연') return p;
    const currentDepth = p.stats?.abyssFloor || 1;
    const newDepth = currentDepth + 1;
    let updated = { ...p, stats: { ...(p.stats || {}), abyssFloor: newDepth } };
    addLog('system', `심연의 더 깊은 곳으로 진입했습니다. (현재: ${newDepth}층)`);
    const milestone = BALANCE.ABYSS_MILESTONE_REWARDS[newDepth];
    if (milestone) {
        addLog('event', MSG.ABYSS_MILESTONE(newDepth));
        if (milestone.type === 'relic_choice') {
            const available = RELICS.filter(r => !(updated.relics || []).some(pr => pr.id === r.id));
            if (available.length > 0) {
                dispatch({ type: AT.SET_PENDING_RELICS, payload: pickWeightedRelics(available, 3) });
            }
        } else if (milestone.type === 'legendary_item') {
            const legendaryPool = (DB.ITEMS || []).flat().filter(i => i.tier === 5);
            if (legendaryPool.length > 0) {
                const item = makeItem(legendaryPool[Math.floor(Math.random() * legendaryPool.length)]);
                updated = { ...updated, inv: [...(updated.inv || []), item] };
                addLog('success', `🏆 전설 아이템 획득: [${item.name}]`);
            }
        } else if (milestone.type === 'prestige_points') {
            updated = { ...updated, prestigePoints: (updated.prestigePoints || 0) + (milestone.amount || 1) };
            addLog('success', `✨ 프레스티지 포인트 +${milestone.amount || 1}`);
        }
    }
    return updated;
};

export const createCombatActions = ({ player, gameState, enemy, grave, dispatch, addLog, addStoryLog, getFullStats }) => {
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

    combatUseItem: (item) => {
        if (pendingEnemyTurn) { clearTimeout(pendingEnemyTurn); pendingEnemyTurn = null; }
        if (gameState !== GS.COMBAT || !enemy) return addLog('error', '전투 상태가 아닙니다.');

        const inventoryItem = player.inv.find((entry) => entry.id === item?.id);
        if (!inventoryItem) return addLog('error', '인벤토리에 없는 아이템입니다.');
        if (!['hp', 'mp', 'cure', 'buff'].includes(inventoryItem.type)) {
            return addLog('error', '전투 중에는 소모품만 사용할 수 있습니다.');
        }

        let updatedPlayer = player;

        if (inventoryItem.type === 'hp') {
            const stats = getFullStats(player);
            updatedPlayer = {
                ...player,
                hp: Math.min(stats.maxHp, player.hp + (inventoryItem.val || 0)),
                inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
            };
            addLog('success', `${inventoryItem.name} 사용.`);
        } else if (inventoryItem.type === 'mp') {
            const stats = getFullStats(player);
            updatedPlayer = {
                ...player,
                mp: Math.min(stats.maxMp, player.mp + (inventoryItem.val || 0)),
                inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
            };
            addLog('success', `${inventoryItem.name} 사용.`);
        } else if (inventoryItem.type === 'cure') {
            updatedPlayer = {
                ...player,
                status: toArray(player.status).filter((status) => status !== inventoryItem.effect),
                inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
            };
            addLog('success', `${inventoryItem.name} 사용: 상태이상 해제`);
        } else if (inventoryItem.type === 'buff') {
            updatedPlayer = {
                ...player,
                tempBuff: {
                    atk: inventoryItem.effect === 'atk_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                    def: inventoryItem.effect === 'def_up' || inventoryItem.effect === 'all_up' ? (inventoryItem.val || 1.3) - 1 : 0,
                    turn: inventoryItem.turn || 3,
                    name: inventoryItem.name
                },
                inv: player.inv.filter((entry) => entry.id !== inventoryItem.id)
            };
            addLog('success', `${inventoryItem.name} 사용: 버프 활성화`);
        }

        dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });

        const turnTick = CombatEngine.tickCombatState(updatedPlayer);
        turnTick.logs.forEach((log) => addLog(log.type, log.text));
        const playerForEnemyTurn = turnTick.updatedPlayer;
        dispatch({ type: 'SET_PLAYER', payload: playerForEnemyTurn });

        const counterStats = getFullStats(playerForEnemyTurn);
        const counterResult = CombatEngine.enemyAttack(playerForEnemyTurn, enemy, counterStats);
        counterResult.logs.forEach((log) => addLog(log.type, log.text));

        if (counterResult.isEnemyDead) {
            dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
            dispatch({ type: 'SET_ENEMY', payload: null });
            addLog('success', `[지속 피해] ${enemy.name}이(가) 쓰러졌습니다!`);
            const victoryResult = CombatEngine.handleVictory(counterResult.updatedPlayer, enemy);
            let victoriousPlayer = victoryResult.updatedPlayer;
            victoryResult.logs.forEach((log) => addLog(log.type, log.text));

            const victoryStats = {
                ...counterStats,
                maxHp: victoriousPlayer.maxHp,
                maxMp: victoriousPlayer.maxMp,
            };
            const buildProfileForProgress = getRunBuildProfile(victoriousPlayer, victoryStats);
            victoriousPlayer = {
                ...victoriousPlayer,
                stats: {
                    ...(victoriousPlayer.stats || {}),
                    buildWins: {
                        ...((victoriousPlayer.stats || {}).buildWins || {}),
                        [buildProfileForProgress.primary.id]: (((victoriousPlayer.stats || {}).buildWins || {})[buildProfileForProgress.primary.id] || 0) + 1
                    }
                }
            };

            const questResult = CombatEngine.updateQuestProgress(victoriousPlayer, enemy.baseName || enemy.name);
            victoriousPlayer = { ...victoriousPlayer, quests: questResult.updatedQuests };
            if (questResult.completedCount > 0) {
                addLog('system', `퀘스트 조건 달성: ${questResult.completedCount}개`);
            }

            const lootResult = CombatEngine.processLoot(enemy, victoriousPlayer);
            lootResult.logs.forEach((log) => addLog(log.type, log.text));
            if (lootResult.items.length > 0) {
                victoriousPlayer = { ...victoriousPlayer, inv: [...victoriousPlayer.inv, ...lootResult.items] };
                victoriousPlayer = registerLootToCodex(victoriousPlayer, lootResult.items);
            }
            // 몬스터 도감 등록
            const enemyBaseName = CombatEngine.resolveEnemyBaseName(enemy);
            victoriousPlayer = registerCodex(victoriousPlayer, 'monsters', enemyBaseName);
            victoriousPlayer = applyAbyssFloorAdvance(victoriousPlayer, dispatch, addLog);

            dispatch({ type: 'SET_PLAYER', payload: victoriousPlayer });
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
            dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'kills' } });
            if (enemy?.isBoss) dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'bossKills' } });
            emitDailyProtocolLogs('kills', 1);
            emitUnlockedTitles(victoriousPlayer);

            const droppedItems = lootResult.items.map((entry) => entry.name);
            const traitProfile = getTraitProfile(victoriousPlayer, victoryStats);
            const lootUpgradeHint = getLootUpgradeHint(victoriousPlayer.equip, lootResult.items);
            const traitLootHint = getTraitLootHint(lootResult.items, traitProfile, victoriousPlayer);
            addCombatDigestLogs({
                addLog,
                enemyName: enemy.name,
                victoryResult,
                droppedItems,
                upgradeHint: lootUpgradeHint,
                traitHint: traitLootHint,
                bossRewardHint: victoryResult.bossClearBonus?.rewardHint || null,
                bossClearBonus: victoryResult.bossClearBonus?.goldBonus || 0,
            });
            dispatch({ type: 'SET_POST_COMBAT_RESULT', payload: null });
            return;
        }

        if (counterResult.isDead) {
            const deadPlayer = counterResult.updatedPlayer;
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

        dispatch({ type: 'SET_ENEMY', payload: counterResult.updatedEnemy });
        dispatch({ type: 'SET_PLAYER', payload: counterResult.updatedPlayer });
        dispatch({ type: 'SET_VISUAL_EFFECT', payload: counterResult.isCrit ? 'shake' : null });
    },

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
                if (!result.success) return addLog('error', result.logs[0]?.text || '스킬 사용 실패');
                playerAfterAction = result.updatedPlayer;
                dispatch({ type: 'SET_PLAYER', payload: result.updatedPlayer });
                // escape_100: 즉시 전투 이탈 (무당 공허의 문 / 시간술사 순간 이동)
                if (result.forceEscape) {
                    result.logs.forEach((log) => addLog(log.type, log.text));
                    dispatch({ type: 'SET_ENEMY', payload: null });
                    dispatch({ type: 'SET_GAME_STATE', payload: GS.IDLE });
                    return;
                }
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

                const victoryStats = {
                    ...stats,
                    maxHp: updatedPlayer.maxHp,
                    maxMp: updatedPlayer.maxMp,
                };
                const buildProfileForProgress = getRunBuildProfile(updatedPlayer, victoryStats);
                updatedPlayer = {
                    ...updatedPlayer,
                    stats: {
                        ...(updatedPlayer.stats || {}),
                        buildWins: {
                            ...((updatedPlayer.stats || {}).buildWins || {}),
                            [buildProfileForProgress.primary.id]: (((updatedPlayer.stats || {}).buildWins || {})[buildProfileForProgress.primary.id] || 0) + 1
                        }
                    }
                };

                const questResult = CombatEngine.updateQuestProgress(updatedPlayer, enemyAtActionStart.baseName || enemyAtActionStart.name);
                updatedPlayer = { ...updatedPlayer, quests: questResult.updatedQuests };
                if (questResult.completedCount > 0) {
                    addLog('system', `퀘스트 조건 달성: ${questResult.completedCount}개`);
                }

                const lootResult = CombatEngine.processLoot(enemyAtActionStart, updatedPlayer);
                lootResult.logs.forEach((log) => addLog(log.type, log.text));
                if (lootResult.items.length > 0) {
                    updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, ...lootResult.items] };
                    updatedPlayer = registerLootToCodex(updatedPlayer, lootResult.items);
                }

                // 마일스톤 보상 처리 (checkMilestones 연결)
                const baseName = CombatEngine.resolveEnemyBaseName(enemyAtActionStart);
                updatedPlayer = registerCodex(updatedPlayer, 'monsters', baseName);
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

                updatedPlayer = applyAbyssFloorAdvance(updatedPlayer, dispatch, addLog);

                dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
                dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
                dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'kills' } });
                const isBossKill = enemyAtActionStart?.isBoss || false;
                if (isBossKill) dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'bossKills' } });
                // 구역 보스 처치 기록 — 이번 런에서 재스폰 방지
                if (isBossKill && enemyAtActionStart?.baseName) {
                    dispatch({ type: AT.SET_PLAYER, payload: (p) => ({
                        ...p,
                        stats: { ...p.stats, areaBossDefeated: { ...(p.stats.areaBossDefeated || {}), [enemyAtActionStart.baseName]: true } }
                    })});
                }
                emitDailyProtocolLogs('kills', 1);
                emitUnlockedTitles(updatedPlayer);
                dispatch({ type: AT.ADD_SEASON_XP, payload: isBossKill ? SEASON_XP.bossKill : SEASON_XP.kill });

                // Stage 3: 승리 전투 결과 기록
                const winHpRatio = (updatedPlayer.hp || 0) / Math.max(1, updatedPlayer.maxHp || 1);
                dispatch({
                    type: 'SET_PLAYER',
                    payload: (p) => ({
                        ...p,
                        stats: pushBattleRecord(p.stats, makeBattleRecord('win', winHpRatio))
                    })
                });

                // 마왕 처치 → 진 엔딩 조건 체크 or 에테르 환생
                if (victoryResult.isDemonKingSlain) {
                    // 원시의 파편 드랍 (프레스티지 1회 이상, 1/3 확률)
                    const prestigeRank = updatedPlayer.meta?.prestigeRank || 0;
                    const shardCount = (updatedPlayer.inv || []).filter((i) => i?.name === '원시의 파편').length;
                    if (prestigeRank >= 1 && shardCount < 3 && Math.random() < CONSTANTS.PRIMAL_SHARD_DROP_CHANCE) {
                        const shardItem = makeItem({ name: '원시의 파편', type: 'key', price: 0, tier: 5, desc: '원시의 신의 기억이 담긴 파편.' });
                        dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, inv: [...(p.inv || []), shardItem] }) });
                        addLog('event', MSG.PRIMAL_SHARD_DROP(shardCount + 1));
                    }

                    // 진 엔딩 조건: 프레스티지 3회 이상 + 파편 3개
                    const currentShardCount = (updatedPlayer.inv || []).filter((i) => i?.name === '원시의 파편').length;
                    if (prestigeRank >= 3 && currentShardCount >= 3) {
                        addLog('critical', MSG.TRUE_BOSS_UNLOCK);
                        // 원시의 파편 3개 소모 후 진 보스 전투 진입
                        const newInv = (() => {
                            let removed = 0;
                            return (updatedPlayer.inv || []).filter((i) => {
                                if (i?.name === '원시의 파편' && removed < 3) { removed++; return false; }
                                return true;
                            });
                        })();
                        const trueBossData = DB.MONSTERS?.['원시의 신'];
                        if (trueBossData) {
                            const baseHp = 8000;
                            const baseAtk = 280;
                            const trueBoss = {
                                name: '원시의 신',
                                baseName: '원시의 신',
                                hp: Math.floor(baseHp * (trueBossData.hpMult || 2.2)),
                                maxHp: Math.floor(baseHp * (trueBossData.hpMult || 2.2)),
                                atk: Math.floor(baseAtk * (trueBossData.atkMult || 1.8)),
                                def: 120, level: 70,
                                isBoss: true,
                                weakness: '빛', resistance: '어둠',
                                expMult: trueBossData.expMult || 5.0,
                                goldMult: trueBossData.goldMult || 5.0,
                                dropMod: trueBossData.dropMod || 5.0,
                                phase2: trueBossData.phase2,
                                phase3: trueBossData.phase3,
                                exp: 5000, gold: 9999,
                                pattern: { guardChance: 0.05, heavyChance: 0.4 },
                            };
                            dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, inv: newInv }) });
                            dispatch({ type: AT.SET_ENEMY, payload: trueBoss });
                            dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
                            addLog('critical', MSG.TRUE_BOSS_APPEAR);
                        }
                        return;
                    }

                    // 조건 미충족 → 일반 환생
                    if (prestigeRank >= 1 && shardCount < 3) {
                        addLog('info', MSG.PRIMAL_SHARD_HINT(Math.min(shardCount + 1, 3)));
                    }
                    dispatch({ type: 'SET_GAME_STATE', payload: GS.ASCENSION });
                    addLog('system', '⚡ 마왕이 쓰러졌습니다. 에테르 환생의 문이 열렸습니다...');
                    return;
                }

                // 원시의 신 처치 → 진 엔딩
                if (enemyAtActionStart.baseName === '원시의 신' || enemyAtActionStart.name?.includes('원시의 신') || enemyAtActionStart.name?.includes('원초적 혼돈')) {
                    const heartItem = makeItem({ name: '원시의 심장', type: 'key', price: 0, tier: 6, desc: '원시의 신의 심장.' });
                    dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, inv: [...(p.inv || []), heartItem] }) });
                    dispatch({ type: AT.TRIGGER_TRUE_ENDING });
                    addLog('critical', '🌟 원시의 신이 쓰러졌습니다. 세계의 진실이 밝혀집니다...');
                    return;
                }

                addStoryLog('victory', { name: enemyAtActionStart.name });

                // PostCombatCard 데이터 전달
                const droppedItems = lootResult.items.map((item) => item.name);
                const traitProfile = getTraitProfile(updatedPlayer, {
                    ...stats,
                    maxHp: updatedPlayer.maxHp,
                    maxMp: updatedPlayer.maxMp,
                });
                const lootUpgradeHint = getLootUpgradeHint(updatedPlayer.equip, lootResult.items);
                const traitLootHint = getTraitLootHint(lootResult.items, traitProfile, updatedPlayer);
                addCombatDigestLogs({
                    addLog,
                    enemyName: enemyAtActionStart.name,
                    victoryResult,
                    droppedItems,
                    upgradeHint: lootUpgradeHint,
                    traitHint: traitLootHint,
                    bossRewardHint: victoryResult.bossClearBonus?.rewardHint || null,
                    bossClearBonus: victoryResult.bossClearBonus?.goldBonus || 0,
                });
                dispatch({ type: 'SET_POST_COMBAT_RESULT', payload: null });
                return;
            }

            dispatch({ type: 'SET_ENEMY', payload: result.updatedEnemy });

            // Sprint 16: extraTurnGranted — 시간술사 '시간 가속' 효과 → 적 턴 스킵
            if (playerAfterAction.extraTurnGranted) {
                dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, extraTurnGranted: false }) });
                return;
            }

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
                    let updatedPlayer = victoryResult.updatedPlayer;
                    victoryResult.logs.forEach((log) => addLog(log.type, log.text));

                    const dotVictoryStats = {
                        ...stats,
                        maxHp: updatedPlayer.maxHp,
                        maxMp: updatedPlayer.maxMp,
                    };
                    const buildProfileForProgress = getRunBuildProfile(updatedPlayer, dotVictoryStats);
                    updatedPlayer = {
                        ...updatedPlayer,
                        stats: {
                            ...(updatedPlayer.stats || {}),
                            buildWins: {
                                ...((updatedPlayer.stats || {}).buildWins || {}),
                                [buildProfileForProgress.primary.id]: (((updatedPlayer.stats || {}).buildWins || {})[buildProfileForProgress.primary.id] || 0) + 1
                            }
                        }
                    };

                    const questResult = CombatEngine.updateQuestProgress(updatedPlayer, result.updatedEnemy.baseName || result.updatedEnemy.name);
                    updatedPlayer = { ...updatedPlayer, quests: questResult.updatedQuests };
                    if (questResult.completedCount > 0) {
                        addLog('system', `퀘스트 조건 달성: ${questResult.completedCount}개`);
                    }

                    const lootResult = CombatEngine.processLoot(result.updatedEnemy, updatedPlayer);
                    lootResult.logs.forEach((log) => addLog(log.type, log.text));
                    if (lootResult.items.length > 0) {
                        updatedPlayer = { ...updatedPlayer, inv: [...updatedPlayer.inv, ...lootResult.items] };
                        updatedPlayer = registerLootToCodex(updatedPlayer, lootResult.items);
                    }
                    const enemyBase = CombatEngine.resolveEnemyBaseName(result.updatedEnemy);
                    updatedPlayer = registerCodex(updatedPlayer, 'monsters', enemyBase);
                    updatedPlayer = applyAbyssFloorAdvance(updatedPlayer, dispatch, addLog);

                    dispatch({ type: 'SET_PLAYER', payload: updatedPlayer });
                    dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'kills', amount: 1 } });
                    dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'kills' } });
                    if (result.updatedEnemy?.isBoss) dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'bossKills' } });
                    emitDailyProtocolLogs('kills', 1);
                    emitUnlockedTitles(updatedPlayer);

                    const droppedItems = lootResult.items.map((item) => item.name);
                    const traitProfile = getTraitProfile(updatedPlayer, dotVictoryStats);
                    const lootUpgradeHint = getLootUpgradeHint(updatedPlayer.equip, lootResult.items);
                    const traitLootHint = getTraitLootHint(lootResult.items, traitProfile, updatedPlayer);
                    addCombatDigestLogs({
                        addLog,
                        enemyName: result.updatedEnemy.name,
                        victoryResult,
                        droppedItems,
                        upgradeHint: lootUpgradeHint,
                        traitHint: traitLootHint,
                        bossRewardHint: victoryResult.bossClearBonus?.rewardHint || null,
                        bossClearBonus: victoryResult.bossClearBonus?.goldBonus || 0,
                    });
                    dispatch({ type: 'SET_POST_COMBAT_RESULT', payload: null });
                    return;
                }

                if (counterResult.isDead) {
                    const deadPlayer = counterResult.updatedPlayer;
                    const defeatResult = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
                    // Stage 3: 적 반격 사망 전투 결과 기록
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
                    dispatch({ type: AT.SET_GRAVE, payload: appendGrave(grave, defeatResult.graveData) });
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
