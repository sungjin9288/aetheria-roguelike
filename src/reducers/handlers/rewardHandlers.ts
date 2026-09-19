import { DB } from '../../data/db';
import {
    findItemByName,
    grantGold,
    isAchievementUnlocked,
    makeItem,
} from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { SEASON_TIER_XP, SEASON_XP } from '../../data/seasonPass';
import type { SeasonReward } from '../../data/seasonPass';
import { getClaimableCodexMilestone } from '../../data/codexRewards';
import { formatCodexRewardParts, type CodexReward } from '../../utils/codexPresentation';
import {
    advanceSeasonIfComplete,
    createSeasonPassState,
    formatSeasonScale,
    getActiveSeason,
    getActiveSeasonRewards,
    normalizeClaimedSeasonTiers,
    SEASON_MAX_TIER,
    SEASON_MAX_XP,
} from '../../utils/seasonPassPresentation';
import { getPacedQuestClaimExp } from '../../utils/progressionPacing';
import { scaleProgressionExpReward } from '../../data/progressionProfiles';
import { getTraitProfile, getTraitQuestResonance } from '../../utils/runProfileUtils';
import { calculateFullStats } from '../../utils/statsCalculator';
import { removeExpeditionFocusQuest } from '../../utils/expeditionMissionFocus';
import { CombatEngine } from '../../systems/CombatEngine';
import { MSG } from '../../data/messages';
import { appendRewardLogs } from './rewardLog';
import { addNewTitles, addSeasonXp } from './helpers';
import type { GameState, HandlerMap } from '../gameReducer';
import type { CodexEntry, Player } from '../../types';

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

