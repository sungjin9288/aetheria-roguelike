import { applyDailyProtocolProgress } from './helpers';

export const protocolActionMap = {
    // ── Daily Protocol ────────────────────────────────────────────────────
    SET_DAILY_PROTOCOL: (state: any, action: any) => ({
        ...state,
        player: {
            ...state.player,
            stats: { ...state.player.stats, dailyProtocol: action.payload },
        },
        syncStatus: 'syncing',
    }),

    UPDATE_DAILY_PROTOCOL: (state: any, action: any) => {
        const { type: dpType, amount = 1 } = action.payload;
        if (!state.player.stats?.dailyProtocol) return state;
        return {
            ...state,
            player: applyDailyProtocolProgress(state.player, dpType, amount),
            syncStatus: 'syncing',
        };
    },

    // ── Weekly Protocol ───────────────────────────────────────────────────
    UPDATE_WEEKLY_PROTOCOL: (state: any, action: any) => {
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

    CLAIM_WEEKLY_MISSION: (state: any, action: any) => {
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
};
