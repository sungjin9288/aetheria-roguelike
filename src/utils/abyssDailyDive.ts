/**
 * abyssDailyDive.ts — 혼돈의 심연 "일일 첫 다이브" 보상 배율 판정 (순수 함수).
 *
 * dailyProtocol과 동일한 날짜 문자열 방식으로 판정한다
 * (탐험마다 리셋하지 않음 — CLAUDE.md §8 주의사항 4와 동일 원칙).
 *
 * 리뷰 후속(2026-07): 최초 구현은 "하루 첫 전투 1회"에만 배율을 적용했는데,
 * 전투 한 번의 ×1.5는 리텐션 훅으로 체감이 없다. "첫 다이브"의 의도에 맞게
 * 하루 첫 BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT(5)전투 동안 적용하도록 확장 —
 * 상태는 used 불리언 대신 전투 카운트(combats)로 저장한다.
 */
import { BALANCE } from '../data/constants';
import type { AbyssDailyDive } from '../types/player';

export interface AbyssDailyDiveResolution {
    /** 이번 전투에 BALANCE.ABYSS_DAILY_DIVE_MULT를 적용해야 하는지 여부. */
    multiplierActive: boolean;
    /** 오늘 첫 버프 전투인지 (안내 로그는 이때 1회만 출력). */
    isFirstOfDay: boolean;
    /** dispatch로 저장해야 할 다음 abyssDailyDive 상태. */
    nextAbyssDailyDive: AbyssDailyDive;
}

/**
 * resolveAbyssDailyDive — 오늘의 다이브 버프가 아직 남았는지 판정하고,
 * 카운트가 증가된 다음 상태를 반환한다.
 *
 * @param player 현재 player 상태 (player.stats.abyssDailyDive 참조)
 * @param today 오늘 날짜 문자열 (dailyProtocol과 동일하게 YYYY-MM-DD 형식, 호출자가 계산)
 */
export function resolveAbyssDailyDive(player: { stats?: { abyssDailyDive?: AbyssDailyDive | null } } | null | undefined, today: string): AbyssDailyDiveResolution {
    const record = player?.stats?.abyssDailyDive;
    const sameDay = Boolean(record && record.date === today);
    // 하위 호환: 구형 { used: true } 레코드는 카운트 소진으로 간주 (같은 날 한정).
    const usedCombats = sameDay
        ? (typeof record?.combats === 'number' ? record.combats : (record?.used ? BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT : 0))
        : 0;

    const multiplierActive = usedCombats < BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT;

    return {
        multiplierActive,
        isFirstOfDay: multiplierActive && usedCombats === 0,
        nextAbyssDailyDive: { date: today, combats: multiplierActive ? usedCombats + 1 : usedCombats },
    };
}