export const rewardActionMap = {
    // ── Codex ─────────────────────────────────────────────────────────────
    UPDATE_CODEX: (state, action) => {
        const { category, name } = action.payload;
        const codex: NonNullable<NonNullable<Player['stats']>['codex']> = state.player.stats?.codex || {};
        const cat: Record<string, CodexEntry> = codex[category] || {};
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
    // 2026-09 Wave 13 E3 통합: 이 핸들러가 helpers.addSeasonXp와 같은 계산을 독립
    //   구현하고 있었고, 전투 승리(kill/bossKill)·탐험·전설 드롭이 전부 이 경로로
    //   들어오므로 **지배적 XP 경로가 E3의 이월 수정을 받지 못했다**(퀘스트 보상만
    //   helpers를 거쳤다). 위임으로 바꿔 상한 클램프의 자리를 한 곳으로 통일한다 —
    //   두 구현이 갈라지면 "어느 경로로 번 XP인가"에 따라 이월 여부가 달라진다.
    ADD_SEASON_XP: (state, action) => {
        const earnedXp = Number(action.payload);
        if (!Number.isFinite(earnedXp) || earnedXp <= 0) return state;

        const nextPlayer = addSeasonXp(state.player, earnedXp);
        if (nextPlayer === state.player) return state;
        return { ...state, player: nextPlayer, syncStatus: 'syncing' };
    },

    CLAIM_QUEST_REWARD: (state, action) => {
        const questId = action.payload?.questId;
        const activeQuest = (state.player.quests || []).find((quest) => quest.id === questId);
        if (!activeQuest) return state;

        // W2 (Wave 5): 현상수배는 런타임 생성이라 자기 자신이 정의고, 카탈로그 퀘스트는
        //   DB.QUESTS가 정의다. buildTag 같은 카탈로그 전용 필드는 catalogQuest로만 읽는다.
        const catalogQuest = activeQuest.isBounty
            ? null
            : DB.QUESTS.find((entry) => entry.id === questId);
        const quest = activeQuest.isBounty ? activeQuest : catalogQuest;
        if (!quest || (activeQuest.progress || 0) < (quest.goal || 0)) return state;

        const claimedQuestIds = Array.isArray(state.player.stats?.claimedQuestIds)
            ? state.player.stats.claimedQuestIds
            : [];
        if (!activeQuest.isBounty && claimedQuestIds.includes(questId)) return state;

        const logs: Array<{ type: string; text: string }> = [];
        let nextPlayer: Player = removeExpeditionFocusQuest({
            ...state.player,
            quests: (state.player.quests || []).filter((entry) => entry.id !== questId),
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
            const pacedExp = getPacedQuestClaimExp(
                nextPlayer,
                scaleProgressionExpReward(nextPlayer, quest.reward.exp),
            );
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

        if (catalogQuest?.buildTag && quest.reward?.gold) {
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
            questClaimReceipt: { key: receiptKey, questId, title: quest.title ?? '' },
            syncStatus: 'syncing',
        };
    },

    CLAIM_ACHIEVEMENT_REWARD: (state, action) => {
        const achievementId = action.payload?.achievementId;
        const achievement = DB.ACHIEVEMENTS.find((entry) => entry.id === achievementId);
        if (!achievement || !isAchievementUnlocked(achievement, state.player)) return state;

        const claimedAchievements = Array.isArray(state.player.stats?.claimedAchievements)
            ? state.player.stats.claimedAchievements
            : [];
        if (claimedAchievements.includes(achievementId)) return state;

        const logs: Array<{ type: string; text: string }> = [];
        let nextPlayer: Player = {
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

    CLAIM_SEASON_REWARD: (state, action) => {
        const claimTier = Number(action.payload?.tier);
        const sp = state.player.seasonPass || createSeasonPassState();
        const unlockedTier = Math.min(SEASON_MAX_TIER, Math.max(
            0,
            Math.floor(Number(sp.tier) || 0),
            Math.floor(Math.max(0, Number(sp.xp) || 0) / SEASON_TIER_XP),
        ));
        const claimedTiers = normalizeClaimedSeasonTiers(sp.claimed);
        if (!Number.isInteger(claimTier) || claimTier < 1 || claimTier > unlockedTier) return state;
        if (claimedTiers.includes(claimTier)) return state;
        // 2026-09 Wave 12 D2: 보상 테이블은 현재 시즌에서 도출된다 — 시즌 1은
        //   SEASON_REWARDS 그 자체(배율 1)이고, 이후 시즌만 숫자 보상이 스케일된다.
        const rewardRow = getActiveSeasonRewards(sp).find((row) => row.tier === claimTier);
        if (!rewardRow) return state;
        const tracks = [rewardRow.free, sp.isPremium ? rewardRow.premium : null]
            .filter((entry): entry is SeasonReward => Boolean(entry));
        let goldGain = 0;
        let premiumCurrencyGain = 0;
        const grantedItems: string[] = [];
        const grantedTitles: string[] = [];
        let nextPlayer: Player = {
            ...state.player,
            seasonPass: { ...sp, claimed: [...(sp.claimed || []), claimTier] },
        };
        for (const track of tracks) {
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

        const claimLogs: Array<{ type: string; text: string }> = [{
            type: 'success',
            text: `시즌 ${claimTier}단계 보상 · ${rewardParts.join(' · ') || '수령 완료'}`,
        }];

        // 2026-09 Wave 12 D2 — 완주 회전.
        //   트리거는 벽시계가 아니라 **마지막 티어 보상 수령**이다(수령이 곧 지급이므로
        //   XP 상한 도달에서 회전시키면 미수령 보상이 통째로 사라진다).
        //   리셋 직전에 checkTitles를 한 번 돌린다 — 'seasonTier' 칭호의 복구 폴백은
        //   살아 있는 seasonPass.tier를 읽으므로(gameUtils.checkTitles), 티어가 최대인
        //   이 순간에 확정해두지 않으면 리셋 뒤에 되찾을 수 없다.
        const rotated = advanceSeasonIfComplete(nextPlayer.seasonPass);
        if (rotated) {
            nextPlayer = addNewTitles(nextPlayer, claimLogs);
            const completedSeason = getActiveSeason(nextPlayer.seasonPass);
            const nextSeason = getActiveSeason(rotated);
            nextPlayer = { ...nextPlayer, seasonPass: rotated };
            claimLogs.push({
                type: 'success',
                text: MSG.SEASON_ROTATED(
                    MSG.SEASON_NAME(completedSeason.ordinal),
                    MSG.SEASON_NAME(nextSeason.ordinal),
                    formatSeasonScale(nextSeason.rewardScale),
                ),
            });
        }

        return {
            ...state,
            player: nextPlayer,
            logs: appendRewardLogs(state.logs, claimLogs),
            syncStatus: 'syncing',
        };
    },

    CLAIM_CODEX_REWARD: (state, action) => {
        const milestoneId = action.payload?.milestoneId;
        const prevClaimed = state.player.stats?.codexClaimed || [];
        if (prevClaimed.includes(milestoneId)) return state;
        const milestone = getClaimableCodexMilestone(
            state.player.stats?.codex || {},
            prevClaimed,
            milestoneId,
        );
        if (!milestone) return state;

        const reward: CodexReward = milestone.reward || {};
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

} satisfies HandlerMap;
