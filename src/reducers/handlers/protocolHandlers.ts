import { resolveDailyProtocolProgress } from './helpers';
import type { DailyProtocolReward } from './helpers';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import {
    getCurrentDailyProtocol,
    getCurrentWeeklyProtocol,
    getWeeklyMissionProgress,
} from '../../utils/protocolCycle';
import type { GameState, GameAction } from '../gameReducer';

const formatDailyReward = (reward: DailyProtocolReward) => {
    const parts: string[] = [];
    if (reward.essence > 0) parts.push(`에센스 +${reward.essence}`);
    reward.items.forEach((name: string) => parts.push(`${name} 획득`));
    if (reward.relicShards > 0) parts.push(`유물 파편 +${reward.relicShards}`);
    return parts.join(' · ');
};

const makeRewardLog = (text: string, index: number) => ({
    id: `daily-reward-${Date.now()}-${index}-${Math.random()}`,
    type: 'success',
    text,
});

export const protocolActionMap = {
    // ── Daily Protocol ────────────────────────────────────────────────────
    SET_DAILY_PROTOCOL: (state: GameState, action: GameAction) => ({
        ...state,
        player: {
            ...state.player,
            stats: { ...state.player.stats, dailyProtocol: action.payload },
        },
        syncStatus: 'syncing',
    }),

    UPDATE_DAILY_PROTOCOL: (state: GameState, action: GameAction) => {
        const { type: dpType, amount: rawAmount = 0 } = action.payload || {};
        if (!['kills', 'explores', 'goldSpend'].includes(dpType)) return state;
        const amount = dpType === 'goldSpend' ? Math.max(0, Number(rawAmount) || 0) : 1;
        const dailyProtocol = getCurrentDailyProtocol(state.player, new Date());
        const player = {
            ...state.player,
            stats: { ...state.player.stats, dailyProtocol },
        };
        const result = resolveDailyProtocolProgress(player, dpType, amount);
        const rewardText = formatDailyReward(result.reward);
        const notices: string[] = [];
        if (result.reward.completedCount > 0 && rewardText) {
            notices.push(MSG.DAILY_PROTOCOL_DONE(result.reward.completedCount, rewardText));
        }
        if (result.reward.convertedRelic) {
            const relicName = result.reward.convertedRelic.name || '새 유물';
            notices.push(MSG.DAILY_PROTOCOL_RELIC_COMPLETE(relicName));
        }

        return {
            ...state,
            player: result.player,
            logs: [
                ...state.logs,
                ...notices.map(makeRewardLog),
            ].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },

    // ── Weekly Protocol ───────────────────────────────────────────────────
    UPDATE_WEEKLY_PROTOCOL: (state: GameState, action: GameAction) => {
        const wpType = action.payload?.type;
        const wp = getCurrentWeeklyProtocol(state.player.weeklyProtocol, new Date());
        const key = wpType === 'kills' ? 'kills' : wpType === 'explores' ? 'explores' : wpType === 'bossKills' ? 'bossKills' : null;
        if (!key) return state;
        return {
            ...state,
            player: { ...state.player, weeklyProtocol: { ...wp, [key]: (wp[key] || 0) + 1 } },
            syncStatus: 'syncing',
        };
    },

    CLAIM_WEEKLY_MISSION: (state: GameState, action: GameAction) => {
        const missionId = action.payload?.missionId;
        const mission = BALANCE.WEEKLY_MISSIONS.find((entry: any) => entry.id === missionId);
        const wp = getCurrentWeeklyProtocol(state.player.weeklyProtocol, new Date());
        if (!mission || (wp.claimed || []).includes(missionId)) return state;
        if (getWeeklyMissionProgress(wp, missionId) < mission.target) return state;

        const reward = mission.reward || {};
        let p = {
            ...state.player,
            weeklyProtocol: { ...wp, claimed: [...(wp.claimed || []), missionId] },
        };
        if (reward.gold) p = { ...p, gold: (p.gold || 0) + reward.gold };
        if (reward.premiumCurrency) p = { ...p, premiumCurrency: (p.premiumCurrency || 0) + reward.premiumCurrency };
        return { ...state, player: p, syncStatus: 'syncing' };
    },
};
