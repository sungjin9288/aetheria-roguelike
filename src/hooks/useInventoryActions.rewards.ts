import { DB } from '../data/db';
import { grantGold, isAchievementUnlocked } from '../utils/gameUtils';
import { addItemByName } from '../utils/inventoryUtils';
import { incrementStat } from '../utils/playerStateUtils';
import { getPacedQuestClaimExp } from '../utils/progressionPacing';
import { SEASON_XP } from '../data/seasonPass';
import { getTraitProfile, getTraitQuestResonance } from '../utils/runProfileUtils';
import { AT } from '../reducers/actionTypes';
import { CombatEngine } from '../systems/CombatEngine';
import { MSG } from '../data/messages';
import { soundManager } from '../systems/SoundManager';

/**
 * createRewardActions — 보상 수령 도메인 (퀘스트/업적/주간/시즌패스).
 *   네 액션 모두 "달성/회수" 모먼트로 quest_complete 사운드를 공유한다.
 *   useInventoryActions.ts에서 공유 클로저(emitUnlockedTitles/syncLevelQuests)와
 *   deps를 ctx로 받아 조합된다.
 */
export const createRewardActions = (ctx: any) => {
    const { player, dispatch, addLog, addStoryLog, getFullStats, emitUnlockedTitles, syncLevelQuests } = ctx;

    return ({

        completeQuest: (qId: any) => {
            const pQuest = player.quests.find((quest: any) => quest.id === qId);
            if (!pQuest) return;

            const qData = pQuest.isBounty ? pQuest : DB.QUESTS.find((quest: any) => quest.id === qId);
            if (!qData) return;
            if (pQuest.progress < qData.goal) return addLog('error', MSG.QUEST_NOT_COMPLETE);

            let updatedPlayer = {
                ...player,
                quests: player.quests.filter((quest: any) => quest.id !== qId)
            };

            // cycle 260: stats.claimedQuestIds 영구 ledger 추적 — checkTitles questReward
            //   fallback이 저장 손실 / 마이그레이션 등 복구 케이스에서 칭호 복원 가능. cycle
            //   199 prestigeRank / cycle 201 seasonTier paired pattern. bounty는 별도 카운터(
            //   bountiesCompleted)로 추적되므로 일반 quest만 push.
            if (!pQuest.isBounty) {
                const prevClaimedQuestIds = (updatedPlayer.stats as any)?.claimedQuestIds;
                const nextClaimedQuestIds = Array.isArray(prevClaimedQuestIds) ? prevClaimedQuestIds : [];
                if (!nextClaimedQuestIds.includes(qId)) {
                    updatedPlayer = {
                        ...updatedPlayer,
                        stats: {
                            ...updatedPlayer.stats,
                            claimedQuestIds: [...nextClaimedQuestIds, qId],
                        } as any,
                    };
                }
            }

            if (qData.reward?.gold) updatedPlayer = grantGold(updatedPlayer, qData.reward.gold);
            if (qData.reward?.exp) {
                const pacedExp = getPacedQuestClaimExp(updatedPlayer, qData.reward.exp);
                const expResult = CombatEngine.applyExpGain(updatedPlayer, pacedExp);
                updatedPlayer = expResult.updatedPlayer;
                expResult.logs.forEach((log: any) => addLog(log.type, log.text));
                if (expResult.visualEffect) dispatch({ type: AT.SET_VISUAL_EFFECT, payload: expResult.visualEffect });
            }

            if (pQuest.isBounty) {
                updatedPlayer = incrementStat(updatedPlayer, 'bountiesCompleted');
            }

            if (qData.reward?.item) {
                const prevInvLen = updatedPlayer.inv.length;
                updatedPlayer = addItemByName(updatedPlayer, qData.reward.item);
                if (updatedPlayer.inv.length > prevInvLen) {
                    addLog('success', MSG.QUEST_REWARD_ITEM(qData.reward.item));
                }
            }

            // cycle 209: quest reward.title이 dead grant이던 회귀 fix — cycle 192가 TITLES 등록만
            //   하고 grant 경로는 미수리. claimQuestReward에서 reward.title이 있으면 player.titles에
            //   push하고 emitUnlockedTitles로 visual lookup 통합. Set으로 dedup (이미 보유 시 skip).
            //   영향 quest: 152(에테르 탐험가) / 153(공허의 방랑자) / 154(종말의 정복자) /
            //   201(지도 제작자) / 202(전설의 기록자).
            if (qData.reward?.title) {
                const titleToken = qData.reward.title;
                if (!(updatedPlayer.titles || []).includes(titleToken)) {
                    updatedPlayer = {
                        ...updatedPlayer,
                        titles: [...new Set([...(updatedPlayer.titles || []), titleToken])],
                        activeTitle: updatedPlayer.activeTitle || titleToken,
                    };
                    addLog('success', `🏆 칭호 획득: [${titleToken}]`);
                }
            }

            if (qData.buildTag) {
                const currentStats = getFullStats();
                const traitProfile = getTraitProfile(updatedPlayer, {
                    ...currentStats,
                    maxHp: updatedPlayer.maxHp,
                    maxMp: updatedPlayer.maxMp,
                });
                const resonance = getTraitQuestResonance(qData, traitProfile);
                if (resonance.score >= 6 && qData.reward?.gold) {
                    const bonusGold = Math.max(100, Math.floor(qData.reward.gold * 0.15));
                    updatedPlayer = grantGold(updatedPlayer, bonusGold);
                    addLog('event', MSG.QUEST_TRAIT_BONUS(traitProfile.title, bonusGold));
                }
            }

            updatedPlayer = syncLevelQuests(updatedPlayer);
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.questComplete });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.QUEST_DONE(qData.title));
            // cycle 122: 퀘스트 완료 sensory cue — E major arpeggio. cycle 117/118 사운드
            // 시리즈 패턴. 보상 / 칭호 해금이 동반되는 의미 있는 모먼트의 audio reflection.
            soundManager.play('quest_complete');
            // cycle 272: aiService 'questComplete' 스토리 템플릿 dispatch — cycle 122 sound와 paired
            //   narrative cue. 8 스토리 템플릿 중 levelUp/bossPhase2/questComplete/ruinRecap 4종 dead였던
            //   회귀 fix (questComplete 먼저). AI narrative blurb 또는 fallback 텍스트 표시.
            if (typeof addStoryLog === 'function') {
                addStoryLog('questComplete', { questTitle: qData.title });
            }
        },

        claimAchievement: (achId: any) => {
            const achData = DB.ACHIEVEMENTS.find((achievement: any) => achievement.id === achId);
            if (!achData) return;
            if (!isAchievementUnlocked(achData, player)) return addLog('error', MSG.ACH_NOT_UNLOCKED);

            const claimed = player.stats?.claimedAchievements || [];
            if (claimed.includes(achId)) return addLog('info', MSG.ACH_ALREADY_CLAIMED);

            let updatedPlayer = {
                ...player,
                stats: {
                    ...player.stats,
                    claimedAchievements: [...claimed, achId]
                }
            };

            if (achData.reward?.gold) updatedPlayer = grantGold(updatedPlayer, achData.reward.gold);
            if (achData.reward?.item) {
                const prevInvLen = updatedPlayer.inv.length;
                updatedPlayer = addItemByName(updatedPlayer, achData.reward.item);
                if (updatedPlayer.inv.length > prevInvLen) {
                    addLog('success', MSG.ACH_REWARD_ITEM(achData.reward.item));
                }
            }
            // cycle 215: premiumCurrency 보상이 silently drop되던 회귀 fix — 5 영구 업적
            //   (ach_abyss_200 / ach_abyss_300 / ach_sig_20 / ach_sig_set_all / ach_chain_all)이
            //   합계 300 💎를 절대 받을 수 없던 dead reward. cycle 209 quest reward.title 누락 패턴 동일 lens.
            if (achData.reward?.premiumCurrency) {
                const gain = Number(achData.reward.premiumCurrency) || 0;
                if (gain > 0) {
                    updatedPlayer = {
                        ...updatedPlayer,
                        premiumCurrency: (updatedPlayer.premiumCurrency || 0) + gain,
                    };
                    addLog('success', `💎 +${gain} 에테르 크리스탈 획득`);
                }
            }

            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.ACH_DONE(achData.title));
            // cycle 123: 업적 청구 sensory cue — cycle 122 quest_complete 사운드 재사용.
            // 퀘스트 완료와 업적 청구는 같은 결의 "달성/회수" 모먼트라 동일 음악적
            // 정체성(E major) 부여.
            soundManager.play('quest_complete');
        },

        // ── 주간 미션 수령 ────────────────────────────────────────────────
        claimWeeklyMission: (missionId: any, reward: any) => {
            dispatch({ type: AT.CLAIM_WEEKLY_MISSION, payload: { missionId, reward } });
            addLog('success', MSG.WEEKLY_MISSION_CLAIM(reward.gold || 0, reward.premiumCurrency));
            // cycle 261: claim 액션 sensory cue paired completion (cycle 122-123 패턴).
            //   "달성/회수" 모먼트 audio reflection — quest/achievement 사운드 재사용.
            soundManager.play('quest_complete');
        },

        // ── 시즌 패스 보상 수령 ──────────────────────────────────────────
        // cycle 261: SeasonPassPanel claimReward가 dispatch만 있고 addLog/sound 0건이던 UX
        //   dead path fix. quest/achievement/weekly와 동일 sensory cue.
        // cycle 595: rewardLabel default null 제거 — 1 caller (SeasonPassPanel:32
        //   onClaimSeasonReward(rewardTier, label)) 명시 전달이라 default 도달
        //   불가. body의 rewardLabel ternary는 별개 보존 (caller가 null/empty
        //   넘기는 path 활성).
        claimSeasonReward: (tier: any, rewardLabel: string | null) => {
            dispatch({ type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
            const label = rewardLabel ? `${rewardLabel}` : `티어 ${tier}`;
            addLog('success', `시즌 패스 보상 수령: ${label}`);
            soundManager.play('quest_complete');
        },
    });
};
