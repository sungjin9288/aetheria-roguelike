/**
 * returnBriefing.ts — 복귀 브리핑 카드 데이터 빌더 (순수 함수).
 *
 * 부팅 완료(bootStage 'ready') 후 마지막 플레이로부터 BALANCE.RETURN_BRIEFING_HOURS
 * 이상 지났으면 표시할 요약 정보를 만든다. player.stats.lastSeenAt(ms)이 없거나
 * 임계값 미만이면 null을 반환해 카드 자체를 렌더링하지 않는다.
 */
import { BALANCE } from '../data/constants';
import { buildChainJournal } from './chainJournal';
import { getActiveQuestEntries } from './gameUtils';
import {
    getCurrentDailyProtocol,
    getCurrentWeeklyProtocol,
    getWeeklyMissionRows,
} from './protocolCycle';
import type { Player } from '../types/index.js';

export interface Briefing {
    loc: string;
    level: number;
    hp: number;
    maxHp: number;
    dailyCompletedCount: number;
    dailyMissionCount: number;
    claimableRewardCount: number;
    activeChainCount: number;
    awayHours: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * 마지막 플레이로부터 now까지 경과한 시간(ms) — lastSeenAt이 없으면 null.
 */
const getElapsedMs = (player: Player, now: number): number | null => {
    const lastSeenAt = player?.stats?.lastSeenAt;
    if (typeof lastSeenAt !== 'number' || !Number.isFinite(lastSeenAt)) return null;
    return now - lastSeenAt;
};

/**
 * buildReturnBriefing — 복귀 브리핑 카드용 데이터를 만든다.
 *
 * @param player 현재 player 상태
 * @param now 기준 시각(ms, 보통 Date.now())
 * @returns 6시간 미만 경과했거나 lastSeenAt 필드 부재 시 null, 그 외에는 Briefing 객체
 */
export function buildReturnBriefing(
    player: Player | null | undefined,
    now: number,
    effectiveMaxHp?: number,
): Briefing | null {
    if (!player) return null;

    const elapsedMs = getElapsedMs(player, now);
    if (elapsedMs === null) return null;

    const thresholdMs = BALANCE.RETURN_BRIEFING_HOURS * MS_PER_HOUR;
    if (elapsedMs < thresholdMs) return null;

    const currentDate = new Date(now);
    const dailyMissions = getCurrentDailyProtocol(player, currentDate).missions;
    const weeklyMissions = getWeeklyMissionRows(
        getCurrentWeeklyProtocol(player.weeklyProtocol, currentDate),
    );
    const claimableQuestCount = getActiveQuestEntries(player)
        .filter((entry: any) => entry.isComplete)
        .length;
    const claimableWeeklyCount = weeklyMissions
        .filter((mission: any) => mission.done && !mission.claimed)
        .length;
    const activeChainCount = buildChainJournal(player.eventChainProgress).length;

    const maxHp = typeof effectiveMaxHp === 'number' && Number.isFinite(effectiveMaxHp) && effectiveMaxHp > 0
        ? effectiveMaxHp
        : (player.maxHp ?? 0);

    return {
        loc: player.loc || '알 수 없는 곳',
        level: player.level || 1,
        hp: player.hp ?? 0,
        maxHp,
        dailyCompletedCount: dailyMissions.filter((mission: any) => mission.done).length,
        dailyMissionCount: dailyMissions.length,
        claimableRewardCount: claimableQuestCount + claimableWeeklyCount,
        activeChainCount,
        awayHours: Math.floor(elapsedMs / MS_PER_HOUR),
    };
}
