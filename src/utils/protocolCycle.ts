import { BALANCE } from '../data/constants.js';
import type { Player } from '../types/player.js';

type WeeklyProtocol = NonNullable<Player['weeklyProtocol']>;

const pad = (value: number) => String(value).padStart(2, '0');

export const getProtocolDayKey = (date: Date) => (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

export const getProtocolWeekKey = (date: Date) => {
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const year = day.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((day.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${year}-W${pad(week)}`;
};

export const createDailyProtocol = (player: Player, date: Date) => {
    const level = player.level || 1;
    const relicShards = player.stats?.dailyProtocol?.relicShards || 0;
    return {
        date: getProtocolDayKey(date),
        relicShards,
        missions: [
            { id: 'kill_n', type: 'kills', goal: Math.max(10, level * 2), reward: { essence: Math.floor(level * 5) }, progress: 0, done: false },
            { id: 'explore_n', type: 'explores', goal: 10, reward: { item: '중급 체력 물약' }, progress: 0, done: false },
            { id: 'gold_n', type: 'goldSpend', goal: Math.max(300, level * 20), reward: { relicShard: 1 }, progress: 0, done: false },
        ],
    };
};

export const getCurrentDailyProtocol = (player: Player, date: Date) => {
    const protocol = player.stats?.dailyProtocol;
    if (protocol?.date === getProtocolDayKey(date) && protocol.missions?.length === 3) return protocol;
    return createDailyProtocol(player, date);
};

export const createWeeklyProtocol = (date: Date): WeeklyProtocol => ({
    kills: 0,
    explores: 0,
    bossKills: 0,
    lastResetWeek: getProtocolWeekKey(date),
    claimed: [],
});

export const getCurrentWeeklyProtocol = (protocol: WeeklyProtocol | undefined, date: Date): WeeklyProtocol => {
    if (protocol?.lastResetWeek !== getProtocolWeekKey(date)) return createWeeklyProtocol(date);
    return {
        kills: Math.max(0, Number(protocol.kills) || 0),
        explores: Math.max(0, Number(protocol.explores) || 0),
        bossKills: Math.max(0, Number(protocol.bossKills) || 0),
        lastResetWeek: protocol.lastResetWeek,
        claimed: Array.isArray(protocol.claimed) ? protocol.claimed : [],
    };
};

export const getWeeklyMissionProgress = (protocol: WeeklyProtocol, missionId: string) => {
    if (missionId === 'weeklyKills') return protocol.kills || 0;
    if (missionId === 'weeklyExplore') return protocol.explores || 0;
    if (missionId === 'weeklyBoss') return protocol.bossKills || 0;
    return 0;
};

export const getWeeklyMissionRows = (protocol: WeeklyProtocol) => (
    BALANCE.WEEKLY_MISSIONS.map((mission: any) => {
        const current = getWeeklyMissionProgress(protocol, mission.id);
        return {
            ...mission,
            current,
            done: current >= mission.target,
            claimed: (protocol.claimed || []).includes(mission.id),
        };
    })
);
