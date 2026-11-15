import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { areAllFieldChestsOpened } from '../systems/fieldMapWalk';
import type { FieldMapLayout, FieldMapState } from '../types/fieldMap';
import type { Player } from '../types/player';
import { getAutoExploreHpStopRatio, type AutoExploreStopReason } from './autoExplore';
import { getProtocolDayKey } from './protocolCycle';

/**
 * 지역 지도 자동 탐험의 쓸 수 있음 판정(설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §7) — 리듀서(`FIELD_AUTO_START`)와 지도 화면
 * 단추가 같이 읽는다. 횟수 기록은 계정 범위 `stats.fieldAutoRuns`, 클리어 기록은 여정 범위 `fieldClearedRegions`다.
 */

export type FieldAutoLockReason = 'uncleared' | 'no_runs';

export interface FieldAutoAvailability {
    /** 지금 지도에서 이어 가기(횟수를 쓰지 않는다) */
    resumable: boolean;
    /** 새로 시작하면 1회를 쓴다 */
    left: number;
    total: number;
    lock: FieldAutoLockReason | null;
}

/** 오늘 쓴 자동 탐험 횟수 — 날짜가 바뀌었으면 0 */
export const getFieldAutoRunsUsed = (player: Pick<Player, 'stats'>, now: number): number => {
    const record = player.stats?.fieldAutoRuns;
    if (!record || record.day !== getProtocolDayKey(new Date(now))) return 0;
    return Math.max(0, Math.trunc(Number(record.used) || 0));
};

/** 이 지도에서 자동 탐험을 이어 갈 수 있다 — 자동으로 시작한 지도이고 열지 않은 상자가 남았다. */
export const isFieldAutoResumable = (field: FieldMapState | null | undefined, layout: FieldMapLayout | null): boolean => (
    Boolean(field?.autoRun && layout && !areAllFieldChestsOpened(field, layout))
);

export const getFieldAutoAvailability = (
    player: Pick<Player, 'stats' | 'fieldClearedRegions'>,
    loc: string,
    field: FieldMapState | null | undefined,
    layout: FieldMapLayout | null,
    now: number,
): FieldAutoAvailability => {
    const total = BALANCE.FIELD_AUTO_RUNS_PER_DAY;
    const left = Math.max(0, total - getFieldAutoRunsUsed(player, now));
    const resumable = isFieldAutoResumable(field, layout);
    const cleared = (player.fieldClearedRegions || []).includes(loc);
    const lock: FieldAutoLockReason | null = resumable ? null
        : !cleared ? 'uncleared'
            : left <= 0 ? 'no_runs'
                : null;
    return { resumable, left, total, lock };
};

export const getFieldAutoLockText = (lock: FieldAutoLockReason): string => (
    lock === 'uncleared' ? MSG.FIELD_AUTO_LOCKED_UNCLEARED : MSG.FIELD_AUTO_LOCKED_NO_RUNS
);

/** 자동 탐험이 멈춘 이유 한 줄 — 행동을 권하지 않는다(Wave 88). */
export const getFieldAutoStopText = (
    reason: AutoExploreStopReason | 'manual' | 'hidden',
    player: Parameters<typeof getAutoExploreHpStopRatio>[0],
): string => {
    if (reason === 'manual') return MSG.FIELD_AUTO_STOPPED_MANUAL;
    if (reason === 'hp_low') return MSG.FIELD_AUTO_STOPPED(MSG.FIELD_AUTO_STOP_HP_LOW(Math.round(getAutoExploreHpStopRatio(player) * 100)));
    return MSG.FIELD_AUTO_STOPPED(MSG.FIELD_AUTO_STOP_REASON[reason]);
};
