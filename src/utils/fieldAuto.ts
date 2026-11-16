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
 * 하루 횟수는 무료 `FIELD_AUTO_RUNS_PER_DAY`번, 그 뒤 골드 `FIELD_AUTO_EXTRA_GOLD_RUNS`번, 그 뒤 크리스탈
 * `FIELD_AUTO_EXTRA_CRYSTAL_COSTS`(한 번마다 값)다 — 그날 몇 번째로 새 지도를 시작하는지가 값을 정한다(`used`만 센다).
 */

export type FieldAutoLockReason = 'uncleared' | 'no_runs' | 'no_gold' | 'no_crystal';

/** 다음 새 자동 탐험의 값 — 무료면 null */
export interface FieldAutoCost {
    currency: 'gold' | 'crystal';
    amount: number;
}

export interface FieldAutoAvailability {
    /** 지금 지도에서 이어 가기(횟수를 쓰지 않는다) */
    resumable: boolean;
    /** 오늘 남은 무료 횟수 */
    left: number;
    /** 하루 무료 횟수 */
    total: number;
    /** 다음 새 자동 탐험의 값(무료면 null, 오늘 더 살 수 없으면 null이고 `lock`이 'no_runs') */
    cost: FieldAutoCost | null;
    lock: FieldAutoLockReason | null;
}

/** 그날 `used`번 쓴 뒤 다음 한 번의 값 — 무료면 null, 오늘 더는 없으면 undefined */
export const getFieldAutoRunCost = (used: number, level: number): FieldAutoCost | null | undefined => {
    const free = BALANCE.FIELD_AUTO_RUNS_PER_DAY;
    if (used < free) return null;
    const goldRuns = BALANCE.FIELD_AUTO_EXTRA_GOLD_RUNS;
    if (used < free + goldRuns) {
        return { currency: 'gold', amount: Math.max(1, Math.trunc(level) || 1) * BALANCE.FIELD_AUTO_EXTRA_GOLD_PER_LEVEL };
    }
    const crystal = BALANCE.FIELD_AUTO_EXTRA_CRYSTAL_COSTS[used - free - goldRuns];
    return crystal === undefined ? undefined : { currency: 'crystal', amount: crystal };
};

/** 그 값을 낼 수 있는가 — 골드는 `gold`, 크리스탈은 `premiumCurrency` */
export const canPayFieldAutoCost = (player: Pick<Player, 'gold' | 'premiumCurrency'>, cost: FieldAutoCost): boolean => (
    cost.currency === 'gold' ? (player.gold || 0) >= cost.amount : (player.premiumCurrency || 0) >= cost.amount
);

/** 오늘 쓴 자동 탐험 횟수 — 날짜가 바뀌었으면 0 */
export const getFieldAutoRunsUsed = (player: Pick<Player, 'stats'>, now: number): number => {
    const record = player.stats?.fieldAutoRuns;
    if (!record || record.day !== getProtocolDayKey(new Date(now))) return 0;
    return Math.max(0, Math.trunc(Number(record.used) || 0));
};

/**
 * 이 지도에서 자동 탐험을 이어 갈 수 있다 — 자동으로 시작한 지도이고 그 탐험이 아직 끝나지 않았다.
 * 끝은 자동 경로(`planFieldAutoStep`)와 같다: 상자를 다 열고 입구에 돌아왔을 때다. 상자만 보던 동안
 * 입구로 돌아가는 길에 멈춘 탐험을 다시 켜면 새 지도를 만들고 횟수를 하나 더 썼다(설계 §7 위반).
 */
export const isFieldAutoResumable = (field: FieldMapState | null | undefined, layout: FieldMapLayout | null): boolean => (
    Boolean(field?.autoRun && layout && !(areAllFieldChestsOpened(field, layout) && field.pos === layout.entrance))
);

export const getFieldAutoAvailability = (
    player: Pick<Player, 'stats' | 'fieldClearedRegions' | 'level' | 'gold' | 'premiumCurrency'>,
    loc: string,
    field: FieldMapState | null | undefined,
    layout: FieldMapLayout | null,
    now: number,
): FieldAutoAvailability => {
    const total = BALANCE.FIELD_AUTO_RUNS_PER_DAY;
    const used = getFieldAutoRunsUsed(player, now);
    const left = Math.max(0, total - used);
    const nextCost = getFieldAutoRunCost(used, player.level || 1);
    const cost = nextCost ?? null;
    const resumable = isFieldAutoResumable(field, layout);
    const cleared = (player.fieldClearedRegions || []).includes(loc);
    const lock: FieldAutoLockReason | null = resumable ? null
        : !cleared ? 'uncleared'
            : nextCost === undefined ? 'no_runs'
                : cost && !canPayFieldAutoCost(player, cost) ? (cost.currency === 'gold' ? 'no_gold' : 'no_crystal')
                    : null;
    return { resumable, left, total, cost: resumable ? null : cost, lock };
};

export const getFieldAutoLockText = (lock: FieldAutoLockReason, cost?: FieldAutoCost | null): string => {
    if (lock === 'uncleared') return MSG.FIELD_AUTO_LOCKED_UNCLEARED;
    if (lock === 'no_gold') return MSG.FIELD_AUTO_LOCKED_NO_GOLD(cost?.amount ?? 0);
    if (lock === 'no_crystal') return MSG.FIELD_AUTO_LOCKED_NO_CRYSTAL(cost?.amount ?? 0);
    return MSG.FIELD_AUTO_LOCKED_NO_RUNS;
};

/** 자동 탐험 단추 글 — 무료면 남은 횟수, 아니면 값 */
export const getFieldAutoButtonText = (auto: Pick<FieldAutoAvailability, 'left' | 'total' | 'cost' | 'resumable'>): string => {
    if (auto.resumable || !auto.cost) return MSG.FIELD_AUTO_BUTTON(auto.left, auto.total);
    return auto.cost.currency === 'gold'
        ? MSG.FIELD_AUTO_BUTTON_GOLD(auto.cost.amount)
        : MSG.FIELD_AUTO_BUTTON_CRYSTAL(auto.cost.amount);
};

/** 자동 탐험이 멈춘 이유 한 줄 — 행동을 권하지 않는다(Wave 88). */
export const getFieldAutoStopText = (
    reason: AutoExploreStopReason | 'manual' | 'hidden',
    player: Parameters<typeof getAutoExploreHpStopRatio>[0],
): string => {
    if (reason === 'manual') return MSG.FIELD_AUTO_STOPPED_MANUAL;
    if (reason === 'hp_low') return MSG.FIELD_AUTO_STOPPED(MSG.FIELD_AUTO_STOP_HP_LOW(Math.round(getAutoExploreHpStopRatio(player) * 100)));
    return MSG.FIELD_AUTO_STOPPED(MSG.FIELD_AUTO_STOP_REASON[reason]);
};
