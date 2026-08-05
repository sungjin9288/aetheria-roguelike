import { findItemByName, makeItem } from '../../utils/gameUtils';
import { SEASON_TIER_XP, SEASON_REWARDS } from '../../data/seasonPass';
import { getClaimableCodexMilestone } from '../../data/codexRewards';
import { formatCodexRewardParts } from '../../utils/codexPresentation';
import { normalizeClaimedSeasonTiers, SEASON_MAX_TIER, SEASON_MAX_XP } from '../../utils/seasonPassPresentation';
import { appendRewardLogs } from './rewardLog';
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

    // ── Item Enhancement ──────────────────────────────────────────────────
    ENHANCE_ITEM: (state: GameState, action: GameAction) => {
        const {
            itemId,
            slot: slotName,
            success,
            expectedLevel,
            goldCost,
            materialName,
            materialCount,
        } = action.payload;
        const equip: Record<string, any> = state.player.equip || {};
        const currentItem = (state.player.inv || []).find((item: any) => item.id === itemId)
            || (slotName ? equip[slotName] : null)
            || Object.values(equip).find((item: any) => item?.id === itemId);
        if (!currentItem || (currentItem.enhance || 0) !== expectedLevel) return state;
        if ((state.player.gold || 0) < goldCost) return state;

        let removedMaterials = 0;
        const inventoryAfterCost = (state.player.inv || []).filter((item: any) => {
            if (item?.name !== materialName || removedMaterials >= materialCount) return true;
            removedMaterials += 1;
            return false;
        });
        if (removedMaterials < materialCount) return state;

        const newInv = inventoryAfterCost.map((item: any) => {
            if (item.id !== itemId) return item;
            if (!success) return item;
            return { ...item, enhance: (item.enhance || 0) + 1 };
        });
        const newEquip: Record<string, any> = {};
        for (const key of ['weapon', 'armor', 'offhand']) {
            const shouldEnhance = success && (
                (slotName && slotName === key)
                || equip[key]?.id === itemId
            );
            newEquip[key] = shouldEnhance
                ? { ...equip[key], enhance: (equip[key].enhance || 0) + 1 }
                : equip[key];
        }
        return {
            ...state,
            player: {
                ...state.player,
                gold: (state.player.gold || 0) - goldCost,
                inv: newInv,
                equip: newEquip,
            },
            syncStatus: 'syncing',
        };
    },
};
