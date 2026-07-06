/**
 * returnBriefing.ts — 복귀 브리핑 카드 데이터 빌더 (순수 함수).
 *
 * 부팅 완료(bootStage 'ready') 후 마지막 플레이로부터 BALANCE.RETURN_BRIEFING_HOURS
 * 이상 지났으면 표시할 요약 정보를 만든다. player.stats.lastSeenAt(ms)이 없거나
 * 임계값 미만이면 null을 반환해 카드 자체를 렌더링하지 않는다.
 */
import { BALANCE } from '../data/constants';
import { buildChainJournal } from './chainJournal';
import type { Player } from '../types/index.js';

export interface Briefing {
    loc: string;
    level: number;
    hp: number;
    maxHp: number;
    incompleteMissionCount: number;
    activeChainCount: number;
    awayHours: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * player.stats.dailyProtocol.missions 중 아직 완료되지 않은 미션 수.
 * dailyProtocol이 없거나 missions가 배열이 아니면 0.
 */
const countIncompleteMissions = (player: Player): number => {
    const missions = player?.stats?.dailyProtocol?.missions;
    if (!Array.isArray(missions)) return 0;
    return missions.filter((mission: any) => !mission?.done).length;
};

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
export function buildReturnBriefing(player: Player | null | undefined, now: number): Briefing | null {
    if (!player) return null;

    const elapsedMs = getElapsedMs(player, now);
    if (elapsedMs === null) return null;

    const thresholdMs = BALANCE.RETURN_BRIEFING_HOURS * MS_PER_HOUR;
    if (elapsedMs < thresholdMs) return null;

    const activeChainCount = buildChainJournal(player.eventChainProgress).length;

    return {
        loc: player.loc || '알 수 없는 곳',
        level: player.level || 1,
        hp: player.hp ?? 0,
        maxHp: player.maxHp ?? 0,
        incompleteMissionCount: countIncompleteMissions(player),
        activeChainCount,
        awayHours: Math.floor(elapsedMs / MS_PER_HOUR),
    };
}
