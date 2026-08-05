import { DB } from '../../data/db';
import {
    findItemByName,
    grantGold,
    isAchievementUnlocked,
    makeItem,
} from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { SEASON_TIER_XP, SEASON_REWARDS, SEASON_XP } from '../../data/seasonPass';
import { getClaimableCodexMilestone } from '../../data/codexRewards';
import { formatCodexRewardParts } from '../../utils/codexPresentation';
import { normalizeClaimedSeasonTiers, SEASON_MAX_TIER, SEASON_MAX_XP } from '../../utils/seasonPassPresentation';
import { getPacedQuestClaimExp } from '../../utils/progressionPacing';
import { getTraitProfile, getTraitQuestResonance } from '../../utils/runProfileUtils';
import { calculateFullStats } from '../../utils/statsCalculator';
import { removeExpeditionFocusQuest } from '../../utils/expeditionMissionFocus';
import { CombatEngine } from '../../systems/CombatEngine';
import { MSG } from '../../data/messages';
import { appendRewardLogs } from './rewardLog';
import { addNewTitles, addSeasonXp } from './helpers';
import type { GameState, GameAction } from '../gameReducer';

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

export const rewardActionMap = {
    // ── Codex ─────────────────────────────────────────────────────────────
    UPDATE_CODEX: (state: GameState, action: GameAction) => {
        const { category, name } = action.payload;
        const codex: Record<string, any> = (state.player.stats as any)?.codex || {};
        const cat = codex[category] || {};
        if (cat[name]) return state;
        return {
            ...state,
            player: {
                ...state.player,
                stats: {
                    ...state.player.stats,
                    codex: {
                        ...codex,
                        // cycle 438: timestamp 출력 dead 제거 (cycle 333-356 시리즈 회귀).
                        [category]: { ...cat, [name]: { discovered: true } },
                    },
                },
            },
            syncStatus: 'syncing',
        };
    },

    // ── Season Pass ───────────────────────────────────────────────────────
    ADD_SEASON_XP: (state: GameState, action: GameAction) => {
        const sp = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
        const earnedXp = Number(action.payload);
        if (!Number.isFinite(earnedXp) || earnedXp <= 0) return state;

        const currentXp = Math.max(0, Number(sp.xp) || 0);
        const newXp = Math.min(SEASON_MAX_XP, currentXp + earnedXp);
        if (newXp === currentXp) return state;
        const newTier = Math.min(SEASON_MAX_TIER, Math.floor(newXp / SEASON_TIER_XP));
        return {
            ...state,
            player: { ...state.player, seasonPass: { ...sp, xp: newXp, tier: newTier } },
            syncStatus: 'syncing',
        };
    },

    CLAIM_QUEST_REWARD: (state: GameState, action: GameAction) => {
        const questId = action.payload?.questId;
        const activeQuest = (state.player.quests || []).find((quest: any) => quest.id === questId);
        if (!activeQuest) return state;

        const quest = activeQuest.isBounty
            ? activeQuest
            : DB.QUESTS.find((entry: any) => entry.id === questId);
        if (!quest || (activeQuest.progress || 0) < (quest.goal || 0)) return state;

        const claimedQuestIds = Array.isArray(state.player.stats?.claimedQuestIds)
            ? state.player.stats.claimedQuestIds
            : [];
        if (!activeQuest.isBounty && claimedQuestIds.includes(questId)) return state;

        const logs: Array<{ type: string; text: string }> = [];
        let nextPlayer: any = removeExpeditionFocusQuest({
            ...state.player,
            quests: (state.player.quests || []).filter((entry: any) => entry.id !== questId),
            stats: {
                ...state.player.stats,
                claimedQuestIds: activeQuest.isBounty
                    ? claimedQuestIds
                    : [...claimedQuestIds, questId],
                bountiesCompleted: activeQuest.isBounty
                    ? (state.player.stats?.bountiesCompleted || 0) + 1
                    : state.player.stats?.bountiesCompleted || 0,
            },
        }, questId);

        if (quest.reward?.gold) nextPlayer = grantGold(nextPlayer, quest.reward.gold);

        let visualEffect = state.visualEffect;
        if (quest.reward?.exp) {
            const pacedExp = getPacedQuestClaimExp(nextPlayer, quest.reward.exp);
            const expResult = CombatEngine.applyExpGain(nextPlayer, pacedExp);
            nextPlayer = expResult.updatedPlayer;
            logs.push(...expResult.logs);
            if (expResult.visualEffect) visualEffect = expResult.visualEffect;
        }

        if (quest.reward?.item) {
            const inventorySize = (nextPlayer.inv || []).length;
            nextPlayer = addItemByName(nextPlayer, quest.reward.item);
            if ((nextPlayer.inv || []).length > inventorySize) {
                logs.push({ type: 'success', text: MSG.QUEST_REWARD_ITEM(quest.reward.item) });
            }
        }

        if (quest.reward?.title && !(nextPlayer.titles || []).includes(quest.reward.title)) {
            nextPlayer = {
                ...nextPlayer,
                titles: [...(nextPlayer.titles || []), quest.reward.title],
                activeTitle: nextPlayer.activeTitle || quest.reward.title,
            };
            logs.push({ type: 'success', text: MSG.TITLE_UNLOCKED(quest.reward.title) });
        }

        if (quest.buildTag && quest.reward?.gold) {
            const fullStats = calculateFullStats(nextPlayer);
            const traitProfile = getTraitProfile(nextPlayer, {
                ...fullStats,
                maxHp: nextPlayer.maxHp,
                maxMp: nextPlayer.maxMp,
            });
            const resonance = getTraitQuestResonance(quest, traitProfile);
            if (resonance.score >= 6) {
                const bonusGold = Math.max(100, Math.floor(quest.reward.gold * 0.15));
                nextPlayer = grantGold(nextPlayer, bonusGold);
                logs.push({ type: 'event', text: MSG.QUEST_TRAIT_BONUS(traitProfile.title, bonusGold) });
            }
        }

        const questProgress = CombatEngine.updateQuestProgress(nextPlayer, '');
        nextPlayer = { ...nextPlayer, quests: questProgress.updatedQuests };
        nextPlayer = addSeasonXp(nextPlayer, SEASON_XP.questComplete);
        nextPlayer = addNewTitles(nextPlayer, logs);
        logs.push({ type: 'success', text: MSG.QUEST_DONE(quest.title) });

        const receiptKey = [
            String(questId),
            nextPlayer.stats?.claimedQuestIds?.length || 0,
            nextPlayer.stats?.bountiesCompleted || 0,
        ].join(':');

        return {
            ...state,
            player: nextPlayer,
            logs: appendRewardLogs(state.logs, logs),
            visualEffect,
            questClaimReceipt: { key: receiptKey, questId, title: quest.title },
            syncStatus: 'syncing',
        };
    },

    CLAIM_ACHIEVEMENT_REWARD: (state: GameState, action: GameAction) => {
        const achievementId = action.payload?.achievementId;
        const achievement = DB.ACHIEVEMENTS.find((entry: any) => entry.id === achievementId);
        if (!achievement || !isAchievementUnlocked(achievement, state.player)) return state;

        const claimedAchievements = Array.isArray(state.player.stats?.claimedAchievements)
            ? state.player.stats.claimedAchievements
            : [];
        if (claimedAchievements.includes(achievementId)) return state;

        const logs: Array<{ type: string; text: string }> = [];
        let nextPlayer: any = {
            ...state.player,
            stats: {
                ...state.player.stats,
                claimedAchievements: [...claimedAchievements, achievementId],
            },
        };

        if (achievement.reward?.gold) nextPlayer = grantGold(nextPlayer, achievement.reward.gold);
        if (achievement.reward?.item) {
            const inventorySize = (nextPlayer.inv || []).length;
            nextPlayer = addItemByName(nextPlayer, achievement.reward.item);
            if ((nextPlayer.inv || []).length > inventorySize) {
                logs.push({ type: 'success', text: MSG.ACH_REWARD_ITEM(achievement.reward.item) });
            }
        }
        if (achievement.reward?.premiumCurrency) {
            const premiumCurrency = Math.max(0, Number(achievement.reward.premiumCurrency) || 0);
            nextPlayer = {
                ...nextPlayer,
                premiumCurrency: (nextPlayer.premiumCurrency || 0) + premiumCurrency,
            };
            if (premiumCurrency > 0) {
                logs.push({ type: 'success', text: `에테르 크리스탈 +${formatNumber(premiumCurrency)}` });
            }
        }

        nextPlayer = addNewTitles(nextPlayer, logs);
        logs.push({ type: 'success', text: MSG.ACH_DONE(achievement.title) });

        return {
            ...state,
            player: nextPlayer,
            logs: appendRewardLogs(state.logs, logs),
            syncStatus: 'syncing',
        };
    },

    CLAIM_SEASON_REWARD: (state: GameState, action: GameAction) => {
        const claimTier = Number(action.payload?.tier);
        const sp = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
        const unlockedTier = Math.min(SEASON_MAX_TIER, Math.max(
            0,
            Math.floor(Number(sp.tier) || 0),
            Math.floor(Math.max(0, Number(sp.xp) || 0) / SEASON_TIER_XP),
        ));
        const claimedTiers = normalizeClaimedSeasonTiers(sp.claimed);
        if (!Number.isInteger(claimTier) || claimTier < 1 || claimTier > unlockedTier) return state;
        if (claimedTiers.includes(claimTier)) return state;
        const rewardRow = SEASON_REWARDS.find((row) => row.tier === claimTier);
        if (!rewardRow) return state;
        const tracks = [rewardRow.free, sp.isPremium ? rewardRow.premium : null].filter(Boolean);
        let goldGain = 0;
        let premiumCurrencyGain = 0;
        const grantedItems: string[] = [];
        const grantedTitles: string[] = [];
        let nextPlayer = {
            ...state.player,
            seasonPass: { ...sp, claimed: [...(sp.claimed || []), claimTier] },
        };
        for (const track of tracks as Array<any>) {
            if (track.gold) goldGain += track.gold;
            if (track.premiumCurrency) premiumCurrencyGain += track.premiumCurrency;
            if (track.title) {
                const tl = nextPlayer.titles || [];
                if (!tl.includes(track.title)) {
                    grantedTitles.push(track.title);
                    nextPlayer = { ...nextPlayer, titles: [...tl, track.title] };
                }
            }
            if (track.item) {
                const itemTemplate = findItemByName(track.item);
                if (itemTemplate) {
                    grantedItems.push(track.item);
                    nextPlayer = { ...nextPlayer, inv: [...(nextPlayer.inv || []), makeItem(itemTemplate)] };
                }
            }
        }
        if (goldGain > 0) nextPlayer = { ...nextPlayer, gold: (nextPlayer.gold || 0) + goldGain };
        if (premiumCurrencyGain > 0) {
            nextPlayer = {
                ...nextPlayer,
                premiumCurrency: (nextPlayer.premiumCurrency || 0) + premiumCurrencyGain,
            };
        }

        const rewardParts = [
            goldGain > 0 ? `골드 ${formatNumber(goldGain)}` : null,
            premiumCurrencyGain > 0 ? `에테르 크리스탈 ${formatNumber(premiumCurrencyGain)}` : null,
            ...grantedItems,
            ...grantedTitles.map((title) => `칭호 ${title}`),
        ].filter((part): part is string => Boolean(part));

        return {
            ...state,
            player: nextPlayer,
            logs: appendRewardLogs(state.logs, [
                `시즌 ${claimTier}단계 보상 · ${rewardParts.join(' · ') || '수령 완료'}`,
            ]),
            syncStatus: 'syncing',
        };
    },

    CLAIM_CODEX_REWARD: (state: GameState, action: GameAction) => {
        const milestoneId = action.payload?.milestoneId;
        const prevClaimed = state.player.stats?.codexClaimed || [];
        if (prevClaimed.includes(milestoneId)) return state;
        const milestone = getClaimableCodexMilestone(
            state.player.stats?.codex || {},
            prevClaimed,
            milestoneId,
        );
        if (!milestone) return state;

        const reward = milestone.reward || {};
        let p = {
            ...state.player,
            stats: {
                ...state.player.stats,
                codexClaimed: [...prevClaimed, milestoneId],
                codexBonusAtk: (state.player.stats?.codexBonusAtk || 0) + (reward.atk || 0),
                codexBonusDef: (state.player.stats?.codexBonusDef || 0) + (reward.def || 0),
                codexBonusHp: (state.player.stats?.codexBonusHp || 0) + (reward.hp || 0),
            },
        };
        if (reward.gold) p = { ...p, gold: (p.gold || 0) + reward.gold };
        if (reward.premiumCurrency) p = { ...p, premiumCurrency: (p.premiumCurrency || 0) + reward.premiumCurrency };
        const rewardText = formatCodexRewardParts(reward).join(' · ');
        return {
            ...state,
            player: p,
            logs: appendRewardLogs(state.logs, [
                `도감 보상 · ${milestone.label} · ${rewardText}`,
            ]),
            syncStatus: 'syncing',
        };
    },

};
