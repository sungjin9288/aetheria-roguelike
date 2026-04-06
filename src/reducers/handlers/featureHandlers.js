import { findItemByName, makeItem } from '../../utils/gameUtils';
import { SEASON_TIER_XP, SEASON_REWARDS } from '../../data/seasonPass';
import { applyDailyProtocolProgress } from './helpers';

export const featureActionMap = {
    // ── Daily Protocol ────────────────────────────────────────────────────
    SET_DAILY_PROTOCOL: (state, action) => ({
        ...state,
        player: {
            ...state.player,
            stats: { ...state.player.stats, dailyProtocol: action.payload },
        },
        syncStatus: 'syncing',
    }),

    UPDATE_DAILY_PROTOCOL: (state, action) => {
        const { type: dpType, amount = 1 } = action.payload;
        if (!state.player.stats?.dailyProtocol) return state;
        return {
            ...state,
            player: applyDailyProtocolProgress(state.player, dpType, amount),
            syncStatus: 'syncing',
        };
    },

    // ── Codex ─────────────────────────────────────────────────────────────
    UPDATE_CODEX: (state, action) => {
        const { category, name } = action.payload;
        const codex = state.player.stats.codex || {};
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

    // ── Premium Currency ──────────────────────────────────────────────────
    SET_PREMIUM_CURRENCY: (state, action) => ({
        ...state,
        player: { ...state.player, premiumCurrency: action.payload },
        syncStatus: 'syncing',
    }),

    // ── Season Pass ───────────────────────────────────────────────────────
    ADD_SEASON_XP: (state, action) => {
        const sp = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
        const newXp = sp.xp + (action.payload || 0);
        const newTier = Math.min(30, Math.floor(newXp / SEASON_TIER_XP));
        return {
            ...state,
            player: { ...state.player, seasonPass: { ...sp, xp: newXp, tier: newTier } },
            syncStatus: 'syncing',
        };
    },

    CLAIM_SEASON_REWARD: (state, action) => {
        const { tier: claimTier } = action.payload;
        const sp = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
        if ((sp.claimed || []).includes(claimTier)) return state;
        const rewardRow = SEASON_REWARDS.find(r => r.tier === claimTier);
        if (!rewardRow) return state;
        const tracks = [rewardRow.free, sp.isPremium ? rewardRow.premium : null].filter(Boolean);
        let nextPlayer = {
            ...state.player,
            seasonPass: { ...sp, claimed: [...(sp.claimed || []), claimTier] },
        };
        for (const track of tracks) {
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

    CLAIM_CODEX_REWARD: (state, action) => {
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
    ENHANCE_ITEM: (state, action) => {
        const { itemId, success } = action.payload;
        const newInv = state.player.inv.map(item => {
            if (item.id !== itemId) return item;
            if (!success) return item;
            return { ...item, enhance: (item.enhance || 0) + 1 };
        });
        const equip = state.player.equip;
        const newEquip = {};
        for (const slot of ['weapon', 'armor', 'offhand']) {
            newEquip[slot] = (equip[slot]?.id === itemId && success)
                ? { ...equip[slot], enhance: (equip[slot].enhance || 0) + 1 }
                : equip[slot];
        }
        return {
            ...state,
            player: { ...state.player, inv: newInv, equip: newEquip },
            syncStatus: 'syncing',
        };
    },

    // ── Weekly Protocol ───────────────────────────────────────────────────
    UPDATE_WEEKLY_PROTOCOL: (state, action) => {
        const { type: wpType, amount: wpAmount = 1 } = action.payload;
        const wp = state.player.weeklyProtocol || { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] };
        const key = wpType === 'kills' ? 'kills' : wpType === 'explores' ? 'explores' : wpType === 'bossKills' ? 'bossKills' : null;
        if (!key) return state;
        return {
            ...state,
            player: { ...state.player, weeklyProtocol: { ...wp, [key]: (wp[key] || 0) + wpAmount } },
            syncStatus: 'syncing',
        };
    },

    CLAIM_WEEKLY_MISSION: (state, action) => {
        const { missionId, reward } = action.payload;
        const wp = state.player.weeklyProtocol || { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] };
        if ((wp.claimed || []).includes(missionId)) return state;
        let p = {
            ...state.player,
            weeklyProtocol: { ...wp, claimed: [...(wp.claimed || []), missionId] },
        };
        if (reward.gold) p = { ...p, gold: (p.gold || 0) + reward.gold };
        if (reward.premiumCurrency) p = { ...p, premiumCurrency: (p.premiumCurrency || 0) + reward.premiumCurrency };
        return { ...state, player: p, syncStatus: 'syncing' };
    },

    // ── Challenge Modifiers ───────────────────────────────────────────────
    SET_CHALLENGE_MODIFIERS: (state, action) => ({
        ...state,
        player: { ...state.player, challengeModifiers: action.payload || [] },
        syncStatus: 'syncing',
    }),

    // ── Skill Branch ──────────────────────────────────────────────────────
    CHOOSE_SKILL_BRANCH: (state, action) => {
        const { skillName, choice } = action.payload;
        return {
            ...state,
            player: {
                ...state.player,
                skillChoices: { ...(state.player.skillChoices || {}), [skillName]: choice },
            },
            syncStatus: 'syncing',
        };
    },

    // ── Grave PvP ─────────────────────────────────────────────────────────
    SET_PUBLIC_GRAVES: (state, action) =>
        ({ ...state, publicGraves: action.payload }),

    INVADE_GRAVE: (state, action) => {
        const { reward, uid: targetUid } = action.payload;
        const today = new Date().toDateString();
        const lastInvadeDate = state.player.stats?.lastInvadeDate;
        const currentCount = lastInvadeDate === today ? (state.player.stats?.dailyInvadeCount || 0) : 0;
        const nextInv = reward
            ? [...(state.player.inv || []), reward]
            : state.player.inv;
        return {
            ...state,
            player: {
                ...state.player,
                inv: nextInv,
                stats: {
                    ...(state.player.stats || {}),
                    dailyInvadeCount: currentCount + 1,
                    lastInvadeDate: today,
                },
            },
            publicGraves: state.publicGraves.filter((g) => g.uid !== targetUid),
            syncStatus: 'syncing',
        };
    },
};
