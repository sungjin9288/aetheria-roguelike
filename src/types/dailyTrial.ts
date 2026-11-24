/**
 * 2026-11 오늘의 시련 — 하루에 하나, 누구나 같은 조건으로 시작하는 짧은 판(docs/PRE_PLAYTEST_FEATURES_2026-11.md §3).
 * 본편 상태는 시련 동안 `GameState.dailyTrial.main`에 통째로 보관되고, 끝나면 그대로 돌아온다. 본편에 남는 것은 기록 장부뿐이다.
 */

/** 시련 플레이어의 표시 — 어느 날의 시련인지와 지금 걷는 지도(1부터) */
export interface DailyTrialRun {
    dayKey: string;
    map: number;
}

export type DailyTrialOutcome = 'cleared' | 'dead' | 'left';

/** 끝난 한 판 — 완주 여부 → 깬 지도 수 → 행동 수(적을수록 위) 순서로 겨룬다 */
export interface DailyTrialRecord {
    cleared: boolean;
    maps: number;
    actions: number;
}

export interface DailyTrialResult extends DailyTrialRecord {
    outcome: DailyTrialOutcome;
}

/** 하루치 기록 — 도전 수와 그날의 최고(포기한 판은 최고에 들지 않는다) */
export interface DailyTrialDay {
    day: string;
    tries: number;
    best: DailyTrialRecord | null;
}

/** 기록 장부 — 오래된 날부터, 최근 `BALANCE.DAILY_TRIAL_LEDGER_DAYS`일 */
export interface DailyTrialLedger {
    days: DailyTrialDay[];
}
