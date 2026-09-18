import { advanceDailyProtocol, getDailyProtocolRewardLogs } from './helpers';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { appendRewardLogs } from './rewardLog';
import {
    getCurrentWeeklyProtocol,
    getWeeklyMissionProgress,
} from '../../utils/protocolCycle';
import type { GameState, GameAction } from '../gameReducer';

/**
 * `BALANCE.WEEKLY_MISSIONS` 원소 형태 — `BalanceConfig`가 `[key: string]: any` 인덱스
 * 시그니처를 갖고 있어(constants.ts) `BALANCE.WEEKLY_MISSIONS` 자체는 `any`다.
 * 이 파일에서만 실제 리터럴(`data/constants.ts` 실측 3건) 모양으로 좁혀 쓴다.
 */
interface WeeklyMissionDef {
    id: string;
    target: number;
    reward: { gold?: number; premiumCurrency?: number };
    label: string;
}

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
        const result = advanceDailyProtocol(
            state.player,
            dpType,
            amount,
            action.payload?.relicRoll,
            action.payload?.now,
            typeof action.payload?.itemRng === 'function' ? action.payload.itemRng : undefined,
        );

        return {
            ...state,
            player: result.player,
            logs: appendRewardLogs(
                state.logs,
                getDailyProtocolRewardLogs(result.reward),
                { now: action.payload?.now, seed: action.payload?.logSeed },
            ),
            syncStatus: 'syncing',
        };
    },

    // ── Weekly Protocol ───────────────────────────────────────────────────
    UPDATE_WEEKLY_PROTOCOL: (state: GameState, action: GameAction) => {
        const wpType = action.payload?.type;
        const requestedAt = Number(action.payload?.now);
        const wp = getCurrentWeeklyProtocol(
            state.player.weeklyProtocol,
            Number.isFinite(requestedAt) ? new Date(requestedAt) : new Date(),
        );
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
        const mission = (BALANCE.WEEKLY_MISSIONS as WeeklyMissionDef[]).find((entry) => entry.id === missionId);
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
        return {
            ...state,
            player: p,
            logs: appendRewardLogs(state.logs, [
                MSG.WEEKLY_MISSION_CLAIM(reward.gold || 0, reward.premiumCurrency),
            ]),
            syncStatus: 'syncing',
        };
    },
};
