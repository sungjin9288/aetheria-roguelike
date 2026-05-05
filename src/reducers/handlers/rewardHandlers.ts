import { findItemByName, makeItem } from '../../utils/gameUtils';
import { SEASON_TIER_XP, SEASON_REWARDS } from '../../data/seasonPass';
import type { GameState, GameAction } from '../gameReducer';

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
                        [category]: { ...cat, [name]: { discovered: true, obtainedAt: Date.now() } },
                    },
                },
            },
            syncStatus: 'syncing',
        };
    },

    // ── Season Pass ───────────────────────────────────────────────────────
    ADD_SEASON_XP: (state: GameState, action: GameAction) => {
        const sp = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
        const newXp = sp.xp + (action.payload || 0);
        const newTier = Math.min(30, Math.floor(newXp / SEASON_TIER_XP));
        return {
            ...state,
            player: { ...state.player, seasonPass: { ...sp, xp: newXp, tier: newTier } },
            syncStatus: 'syncing',
        };
    },

    CLAIM_SEASON_REWARD: (state: GameState, action: GameAction) => {
        const { tier: claimTier } = action.payload;
        const sp = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
        if ((sp.claimed || []).includes(claimTier)) return state;
        const rewardRow = SEASON_REWARDS.find((r: any) => r.tier === claimTier);
        if (!rewardRow) return state;
        const tracks = [rewardRow.free, sp.isPremium ? rewardRow.premium : null].filter(Boolean);
        let nextPlayer = {
            ...state.player,
            seasonPass: { ...sp, claimed: [...(sp.claimed || []), claimTier] },
        };
        for (const track of tracks as Array<any>) {
            if (track.gold) nextPlayer = { ...nextPlayer, gold: (nextPlayer.gold || 0) + track.gold };
            if (track.premiumCurrency) nextPlayer = { ...nextPlayer, premiumCurrency: (nextPlayer.premiumCurrency || 0) + track.premiumCurrency };
            if (track.title) {
                const tl = nextPlayer.titles || [];
                if (!tl.includes(track.title)) nextPlayer = { ...nextPlayer, titles: [...tl, track.title] };
            }
            if (track.item) {
                const itemTemplate = findItemByName(track.item);
                if (itemTemplate) nextPlayer = { ...nextPlayer, inv: [...(nextPlayer.inv || []), makeItem(itemTemplate)] };
            }
        }
        return { ...state, player: nextPlayer, syncStatus: 'syncing' };
    },

    CLAIM_CODEX_REWARD: (state: GameState, action: GameAction) => {
        const { milestoneId, reward } = action.payload;
        const prevClaimed = state.player.stats?.codexClaimed || [];
        if (prevClaimed.includes(milestoneId)) return state;
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
        return { ...state, player: p, syncStatus: 'syncing' };
    },

    // ── Item Enhancement ──────────────────────────────────────────────────
    ENHANCE_ITEM: (state: GameState, action: GameAction) => {
        const { itemId, slot: slotName, success } = action.payload;
        const newInv = (state.player.inv || []).map((item: any) => {
            if (item.id !== itemId) return item;
            if (!success) return item;
            return { ...item, enhance: (item.enhance || 0) + 1 };
        });
        const equip: Record<string, any> = state.player.equip || {};
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
            player: { ...state.player, inv: newInv, equip: newEquip },
            syncStatus: 'syncing',
        };
    },
};
