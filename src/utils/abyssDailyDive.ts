/**
 * abyssDailyDive.ts — 혼돈의 심연 "일일 첫 다이브" 보상 배율 판정 (순수 함수).
 *
 * dailyProtocol과 동일한 날짜 문자열 방식으로 하루 1회만 배율을 적용한다
 * (탐험마다 리셋하지 않음 — CLAUDE.md §8 주의사항 4와 동일 원칙).
 */
import type { AbyssDailyDive } from '../types/player';

export interface AbyssDailyDiveResolution {
    /** 이번 진입에 BALANCE.ABYSS_DAILY_DIVE_MULT를 적용해야 하는지 여부. */
    multiplierActive: boolean;
    /** dispatch로 저장해야 할 다음 abyssDailyDive 상태. */
    nextAbyssDailyDive: AbyssDailyDive;
}

/**
 * resolveAbyssDailyDive — 오늘 첫 심연 다이브인지 판정하고, 사용 처리된 다음 상태를 반환한다.
 *
 * @param player 현재 player 상태 (player.stats.abyssDailyDive 참조)
 * @param today 오늘 날짜 문자열 (dailyProtocol과 동일하게 YYYY-MM-DD 형식, 호출자가 계산)
 */
export function resolveAbyssDailyDive(player: { stats?: { abyssDailyDive?: AbyssDailyDive | null } } | null | undefined, today: string): AbyssDailyDiveResolution {
    const record = player?.stats?.abyssDailyDive;
    const alreadyUsedToday = Boolean(record && record.date === today && record.used);

    return {
        multiplierActive: !alreadyUsedToday,
        nextAbyssDailyDive: { date: today, used: true },
    };
}
